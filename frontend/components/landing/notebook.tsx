"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";

import { getMaterials } from "./textures";
import { makePageBendable } from "./page-material";
import { PAGE_W, PAGE_H, paintAssignment, paintRuling } from "./assignment";
import { SCENE, beat, ease, damp, type SceneProgress } from "./use-scene-progress";

/**
 * The notebook.
 *
 * Dimensions are in decimetres — an A5 notebook is roughly 1.5 × 1.05 units —
 * which keeps the numbers readable and puts the camera at a believable distance
 * without fighting Three's default near/far planes.
 *
 * Every proportion here is taken from a real casebound notebook: the cover
 * overhangs the text block by about 3mm on three sides, the spine is square
 * rather than rounded, the block is a couple of hundred sheets, and there is a
 * ribbon and an elastic because that is what this kind of notebook has. The
 * details are cheap to render and they are most of why it reads as an object
 * rather than a shape.
 */

const PAGE_WIDTH = 1.05;
const PAGE_HEIGHT = 1.5;
const COVER_OVERHANG = 0.03;
const COVER_WIDTH = PAGE_WIDTH + COVER_OVERHANG;
const COVER_HEIGHT = PAGE_HEIGHT + COVER_OVERHANG * 2;
const COVER_THICKNESS = 0.028;
const BLOCK_THICKNESS = 0.15;

/** Closed-book thickness as a fraction of cover height, for flattening the elastic loop. */
const ELASTIC_FLATTEN =
  (BLOCK_THICKNESS + COVER_THICKNESS * 2 + 0.018) / (COVER_HEIGHT + 0.012);

interface NotebookProps {
  progress: React.RefObject<SceneProgress>;
  textureSize: number;
  turningPages: number;
  handwritingFont: string;
}

