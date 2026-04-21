"use strict";

const SVG_NS = "http://www.w3.org/2000/svg";
const TEXT_ENCODER = new TextEncoder();
const ANGLE_SNAP_VALUES = [0, 30, 45, 60, 90, 120, 135, 150];
const TOOL_CONFIG = {
  select: {
    label: "Select",
    hint: "Click objects to move them, then adjust exact values in the properties panel."
  },
  line: {
    label: "Line",
    hint: "Click to set a start point, move for a live preview, then click again to place the endpoint."
  },
  dashedLine: {
    label: "Dashed Line",
    hint: "Creates engineering-style dashed construction lines with live length and angle."
  },
  centerLine: {
    label: "Center Line",
    hint: "Creates chain-line center references with midpoint snapping and constraint support."
  },
  point: {
    label: "Point",
    hint: "Places a point marker at the snapped cursor location."
  },
  circle: {
    label: "Circle",
    hint: "Click once for the center, then click again after setting the radius."
  },
  ellipse: {
    label: "Ellipse",
    hint: "Define the ellipse with an opposite-corner drag box."
  },
  rectangle: {
    label: "Rectangle",
    hint: "Click a first corner, preview the opposite corner, and lock size numerically if needed."
  },
  square: {
    label: "Square",
    hint: "Square mode keeps equal sides while you drag and still supports numeric side input."
  },
  rhombus: {
    label: "Rhombus",
    hint: "Creates a diamond profile inside the live bounding box."
  },
  polygon: {
    label: "Polygon",
    hint: "Click for the center and drag the circumradius. Edit side count in the tool panel."
  },
  parabola: {
    label: "Parabola",
    hint: "Creates a simplified engineering parabola inside a bounding frame."
  },
  freeform: {
    label: "Freeform",
    hint: "Press and drag to sketch a freeform curve. Release the mouse to finish."
  },
  arc: {
    label: "Compass Arc",
    hint: "Click the center, click again to set radius and start angle, then click a third time to end the arc."
  }
};
const TOOL_SHORTCUTS = {
  v: "select",
  l: "line",
  d: "dashedLine",
  c: "circle",
  e: "ellipse",
  r: "rectangle",
  s: "square",
  o: "point",
  f: "freeform",
  p: "polygon",
  b: "parabola",
  a: "arc"
};
const UNIT_FACTORS = {
  mm: 1,
  cm: 10,
  in: 25.4
};
const LINE_TOOL_SET = new Set(["line", "dashedLine", "centerLine"]);
const BOX_TOOL_SET = new Set(["rectangle", "square", "rhombus", "ellipse", "parabola"]);
const ROTATABLE_TYPES = new Set(["rectangle", "square", "rhombus", "ellipse", "polygon", "parabola"]);

const elements = {
  surface: document.getElementById("drawing-surface"),
  viewport: document.getElementById("viewport"),
  gridPlane: document.getElementById("grid-plane"),
  geometryLayer: document.getElementById("geometry-layer"),
  annotationLayer: document.getElementById("annotation-layer"),
  draftLayer: document.getElementById("draft-layer"),
  selectionLayer: document.getElementById("selection-layer"),
  toolButtons: Array.from(document.querySelectorAll(".tool-btn")),
  toolBadge: document.getElementById("tool-badge"),
  unitsBadge: document.getElementById("units-badge"),
  snapBadge: document.getElementById("snap-badge"),
  cursorReadout: document.getElementById("cursor-readout"),
  selectionReadout: document.getElementById("selection-readout"),
  hintReadout: document.getElementById("hint-readout"),
  unitsSelect: document.getElementById("units-select"),
  gridSizeInput: document.getElementById("grid-size-input"),
  showGridToggle: document.getElementById("show-grid-toggle"),
  showDimensionsToggle: document.getElementById("show-dimensions-toggle"),
  snapGridToggle: document.getElementById("snap-grid-toggle"),
  snapPointsToggle: document.getElementById("snap-points-toggle"),
  snapAngleToggle: document.getElementById("snap-angle-toggle"),
  toolSettingsPanel: document.getElementById("tool-settings-panel"),
  selectionPanel: document.getElementById("selection-panel"),
  constraintsPanel: document.getElementById("constraints-panel"),
  undoButton: document.getElementById("undo-btn"),
  redoButton: document.getElementById("redo-btn"),
  saveButton: document.getElementById("save-btn"),
  loadButton: document.getElementById("load-btn"),
  exportSvgButton: document.getElementById("export-svg-btn"),
  exportPngButton: document.getElementById("export-png-btn"),
  exportPdfButton: document.getElementById("export-pdf-btn"),
  projectFileInput: document.getElementById("project-file-input")
};

const state = {
  activeTool: "select",
  shapes: [],
  draft: null,
  selectedId: null,
  referenceLineId: null,
  units: "mm",
  gridSize: 10,
  showGrid: true,
  showDimensions: true,
  snapGrid: true,
  snapPoints: true,
  snapAngles: true,
  axisLock: null,
  defaultPolygonSides: 6,
  zoom: 1,
  offset: { x: 0, y: 0 },
  pointer: { x: 0, y: 0 },
  snapPreview: null,
  spacePan: false,
  interaction: null,
  history: [],
  future: [],
  ui: {
    toolSettingsKey: "",
    selectionKey: "",
    constraintsKey: ""
  }
};

init();

function init() {
  bindEvents();
  requestAnimationFrame(() => {
    centerViewport();
    updateGridPattern();
    commitHistory();
    render(true);
  });
}

function bindEvents() {
  elements.toolButtons.forEach((button) => {
    button.addEventListener("click", () => setTool(button.dataset.tool));
  });

  elements.unitsSelect.addEventListener("change", (event) => {
    state.units = event.target.value;
    render(true);
  });

  elements.gridSizeInput.addEventListener("change", (event) => {
    state.gridSize = Math.max(1, Number(event.target.value) || 10);
    updateGridPattern();
    render(true);
  });

  elements.showGridToggle.addEventListener("change", (event) => {
    state.showGrid = event.target.checked;
    render(false);
  });

  elements.showDimensionsToggle.addEventListener("change", (event) => {
    state.showDimensions = event.target.checked;
    render(false);
  });

  elements.snapGridToggle.addEventListener("change", (event) => {
    state.snapGrid = event.target.checked;
    render(false);
  });

  elements.snapPointsToggle.addEventListener("change", (event) => {
    state.snapPoints = event.target.checked;
    render(false);
  });

  elements.snapAngleToggle.addEventListener("change", (event) => {
    state.snapAngles = event.target.checked;
    render(false);
  });

  elements.undoButton.addEventListener("click", undo);
  elements.redoButton.addEventListener("click", redo);
  elements.saveButton.addEventListener("click", saveProject);
  elements.loadButton.addEventListener("click", () => elements.projectFileInput.click());
  elements.exportSvgButton.addEventListener("click", exportSvg);
  elements.exportPngButton.addEventListener("click", () => exportRaster("png"));
  elements.exportPdfButton.addEventListener("click", exportPdf);

  elements.projectFileInput.addEventListener("change", handleProjectLoad);
  elements.toolSettingsPanel.addEventListener("input", handleToolPanelInput);
  elements.toolSettingsPanel.addEventListener("change", handleToolPanelInput);
  elements.toolSettingsPanel.addEventListener("click", handleToolPanelClick);
  elements.selectionPanel.addEventListener("input", handleSelectionPanelInput);
  elements.selectionPanel.addEventListener("change", handleSelectionPanelInput);
  elements.selectionPanel.addEventListener("click", handleSelectionPanelClick);
  elements.constraintsPanel.addEventListener("click", handleConstraintPanelClick);

  elements.surface.addEventListener("pointerdown", handlePointerDown);
  elements.surface.addEventListener("pointermove", handlePointerMove);
  window.addEventListener("pointerup", handlePointerUp);
  elements.surface.addEventListener("wheel", handleWheel, { passive: false });

  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);
  window.addEventListener("resize", handleResize);
}

function handleResize() {
  if (state.offset.x === 0 && state.offset.y === 0) {
    centerViewport();
  }
  render(false);
}

function centerViewport() {
  const rect = elements.surface.getBoundingClientRect();
  state.offset = {
    x: rect.width * 0.5,
    y: rect.height * 0.5
  };
}

function setTool(tool) {
  if (!TOOL_CONFIG[tool]) {
    return;
  }

  if (tool !== state.activeTool) {
    state.draft = null;
    state.axisLock = null;
  }

  state.activeTool = tool;
  state.snapPreview = null;
  updateCursor();
  render(true);
}

function render(forcePanels = false) {
  syncViewport();
  renderGeometry();
  renderDraft();
  renderSelection();
  syncToolbar();
  renderToolSettings(forcePanels);
  renderSelectionPanel(forcePanels);
  renderConstraintsPanel(forcePanels);
  updateHud();
}

function syncViewport() {
  elements.viewport.setAttribute(
    "transform",
    `translate(${state.offset.x} ${state.offset.y}) scale(${state.zoom})`
  );
  elements.gridPlane.style.display = state.showGrid ? "block" : "none";
}

function renderGeometry() {
  elements.geometryLayer.innerHTML = "";
  elements.annotationLayer.innerHTML = "";

  state.shapes.forEach((shape) => {
    const group = buildShapeGroup(shape);
    elements.geometryLayer.appendChild(group);

    if (state.showDimensions) {
      const label = buildMeasurementLabel(shape, state.zoom);
      if (label) {
        elements.annotationLayer.appendChild(label);
      }
    }
  });
}

function renderDraft() {
  elements.draftLayer.innerHTML = "";

  if (!state.draft) {
    if (state.snapPreview?.point) {
      elements.draftLayer.appendChild(buildSnapIndicator(state.snapPreview.point, 6 / state.zoom));
    }
    return;
  }

  const draft = state.draft;
  const anchorRadius = 5 / state.zoom;
  elements.draftLayer.appendChild(buildSnapIndicator(getDraftAnchor(draft), anchorRadius));

  if (draft.tool === "arc") {
    renderArcDraft(draft);
  } else if (draft.tool === "freeform") {
    const freeformShape = shapeFromDraft(draft);
    if (freeformShape) {
      const group = buildShapeGroup(freeformShape, { isDraft: true });
      elements.draftLayer.appendChild(group);
      const label = buildMeasurementLabel(freeformShape, state.zoom);
      if (label) {
        elements.draftLayer.appendChild(label);
      }
    }
  } else {
    const draftShape = shapeFromDraft(draft);
    if (draftShape) {
      const group = buildShapeGroup(draftShape, { isDraft: true });
      elements.draftLayer.appendChild(group);
      const label = buildMeasurementLabel(draftShape, state.zoom);
      if (label) {
        elements.draftLayer.appendChild(label);
      }
    }
  }

  if (state.snapPreview?.point) {
    elements.draftLayer.appendChild(buildSnapIndicator(state.snapPreview.point, 6 / state.zoom));
  }
}

function renderArcDraft(draft) {
  const centerMarker = buildSnapIndicator(draft.center, 5 / state.zoom);
  elements.draftLayer.appendChild(centerMarker);

  if (draft.stage === 0) {
    const radius = Math.max(0.0001, distance(draft.center, draft.current));
    const circle = createSvgElement("circle", {
      cx: draft.center.x,
      cy: draft.center.y,
      r: radius,
      class: "shape draft-guide",
      "stroke-dasharray": `${10 / state.zoom} ${7 / state.zoom}`
    });
    const guide = createSvgElement("line", {
      x1: draft.center.x,
      y1: draft.center.y,
      x2: draft.current.x,
      y2: draft.current.y,
      class: "shape draft-guide"
    });
    elements.draftLayer.append(circle, guide);
    const previewLabel = buildTextLabel(
      `R ${formatMeasure(radius)} | Start ${formatAngle(angleBetween(draft.center, draft.current))}`,
      midpoint(draft.center, draft.current).x,
      midpoint(draft.center, draft.current).y - 12 / state.zoom,
      state.zoom
    );
    elements.draftLayer.appendChild(previewLabel);
    return;
  }

  const arcShape = shapeFromDraft(draft);
  if (arcShape) {
    const group = buildShapeGroup(arcShape, { isDraft: true });
    const startPoint = polarPoint(draft.center, draft.radius, draft.startAngle);
    const endPoint = polarPoint(draft.center, draft.radius, draft.endAngle);
    const startGuide = createSvgElement("line", {
      x1: draft.center.x,
      y1: draft.center.y,
      x2: startPoint.x,
      y2: startPoint.y,
      class: "shape draft-guide"
    });
    const endGuide = createSvgElement("line", {
      x1: draft.center.x,
      y1: draft.center.y,
      x2: endPoint.x,
      y2: endPoint.y,
      class: "shape draft-guide"
    });
    elements.draftLayer.append(startGuide, endGuide, group);
    const label = buildMeasurementLabel(arcShape, state.zoom);
    if (label) {
      elements.draftLayer.appendChild(label);
    }
  }
}

