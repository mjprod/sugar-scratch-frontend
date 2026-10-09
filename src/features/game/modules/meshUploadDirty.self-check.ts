/**
 * Offline invariants for mesh punch upload dirtying (Phase 6).
 * Run: npx tsx src/features/game/modules/meshUploadDirty.self-check.ts
 */
import {
  copyMeshPositions,
  MESH_UPLOAD_EPS_PX,
  meshPositionsNeedUpload,
} from "./meshUploadDirty";

function assert(cond: boolean, message: string): void {
  if (!cond) throw new Error(message);
}

assert(MESH_UPLOAD_EPS_PX > 0 && MESH_UPLOAD_EPS_PX < 2, "eps is sub-pixel–ish");

{
  const a = new Float32Array([10, 20, 30, 40]);
  assert(meshPositionsNeedUpload(a, null, 2), "cold upload required");
  assert(!meshPositionsNeedUpload(a, a, 2), "identical positions skip");

  const drip = new Float32Array([10.2, 20.1, 30.05, 40.2]);
  assert(
    !meshPositionsNeedUpload(drip, a, 2),
    "sub-eps drip skips bufferSubData",
  );

  const moved = new Float32Array([10, 20, 31, 40]);
  assert(meshPositionsNeedUpload(moved, a, 2), "1px move uploads");
}

{
  const src = new Float32Array([1, 2, 3, 4]);
  const copy = copyMeshPositions(null, src, 2);
  assert(copy[0] === 1 && copy[3] === 4, "copy fills dest");
  const reused = copyMeshPositions(copy, new Float32Array([5, 6, 7, 8]), 2);
  assert(reused === copy, "reuses buffer when large enough");
  assert(reused[0] === 5 && reused[3] === 8, "overwrite works");
}

// Rough budget: 30fps FG with 10fps mesh → ~2/3 uploads skippable if verts
// only change meaningfully on mesh keyframes (optimistic); epsilon still cuts
// micro-interpolation noise between keyframes.
{
  const fgUploads = 30;
  const meshKeyframes = 10;
  assert(meshKeyframes < fgUploads, "mesh clock coarser than FG");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      MESH_UPLOAD_EPS_PX,
      policy: "skip bufferSubData when max vert delta ≤ eps",
    },
    null,
    2,
  ),
);
