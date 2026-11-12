import { test } from 'node:test';
import assert from 'node:assert/strict';
import { finishes, BLUM_HINGE, hingePlate, carcass, frameHeader, frameOpening, frameParts, hingeBlocks, hingeCount, hingeHeights, upgradeDesign, doorLeaves, fitWarnings, geometry, hasLight, hasShelves, initialConfig, initialDesign, lightGroove, REACH_LAYOUT, inspectorLimits, isDesign, layout, minimumSectionHeight, preset, reorderSections, resizeBoundary, shelfClearHeight, trayClear, trayPoints, traySweep, triangularDrawer, validation, WALL_CLEARANCE_WARNING } from './model.ts';
import { parseMeasurement, scrubMeasurement } from './measurements.ts';
import type { Config, Point } from './model.ts';

const legacyConfig = { ...initialConfig, toeKickHeight: 0, toeKickDepth: 0, topTrim: 0, hingeBlockLength: 0, faceFrame: 0, trimHeader: 0 };
const framelessDesign = () => { const d = initialDesign(); d.config = { ...d.config, faceFrame: 0, hingeBlockLength: 3 }; return d; };
const balancedDesign = () => ({ ...initialDesign(), config: { ...legacyConfig }, sections: preset(legacyConfig, 'balanced') });
const near = (actual: number, expected: number, tolerance = 1e-7) =>
  assert.ok(Math.abs(actual - expected) < tolerance, `${actual} should equal ${expected}`);