function renderSelection() {
  elements.selectionLayer.innerHTML = "";

  const selectedShape = getSelectedShape();
  if (!selectedShape) {
    return;
  }

  const bounds = getShapeBounds(selectedShape);
  if (!bounds) {
    return;
  }

  const padding = 10 / state.zoom;
  const rect = createSvgElement("rect", {
    x: bounds.minX - padding,
    y: bounds.minY - padding,
    width: Math.max(bounds.maxX - bounds.minX + padding * 2, 1 / state.zoom),
    height: Math.max(bounds.maxY - bounds.minY + padding * 2, 1 / state.zoom),
    rx: 10 / state.zoom,
    ry: 10 / state.zoom,
    class: "selection-box"
  });
  elements.selectionLayer.appendChild(rect);
}

function syncToolbar() {
  elements.toolButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.tool === state.activeTool);
  });
}

function updateHud() {
  elements.toolBadge.textContent = `Tool: ${TOOL_CONFIG[state.activeTool].label}`;
  elements.unitsBadge.textContent = `Units: ${state.units}`;
  elements.snapBadge.textContent = `Snap: ${describeSnapMode()}`;
  elements.cursorReadout.textContent = `Cursor: ${formatCoordinate(state.pointer.x)}, ${formatCoordinate(state.pointer.y)}`;
  elements.selectionReadout.textContent = getSelectedShape()
    ? `Selection: ${selectionSummary(getSelectedShape())}`
    : "Selection: none";
  elements.hintReadout.textContent = getHintText();

  elements.unitsSelect.value = state.units;
  elements.gridSizeInput.value = String(state.gridSize);
  elements.showGridToggle.checked = state.showGrid;
  elements.showDimensionsToggle.checked = state.showDimensions;
  elements.snapGridToggle.checked = state.snapGrid;
  elements.snapPointsToggle.checked = state.snapPoints;
  elements.snapAngleToggle.checked = state.snapAngles;
  elements.undoButton.disabled = state.history.length <= 1;
  elements.redoButton.disabled = state.future.length === 0;
}

function renderToolSettings(force = false) {
  const draftStage = state.draft?.tool === state.activeTool ? state.draft.stage ?? "draw" : "idle";
  const nextKey = `${state.activeTool}-${draftStage}-${state.axisLock ?? "free"}`;
  if (force || state.ui.toolSettingsKey !== nextKey) {
    state.ui.toolSettingsKey = nextKey;
    elements.toolSettingsPanel.innerHTML = buildToolSettingsMarkup();
  }
  syncToolSettingsValues();
}

function buildToolSettingsMarkup() {
  const tool = state.activeTool;
  const config = TOOL_CONFIG[tool];
  const draft = state.draft?.tool === tool ? state.draft : null;
  const axisButtons = LINE_TOOL_SET.has(tool)
    ? `
      <div class="action-row">
        <button class="mini-btn ${state.axisLock === "horizontal" ? "is-active" : ""}" data-axis-lock="horizontal" type="button">Horizontal lock</button>
        <button class="mini-btn ${state.axisLock === "vertical" ? "is-active" : ""}" data-axis-lock="vertical" type="button">Vertical lock</button>
        <button class="mini-btn ${state.axisLock === null ? "is-active" : ""}" data-axis-lock="free" type="button">Free axis</button>
      </div>
    `
    : "";

  const commonIntro = `<div class="hint-card">${config.hint}</div>`;

  if (tool === "select") {
    return `
      ${commonIntro}
      <div class="empty-state">
        Move selected objects directly on the canvas. Use the selection panel for exact dimensions, rotation, and coordinates.
      </div>
    `;
  }

  if (tool === "point") {
    return `
      ${commonIntro}
      <div class="empty-state">
        Point placement is instantaneous. Click once on the canvas to drop a marker at the snapped cursor.
      </div>
    `;
  }

  if (LINE_TOOL_SET.has(tool)) {
    return `
      ${commonIntro}
      ${axisButtons}
      <div class="metrics-grid">
        ${fieldMarkup("Length", "draft-length", "number", draft ? displayFromWorld(distance(draft.anchor, draft.current)).toFixed(2) : "", !draft)}
        ${fieldMarkup("Angle", "draft-angle", "number", draft ? normalizeAngle(angleBetween(draft.anchor, draft.current)).toFixed(2) : "", !draft)}
      </div>
      <div class="pill">Start: ${draft ? `${formatCoordinate(draft.anchor.x)}, ${formatCoordinate(draft.anchor.y)}` : "click canvas"}</div>
    `;
  }

  if (tool === "circle") {
    return `
      ${commonIntro}
      <div class="metrics-grid">
        ${fieldMarkup("Radius", "draft-radius", "number", draft ? displayFromWorld(distance(draft.center, draft.current)).toFixed(2) : "", !draft)}
        ${fieldMarkup("Diameter", "draft-diameter", "number", draft ? displayFromWorld(distance(draft.center, draft.current) * 2).toFixed(2) : "", !draft)}
      </div>
      <div class="pill">Center: ${draft ? `${formatCoordinate(draft.center.x)}, ${formatCoordinate(draft.center.y)}` : "click canvas"}</div>
    `;
  }

  if (tool === "polygon") {
    return `
      ${commonIntro}
      <div class="metrics-grid">
        ${fieldMarkup("Radius", "draft-radius", "number", draft ? displayFromWorld(distance(draft.center, draft.current)).toFixed(2) : "", !draft)}
        ${fieldMarkup("Rotation", "draft-rotation", "number", draft ? normalizeAngle(angleBetween(draft.center, draft.current)).toFixed(2) : "0", !draft)}
        ${fieldMarkup("Sides", "draft-sides", "number", draft ? String(draft.sides) : String(state.defaultPolygonSides), false)}
      </div>
      <div class="pill">Center: ${draft ? `${formatCoordinate(draft.center.x)}, ${formatCoordinate(draft.center.y)}` : "click canvas"}</div>
    `;
  }

  if (tool === "arc") {
    return `
      ${commonIntro}
      <div class="metrics-grid">
        ${fieldMarkup("Radius", "draft-radius", "number", draft ? displayFromWorld(draft.stage === 0 ? distance(draft.center, draft.current) : draft.radius).toFixed(2) : "", !draft)}
        ${fieldMarkup("Start angle", "draft-start-angle", "number", draft ? normalizeAngle(draft.stage === 0 ? angleBetween(draft.center, draft.current) : draft.startAngle).toFixed(2) : "", !draft)}
        ${fieldMarkup("End angle", "draft-end-angle", "number", draft && draft.stage === 1 ? normalizeAngle(draft.endAngle).toFixed(2) : "", !(draft && draft.stage === 1))}
      </div>
      <div class="pill">${draft ? `Stage ${draft.stage + 1} of 2` : "Click center to begin"}</div>
    `;
  }

  if (BOX_TOOL_SET.has(tool)) {
    const metrics = getBoxDraftMetrics(draft, tool);
    return `
      ${commonIntro}
      <div class="metrics-grid">
        ${tool === "square" ? fieldMarkup("Side", "draft-side", "number", draft ? displayFromWorld(metrics.width).toFixed(2) : "", !draft) : fieldMarkup("Width", "draft-width", "number", draft ? displayFromWorld(metrics.width).toFixed(2) : "", !draft)}
        ${tool === "square" ? fieldMarkup("Rotation", "draft-rotation", "number", draft ? String(metrics.rotation.toFixed(2)) : "0", true) : fieldMarkup("Height", "draft-height", "number", draft ? displayFromWorld(metrics.height).toFixed(2) : "", !draft)}
      </div>
      <div class="pill">Anchor: ${draft ? `${formatCoordinate(draft.anchor.x)}, ${formatCoordinate(draft.anchor.y)}` : "click canvas"}</div>
    `;
  }

  if (tool === "freeform") {
    return `
      ${commonIntro}
      <div class="empty-state">
        Hold the mouse button and draw directly on the surface. A running curve length appears while you sketch.
      </div>
    `;
  }

  return commonIntro;
}

function syncToolSettingsValues() {
  const draft = state.draft?.tool === state.activeTool ? state.draft : null;
  const radiusValue = draft ? currentDraftRadius(draft) : null;
  syncInputValue("draft-length", draft && LINE_TOOL_SET.has(state.activeTool) ? displayFromWorld(distance(draft.anchor, draft.current)).toFixed(2) : "");
  syncInputValue("draft-angle", draft && LINE_TOOL_SET.has(state.activeTool) ? normalizeAngle(angleBetween(draft.anchor, draft.current)).toFixed(2) : "");
  syncInputValue("draft-radius", radiusValue == null ? "" : radiusValue.toFixed(2));
  syncInputValue("draft-diameter", draft && state.activeTool === "circle" ? displayFromWorld(distance(draft.center, draft.current) * 2).toFixed(2) : "");
  syncInputValue("draft-rotation", draft && state.activeTool === "polygon" ? normalizeAngle(angleBetween(draft.center, draft.current)).toFixed(2) : "");
  syncInputValue("draft-start-angle", draft && state.activeTool === "arc" ? normalizeAngle(draft.stage === 0 ? angleBetween(draft.center, draft.current) : draft.startAngle).toFixed(2) : "");
  syncInputValue("draft-end-angle", draft && state.activeTool === "arc" && draft.stage === 1 ? normalizeAngle(draft.endAngle).toFixed(2) : "");
  syncInputValue("draft-sides", draft && state.activeTool === "polygon" ? String(draft.sides) : String(state.defaultPolygonSides));

  if (draft && BOX_TOOL_SET.has(state.activeTool)) {
    const metrics = getBoxDraftMetrics(draft, state.activeTool);
    syncInputValue("draft-width", displayFromWorld(metrics.width).toFixed(2));
    syncInputValue("draft-height", displayFromWorld(metrics.height).toFixed(2));
    syncInputValue("draft-side", displayFromWorld(metrics.width).toFixed(2));
  } else {
    syncInputValue("draft-width", "");
    syncInputValue("draft-height", "");
    syncInputValue("draft-side", "");
  }
}

function renderSelectionPanel(force = false) {
  const selectedShape = getSelectedShape();
  const nextKey = selectedShape ? `${selectedShape.id}-${selectedShape.type}` : "none";
  if (force || state.ui.selectionKey !== nextKey) {
    state.ui.selectionKey = nextKey;
    elements.selectionPanel.innerHTML = buildSelectionPanelMarkup(selectedShape);
  }
  syncSelectionValues();
}

