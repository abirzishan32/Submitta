import * as THREE from "three";

/**
 * A sheet of paper that bends as it turns.
 *
 * A page rotated rigidly about its spine reads as a card on a hinge, which is
 * the single clearest tell of a cheap 3D book. Real paper resists the turn: it
 * bows away from the fold, the bow peaks halfway over, and the far edge lags and
 * droops under its own weight. That is all this shader does — but it is the
 * difference between "notebook" and "rotating rectangle".
 *
 * Built by patching Three's standard material rather than writing a shader from
 * scratch, so the paper keeps real PBR lighting: the normal map, the roughness
 * map, the softbox reflections and the shadows all still apply, and the highlight
 * genuinely travels across the curve as the sheet moves.
 */

export interface PageUniforms {
  /** 0 = lying flat on the right, 1 = turned fully to the left. */
  uTurn: { value: number };
  /** Peak bow, in world units. Scaled by turn speed at the call site. */
  uBend: { value: number };
  /** Sag of the free edge under gravity. */
  uDroop: { value: number };
  /** Page width, so the shader can normalise along the sheet. */
  uWidth: { value: number };
}

const PARS = /* glsl */ `
  uniform float uTurn;
  uniform float uBend;
  uniform float uDroop;
  uniform float uWidth;

  // Position of a point on the sheet once the turn, the bow and the droop have
  // been applied. Shared by the vertex and the normal path so lighting agrees
  // with geometry.
  vec3 sheetTransform(vec3 pos) {
    float t = clamp(pos.x / uWidth, 0.0, 1.0);
    float angle = uTurn * 3.14159265;

    // Rotate about the spine, which lies along Z at x = 0.
    float c = cos(angle);
    float s = sin(angle);
    vec3 turned = vec3(pos.x * c, pos.x * s, pos.z);

    // The sheet's own up-vector after that rotation.
    vec2 up = vec2(-s, c);

    // Bow: nothing at the fold, nothing at the free edge, most in between.
    float bow = sin(t * 3.14159265) * uBend;

    // Droop: grows towards the free edge, and only while the page is off the
    // surface — a page lying flat is supported by the stack beneath it.
    float lift = sin(angle);
    float droop = t * t * uDroop * lift;

    turned.xy += up * bow;
    turned.y -= droop;

    return turned;
  }
`;

/**
 * Applies the bend to a standard material.
 *
 * @param material  the material to patch; mutated in place.
 * @param width     page width in world units.
 */
export function makePageBendable(
  material: THREE.MeshStandardMaterial,
  width: number,
): PageUniforms {
  const uniforms: PageUniforms = {
    uTurn: { value: 0 },
    uBend: { value: 0 },
    uDroop: { value: 0 },
    uWidth: { value: width },
  };

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\n${PARS}`)
      .replace(
        "#include <begin_vertex>",
        /* glsl */ `
        vec3 transformed = sheetTransform(position);
        `,
      )
      .replace(
        "#include <beginnormal_vertex>",
        /* glsl */ `
        // Differentiate the transform numerically. Cheaper to reason about than
        // an analytic derivative, and exact enough at this scale — the epsilon
        // is a fraction of a millimetre of paper.
        float eps = uWidth * 0.01;
        vec3 pdx = sheetTransform(position + vec3(eps, 0.0, 0.0)) - sheetTransform(position);
        vec3 pdz = sheetTransform(position + vec3(0.0, 0.0, eps)) - sheetTransform(position);
        vec3 objectNormal = normalize(cross(pdz, pdx));

        #ifdef USE_TANGENT
          vec3 objectTangent = normalize(pdx);
        #endif
        `,
      );
  };

  // Three caches compiled programs by material signature; changing the hook
  // after a build would otherwise be ignored.
  material.customProgramCacheKey = () => "notebook-page-bend";
  material.needsUpdate = true;

  return uniforms;
}