export function Notebook({
  progress,
  textureSize,
  turningPages,
  handwritingFont,
}: NotebookProps) {
  const materials = useMemo(() => getMaterials(textureSize), [textureSize]);

  // --- the page that receives the assignment ----------------------------

  const writing = useMemo(() => {
    const canvas = document.createElement("canvas");
    // Portrait, matching the page: a square texture would waste half its pixels.
    canvas.width = textureSize;
    canvas.height = Math.round(textureSize * (PAGE_H / PAGE_W));

    const ctx = canvas.getContext("2d")!;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;

    return { canvas, ctx, texture, scale: canvas.width / PAGE_W };
  }, [textureSize]);

  useEffect(() => {
    return () => {
      writing.texture.dispose();
    };
  }, [writing]);

  const penRef = useRef<THREE.Group>(null);
  const lastPainted = useRef(-1);

  /** Repaints the page, but only when the writing has actually moved on. */
  const repaint = (written: number) => {
    // A texture upload per frame is the most expensive thing this scene could
    // do. Quantising to ~400 steps is finer than the eye resolves at this size
    // and cuts uploads by an order of magnitude.
    const quantised = Math.round(written * 400) / 400;
    if (quantised === lastPainted.current) return;
    lastPainted.current = quantised;

    const { ctx, canvas, scale } = writing;

    // The written page carries its own colour map, so it has to supply the
    // paper as well as the ink. Clearing to transparent would leave the map
    // black wherever nothing had been written yet — a dark page in a notebook
    // of cream ones — because an unlit colour map contributes nothing but its
    // own zeroes.
    //
    // Drawing the generated paper underneath, rather than filling a flat cream,
    // keeps the fibre and pulp variation of every other page in the block. It is
    // stretched from square to portrait; the source is noise, so nothing about
    // it reads as distorted.
    ctx.drawImage(
      materials.paper.map.image as CanvasImageSource,
      0,
      0,
      canvas.width,
      canvas.height,
    );

    paintRuling(ctx, scale);

    const pen = paintAssignment(ctx, quantised, scale, handwritingFont);
    // Flagging a texture dirty is how an uploaded canvas reaches the GPU;
    // there is no immutable copy of a CanvasTexture that would achieve it.
    // eslint-disable-next-line react-hooks/immutability
    writing.texture.needsUpdate = true;

    // Park the pen on the nib position, converting canvas pixels to the page's
    // own coordinate space.
    if (penRef.current) {
      const group = penRef.current;
      group.visible = pen.visible;

      if (pen.visible) {
        group.position.x = (pen.x / canvas.width) * PAGE_WIDTH;
        group.position.z = (pen.y / canvas.height) * PAGE_HEIGHT - PAGE_HEIGHT / 2;
        group.rotation.z = -0.42 + pen.tilt;
      }
    }
  };

  // --- materials --------------------------------------------------------

  const paperMaterial = useMemo(() => {
    const material = new THREE.MeshStandardMaterial({
      map: materials.paper.map,
      normalMap: materials.paper.normalMap,
      roughnessMap: materials.paper.roughnessMap,
      normalScale: new THREE.Vector2(0.45, 0.45),
      roughness: 0.92,
      metalness: 0,
      side: THREE.DoubleSide,
    });
    return material;
  }, [materials]);

  const writtenMaterial = useMemo(() => {
    const material = paperMaterial.clone();
    material.map = writing.texture;
    // The ruling and ink are baked into the same map as the paper tint, so the
    // colour map is doing double duty; the fibre normal still comes from the
    // shared paper maps underneath.
    material.normalMap = materials.paper.normalMap;
    material.roughnessMap = materials.paper.roughnessMap;
    return material;
  }, [paperMaterial, writing.texture, materials]);

  const coverMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        map: materials.cover.map,
        normalMap: materials.cover.normalMap,
        roughnessMap: materials.cover.roughnessMap,
        normalScale: new THREE.Vector2(0.9, 0.9),
        roughness: 0.62,
        metalness: 0,
        // A thin lacquer over the cloth: it is what gives a bookbound cover its
        // soft sheen without making it look like plastic.
        clearcoat: 0.35,
        clearcoatRoughness: 0.55,
        sheen: 0.4,
        sheenRoughness: 0.8,
        sheenColor: new THREE.Color("#8fa4c4"),
      }),
    [materials],
  );

  // --- geometry ---------------------------------------------------------

  /**
   * A sheet lying flat with its fold on the Y axis.
   *
   * `PlaneGeometry` is built centred in the XY plane, which is wrong twice over
   * here: the sheet needs to lie in XZ, and it has to hinge at its own edge
   * rather than through its middle. Both are baked into the attribute once,
   * rather than corrected per-mesh, because the bend shader reads `position.x`
   * as distance from the fold — the geometry has to mean that.
   */
  const pageGeometry = useMemo(() => {
    const geometry = new THREE.PlaneGeometry(PAGE_WIDTH, PAGE_HEIGHT, 24, 2);
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(PAGE_WIDTH / 2, 0, 0);
    return geometry;
  }, []);

  /** The written page never bends, so it needs no segments. */
  const writtenGeometry = useMemo(() => {
    const geometry = new THREE.PlaneGeometry(PAGE_WIDTH, PAGE_HEIGHT);
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(PAGE_WIDTH / 2, 0, 0);
    return geometry;
  }, []);

  useEffect(() => {
    return () => {
      pageGeometry.dispose();
      writtenGeometry.dispose();
    };
  }, [pageGeometry, writtenGeometry]);

  // --- turning pages ----------------------------------------------------

  const pages = useMemo(() => {
    return Array.from({ length: turningPages }, (_, index) => {
      const material = paperMaterial.clone();
      const uniforms = makePageBendable(material, PAGE_WIDTH);
      return { material, uniforms, index };
    });
  }, [paperMaterial, turningPages]);

  useEffect(() => {
    return () => {
      pages.forEach((page) => page.material.dispose());
      paperMaterial.dispose();
      writtenMaterial.dispose();
      coverMaterial.dispose();
    };
  }, [pages, paperMaterial, writtenMaterial, coverMaterial]);

  // --- animation --------------------------------------------------------

  const coverRef = useRef<THREE.Group>(null);
  const bookRef = useRef<THREE.Group>(null);
  const elasticRef = useRef<THREE.Group>(null);
  const smoothed = useRef({ cover: 0, lift: 0 });

  // useFrame runs outside React's render. Driving three.js objects by mutation
  // is the whole point of the render loop; copying them every frame would
  // allocate sixty times a second.
  // eslint-disable-next-line react-hooks/immutability
  useFrame((_, delta) => {
    const p = progress.current.current;
    const velocity = Math.abs(progress.current.velocity);
    const dt = Math.min(delta, 1 / 30);

    // Cover: closed through the intro, then swings a full half-turn.
    const openTarget = ease(beat(p, SCENE.opening));
    smoothed.current.cover = damp(smoothed.current.cover, openTarget, 9, dt);

    if (coverRef.current) {
      // Slight overshoot at the end of the swing — board has mass, and it
      // settles rather than stopping dead.
      const overshoot = Math.sin(smoothed.current.cover * Math.PI) * 0.05;
      coverRef.current.rotation.z = smoothed.current.cover * Math.PI + overshoot;
    }

    // The elastic comes off before the cover moves, and is gone by the time it
    // is halfway — leaving it stretched across an open notebook would be worse
    // than not modelling it at all.
    if (elasticRef.current) {
      const off = Math.min(1, openTarget / 0.28);
      elasticRef.current.visible = off < 1;
      elasticRef.current.position.x = PAGE_WIDTH * 0.84 + off * 0.5;
      elasticRef.current.scale.setScalar(1 - off * 0.35);
    }

    // The whole book eases up off the desk a little as it opens, the way a
    // block lifts when the covers spread.
    if (bookRef.current) {
      const lift = openTarget * 0.012;
      smoothed.current.lift = damp(smoothed.current.lift, lift, 7, dt);
      bookRef.current.position.y = smoothed.current.lift;
    }

    // Pages: staggered turns across the turning beat.
    const turnBeat = beat(p, SCENE.turning);
    const stride = 1 / (pages.length + 2);

    pages.forEach((page, index) => {
      const start = index * stride * 0.85;
      const local = Math.min(1, Math.max(0, (turnBeat - start) / (stride * 2.4)));
      const turned = ease(local);

      page.uniforms.uTurn.value = turned;
      // The bow peaks mid-turn and grows with how hard the reader is scrolling.
      page.uniforms.uBend.value =
        Math.sin(turned * Math.PI) * (0.055 + Math.min(velocity, 3) * 0.03);
      page.uniforms.uDroop.value = Math.sin(turned * Math.PI) * 0.05;
    });

    // Writing follows its own beat.
    repaint(ease(beat(p, SCENE.writing)));
  });

  // --- geometry ---------------------------------------------------------

  return (
    <group ref={bookRef}>
      {/* Back cover, resting on the desk. */}
      <RoundedBox
        args={[COVER_WIDTH, COVER_THICKNESS, COVER_HEIGHT]}
        radius={0.012}
        smoothness={4}
        position={[COVER_WIDTH / 2 - COVER_OVERHANG, COVER_THICKNESS / 2, 0]}
        castShadow
        receiveShadow
        material={coverMaterial}
      />

      {/* Text block: one solid body for the mass of paper, with its edges
          visible. Individual sheets are only modelled where they move. */}
      <mesh
        position={[
          PAGE_WIDTH / 2,
          COVER_THICKNESS + BLOCK_THICKNESS / 2,
          0,
        ]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[PAGE_WIDTH, BLOCK_THICKNESS, PAGE_HEIGHT]} />
        <meshStandardMaterial
          map={materials.paper.map}
          normalMap={materials.paper.normalMap}
          normalScale={new THREE.Vector2(0.7, 0.7)}
          roughness={0.95}
          color="#efe9dc"
        />
      </mesh>

      {/* The written page, sitting on top of the block. */}
      <mesh
        position={[0, COVER_THICKNESS + BLOCK_THICKNESS + 0.001, 0]}
        geometry={writtenGeometry}
        material={writtenMaterial}
        receiveShadow
      />

      {/* Pages that turn. Each is a segmented sheet so the bend shader has
          vertices to work with. */}
      {pages.map((page) => (
        <mesh
          key={page.index}
          position={[
            0,
            COVER_THICKNESS + BLOCK_THICKNESS + 0.002 + page.index * 0.0014,
            0,
          ]}
          geometry={pageGeometry}
          material={page.material}
          castShadow
        />
      ))}

      {/* Front cover, hinged at the spine. */}
      <group
        ref={coverRef}
        position={[0, COVER_THICKNESS + BLOCK_THICKNESS + 0.02, 0]}
      >
        <RoundedBox
          args={[COVER_WIDTH, COVER_THICKNESS, COVER_HEIGHT]}
          radius={0.012}
          smoothness={4}
          position={[COVER_WIDTH / 2 - COVER_OVERHANG, 0, 0]}
          castShadow
          receiveShadow
          material={coverMaterial}
        />

      </group>

      {/* Elastic closure.
          It crosses the cover vertically near the fore-edge and wraps the top
          and bottom, so the loop lies in the YZ plane — hence the quarter turn;
          a torus is built in XY and would otherwise stand up as a hoop around
          the whole book. Squashed on Y to the thickness of the closed block, and
          slipped off as soon as the notebook opens.
          It belongs to the book, not to the cover that swings out from under it. */}
      <group
        ref={elasticRef}
        position={[
          PAGE_WIDTH * 0.84,
          (COVER_THICKNESS * 2 + BLOCK_THICKNESS) / 2,
          0,
        ]}
        rotation={[0, Math.PI / 2, 0]}
      >
        <mesh
          scale={[1, ELASTIC_FLATTEN, 1]}
          castShadow
        >
          <torusGeometry args={[COVER_HEIGHT / 2 + 0.006, 0.005, 8, 64]} />
          <meshStandardMaterial color="#151922" roughness={0.85} />
        </mesh>
      </group>

      {/* Spine: the wrap of cloth around the fold. */}
      <mesh
        position={[
          -COVER_OVERHANG + 0.004,
          COVER_THICKNESS + BLOCK_THICKNESS / 2,
          0,
        ]}
        castShadow
      >
        <boxGeometry
          args={[0.03, BLOCK_THICKNESS + COVER_THICKNESS * 2, COVER_HEIGHT]}
        />
        <primitive object={coverMaterial} attach="material" />
      </mesh>

      {/* Ribbon marker, trailing out of the block. */}
      <mesh
        position={[PAGE_WIDTH * 0.42, COVER_THICKNESS + BLOCK_THICKNESS + 0.0005, PAGE_HEIGHT * 0.36]}
        rotation={[-Math.PI / 2, 0, 0.06]}
      >
        <planeGeometry args={[0.045, PAGE_HEIGHT * 0.5]} />
        <meshStandardMaterial color="#8d2f3a" roughness={0.62} side={THREE.DoubleSide} />
      </mesh>

      {/* Pen, parked on the nib while writing. */}
      <group
        ref={penRef}
        visible={false}
        position={[0, COVER_THICKNESS + BLOCK_THICKNESS + 0.005, 0]}
      >
        <group rotation={[0, 0, -0.42]} position={[0, 0.16, 0.05]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.012, 0.014, 0.42, 16]} />
            <meshPhysicalMaterial
              color="#14181f"
              roughness={0.25}
              clearcoat={0.8}
              clearcoatRoughness={0.15}
            />
          </mesh>
          <mesh position={[0, -0.23, 0]} castShadow>
            <coneGeometry args={[0.012, 0.06, 16]} />
            <meshStandardMaterial color="#b9a06a" roughness={0.3} metalness={0.85} />
          </mesh>
          <mesh position={[0, 0.13, 0]}>
            <cylinderGeometry args={[0.0142, 0.0142, 0.07, 16]} />
            <meshStandardMaterial color="#b9a06a" roughness={0.28} metalness={0.9} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

export { PAGE_WIDTH, PAGE_HEIGHT, COVER_THICKNESS, BLOCK_THICKNESS };