function buildSelectionPanelMarkup(shape) {
  if (!shape) {
    return `
      <div class="empty-state">
        No object selected. Click any shape to move it, edit dimensions, or apply line constraints.
      </div>
    `;
  }

  if (shape.type === "line") {
    const lengthValue = displayFromWorld(lineLength(shape)).toFixed(2);
    const angleValue = normalizeAngle(lineAngle(shape)).toFixed(2);
    return `
      <div class="pill">${shape.strokeStyle === "center" ? "Center line" : shape.strokeStyle === "dashed" ? "Dashed line" : "Solid line"}</div>
      <div class="property-grid">
        ${fieldMarkup("Start X", "prop-x1", "number", displayFromWorld(shape.x1).toFixed(2), false, "x1")}
        ${fieldMarkup("Start Y", "prop-y1", "number", displayFromWorld(shape.y1).toFixed(2), false, "y1")}
        ${fieldMarkup("End X", "prop-x2", "number", displayFromWorld(shape.x2).toFixed(2), false, "x2")}
        ${fieldMarkup("End Y", "prop-y2", "number", displayFromWorld(shape.y2).toFixed(2), false, "y2")}
        ${fieldMarkup("Length", "prop-length", "number", lengthValue, false, "length")}
        ${fieldMarkup("Angle", "prop-angle", "number", angleValue, false, "angle")}
      </div>
      <div class="action-row">
        <button class="action-btn" data-line-style="solid" type="button">Solid</button>
        <button class="action-btn" data-line-style="dashed" type="button">Dashed</button>
        <button class="action-btn" data-line-style="center" type="button">Center</button>
        <button class="action-btn warning" data-delete-shape="1" type="button">Delete</button>
      </div>
    `;
  }

  if (shape.type === "point") {
    return `
      <div class="property-grid">
        ${fieldMarkup("X", "prop-x", "number", displayFromWorld(shape.x).toFixed(2), false, "x")}
        ${fieldMarkup("Y", "prop-y", "number", displayFromWorld(shape.y).toFixed(2), false, "y")}
      </div>
      <div class="action-row">
        <button class="action-btn warning" data-delete-shape="1" type="button">Delete</button>
      </div>
    `;
  }

  if (shape.type === "circle") {
    return `
      <div class="property-grid">
        ${fieldMarkup("Center X", "prop-cx", "number", displayFromWorld(shape.cx).toFixed(2), false, "cx")}
        ${fieldMarkup("Center Y", "prop-cy", "number", displayFromWorld(shape.cy).toFixed(2), false, "cy")}
        ${fieldMarkup("Radius", "prop-r", "number", displayFromWorld(shape.r).toFixed(2), false, "r")}
        ${fieldMarkup("Diameter", "prop-diameter", "number", displayFromWorld(shape.r * 2).toFixed(2), false, "diameter")}
      </div>
      <div class="action-row">
        <button class="action-btn warning" data-delete-shape="1" type="button">Delete</button>
      </div>
    `;
  }

  if (shape.type === "arc") {
    return `
      <div class="property-grid">
        ${fieldMarkup("Center X", "prop-cx", "number", displayFromWorld(shape.cx).toFixed(2), false, "cx")}
        ${fieldMarkup("Center Y", "prop-cy", "number", displayFromWorld(shape.cy).toFixed(2), false, "cy")}
        ${fieldMarkup("Radius", "prop-r", "number", displayFromWorld(shape.r).toFixed(2), false, "r")}
        ${fieldMarkup("Start angle", "prop-startAngle", "number", normalizeAngle(shape.startAngle).toFixed(2), false, "startAngle")}
        ${fieldMarkup("End angle", "prop-endAngle", "number", normalizeAngle(shape.endAngle).toFixed(2), false, "endAngle")}
      </div>
      <div class="action-row">
        <button class="action-btn warning" data-delete-shape="1" type="button">Delete</button>
      </div>
    `;
  }

  if (shape.type === "polygon") {
    return `
      <div class="property-grid">
        ${fieldMarkup("Center X", "prop-cx", "number", displayFromWorld(shape.cx).toFixed(2), false, "cx")}
        ${fieldMarkup("Center Y", "prop-cy", "number", displayFromWorld(shape.cy).toFixed(2), false, "cy")}
        ${fieldMarkup("Radius", "prop-radius", "number", displayFromWorld(shape.radius).toFixed(2), false, "radius")}
        ${fieldMarkup("Sides", "prop-sides", "number", String(shape.sides), false, "sides")}
        ${fieldMarkup("Rotation", "prop-rotation", "number", normalizeAngle(shape.rotation).toFixed(2), false, "rotation")}
      </div>
      <div class="action-row">
        <button class="action-btn warning" data-delete-shape="1" type="button">Delete</button>
      </div>
    `;
  }

  if (shape.type === "ellipse") {
    return `
      <div class="property-grid">
        ${fieldMarkup("Center X", "prop-cx", "number", displayFromWorld(shape.cx).toFixed(2), false, "cx")}
        ${fieldMarkup("Center Y", "prop-cy", "number", displayFromWorld(shape.cy).toFixed(2), false, "cy")}
        ${fieldMarkup("Radius X", "prop-rx", "number", displayFromWorld(shape.rx).toFixed(2), false, "rx")}
        ${fieldMarkup("Radius Y", "prop-ry", "number", displayFromWorld(shape.ry).toFixed(2), false, "ry")}
        ${fieldMarkup("Rotation", "prop-rotation", "number", normalizeAngle(shape.rotation).toFixed(2), false, "rotation")}
      </div>
      <div class="action-row">
        <button class="action-btn warning" data-delete-shape="1" type="button">Delete</button>
      </div>
    `;
  }

  if (shape.type === "rectangle" || shape.type === "square" || shape.type === "rhombus" || shape.type === "parabola") {
    const width = shape.type === "square" ? shape.size : shape.width;
    const height = shape.type === "square" ? shape.size : shape.height;
    return `
      <div class="pill">${shape.type}</div>
      <div class="property-grid">
        ${fieldMarkup("Center X", "prop-cx", "number", displayFromWorld(shape.cx).toFixed(2), false, "cx")}
        ${fieldMarkup("Center Y", "prop-cy", "number", displayFromWorld(shape.cy).toFixed(2), false, "cy")}
        ${shape.type === "square" ? fieldMarkup("Side", "prop-size", "number", displayFromWorld(width).toFixed(2), false, "size") : fieldMarkup("Width", "prop-width", "number", displayFromWorld(width).toFixed(2), false, "width")}
        ${shape.type === "square" ? fieldMarkup("Rotation", "prop-rotation", "number", normalizeAngle(shape.rotation).toFixed(2), false, "rotation") : fieldMarkup("Height", "prop-height", "number", displayFromWorld(height).toFixed(2), false, "height")}
        ${shape.type === "square" ? "" : fieldMarkup("Rotation", "prop-rotation", "number", normalizeAngle(shape.rotation).toFixed(2), false, "rotation")}
      </div>
      <div class="action-row">
        <button class="action-btn warning" data-delete-shape="1" type="button">Delete</button>
      </div>
    `;
  }

  if (shape.type === "freeform") {
    return `
      <div class="empty-state">
        Freeform curves can be moved directly on the canvas. Total length: ${formatMeasure(freeformLength(shape))}.
      </div>
      <div class="action-row">
        <button class="action-btn warning" data-delete-shape="1" type="button">Delete</button>
      </div>
    `;
  }

  return `
    <div class="empty-state">
      Selected object has no editable numeric controls.
    </div>
  `;
}

function syncSelectionValues() {
  const shape = getSelectedShape();
  if (!shape) {
    return;
  }

  if (shape.type === "line") {
    syncSelectionProperty("x1", displayFromWorld(shape.x1).toFixed(2));
    syncSelectionProperty("y1", displayFromWorld(shape.y1).toFixed(2));
    syncSelectionProperty("x2", displayFromWorld(shape.x2).toFixed(2));
    syncSelectionProperty("y2", displayFromWorld(shape.y2).toFixed(2));
    syncSelectionProperty("length", displayFromWorld(lineLength(shape)).toFixed(2));
    syncSelectionProperty("angle", normalizeAngle(lineAngle(shape)).toFixed(2));
    highlightActiveLineStyle(shape.strokeStyle);
    return;
  }

  if (shape.type === "point") {
    syncSelectionProperty("x", displayFromWorld(shape.x).toFixed(2));
    syncSelectionProperty("y", displayFromWorld(shape.y).toFixed(2));
    return;
  }

  if (shape.type === "circle") {
    syncSelectionProperty("cx", displayFromWorld(shape.cx).toFixed(2));
    syncSelectionProperty("cy", displayFromWorld(shape.cy).toFixed(2));
    syncSelectionProperty("r", displayFromWorld(shape.r).toFixed(2));
    syncSelectionProperty("diameter", displayFromWorld(shape.r * 2).toFixed(2));
    return;
  }

  if (shape.type === "arc") {
    syncSelectionProperty("cx", displayFromWorld(shape.cx).toFixed(2));
    syncSelectionProperty("cy", displayFromWorld(shape.cy).toFixed(2));
    syncSelectionProperty("r", displayFromWorld(shape.r).toFixed(2));
    syncSelectionProperty("startAngle", normalizeAngle(shape.startAngle).toFixed(2));
    syncSelectionProperty("endAngle", normalizeAngle(shape.endAngle).toFixed(2));
    return;
  }

  if (shape.type === "polygon") {
    syncSelectionProperty("cx", displayFromWorld(shape.cx).toFixed(2));
    syncSelectionProperty("cy", displayFromWorld(shape.cy).toFixed(2));
    syncSelectionProperty("radius", displayFromWorld(shape.radius).toFixed(2));
    syncSelectionProperty("sides", String(shape.sides));
    syncSelectionProperty("rotation", normalizeAngle(shape.rotation).toFixed(2));
    return;
  }

  if (shape.type === "ellipse") {
    syncSelectionProperty("cx", displayFromWorld(shape.cx).toFixed(2));
    syncSelectionProperty("cy", displayFromWorld(shape.cy).toFixed(2));
    syncSelectionProperty("rx", displayFromWorld(shape.rx).toFixed(2));
    syncSelectionProperty("ry", displayFromWorld(shape.ry).toFixed(2));
    syncSelectionProperty("rotation", normalizeAngle(shape.rotation).toFixed(2));
    return;
  }

  if (shape.type === "rectangle" || shape.type === "square" || shape.type === "rhombus" || shape.type === "parabola") {
    syncSelectionProperty("cx", displayFromWorld(shape.cx).toFixed(2));
    syncSelectionProperty("cy", displayFromWorld(shape.cy).toFixed(2));
    if (shape.type === "square") {
      syncSelectionProperty("size", displayFromWorld(shape.size).toFixed(2));
    } else {
      syncSelectionProperty("width", displayFromWorld(shape.width).toFixed(2));
      syncSelectionProperty("height", displayFromWorld(shape.height).toFixed(2));
    }
    syncSelectionProperty("rotation", normalizeAngle(shape.rotation).toFixed(2));
  }
}

function renderConstraintsPanel(force = false) {
  const selectedShape = getSelectedShape();
  const selectedKey = selectedShape ? `${selectedShape.id}-${selectedShape.type}` : "none";
  const nextKey = `${selectedKey}-${state.referenceLineId ?? "none"}`;
  if (force || state.ui.constraintsKey !== nextKey) {
    state.ui.constraintsKey = nextKey;
    elements.constraintsPanel.innerHTML = buildConstraintsMarkup(selectedShape);
  }
}

function buildConstraintsMarkup(shape) {
  const reference = getShapeById(state.referenceLineId);
  const referenceSummary = reference
    ? `<div class="pill">Reference line: ${reference.id.slice(-4)} | ${formatMeasure(lineLength(reference))} @ ${formatAngle(lineAngle(reference))}</div>`
    : `<div class="empty-state">No reference line selected. Pick a line and mark it as the constraint reference.</div>`;

  if (!shape || shape.type !== "line") {
    return `
      ${referenceSummary}
      <div class="empty-state">
        Select a line to apply horizontal, vertical, equal-length, parallel, or perpendicular constraints.
      </div>
    `;
  }

  return `
    ${referenceSummary}
    <div class="constraint-grid">
      <button class="mini-btn ${shape.constraints?.orientation === "horizontal" ? "is-active" : ""}" data-constraint-action="orientation-horizontal" type="button">Horizontal</button>
      <button class="mini-btn ${shape.constraints?.orientation === "vertical" ? "is-active" : ""}" data-constraint-action="orientation-vertical" type="button">Vertical</button>
      <button class="mini-btn ${state.referenceLineId === shape.id ? "is-active" : ""}" data-constraint-action="mark-reference" type="button">Set reference</button>
      <button class="mini-btn" data-constraint-action="clear-orientation" type="button">Clear axis</button>
      <button class="mini-btn" data-constraint-action="parallel" type="button">Parallel</button>
      <button class="mini-btn" data-constraint-action="perpendicular" type="button">Perpendicular</button>
      <button class="mini-btn" data-constraint-action="equal-length" type="button">Equal length</button>
      <button class="mini-btn" data-constraint-action="clear-relation" type="button">Clear relation</button>
    </div>
    <div class="empty-state">
      Current relation: ${shape.constraints?.relation || "none"}${shape.constraints?.targetId ? ` to ${shape.constraints.targetId.slice(-4)}` : ""}
    </div>
  `;
}

function handleToolPanelClick(event) {
  const axisButton = event.target.closest("[data-axis-lock]");
  if (!axisButton) {
    return;
  }

  const value = axisButton.dataset.axisLock;
  state.axisLock = value === "free" ? null : value;

  if (state.draft && LINE_TOOL_SET.has(state.activeTool)) {
    state.draft.current = enforceAxisLock(state.draft.anchor, state.draft.current);
  }

  render(true);
}

