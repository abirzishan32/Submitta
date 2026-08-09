import * as THREE from "three";

/**
 * Procedural materials for the notebook.
 *
 * Every map here is generated on a canvas at runtime rather than shipped as an
 * image. Three reasons, in order of importance: a 2K paper texture is a ~1.5MB
 * download that would dominate the page budget; generated noise never tiles
 * visibly the way a small repeating photo does; and the notebook can be recoloured
 * or resized without re-authoring assets.
 *
 * The cost is a few milliseconds of main-thread work at mount, paid once — the
 * results are cached in the module and shared by every mesh that wants them.
 */

// --- noise ---------------------------------------------------------------

/** Deterministic hash, so the paper looks identical on every load and reload. */
function hash(x: number, y: number, seed: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Bilinearly interpolated value noise. */
function valueNoise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = smooth(x - xi);
  const yf = smooth(y - yi);

  const a = hash(xi, yi, seed);
  const b = hash(xi + 1, yi, seed);
  const c = hash(xi, yi + 1, seed);
  const d = hash(xi + 1, yi + 1, seed);

  return (
    a * (1 - xf) * (1 - yf) +
    b * xf * (1 - yf) +
    c * (1 - xf) * yf +
    d * xf * yf
  );
}

/** Fractal noise. Octaves stack detail; each is half the amplitude and twice the rate. */
function fbm(x: number, y: number, octaves: number, seed = 0): number {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1;

  for (let i = 0; i < octaves; i += 1) {
    value += amplitude * valueNoise(x * frequency, y * frequency, seed + i * 17);
    frequency *= 2;
    amplitude *= 0.5;
  }

  return value;
}

// --- canvas plumbing -----------------------------------------------------

function makeCanvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  return [canvas, ctx];
}

function toTexture(canvas: HTMLCanvasElement, srgb = false): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Derives a normal map from a height field using a Sobel gradient.
 *
 * Generating height once and differentiating it keeps the bumps consistent with
 * the diffuse variation — paper fibre that is visible in colour is felt in the
 * lighting too, which is most of what sells a surface as real.
 */
function heightToNormal(
  height: Float32Array,
  size: number,
  strength: number,
): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(size);
  const image = ctx.createImageData(size, size);

  const at = (x: number, y: number) =>
    height[((y + size) % size) * size + ((x + size) % size)];

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx =
        at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1) -
        (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1));

      const dy =
        at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1) -
        (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1));

      const nx = dx * strength;
      const ny = dy * strength;
      const nz = 1;
      const length = Math.hypot(nx, ny, nz);

      const index = (y * size + x) * 4;
      image.data[index] = ((nx / length) * 0.5 + 0.5) * 255;
      image.data[index + 1] = ((ny / length) * 0.5 + 0.5) * 255;
      image.data[index + 2] = ((nz / length) * 0.5 + 0.5) * 255;
      image.data[index + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);
  return toTexture(canvas);
}

// --- paper ---------------------------------------------------------------

export interface PaperMaps {
  map: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
}

/**
 * Uncoated cream stock.
 *
 * Three things separate real paper from a flat off-white plane: directional
 * fibre (paper is pressed, so the grain runs), large-scale blotchiness from
 * uneven pulp density, and the fact that the rough patches are also the light
 * patches. All three are driven from one height field so they stay correlated.
 */
