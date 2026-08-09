"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows } from "@react-three/drei";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import * as THREE from "three";

import { Notebook } from "./notebook";
import { getMaterials, buildStudioEquirect } from "./textures";
import { BUDGET, type Tier } from "./capability";
import { SCENE, beat, ease, damp, type SceneProgress } from "./use-scene-progress";

/**
 * The studio the notebook sits in.
 *
 * Lit as a product photograph rather than a game: one large soft key at a
 * shallow angle to rake across the paper and pick up its fibre, a dim fill on
 * the opposite side so the shadow side is not black, and a warm practical off to
 * one edge for the suggestion of a desk lamp. No coloured rim lights, no
 * dramatic contrast — the object is meant to look photographed, not staged.
 */

// --- camera --------------------------------------------------------------

interface Shot {
  /** Camera position. */
  position: [number, number, number];
  /** Point the camera looks at. */
  target: [number, number, number];
  /** Vertical field of view; narrowing it compresses depth like a longer lens. */
  fov: number;
}

/**
 * The shot list, one per beat.
 *
 * The move is a dolly with a focal-length change, not a zoom: the camera
 * genuinely travels toward the notebook while the lens lengthens, which is what
 * makes the background compress and the object gain presence.
 */
const SHOTS: Record<keyof typeof SCENE, Shot> = {
  intro: { position: [1.35, 1.62, 2.25], target: [0.5, 0.1, 0], fov: 38 },
  opening: { position: [0.55, 1.32, 1.85], target: [0.35, 0.12, 0], fov: 34 },
  turning: { position: [0.2, 1.24, 1.42], target: [0.4, 0.16, 0], fov: 32 },
  writing: { position: [0.46, 1.06, 1.02], target: [0.52, 0.18, -0.02], fov: 30 },
  resolve: { position: [0.66, 1.58, 1.95], target: [0.45, 0.12, 0], fov: 36 },
};

/**
 * The same story told for a tall, narrow frame.
 *
 * Not the desktop shot list scaled down — a portrait viewport wants a different
 * composition entirely. The camera sits more overhead and much closer to the
 * spine so the page fills the width rather than floating in the middle of it,
 * and the notebook is framed low, leaving the upper third for type. Shrinking
 * the desktop framing here would put a small object in a large empty rectangle.
 */
const SHOTS_PORTRAIT: Record<keyof typeof SCENE, Shot> = {
  intro: { position: [0.95, 1.55, 1.55], target: [0.5, 0.05, 0.1], fov: 46 },
  opening: { position: [0.45, 1.35, 1.25], target: [0.3, 0.08, 0.05], fov: 44 },
  turning: { position: [0.3, 1.2, 0.95], target: [0.42, 0.12, 0], fov: 42 },
  writing: { position: [0.52, 0.86, 0.6], target: [0.54, 0.16, -0.05], fov: 40 },
  resolve: { position: [0.6, 1.5, 1.35], target: [0.48, 0.08, 0.05], fov: 45 },
};

const ORDER: Array<keyof typeof SCENE> = [
  "intro",
  "opening",
  "turning",
  "writing",
  "resolve",
];