function handleToolPanelInput(event) {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) {
    return;
  }

  if (!state.draft && !(state.activeTool === "polygon" && input.id === "draft-sides")) {
    return;
  }

  const value = Number(input.value);
  if (Number.isNaN(value) && input.id !== "draft-sides") {
    return;
  }

  if (input.id === "draft-sides") {
    const sides = clamp(Math.round(Number(input.value) || state.defaultPolygonSides), 3, 12);
    state.defaultPolygonSides = sides;
    if (state.draft?.tool === "polygon") {
      state.draft.sides = sides;
    }
    render(false);
    return;
  }

  const draft = state.draft;
  if (!draft) {
    return;
  }

  if (LINE_TOOL_SET.has(state.activeTool)) {
    const lengthValue = getInputNumber("draft-length", displayFromWorld(distance(draft.anchor, draft.current)));
    const angleValue = getInputNumber("draft-angle", normalizeAngle(angleBetween(draft.anchor, draft.current)));
    draft.current = polarPoint(draft.anchor, worldFromDisplay(lengthValue), angleValue);
    draft.current = enforceAxisLock(draft.anchor, draft.current);
    render(false);
    return;
  }

  if (state.activeTool === "circle") {
    const radius = Math.max(0.1, worldFromDisplay(getInputNumber("draft-radius", currentDraftRadius(draft))));
    draft.current = polarPoint(draft.center, radius, angleBetween(draft.center, draft.current));
    render(false);
    return;
  }

  if (state.activeTool === "polygon") {
    const radius = Math.max(0.1, worldFromDisplay(getInputNumber("draft-radius", currentDraftRadius(draft))));
    const rotation = getInputNumber("draft-rotation", angleBetween(draft.center, draft.current));
    draft.current = polarPoint(draft.center, radius, rotation);
    draft.sides = clamp(Math.round(getInputNumber("draft-sides", draft.sides)), 3, 12);
    render(false);
    return;
  }

  if (state.activeTool === "arc") {
    const radius = Math.max(0.1, worldFromDisplay(getInputNumber("draft-radius", currentDraftRadius(draft))));
    const startAngle = getInputNumber("draft-start-angle", draft.stage === 0 ? angleBetween(draft.center, draft.current) : draft.startAngle);
    if (draft.stage === 0) {
      draft.current = polarPoint(draft.center, radius, startAngle);
    } else {
      draft.radius = radius;
      draft.startAngle = startAngle;
      draft.endAngle = getInputNumber("draft-end-angle", draft.endAngle);
    }
    render(false);
    return;
  }

  if (BOX_TOOL_SET.has(state.activeTool)) {
    const metrics = getBoxDraftMetrics(draft, state.activeTool);
    const width = state.activeTool === "square"
      ? Math.max(0.1, worldFromDisplay(getInputNumber("draft-side", displayFromWorld(metrics.width))))
      : Math.max(0.1, worldFromDisplay(getInputNumber("draft-width", displayFromWorld(metrics.width))));
    const height = state.activeTool === "square"
      ? width
      : Math.max(0.1, worldFromDisplay(getInputNumber("draft-height", displayFromWorld(metrics.height))));
    const signX = Math.sign(draft.current.x - draft.anchor.x) || 1;
    const signY = Math.sign(draft.current.y - draft.anchor.y) || 1;
    draft.current = {
      x: draft.anchor.x + width * signX,
      y: draft.anchor.y + height * signY
    };
    render(false);
  }
}

function handleSelectionPanelClick(event) {
  const deleteButton = event.target.closest("[data-delete-shape]");
  if (deleteButton) {
    deleteSelectedShape();
    return;
  }

  const styleButton = event.target.closest("[data-line-style]");
  if (!styleButton) {
    return;
  }

  const shape = getSelectedShape();
  if (!shape || shape.type !== "line") {
    return;
  }

  shape.strokeStyle = styleButton.dataset.lineStyle;
  commitAfterMutation();
}

function handleSelectionPanelInput(event) {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || !input.dataset.prop) {
    return;
  }

  const shape = getSelectedShape();
  if (!shape) {
    return;
  }

  const prop = input.dataset.prop;
  const value = Number(input.value);
  if (Number.isNaN(value)) {
    return;
  }

  applyShapeProperty(shape, prop, value);
  sanitizeRelations();
  resolveAllConstraints();

  if (event.type === "change") {
    commitHistory();
  }

  render(false);
}

function handleConstraintPanelClick(event) {
  const button = event.target.closest("[data-constraint-action]");
  if (!button) {
    return;
  }

  const action = button.dataset.constraintAction;
  const shape = getSelectedShape();
  if (!shape || shape.type !== "line") {
    return;
  }

  shape.constraints = shape.constraints || {
    orientation: null,
    relation: null,
    targetId: null
  };

  if (action === "mark-reference") {
    state.referenceLineId = shape.id;
    render(true);
    return;
  }

  if (action === "orientation-horizontal") {
    shape.constraints.orientation = "horizontal";
  } else if (action === "orientation-vertical") {
    shape.constraints.orientation = "vertical";
  } else if (action === "clear-orientation") {
    shape.constraints.orientation = null;
  } else if (action === "parallel" || action === "perpendicular" || action === "equal-length") {
    if (!state.referenceLineId || state.referenceLineId === shape.id) {
      return;
    }
    shape.constraints.relation = action === "equal-length" ? "equalLength" : action;
    shape.constraints.targetId = state.referenceLineId;
  } else if (action === "clear-relation") {
    shape.constraints.relation = null;
    shape.constraints.targetId = null;
  }

  resolveAllConstraints();
  commitAfterMutation();
}

function handlePointerDown(event) {
  if (event.button !== 0 && event.button !== 1) {
    return;
  }

  const isPanning = shouldPan(event);
  const worldPoint = clientToWorld(event.clientX, event.clientY);
  const snapped = getSnappedPoint(worldPoint, getSnapContext());
  state.pointer = snapped.point;
  state.snapPreview = snapped.preview;

  if (isPanning) {
    state.interaction = {
      type: "pan",
      startClient: { x: event.clientX, y: event.clientY },
      startOffset: cloneValue(state.offset)
    };
    updateCursor();
    return;
  }

  if (state.activeTool === "select") {
    const shapeId = getShapeIdFromEvent(event);
    if (!shapeId) {
      state.selectedId = null;
      render(true);
      return;
    }

    state.selectedId = shapeId;
    const selectedShape = getSelectedShape();
    state.interaction = {
      type: "move-shape",
      shapeId,
      startWorld: worldPoint,
      snapshot: cloneValue(selectedShape)
    };
    updateCursor();
    render(true);
    return;
  }

  if (state.activeTool === "point") {
    addShape({
      id: uid("point"),
      type: "point",
      x: snapped.point.x,
      y: snapped.point.y
    });
    return;
  }

  if (state.activeTool === "freeform") {
    state.draft = {
      tool: "freeform",
      points: [snapped.point, snapped.point]
    };
    state.interaction = {
      type: "freeform"
    };
    updateCursor();
    render(true);
    return;
  }

  if (!state.draft || state.draft.tool !== state.activeTool) {
    state.draft = createDraft(snapped.point);
  } else {
    finalizeDraftClick(snapped.point);
  }

  render(true);
}

function handlePointerMove(event) {
  const worldPoint = clientToWorld(event.clientX, event.clientY);
  const snapped = getSnappedPoint(worldPoint, getSnapContext());
  state.pointer = snapped.point;
  state.snapPreview = snapped.preview;

  if (state.interaction?.type === "pan") {
    const dx = event.clientX - state.interaction.startClient.x;
    const dy = event.clientY - state.interaction.startClient.y;
    state.offset = {
      x: state.interaction.startOffset.x + dx,
      y: state.interaction.startOffset.y + dy
    };
    render(false);
    return;
  }

  if (state.interaction?.type === "move-shape") {
    const shape = getShapeById(state.interaction.shapeId);
    if (!shape) {
      return;
    }

    const base = cloneValue(state.interaction.snapshot);
    const dx = worldPoint.x - state.interaction.startWorld.x;
    const dy = worldPoint.y - state.interaction.startWorld.y;
    translateShape(base, dx, dy);
    replaceShape(base);
    resolveAllConstraints();
    render(false);
    return;
  }

  if (state.interaction?.type === "freeform" && state.draft?.tool === "freeform") {
    const lastPoint = state.draft.points[state.draft.points.length - 1];
    if (!lastPoint || distance(lastPoint, snapped.point) > 1.2 / state.zoom) {
      state.draft.points.push(snapped.point);
    } else {
      state.draft.points[state.draft.points.length - 1] = snapped.point;
    }
    render(false);
    return;
  }

  if (state.draft) {
    updateDraftPoint(snapped.point);
    render(false);
    return;
  }

  render(false);
}

function handlePointerUp() {
  const activeInteraction = state.interaction;
  state.interaction = null;
  updateCursor();

  if (activeInteraction?.type === "move-shape") {
    commitHistory();
    render(true);
    return;
  }

  if (activeInteraction?.type === "freeform" && state.draft?.tool === "freeform") {
    const freeformShape = shapeFromDraft(state.draft);
    state.draft = null;
    if (freeformShape) {
      addShape(freeformShape);
    } else {
      render(true);
    }
  }
}

function handleWheel(event) {
  event.preventDefault();
  const rect = elements.surface.getBoundingClientRect();
  const cursor = {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
  const before = clientToWorld(event.clientX, event.clientY);
  const scaleFactor = event.deltaY < 0 ? 1.1 : 0.91;
  state.zoom = clamp(state.zoom * scaleFactor, 0.2, 5.5);
  state.offset = {
    x: cursor.x - before.x * state.zoom,
    y: cursor.y - before.y * state.zoom
  };
  updateCursor();
  render(false);
}

function handleKeyDown(event) {
  const tagName = document.activeElement?.tagName;
  const typing = tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT";

  if (event.code === "Space" && !typing) {
    event.preventDefault();
    state.spacePan = true;
    updateCursor(true);
    return;
  }

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
    event.preventDefault();
    if (event.shiftKey) {
      redo();
    } else {
      undo();
    }
    return;
  }

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
    event.preventDefault();
    redo();
    return;
  }

  if (typing) {
    if (event.key === "Escape") {
      document.activeElement.blur();
    }
    return;
  }

  if (event.key === "Delete" || event.key === "Backspace") {
    event.preventDefault();
    deleteSelectedShape();
    return;
  }

  if (event.key === "Escape") {
    if (state.draft) {
      state.draft = null;
    } else {
      state.selectedId = null;
    }
    render(true);
    return;
  }

  if (event.key === "Enter" && state.draft) {
    event.preventDefault();
    if (state.draft.tool === "arc" && state.draft.stage === 0) {
      finalizeDraftClick(state.draft.current);
    } else {
      commitDraft();
    }
    return;
  }

  if (event.key.toLowerCase() === "h" && LINE_TOOL_SET.has(state.activeTool)) {
    state.axisLock = state.axisLock === "horizontal" ? null : "horizontal";
    render(true);
    return;
  }

  if (event.key.toLowerCase() === "j" && LINE_TOOL_SET.has(state.activeTool)) {
    state.axisLock = state.axisLock === "vertical" ? null : "vertical";
    render(true);
    return;
  }

  const shortcutTool = TOOL_SHORTCUTS[event.key.toLowerCase()];
  if (shortcutTool) {
    event.preventDefault();
    setTool(shortcutTool);
  }
}

function handleKeyUp(event) {
  if (event.code === "Space") {
    state.spacePan = false;
    updateCursor();
  }
}

function shouldPan(event) {
  return event.button === 1 || state.spacePan || event.shiftKey && state.activeTool === "select";
}

function updateCursor(forcePan = false) {
  if (state.interaction?.type === "pan") {
    elements.surface.style.cursor = "grabbing";
    return;
  }

  if (state.spacePan || forcePan) {
    elements.surface.style.cursor = "grab";
    return;
  }

  if (state.interaction?.type === "move-shape") {
    elements.surface.style.cursor = "move";
    return;
  }

  elements.surface.style.cursor = state.activeTool === "select" ? "default" : "crosshair";
}

function createDraft(point) {
  if (LINE_TOOL_SET.has(state.activeTool)) {
    return {
      tool: state.activeTool,
      anchor: point,
      current: point
    };
  }

  if (BOX_TOOL_SET.has(state.activeTool)) {
    return {
      tool: state.activeTool,
      anchor: point,
      current: point
    };
  }

  if (state.activeTool === "circle") {
    return {
      tool: "circle",
      center: point,
      current: point
    };
  }

  if (state.activeTool === "polygon") {
    return {
      tool: "polygon",
      center: point,
      current: point,
      sides: state.defaultPolygonSides
    };
  }

  if (state.activeTool === "arc") {
    return {
      tool: "arc",
      center: point,
      current: point,
      radius: 0,
      startAngle: 0,
      endAngle: 90,
      stage: 0
    };
  }

  return null;
}

function finalizeDraftClick(point) {
  if (!state.draft) {
    return;
  }

  updateDraftPoint(point);

  if (state.draft.tool === "arc") {
    if (state.draft.stage === 0) {
      state.draft.radius = distance(state.draft.center, state.draft.current);
      state.draft.startAngle = normalizeAngle(angleBetween(state.draft.center, state.draft.current));
      state.draft.endAngle = normalizeAngle(state.draft.startAngle + 90);
      state.draft.stage = 1;
      render(true);
      return;
    }
  }

  commitDraft();
}

function updateDraftPoint(point) {
  if (!state.draft) {
    return;
  }

  if (state.draft.tool === "arc") {
    if (state.draft.stage === 0) {
      state.draft.current = point;
    } else {
      state.draft.endAngle = normalizeAngle(angleBetween(state.draft.center, point));
    }
    return;
  }

  if (state.draft.tool === "freeform") {
    state.draft.points.push(point);
    return;
  }

  if (LINE_TOOL_SET.has(state.draft.tool)) {
    state.draft.current = enforceAxisLock(state.draft.anchor, point);
    return;
  }

  state.draft.current = point;
}

function commitDraft() {
  const shape = shapeFromDraft(state.draft);
  state.draft = null;
  if (!shape) {
    render(true);
    return;
  }
  addShape(shape);
}

function addShape(shape) {
  state.shapes.push(withDefaultConstraints(shape));
  state.selectedId = shape.id;
  sanitizeRelations();
  resolveAllConstraints();
  commitHistory();
  render(true);
}

function withDefaultConstraints(shape) {
  if (shape.type === "line" && !shape.constraints) {
    shape.constraints = {
      orientation: null,
      relation: null,
      targetId: null
    };
  }
  return shape;
}

