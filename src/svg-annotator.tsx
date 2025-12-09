import { useCallback, useMemo, useState } from "react";

// === TYPES ===

type SwapElement = {
  zone: "swap";
  row: number;
  col: number;
  shape: "plus";
};

type CrossingElement = {
  zone: "crossing";
  area: "lattice" | "interstitium" | "reveal";
  shape: "eye" | "plus" | "dash-segment" | "solid-segment" | "intersection";
  leftIndex?: number;
  rightIndex?: number;
  reachesCrossIndex?: number;
};

type BoardElement = (SwapElement | CrossingElement) & {
  id: string;
  path: string;
  tagName: string;
  attributes: Record<string, string>;
};

type BoardElementPatch = {
  zone?: "swap" | "crossing";
  row?: number;
  col?: number;
  shape?: "plus" | "eye" | "dash-segment" | "solid-segment" | "intersection";
  area?: "lattice" | "interstitium" | "reveal";
  leftIndex?: number;
  rightIndex?: number;
  reachesCrossIndex?: number;
  skip?: boolean;
  terminal?: boolean;
};

type Rule = {
  nodeId: string;
  patch: BoardElementPatch;
};

type DFSNode = {
  id: string;
  element: Element;
  depth: number;
  isLeaf: boolean;
  children: DFSNode[];
};

// === SVG PARSING ===

function buildNodeId(path: { tagName: string; index: number }[]): string {
  return path.map((p) => `${p.tagName}[${p.index}]`).join("/");
}

function parseSVG(svgText: string): { root: DFSNode; allNodes: DFSNode[] } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, "image/svg+xml");
  const svgEl = doc.querySelector("svg");
  if (!svgEl) throw new Error("No SVG element found");

  const allNodes: DFSNode[] = [];

  function traverse(
    el: Element,
    path: { tagName: string; index: number }[],
    depth: number,
  ): DFSNode {
    const id = buildNodeId(path);
    const childElements = Array.from(el.children);

    const childNodes: DFSNode[] = [];
    const tagCounts: Record<string, number> = {};

    for (const child of childElements) {
      const tag = child.tagName.toLowerCase();
      if (
        [
          "g",
          "path",
          "circle",
          "rect",
          "ellipse",
          "line",
          "polyline",
          "polygon",
          "title",
        ].includes(tag)
      ) {
        if (tag === "title") continue;
        tagCounts[tag] = tagCounts[tag] || 0;
        const childPath = [...path, { tagName: tag, index: tagCounts[tag] }];
        tagCounts[tag]++;
        childNodes.push(traverse(child, childPath, depth + 1));
      }
    }

    const node: DFSNode = {
      id,
      element: el,
      depth,
      isLeaf: childNodes.length === 0,
      children: childNodes,
    };

    allNodes.push(node);
    return node;
  }

  const root = traverse(svgEl, [{ tagName: "svg", index: 0 }], 0);
  return { root, allNodes };
}

function getDFSOrder(node: DFSNode): DFSNode[] {
  const result: DFSNode[] = [node];
  for (const child of node.children) {
    result.push(...getDFSOrder(child));
  }
  return result;
}

function getElementAttributes(el: Element): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const attr of Array.from(el.attributes)) {
    attrs[attr.name] = attr.value;
  }
  return attrs;
}

function getPathData(el: Element): string {
  const tag = el.tagName.toLowerCase();
  if (tag === "path") return el.getAttribute("d") || "";
  // For other shapes, return the outer HTML as a reference
  return el.outerHTML;
}

// === VALIDATION ===

type ValidationError = {
  nodeId: string;
  errors: string[];
};

function validateElement(
  merged: BoardElementPatch,
  isLeafOrTerminal: boolean,
): string[] {
  if (!isLeafOrTerminal) return [];

  const errors: string[] = [];

  if (!merged.zone) {
    errors.push("Missing zone");
    return errors;
  }

  if (merged.zone === "swap") {
    if (merged.row === undefined) errors.push("Missing row");
    if (merged.col === undefined) errors.push("Missing col");
    if (!merged.shape) errors.push("Missing shape");
  } else if (merged.zone === "crossing") {
    if (!merged.area) errors.push("Missing area");
    if (!merged.shape) errors.push("Missing shape");

    const indexCount = [
      merged.leftIndex !== undefined,
      merged.rightIndex !== undefined,
      merged.reachesCrossIndex !== undefined,
    ].filter(Boolean).length;

    if (indexCount !== 2) {
      errors.push(
        `Must have exactly 2 of {leftIndex, rightIndex, reachesCrossIndex}, found ${indexCount}`,
      );
    }
  }

  return errors;
}