function buildPaper(size: number): PaperMaps {
  const [canvas, ctx] = makeCanvas(size);
  const image = ctx.createImageData(size, size);
  const height = new Float32Array(size * size);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const v = y / size;

      // Fibre: stretched along x so the grain has a direction.
      const fibre = fbm(u * 420, v * 120, 3, 11);
      // Pulp density: slow, large blotches.
      const pulp = fbm(u * 5, v * 5, 4, 71);
      // Fine tooth.
      const tooth = valueNoise(u * size * 0.9, v * size * 0.9, 137);

      const h = fibre * 0.45 + pulp * 0.35 + tooth * 0.2;
      height[y * size + x] = h;

      // Warm cream, lifted slightly where the sheet is denser.
      const shade = 0.93 + (h - 0.5) * 0.07;
      const index = (y * size + x) * 4;
      image.data[index] = Math.min(255, 252 * shade);
      image.data[index + 1] = Math.min(255, 249 * shade);
      image.data[index + 2] = Math.min(255, 240 * shade);
      image.data[index + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);

  // Roughness follows the same field: raised fibre catches light differently
  // from the compressed valleys between it.
  const [roughCanvas, roughCtx] = makeCanvas(size);
  const roughImage = roughCtx.createImageData(size, size);

  for (let i = 0; i < size * size; i += 1) {
    const value = 205 + (height[i] - 0.5) * 90;
    roughImage.data[i * 4] = value;
    roughImage.data[i * 4 + 1] = value;
    roughImage.data[i * 4 + 2] = value;
    roughImage.data[i * 4 + 3] = 255;
  }

  roughCtx.putImageData(roughImage, 0, 0);

  return {
    map: toTexture(canvas, true),
    normalMap: heightToNormal(height, size, 1.1),
    roughnessMap: toTexture(roughCanvas),
  };
}

// --- cover ---------------------------------------------------------------

export interface CoverMaps {
  map: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
}

/**
 * Bookbinding cloth over board.
 *
 * A woven weave rather than leather grain: it reads as a serious notebook
 * instead of a luxury-goods prop, and the regular warp/weft catches a softbox in
 * a way that immediately says "textile" at any zoom level.
 */
function buildCover(size: number, tint: [number, number, number]): CoverMaps {
  const [canvas, ctx] = makeCanvas(size);
  const image = ctx.createImageData(size, size);
  const height = new Float32Array(size * size);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const v = y / size;

      // Weave: two out-of-phase ripples crossing at right angles.
      const warp = Math.sin(u * size * 0.19) * 0.5 + 0.5;
      const weft = Math.sin(v * size * 0.19 + Math.PI / 2) * 0.5 + 0.5;
      const weave = Math.max(warp, weft) * 0.42;

      // Slubs — the thick/thin irregularity of a real thread.
      const slub = fbm(u * 90, v * 90, 4, 29) * 0.38;
      // Board underneath is never perfectly flat.
      const board = fbm(u * 3, v * 3, 3, 5) * 0.2;

      const h = weave + slub + board;
      height[y * size + x] = h;

      const shade = 0.82 + h * 0.3;
      const index = (y * size + x) * 4;
      image.data[index] = tint[0] * shade;
      image.data[index + 1] = tint[1] * shade;
      image.data[index + 2] = tint[2] * shade;
      image.data[index + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);

  const [roughCanvas, roughCtx] = makeCanvas(size);
  const roughImage = roughCtx.createImageData(size, size);

  for (let i = 0; i < size * size; i += 1) {
    // Thread crowns are polished by handling; the valleys stay matte.
    const value = 190 - (height[i] - 0.5) * 70;
    roughImage.data[i * 4] = value;
    roughImage.data[i * 4 + 1] = value;
    roughImage.data[i * 4 + 2] = value;
    roughImage.data[i * 4 + 3] = 255;
  }

  roughCtx.putImageData(roughImage, 0, 0);

  return {
    map: toTexture(canvas, true),
    normalMap: heightToNormal(height, size, 2.2),
    roughnessMap: toTexture(roughCanvas),
  };
}

// --- desk ----------------------------------------------------------------

