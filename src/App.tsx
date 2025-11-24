"use client";

import { useCallback, useEffect, useState } from "react";
import { MyScene, type ObjectTransform } from "./my-scene";

const OBJECT_REGISTRY = {
  svgBoard: "SVG Board",
};

export default function App() {
  const [targetOffset, setTargetOffset] = useState({
    x: 1.98,
    y: -8.25,
    z: 0.33,
  });
  const [cameraRadius, setCameraRadius] = useState(15);
  const [defaultRadius, setDefaultRadius] = useState(15);
  const [devMode, setDevMode] = useState(false);
  const [selectedObject, setSelectedObject] = useState<string>("svgBoard");
  const [objectTransforms, setObjectTransforms] = useState<
    Record<string, ObjectTransform>
  >({
    svgBoard: {
      position: { x: 0.0, y: -0.92, z: 0.0 },
      rotation: 1.567,
      scale: { x: 0.147, y: 0.131, z: 0.14 },
      hidden: false,
    },
  });

  const adjustOffset = useCallback((axis: "x" | "y" | "z", delta: number) => {
    setTargetOffset((prev) => ({ ...prev, [axis]: prev[axis] + delta }));
  }, []);

  const setOffsetValue = useCallback((axis: "x" | "y" | "z", value: string) => {
    const numValue = parseFloat(value);
    if (!Number.isNaN(numValue)) {
      setTargetOffset((prev) => ({ ...prev, [axis]: numValue }));
    }
  }, []);

  const adjustZoom = useCallback((delta: number) => {
    setCameraRadius((prev) => Math.max(0.1, prev + delta));
  }, []);

  const setZoomValue = useCallback((value: string) => {
    const numValue = parseFloat(value);
    if (!Number.isNaN(numValue) && numValue >= 0.1) {
      setCameraRadius(numValue);
    }
  }, []);

  const handleInitialRadius = useCallback((radius: number) => {
    setDefaultRadius(radius);
    setCameraRadius(radius);
  }, []);

  const resetCamera = useCallback(() => {
    setTargetOffset({ x: 1.98, y: -8.25, z: 0.33 });
    setCameraRadius(defaultRadius);
  }, [defaultRadius]);

  const adjustObjectPosition = useCallback(
    (axis: "x" | "y" | "z", delta: number) => {
      setObjectTransforms((prev) => ({
        ...prev,
        [selectedObject]: {
          ...prev[selectedObject],
          position: {
            ...prev[selectedObject].position,
            [axis]: prev[selectedObject].position[axis] + delta,
          },
        },
      }));
    },
    [selectedObject],
  );

  const setObjectPositionValue = useCallback(
    (axis: "x" | "y" | "z", value: string) => {
      const numValue = parseFloat(value);
      if (!Number.isNaN(numValue)) {
        setObjectTransforms((prev) => ({
          ...prev,
          [selectedObject]: {
            ...prev[selectedObject],
            position: {
              ...prev[selectedObject].position,
              [axis]: numValue,
            },
          },
        }));
      }
    },
    [selectedObject],
  );

  const adjustObjectRotation = useCallback(
    (delta: number) => {
      setObjectTransforms((prev) => ({
        ...prev,
        [selectedObject]: {
          ...prev[selectedObject],
          rotation: prev[selectedObject].rotation + delta,
        },
      }));
    },
    [selectedObject],
  );

  const setObjectRotationValue = useCallback(
    (value: string) => {
      const numValue = parseFloat(value);
      if (!Number.isNaN(numValue)) {
        setObjectTransforms((prev) => ({
          ...prev,
          [selectedObject]: {
            ...prev[selectedObject],
            rotation: numValue,
          },
        }));
      }
    },
    [selectedObject],
  );

  const adjustObjectScale = useCallback(
    (axis: "x" | "y" | "z", delta: number) => {
      setObjectTransforms((prev) => ({
        ...prev,
        [selectedObject]: {
          ...prev[selectedObject],
          scale: {
            ...prev[selectedObject].scale,
            [axis]: Math.max(0.01, prev[selectedObject].scale[axis] + delta),
          },
        },
      }));
    },
    [selectedObject],
  );

  const setObjectScaleValue = useCallback(
    (axis: "x" | "y" | "z", value: string) => {
      const numValue = parseFloat(value);
      if (!Number.isNaN(numValue) && numValue > 0) {
        setObjectTransforms((prev) => ({
          ...prev,
          [selectedObject]: {
            ...prev[selectedObject],
            scale: {
              ...prev[selectedObject].scale,
              [axis]: numValue,
            },
          },
        }));
      }
    },
    [selectedObject],
  );

  const toggleObjectHidden = useCallback(
    (e?: React.MouseEvent) => {
      e?.preventDefault();
      e?.stopPropagation();
      setObjectTransforms((prev) => {
        const current = prev[selectedObject];
        if (!current) return prev;
        return {
          ...prev,
          [selectedObject]: {
            ...current,
            hidden: !(current.hidden ?? false),
          },
        };
      });
    },
    [selectedObject],
  );

  const resetObject = useCallback(() => {
    setObjectTransforms((prev) => ({
      ...prev,
      [selectedObject]: {
        position: { x: 0, y: 0, z: 0 },
        rotation: 0,
        scale: { x: 1, y: 1, z: 1 },
        hidden: false,
      },
    }));
  }, [selectedObject]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "d") {
        e.preventDefault();
        setDevMode((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="w-full h-screen flex items-center justify-center bg-slate-900">
      <div
        className="relative"
        style={{
          aspectRatio: "5 / 3",
          width: "min(100vw, calc(100vh * 5 / 3))",
          height: "min(100vh, calc(100vw * 3 / 5))",
        }}
      >
        <MyScene
          targetOffset={targetOffset}
          cameraRadius={cameraRadius}
          onInitialRadius={handleInitialRadius}
          objectTransforms={objectTransforms}
        />
        {devMode && (
          <div className="fixed top-4 left-4 bg-slate-100/95 dark:bg-slate-900/95 backdrop-blur-sm p-4 rounded-lg shadow-lg max-w-md z-20">
            <h2 className="text-lg font-bold mb-4">Dev Panel</h2>
            <div className="flex flex-col gap-4">
              <div>
                <h3 className="font-semibold mb-3 text-sm">
                  Camera Positioning
                </h3>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <div className="text-xs font-medium w-16">X</div>
                    <button
                      type="button"
                      className="bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded text-xs"
                      onClick={() => adjustOffset("x", -0.01)}
                    >
                      ←
                    </button>
                    <input
                      type="number"
                      step="0.01"
                      value={targetOffset.x.toFixed(3)}
                      onChange={(e) => setOffsetValue("x", e.target.value)}
                      className="w-20 text-center bg-white dark:bg-slate-800 px-2 py-1 rounded border border-slate-300 dark:border-slate-600 text-xs"
                    />
                    <button
                      type="button"
                      className="bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded text-xs"
                      onClick={() => adjustOffset("x", 0.01)}
                    >
                      →
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-xs font-medium w-16">Y</div>
                    <button
                      type="button"
                      className="bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded text-xs"
                      onClick={() => adjustOffset("y", -0.01)}
                    >
                      ↓
                    </button>
                    <input
                      type="number"
                      step="0.01"
                      value={targetOffset.y.toFixed(3)}
                      onChange={(e) => setOffsetValue("y", e.target.value)}
                      className="w-20 text-center bg-white dark:bg-slate-800 px-2 py-1 rounded border border-slate-300 dark:border-slate-600 text-xs"
                    />
                    <button
                      type="button"
                      className="bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded text-xs"
                      onClick={() => adjustOffset("y", 0.01)}
                    >
                      ↑
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-xs font-medium w-16">Z</div>
                    <button
                      type="button"
                      className="bg-purple-500 hover:bg-purple-600 text-white px-2 py-1 rounded text-xs"
                      onClick={() => adjustOffset("z", -0.01)}
                    >
                      ←
                    </button>
                    <input
                      type="number"
                      step="0.01"
                      value={targetOffset.z.toFixed(3)}
                      onChange={(e) => setOffsetValue("z", e.target.value)}
                      className="w-20 text-center bg-white dark:bg-slate-800 px-2 py-1 rounded border border-slate-300 dark:border-slate-600 text-xs"
                    />
                    <button
                      type="button"
                      className="bg-purple-500 hover:bg-purple-600 text-white px-2 py-1 rounded text-xs"
                      onClick={() => adjustOffset("z", 0.01)}
                    >
                      →
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-xs font-medium w-16">Zoom</div>
                    <button
                      type="button"
                      className="bg-orange-500 hover:bg-orange-600 text-white px-2 py-1 rounded text-xs"
                      onClick={() => adjustZoom(-0.1)}
                    >
                      In
                    </button>
                    <input
                      type="number"
                      step="0.01"
                      value={cameraRadius.toFixed(3)}
                      onChange={(e) => setZoomValue(e.target.value)}
                      className="w-20 text-center bg-white dark:bg-slate-800 px-2 py-1 rounded border border-slate-300 dark:border-slate-600 text-xs"
                    />
                    <button
                      type="button"
                      className="bg-orange-500 hover:bg-orange-600 text-white px-2 py-1 rounded text-xs"
                      onClick={() => adjustZoom(0.1)}
                    >
                      Out
                    </button>
                    <button
                      type="button"
                      className="bg-slate-500 hover:bg-slate-600 text-white px-2 py-1 rounded text-xs ml-auto"
                      onClick={resetCamera}
                    >
                      Reset
                    </button>
                  </div>
                </div>
              </div>
              <div className="pt-4 border-t border-slate-300 dark:border-slate-700">
                <h3 className="font-semibold mb-3 text-sm">
                  Object Positioning
                </h3>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <div className="text-xs font-medium w-16">Object</div>
                    <select
                      value={selectedObject}
                      onChange={(e) => setSelectedObject(e.target.value)}
                      className="flex-1 bg-white dark:bg-slate-800 px-2 py-1 rounded border border-slate-300 dark:border-slate-600 text-xs"
                    >
                      {Object.entries(OBJECT_REGISTRY).map(([id, name]) => (
                        <option key={id} value={id}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-xs font-medium w-16">Visibility</div>
                    <button
                      type="button"
                      className={`flex-1 ${
                        objectTransforms[selectedObject]?.hidden
                          ? "bg-red-500 hover:bg-red-600"
                          : "bg-green-500 hover:bg-green-600"
                      } text-white px-2 py-1 rounded text-xs`}
                      onClick={toggleObjectHidden}
                    >
                      {objectTransforms[selectedObject]?.hidden
                        ? "Hidden"
                        : "Visible"}
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-xs font-medium w-16">X</div>
                    <button
                      type="button"
                      className="bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded text-xs"
                      onClick={() => adjustObjectPosition("x", -0.01)}
                    >
                      ←
                    </button>
                    <input
                      type="number"
                      step="0.01"
                      value={objectTransforms[
                        selectedObject
                      ].position.x.toFixed(3)}
                      onChange={(e) =>
                        setObjectPositionValue("x", e.target.value)
                      }
                      className="w-20 text-center bg-white dark:bg-slate-800 px-2 py-1 rounded border border-slate-300 dark:border-slate-600 text-xs"
                    />
                    <button
                      type="button"
                      className="bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded text-xs"
                      onClick={() => adjustObjectPosition("x", 0.01)}
                    >
                      →
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-xs font-medium w-16">Y</div>
                    <button
                      type="button"
                      className="bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded text-xs"
                      onClick={() => adjustObjectPosition("y", -0.01)}
                    >
                      ↓
                    </button>
                    <input
                      type="number"
                      step="0.01"
                      value={objectTransforms[
                        selectedObject
                      ].position.y.toFixed(3)}
                      onChange={(e) =>
                        setObjectPositionValue("y", e.target.value)
                      }
                      className="w-20 text-center bg-white dark:bg-slate-800 px-2 py-1 rounded border border-slate-300 dark:border-slate-600 text-xs"
                    />
                    <button
                      type="button"
                      className="bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded text-xs"
                      onClick={() => adjustObjectPosition("y", 0.01)}
                    >
                      ↑
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-xs font-medium w-16">Z</div>
                    <button
                      type="button"
                      className="bg-purple-500 hover:bg-purple-600 text-white px-2 py-1 rounded text-xs"
                      onClick={() => adjustObjectPosition("z", -0.01)}
                    >
                      ←
                    </button>
                    <input
                      type="number"
                      step="0.01"
                      value={objectTransforms[
                        selectedObject
                      ].position.z.toFixed(3)}
                      onChange={(e) =>
                        setObjectPositionValue("z", e.target.value)
                      }
                      className="w-20 text-center bg-white dark:bg-slate-800 px-2 py-1 rounded border border-slate-300 dark:border-slate-600 text-xs"
                    />
                    <button
                      type="button"
                      className="bg-purple-500 hover:bg-purple-600 text-white px-2 py-1 rounded text-xs"
                      onClick={() => adjustObjectPosition("z", 0.01)}
                    >
                      →
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-xs font-medium w-16">Rotation</div>
                    <button
                      type="button"
                      className="bg-yellow-500 hover:bg-yellow-600 text-white px-2 py-1 rounded text-xs"
                      onClick={() => adjustObjectRotation(-0.01)}
                    >
                      ↺
                    </button>
                    <input
                      type="number"
                      step="0.01"
                      value={objectTransforms[selectedObject].rotation.toFixed(
                        3,
                      )}
                      onChange={(e) => setObjectRotationValue(e.target.value)}
                      className="w-20 text-center bg-white dark:bg-slate-800 px-2 py-1 rounded border border-slate-300 dark:border-slate-600 text-xs"
                    />
                    <button
                      type="button"
                      className="bg-yellow-500 hover:bg-yellow-600 text-white px-2 py-1 rounded text-xs"
                      onClick={() => adjustObjectRotation(0.01)}
                    >
                      ↻
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-xs font-medium w-16">Scale X</div>
                    <button
                      type="button"
                      className="bg-pink-500 hover:bg-pink-600 text-white px-2 py-1 rounded text-xs"
                      onClick={() => adjustObjectScale("x", -0.01)}
                    >
                      −
                    </button>
                    <input
                      type="number"
                      step="0.01"
                      value={objectTransforms[selectedObject].scale.x.toFixed(
                        3,
                      )}
                      onChange={(e) => setObjectScaleValue("x", e.target.value)}
                      className="w-20 text-center bg-white dark:bg-slate-800 px-2 py-1 rounded border border-slate-300 dark:border-slate-600 text-xs"
                    />
                    <button
                      type="button"
                      className="bg-pink-500 hover:bg-pink-600 text-white px-2 py-1 rounded text-xs"
                      onClick={() => adjustObjectScale("x", 0.01)}
                    >
                      +
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-xs font-medium w-16">Scale Y</div>
                    <button
                      type="button"
                      className="bg-pink-500 hover:bg-pink-600 text-white px-2 py-1 rounded text-xs"
                      onClick={() => adjustObjectScale("y", -0.01)}
                    >
                      −
                    </button>
                    <input
                      type="number"
                      step="0.01"
                      value={objectTransforms[selectedObject].scale.y.toFixed(
                        3,
                      )}
                      onChange={(e) => setObjectScaleValue("y", e.target.value)}
                      className="w-20 text-center bg-white dark:bg-slate-800 px-2 py-1 rounded border border-slate-300 dark:border-slate-600 text-xs"
                    />
                    <button
                      type="button"
                      className="bg-pink-500 hover:bg-pink-600 text-white px-2 py-1 rounded text-xs"
                      onClick={() => adjustObjectScale("y", 0.01)}
                    >
                      +
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-xs font-medium w-16">Scale Z</div>
                    <button
                      type="button"
                      className="bg-pink-500 hover:bg-pink-600 text-white px-2 py-1 rounded text-xs"
                      onClick={() => adjustObjectScale("z", -0.01)}
                    >
                      −
                    </button>
                    <input
                      type="number"
                      step="0.01"
                      value={objectTransforms[selectedObject].scale.z.toFixed(
                        3,
                      )}
                      onChange={(e) => setObjectScaleValue("z", e.target.value)}
                      className="w-20 text-center bg-white dark:bg-slate-800 px-2 py-1 rounded border border-slate-300 dark:border-slate-600 text-xs"
                    />
                    <button
                      type="button"
                      className="bg-pink-500 hover:bg-pink-600 text-white px-2 py-1 rounded text-xs"
                      onClick={() => adjustObjectScale("z", 0.01)}
                    >
                      +
                    </button>
                    <button
                      type="button"
                      className="bg-slate-500 hover:bg-slate-600 text-white px-2 py-1 rounded text-xs ml-auto"
                      onClick={resetObject}
                    >
                      Reset
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-300 dark:border-slate-700">
              <div className="text-xs text-slate-600 dark:text-slate-400">
                Press Cmd+D to toggle dev panel
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
