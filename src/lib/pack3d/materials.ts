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

let packInstanceSeq = 0

function nextPackInstanceId(): number {
  packInstanceSeq += 1
  return packInstanceSeq
}

function cloneMaterialSlot(material: Material, ownerId: number): Material {
  const unique = material.clone()
  unique.userData.packInstanceId = ownerId
  return unique
}

/** Scene graph clone that shares geometry. Only the pack-face material is unique. */
export function cloneSceneWithMaterials(sourceScene: Group | Object3D): Group {
  const cloned = sourceScene.clone(true) as Group
  const ownerId = nextPackInstanceId()
  cloned.userData.packInstanceId = ownerId
  const face = resolveTargetMaterial(cloned)
  if (!face) return cloned

  const uniqueFace = cloneMaterialSlot(face, ownerId)
  cloned.traverse((object) => {
    const mesh = object as Mesh
    if (!mesh.isMesh) return

    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map((material) =>
        material === face ? uniqueFace : material,
      )
      return
    }

    if (mesh.material === face) {
      mesh.material = uniqueFace
    }
  })

  stripPackFaceAlbedo(uniqueFace as TexturableMaterial)
  return cloned
}

function packOwnerId(mesh: Mesh): number | undefined {
  let node: Object3D | null = mesh
  while (node) {
    const id = node.userData.packInstanceId
    if (typeof id === 'number') return id
    node = node.parent
  }
  return undefined
}

/** Clone a mesh material the first time this instance writes opacity. */
export function uniquifyMeshMaterial(mesh: Mesh, material: Material): Material {
  const ownerId = packOwnerId(mesh)
  if (ownerId != null && material.userData.packInstanceId === ownerId) {
    return material
  }
  const unique = cloneMaterialSlot(material, ownerId ?? nextPackInstanceId())
  if (Array.isArray(mesh.material)) {
    mesh.material = mesh.material.map((slot) => (slot === material ? unique : slot))
  } else {
    mesh.material = unique
  }
  return unique
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
