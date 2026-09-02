import {
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  type Material,
  type Texture,
} from 'three'
import {
  getPackStageLook,
  subscribePackStageLook,
  type PackStageFaceSettings,
} from './packStageLook'

export type TexturableMaterial = Material & {
  map: Texture | null
  name?: string
  needsUpdate: boolean
}

export function isTexturableMaterial(
  material: Material,
): material is TexturableMaterial {
  return 'map' in material
}

/**
 * Prefer the named "body" material (pack face), otherwise first texturable.
 * Matches reveal PackMesh target resolution.
 */
export function resolveTargetMaterial(
  scene: Object3D,
): TexturableMaterial | null {
  let fallbackMaterial: TexturableMaterial | null = null

  scene.traverse((object) => {
    const mesh = object as Mesh
    if (!mesh.isMesh) return

    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material]

    for (const material of materials) {
      if (!isTexturableMaterial(material)) continue
      if (!fallbackMaterial) fallbackMaterial = material
      if (material.name === 'body') fallbackMaterial = material
    }
  })

  return fallbackMaterial
}

/** card2.glb ships a baked pack-face albedo that must not be shown. */
export function stripPackFaceAlbedo(material: TexturableMaterial) {
  material.map = null
  material.needsUpdate = true
  if (material instanceof MeshStandardMaterial) {
    material.emissiveMap = null
  }
}

/** Deep-clone a GLB scene with independent materials per instance. */
export function cloneSceneWithMaterials(sourceScene: Group | Object3D): Group {
  const cloned = sourceScene.clone(true) as Group

  cloned.traverse((object) => {
    const mesh = object as Mesh
    if (!mesh.isMesh) return

    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map((material) => material.clone())
      return
    }

    mesh.material = mesh.material.clone()
  })

  const face = resolveTargetMaterial(cloned)
  if (face) stripPackFaceAlbedo(face)

  return cloned
}

export function collectStandardMaterials(
  scene: Object3D,
): MeshStandardMaterial[] {
  const materials: MeshStandardMaterial[] = []

  scene.traverse((object) => {
    const mesh = object as Mesh
    if (!mesh.isMesh) return

    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const material of list) {
      if (material instanceof MeshStandardMaterial) {
        materials.push(material)
      }
    }
  })

  return materials
}

function applyFaceLook(
  material: MeshStandardMaterial,
  face: PackStageFaceSettings,
) {
  const c = face.color
  const e = face.emissive
  material.color.setRGB(c, c, c)
  material.emissive.setRGB(e, e, e)
  material.emissiveIntensity = face.emissiveIntensity
  material.metalness = face.metalness
  material.roughness = face.roughness
  material.needsUpdate = true
}

/**
 * Apply reveal-identical pack face materials (white base + video emissive).
 * Returns a cleanup that restores previous material state.
 * Subscribes to packStageLook so debug sliders update live.
 */
export function applyPackFaceMaterial(
  targetMaterial: TexturableMaterial,
  texture: Texture,
): () => void {
  const previousMap = targetMaterial.map
  targetMaterial.map = texture
  targetMaterial.needsUpdate = true

  if (!(targetMaterial instanceof MeshStandardMaterial)) {
    return () => {
      targetMaterial.map = previousMap
      targetMaterial.needsUpdate = true
    }
  }

  const previousColor = targetMaterial.color.clone()
  const previousEmissive = targetMaterial.emissive.clone()
  const previousEmissiveIntensity = targetMaterial.emissiveIntensity
  const previousEmissiveMap = targetMaterial.emissiveMap
  const previousMetalness = targetMaterial.metalness
  const previousRoughness = targetMaterial.roughness
  const previousSide = targetMaterial.side

  targetMaterial.emissiveMap = texture
  targetMaterial.side = DoubleSide
  applyFaceLook(targetMaterial, getPackStageLook().face)

  const unsub = subscribePackStageLook(() => {
    applyFaceLook(targetMaterial, getPackStageLook().face)
  })

  return () => {
    unsub()
    targetMaterial.map = previousMap
    targetMaterial.color.copy(previousColor)
    targetMaterial.emissive.copy(previousEmissive)
    targetMaterial.emissiveIntensity = previousEmissiveIntensity
    targetMaterial.emissiveMap = previousEmissiveMap
    targetMaterial.metalness = previousMetalness
    targetMaterial.roughness = previousRoughness
    targetMaterial.side = previousSide
    targetMaterial.needsUpdate = true
  }
}
