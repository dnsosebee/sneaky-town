import {
  ArcRotateCamera,
  Color3,
  DynamicTexture,
  HemisphericLight,
  type ISceneLoaderAsyncResult,
  type Mesh,
  MeshBuilder,
  type Scene,
  SceneLoader,
  StandardMaterial,
  Vector3,
} from "@babylonjs/core";
import { registerBuiltInLoaders } from "@babylonjs/loaders/dynamic";
import { useCallback, useEffect, useState } from "react";
import { SceneComponent } from "./scene-component";

registerBuiltInLoaders();

let camera: ArcRotateCamera | null = null;
let meshCenter: Vector3 | null = null;
const sceneObjects: Record<string, { mesh: Mesh; basePosition: Vector3 }> = {};

export interface ObjectTransform {
  position: { x: number; y: number; z: number };
  rotation: number;
  scale: { x: number; y: number; z: number };
  hidden?: boolean;
}

interface MySceneProps {
  targetOffset: { x: number; y: number; z: number };
  cameraRadius: number;
  onInitialRadius?: (radius: number) => void;
  objectTransforms: Record<string, ObjectTransform>;
}

export const MyScene = ({
  targetOffset,
  cameraRadius,
  onInitialRadius,
  objectTransforms,
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

  useEffect(() => {
    Object.entries(objectTransforms).forEach(([objectId, transform]) => {
      const obj = sceneObjects[objectId];
      if (obj) {
        const { mesh, basePosition } = obj;
        mesh.isVisible = !(transform.hidden ?? false);
        mesh.position = new Vector3(
          basePosition.x + transform.position.x,
          basePosition.y + transform.position.y,
          basePosition.z + transform.position.z,
        );
        mesh.rotation.x = Math.PI / 2;
        mesh.rotation.y = transform.rotation;
        mesh.scaling = new Vector3(
          transform.scale.x,
          transform.scale.y,
          transform.scale.z,
        );
      }
    });
  }, [objectTransforms]);

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
  camera.lowerRadiusLimit = 0.4;
  camera.upperRadiusLimit = 1.6;
  camera.upperBetaLimit = Math.PI / 2 - (27 * Math.PI) / 180;

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

        const targetOffset = new Vector3(1.98, -8.25, 0.33);
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

        const svgPlane = MeshBuilder.CreatePlane(
          "svgPlane",
          { width: 2, height: 2 },
          scene,
        );
        const svgBasePosition = new Vector3(
          adjustedTarget.x,
          adjustedTarget.y + 1,
          adjustedTarget.z,
        );
        svgPlane.position = svgBasePosition.clone();
        svgPlane.rotation.x = Math.PI / 2;

        const material = new StandardMaterial("svgMaterial", scene);

        const textureSize = 4096;
        const dynamicTexture = new DynamicTexture(
          "svgDynamicTexture",
          { width: textureSize, height: textureSize },
          scene,
          false,
        );
        dynamicTexture.anisotropicFilteringLevel = 16;

        const img = new Image();
        img.onload = () => {
          const ctx = dynamicTexture.getContext();
          ctx.clearRect(0, 0, textureSize, textureSize);
          ctx.drawImage(img, 0, 0, textureSize, textureSize);
          dynamicTexture.update();
        };
        img.src = "/models/board-but-only-drawings.svg";

        material.diffuseTexture = dynamicTexture;
        material.opacityTexture = dynamicTexture;
        material.backFaceCulling = false;
        material.specularColor = new Color3(0, 0, 0);
        svgPlane.material = material;

        sceneObjects["svgBoard"] = {
          mesh: svgPlane,
          basePosition: svgBasePosition,
        };

        console.log("SVG plane created at:", {
          x: svgPlane.position.x,
          y: svgPlane.position.y,
          z: svgPlane.position.z,
        });
      }

      setIsLoading(false);
    })
    .catch((error: Error) => {
      console.error("Mesh import failed:", error);
      setIsLoading(false);
    });
};
