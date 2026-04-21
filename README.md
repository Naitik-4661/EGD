# EGD — Interactive 2D Engineering Drawing (Student Project)

EGD is a small **browser-based 2D engineering drawing tool** (mini CAD) made with **HTML + CSS + JavaScript**.  
It lets you sketch common engineering geometry on an SVG canvas with **grid snapping**, **measurements**, and simple **constraints** for lines.

## What you can do

- Draw shapes on a **2D SVG canvas**
  - Line, dashed line, center line
  - Point
  - Circle, ellipse
  - Rectangle, square, rhombus
  - Polygon (editable sides)
  - Parabola
  - Freeform curve
  - Compass arc
- **Snap** to:
  - Grid (default on)
  - Endpoints / midpoints / centers
  - Common angles (0°, 30°, 45°, 60°, 90°…)
- **Edit properties** of selected objects (exact coordinates, size, angle, etc.)
- **Undo / Redo** (history-based)
- **Save / Load** the drawing as a JSON project file
- **Export**
  - SVG
  - PNG
  - PDF

## How to run

### Option 1: Open directly (quickest)
1. Download / clone the repo
2. Open `index.html` in your browser

### Option 2: Run with a local server (recommended)
Some browsers block file features when opening HTML directly, so a local server is safer.

**Using VS Code**
- Install “Live Server”
- Right click `index.html` → **Open with Live Server**

**Using Python**
```bash
python -m http.server 8000
```
Then open:
- `http://localhost:8000`

## How to use (controls)

### Tools
Use the left “Sketch Kit” toolbar and click a tool, then draw on the canvas.

### Shortcuts
- `V` = Select  
- `L` = Line  
- `C` = Circle  
- `R` = Rectangle  
- `A` = Arc  
- `Delete / Backspace` = Delete selected shape  
- `Ctrl/Cmd + Z` = Undo  
- `Ctrl/Cmd + Shift + Z` or `Ctrl/Cmd + Y` = Redo  

### Pan & Zoom
- Mouse wheel = zoom
- Middle mouse **or** hold `Space` = pan (drag)

## Constraints (lines)
In the **Constraints** panel you can apply:
- Horizontal / Vertical
- Parallel / Perpendicular
- Equal length

Tip: choose a line and click **Set reference** to use it as the target for parallel/perpendicular/equal-length.

## Project structure (main files)

- `index.html` — UI layout (toolbar, canvas, inspector panels)
- `styles.css` — styling and responsive layout
- `app.js` — all drawing logic (tools, snapping, selection, constraints, export, save/load)

## Notes / Limitations (student project)
- This is a 2D sketch tool (not full CAD), and constraints are mainly for lines.
- Export is based on the current SVG drawing, then converted to PNG/PDF.

## Future improvements (ideas)
- Dimension tools (manual dimension placement)
- Better constraint solver (multi-shape constraints)
- Layers + hide/lock layers
- More export settings (paper size, scale, line weights)