function shapeFromDraft(draft) {
  if (!draft) {
    return null;
  }

  if (LINE_TOOL_SET.has(draft.tool)) {
    const style = draft.tool === "dashedLine" ? "dashed" : draft.tool === "centerLine" ? "center" : "solid";
    if (distance(draft.anchor, draft.current) < 0.001) {
      return null;
    }
    return {
      id: uid("line"),
      type: "line",
      strokeStyle: style,
      x1: draft.anchor.x,
      y1: draft.anchor.y,
      x2: draft.current.x,
      y2: draft.current.y
    };
  }

  if (draft.tool === "circle") {
    const radius = distance(draft.center, draft.current);
    if (radius < 0.001) {
      return null;
    }
    return {
      id: uid("circle"),
      type: "circle",
      cx: draft.center.x,
      cy: draft.center.y,
      r: radius
    };
  }

  if (draft.tool === "ellipse") {
    const box = anchorBox(draft.anchor, draft.current);
    if (box.width < 0.001 || box.height < 0.001) {
      return null;
    }
    return {
      id: uid("ellipse"),
      type: "ellipse",
      cx: box.cx,
      cy: box.cy,
      rx: box.width / 2,
      ry: box.height / 2,
      rotation: 0
    };
  }

  if (draft.tool === "rectangle") {
    const box = anchorBox(draft.anchor, draft.current);
    if (box.width < 0.001 || box.height < 0.001) {
      return null;
    }
    return {
      id: uid("rect"),
      type: "rectangle",
      cx: box.cx,
      cy: box.cy,
      width: box.width,
      height: box.height,
      rotation: 0
    };
  }

  if (draft.tool === "square") {
    const dx = draft.current.x - draft.anchor.x;
    const dy = draft.current.y - draft.anchor.y;
    const side = Math.max(Math.abs(dx), Math.abs(dy));
    if (side < 0.001) {
      return null;
    }
    const end = {
      x: draft.anchor.x + (Math.sign(dx) || 1) * side,
      y: draft.anchor.y + (Math.sign(dy) || 1) * side
    };
    const box = anchorBox(draft.anchor, end);
    return {
      id: uid("square"),
      type: "square",
      cx: box.cx,
      cy: box.cy,
      size: box.width,
      rotation: 0
    };
  }

  if (draft.tool === "rhombus") {
    const box = anchorBox(draft.anchor, draft.current);
    if (box.width < 0.001 || box.height < 0.001) {
      return null;
    }
    return {
      id: uid("rhombus"),
      type: "rhombus",
      cx: box.cx,
      cy: box.cy,
      width: box.width,
      height: box.height,
      rotation: 0
    };
  }

  if (draft.tool === "polygon") {
    const radius = distance(draft.center, draft.current);
    if (radius < 0.001) {
      return null;
    }
    return {
      id: uid("polygon"),
      type: "polygon",
      cx: draft.center.x,
      cy: draft.center.y,
      radius,
      sides: clamp(Math.round(draft.sides), 3, 12),
      rotation: angleBetween(draft.center, draft.current)
    };
  }

  if (draft.tool === "parabola") {
    const box = anchorBox(draft.anchor, draft.current);
    if (box.width < 0.001 || box.height < 0.001) {
      return null;
    }
    return {
      id: uid("parabola"),
      type: "parabola",
      cx: box.cx,
      cy: box.cy,
      width: box.width,
      height: box.height,
      rotation: 0
    };
  }

  if (draft.tool === "freeform") {
    const points = simplifyPoints(draft.points);
    if (points.length < 2) {
      return null;
    }
    return {
      id: uid("curve"),
      type: "freeform",
      points
    };
  }

  if (draft.tool === "arc") {
    if (draft.stage === 0 || draft.radius < 0.001) {
      return null;
    }
    return {
      id: uid("arc"),
      type: "arc",
      cx: draft.center.x,
      cy: draft.center.y,
      r: draft.radius,
      startAngle: normalizeAngle(draft.startAngle),
      endAngle: normalizeAngle(draft.endAngle)
    };
  }

  return null;
}

function buildShapeGroup(shape, options = {}) {
  const group = createSvgElement("g", shape.id ? { "data-shape-id": shape.id } : {});
  const isDraft = Boolean(options.isDraft);
  const selected = !isDraft && !options.exportMode && state.selectedId === shape.id;
  const reference = !isDraft && !options.exportMode && state.referenceLineId === shape.id;
  const classNames = ["shape"];

  if (isDraft) {
    classNames.push("draft-guide");
  }
  if (selected) {
    classNames.push("selected");
  }
  if (reference) {
    classNames.push("reference");
  }

  if (shape.type === "line") {
    const hitLine = createSvgElement("line", {
      x1: shape.x1,
      y1: shape.y1,
      x2: shape.x2,
      y2: shape.y2,
      stroke: "rgba(0,0,0,0.001)",
      "stroke-width": 18 / state.zoom,
      "vector-effect": "non-scaling-stroke"
    });
    const line = createSvgElement("line", {
      x1: shape.x1,
      y1: shape.y1,
      x2: shape.x2,
      y2: shape.y2,
      class: `${classNames.join(" ")} ${shape.strokeStyle === "dashed" ? "dashed-line" : shape.strokeStyle === "center" ? "center-line" : ""}`.trim()
    });
    group.append(hitLine, line);
    return group;
  }

  if (shape.type === "point") {
    const marker = createSvgElement("circle", {
      cx: shape.x,
      cy: shape.y,
      r: 4 / state.zoom,
      class: `${classNames.join(" ")} point-mark`.trim()
    });
    group.appendChild(marker);
    return group;
  }

  if (shape.type === "circle") {
    const hitCircle = createSvgElement("circle", {
      cx: shape.cx,
      cy: shape.cy,
      r: shape.r,
      fill: "rgba(0,0,0,0.001)",
      stroke: "rgba(0,0,0,0.001)",
      "stroke-width": 18 / state.zoom
    });
    const circle = createSvgElement("circle", {
      cx: shape.cx,
      cy: shape.cy,
      r: shape.r,
      class: classNames.join(" ")
    });
    group.append(hitCircle, circle);
    return group;
  }

  if (shape.type === "ellipse") {
    const hitEllipse = createSvgElement("ellipse", {
      cx: shape.cx,
      cy: shape.cy,
      rx: shape.rx,
      ry: shape.ry,
      transform: `rotate(${shape.rotation} ${shape.cx} ${shape.cy})`,
      fill: "rgba(0,0,0,0.001)",
      stroke: "rgba(0,0,0,0.001)",
      "stroke-width": 18 / state.zoom
    });
    const ellipse = createSvgElement("ellipse", {
      cx: shape.cx,
      cy: shape.cy,
      rx: shape.rx,
      ry: shape.ry,
      transform: `rotate(${shape.rotation} ${shape.cx} ${shape.cy})`,
      class: classNames.join(" ")
    });
    group.append(hitEllipse, ellipse);
    return group;
  }

  if (shape.type === "rectangle") {
    const rect = createSvgElement("rect", {
      x: shape.cx - shape.width / 2,
      y: shape.cy - shape.height / 2,
      width: shape.width,
      height: shape.height,
      transform: `rotate(${shape.rotation} ${shape.cx} ${shape.cy})`,
      class: classNames.join(" "),
      fill: "rgba(0,0,0,0.001)"
    });
    group.appendChild(rect);
    return group;
  }

  if (shape.type === "square") {
    const square = createSvgElement("rect", {
      x: shape.cx - shape.size / 2,
      y: shape.cy - shape.size / 2,
      width: shape.size,
      height: shape.size,
      transform: `rotate(${shape.rotation} ${shape.cx} ${shape.cy})`,
      class: classNames.join(" "),
      fill: "rgba(0,0,0,0.001)"
    });
    group.appendChild(square);
    return group;
  }

  if (shape.type === "rhombus") {
    const rhombus = createSvgElement("path", {
      d: pathFromPoints(rhombusPoints(shape), true),
      class: classNames.join(" "),
      fill: "rgba(0,0,0,0.001)"
    });
    group.appendChild(rhombus);
    return group;
  }

  if (shape.type === "polygon") {
    const polygon = createSvgElement("path", {
      d: pathFromPoints(polygonPoints(shape), true),
      class: classNames.join(" "),
      fill: "rgba(0,0,0,0.001)"
    });
    group.appendChild(polygon);
    return group;
  }

  if (shape.type === "parabola") {
    const parabola = createSvgElement("path", {
      d: parabolaPath(shape),
      class: classNames.join(" "),
      fill: "none"
    });
    group.appendChild(parabola);
    return group;
  }

  if (shape.type === "freeform") {
    const freeform = createSvgElement("path", {
      d: pathFromPoints(shape.points, false),
      class: classNames.join(" "),
      fill: "none"
    });
    group.appendChild(freeform);
    return group;
  }

  if (shape.type === "arc") {
    const hitArc = createSvgElement("path", {
      d: arcPath(shape),
      fill: "none",
      stroke: "rgba(0,0,0,0.001)",
      "stroke-width": 18 / state.zoom,
      "vector-effect": "non-scaling-stroke"
    });
    const arc = createSvgElement("path", {
      d: arcPath(shape),
      class: classNames.join(" "),
      fill: "none"
    });
    group.append(hitArc, arc);
    return group;
  }

  return group;
}

function buildMeasurementLabel(shape, zoomFactor) {
  const label = measurementForShape(shape, zoomFactor);
  if (!label) {
    return null;
  }

  return buildTextLabel(label.text, label.x, label.y, zoomFactor);
}

function buildTextLabel(text, x, y, zoomFactor) {
  return createSvgElement("text", {
    x,
    y,
    class: "measurement",
    "font-size": 12 / zoomFactor,
    "text-anchor": "middle"
  }, text);
}

function buildSnapIndicator(point, radius) {
  return createSvgElement("circle", {
    cx: point.x,
    cy: point.y,
    r: radius,
    class: "snap-indicator"
  });
}

function measurementForShape(shape, zoomScale = state.zoom) {
  if (shape.type === "line") {
    const mid = midpoint({ x: shape.x1, y: shape.y1 }, { x: shape.x2, y: shape.y2 });
    const angle = angleBetween({ x: shape.x1, y: shape.y1 }, { x: shape.x2, y: shape.y2 });
    const normal = {
      x: Math.cos(degToRad(angle + 90)) * (14 / zoomScale),
      y: Math.sin(degToRad(angle + 90)) * (14 / zoomScale)
    };
    return {
      text: `L ${formatMeasure(lineLength(shape))} | ${formatAngle(angle)}`,
      x: mid.x + normal.x,
      y: mid.y + normal.y
    };
  }

  if (shape.type === "point") {
    return {
      text: `P ${formatCoordinate(shape.x)}, ${formatCoordinate(shape.y)}`,
      x: shape.x,
      y: shape.y - 14 / zoomScale
    };
  }

  if (shape.type === "circle") {
    return {
      text: `R ${formatMeasure(shape.r)} | Ø ${formatMeasure(shape.r * 2)}`,
      x: shape.cx,
      y: shape.cy - shape.r - 14 / zoomScale
    };
  }

  if (shape.type === "ellipse") {
    return {
      text: `Rx ${formatMeasure(shape.rx)} | Ry ${formatMeasure(shape.ry)}`,
      x: shape.cx,
      y: shape.cy - shape.ry - 14 / zoomScale
    };
  }

  if (shape.type === "rectangle") {
    return {
      text: `W ${formatMeasure(shape.width)} | H ${formatMeasure(shape.height)}`,
      x: shape.cx,
      y: shape.cy - shape.height / 2 - 14 / zoomScale
    };
  }

  if (shape.type === "square") {
    return {
      text: `S ${formatMeasure(shape.size)}`,
      x: shape.cx,
      y: shape.cy - shape.size / 2 - 14 / zoomScale
    };
  }

  if (shape.type === "rhombus") {
    return {
      text: `W ${formatMeasure(shape.width)} | H ${formatMeasure(shape.height)}`,
      x: shape.cx,
      y: shape.cy - shape.height / 2 - 14 / zoomScale
    };
  }

  if (shape.type === "polygon") {
    return {
      text: `${shape.sides} sides | R ${formatMeasure(shape.radius)}`,
      x: shape.cx,
      y: shape.cy - shape.radius - 14 / zoomScale
    };
  }

  if (shape.type === "parabola") {
    return {
      text: `W ${formatMeasure(shape.width)} | H ${formatMeasure(shape.height)}`,
      x: shape.cx,
      y: shape.cy - shape.height / 2 - 14 / zoomScale
    };
  }

  if (shape.type === "freeform") {
    const bounds = getShapeBounds(shape);
    return bounds
      ? {
          text: `Path ${formatMeasure(freeformLength(shape))}`,
          x: bounds.minX + (bounds.maxX - bounds.minX) / 2,
          y: bounds.minY - 14 / zoomScale
        }
      : null;
  }

  if (shape.type === "arc") {
    const sweep = normalizedSweep(shape.startAngle, shape.endAngle);
    const middleAngle = shape.startAngle + sweep / 2;
    const labelPoint = polarPoint({ x: shape.cx, y: shape.cy }, shape.r + 16 / zoomScale, middleAngle);
    return {
      text: `R ${formatMeasure(shape.r)} | ${formatAngle(sweep)}`,
      x: labelPoint.x,
      y: labelPoint.y
    };
  }

  return null;
}

