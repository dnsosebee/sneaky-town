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
import { useCallback, useEffect, useRef, useState } from "react";
import { SceneComponent } from "./scene-component";

registerBuiltInLoaders();

let camera: ArcRotateCamera | null = null;
let meshCenter: Vector3 | null = null;
const sceneObjects: Record<string, { mesh: Mesh; basePosition: Vector3 }> = {};
let axesMeshes: Mesh[] = [];

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
  devMode: boolean;
  cameraLimitsEnabled: boolean;
}

export const MyScene = ({
  targetOffset,
  cameraRadius,
  onInitialRadius,
  objectTransforms,
  devMode,
  cameraLimitsEnabled,
}: MySceneProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const objectTransformsRef = useRef(objectTransforms);

  useEffect(() => {
    objectTransformsRef.current = objectTransforms;
  }, [objectTransforms]);

  useEffect(() => {
    console.log("MyScene mounted");
    return () => {
      console.log("MyScene unmounting");
    };
  }, []);

  useEffect(() => {
    axesMeshes.forEach((mesh) => {
      mesh.isVisible = devMode;
    });
  }, [devMode]);

  useEffect(() => {
    if (camera) {
      if (cameraLimitsEnabled) {
        camera.minZ = 0.1;
        camera.lowerRadiusLimit = 0.4;
        camera.upperRadiusLimit = 1.6;
        camera.upperBetaLimit = Math.PI / 2 - (27 * Math.PI) / 180;
      } else {
        camera.minZ = 0;
        camera.lowerRadiusLimit = 0;
        camera.upperRadiusLimit = Number.MAX_VALUE;
        camera.upperBetaLimit = Math.PI;
      }
    }
  }, [cameraLimitsEnabled]);

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

        if (objectId.startsWith("stone")) {
          mesh.rotation.x = 0;
          mesh.rotation.y = transform.rotation;
          mesh.scaling = new Vector3(
            transform.scale.x * 0.001,
            transform.scale.y * 0.001,
            transform.scale.z * 0.001,
          );
        } else {
          mesh.rotation.x = Math.PI / 2;
          mesh.rotation.y = transform.rotation;
          mesh.scaling = new Vector3(
            transform.scale.x,
            transform.scale.y,
            transform.scale.z,
          );
        }
      }
    });
  }, [objectTransforms]);

  const handleSceneReady = useCallback(
    (scene: Scene) => {
      onSceneReady(
        scene,
        setIsLoading,
        onInitialRadius,
        objectTransformsRef.current,
      );
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
  objectTransforms?: Record<string, ObjectTransform>,
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
  camera.lowerRadiusLimit = 0.45;
  camera.upperRadiusLimit = 1.6;
  camera.upperBetaLimit = Math.PI / 2 - (27 * Math.PI) / 180;
  camera.panningSensibility = 0;

  const canvas = scene.getEngine().getRenderingCanvas();
  camera.attachControl(canvas, true);

  const light = new HemisphericLight("light", new Vector3(0, 1, 0), scene);
  light.intensity = 0.7;

  const axisLength = 0.5;
  const axisThickness = 0.01;

  const xAxis = MeshBuilder.CreateCylinder(
    "xAxis",
    { height: axisLength, diameter: axisThickness },
    scene,
  );
  xAxis.rotation.z = Math.PI / 2;
  xAxis.position.x = axisLength / 2;
  const xMaterial = new StandardMaterial("xAxisMaterial", scene);
  xMaterial.diffuseColor = new Color3(1, 0, 0);
  xMaterial.emissiveColor = new Color3(0.5, 0, 0);
  xAxis.material = xMaterial;

  const yAxis = MeshBuilder.CreateCylinder(
    "yAxis",
    { height: axisLength, diameter: axisThickness },
    scene,
  );
  yAxis.position.y = axisLength / 2;
  const yMaterial = new StandardMaterial("yAxisMaterial", scene);
  yMaterial.diffuseColor = new Color3(0, 1, 0);
  yMaterial.emissiveColor = new Color3(0, 0.5, 0);
  yAxis.material = yMaterial;

  const zAxis = MeshBuilder.CreateCylinder(
    "zAxis",
    { height: axisLength, diameter: axisThickness },
    scene,
  );
  zAxis.rotation.x = Math.PI / 2;
  zAxis.position.z = axisLength / 2;
  const zMaterial = new StandardMaterial("zAxisMaterial", scene);
  zMaterial.diffuseColor = new Color3(0, 0, 1);
  zMaterial.emissiveColor = new Color3(0, 0, 0.5);
  zAxis.material = zMaterial;

  axesMeshes = [xAxis, yAxis, zAxis];
  axesMeshes.forEach((mesh) => {
    mesh.isVisible = false;
  });

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

        const transform = objectTransforms?.["svgBoard"];
        if (transform) {
          svgPlane.position = new Vector3(
            svgBasePosition.x + transform.position.x,
            svgBasePosition.y + transform.position.y,
            svgBasePosition.z + transform.position.z,
          );
          svgPlane.rotation.x = Math.PI / 2;
          svgPlane.rotation.y = transform.rotation;
          svgPlane.scaling = new Vector3(
            transform.scale.x,
            transform.scale.y,
            transform.scale.z,
          );
          svgPlane.isVisible = !(transform.hidden ?? false);
        }

        console.log("SVG plane created at:", {
          x: svgPlane.position.x,
          y: svgPlane.position.y,
          z: svgPlane.position.z,
        });

        const stoneIds = [
          "stone1",
          "stone2",
          "stone3",
          "stone4",
          "stone5",
          "stone6",
          "stone7",
          "stone8",
        ];

        stoneIds.forEach((stoneId) => {
          SceneLoader.ImportMeshAsync(
            "",
            "/models/single_stone.stl",
            undefined,
            scene,
          )
            .then((stoneResult: ISceneLoaderAsyncResult) => {
              console.log(`${stoneId} mesh import successful`, stoneResult);

              if (stoneResult.meshes.length > 0) {
                const stoneMesh = stoneResult.meshes[0] as Mesh;
                const stoneBasePosition = new Vector3(
                  adjustedTarget.x,
                  adjustedTarget.y + 0.1,
                  adjustedTarget.z,
                );
                stoneMesh.position = stoneBasePosition.clone();
                stoneMesh.rotation.x = 0;
                stoneMesh.scaling = new Vector3(0.001, 0.001, 0.001);

                sceneObjects[stoneId] = {
                  mesh: stoneMesh,
                  basePosition: stoneBasePosition,
                };

                const stoneTransform = objectTransforms?.[stoneId];
                if (stoneTransform) {
                  stoneMesh.position = new Vector3(
                    stoneBasePosition.x + stoneTransform.position.x,
                    stoneBasePosition.y + stoneTransform.position.y,
                    stoneBasePosition.z + stoneTransform.position.z,
                  );
                  stoneMesh.rotation.x = 0;
                  stoneMesh.rotation.y = stoneTransform.rotation;
                  stoneMesh.scaling = new Vector3(
                    stoneTransform.scale.x * 0.001,
                    stoneTransform.scale.y * 0.001,
                    stoneTransform.scale.z * 0.001,
                  );
                  stoneMesh.isVisible = !(stoneTransform.hidden ?? false);
                }

                console.log(`${stoneId} mesh created at:`, {
                  x: stoneMesh.position.x,
                  y: stoneMesh.position.y,
                  z: stoneMesh.position.z,
                });
              }
            })
            .catch((error: Error) => {
              console.error(`${stoneId} mesh import failed:`, error);
            });
        });
      }

      setIsLoading(false);
    })
    .catch((error: Error) => {
      console.error("Mesh import failed:", error);
      setIsLoading(false);
    });
};
