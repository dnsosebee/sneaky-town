import { Engine, Scene } from "@babylonjs/core";
import { useEffect, useRef } from "react";

export const SceneComponent = ({
  antialias,
  engineOptions,
  adaptToDeviceRatio,
  sceneOptions,
  onRender,
  onSceneReady,
  id,
  ...rest
}: {
  antialias: boolean;
  onRender: any;
  onSceneReady: any;
  engineOptions?: any;
  adaptToDeviceRatio?: boolean;
  sceneOptions?: any;
  rest?: any;
  id?: string;
}) => {
  const reactCanvas = useRef(null);

  // set up basic engine and scene
  useEffect(() => {
    const { current: canvas } = reactCanvas;

    if (!canvas) return;

    const engine = new Engine(
      canvas,
      antialias,
      engineOptions,
      adaptToDeviceRatio,
    );
    const scene = new Scene(engine, sceneOptions);
    if (scene.isReady()) {
      onSceneReady(scene);
    } else {
      scene.onReadyObservable.addOnce((scene) => onSceneReady(scene));
    }

    engine.runRenderLoop(() => {
      if (typeof onRender === "function") onRender(scene);
      scene.render();
    });

    const resize = () => {
      scene.getEngine().resize();
    };

    if (window) {
      window.addEventListener("resize", resize);
    }

    return () => {
      scene.getEngine().dispose();

      if (window) {
        window.removeEventListener("resize", resize);
      }
    };
  }, [
    antialias,
    engineOptions,
    adaptToDeviceRatio,
    sceneOptions,
    onRender,
    onSceneReady,
  ]);

  return (
    <canvas ref={reactCanvas} {...rest} id={id} className="w-full h-full" />
  );
};
