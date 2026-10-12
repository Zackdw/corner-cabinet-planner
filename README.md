# Corner Workshop

A local, dimension-driven cabinet concept planner. Starts with the confirmed
42-degree inside corner, 32-inch finished run **along each wall**, and 103-inch
overall height.

## Run

Requires Node.js 24 or newer.

```powershell
npm install
npm run dev
```

Open http://127.0.0.1:5187. The server binds only to this computer.
`npm run build` type-checks and creates a production build; `npm test` runs the
geometry and measurement tests.

## Use

- Switch between rotatable 3D, dimensioned front elevation, and top plan.
- Click a section in the list, front elevation, or 3D model to edit it.
- Collapse **The space** to hide room and material settings without hiding
  the layout or changing any measurements.
- Enter inches as decimals or fractions, such as `3/4` or `1 1/2`.
  Press Enter or leave the field to commit a measurement.
- In **Make it yours**, hold a numeric field and drag horizontally: right
  increases, left decreases, one inch/count per 12 pixels. Updates are live
  and bounded by usable dimensions/counts. A plain click still allows typing.
  Height scrubbing transfers space between neighboring openings without
  changing overall height; the computed top opening supports scrubbing too.
- Structural height includes the top, bottom, and dividing panels. The top
  opening fills the remaining height. Move it down to give it a fixed height.
- Split the top opening, remove/reorder sections, or try three layout presets.
  Presets replace storage arrangements but preserve room/material settings.
- Reorder by dragging a section in the list or dragging an opening onto another
  in the front drawing or **Drag layout** editor under **The layout**. Opening heights
  travel with their sections, including the formerly auto-fill top opening.
- Drag green divider bars to resize adjacent openings live in **1-inch steps**.
  Resizing transfers height between neighbors without changing the total height.
  Minimum usable openings account for shelves, drawer stock, and gaps. Focus a
  divider and press Up/Down for keyboard resizing. The inspector's `-1 in` and
  `+1 in` buttons also work on the top opening. Manual entry still accepts fractions.
- Use cubbies, single doors (left or right hinged), double doors, triangular drawer boxes, or a conceptual
  front-left-pivot swing tray. The opening slider positions only the selected
  section. Front elevation stays closed for dimensioning.
- Shelves within a section are evenly spaced; separate cubby sections allow
  individually set shelf heights.
- Save named variations in this browser. Saving an existing name replaces
  that variation. Changes are not automatically saved. Export JSON for a
  portable dimension record (JSON import is not implemented).
- Print proposal opens the browser print dialog; choose Save as PDF to share
  front/top drawings, dimensions, material assumptions, and review notes.
- The two GitHub skill collections used as reference are linked in the app.
  No external skills or agent instructions are installed globally.

## Geometry contract

The room is a symmetric wedge with the corner at `(x=0, z=0)` and the cabinet
front perpendicular to its bisector:

- `center depth = wall run * cos(angle / 2)`
- `front envelope width = 2 * wall run * sin(angle / 2)`
- Defaults: approximately **29.87 inches** center depth and **22.94 inches**
  front width. The 32-inch figure is **not** rectangular usable drawer depth.
- Installation gaps and side thickness are perpendicular offsets from the
  room walls. Both reduce the interior; neither enlarges the envelope.
- Angled side panels meet at a conceptual miter and enclose the back. There
  is no separate back panel.
- Fronts are inset. Their outer faces stop at the finished front plane.
  Shelf depth reserves front stock thickness and a front gap.
- Default fronts are handle-free. Projecting handles, crown, feet, plinths,
  countertops, baseboards, wall obstructions, and scribing are not modeled.
- Drawer boxes now have a triangular bottom, two angled sides meeting at the
  rear, and a front wall. Their angle matches the room wedge; outside width and
  depth are automatically derived after side clearance and cabinet stock.
  Box stock is offset **perpendicular** to the sloping sides, not subtracted
  as if the box were rectangular. Front stock is deducted along the centerline.
- This intentionally replaces rectangular drawers in existing saved layouts.
  Legacy `boxWidth`/`boxDepth` fields no longer size drawers; they are retained
  for switching a section to a swing tray. JSON exports use schema version 2
  and explicitly record the triangular profile and computed drawer dimensions.
- `Drawer side clearance` is a perpendicular allowance, **not** a verified
  conventional slide installation. Parallel side rails are no longer modeled.
  Triangular drawers need a custom runner/support design; the maker must
  approve travel, support, access, tolerances, and load rating.
- Swing tray collision checks sample the tray rectangle at one-degree steps
  through 90 degrees against the inside side-wall planes. This is not continuous
  collision detection and does not include hinge/linkage hardware, other open
  sections, nearby furniture, or human access.
- Default installation clearance is zero to show the requested envelope.
  Its reminder and installation notes are retained in the printed proposal
  and exported warnings, not the compact editor. A maker should specify a real
  allowance. Fit errors and hardware/collision warnings remain visible.
- Measurement labels round to two decimals, but calculations and editable
  inputs retain the underlying values (including exact 1/8-inch reveals).

This is a **discussion and quotation tool**, not a cut-list generator or
fabrication approval. A woodworker must verify site dimensions, actual stock,
joinery, hardware, tolerances, strength, anchoring, and installation feasibility.
At 103 inches tall, sectional assembly and ceiling/delivery clearance deserve
particular attention.

## GitHub research

- [CloudAI-X/threejs-skills](https://github.com/CloudAI-X/threejs-skills):
  geometry, scene setup, materials, and interaction guidance.
- [emalorenzo/three-agent-skills](https://github.com/emalorenzo/three-agent-skills):
  React Three Fiber/Drei component, rendering, and lifecycle guidance.
- [flowful-ai/cad-skill](https://github.com/flowful-ai/cad-skill):
  an optional later route for parametric CAD; not used in this web prototype.

## Startup motion

The dimension bar, existing panels, and save controls use a local adaptation of
[React Bits AnimatedContent](https://reactbits.dev/animations/animated-content),
with short staggered entrances powered by GSAP. No video, splash screen, or
HyperFrames runtime is installed. Unlike the upstream scroll-triggered example,
these entrances run once on mount, do not replay during editing, respect
`prefers-reduced-motion`, and finish immediately when a control receives focus
or a pointer press. Printing also finishes any outstanding entrance.

The adapted component is covered by the upstream
[MIT + Commons Clause license](src/react-bits-LICENSE.txt): it may be used inside
this application, but the components themselves must not be sold, sublicensed,
or redistributed as a component bundle.

The planner uses React, Three.js, React Three Fiber, Drei, and GSAP. It requests only
static Google Fonts for typography; system fonts work without that connection.
Design data stays in the local browser unless you export or share it.
