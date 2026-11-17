/** Tunable 3D shell look defaults for the joker ball. */
export type JokerBallLook = {
  ambient: number;
  hemi: number;
  key: number;
  fill: number;
  rim: number;
  keyX: number;
  keyY: number;
  keyZ: number;
  fillX: number;
  fillY: number;
  fillZ: number;
  rimX: number;
  rimY: number;
  rimZ: number;
  /** Soft ground blob under the ball (0 = off). */
  shadowOpacity: number;
  shadowScale: number;
  camX: number;
  camY: number;
  camZ: number;
  roughness: number;
  metalness: number;
  clearcoat: number;
  clearcoatRoughness: number;
  bumpScale: number;
  grainRepeat: number;
  grainOpacity: number;
};

export const DEFAULT_JOKER_LOOK: JokerBallLook = {
  ambient: 0.5,
  hemi: 0.8,
  key: 0.35,
  fill: 2.5,
  rim: 1.1,
  keyX: 0.8,
  keyY: 7.7,
  keyZ: -0.8,
  fillX: -2.3,
  fillY: 2.9,
  fillZ: 1.2,
  rimX: -4.2,
  rimY: -0.2,
  rimZ: 1.6,
  shadowOpacity: 3,
  shadowScale: 4.5,
  camX: -0.15,
  camY: 0.35,
  camZ: 4,
  roughness: 0.9,
  metalness: 0.1,
  clearcoat: 1,
  clearcoatRoughness: 0.34,
  bumpScale: 0,
  grainRepeat: 3,
  grainOpacity: 0.42,
};