function lerp3(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

/**
 * Which two shots the timeline is between, and how far.
 *
 * A pure function rather than a loop assigning into mutable locals — the same
 * inputs always give the same shot, which makes the camera path something that
 * can be reasoned about (and scrubbed backwards) rather than accumulated state.
 */
function shotAt(
  progress: number,
  shots: Record<keyof typeof SCENE, Shot>,
): { from: Shot; to: Shot; t: number } {
  let last = { from: shots.intro, to: shots.intro, t: 0 };

  for (let i = 0; i < ORDER.length; i += 1) {
    const key = ORDER[i];
    const local = beat(progress, SCENE[key]);
    const next = shots[ORDER[Math.min(i + 1, ORDER.length - 1)]];

    if (local > 0 && local < 1) {
      return { from: shots[key], to: next, t: ease(local) };
    }

    if (local === 1) {
      last = { from: shots[key], to: next, t: 1 };
    }
  }

  return last;
}

/**
 * Drives the camera from scroll.
 *
 * Damped rather than snapped to the scroll value: the camera carries a little
 * inertia so a sharp flick of the wheel does not translate into a sharp jolt of
 * the lens. Pointer position adds a few degrees of parallax on top, which is
 * what gives the scene the feeling of a real space rather than a rendered image.
 */
function CameraRig({
  progress,
  pointer,
}: {
  progress: React.RefObject<SceneProgress>;
  pointer: React.RefObject<{ x: number; y: number }>;
}) {
  const { camera, size } = useThree();
  // Chosen from the frame's own shape rather than a device guess: a narrow
  // desktop window deserves the portrait composition just as much as a phone.
  const shots = size.height > size.width * 1.15 ? SHOTS_PORTRAIT : SHOTS;
  const current = useRef({
    position: new THREE.Vector3(...SHOTS.intro.position),
    target: new THREE.Vector3(...SHOTS.intro.target),
    fov: SHOTS.intro.fov,
    drift: new THREE.Vector2(),
  });

  // useFrame runs outside React's render. Driving three.js objects by mutation
  // is the whole point of the render loop; copying them every frame would
  // allocate sixty times a second.
  // eslint-disable-next-line react-hooks/immutability
  useFrame((_, delta) => {
    const p = progress.current.current;
    const dt = Math.min(delta, 1 / 30);

    const { from, to, t } = shotAt(p, shots);

    const wantPosition = lerp3(from.position, to.position, t);
    const wantTarget = lerp3(from.target, to.target, t);
    const wantFov = from.fov + (to.fov - from.fov) * t;

    const state = current.current;

    state.position.x = damp(state.position.x, wantPosition[0], 5, dt);
    state.position.y = damp(state.position.y, wantPosition[1], 5, dt);
    state.position.z = damp(state.position.z, wantPosition[2], 5, dt);

    state.target.x = damp(state.target.x, wantTarget[0], 5, dt);
    state.target.y = damp(state.target.y, wantTarget[1], 5, dt);
    state.target.z = damp(state.target.z, wantTarget[2], 5, dt);

    // Pointer parallax, scaled down as the camera closes in — a handheld
    // operator steadies up for a close-up.
    const closeness = 1 - Math.min(1, p / 0.8);
    state.drift.x = damp(state.drift.x, pointer.current.x * 0.16 * closeness, 3, dt);
    state.drift.y = damp(state.drift.y, pointer.current.y * 0.1 * closeness, 3, dt);

    camera.position.set(
      state.position.x + state.drift.x,
      state.position.y + state.drift.y,
      state.position.z,
    );
    camera.lookAt(state.target);

    const perspective = camera as THREE.PerspectiveCamera;
    state.fov = damp(state.fov, wantFov, 5, dt);

    if (Math.abs(perspective.fov - state.fov) > 0.01) {
      // eslint-disable-next-line react-hooks/immutability -- see above
      perspective.fov = state.fov;
      perspective.updateProjectionMatrix();
    }
  });

  return null;
}

// --- environment ---------------------------------------------------------

/** The desk the notebook sits on. */
function Desk({ textureSize }: { textureSize: number }) {
  const materials = useMemo(() => getMaterials(textureSize), [textureSize]);

  const material = useMemo(() => {
    const map = materials.desk.map.clone();
    const normalMap = materials.desk.normalMap.clone();

    // The desk plane is 14 units across. At three repeats each tile spanned
    // nearly five units, magnifying the grain until it smeared; seven puts a
    // board at roughly the width of the notebook, which is about right for oak.
    [map, normalMap].forEach((texture) => {
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(7, 7);
      texture.needsUpdate = true;
    });

    return new THREE.MeshStandardMaterial({
      map,
      normalMap,
      normalScale: new THREE.Vector2(0.5, 0.5),
      roughness: 0.6,
      metalness: 0,
      color: "#8a6a49",
    });
  }, [materials]);

  useEffect(() => {
    return () => {
      material.map?.dispose();
      material.normalMap?.dispose();
      material.dispose();
    };
  }, [material]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.4, -0.001, 0]} receiveShadow>
      <planeGeometry args={[14, 14]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

/**
 * Installs the studio reflection map.
 *
 * Deliberately not drei's `<Environment>`. Its preset mode fetches an HDRI from
 * a CDN, and its children mode still runs the environment loader — either way
 * the scene depends on a network request that can hang, and a suspended scene
 * renders nothing at all with no error to explain itself. Generating the map
 * here removes that from the critical path: it is synchronous, deterministic,
 * and works offline.
 *
 * PMREM prefilters the map so roughness is respected — without it a rough cloth
 * cover would mirror the softboxes as sharply as glass.
 */
function useStudioEnvironment() {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);

  useEffect(() => {
    const source = buildStudioEquirect();
    const pmrem = new THREE.PMREMGenerator(gl);
    const target = pmrem.fromEquirectangular(source);

    // Installing an environment map is a mutation of the live scene graph by
    // design — the same escape hatch the render loop uses.
    // eslint-disable-next-line react-hooks/immutability
    scene.environment = target.texture;

    return () => {
      scene.environment = null;
      target.dispose();
      pmrem.dispose();
      source.dispose();
    };
  }, [gl, scene]);

  return null;
}

function StudioEnvironment() {
  useStudioEnvironment();
  return null;
}

function Lighting({ shadows }: { shadows: boolean }) {
  // Area lights need their lookup tables loaded before first use.
  useEffect(() => {
    RectAreaLightUniformsLib.init();
  }, []);

  const key = useRef<THREE.RectAreaLight>(null);
  const fill = useRef<THREE.RectAreaLight>(null);

  useEffect(() => {
    key.current?.lookAt(0.4, 0, 0);
    fill.current?.lookAt(0.4, 0.1, 0);
  }, []);

  return (
    <>
      {/* Ambient floor, kept very low — it exists to stop crushed blacks, not
          to light the scene. */}
      <ambientLight intensity={0.34} color="#cfd8e6" />

      {/* Key softbox. */}
      <rectAreaLight
        ref={key}
        position={[-1.6, 2.6, 1.5]}
        width={4}
        height={3}
        intensity={7.2}
        color="#fff6e8"
      />

      {/* Fill, cooler and much dimmer. */}
      <rectAreaLight
        ref={fill}
        position={[2.6, 1.5, -0.9]}
        width={3}
        height={2.4}
        intensity={2.1}
        color="#aec2e0"
      />

      {/* The one shadow-casting light. A single hard-ish source keeps the
          contact shadow legible; everything else is soft and shadowless. */}
      <directionalLight
        position={[-1.9, 3.1, 1.7]}
        intensity={1.35}
        color="#fff3e0"
        castShadow={shadows}
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0008}
        shadow-normalBias={0.02}
      >
        <orthographicCamera attach="shadow-camera" args={[-2.5, 2.5, 2.5, -2.5, 0.1, 8]} />
      </directionalLight>

      {/* Warm practical, suggesting a lamp just out of frame. */}
      <pointLight position={[2.2, 0.9, 1.4]} intensity={1.4} color="#ffb877" distance={6} decay={2} />
    </>
  );
}