function getSnapContext() {
  if (!state.draft) {
    return {
      tool: state.activeTool,
      anchor: null
    };
  }

  if (LINE_TOOL_SET.has(state.draft.tool)) {
    return {
      tool: state.draft.tool,
      anchor: state.draft.anchor
    };
  }

  if (state.draft.tool === "arc" && state.draft.stage === 0) {
    return {
      tool: "line",
      anchor: state.draft.center
    };
  }

  return {
    tool: state.draft.tool,
    anchor: null
  };
}

function getSnappedPoint(rawPoint, context) {
  const candidates = [];

  if (state.snapGrid) {
    const gridPoint = {
      x: snapNumber(rawPoint.x, state.gridSize),
      y: snapNumber(rawPoint.y, state.gridSize)
    };
    candidates.push({
      point: gridPoint,
      label: "grid",
      distance: distance(rawPoint, gridPoint)
    });
  }

  if (state.snapPoints) {
    const pointCandidate = nearestSnapPoint(rawPoint);
    if (pointCandidate) {
      candidates.push(pointCandidate);
    }
  }

  let result = rawPoint;
  let preview = null;

  if (candidates.length > 0) {
    candidates.sort((left, right) => left.distance - right.distance);
    const best = candidates[0];
    const threshold = 18 / state.zoom;
    if (best.label === "grid" || best.distance <= threshold) {
      result = best.point;
      preview = {
        point: best.point,
        label: best.label
      };
    }
  }

  if (context.anchor) {
    result = enforceAxisLock(context.anchor, result);
    const angleApplied = maybeSnapAngle(context.anchor, result);
    result = angleApplied.point;
    if (angleApplied.applied) {
      preview = {
        point: result,
        label: angleApplied.label
      };
    }
  }

  return {
    point: result,
    preview
  };
}

function maybeSnapAngle(anchor, point) {
  if (!state.snapAngles || state.axisLock) {
    return { point, applied: false, label: "free" };
  }

  const vector = {
    x: point.x - anchor.x,
    y: point.y - anchor.y
  };
  const length = Math.hypot(vector.x, vector.y);
  if (length < 0.001) {
    return { point, applied: false, label: "free" };
  }

  const rawAngle = normalizeAngle(radToDeg(Math.atan2(vector.y, vector.x)));
  const targets = [];
  for (let turn = 0; turn < 360; turn += 180) {
    ANGLE_SNAP_VALUES.forEach((value) => targets.push(normalizeAngle(value + turn)));
  }

  let bestAngle = rawAngle;
  let bestDifference = Number.POSITIVE_INFINITY;
  targets.forEach((targetAngle) => {
    const difference = shortestAngularDistance(rawAngle, targetAngle);
    if (difference < bestDifference) {
      bestDifference = difference;
      bestAngle = targetAngle;
    }
  });

  if (bestDifference <= 6) {
    return {
      point: polarPoint(anchor, length, bestAngle),
      applied: true,
      label: `angle ${bestAngle.toFixed(0)}`
    };
  }

  return {
    point,
    applied: false,
    label: "free"
  };
}

function enforceAxisLock(anchor, point) {
  if (state.axisLock === "horizontal") {
    return {
      x: point.x,
      y: anchor.y
    };
  }

  if (state.axisLock === "vertical") {
    return {
      x: anchor.x,
      y: point.y
    };
  }

  return point;
}

function nearestSnapPoint(rawPoint) {
  const snapPoints = collectSnapPoints();
  let nearest = null;
  snapPoints.forEach((candidate) => {
    const candidateDistance = distance(rawPoint, candidate.point);
    if (!nearest || candidateDistance < nearest.distance) {
      nearest = {
        point: candidate.point,
        label: candidate.label,
        distance: candidateDistance
      };
    }
  });
  return nearest;
}

function collectSnapPoints() {
  const points = [];

  state.shapes.forEach((shape) => {
    if (shape.type === "line") {
      const start = { x: shape.x1, y: shape.y1 };
      const end = { x: shape.x2, y: shape.y2 };
      points.push({ point: start, label: "endpoint" });
      points.push({ point: end, label: "endpoint" });
      points.push({ point: midpoint(start, end), label: "midpoint" });
      return;
    }

    if (shape.type === "point") {
      points.push({ point: { x: shape.x, y: shape.y }, label: "point" });
      return;
    }

    if (shape.type === "circle" || shape.type === "ellipse" || shape.type === "polygon") {
      points.push({ point: { x: shape.cx, y: shape.cy }, label: "center" });
      return;
    }

    if (shape.type === "arc") {
      points.push({ point: { x: shape.cx, y: shape.cy }, label: "center" });
      points.push({
        point: polarPoint({ x: shape.cx, y: shape.cy }, shape.r, shape.startAngle),
        label: "endpoint"
      });
      points.push({
        point: polarPoint({ x: shape.cx, y: shape.cy }, shape.r, shape.endAngle),
        label: "endpoint"
      });
      return;
    }

    const vertices = shapeVertices(shape);
    vertices.forEach((point) => points.push({ point, label: "vertex" }));
    if ("cx" in shape && "cy" in shape) {
      points.push({ point: { x: shape.cx, y: shape.cy }, label: "center" });
    }
  });

  return points;
}

function getShapeIdFromEvent(event) {
  const target = event.target;
  if (!(target instanceof Element)) {
    return null;
  }
  const group = target.closest("[data-shape-id]");
  return group ? group.getAttribute("data-shape-id") : null;
}

function clientToWorld(clientX, clientY) {
  const rect = elements.surface.getBoundingClientRect();
  return {
    x: (clientX - rect.left - state.offset.x) / state.zoom,
    y: (clientY - rect.top - state.offset.y) / state.zoom
  };
}

function applyShapeProperty(shape, prop, value) {
  if (shape.type === "line") {
    if (prop === "length") {
      const angle = lineAngle(shape);
      const endpoint = polarPoint({ x: shape.x1, y: shape.y1 }, worldFromDisplay(value), angle);
      shape.x2 = endpoint.x;
      shape.y2 = endpoint.y;
    } else if (prop === "angle") {
      const endpoint = polarPoint({ x: shape.x1, y: shape.y1 }, lineLength(shape), value);
      shape.x2 = endpoint.x;
      shape.y2 = endpoint.y;
    } else if (prop === "x1" || prop === "y1" || prop === "x2" || prop === "y2") {
      shape[prop] = worldFromDisplay(value);
    }
    resolveAllConstraints();
    return;
  }

  if (shape.type === "point") {
    shape[prop] = worldFromDisplay(value);
    return;
  }

  if (shape.type === "circle") {
    if (prop === "diameter") {
      shape.r = Math.max(0.1, worldFromDisplay(value) / 2);
    } else if (prop === "r") {
      shape.r = Math.max(0.1, worldFromDisplay(value));
    } else if (prop === "cx" || prop === "cy") {
      shape[prop] = worldFromDisplay(value);
    }
    return;
  }

  if (shape.type === "arc") {
    if (prop === "r") {
      shape.r = Math.max(0.1, worldFromDisplay(value));
    } else if (prop === "cx" || prop === "cy") {
      shape[prop] = worldFromDisplay(value);
    } else if (prop === "startAngle" || prop === "endAngle") {
      shape[prop] = normalizeAngle(value);
    }
    return;
  }

  if (shape.type === "polygon") {
    if (prop === "cx" || prop === "cy") {
      shape[prop] = worldFromDisplay(value);
    } else if (prop === "radius") {
      shape.radius = Math.max(0.1, worldFromDisplay(value));
    } else if (prop === "rotation") {
      shape.rotation = normalizeAngle(value);
    } else if (prop === "sides") {
      shape.sides = clamp(Math.round(value), 3, 12);
    }
    return;
  }

  if (shape.type === "ellipse") {
    if (prop === "cx" || prop === "cy") {
      shape[prop] = worldFromDisplay(value);
    } else if (prop === "rx" || prop === "ry") {
      shape[prop] = Math.max(0.1, worldFromDisplay(value));
    } else if (prop === "rotation") {
      shape.rotation = normalizeAngle(value);
    }
    return;
  }

  if (shape.type === "rectangle" || shape.type === "rhombus" || shape.type === "parabola") {
    if (prop === "cx" || prop === "cy") {
      shape[prop] = worldFromDisplay(value);
    } else if (prop === "width" || prop === "height") {
      shape[prop] = Math.max(0.1, worldFromDisplay(value));
    } else if (prop === "rotation") {
      shape.rotation = normalizeAngle(value);
    }
    return;
  }

  if (shape.type === "square") {
    if (prop === "cx" || prop === "cy") {
      shape[prop] = worldFromDisplay(value);
    } else if (prop === "size") {
      shape.size = Math.max(0.1, worldFromDisplay(value));
    } else if (prop === "rotation") {
      shape.rotation = normalizeAngle(value);
    }
  }
}

function translateShape(shape, dx, dy) {
  if (shape.type === "line") {
    shape.x1 += dx;
    shape.y1 += dy;
    shape.x2 += dx;
    shape.y2 += dy;
    return;
  }

  if (shape.type === "point") {
    shape.x += dx;
    shape.y += dy;
    return;
  }

  if (shape.type === "circle" || shape.type === "ellipse" || shape.type === "rectangle" || shape.type === "square" || shape.type === "rhombus" || shape.type === "polygon" || shape.type === "parabola" || shape.type === "arc") {
    shape.cx += dx;
    shape.cy += dy;
    return;
  }

  if (shape.type === "freeform") {
    shape.points = shape.points.map((point) => ({
      x: point.x + dx,
      y: point.y + dy
    }));
  }
}

function resolveAllConstraints() {
  for (let iteration = 0; iteration < 3; iteration += 1) {
    state.shapes.forEach((shape) => {
      if (shape.type === "line") {
        applyLineConstraints(shape);
      }
    });
  }
}

function applyLineConstraints(shape) {
  shape.constraints = shape.constraints || {
    orientation: null,
    relation: null,
    targetId: null
  };

  const start = { x: shape.x1, y: shape.y1 };
  let direction = {
    x: shape.x2 - shape.x1,
    y: shape.y2 - shape.y1
  };

  let lengthValue = Math.max(Math.hypot(direction.x, direction.y), 0.1);
  let unit = normalizeVector(direction);

  if (shape.constraints.relation && shape.constraints.targetId) {
    const target = getShapeById(shape.constraints.targetId);
    if (target && target.type === "line") {
      const targetDirection = normalizeVector({
        x: target.x2 - target.x1,
        y: target.y2 - target.y1
      });
      const currentDot = unit.x * targetDirection.x + unit.y * targetDirection.y;

      if (shape.constraints.relation === "parallel") {
        unit = currentDot >= 0 ? targetDirection : { x: -targetDirection.x, y: -targetDirection.y };
      } else if (shape.constraints.relation === "perpendicular") {
        const perpendicular = { x: -targetDirection.y, y: targetDirection.x };
        const perpendicularDot = unit.x * perpendicular.x + unit.y * perpendicular.y;
        unit = perpendicularDot >= 0 ? perpendicular : { x: -perpendicular.x, y: -perpendicular.y };
      } else if (shape.constraints.relation === "equalLength") {
        lengthValue = lineLength(target);
      }
    }
  }

  if (shape.constraints.orientation === "horizontal") {
    unit = { x: 1, y: 0 };
  } else if (shape.constraints.orientation === "vertical") {
    unit = { x: 0, y: 1 };
  }

  shape.x2 = start.x + unit.x * lengthValue;
  shape.y2 = start.y + unit.y * lengthValue;
}

function saveProject() {
  const payload = {
    version: 1,
    savedAt: new Date().toISOString(),
    settings: {
      units: state.units,
      gridSize: state.gridSize,
      showGrid: state.showGrid,
      showDimensions: state.showDimensions,
      snapGrid: state.snapGrid,
      snapPoints: state.snapPoints,
      snapAngles: state.snapAngles,
      defaultPolygonSides: state.defaultPolygonSides,
      zoom: state.zoom,
      offset: state.offset
    },
    referenceLineId: state.referenceLineId,
    shapes: state.shapes
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  downloadBlob(`engineering-drawing-${timestampSlug()}.json`, blob);
}

function handleProjectLoad(event) {
  const [file] = event.target.files || [];
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const parsed = JSON.parse(String(reader.result || "{}"));
      loadProjectPayload(parsed);
    } catch (error) {
      console.error(error);
      alert("The selected file could not be parsed as a drawing project.");
    } finally {
      elements.projectFileInput.value = "";
    }
  });
  reader.readAsText(file);
}