// === COMPONENTS ===

function SVGPreview({
  svgText,
  highlightId,
  allNodes,
}: {
  svgText: string;
  highlightId: string;
  allNodes: DFSNode[];
}) {
  const highlightedSvg = useMemo(() => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, "image/svg+xml");
    const svgEl = doc.querySelector("svg");
    if (!svgEl) return svgText;

    // Find the node to highlight
    const targetNode = allNodes.find((n) => n.id === highlightId);
    if (!targetNode) return svgEl.outerHTML;

    // Dim everything first
    const allElements = svgEl.querySelectorAll(
      "path, circle, rect, ellipse, line, polyline, polygon",
    );
    allElements.forEach((el) => {
      el.setAttribute("opacity", "0.15");
    });

    // Highlight the target and its descendants
    function highlightElement(el: Element) {
      el.setAttribute("opacity", "1");
      if (
        el.tagName.toLowerCase() === "path" ||
        el.tagName.toLowerCase() === "circle"
      ) {
        el.setAttribute("stroke", "#e11d48");
        el.setAttribute("stroke-width", "3");
      }
      Array.from(el.children).forEach(highlightElement);
    }

    // Find corresponding element in parsed doc
    function findElement(root: Element, nodeId: string): Element | null {
      const parts = nodeId.split("/").slice(1); // skip 'svg[0]'
      let current = root;

      for (const part of parts) {
        const match = part.match(/(\w+)\[(\d+)\]/);
        if (!match) return null;
        const [, tagName, indexStr] = match;
        const index = parseInt(indexStr, 10);

        const children = Array.from(current.children).filter(
          (c) => c.tagName.toLowerCase() === tagName.toLowerCase(),
        );
        if (index >= children.length) return null;
        current = children[index];
      }
      return current;
    }

    const targetEl =
      highlightId === "svg[0]" ? svgEl : findElement(svgEl, highlightId);
    if (targetEl) {
      highlightElement(targetEl);
    }

    return svgEl.outerHTML;
  }, [svgText, highlightId, allNodes]);

  return (
    <div
      style={{
        border: "1px solid #ccc",
        borderRadius: 8,
        padding: 16,
        background: "#fafafa",
        overflow: "auto",
        maxHeight: "70vh",
      }}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: "Only those who will risk going too far can possibly find out how far one can go." - T.S. Eliot
      dangerouslySetInnerHTML={{ __html: highlightedSvg }}
    />
  );
}

type PatchEditorProps = {
  inheritedPatch: BoardElementPatch;
  currentPatch: BoardElementPatch;
  onChange: (patch: BoardElementPatch) => void;
  isLeaf: boolean;
  hasChildren: boolean;
};