// --- scene ---------------------------------------------------------------

interface SceneProps {
  progress: React.RefObject<SceneProgress>;
  tier: Exclude<Tier, "static">;
  handwritingFont: string;
}

export default function NotebookScene({ progress, tier, handwritingFont }: SceneProps) {
  const budget = BUDGET[tier];
  const pointer = useRef({ x: 0, y: 0 });

  useEffect(() => {
    // Pointer parallax only makes sense with a real pointer; on touch the
    // camera stays where the scroll puts it.
    if (window.matchMedia("(pointer: coarse)").matches) return;

    const onMove = (event: PointerEvent) => {
      pointer.current.x = (event.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = -((event.clientY / window.innerHeight) * 2 - 1);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  // R3F will not create its renderer until the container measures non-zero, and
  // that measurement arrives through a ResizeObserver. Most browsers deliver one
  // immediately on observe; a backgrounded tab or an embedded webview may not,
  // and the scene then sits at the canvas default of 300×150 forever with no
  // error. One resize event after mount costs nothing and closes that hole.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      window.dispatchEvent(new Event("resize"));
    });

    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <Canvas
      dpr={budget.dpr}
      shadows={budget.shadows}
      /**
       * R3F refuses to create its renderer until `react-use-measure` reports a
       * non-zero container, and its default scroll-aware mode measures against
       * the offset parent — which, inside a `position: sticky` stage, can report
       * zero and never correct itself. The scene then mounts a 300×150 canvas
       * and renders nothing, with no error to explain it.
       *
       * Development hides the bug: StrictMode mounts twice, and the second mount
       * measures an element that already has a size. Production mounts once and
       * stays blank. Measuring off the element itself, undebounced, is both more
       * accurate here and immune to that race.
       */
      resize={{ scroll: false, debounce: 0 }}
      gl={{
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      }}
      camera={{ position: SHOTS.intro.position, fov: SHOTS.intro.fov, near: 0.1, far: 40 }}
      onCreated={({ gl, scene }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.24;
        // A touch of atmosphere so the desk falls away rather than ending at a
        // hard edge.
        scene.fog = new THREE.Fog("#12151b", 6.5, 16);
      }}
    >
      <CameraRig progress={progress} pointer={pointer} />
      <StudioEnvironment />
      <Lighting shadows={budget.shadows} />

      <Desk textureSize={budget.texture} />

      <Notebook
        progress={progress}
        textureSize={budget.texture}
        turningPages={tier === "full" ? 6 : 3}
        handwritingFont={handwritingFont}
      />

      <ContactShadows
        position={[0.4, 0.002, 0]}
        scale={5}
        resolution={budget.shadows ? 1024 : 512}
        blur={2.6}
        opacity={0.62}
        far={1.2}
        frames={tier === "full" ? Infinity : 1}
      />
    </Canvas>
  );
}
