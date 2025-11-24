"use client";

import { useCallback, useEffect, useState } from "react";
import { MyScene } from "./my-scene";

export default function App() {
  const [targetOffset, setTargetOffset] = useState({ x: 2, y: -8.2, z: 0.3 });
  const [cameraRadius, setCameraRadius] = useState(15);
  const [defaultRadius, setDefaultRadius] = useState(15);
  const [devMode, setDevMode] = useState(false);

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
    setTargetOffset({ x: 2, y: -8, z: 0.3 });
    setCameraRadius(defaultRadius);
  }, [defaultRadius]);

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
                      onClick={() => adjustOffset("x", -0.1)}
                    >
                      ←
                    </button>
                    <input
                      type="number"
                      step="0.1"
                      value={targetOffset.x.toFixed(2)}
                      onChange={(e) => setOffsetValue("x", e.target.value)}
                      className="w-16 text-center bg-white dark:bg-slate-800 px-2 py-1 rounded border border-slate-300 dark:border-slate-600 text-xs"
                    />
                    <button
                      type="button"
                      className="bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded text-xs"
                      onClick={() => adjustOffset("x", 0.1)}
                    >
                      →
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-xs font-medium w-16">Y</div>
                    <button
                      type="button"
                      className="bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded text-xs"
                      onClick={() => adjustOffset("y", -0.1)}
                    >
                      ↓
                    </button>
                    <input
                      type="number"
                      step="0.1"
                      value={targetOffset.y.toFixed(2)}
                      onChange={(e) => setOffsetValue("y", e.target.value)}
                      className="w-16 text-center bg-white dark:bg-slate-800 px-2 py-1 rounded border border-slate-300 dark:border-slate-600 text-xs"
                    />
                    <button
                      type="button"
                      className="bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded text-xs"
                      onClick={() => adjustOffset("y", 0.1)}
                    >
                      ↑
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-xs font-medium w-16">Z</div>
                    <button
                      type="button"
                      className="bg-purple-500 hover:bg-purple-600 text-white px-2 py-1 rounded text-xs"
                      onClick={() => adjustOffset("z", -0.1)}
                    >
                      ←
                    </button>
                    <input
                      type="number"
                      step="0.1"
                      value={targetOffset.z.toFixed(2)}
                      onChange={(e) => setOffsetValue("z", e.target.value)}
                      className="w-16 text-center bg-white dark:bg-slate-800 px-2 py-1 rounded border border-slate-300 dark:border-slate-600 text-xs"
                    />
                    <button
                      type="button"
                      className="bg-purple-500 hover:bg-purple-600 text-white px-2 py-1 rounded text-xs"
                      onClick={() => adjustOffset("z", 0.1)}
                    >
                      →
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-xs font-medium w-16">Zoom</div>
                    <button
                      type="button"
                      className="bg-orange-500 hover:bg-orange-600 text-white px-2 py-1 rounded text-xs"
                      onClick={() => adjustZoom(-1)}
                    >
                      In
                    </button>
                    <input
                      type="number"
                      step="0.5"
                      value={cameraRadius.toFixed(2)}
                      onChange={(e) => setZoomValue(e.target.value)}
                      className="w-16 text-center bg-white dark:bg-slate-800 px-2 py-1 rounded border border-slate-300 dark:border-slate-600 text-xs"
                    />
                    <button
                      type="button"
                      className="bg-orange-500 hover:bg-orange-600 text-white px-2 py-1 rounded text-xs"
                      onClick={() => adjustZoom(1)}
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