function PatchEditor({
  inheritedPatch,
  currentPatch,
  onChange,
  hasChildren,
}: PatchEditorProps) {
  const merged = { ...inheritedPatch, ...currentPatch };

  const updateField = <K extends keyof BoardElementPatch>(
    field: K,
    value: BoardElementPatch[K] | undefined,
  ) => {
    const newPatch = { ...currentPatch };
    if (value === undefined) {
      delete newPatch[field];
    } else {
      (newPatch as Record<string, unknown>)[field] = value;
    }
    onChange(newPatch);
  };

  const isFieldInherited = (field: keyof BoardElementPatch) =>
    field in inheritedPatch;

  const zone = merged.zone;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Skip checkbox */}
      <fieldset
        style={{ border: "1px solid #ddd", borderRadius: 4, padding: 12 }}
      >
        <legend style={{ fontWeight: 600, fontSize: 14 }}>Skip</legend>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={merged.skip ?? false}
            onChange={(e) => updateField("skip", e.target.checked || undefined)}
          />
          Mark as skippable (duplicate/unwanted)
        </label>
        {inheritedPatch.skip && !("skip" in currentPatch) && (
          <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
            Inherited: skipped
          </div>
        )}
      </fieldset>

      {/* Terminal checkbox / info */}
      {hasChildren ? (
        <fieldset
          style={{ border: "1px solid #ddd", borderRadius: 4, padding: 12 }}
        >
          <legend style={{ fontWeight: 600, fontSize: 14 }}>Terminal</legend>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={merged.terminal ?? false}
              onChange={(e) =>
                updateField("terminal", e.target.checked || undefined)
              }
            />
            Treat group as single element (don't traverse children)
          </label>
          {inheritedPatch.terminal && !("terminal" in currentPatch) && (
            <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
              Inherited: terminal
            </div>
          )}
        </fieldset>
      ) : (
        <div
          style={{
            padding: 12,
            background: "#f0fdf4",
            border: "1px solid #86efac",
            borderRadius: 4,
            fontSize: 14,
            color: "#166534",
          }}
        >
          ℹ️ This is a leaf element (no children)
        </div>
      )}

      {/* Zone selector */}
      {!isFieldInherited("zone") ? (
        <fieldset
          style={{ border: "1px solid #ddd", borderRadius: 4, padding: 12 }}
        >
          <legend style={{ fontWeight: 600, fontSize: 14 }}>Zone</legend>
          <div style={{ display: "flex", gap: 12 }}>
            {(["swap", "crossing", undefined] as const).map((z) => (
              <label
                key={z ?? "none"}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  cursor: "pointer",
                }}
              >
                <input
                  type="radio"
                  name="zone"
                  checked={
                    currentPatch.zone === z ||
                    (z === undefined && !("zone" in currentPatch))
                  }
                  onChange={() => {
                    if (z === undefined) {
                      const { zone: _, ...rest } = currentPatch;
                      onChange(rest);
                    } else {
                      updateField("zone", z);
                    }
                  }}
                />
                {z ?? "(unspecified)"}
              </label>
            ))}
          </div>
        </fieldset>
      ) : (
        <div
          style={{
            padding: 12,
            background: "#e5e7eb",
            border: "1px solid #9ca3af",
            borderRadius: 4,
            fontSize: 14,
            color: "#1f2937",
          }}
        >
          <strong>Zone:</strong> {inheritedPatch.zone} (specified by ancestor)
        </div>
      )}

      {/* Swap-specific fields */}
      {zone === "swap" && (
        <>
          {!isFieldInherited("row") ? (
            <fieldset
              style={{ border: "1px solid #ddd", borderRadius: 4, padding: 12 }}
            >
              <legend style={{ fontWeight: 600, fontSize: 14 }}>Row</legend>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[undefined, 0, 1, 2, 3, 4].map((v) => (
                  <label
                    key={v ?? "none"}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="radio"
                      name="row"
                      checked={
                        v === undefined
                          ? !("row" in currentPatch)
                          : currentPatch.row === v
                      }
                      onChange={() =>
                        updateField("row", v as number | undefined)
                      }
                    />
                    {v ?? "(unspecified)"}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : (
            <div
              style={{
                padding: 12,
                background: "#e5e7eb",
                border: "1px solid #9ca3af",
                borderRadius: 4,
                fontSize: 14,
                color: "#1f2937",
              }}
            >
              <strong>Row:</strong> {inheritedPatch.row} (specified by ancestor)
            </div>
          )}

          {!isFieldInherited("col") ? (
            <fieldset
              style={{ border: "1px solid #ddd", borderRadius: 4, padding: 12 }}
            >
              <legend style={{ fontWeight: 600, fontSize: 14 }}>Col</legend>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[undefined, 0, 1, 2, 3, 4, 5].map((v) => (
                  <label
                    key={v ?? "none"}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="radio"
                      name="col"
                      checked={
                        v === undefined
                          ? !("col" in currentPatch)
                          : currentPatch.col === v
                      }
                      onChange={() =>
                        updateField("col", v as number | undefined)
                      }
                    />
                    {v ?? "(unspecified)"}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : (
            <div
              style={{
                padding: 12,
                background: "#e5e7eb",
                border: "1px solid #9ca3af",
                borderRadius: 4,
                fontSize: 14,
                color: "#1f2937",
              }}
            >
              <strong>Col:</strong> {inheritedPatch.col} (specified by ancestor)
            </div>
          )}

          {!isFieldInherited("shape") ? (
            <fieldset
              style={{ border: "1px solid #ddd", borderRadius: 4, padding: 12 }}
            >
              <legend style={{ fontWeight: 600, fontSize: 14 }}>Shape</legend>
              <div style={{ display: "flex", gap: 8 }}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="radio"
                    name="shape"
                    checked={!("shape" in currentPatch)}
                    onChange={() => updateField("shape", undefined)}
                  />
                  (unspecified)
                </label>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="radio"
                    name="shape"
                    checked={currentPatch.shape === "plus"}
                    onChange={() => updateField("shape", "plus")}
                  />
                  plus
                </label>
              </div>
            </fieldset>
          ) : (
            <div
              style={{
                padding: 12,
                background: "#e5e7eb",
                border: "1px solid #9ca3af",
                borderRadius: 4,
                fontSize: 14,
                color: "#1f2937",
              }}
            >
              <strong>Shape:</strong> {inheritedPatch.shape} (specified by
              ancestor)
            </div>
          )}
        </>
      )}

      {/* Crossing-specific fields */}
      {zone === "crossing" && (
        <>
          {!isFieldInherited("area") ? (
            <fieldset
              style={{ border: "1px solid #ddd", borderRadius: 4, padding: 12 }}
            >
              <legend style={{ fontWeight: 600, fontSize: 14 }}>Area</legend>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[undefined, "lattice", "interstitium", "reveal"].map((v) => (
                  <label
                    key={v ?? "none"}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="radio"
                      name="area"
                      checked={
                        v === undefined
                          ? !("area" in currentPatch)
                          : currentPatch.area === v
                      }
                      onChange={() =>
                        updateField("area", v as BoardElementPatch["area"])
                      }
                    />
                    {v ?? "(unspecified)"}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : (
            <div
              style={{
                padding: 12,
                background: "#e5e7eb",
                border: "1px solid #9ca3af",
                borderRadius: 4,
                fontSize: 14,
                color: "#1f2937",
              }}
            >
              <strong>Area:</strong> {inheritedPatch.area} (specified by
              ancestor)
            </div>
          )}

          {!isFieldInherited("shape") ? (
            <fieldset
              style={{ border: "1px solid #ddd", borderRadius: 4, padding: 12 }}
            >
              <legend style={{ fontWeight: 600, fontSize: 14 }}>Shape</legend>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[
                  undefined,
                  "eye",
                  "plus",
                  "dash-segment",
                  "solid-segment",
                  "intersection",
                ].map((v) => (
                  <label
                    key={v ?? "none"}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="radio"
                      name="shape"
                      checked={
                        v === undefined
                          ? !("shape" in currentPatch)
                          : currentPatch.shape === v
                      }
                      onChange={() =>
                        updateField("shape", v as BoardElementPatch["shape"])
                      }
                    />
                    {v ?? "(unspecified)"}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : (
            <div
              style={{
                padding: 12,
                background: "#e5e7eb",
                border: "1px solid #9ca3af",
                borderRadius: 4,
                fontSize: 14,
                color: "#1f2937",
              }}
            >
              <strong>Shape:</strong> {inheritedPatch.shape} (specified by
              ancestor)
            </div>
          )}

          {!isFieldInherited("leftIndex") ? (
            <fieldset
              style={{ border: "1px solid #ddd", borderRadius: 4, padding: 12 }}
            >
              <legend style={{ fontWeight: 600, fontSize: 14 }}>
                Left Index
              </legend>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[undefined, 0, 1, 2, 3, 4].map((v) => (
                  <label
                    key={v ?? "none"}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="radio"
                      name="leftIndex"
                      checked={
                        v === undefined
                          ? !("leftIndex" in currentPatch)
                          : currentPatch.leftIndex === v
                      }
                      onChange={() => updateField("leftIndex", v)}
                    />
                    {v ?? "(unspecified)"}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : (
            <div
              style={{
                padding: 12,
                background: "#e5e7eb",
                border: "1px solid #9ca3af",
                borderRadius: 4,
                fontSize: 14,
                color: "#1f2937",
              }}
            >
              <strong>Left Index:</strong> {inheritedPatch.leftIndex} (specified
              by ancestor)
            </div>
          )}

          {!isFieldInherited("rightIndex") ? (
            <fieldset
              style={{ border: "1px solid #ddd", borderRadius: 4, padding: 12 }}
            >
              <legend style={{ fontWeight: 600, fontSize: 14 }}>
                Right Index
              </legend>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[undefined, 0, 1, 2, 3, 4].map((v) => (
                  <label
                    key={v ?? "none"}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="radio"
                      name="rightIndex"
                      checked={
                        v === undefined
                          ? !("rightIndex" in currentPatch)
                          : currentPatch.rightIndex === v
                      }
                      onChange={() => updateField("rightIndex", v)}
                    />
                    {v ?? "(unspecified)"}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : (
            <div
              style={{
                padding: 12,
                background: "#e5e7eb",
                border: "1px solid #9ca3af",
                borderRadius: 4,
                fontSize: 14,
                color: "#1f2937",
              }}
            >
              <strong>Right Index:</strong> {inheritedPatch.rightIndex}{" "}
              (specified by ancestor)
            </div>
          )}

          {!isFieldInherited("reachesCrossIndex") ? (
            <fieldset
              style={{ border: "1px solid #ddd", borderRadius: 4, padding: 12 }}
            >
              <legend style={{ fontWeight: 600, fontSize: 14 }}>
                Reaches Cross Index
              </legend>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[undefined, 0, 1, 2, 3, 4].map((v) => (
                  <label
                    key={v ?? "none"}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="radio"
                      name="reachesCrossIndex"
                      checked={
                        v === undefined
                          ? !("reachesCrossIndex" in currentPatch)
                          : currentPatch.reachesCrossIndex === v
                      }
                      onChange={() => updateField("reachesCrossIndex", v)}
                    />
                    {v ?? "(unspecified)"}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : (
            <div
              style={{
                padding: 12,
                background: "#e5e7eb",
                border: "1px solid #9ca3af",
                borderRadius: 4,
                fontSize: 14,
                color: "#1f2937",
              }}
            >
              <strong>Reaches Cross Index:</strong>{" "}
              {inheritedPatch.reachesCrossIndex} (specified by ancestor)
            </div>
          )}
        </>
      )}
    </div>
  );
}

// === MAIN COMPONENT ===

export default function SVGAnnotator() {
  const [svgText, setSvgText] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<{
    root: DFSNode;
    allNodes: DFSNode[];
    dfsOrder: DFSNode[];
  } | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [rules, setRules] = useState<Map<string, BoardElementPatch>>(new Map());
  const [rulesInput, setRulesInput] = useState("");
  const [rulesError, setRulesError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>(
    [],
  );

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        setSvgText(text);
        try {
          const { root, allNodes } = parseSVG(text);
          const dfsOrder = getDFSOrder(root);
          setParsedData({ root, allNodes, dfsOrder });
          setCurrentIndex(0);
          setRules(new Map());
        } catch (err) {
          alert("Failed to parse SVG: " + (err as Error).message);
        }
      };
      reader.readAsText(file);
    },
    [],
  );

  const currentNode = parsedData?.dfsOrder[currentIndex] ?? null;

  const getInheritedPatch = useCallback(
    (nodeId: string): BoardElementPatch => {
      if (!parsedData) return {};

      const parts = nodeId.split("/");
      let inherited: BoardElementPatch = {};

      for (let i = 1; i <= parts.length; i++) {
        const ancestorId = parts.slice(0, i).join("/");
        const patch = rules.get(ancestorId);
        if (patch) {
          inherited = { ...inherited, ...patch };
        }
      }

      // Remove the current node's own patch from inherited
      const currentPatch = rules.get(nodeId);
      if (currentPatch) {
        // inherited already includes current, so we need to recalculate without it
        inherited = {};
        for (let i = 1; i < parts.length; i++) {
          const ancestorId = parts.slice(0, i).join("/");
          const patch = rules.get(ancestorId);
          if (patch) {
            inherited = { ...inherited, ...patch };
          }
        }
      }

      return inherited;
    },
    [parsedData, rules],
  );

  const validateAll = useCallback(() => {
    if (!parsedData) return;

    const errors: ValidationError[] = [];
    const terminalNodeIds = new Set<string>();

    for (const node of parsedData.dfsOrder) {
      const inherited = getInheritedPatch(node.id);
      const current = rules.get(node.id) || {};
      const merged = { ...inherited, ...current };

      if (merged.terminal) {
        terminalNodeIds.add(node.id);
        for (const descendant of getDFSOrder(node)) {
          if (descendant.id !== node.id) {
            terminalNodeIds.add(descendant.id);
          }
        }
      }
    }

    for (const node of parsedData.dfsOrder) {
      const inherited = getInheritedPatch(node.id);
      const current = rules.get(node.id) || {};
      const merged = { ...inherited, ...current };

      const isTerminal = merged.terminal;
      const isDescendantOfTerminal =
        terminalNodeIds.has(node.id) && !isTerminal;

      if (isDescendantOfTerminal) continue;

      const isLeafOrTerminal = node.isLeaf || isTerminal;
      if (!isLeafOrTerminal) continue;

      if (merged.skip) continue;

      const nodeErrors = validateElement(merged, isLeafOrTerminal);
      if (nodeErrors.length > 0) {
        errors.push({ nodeId: node.id, errors: nodeErrors });
      }
    }

    setValidationErrors(errors);
  }, [parsedData, rules, getInheritedPatch]);

  const goToFirstInvalidNode = useCallback(() => {
    if (validationErrors.length === 0 || !parsedData) return;
    const firstError = validationErrors[0];
    const index = parsedData.dfsOrder.findIndex(
      (n) => n.id === firstError.nodeId,
    );
    if (index !== -1) {
      setCurrentIndex(index);
    }
  }, [validationErrors, parsedData]);

  const handlePatchChange = useCallback(
    (patch: BoardElementPatch) => {
      if (!currentNode) return;
      setRules((prev) => {
        const next = new Map(prev);
        if (Object.keys(patch).length === 0) {
          next.delete(currentNode.id);
        } else {
          next.set(currentNode.id, patch);
        }
        return next;
      });
    },
    [currentNode],
  );

  // Validate whenever rules change
  useMemo(() => {
    validateAll();
  }, [validateAll]);

  const handleLoadRules = useCallback(() => {
    try {
      const parsed: Rule[] = JSON.parse(rulesInput);
      if (!Array.isArray(parsed)) {
        throw new Error("Rules must be an array");
      }

      if (!parsedData) {
        throw new Error("Load an SVG first");
      }

      const nodeIds = new Set(parsedData.dfsOrder.map((n) => n.id));
      const warnings: string[] = [];
      const newRules = new Map<string, BoardElementPatch>();

      for (const rule of parsed) {
        if (!rule.nodeId || typeof rule.nodeId !== "string") {
          warnings.push(`Invalid rule: missing nodeId`);
          continue;
        }
        if (!nodeIds.has(rule.nodeId)) {
          warnings.push(`Node not found: ${rule.nodeId}`);
          continue;
        }
        if (rule.patch && Object.keys(rule.patch).length > 0) {
          newRules.set(rule.nodeId, rule.patch);
        }
      }

      setRules(newRules);
      setRulesError(warnings.length > 0 ? warnings.join("\n") : null);
      setRulesInput("");
    } catch (err) {
      setRulesError("Failed to parse rules: " + (err as Error).message);
    }
  }, [rulesInput, parsedData]);

  const exportBoardElements = useCallback(() => {
    if (!parsedData) return;

    const elements: BoardElement[] = [];
    const terminalNodeIds = new Set<string>();

    for (const node of parsedData.dfsOrder) {
      const inherited = getInheritedPatch(node.id);
      const current = rules.get(node.id) || {};
      const merged = { ...inherited, ...current };

      if (merged.terminal) {
        terminalNodeIds.add(node.id);
        for (const descendant of getDFSOrder(node)) {
          if (descendant.id !== node.id) {
            terminalNodeIds.add(descendant.id);
          }
        }
      }
    }

    for (const node of parsedData.dfsOrder) {
      const inherited = getInheritedPatch(node.id);
      const current = rules.get(node.id) || {};
      const merged = { ...inherited, ...current };

      const isTerminal = merged.terminal;
      const isDescendantOfTerminal =
        terminalNodeIds.has(node.id) && !isTerminal;

      if (!node.isLeaf && !isTerminal) continue;
      if (isDescendantOfTerminal) continue;

      if (!merged.zone) continue;
      if (merged.skip) continue;

      const { skip: _skip, terminal: _terminal, ...elementData } = merged;

      const element: BoardElement = {
        id: node.id,
        path: getPathData(node.element),
        tagName: node.element.tagName.toLowerCase(),
        attributes: getElementAttributes(node.element),
        ...elementData,
      } as BoardElement;

      elements.push(element);
    }

    const blob = new Blob([JSON.stringify(elements, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "board-elements.json";
    a.click();
    URL.revokeObjectURL(url);
  }, [parsedData, rules, getInheritedPatch]);

  const exportRules = useCallback(() => {
    const rulesArray: Rule[] = Array.from(rules.entries()).map(
      ([nodeId, patch]) => ({
        nodeId,
        patch,
      }),
    );

    const blob = new Blob([JSON.stringify(rulesArray, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "annotation-rules.json";
    a.click();
    URL.revokeObjectURL(url);
  }, [rules]);

  if (!svgText || !parsedData) {
    return (
      <div style={{ padding: 32, fontFamily: "system-ui, sans-serif" }}>
        <h1 style={{ fontSize: 24, marginBottom: 16 }}>SVG Board Annotator</h1>
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
            Load SVG File:
            <input
              type="file"
              accept=".svg"
              onChange={handleFileUpload}
              style={{ display: "block", marginTop: 8 }}
            />
          </label>
        </div>
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
            Or paste rules to replay (after loading SVG):
            <textarea
              value={rulesInput}
              onChange={(e) => setRulesInput(e.target.value)}
              placeholder='[{"nodeId": "svg[0]/g[0]", "patch": {"zone": "crossing"}}]'
              style={{
                display: "block",
                width: "100%",
                height: 120,
                fontFamily: "monospace",
                fontSize: 12,
                marginTop: 8,
              }}
            />
          </label>
          <button
            type="button"
            onClick={handleLoadRules}
            style={{ marginTop: 8 }}
            disabled={!parsedData}
          >
            Load Rules
          </button>
          {rulesError && (
            <pre
              style={{
                color: "#dc2626",
                fontSize: 12,
                marginTop: 8,
                whiteSpace: "pre-wrap",
              }}
            >
              {rulesError}
            </pre>
          )}
        </div>
      </div>
    );
  }

  const inherited = currentNode ? getInheritedPatch(currentNode.id) : {};
  const currentPatch = currentNode ? rules.get(currentNode.id) || {} : {};

  const currentNodeErrors = validationErrors.find(
    (e) => e.nodeId === currentNode?.id,
  );

  return (
    <div
      style={{
        padding: 24,
        fontFamily: "system-ui, sans-serif",
        maxWidth: 1400,
        margin: "0 auto",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <h1 style={{ fontSize: 20, margin: 0 }}>SVG Board Annotator</h1>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {validationErrors.length > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 12px",
                background: "#fee2e2",
                border: "1px solid #ef4444",
                borderRadius: 4,
                fontSize: 14,
                color: "#991b1b",
              }}
            >
              <strong>⚠️ {validationErrors.length} invalid nodes</strong>
              <button
                type="button"
                onClick={goToFirstInvalidNode}
                style={{
                  padding: "4px 8px",
                  fontSize: 12,
                  background: "#dc2626",
                  color: "white",
                  border: "none",
                  borderRadius: 3,
                  cursor: "pointer",
                }}
              >
                Go to first
              </button>
            </div>
          )}
          <button type="button" onClick={exportBoardElements}>
            Export Board Elements
          </button>
          <button type="button" onClick={exportRules}>
            Export Rules
          </button>
          <button
            type="button"
            onClick={() => {
              setSvgText(null);
              setParsedData(null);
            }}
          >
            Load New SVG
          </button>
        </div>
      </div>

      {/* Rules loader */}
      <details style={{ marginBottom: 16 }}>
        <summary style={{ cursor: "pointer", fontWeight: 600 }}>
          Load Rules
        </summary>
        <div style={{ marginTop: 8 }}>
          <textarea
            value={rulesInput}
            onChange={(e) => setRulesInput(e.target.value)}
            placeholder='[{"nodeId": "svg[0]/g[0]", "patch": {"zone": "crossing"}}]'
            style={{
              width: "100%",
              height: 100,
              fontFamily: "monospace",
              fontSize: 12,
            }}
          />
          <button
            type="button"
            onClick={handleLoadRules}
            style={{ marginTop: 8 }}
          >
            Load Rules
          </button>
          {rulesError && (
            <pre
              style={{
                color: "#dc2626",
                fontSize: 12,
                marginTop: 8,
                whiteSpace: "pre-wrap",
              }}
            >
              {rulesError}
            </pre>
          )}
        </div>
      </details>

      {/* Navigation */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          marginBottom: 16,
        }}
      >
        <button
          type="button"
          onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
          disabled={currentIndex === 0}
        >
          ← Previous
        </button>
        <span style={{ fontWeight: 600 }}>
          Node {currentIndex + 1} / {parsedData.dfsOrder.length}
        </span>
        <button
          type="button"
          onClick={() =>
            setCurrentIndex((i) =>
              Math.min(parsedData.dfsOrder.length - 1, i + 1),
            )
          }
          disabled={currentIndex === parsedData.dfsOrder.length - 1}
        >
          Next →
        </button>
        <span style={{ color: "#666", fontSize: 14 }}>
          {currentNode?.isLeaf ? "🍃 Leaf" : "📁 Group"} —{" "}
          {currentNode?.element.tagName.toLowerCase()}
        </span>
      </div>

      {/* Node info */}
      {currentNode && (
        <div
          style={{
            background: "#f3f4f6",
            padding: 12,
            borderRadius: 6,
            marginBottom: 16,
            fontFamily: "monospace",
            fontSize: 13,
          }}
        >
          <strong>ID:</strong> {currentNode.id}
          {currentNode.children.length > 0 && (
            <span style={{ marginLeft: 16 }}>
              <strong>Children:</strong> {currentNode.children.length}
            </span>
          )}
        </div>
      )}

      {/* Current node validation errors */}
      {currentNodeErrors && (
        <div
          style={{
            background: "#fee2e2",
            border: "2px solid #ef4444",
            padding: 12,
            borderRadius: 6,
            marginBottom: 16,
          }}
        >
          <strong style={{ color: "#991b1b", fontSize: 14 }}>
            ⚠️ Validation Errors:
          </strong>
          <ul
            style={{
              margin: "8px 0 0 0",
              paddingLeft: 20,
              color: "#991b1b",
            }}
          >
            {currentNodeErrors.errors.map((error) => (
              <li key={error} style={{ fontSize: 13 }}>
                {error}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Main content */}
      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 400px", gap: 24 }}
      >
        <SVGPreview
          svgText={svgText}
          highlightId={currentNode?.id || ""}
          allNodes={parsedData.allNodes}
        />

        <div>
          <h2 style={{ fontSize: 16, marginBottom: 12 }}>
            {currentNode?.isLeaf
              ? "Element Properties"
              : "Set Context for Descendants"}
          </h2>
          <PatchEditor
            inheritedPatch={inherited}
            currentPatch={currentPatch}
            onChange={handlePatchChange}
            isLeaf={currentNode?.isLeaf ?? false}
            hasChildren={(currentNode?.children.length ?? 0) > 0}
          />

          {/* Current merged state preview */}
          <div style={{ marginTop: 24 }}>
            <h3 style={{ fontSize: 14, marginBottom: 8 }}>
              Merged State Preview:
            </h3>
            <pre
              style={{
                background: "#1f2937",
                color: "#e5e7eb",
                padding: 12,
                borderRadius: 6,
                fontSize: 12,
                overflow: "auto",
              }}
            >
              {JSON.stringify({ ...inherited, ...currentPatch }, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