function loadProjectPayload(payload) {
  state.shapes = Array.isArray(payload.shapes) ? payload.shapes.map(withDefaultConstraints) : [];
  const settings = payload.settings || {};
  state.units = settings.units || "mm";
  state.gridSize = Math.max(1, Number(settings.gridSize) || 10);
  state.showGrid = settings.showGrid !== false;
  state.showDimensions = settings.showDimensions !== false;
  state.snapGrid = settings.snapGrid !== false;
  state.snapPoints = settings.snapPoints !== false;
  state.snapAngles = settings.snapAngles !== false;
  state.defaultPolygonSides = clamp(Math.round(settings.defaultPolygonSides || 6), 3, 12);
  state.zoom = clamp(Number(settings.zoom) || 1, 0.2, 5.5);
  state.offset = settings.offset || state.offset;
  state.referenceLineId = payload.referenceLineId || null;
  state.draft = null;
  state.selectedId = null;
  state.history = [];
  state.future = [];
  sanitizeRelations();
  resolveAllConstraints();
  updateGridPattern();
  commitHistory();
  render(true);
}

function exportSvg() {
  const svgText = buildExportSvgText();
  const blob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
  downloadBlob(`engineering-drawing-${timestampSlug()}.svg`, blob);
}

async function exportRaster(kind) {
  try {
    const { canvas } = await buildExportCanvas(2);
    canvas.toBlob((blob) => {
      if (!blob) {
        return;
      }
      downloadBlob(`engineering-drawing-${timestampSlug()}.${kind}`, blob);
    }, kind === "png" ? "image/png" : "image/jpeg");
  } catch (error) {
    console.error(error);
    alert("The drawing could not be exported.");
  }
}

async function exportPdf() {
  try {
    const { canvas } = await buildExportCanvas(2);
    const jpegDataUrl = canvas.toDataURL("image/jpeg", 0.92);
    const pdfBlob = buildPdfBlobFromJpeg(jpegDataUrl, canvas.width, canvas.height);
    downloadBlob(`engineering-drawing-${timestampSlug()}.pdf`, pdfBlob);
  } catch (error) {
    console.error(error);
    alert("The PDF export could not be created.");
  }
}

async function buildExportCanvas(scale = 2) {
  const svgText = buildExportSvgText();
  const blob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  try {
    const image = await loadImage(url);
    const bounds = getDrawingBounds(60);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bounds.width * scale));
    canvas.height = Math.max(1, Math.round(bounds.height * scale));
    const context = canvas.getContext("2d");
    context.fillStyle = "#fffdf7";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return { canvas, bounds };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function buildExportSvgText() {
  const bounds = getDrawingBounds(60);
  const exportSvg = createSvgElement("svg", {
    xmlns: SVG_NS,
    viewBox: `${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`,
    width: bounds.width,
    height: bounds.height
  });

  const defs = createSvgElement("defs");
  const minor = createSvgElement("pattern", {
    id: "minor-export-grid",
    width: state.gridSize,
    height: state.gridSize,
    patternUnits: "userSpaceOnUse"
  });
  minor.appendChild(createSvgElement("path", {
    d: `M ${state.gridSize} 0 L 0 0 0 ${state.gridSize}`,
    fill: "none",
    stroke: "rgba(42, 76, 97, 0.14)",
    "stroke-width": 0.4
  }));
  const major = createSvgElement("pattern", {
    id: "major-export-grid",
    width: state.gridSize * 5,
    height: state.gridSize * 5,
    patternUnits: "userSpaceOnUse"
  });
  major.appendChild(createSvgElement("rect", {
    width: state.gridSize * 5,
    height: state.gridSize * 5,
    fill: "url(#minor-export-grid)"
  }));
  major.appendChild(createSvgElement("path", {
    d: `M ${state.gridSize * 5} 0 L 0 0 0 ${state.gridSize * 5}`,
    fill: "none",
    stroke: "rgba(20, 42, 56, 0.25)",
    "stroke-width": 0.8
  }));
  defs.append(minor, major);
  exportSvg.appendChild(defs);

  exportSvg.appendChild(createSvgElement("rect", {
    x: bounds.minX,
    y: bounds.minY,
    width: bounds.width,
    height: bounds.height,
    fill: "#fffdf7"
  }));

  if (state.showGrid) {
    exportSvg.appendChild(createSvgElement("rect", {
      x: bounds.minX,
      y: bounds.minY,
      width: bounds.width,
      height: bounds.height,
      fill: "url(#major-export-grid)"
    }));
  }

  const geometry = createSvgElement("g");
  state.shapes.forEach((shape) => {
    geometry.appendChild(buildShapeGroup(shape, { exportMode: true }));
  });
  exportSvg.appendChild(geometry);

  if (state.showDimensions) {
    const annotations = createSvgElement("g");
    state.shapes.forEach((shape) => {
      const label = buildMeasurementLabel(shape, 1);
      if (label) {
        annotations.appendChild(label);
      }
    });
    exportSvg.appendChild(annotations);
  }

  return new XMLSerializer().serializeToString(exportSvg);
}

function buildPdfBlobFromJpeg(jpegDataUrl, imageWidth, imageHeight) {
  const jpegBase64 = jpegDataUrl.split(",")[1];
  const binary = atob(jpegBase64);
  const jpegBytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    jpegBytes[index] = binary.charCodeAt(index);
  }

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 24;
  const scale = Math.min((pageWidth - margin * 2) / imageWidth, (pageHeight - margin * 2) / imageHeight);
  const drawWidth = imageWidth * scale;
  const drawHeight = imageHeight * scale;
  const x = (pageWidth - drawWidth) / 2;
  const y = (pageHeight - drawHeight) / 2;
  const content = `q
${drawWidth.toFixed(2)} 0 0 ${drawHeight.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm
/Im0 Do
Q`;

  const chunks = [];
  const offsets = [0];
  let length = 0;

  function pushText(text) {
    const encoded = TEXT_ENCODER.encode(text);
    chunks.push(encoded);
    length += encoded.length;
  }

  function pushBytes(bytes) {
    chunks.push(bytes);
    length += bytes.length;
  }

  pushText("%PDF-1.4\n");
  pushBytes(new Uint8Array([0x25, 0xff, 0xff, 0xff, 0xff, 0x0a]));

  offsets[1] = length;
  pushText("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  offsets[2] = length;
  pushText("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
  offsets[3] = length;
  pushText(`3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth.toFixed(2)} ${pageHeight.toFixed(2)}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>
endobj
`);
  offsets[4] = length;
  pushText(`4 0 obj
<< /Type /XObject /Subtype /Image /Width ${imageWidth} /Height ${imageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>
stream
`);
  pushBytes(jpegBytes);
  pushText("\nendstream\nendobj\n");
  offsets[5] = length;
  pushText(`5 0 obj
<< /Length ${content.length} >>
stream
${content}
endstream
endobj
`);

  const xrefOffset = length;
  pushText("xref\n0 6\n0000000000 65535 f \n");
  for (let index = 1; index <= 5; index += 1) {
    pushText(`${String(offsets[index]).padStart(10, "0")} 00000 n \n`);
  }
  pushText(`trailer
<< /Size 6 /Root 1 0 R >>
startxref
${xrefOffset}
%%EOF`);

  return new Blob(chunks, { type: "application/pdf" });
}

function undo() {
  if (state.history.length <= 1) {
    return;
  }

  const current = state.history.pop();
  state.future.push(current);
  restoreSnapshot(state.history[state.history.length - 1]);
}

function redo() {
  if (state.future.length === 0) {
    return;
  }

  const snapshot = state.future.pop();
  state.history.push(cloneValue(snapshot));
  restoreSnapshot(snapshot);
}

function restoreSnapshot(snapshot) {
  const cloned = cloneValue(snapshot);
  state.shapes = cloned.shapes || [];
  state.referenceLineId = cloned.referenceLineId || null;
  state.selectedId = cloned.selectedId || null;
  state.draft = null;
  sanitizeRelations();
  render(true);
}

function commitHistory() {
  state.history.push({
    shapes: cloneValue(state.shapes),
    referenceLineId: state.referenceLineId,
    selectedId: state.selectedId
  });
  if (state.history.length > 80) {
    state.history.shift();
  }
  state.future = [];
}

function commitAfterMutation() {
  sanitizeRelations();
  resolveAllConstraints();
  commitHistory();
  render(true);
}

function deleteSelectedShape() {
  if (!state.selectedId) {
    return;
  }

  state.shapes = state.shapes.filter((shape) => shape.id !== state.selectedId);
  if (state.referenceLineId === state.selectedId) {
    state.referenceLineId = null;
  }
  state.selectedId = null;
  sanitizeRelations();
  commitHistory();
  render(true);
}

function sanitizeRelations() {
  const validIds = new Set(state.shapes.map((shape) => shape.id));
  if (state.referenceLineId && !validIds.has(state.referenceLineId)) {
    state.referenceLineId = null;
  }
  state.shapes.forEach((shape) => {
    if (shape.type !== "line") {
      return;
    }
    shape.constraints = shape.constraints || {
      orientation: null,
      relation: null,
      targetId: null
    };
    if (shape.constraints.targetId && !validIds.has(shape.constraints.targetId)) {
      shape.constraints.targetId = null;
      shape.constraints.relation = null;
    }
    if (shape.constraints.targetId === shape.id) {
      shape.constraints.targetId = null;
      shape.constraints.relation = null;
    }
  });
}

function getSelectedShape() {
  return getShapeById(state.selectedId);
}

function getShapeById(shapeId) {
  return state.shapes.find((shape) => shape.id === shapeId) || null;
}

function replaceShape(updatedShape) {
  state.shapes = state.shapes.map((shape) => (shape.id === updatedShape.id ? updatedShape : shape));
}

function getDraftAnchor(draft) {
  if (draft.anchor) {
    return draft.anchor;
  }
  if (draft.center) {
    return draft.center;
  }
  if (draft.points?.length) {
    return draft.points[0];
  }
  return { x: 0, y: 0 };
}

function selectionSummary(shape) {
  if (shape.type === "line") {
    return `${shape.strokeStyle} line | ${formatMeasure(lineLength(shape))}`;
  }
  if (shape.type === "circle") {
    return `circle | ${formatMeasure(shape.r)}`;
  }
  if (shape.type === "arc") {
    return `arc | ${formatMeasure(shape.r)}`;
  }
  if (shape.type === "point") {
    return "point";
  }
  return shape.type;
}

function getHintText() {
  if (state.draft) {
    if (state.draft.tool === "arc" && state.draft.stage === 0) {
      return "Hint: set radius and start angle, then click to move into arc sweep mode.";
    }
    if (state.draft.tool === "arc" && state.draft.stage === 1) {
      return "Hint: move to define the end angle, then click again or press Enter.";
    }
    if (state.draft.tool === "freeform") {
      return "Hint: release the mouse to finish the freeform curve.";
    }
    return "Hint: measurements update live in the right panel while you place the shape.";
  }

  if (state.activeTool === "select") {
    return "Hint: drag a selected object to move it, or use the property panel for exact edits.";
  }

  return TOOL_CONFIG[state.activeTool].hint;
}

function describeSnapMode() {
  const parts = [];
  if (state.snapGrid) {
    parts.push("grid");
  }
  if (state.snapPoints) {
    parts.push("points");
  }
  if (state.snapAngles) {
    parts.push("angles");
  }
  return parts.length ? parts.join(" + ") : "off";
}

function updateGridPattern() {
  const minor = document.getElementById("minor-grid");
  const major = document.getElementById("major-grid");
  minor.setAttribute("width", state.gridSize);
  minor.setAttribute("height", state.gridSize);
  const minorPath = minor.querySelector("path");
  minorPath.setAttribute("d", `M ${state.gridSize} 0 L 0 0 0 ${state.gridSize}`);
  major.setAttribute("width", state.gridSize * 5);
  major.setAttribute("height", state.gridSize * 5);
  major.querySelector("rect").setAttribute("width", state.gridSize * 5);
  major.querySelector("rect").setAttribute("height", state.gridSize * 5);
  major.querySelector("path").setAttribute("d", `M ${state.gridSize * 5} 0 L 0 0 0 ${state.gridSize * 5}`);
}

function getDrawingBounds(padding = 0) {
  const boundsList = state.shapes.map((shape) => getShapeBounds(shape)).filter(Boolean);
  if (boundsList.length === 0) {
    return {
      minX: -400 - padding,
      minY: -300 - padding,
      maxX: 400 + padding,
      maxY: 300 + padding,
      width: 800 + padding * 2,
      height: 600 + padding * 2
    };
  }

  const merged = boundsList.reduce((accumulator, bounds) => ({
    minX: Math.min(accumulator.minX, bounds.minX),
    minY: Math.min(accumulator.minY, bounds.minY),
    maxX: Math.max(accumulator.maxX, bounds.maxX),
    maxY: Math.max(accumulator.maxY, bounds.maxY)
  }));

  return {
    minX: merged.minX - padding,
    minY: merged.minY - padding,
    maxX: merged.maxX + padding,
    maxY: merged.maxY + padding,
    width: merged.maxX - merged.minX + padding * 2,
    height: merged.maxY - merged.minY + padding * 2
  };
}

function getShapeBounds(shape) {
  if (shape.type === "line") {
    return {
      minX: Math.min(shape.x1, shape.x2),
      minY: Math.min(shape.y1, shape.y2),
      maxX: Math.max(shape.x1, shape.x2),
      maxY: Math.max(shape.y1, shape.y2)
    };
  }

  if (shape.type === "point") {
    return {
      minX: shape.x,
      minY: shape.y,
      maxX: shape.x,
      maxY: shape.y
    };
  }

  if (shape.type === "circle") {
    return {
      minX: shape.cx - shape.r,
      minY: shape.cy - shape.r,
      maxX: shape.cx + shape.r,
      maxY: shape.cy + shape.r
    };
  }

  if (shape.type === "ellipse") {
    return boundsFromPoints(shapeVertices(shape));
  }

  if (shape.type === "rectangle" || shape.type === "square" || shape.type === "rhombus" || shape.type === "polygon" || shape.type === "parabola") {
    return boundsFromPoints(shapeVertices(shape));
  }

  if (shape.type === "freeform") {
    return boundsFromPoints(shape.points);
  }

  if (shape.type === "arc") {
    const points = [
      polarPoint({ x: shape.cx, y: shape.cy }, shape.r, shape.startAngle),
      polarPoint({ x: shape.cx, y: shape.cy }, shape.r, shape.endAngle)
    ];
    [0, 90, 180, 270].forEach((candidateAngle) => {
      if (isAngleOnArc(candidateAngle, shape.startAngle, shape.endAngle)) {
        points.push(polarPoint({ x: shape.cx, y: shape.cy }, shape.r, candidateAngle));
      }
    });
    return boundsFromPoints(points);
  }

  return null;
}

function fieldMarkup(label, id, type, value, disabled, prop = "") {
  return `
    <label class="field ${disabled ? "is-disabled" : ""}">
      <span>${label}</span>
      <input
        id="${id}"
        ${prop ? `data-prop="${prop}"` : ""}
        type="${type}"
        value="${value}"
        ${disabled ? "disabled" : ""}
        step="${type === "number" ? "0.01" : "1"}"
      />
    </label>
  `;
}

function highlightActiveLineStyle(style) {
  elements.selectionPanel.querySelectorAll("[data-line-style]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.lineStyle === style);
  });
}

