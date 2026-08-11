import { useThree } from "@react-three/fiber";
import { useEffect, useSyncExternalStore } from "react";
import { getPackStageLook, subscribePackStageLook } from "./packStageLook";

function usePackStageLook() {
  return useSyncExternalStore(subscribePackStageLook, getPackStageLook, getPackStageLook);
}

export function PackStageExposure() {
  const look = usePackStageLook();
  const gl = useThree((state) => state.gl);

  useEffect(() => {
    gl.toneMappingExposure = look.exposure;
  }, [gl, look.exposure]);

  return null;
}

/** Same light rig as the incoming coverflow / reveal stage. */
export function PackLights() {
  const { lights } = usePackStageLook();

  return (
    <>
      <ambientLight intensity={lights.ambientIntensity} />
      <hemisphereLight
        intensity={lights.hemiIntensity}
        groundColor={lights.hemiGround}
        color={lights.hemiSky}
      />
      <directionalLight
        position={[lights.keyX, lights.keyY, lights.keyZ]}
        intensity={lights.keyIntensity}
        color={lights.keyColor}
      />
      <directionalLight
        position={[lights.fillX, lights.fillY, lights.fillZ]}
        intensity={lights.fillIntensity}
        color={lights.fillColor}
      />
      {lights.fill2Enabled ? (
        <directionalLight
          position={[lights.fill2X, lights.fill2Y, lights.fill2Z]}
          intensity={lights.fill2Intensity}
          color={lights.fill2Color}
        />
      ) : null}
      <pointLight
        position={[lights.pointX, lights.pointY, lights.pointZ]}
        intensity={lights.pointIntensity}
        color={lights.pointColor}
      />
      {lights.key2Enabled ? (
        <directionalLight
          position={[lights.key2X, lights.key2Y, lights.key2Z]}
          intensity={lights.key2Intensity}
          color={lights.key2Color}
        />
      ) : null}
      {lights.key3Enabled ? (
        <directionalLight
          position={[lights.key3X, lights.key3Y, lights.key3Z]}
          intensity={lights.key3Intensity}
          color={lights.key3Color}
        />
      ) : null}
    </>
  );
}
