import {
  ArcRotateCamera,
  HemisphericLight,
  type ISceneLoaderAsyncResult,
  type Scene,
  SceneLoader,
  Vector3,
} from "@babylonjs/core";
import { registerBuiltInLoaders } from "@babylonjs/loaders/dynamic";
import { useCallback, useEffect, useState } from "react";
import { SceneComponent } from "./scene-component";

registerBuiltInLoaders();

let camera: ArcRotateCamera | null = null;
let meshCenter: Vector3 | null = null;

interface MySceneProps {
  targetOffset: { x: number; y: number; z: number };
  cameraRadius: number;
  onInitialRadius?: (radius: number) => void;
}

export const MyScene = ({
  targetOffset,
  cameraRadius,
  onInitialRadius,
}: MySceneProps) => {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    console.log("MyScene mounted");
    return () => {
      console.log("MyScene unmounting");
    };
  }, []);

  useEffect(() => {
    if (camera && meshCenter) {
      const offset = new Vector3(
        targetOffset.x,
        targetOffset.y,
        targetOffset.z,
      );
      const newTarget = meshCenter.add(offset);
      camera.target = newTarget;
    }
  }, [targetOffset]);

  useEffect(() => {
    if (camera) {
      camera.radius = cameraRadius;
    }
  }, [cameraRadius]);

  const handleSceneReady = useCallback(
    (scene: Scene) => {
      onSceneReady(scene, setIsLoading, onInitialRadius);
    },
    [onInitialRadius],
  );

  const handleRender = useCallback(() => {}, []);

  return (
    <div className="relative w-full h-full">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 z-10">
          <div className="text-white text-xl">Loading model...</div>
        </div>
      )}
      <SceneComponent
        antialias
        onSceneReady={handleSceneReady}
        onRender={handleRender}
        id="my-scene"
      />
    </div>
  );
};

const onSceneReady = (
  scene: Scene,
  setIsLoading: (loading: boolean) => void,
  onInitialRadius?: (radius: number) => void,
) => {
  camera = new ArcRotateCamera(
    "camera1",
    Math.PI / 2,
    Math.PI / 3,
    10,
    Vector3.Zero(),
    scene,
  );

  camera.minZ = 0.1;
  camera.lowerRadiusLimit = 0.3;
  camera.upperRadiusLimit = 1.5;

  const canvas = scene.getEngine().getRenderingCanvas();
  camera.attachControl(canvas, true);

  const light = new HemisphericLight("light", new Vector3(0, 1, 0), scene);
  light.intensity = 0.7;

  console.log("Starting mesh import...");
  SceneLoader.ImportMeshAsync(
    "",
    "/models/backyard-scene-and-board.ply",
    undefined,
    scene,
  )
    .then((result: ISceneLoaderAsyncResult) => {
      console.log("Mesh import successful", result);

      if (result.meshes.length > 0 && camera) {
        const mesh = result.meshes[0];
        const boundingInfo = mesh.getBoundingInfo();
        const center = boundingInfo.boundingBox.centerWorld;
        const min = boundingInfo.boundingBox.minimumWorld;
        const max = boundingInfo.boundingBox.maximumWorld;

        meshCenter = center.clone();

        console.log("Bounding box info:", {
          center: { x: center.x, y: center.y, z: center.z },
          min: { x: min.x, y: min.y, z: min.z },
          max: { x: max.x, y: max.y, z: max.z },
          size: {
            x: max.x - min.x,
            y: max.y - min.y,
            z: max.z - min.z,
          },
        });

        const targetOffset = new Vector3(2, -8, 0.3);
        const adjustedTarget = meshCenter.add(targetOffset);

        camera.target = adjustedTarget;
        const calculatedRadius =
          boundingInfo.boundingBox.extendSize.length() * 2;
        camera.radius = calculatedRadius;

        if (onInitialRadius) {
          onInitialRadius(calculatedRadius);
        }

        console.log("Camera target set to:", {
          x: adjustedTarget.x,
          y: adjustedTarget.y,
          z: adjustedTarget.z,
          radius: calculatedRadius,
        });
      }

      setIsLoading(false);
    })
    .catch((error: Error) => {
      console.error("Mesh import failed:", error);
      setIsLoading(false);
    });
};