function syncInputValue(id, value) {
  const input = document.getElementById(id);
  if (!(input instanceof HTMLInputElement) || document.activeElement === input) {
    return;
  }
  input.value = value;
}

function syncSelectionProperty(prop, value) {
  const input = elements.selectionPanel.querySelector(`[data-prop="${prop}"]`);
  if (!(input instanceof HTMLInputElement) || document.activeElement === input) {
    return;
  }
  input.value = value;
}

function getInputNumber(id, fallback) {
  const input = document.getElementById(id);
  if (!(input instanceof HTMLInputElement)) {
    return fallback;
  }
  const value = Number(input.value);
  return Number.isNaN(value) ? fallback : value;
}

function currentDraftRadius(draft) {
  if (!draft) {
    return null;
  }
  if (draft.tool === "circle" || draft.tool === "polygon") {
    return displayFromWorld(distance(draft.center, draft.current));
  }
  if (draft.tool === "arc") {
    return displayFromWorld(draft.stage === 0 ? distance(draft.center, draft.current) : draft.radius);
  }
  return null;
}

function getBoxDraftMetrics(draft, tool) {
  if (!draft) {
    return {
      width: 0,
      height: 0,
      rotation: 0
    };
  }

  const width = Math.abs(draft.current.x - draft.anchor.x);
  const height = Math.abs(draft.current.y - draft.anchor.y);
  if (tool === "square") {
    const size = Math.max(width, height);
    return {
      width: size,
      height: size,
      rotation: 0
    };
  }

  return {
    width,
    height,
    rotation: 0
  };
}

function lineLength(shape) {
  return Math.hypot(shape.x2 - shape.x1, shape.y2 - shape.y1);
}

function lineAngle(shape) {
  return angleBetween({ x: shape.x1, y: shape.y1 }, { x: shape.x2, y: shape.y2 });
}

function freeformLength(shape) {
  let total = 0;
  for (let index = 1; index < shape.points.length; index += 1) {
    total += distance(shape.points[index - 1], shape.points[index]);
  }
  return total;
}

function anchorBox(anchor, current) {
  const minX = Math.min(anchor.x, current.x);
  const minY = Math.min(anchor.y, current.y);
  const maxX = Math.max(anchor.x, current.x);
  const maxY = Math.max(anchor.y, current.y);
  return {
    minX,
    minY,
    maxX,
    maxY,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    width: maxX - minX,
    height: maxY - minY
  };
}

function polygonPoints(shape) {
  const points = [];
  for (let index = 0; index < shape.sides; index += 1) {
    const angle = shape.rotation + (360 / shape.sides) * index;
    points.push(polarPoint({ x: shape.cx, y: shape.cy }, shape.radius, angle));
  }
  return points;
}

function rhombusPoints(shape) {
  const points = [
    { x: shape.cx, y: shape.cy - shape.height / 2 },
    { x: shape.cx + shape.width / 2, y: shape.cy },
    { x: shape.cx, y: shape.cy + shape.height / 2 },
    { x: shape.cx - shape.width / 2, y: shape.cy }
  ];
  return points.map((point) => rotatePoint(point, { x: shape.cx, y: shape.cy }, shape.rotation));
}

function parabolaPath(shape) {
  const segments = [];
  const sampleCount = 40;
  for (let index = 0; index <= sampleCount; index += 1) {
    const t = index / sampleCount;
    const localX = -shape.width / 2 + t * shape.width;
    const localY = shape.height / 2 - (1 - Math.pow((localX / (shape.width / 2 || 1)), 2)) * shape.height;
    const world = rotatePoint(
      {
        x: shape.cx + localX,
        y: shape.cy + localY
      },
      { x: shape.cx, y: shape.cy },
      shape.rotation
    );
    segments.push(world);
  }
  return pathFromPoints(segments, false);
}

function arcPath(shape) {
  const start = polarPoint({ x: shape.cx, y: shape.cy }, shape.r, shape.startAngle);
  const end = polarPoint({ x: shape.cx, y: shape.cy }, shape.r, shape.endAngle);
  const sweep = normalizedSweep(shape.startAngle, shape.endAngle);
  if (sweep >= 359.999) {
    const middle = polarPoint({ x: shape.cx, y: shape.cy }, shape.r, shape.startAngle + 180);
    return `M ${start.x} ${start.y} A ${shape.r} ${shape.r} 0 1 1 ${middle.x} ${middle.y} A ${shape.r} ${shape.r} 0 1 1 ${start.x} ${start.y}`;
  }
  const largeArcFlag = sweep > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${shape.r} ${shape.r} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
}

function shapeVertices(shape) {
  if (shape.type === "rectangle") {
    const basePoints = [
      { x: shape.cx - shape.width / 2, y: shape.cy - shape.height / 2 },
      { x: shape.cx + shape.width / 2, y: shape.cy - shape.height / 2 },
      { x: shape.cx + shape.width / 2, y: shape.cy + shape.height / 2 },
      { x: shape.cx - shape.width / 2, y: shape.cy + shape.height / 2 }
    ];
    return basePoints.map((point) => rotatePoint(point, { x: shape.cx, y: shape.cy }, shape.rotation));
  }

  if (shape.type === "square") {
    const half = shape.size / 2;
    const basePoints = [
      { x: shape.cx - half, y: shape.cy - half },
      { x: shape.cx + half, y: shape.cy - half },
      { x: shape.cx + half, y: shape.cy + half },
      { x: shape.cx - half, y: shape.cy + half }
    ];
    return basePoints.map((point) => rotatePoint(point, { x: shape.cx, y: shape.cy }, shape.rotation));
  }

  if (shape.type === "rhombus") {
    return rhombusPoints(shape);
  }

  if (shape.type === "polygon") {
    return polygonPoints(shape);
  }

  if (shape.type === "ellipse") {
    const sampleAngles = [];
    for (let angle = 0; angle < 360; angle += 15) {
      sampleAngles.push(angle);
    }
    return sampleAngles.map((angle) => rotatePoint(
      {
        x: shape.cx + Math.cos(degToRad(angle)) * shape.rx,
        y: shape.cy + Math.sin(degToRad(angle)) * shape.ry
      },
      { x: shape.cx, y: shape.cy },
      shape.rotation
    ));
  }

  if (shape.type === "parabola") {
    const points = [];
    for (let index = 0; index <= 20; index += 1) {
      const t = index / 20;
      const localX = -shape.width / 2 + t * shape.width;
      const localY = shape.height / 2 - (1 - Math.pow((localX / (shape.width / 2 || 1)), 2)) * shape.height;
      points.push(rotatePoint(
        {
          x: shape.cx + localX,
          y: shape.cy + localY
        },
        { x: shape.cx, y: shape.cy },
        shape.rotation
      ));
    }
    return points;
  }

  return [];
}

function simplifyPoints(points) {
  if (!Array.isArray(points)) {
    return [];
  }

  return points.filter((point, index) => {
    if (index === 0) {
      return true;
    }
    return distance(point, points[index - 1]) > 0.8;
  });
}

function pathFromPoints(points, closePath) {
  if (!points.length) {
    return "";
  }
  const segments = [`M ${points[0].x} ${points[0].y}`];
  for (let index = 1; index < points.length; index += 1) {
    segments.push(`L ${points[index].x} ${points[index].y}`);
  }
  if (closePath) {
    segments.push("Z");
  }
  return segments.join(" ");
}

function boundsFromPoints(points) {
  if (!points.length) {
    return null;
  }

  return points.reduce((accumulator, point) => ({
    minX: Math.min(accumulator.minX, point.x),
    minY: Math.min(accumulator.minY, point.y),
    maxX: Math.max(accumulator.maxX, point.x),
    maxY: Math.max(accumulator.maxY, point.y)
  }), {
    minX: points[0].x,
    minY: points[0].y,
    maxX: points[0].x,
    maxY: points[0].y
  });
}

function createSvgElement(tagName, attributes = {}, textContent = "") {
  const node = document.createElementNS(SVG_NS, tagName);
  Object.entries(attributes).forEach(([name, value]) => {
    node.setAttribute(name, String(value));
  });
  if (textContent) {
    node.textContent = textContent;
  }
  return node;
}

function rotatePoint(point, center, angle) {
  const radians = degToRad(angle);
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos
  };
}

function polarPoint(origin, radius, angle) {
  const radians = degToRad(angle);
  return {
    x: origin.x + Math.cos(radians) * radius,
    y: origin.y + Math.sin(radians) * radius
  };
}

function midpoint(a, b) {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2
  };
}

function distance(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function angleBetween(a, b) {
  return normalizeAngle(radToDeg(Math.atan2(b.y - a.y, b.x - a.x)));
}

function normalizeVector(vector) {
  const magnitude = Math.hypot(vector.x, vector.y) || 1;
  return {
    x: vector.x / magnitude,
    y: vector.y / magnitude
  };
}

function normalizedSweep(startAngle, endAngle) {
  const start = normalizeAngle(startAngle);
  const end = normalizeAngle(endAngle);
  return (end - start + 360) % 360 || 360;
}

function isAngleOnArc(candidateAngle, startAngle, endAngle) {
  const sweep = normalizedSweep(startAngle, endAngle);
  const delta = (normalizeAngle(candidateAngle) - normalizeAngle(startAngle) + 360) % 360;
  return delta > 0 && delta < sweep;
}

function shortestAngularDistance(a, b) {
  const difference = Math.abs(normalizeAngle(a) - normalizeAngle(b));
  return Math.min(difference, 360 - difference);
}

function degToRad(angle) {
  return angle * (Math.PI / 180);
}

function radToDeg(angle) {
  return angle * (180 / Math.PI);
}

function normalizeAngle(angle) {
  return ((angle % 360) + 360) % 360;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function snapNumber(value, step) {
  return Math.round(value / step) * step;
}

function worldFromDisplay(value) {
  return Number(value) * UNIT_FACTORS[state.units];
}

function displayFromWorld(value) {
  return Number(value) / UNIT_FACTORS[state.units];
}

function formatMeasure(value) {
  return `${displayFromWorld(value).toFixed(2)} ${state.units}`;
}

function formatCoordinate(value) {
  return displayFromWorld(value).toFixed(2);
}

function formatAngle(value) {
  return `${normalizeAngle(value).toFixed(1)}°`;
}

function cloneValue(value) {
  return typeof structuredClone === "function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

function uid(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function timestampSlug() {
  return new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 200);
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}