function insideEnvelope(c: Config, point: Point) {
  const [x, z] = point;
  const halfAngle = c.angle * Math.PI / 360;
  assert.ok(z >= -1e-8 && z <= c.wallRun * Math.cos(halfAngle) + 1e-8);
  assert.ok(Math.abs(x) <= z * Math.tan(halfAngle) + 1e-8);
}
test('42 degree corner, 32 inches along walls gives the requested finished triangle', () => {
  const g = geometry(initialConfig);
  near(g.width, 22.935548770899);
  near(g.depth, 29.874573647910);
  for (const p of g.outer.slice(1)) near(Math.hypot(...p), 32);
  const [right, left] = g.outer.slice(1);
  near(Math.acos((right[0] * left[0] + right[1] * left[1]) / (32 * 32)) * 180 / Math.PI, 42);
});
test('all closed construction extents are inside, not added to the 32 inch limit', () => {
  for (const angle of [20, 42, 90, 120]) {
    for (const thickness of [0.5, 0.75, 1.25]) {
      const c = { ...initialConfig, angle, thickness, wallGap: 0.25 };
      const g = geometry(c);
      [...g.outer, ...g.shelf, ...g.leftSide, ...g.rightSide].forEach(p => insideEnvelope(c, p));
      for (const x of [-g.frontWidth / 2, g.frontWidth / 2]) {
        insideEnvelope(c, [x, g.depth]);
        insideEnvelope(c, [x, g.depth - c.frontThickness]);
      }
      near(g.width, geometry({ ...c, thickness: 0.25 }).width);
      near(g.depth, geometry({ ...c, thickness: 0.25 }).depth);
    }
  }
});
test('perpendicular wall and side thickness offsets are exact', () => {
  const c = { ...initialConfig, wallGap: 0.375 }, g = geometry(c);
  const [outsideX, outsideZ] = g.leftSide[1];
  const [insideX, insideZ] = g.leftSide[2];
  near(outsideX * g.cos + outsideZ * g.sin, c.wallGap);
  near(insideX * g.cos + insideZ * g.sin, c.wallGap + c.thickness);
  near(g.frontInside + c.reveal + c.frontThickness, g.depth);
});
test('increasing material thickness shrinks usable space but not the envelope', () => {
  const first = geometry(initialConfig), second = geometry({ ...initialConfig, thickness: 1 });
  assert.ok(second.shelfWidth < first.shelfWidth);
  assert.ok(second.usableDepth < first.usableDepth);
  near(first.width, second.width);
  near(first.depth, second.depth);
});
test('103 inch height includes every structural horizontal panel exactly', () => {
  const d = balancedDesign(), sections = layout(d.config, d.sections);
  near(sections[0].bottom, 0.75);
  near(sections[3].top + 0.75, 103);
  near(sections[3].height, 21.25);
  sections.slice(1).forEach((s, i) => near(s.bottom - sections[i].top, 0.75));
  near(sections.reduce((sum, s) => sum + s.height, 0) + (sections.length + 1) * 0.75, 103);
  assert.deepEqual(validation(d), []);
});
test('top space updates when lower shelf heights or panel thickness change', () => {
  const d = balancedDesign();
  d.sections[0].height += 5;
  near(layout(d.config, d.sections).at(-1)!.height, 16.25);
  d.config.thickness = 1;
  near(layout(d.config, d.sections).at(-1)!.height, 15);
});
test('all presets fill the available height without adding panels outside', () => {
  for (const height of [36, 72, 103, 120]) {
    const c = { ...initialConfig, height };
    for (const name of ['reach', 'balanced', 'library', 'drawers'] as const) {
      const sections = preset(c, name), placed = layout(c, sections);
      near(placed.at(-1)!.top + c.thickness, height - c.topTrim);
      assert.ok(placed.every(s => s.height > 0));
    }
  }
});
test('shelf counts deduct their actual thickness from clear openings', () => {
  const s = balancedDesign().sections[1];
  s.height = 32; s.shelves = 3;
  near(shelfClearHeight(initialConfig, s), (32 - 3 * 0.75) / 4);
});
test('drawers have exactly three footprint vertices and follow the room wedge', () => {
  for (const angle of [20, 42, 90, 120]) {
    const c = { ...initialConfig, angle }, g = geometry(c), d = triangularDrawer(c);
    assert.equal(d.outer.length, 3);
    assert.equal(d.inner.length, 3);
    assert.equal(d.walls.length, 3);
    assert.ok(d.width > 0 && d.depth > 0);
    near(d.width / (2 * d.depth), g.tan);
    for (const p of [...d.outer, ...d.inner, ...d.walls.flat()]) insideEnvelope(c, p);
    for (const [x, z] of d.outer) assert.ok(Math.abs(x) <= g.halfAt(z) - c.slideClearance / g.cos + 1e-7);
    const [x, z] = d.outer[2];
    near(x * g.cos + z * g.sin, c.wallGap + c.thickness + c.slideClearance);
  }
});
test('triangular drawer stock is offset normally from angled sides, not rectangular deductions', () => {
  const c = initialConfig, g = geometry(c), d = triangularDrawer(c);
  near(d.outer[1][1] - d.inner[1][1], c.boxThickness);
  near(d.inner[0][1] - d.outer[0][1], c.boxThickness / g.sin);
  const [ox, oz] = d.outer[2], [ix, iz] = d.inner[2];
  near((ix * g.cos + iz * g.sin) - (ox * g.cos + oz * g.sin), c.boxThickness);
  assert.ok(d.width > 19 && d.depth > 25);
  assert.ok(d.insideWidth < d.width && d.insideDepth < d.depth);
  const thicker = triangularDrawer({ ...c, boxThickness: 0.75 });
  near(thicker.width, d.width);
  assert.ok(thicker.insideWidth < d.insideWidth);
  const largerGap = triangularDrawer({ ...c, slideClearance: 1 });
  assert.ok(largerGap.width < d.width && largerGap.depth < d.depth);
});
test('old rectangular dimensions no longer control drawers but remain available for swing trays', () => {
  const d = balancedDesign();
  d.sections[0].boxWidth = 80; d.sections[0].boxDepth = 80;
  assert.deepEqual(validation(d), []);
  assert.ok(fitWarnings(d).some(w => w.includes('custom runner/support')));
  assert.equal(fitWarnings(d).filter(w => w.includes('custom runner/support')).length, 1);
  d.sections[0].kind = 'swing';
  assert.ok(fitWarnings(d).some(w => w.includes('tray hits')));
});
test('single doors use one full-width leaf and preserve hinge choice and shelves', () => {
  const d = balancedDesign(), s = d.sections[1], g = geometry(d.config);
  assert.equal(doorLeaves(d.config, s).length, 2);
  near(doorLeaves(d.config, s)[0].width * 2 + d.config.reveal, g.frontWidth);
  s.kind = 'single-door';
  assert.equal(hasShelves(s.kind), true);
  assert.deepEqual(doorLeaves(d.config, s), [{ side: -1, width: g.frontWidth }]);
  s.hinge = 'right';
  assert.deepEqual(doorLeaves(d.config, s), [{ side: 1, width: g.frontWidth }]);
  assert.equal(isDesign(JSON.parse(JSON.stringify(d))), true);
  assert.deepEqual(validation(d), []);
  s.shelves = 10;
  s.height = 24;
  assert.ok(validation(d).some(e => e.includes('shelves leave')));
  assert.equal(isDesign({ ...d, sections: [{ ...s, hinge: 'middle' }] }), false);
});
test('boundary resizing snaps to one inch, updates neighbors only, and preserves total height', () => {
  const d = balancedDesign(), original = layout(d.config, d.sections);
  const result = resizeBoundary(d.config, d.sections, d.sections[0].id, 1.4);
  assert.equal(result.delta, 1);
  const next = layout(d.config, result.sections);
  near(next[0].height, 25); near(next[1].height, 31);
  near(next[2].bottom, original[2].bottom);
  near(next[3].height, original[3].height);
  near(next.at(-1)!.top + d.config.thickness, 103);
  near(d.sections[0].height, 24);
  const back = resizeBoundary(d.config, result.sections, d.sections[0].id, -1);
  near(back.sections[0].height, 24);
});
test('dragging the top divider adjusts the auto-fill opening without losing fractional inches', () => {
  const d = balancedDesign();
  const next = resizeBoundary(d.config, d.sections, d.sections[2].id, 1).sections;
  const placed = layout(d.config, next);
  near(placed[2].height, 23); near(placed[3].height, 20.25);
  near(placed[3].top + d.config.thickness, 103);
});
test('resize limits account for shelf stock and drawer internals, including extreme drags', () => {
  for (const delta of [-1000, 1000]) {
    const d = balancedDesign();
    const result = resizeBoundary(d.config, d.sections, d.sections[0].id, delta);
    assert.equal(result.limited, true);
    assert.ok(Number.isInteger(result.delta));
    const placed = layout(d.config, result.sections);
    assert.ok(placed.every(s => s.height >= minimumSectionHeight(d.config, s) - 1e-7));
    assert.deepEqual(validation({ ...d, sections: result.sections }), []);
  }
});
test('drag reordering preserves section IDs and actual heights, including auto-fill at the top', () => {
  const d = balancedDesign(), original = layout(d.config, d.sections);
  const moved = reorderSections(d.config, d.sections, d.sections[3].id, d.sections[0].id);
  assert.deepEqual(moved.map(s => s.id), [original[3].id, original[0].id, original[1].id, original[2].id]);
  const next = layout(d.config, moved);
  for (const s of next) near(s.height, original.find(item => item.id === s.id)!.height);
  near(next.at(-1)!.top + d.config.thickness, 103);
  assert.deepEqual(validation({ ...d, sections: moved }), []);
});
test('invalid drag requests fail explicitly', () => {
  const d = balancedDesign();
  assert.throws(() => resizeBoundary(d.config, d.sections, d.sections[3].id, 1));
  assert.throws(() => resizeBoundary(d.config, d.sections, d.sections[0].id, NaN));
  assert.throws(() => reorderSections(d.config, d.sections, 'missing', d.sections[0].id));
});
test('tray rotation keeps its hinge fixed and reports collisions', () => {
  const d = balancedDesign(), s = d.sections[2], g = geometry(d.config);
  for (const angle of [0, 30, 90]) {
    const points = trayPoints(d.config, s, angle);
    near(points[0][0], -s.boxWidth / 2);
    near(points[0][1], g.frontInside);
    near(Math.hypot(points[1][0] - points[0][0], points[1][1] - points[0][1]), s.boxWidth);
  }
  assert.equal(trayClear(d.config, s, 0), true);
  s.boxWidth = 30;
  assert.equal(trayClear(d.config, s, 0), false);
  assert.deepEqual(traySweep(d.config, s), { clear: false, firstCollision: 0 });
});
test('invalid structural dimensions block rendering rather than silently clamp', () => {
  const d = balancedDesign();
  d.sections[0].height = 99;
  assert.ok(validation(d).some(e => e.includes('clear height')));
  d.config.angle = NaN;
  assert.ok(validation(d).some(e => e.includes('Corner angle')));
});
test('drawer vertical fit uses the same reveals as the rendered box', () => {
  const d = balancedDesign();
  d.config.reveal = 0.5;
  d.sections[0].height = 6;
  d.sections[0].drawers = 2;
  assert.ok(validation(d).some(e => e.includes('vertical space')));
});
test('serialized designs are shape checked including IDs and known finish names', () => {
  const d = balancedDesign();
  assert.equal(isDesign(JSON.parse(JSON.stringify(d))), true);
  assert.equal(isDesign({ ...d, finish: 'toString' }), false);
  assert.equal(isDesign({ ...d, config: { ...d.config, wallRun: '32' } }), false);
  assert.equal(isDesign({ ...d, sections: [d.sections[0], d.sections[0]] }), false);
  assert.equal(isDesign({ ...d, sections: [] }), false);
  assert.equal(isDesign(null), false);
});
test('fractional inch entry is exact and malformed values are rejected', () => {
  for (const [input, expected] of [['3/4', 0.75], ['1 1/2', 1.5], [' 32 ', 32], ['.125', 0.125], ['-1', -1]] as const)
    assert.equal(parseMeasurement(input), expected);
  for (const input of ['', '1/0', '32garbage', 'NaN', 'Infinity', '1//2'])
    assert.equal(parseMeasurement(input), null);
});
test('horizontal number scrubbing changes one unit per 12 pixels in either direction', () => {
  assert.deepEqual(scrubMeasurement(24, 11.9, 3, 60), { value: 24, limited: false });
  assert.deepEqual(scrubMeasurement(24, 12, 3, 60), { value: 25, limited: false });
  assert.deepEqual(scrubMeasurement(24, 11.9999, 3, 60), { value: 25, limited: false });
  assert.deepEqual(scrubMeasurement(24, -11.9999, 3, 60), { value: 23, limited: false });
  assert.deepEqual(scrubMeasurement(24, -12, 3, 60), { value: 23, limited: false });
  assert.deepEqual(scrubMeasurement(24, 36, 3, 60), { value: 27, limited: false });
  assert.deepEqual(scrubMeasurement(21.25, 24, 3, 60), { value: 23.25, limited: false });
});
test('scrubbing preserves the one-inch grid at bounds and rejects invalid input', () => {
  assert.deepEqual(scrubMeasurement(24, -1200, 5.375, 50), { value: 6, limited: true });
  assert.deepEqual(scrubMeasurement(21.25, 1200, 3, 30), { value: 29.25, limited: true });
  assert.deepEqual(scrubMeasurement(0, -12, 0, 10), { value: 0, limited: true });
  assert.throws(() => scrubMeasurement(NaN, 12, 0, 10));
  assert.throws(() => scrubMeasurement(5, 12, 10, 0));
  assert.throws(() => scrubMeasurement(0, 12, 1, 8));
});
test('inspector scrub bounds respect adjacent openings and usable shelf/drawer spacing', () => {
  const d = balancedDesign(), placed = layout(d.config, d.sections);
  for (const s of placed) {
    const limits = inspectorLimits(d.config, d.sections, s.id);
    near(limits.height.min, minimumSectionHeight(d.config, s));
    const index = placed.findIndex(item => item.id === s.id), boundary = index === placed.length - 1 ? placed[index - 1] : s;
    const target = scrubMeasurement(s.height, 10000, limits.height.min, limits.height.max).value;
    const resized = resizeBoundary(d.config, d.sections, boundary.id, (target - s.height) * (s.autoHeight ? -1 : 1));
    assert.deepEqual(validation({ ...d, sections: resized.sections }), []);
    for (const kind of ['cubby', 'drawers'] as const) {
      const candidate = { ...s, kind, shelves: limits.shelves.max, drawers: limits.drawers.max };
      assert.ok(minimumSectionHeight(d.config, candidate) <= s.height + 1e-8);
      const tooMany = { ...candidate, shelves: candidate.shelves + 1, drawers: candidate.drawers + 1 };
      const atCap = kind === 'cubby' ? candidate.shelves === 10 : candidate.drawers === 8;
      assert.ok(atCap || minimumSectionHeight(d.config, tooMany) > s.height);
    }
  }
});
test('wall-clearance reminder remains available for proposal and export, separately from screen warnings', () => {
  const warnings = fitWarnings(balancedDesign());
  assert.ok(warnings.includes(WALL_CLEARANCE_WARNING));
  const screen = warnings.filter(warning => warning !== WALL_CLEARANCE_WARNING);
  assert.ok(!screen.some(warning => warning.startsWith('Wall clearance')));
  assert.ok(screen.some(warning => warning.includes('custom runner/support')));
});
test('default layout is reach-friendly: doors, lit cubby at 53 in, doors', () => {
  const d = initialDesign(), placed = layout(d.config, d.sections);
  assert.deepEqual(placed.map(s => s.kind), ['door', 'cubby', 'door']);
  near(placed[1].bottom, REACH_LAYOUT.cubbyFloor);
  near(placed[1].height, REACH_LAYOUT.cubbyOpening);
  near(placed[2].top + d.config.thickness + d.config.topTrim, 103);
  assert.equal(placed[0].shelves, 3);
  assert.equal(placed[2].shelves, 2);
  assert.ok(placed.filter(s => s.kind === 'door').every(s => s.shelves >= 2));
  assert.equal(hasLight(placed[1]), true);
  assert.deepEqual(validation(d), []);
});
test('light groove sits inside the shelf outline under the panel above, and only on cubbies', () => {
  for (const angle of [42, 90]) {
    const c = { ...initialConfig, angle }, g = geometry(c), lg = lightGroove(c);
    assert.ok(lg.length > 4);
    near(g.frontInside - lg.zFront, 1);
    near(lg.zFront - lg.zBack, 0.625);
    assert.ok(lg.length / 2 <= g.halfAt(lg.zBack) - 1 + 1e-8);
  }
  const s = initialDesign().sections[1];
  assert.equal(hasLight({ ...s, kind: 'door' }), false);
  assert.equal(hasLight({ ...s, light: false }), false);
});
test('light groove adds wiring and thin-panel warnings and is shape checked', () => {
  const d = initialDesign();
  assert.ok(fitWarnings(d).some(w => w.includes('LED wire route')));
  assert.ok(!fitWarnings(d).some(w => w.includes('3/8"')));
  d.config.thickness = 0.5;
  assert.ok(fitWarnings(d).some(w => w.includes('3/8"')));
  assert.equal(isDesign(JSON.parse(JSON.stringify(initialDesign()))), true);
  const bad = initialDesign();
  (bad.sections[1] as unknown as Record<string, unknown>).light = 'yes';
  assert.equal(isDesign(bad), false);
});
test('toe kick and top trim sit inside the overall height and keep the cubby at 53 in', () => {
  const d = initialDesign(), c = d.config, placed = layout(c, d.sections), box = carcass(c);
  assert.equal(c.toeKickHeight, 4); assert.equal(c.toeKickDepth, 3); assert.equal(c.topTrim, 3);
  near(box.base, 4); near(box.top, 100);
  near(placed[0].bottom, 4 + c.thickness);
  near(placed[1].bottom, 53);
  near(placed.at(-1)!.top + c.thickness, 100);
  near(placed.reduce((sum, s) => sum + s.height, 0) + (placed.length + 1) * c.thickness + 4 + 3, 103);
  assert.deepEqual(validation(d), []);
  assert.ok(validation({ ...d, config: { ...c, toeKickDepth: 9 } }).some(e => e.includes('Toe kick depth')));
});
test('hinge counts follow door height and blocks give a mounting face square to the door', () => {
  assert.deepEqual([30, 40, 47.25, 60, 75, 90].map(hingeCount), [2, 2, 3, 3, 4, 5]);
  const d = framelessDesign(), c = d.config, g = geometry(c), placed = layout(c, d.sections);
  const lower = placed[0], heights = hingeHeights(c, lower);
  assert.equal(heights.length, 3);
  near(heights[0], lower.bottom + c.reveal + 3.5);
  near(heights.at(-1)!, lower.top - c.reveal - 3.5);
  const blocks = hingeBlocks(c, lower);
  assert.equal(blocks.length, 6);
  for (const b of blocks) {
    const [front, back, inner] = b.points;
    near(back[0], inner[0]);
    near(front[1], inner[1]);
    near(b.thickness, c.hingeBlockLength * g.tan);
    near(Math.abs(front[0]), g.halfAt(g.frontInside));
  }
  assert.equal(hingeBlocks(c, placed[1]).length, 0);
  assert.equal(hingeBlocks({ ...c, hingeBlockLength: 0 }, lower).length, 0);
  const single = { ...lower, kind: 'single-door' as const, hinge: 'right' as const };
  assert.ok(hingeBlocks(c, single).every(b => b.side === 1));
});
test('middle hinges move clear of shelves; end hinges that hit a shelf are flagged', () => {
  const d = framelessDesign(), c = d.config, lower = layout(c, d.sections)[0];
  const clear = shelfClearHeight(c, lower);
  const shelves = [0, 1, 2].map(i => lower.bottom + (i + 1) * clear + i * c.thickness);
  for (const h of hingeHeights(c, lower))
    assert.ok(shelves.every(y => !(y < h + 1.5 && y + c.thickness > h - 1.5)), `hinge at ${h} hits a shelf`);
  assert.ok(!fitWarnings(d).some(w => w.includes('hinge block')));
  // An 8" section with one shelf puts the shelf right at the fixed bottom hinge.
  const sections = d.sections.map((s, i) => i === 0 ? { ...s, shelves: 1, height: 8 } : s);
  assert.ok(fitWarnings({ ...d, sections }).some(w => w.includes('lines up with a hinge block')));
});
test('designs saved before toe kick, trim, and hinge blocks load with their original layout', () => {
  const old = balancedDesign() as unknown as { config: Record<string, number> };
  for (const key of ['toeKickHeight', 'toeKickDepth', 'topTrim', 'hingeBlockLength', 'faceFrame', 'trimHeader']) delete old.config[key];
  assert.equal(isDesign(old), false);
  const upgraded = upgradeDesign(JSON.parse(JSON.stringify(old)));
  assert.equal(isDesign(upgraded), true);
  const placed = layout((upgraded as ReturnType<typeof balancedDesign>).config, (upgraded as ReturnType<typeof balancedDesign>).sections);
  near(placed[0].bottom, 0.75);
  near(placed.at(-1)!.top + 0.75, 103);
});
test('default front is an inset face frame: stiles inside the envelope, rails flush with panel tops', () => {
  const d = initialDesign(), c = d.config, g = geometry(c), placed = layout(c, d.sections);
  assert.equal(c.faceFrame, 1.5); assert.equal(c.hingeBlockLength, 0);
  near(g.frameOpening, 2 * g.outerHalf - 3);
  near(g.frontWidth, g.frameOpening - 2 * c.reveal);
  near(g.carcassFront, g.depth - c.frontThickness);
  for (const p of [...g.stiles.flat(), ...g.leftSide, ...g.rightSide, ...g.carcassOuter]) insideEnvelope(c, p);
  for (const stile of g.stiles) for (const [, z] of stile) assert.ok(z >= g.carcassFront - 1e-8);
  // Cubby: no lip at the floor, and the rail above hangs 3/4" below the panel to hide the LED.
  const [cb, ct] = frameOpening(c, placed[1]);
  near(cb, 53); near(ct, 65.5 + c.thickness - 1.5);
  near(frameOpening(c, placed[0])[0], 4 + 1.5);
  const frame = frameParts(c, d.sections)!;
  assert.equal(frame.rails.length, placed.length);
  near(frame.stileLength, 98.5 - 4);
  near(frame.rails.at(-1)![1], 66.25);
  assert.deepEqual(frame.header, { bottom: 98.5, top: 103, height: 4.5, length: 2 * g.outerHalf });
  assert.deepEqual(hingeBlocks(c, placed[0]), []);
  assert.deepEqual(validation(d), []);
  assert.ok(!fitWarnings(d).some(w => w.includes('hinge block')));
});
test('doors and hinges size from the frame opening, and frame settings are validated', () => {
  const d = initialDesign(), c = d.config, lower = layout(c, d.sections)[0];
  const [ob, ot] = frameOpening(c, lower), h = hingeHeights(c, lower);
  near(h[0], ob + c.reveal + 3.5); near(h.at(-1)!, ot - c.reveal - 3.5);
  near(doorLeaves(c, lower)[0].width * 2 + c.reveal, geometry(c).frontWidth);
  assert.ok(validation({ ...d, config: { ...c, faceFrame: 0.5 } }).some(e => e.includes('Face frame width must be')));
  assert.ok(fitWarnings({ ...d, config: { ...c, hingeBlockLength: 3 } }).some(w => w.includes('not needed with a face frame')));
  assert.equal(frameParts({ ...c, faceFrame: 0 }, d.sections), null);
});
test('one-piece header can be turned off, and only applies with a face frame and top trim', () => {
  const d = initialDesign(), c = d.config, placed = layout(c, d.sections);
  const split = frameParts({ ...c, trimHeader: 0 }, d.sections)!;
  assert.equal(split.header, null);
  assert.equal(split.rails.length, placed.length + 1);
  near(split.stileLength, 96);
  near(split.rails.at(-1)![1], 100);
  assert.equal(frameHeader({ ...c, faceFrame: 0 }), null);
  assert.equal(frameHeader({ ...c, topTrim: 0 }), null);
  // The upper doors still stop at the same height either way.
  near(frameOpening(c, placed[2])[1], 98.5);
  near(frameOpening({ ...c, trimHeader: 0 }, placed[2])[1], 98.5);
  assert.ok(validation({ ...d, config: { ...c, trimHeader: 0.5 } }).some(e => e.includes('One-piece header')));
});
test('Blum hinge plates sit on the back of the stile, and cups fit inside the door leaf', () => {
  const d = initialDesign(), c = d.config, g = geometry(c), p = hingePlate(c);
  near(p.x0, g.frameOpening / 2);
  near(p.z1, g.carcassFront);
  assert.ok(p.x1 > p.x0 && p.z0 < p.z1);
  for (const corner of [[p.x1, p.z0], [p.x1, p.z1]] as Point[]) insideEnvelope(c, corner);
  const leaf = doorLeaves(c, layout(c, d.sections)[0])[0].width;
  assert.ok(BLUM_HINGE.cupCenterFromEdge + BLUM_HINGE.cupDiameter / 2 < leaf);
  assert.ok(BLUM_HINGE.cupDepth < c.frontThickness);
  assert.equal(BLUM_HINGE.hinge, '71B3650'); assert.equal(BLUM_HINGE.plate, '175H5030.21');
  const frameless = hingePlate({ ...c, faceFrame: 0, hingeBlockLength: 3 });
  near(frameless.x1, g.halfAt(g.frontInside - 3));
});
test('default finish is the house color, Finsa 98V Roble Aurora, and older finishes still load', () => {
  const d = initialDesign();
  assert.equal(d.finish, 'finsa98v');
  assert.match(finishes.finsa98v.name, /98V Roble Aurora/);
  assert.match(finishes.finsa98v.note ?? '', /edgebanding/);
  assert.equal(isDesign(JSON.parse(JSON.stringify(d))), true);
  assert.equal(isDesign({ ...d, finish: 'oak' }), true);
});