/** Oiled oak, seen at a grazing angle and mostly out of focus. */
function buildDesk(size: number): { map: THREE.CanvasTexture; normalMap: THREE.CanvasTexture } {
  const [canvas, ctx] = makeCanvas(size);
  const image = ctx.createImageData(size, size);
  const height = new Float32Array(size * size);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const v = y / size;

      // Growth rings: noise warps a set of near-parallel bands.
      const warpField = fbm(u * 2.2, v * 3.5, 4, 3) * 0.55;
      const rings = Math.sin((v * 13 + warpField) * Math.PI) * 0.5 + 0.5;
      const grain = fbm(u * 160, v * 26, 3, 91);

      const h = rings * 0.6 + grain * 0.4;
      height[y * size + x] = h;

      const shade = 0.46 + h * 0.44;
      const index = (y * size + x) * 4;
      image.data[index] = 104 * shade;
      image.data[index + 1] = 74 * shade;
      image.data[index + 2] = 52 * shade;
      image.data[index + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);

  return { map: toTexture(canvas, true), normalMap: heightToNormal(height, size, 0.7) };
}

// --- studio environment --------------------------------------------------

/**
 * An equirectangular map of the room the notebook is standing in.
 *
 * This exists so the cover's clearcoat has something real to reflect. Two
 * softboxes on a dark surround, painted as soft-edged rectangles: at a glancing
 * angle the cloth picks them up as a broad sheen rather than a point glint,
 * which is the difference between "lacquered board" and "shiny plastic".
 *
 * Painted rather than loaded. An HDRI would be better physics and a worse
 * trade: several megabytes over the network, for reflections that occupy a few
 * hundred pixels of a page that is mostly matte paper.
 */
export function buildStudioEquirect(): THREE.CanvasTexture {
  const width = 512;
  const height = 256;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  // Surround: near-black at the horizon, lifting slightly toward the ceiling.
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "#2a3038");
  sky.addColorStop(0.45, "#12151b");
  sky.addColorStop(1, "#0a0b0e");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  /** A softbox: bright core with a wide falloff, so highlights have soft edges. */
  const box = (cx: number, cy: number, rx: number, ry: number, colour: string) => {
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry));
    glow.addColorStop(0, colour);
    glow.addColorStop(0.55, colour.replace(/[\d.]+\)$/, "0.35)"));
    glow.addColorStop(1, "rgba(0,0,0,0)");

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, ry / rx);
    ctx.translate(-cx, -cy);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  // Key, high and to the left of camera.
  box(width * 0.28, height * 0.3, 96, 60, "rgba(255,248,236,1)");
  // Cooler fill, opposite side and much weaker.
  box(width * 0.78, height * 0.42, 74, 44, "rgba(150,175,214,0.75)");
  // Warm bounce off the desk, along the bottom.
  const bounce = ctx.createLinearGradient(0, height * 0.72, 0, height);
  bounce.addColorStop(0, "rgba(0,0,0,0)");
  bounce.addColorStop(1, "rgba(120,84,52,0.55)");
  ctx.fillStyle = bounce;
  ctx.fillRect(0, height * 0.72, width, height * 0.28);

  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  return texture;
}

// --- cache ---------------------------------------------------------------

/**
 * Built lazily and shared. Textures outlive individual meshes on purpose —
 * remounting the scene during a scroll should not rebuild 2K of noise.
 */
let cache: {
  size: number;
  paper: PaperMaps;
  cover: CoverMaps;
  desk: { map: THREE.CanvasTexture; normalMap: THREE.CanvasTexture };
} | null = null;

export function getMaterials(size: number) {
  if (cache && cache.size === size) return cache;

  disposeMaterials();

  cache = {
    size,
    paper: buildPaper(size),
    cover: buildCover(Math.min(size, 1024), [38, 44, 58]),
    desk: buildDesk(Math.min(size, 1024)),
  };

  return cache;
}

/** Releases every GPU allocation this module made. */
export function disposeMaterials() {
  if (!cache) return;

  const { paper, cover, desk } = cache;

  [
    paper.map, paper.normalMap, paper.roughnessMap,
    cover.map, cover.normalMap, cover.roughnessMap,
    desk.map, desk.normalMap,
  ].forEach((texture) => texture.dispose());

  cache = null;
}
