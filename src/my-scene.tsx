import {
  FreeCamera,
  HemisphericLight,
  MeshBuilder,
  SceneLoader,
  type Mesh,
  type Scene,
} from "@babylonjs/core";

import { Vector3 } from "@babylonjs/core";
import { useEffect, useRef } from "react";
import { SceneComponent } from "./scene-component";

export const MyScene = () => {
  // Use a ref to track scene-related resources
  const sceneRef = useRef<{
    box?: Mesh;
    scene?: Scene;
    importPromise?: Promise<any>;
  }>({});

  useEffect(() => {
    console.log("MyScene mounted");
    return () => {
      console.log("MyScene unmounting");
      // Ensure any pending imports are noted as cancelled
      sceneRef.current = {};
    };
  }, []);

  const onSceneReady = (scene: Scene) => {
    // Store scene reference
    sceneRef.current.scene = scene;

    // This creates and positions a free camera (non-mesh)
    const camera = new FreeCamera("camera1", new Vector3(0, 5, -10), scene);

    // This targets the camera to scene origin
    camera.setTarget(Vector3.Zero());

    const canvas = scene.getEngine().getRenderingCanvas();

    // This attaches the camera to the canvas
    camera.attachControl(canvas, true);

    // This creates a light, aiming 0,1,0 - to the sky (non-mesh)
    const light = new HemisphericLight("light", new Vector3(0, 1, 0), scene);

    // Default intensity is 1. Let's dim the light a small amount
    light.intensity = 0.7;

    // Our built-in 'box' shape.
    sceneRef.current.box = MeshBuilder.CreateBox("box", { size: 2 }, scene);

    // Move the box upward 1/2 its height
    sceneRef.current.box.position.y = 1;

    // Our built-in 'ground' shape.
    MeshBuilder.CreateGround("ground", { width: 6, height: 6 }, scene);

    // Import the mesh
    console.log("Starting mesh import...");
    sceneRef.current.importPromise = SceneLoader.ImportMeshAsync(
      null,
      "https://raw.githubusercontent.com/CedricGuillemet/dump/master/",
      "Halo_Believe.splat",
      scene,
    )
      .then((result) => {
        // Check if we still have a valid scene before proceeding
        if (sceneRef.current.scene === scene) {
          console.log("Mesh import successful", result);
          result.meshes[0].position.y = 1.7;
        }
      })
      .catch((error) => {
        console.error("Mesh import failed:", error);
        if (sceneRef.current.scene === scene) {
          console.log("Scene status:", {
            isDisposed: scene.isDisposed,
            isReady: scene.isReady(),
          });
        }
      });
  };

  const onRender = (scene: Scene) => {
    const box = sceneRef.current.box;
    if (box && !scene.isDisposed) {
      const deltaTimeInMillis = scene.getEngine().getDeltaTime();
      const rpm = 10;
      box.rotation.y += (rpm / 60) * Math.PI * 2 * (deltaTimeInMillis / 1000);
    }
  };

  return (
    <div>
      <SceneComponent
        antialias
        onSceneReady={onSceneReady}
        onRender={onRender}
        id="my-scene"
      />
    </div>
  );
};
