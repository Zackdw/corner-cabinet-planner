export type StorageKind = 'cubby' | 'door' | 'single-door' | 'drawers' | 'swing';
export type Point = readonly [number, number];
export interface Config {
  angle: number;
  wallRun: number;
  height: number;
  thickness: number;
  frontThickness: number;
  wallGap: number;
  reveal: number;
  boxThickness: number;
  slideClearance: number;
  /** Recessed base under the carcass. 0 = cabinet sits on the floor. */
  toeKickHeight: number;
  toeKickDepth: number;
  /** Trim board across the front above the carcass, inside the overall height. */
  topTrim: number;
  /** Length of the angled hinge mounting blocks along each side panel. 0 = none. */
  hingeBlockLength: number;
  /** Inset face frame stile and rail width; frame is as thick as the doors. 0 = frameless. */
  faceFrame: number;
  /** 1 = top trim and the frame's top rail are one header board; 0 = separate pieces. */
  trimHeader: number;
  /** Door pull screw-hole spacing (center to center). 0 = no pulls. */
  pullLength: number;
}
export interface Section {
  id: string;
  name: string;
  kind: StorageKind;
  height: number;
  shelves: number;
  drawers: number;
  boxWidth: number;
  boxDepth: number;
  hinge?: 'left' | 'right';
  /** Open cubbies only: rout a groove for an LED channel under the panel above. */
  light?: boolean;
}
export interface Design {
  name: string;
  config: Config;
  sections: Section[];
  finish: string;
}
export interface PlacedSection extends Section {
  bottom: number;
  top: number;
  autoHeight: boolean;
}
export const kinds: Record<StorageKind, string> = {
  cubby: 'Open cubby',
  door: 'Double doors',
  'single-door': 'Single door',
  drawers: 'Drawers',
  swing: 'Swing-out tray',
};
export const finishes: Record<string, { name: string; color: string; note?: string }> = {
  // House color. Screen color approximated from Finsa's 98V swatch; match to a physical sample.
  finsa98v: { name: 'Finsa 98V Roble Aurora', color: '#cfb596',
    note: 'Finsa Duo 98V Roble Aurora, Atlas texture: thermally fused laminate (TFL) on particleboard, with matching 98V PVC edgebanding. Face frame and header: rip from 98V panel and edgeband, or use solid oak finished to match a physical 98V sample. Use hardwood or solid backing where the hinge plates screw into the frame.' },
  oak: { name: 'Natural oak', color: '#c6a479' },
  walnut: { name: 'Walnut', color: '#78533c' },
  painted: { name: 'Warm white', color: '#e6dfd1' },
};
export const initialConfig: Config = {
  angle: 42, wallRun: 32, height: 103, thickness: 0.75,
  frontThickness: 0.75, wallGap: 0, reveal: 0.125,
  boxThickness: 0.5, slideClearance: 0.5,
  // Standard cabinet toe space: 4" high x 3" deep lets the user stand ~3" closer
  // without leaning, which adds ~3" of reach into the cubby.
  toeKickHeight: 4, toeKickDepth: 3,
  // Inset face frame ("fine furniture"): 1 1/2" hardwood stiles and rails, doors flush
  // inside it. Hinges mount to the stiles, so the angled hinge blocks are not needed.
  topTrim: 3, hingeBlockLength: 0, faceFrame: 1.5,
  // Trim and top rail as one board from the ceiling to the upper doors (no seam line).
  trimHeader: 1,
  // 4" matte black bar pulls, one per door leaf (placement option A).
  pullLength: 4,
};
/** Values that reproduce designs saved before these settings existed. */
const LEGACY_CONFIG: Partial<Config> = { toeKickHeight: 0, toeKickDepth: 0, topTrim: 0, hingeBlockLength: 0, faceFrame: 0, trimHeader: 0, pullLength: 0 };
/** Vertical extent of the carcass: above the toe kick, below the top trim. */
export function carcass(c: Config) {
  return { base: c.toeKickHeight, top: c.height - c.topTrim };
}
/**
 * Reach-friendly default, sized for a 5'10" primary user (shoulder ~57.25", 25" arm).
 * The cubby floor sits ~4" below the shoulder: within 0.5" of maximum reach, below
 * eye level so the back is visible, and less shoulder strain than full extension.
 * The opening tops out near eye height (~65.5") so the panel does not hide the back.
 * Shelves: 3 in the lower doors (~12.3" spaces; the top space lands in the waist-to-
 * shoulder zone for frequent items), 2 in the upper doors (~11.5" spaces; above
 * comfortable reach, so fewer, taller spaces for light, occasional storage).
 */
export const REACH_LAYOUT = { cubbyFloor: 53, cubbyOpening: 12.5, lowerShelves: 3, upperShelves: 2 };
function reachPreset(c: Config): Section[] {
  const { base, top } = carcass(c);
  const available = top - base - 4 * c.thickness;
  let lower = Math.max(3, REACH_LAYOUT.cubbyFloor - base - 2 * c.thickness), cubby = REACH_LAYOUT.cubbyOpening;
  if (lower + cubby + 12 > available) {
    // Short cabinets keep the 103" proportions instead of the absolute heights.
    const k = available / (lower + cubby + 36);
    lower *= k; cubby *= k;
  }
  const upper = available - lower - cubby;
  const fit = (h: number, want: number) => Math.max(0, Math.min(want, Math.floor((h - 2) / (c.thickness + 2) + 1e-8)));
  const make = (name: string, kind: StorageKind, height: number, shelves: number, light = false): Section => ({
    id: crypto.randomUUID(), name, kind, height, shelves, drawers: 2, boxWidth: 8, boxDepth: 10, ...(light ? { light } : {}),
  });
  return [
    make('Lower doors', 'door', lower, fit(lower, REACH_LAYOUT.lowerShelves)),
    make('Open cubby', 'cubby', cubby, 0, true),
    make('Upper doors', 'door', upper, fit(upper, REACH_LAYOUT.upperShelves)),
  ];
}
export type PresetStyle = 'reach' | 'balanced' | 'library' | 'drawers';
export function preset(config: Config, style: PresetStyle): Section[] {
  if (style === 'reach') return reachPreset(config);
  const types: StorageKind[] = style === 'library'
    ? ['door', 'cubby', 'cubby', 'cubby', 'cubby']
    : style === 'drawers' ? ['drawers', 'drawers', 'door'] : ['drawers', 'door', 'swing', 'cubby'];
  const weights = style === 'balanced' ? [24, 32, 22, 21.25]
    : style === 'library' ? [25, 18, 18, 18, 20] : [30, 30, 40];
  const { base, top } = carcass(config);
  const available = top - base - (types.length + 1) * config.thickness;
  return types.map((kind, i) => ({
    id: crypto.randomUUID(), name: `Section ${i + 1}`, kind,
    height: available * weights[i] / weights.reduce((a, b) => a + b, 0),
    shelves: kind === 'door' ? 1 : 0, drawers: 2, boxWidth: 8, boxDepth: 10,
  }));
}
export function initialDesign(): Design {
  return { name: 'The 42-degree corner', config: { ...initialConfig }, sections: preset(initialConfig, 'reach'), finish: 'finsa98v' };
}
/** Recessed LED channel groove routed into the underside of the panel above a cubby. */
export const LIGHT_CHANNEL = { width: 0.625, depth: 0.3125, setback: 1, endInset: 1 };
export const LIGHT_SPEC = 'LED channel groove 5/8" W x 5/16" D in the underside of the panel above, 1" behind its front edge, stopped 1" short of each side';
export function hasLight(s: Section) {
  return s.kind === 'cubby' && s.light === true;
}
export function lightGroove(c: Config) {
  const g = geometry(c);
  const zFront = g.frontInside - LIGHT_CHANNEL.setback, zBack = zFront - LIGHT_CHANNEL.width;
  const half = Math.max(0, g.halfAt(zBack) - LIGHT_CHANNEL.endInset);
  return { zFront, zBack, zCenter: (zFront + zBack) / 2, length: 2 * half, width: LIGHT_CHANNEL.width, depth: LIGHT_CHANNEL.depth };
}
export function geometry(c: Config) {
  const a = c.angle * Math.PI / 360;
  const sin = Math.sin(a), cos = Math.cos(a), tan = Math.tan(a);
  const depth = c.wallRun * cos;
  const width = 2 * c.wallRun * sin;
  const outerOffset = c.wallGap / cos;
  const innerOffset = (c.wallGap + c.thickness) / cos;
  const frontInside = depth - c.frontThickness - c.reveal;
  const halfAt = (z: number) => z * tan - innerOffset;
  const outerHalf = depth * tan - outerOffset;
  const innerTip = (c.wallGap + c.thickness) / sin;
  const outerTip = c.wallGap / sin;
  /** Half-width of the outside of the side panels (the wall line) at depth z. */
  const xWall = (z: number) => outerHalf * (z - outerTip) / (depth - outerTip);
  const framed = c.faceFrame > 0;
  // With a face frame, the carcass stops behind it and the frame fills the front.
  const carcassFront = framed ? depth - c.frontThickness : depth;
  const frameOpening = framed ? 2 * outerHalf - 2 * c.faceFrame : 2 * halfAt(depth - c.frontThickness);
  const frontWidth = frameOpening - 2 * c.reveal;
  const outer: Point[] = [[0, outerTip], [outerHalf, depth], [-outerHalf, depth]];
  const carcassOuter: Point[] = [[0, outerTip], [xWall(carcassFront), carcassFront], [-xWall(carcassFront), carcassFront]];
  const shelf: Point[] = [[0, innerTip], [halfAt(frontInside), frontInside], [-halfAt(frontInside), frontInside]];
  const leftSide: Point[] = [[0, outerTip], [-xWall(carcassFront), carcassFront], [-halfAt(carcassFront), carcassFront], [0, innerTip]];
  const rightSide: Point[] = leftSide.map(([x, z]) => [-x, z]);
  const rightStile: Point[] = [[frameOpening / 2, carcassFront], [xWall(carcassFront), carcassFront], [outerHalf, depth], [frameOpening / 2, depth]];
  const stiles: Point[][] = framed ? [rightStile.map(([x, z]) => [-x, z] as Point), rightStile] : [];
  return { sin, cos, tan, depth, width, outerHalf, frontWidth, frontInside, innerTip, outerTip,
    outer, carcassOuter, carcassFront, frameOpening, stiles, xWall, shelf, leftSide, rightSide, halfAt,
    usableDepth: frontInside - innerTip, shelfWidth: 2 * halfAt(frontInside) };
}
export function layout(c: Config, sections: Section[]): PlacedSection[] {
  const { base, top } = carcass(c);
  const topHeight = top - base - (sections.length + 1) * c.thickness
    - sections.slice(0, -1).reduce((sum, s) => sum + s.height, 0);
  let bottom = base + c.thickness;
  return sections.map((s, i) => {
    const height = i === sections.length - 1 ? topHeight : s.height;
    const placed = { ...s, height, bottom, top: bottom + height, autoHeight: i === sections.length - 1 };
    bottom = placed.top + c.thickness;
    return placed;
  });
}
export function hasShelves(kind: StorageKind) {
  return kind === 'cubby' || kind === 'door' || kind === 'single-door';
}
export function doorLeaves(c: Config, s: Section) {
  const g = geometry(c);
  const sides = s.kind === 'single-door' ? [s.hinge === 'right' ? 1 : -1] : [-1, 1];
  return sides.map(side => ({ side, width: s.kind === 'single-door' ? g.frontWidth : (g.frontWidth - c.reveal) / 2 }));
}
/** Typical concealed-hinge count by door height (inches). */
export function hingeCount(doorHeight: number) {
  return doorHeight <= 40 ? 2 : doorHeight <= 60 ? 3 : doorHeight <= 80 ? 4 : 5;
}
export const HINGE_INSET = 3.5, HINGE_BLOCK_HEIGHT = 3;
/** Hinge centers (heights from the floor) for one door leaf in a placed section. */
/**
 * Visible opening of a section as [bottom, top] heights. Face-frame rails sit with
 * their top edge flush with each panel's top surface (no lip on the cubby floor),
 * so each rail hangs below the panel above by (frame width - panel thickness).
 * The bottom rail sits on the carcass base.
 */
export function frameOpening(c: Config, s: PlacedSection): [number, number] {
  if (c.faceFrame <= 0) return [s.bottom, s.top];
  const { base } = carcass(c), first = Math.abs(s.bottom - (base + c.thickness)) < 1e-6;
  return [first ? base + c.faceFrame : s.bottom, s.top + c.thickness - c.faceFrame];
}
/** Face-frame parts for the cut list: two full-height stiles and one rail per panel line. */
/**
 * One-piece header: the top trim and the frame's top rail become a single full-width
 * board from the ceiling down to the top of the upper doors. Stiles stop under it.
 * It is fitted after the cabinet stands, so tip-up clearance is still set by the carcass.
 */
export function frameHeader(c: Config) {
  if (c.faceFrame <= 0 || c.topTrim <= 0 || c.trimHeader !== 1) return null;
  const g = geometry(c), bottom = carcass(c).top - c.faceFrame;
  return { bottom, top: c.height, height: c.height - bottom, length: 2 * g.outerHalf };
}
export function frameParts(c: Config, sections: Section[]) {
  if (c.faceFrame <= 0) return null;
  const g = geometry(c), { base, top } = carcass(c), header = frameHeader(c);
  const rails = [[base, base + c.faceFrame] as [number, number],
    ...layout(c, sections).map(s => [s.top + c.thickness - c.faceFrame, s.top + c.thickness] as [number, number])];
  if (header) rails.pop();
  return { width: c.faceFrame, thickness: c.frontThickness, stileLength: (header ? header.bottom : top) - base,
    railLength: g.frameOpening, opening: g.frameOpening, rails, header };
}
/**
 * Chosen hardware: Blum CLIP top BLUMOTION 110 deg half-cranked hinge on the inset
 * face-frame plate. 35 mm cup, 13 mm deep, ~5 mm boring distance from the door edge.
 */
export const BLUM_HINGE = {
  hinge: '71B3650', hingeInserta: '71B3690', plate: '175H5030.21',
  name: 'Blum CLIP top BLUMOTION 110° half-cranked (71B3650) on inset face-frame plate 175H5030.21',
  cupDiameter: 35 / 25.4, cupDepth: 13 / 25.4, cupCenterFromEdge: (5 + 17.5) / 25.4, plateHeight: 1.65,
};
/**
 * Where each hinge's mounting plate sits (right side; mirror x for the left).
 * Face frame: on the back of the stile. Frameless: on the hinge block or side panel.
 */
export function hingePlate(c: Config) {
  const g = geometry(c), t = 0.35;
  if (c.faceFrame > 0) {
    const x0 = g.frameOpening / 2, x1 = Math.max(x0 + 0.3, g.halfAt(g.carcassFront));
    return { x0, x1, z0: g.carcassFront - t, z1: g.carcassFront };
  }
  const face = c.hingeBlockLength > 0 ? g.halfAt(g.frontInside - c.hingeBlockLength) : g.halfAt(g.frontInside);
  return { x0: face - t, x1: face, z0: g.frontInside - 1.4, z1: g.frontInside - 0.1 };
}
export function hingeHeights(c: Config, s: PlacedSection) {
  const [ob, ot] = frameOpening(c, s);
  const lo = ob + c.reveal + HINGE_INSET, hi = ot - c.reveal - HINGE_INSET;
  const n = hingeCount(ot - ob - 2 * c.reveal);
  const evenly = Array.from({ length: n }, (_, i) => lo + (hi - lo) * i / (n - 1));
  if (!hasShelves(s.kind) || !s.shelves) return evenly;
  // Middle hinges slide clear of shelves; the top and bottom hinges stay put.
  const clear = shelfClearHeight(c, s), half = HINGE_BLOCK_HEIGHT / 2, gap = 0.25;
  const shelves = Array.from({ length: s.shelves }, (_, i) => s.bottom + (i + 1) * clear + i * c.thickness);
  const hits = (h: number) => shelves.some(y => y < h + half && y + c.thickness > h - half);
  return evenly.map((h, i) => {
    if (i === 0 || i === n - 1 || !hits(h)) return h;
    const options = shelves.flatMap(y => [y + c.thickness + half + gap, y - half - gap])
      .filter(o => o >= lo && o <= hi && !hits(o)).sort((a, b) => Math.abs(a - h) - Math.abs(b - h));
    return options[0] ?? h;
  });
}
/**
 * Door pulls, placement option A: vertical bar pulls near the meeting edge (the free
 * edge on a single door), set 3" from the door end nearest PULL.handHeight. Lower doors
 * get the pull at their top corner, upper doors at their bottom corner, so the pulls
 * bracket the cubby and sit at about elbow height (lower) or just above the shoulder (upper).
 */
export const PULL = { name: 'Matte black bar pull', handHeight: 48, endInset: 3, edgeInset: 1.25,
  overhang: 0.1875, bar: 0.375, projection: 1.25 };
export function pullPlacement(c: Config, s: PlacedSection) {
  if (c.pullLength <= 0 || !(s.kind === 'door' || s.kind === 'single-door')) return null;
  const [ob, ot] = frameOpening(c, s), doorBottom = ob + c.reveal, doorTop = ot - c.reveal;
  const reach = PULL.endInset + c.pullLength / 2;
  const lo = doorBottom + reach, hi = doorTop - reach;
  const center = lo > hi ? (doorBottom + doorTop) / 2 : Math.min(hi, Math.max(lo, PULL.handHeight));
  return { center, bottom: center - c.pullLength / 2, top: center + c.pullLength / 2,
    edgeInset: PULL.edgeInset, length: c.pullLength, overall: c.pullLength + 2 * PULL.overhang };
}
/**
 * Angled blocks glued to the inside of each hinged side panel so the hinge plate
 * mounts on a face square to the door. Plan shape is a wedge; its thickness at the
 * front is length x tan(half-angle).
 */
export function hingeBlocks(c: Config, s: PlacedSection) {
  if (!(s.kind === 'door' || s.kind === 'single-door') || c.hingeBlockLength <= 0) return [];
  const g = geometry(c), zf = g.frontInside, zb = zf - c.hingeBlockLength;
  const thickness = g.halfAt(zf) - g.halfAt(zb);
  return doorLeaves(c, s).flatMap(({ side }) => hingeHeights(c, s).map(y => ({
    side, y, thickness,
    points: ([[g.halfAt(zf), zf], [g.halfAt(zb), zb], [g.halfAt(zb), zf]] as Point[]).map(([x, z]) => [side * x, z] as Point),
  })));
}
export function triangularDrawer(c: Config) {
  const g = geometry(c);
  const tip = g.innerTip + c.slideClearance / g.sin;
  const front = g.frontInside;
  const half = (front - tip) * g.tan;
  const innerTip = tip + c.boxThickness / g.sin;
  const innerFront = front - c.boxThickness;
  const innerHalf = (innerFront - innerTip) * g.tan;
  const outer: Point[] = [[0, tip], [half, front], [-half, front]];
  const inner: Point[] = [[0, innerTip], [innerHalf, innerFront], [-innerHalf, innerFront]];
  const left: Point[] = [[0, tip], [-half, front], [-innerHalf, innerFront], [0, innerTip]];
  const right: Point[] = left.map(([x, z]) => [-x, z]);
  const frontWall: Point[] = [[-half, front], [half, front], [innerHalf, innerFront], [-innerHalf, innerFront]];
  return { outer, inner, walls: [left, right, frontWall], width: 2 * half, depth: front - tip,
    insideWidth: 2 * innerHalf, insideDepth: innerFront - innerTip };
}
export function minimumSectionHeight(c: Config, s: Section) {
  if (hasShelves(s.kind)) return Math.max(3, (s.shelves + 1) * 2 + s.shelves * c.thickness);
  if (s.kind === 'drawers') return Math.max(3, s.drawers * (2 + c.boxThickness) + (s.drawers + 1) * c.reveal);
  return 3;
}
export function inspectorLimits(c: Config, sections: Section[], id: string) {
  const placed = layout(c, sections);
  const index = placed.findIndex(s => s.id === id);
  if (index < 0) throw new Error('The selected section is not in this layout.');
  const s = placed[index];
  const neighbor = placed[index === placed.length - 1 ? index - 1 : index + 1];
  return {
    height: { min: minimumSectionHeight(c, s), max: neighbor ? s.height + neighbor.height - minimumSectionHeight(c, neighbor) : s.height },
    shelves: { min: 0, max: Math.max(0, Math.min(10, Math.floor((s.height - 2) / (c.thickness + 2) + 1e-8))) },
    drawers: { min: 1, max: Math.min(8, Math.floor((s.height - c.reveal) / (2 + c.boxThickness + c.reveal) + 1e-8)) },
    box: { min: Math.max(2, 2 * c.boxThickness + 0.125), max: 90 },
  };
}
function resolvedSections(c: Config, sections: Section[]): Section[] {
  return layout(c, sections).map(({ bottom: _bottom, top: _top, autoHeight: _auto, ...section }) => section);
}
export function resizeBoundary(c: Config, sections: Section[], belowId: string, requestedDelta: number) {
  const next = resolvedSections(c, sections);
  const index = next.findIndex(s => s.id === belowId);
  if (index < 0 || index >= next.length - 1 || !Number.isFinite(requestedDelta))
    throw new Error('Choose an internal shelf boundary and a finite inch adjustment.');
  const lower = next[index], upper = next[index + 1];
  const min = Math.ceil(minimumSectionHeight(c, lower) - lower.height - 1e-8);
  const max = Math.floor(upper.height - minimumSectionHeight(c, upper) + 1e-8);
  if (min > 0 || max < 0) throw new Error('Correct the opening heights before dragging this shelf.');
  const snapped = Math.sign(requestedDelta) * Math.round(Math.abs(requestedDelta));
  const delta = Math.max(min, Math.min(max, snapped));
  next[index] = { ...lower, height: lower.height + delta };
  next[index + 1] = { ...upper, height: upper.height - delta };
  return { sections: next, delta, limited: delta !== snapped };
}
export function reorderSections(c: Config, sections: Section[], sourceId: string, targetId: string) {
  const next = resolvedSections(c, sections);
  const from = next.findIndex(s => s.id === sourceId), to = next.findIndex(s => s.id === targetId);
  if (from < 0 || to < 0) throw new Error('Both sections must belong to the current layout.');
  const [moving] = next.splice(from, 1);
  next.splice(to, 0, moving);
  return next;
}
export function trayPoints(c: Config, s: Section, degrees: number): Point[] {
  const g = geometry(c);
  const angle = degrees * Math.PI / 180;
  return ([[0, 0], [s.boxWidth, 0], [s.boxWidth, -s.boxDepth], [0, -s.boxDepth]] as Point[])
    .map(([x, z]) => [
      -s.boxWidth / 2 + x * Math.cos(angle) - z * Math.sin(angle),
      g.frontInside + x * Math.sin(angle) + z * Math.cos(angle),
    ]);
}
export function trayClear(c: Config, s: Section, degrees: number) {
  const g = geometry(c);
  return trayPoints(c, s, degrees).every(([x, z]) => Math.abs(x) <= g.halfAt(z) - c.reveal + 1e-7);
}
export function traySweep(c: Config, s: Section) {
  for (let angle = 0; angle <= 90; angle++) {
    if (!trayClear(c, s, angle)) return { clear: false, firstCollision: angle };
  }
  return { clear: true, firstCollision: null };
}
export function shelfClearHeight(c: Config, s: Section) {
  return (s.height - s.shelves * c.thickness) / (s.shelves + 1);
}
export function validation(design: Design): string[] {
  const { config: c, sections } = design;
  const errors: string[] = [];
  const ranges: [keyof Config, number, number, string][] = [
    ['angle', 10, 150, 'Corner angle'], ['wallRun', 8, 96, 'Wall run'],
    ['height', 12, 144, 'Overall height'], ['thickness', 0.25, 2, 'Panel thickness'],
    ['frontThickness', 0.25, 2, 'Front thickness'], ['wallGap', 0, 2, 'Wall clearance'],
    ['reveal', 0.0625, 0.5, 'Front gap'], ['boxThickness', 0.25, 1, 'Box thickness'],
    ['slideClearance', 0.125, 1.5, 'Drawer side clearance'],
    ['toeKickHeight', 0, 8, 'Toe kick height'], ['toeKickDepth', 0, 6, 'Toe kick depth'],
    ['topTrim', 0, 12, 'Top trim height'], ['hingeBlockLength', 0, 6, 'Hinge block length'],
    ['faceFrame', 0, 4, 'Face frame width'], ['trimHeader', 0, 1, 'One-piece header'], ['pullLength', 0, 12, 'Pull length'],
  ];
  for (const [key, min, max, label] of ranges) {
    if (!Number.isFinite(c[key]) || c[key] < min || c[key] > max)
      errors.push(`${label} must be between ${min} and ${max}.`);
  }
  if (sections.length < 1 || sections.length > 12) errors.push('Use between 1 and 12 sections.');
  if (errors.length) return errors;
  const g = geometry(c);
  if (g.frontWidth < 2 || g.usableDepth < 2) errors.push('The materials leave too little interior space. Increase the footprint or reduce thicknesses.');
  if (c.trimHeader !== 0 && c.trimHeader !== 1) errors.push('One-piece header must be on (1) or off (0).');
  if (c.faceFrame > 0 && c.faceFrame < c.thickness)
    errors.push(`Face frame width must be 0 (frameless) or at least the ${fmt(c.thickness)}" panel thickness so each rail covers its panel edge.`);
  for (const s of layout(c, sections)) {
    const [ob, ot] = frameOpening(c, s);
    if (c.faceFrame > 0 && ot - ob < 3) errors.push(`${s.name}: the face frame rails leave less than 3" of opening. Make the section taller or the frame narrower.`);
    if (!Number.isFinite(s.height) || s.height < 3) errors.push(`${s.name}: clear height must be at least 3 in. Reduce lower sections or increase overall height.`);
    if (!Number.isInteger(s.shelves) || s.shelves < 0 || s.shelves > 10)
      errors.push(`${s.name}: use 0 to 10 shelves.`);
    if (!Number.isInteger(s.drawers) || s.drawers < 1 || s.drawers > 8)
      errors.push(`${s.name}: use 1 to 8 drawers.`);
    if (hasShelves(s.kind) && shelfClearHeight(c, s) < 2 - 1e-8)
      errors.push(`${s.name}: shelves leave less than 2 in of clear space.`);
    if (s.kind === 'swing') {
      if (![s.boxWidth, s.boxDepth].every(v => Number.isFinite(v) && v >= 2 && v <= 90)
        || s.boxWidth <= 2 * c.boxThickness || s.boxDepth <= 2 * c.boxThickness)
        errors.push(`${s.name}: box dimensions must be 2 to 90 in and greater than twice the box thickness.`);
    }
    if (s.kind === 'drawers' && ((s.height - (s.drawers + 1) * c.reveal) / s.drawers - 1 - c.boxThickness < 1 - 1e-8))
      errors.push(`${s.name}: drawer boxes need more vertical space.`);
    if (s.kind === 'drawers') {
      const drawer = triangularDrawer(c);
      if (drawer.insideWidth < 1 || drawer.insideDepth < 1)
        errors.push(`${s.name}: material and side clearance leave less than 1 in inside the triangular drawer. Increase the footprint or reduce those allowances.`);
    }
  }
  return errors;
}
export const WALL_CLEARANCE_WARNING = 'Wall clearance is 0 in. Confirm out-of-square walls, baseboards, and installation allowance with the woodworker.';
export function fitWarnings(design: Design): string[] {
  const warnings: string[] = [];
  for (const s of design.sections) {
    if (s.kind === 'swing') {
      const sweep = traySweep(design.config, s);
      if (!sweep.clear) warnings.push(`${s.name}: tray hits a side panel by approximately ${sweep.firstCollision} degrees of opening. This is not a workable full swing.`);
    }
  }
  const cfg = design.config;
  if (cfg.faceFrame > 0 && cfg.hingeBlockLength > 0)
    warnings.push('Hinge blocks are not needed with a face frame: the hinges mount to the stiles. Set Hinge block length to 0.');
  if (cfg.faceFrame > 0 && design.sections.some(s => s.kind === 'drawers') && triangularDrawer(cfg).width > geometry(cfg).frameOpening)
    warnings.push(`Triangular drawer boxes are wider than the ${fmt(geometry(cfg).frameOpening)}" face frame opening and cannot pass through it. Narrow the frame or rethink the drawers.`);
  if (design.sections.some(s => s.kind === 'drawers'))
    warnings.push('Triangular drawers require a custom runner/support design. Side clearance is an allowance only; conventional parallel side slides and mounting rails are not modeled or verified.');
  for (const s of layout(design.config, design.sections)) {
    const blocks = hingeBlocks(design.config, s);
    if (!blocks.length || !hasShelves(s.kind)) continue;
    const c = design.config, clear = shelfClearHeight(c, s);
    const hits = Array.from({ length: s.shelves }, (_, i) => s.bottom + (i + 1) * clear + i * c.thickness)
      .filter(y => blocks.some(b => y < b.y + HINGE_BLOCK_HEIGHT / 2 && y + c.thickness > b.y - HINGE_BLOCK_HEIGHT / 2));
    if (hits.length)
      warnings.push(`${s.name}: shelf at ${hits.map(y => fmt(y) + '"').join(', ')} lines up with a hinge block. Notch the shelf's front corners ${fmt(blocks[0].thickness)}" or move the shelf.`);
  }
  const lit = design.sections.filter(hasLight);
  if (lit.length) {
    const c = design.config, names = lit.map(s => s.name).join(', ');
    if (c.thickness - LIGHT_CHANNEL.depth < 0.375)
      warnings.push(`${names}: ${fmt(c.thickness)}" panels leave less than 3/8" of material above the 5/16" light groove. Use thicker panels or a surface-mount LED channel.`);
    if (lightGroove(c).length < 4)
      warnings.push(`${names}: the light groove would be under 4" long at this footprint. Use a surface-mount puck light instead.`);
    warnings.push(`${names}: plan the LED wire route (for example a 1/2" hole through the back corner of the panel above), plus where the driver and switch will go.`);
  }
  if (design.config.wallGap === 0) warnings.push(WALL_CLEARANCE_WARNING);
  return warnings;
}
export function fmt(n: number) {
  return Number.isFinite(n) ? n.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1') : '--';
}
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
/** Fill settings added after a design was saved, so older designs load unchanged. */
export function upgradeDesign(v: unknown): unknown {
  if (!isRecord(v) || !isRecord(v.config)) return v;
  const config: Record<string, unknown> = { ...v.config };
  for (const [key, value] of Object.entries(LEGACY_CONFIG)) if (config[key] === undefined) config[key] = value;
  return { ...v, config };
}
export function isDesign(v: unknown): v is Design {
  if (!isRecord(v) || typeof v.name !== 'string' || typeof v.finish !== 'string' || !Object.hasOwn(finishes, v.finish)
    || !isRecord(v.config) || !Array.isArray(v.sections)) return false;
  const config = v.config;
  if (!Object.keys(initialConfig).every(k => typeof config[k] === 'number' && Number.isFinite(config[k]))) return false;
  const ids = new Set<string>();
  return v.sections.length > 0 && v.sections.length <= 12 && v.sections.every((s: unknown) => {
    if (!isRecord(s) || typeof s.id !== 'string' || ids.has(s.id) || typeof s.name !== 'string'
      || typeof s.kind !== 'string' || !Object.hasOwn(kinds, s.kind)) return false;
    if (s.hinge !== undefined && s.hinge !== 'left' && s.hinge !== 'right') return false;
    if (s.light !== undefined && typeof s.light !== 'boolean') return false;
    ids.add(s.id);
    return ['height', 'shelves', 'drawers', 'boxWidth', 'boxDepth'].every(k => typeof s[k] === 'number' && Number.isFinite(s[k]));
  });
}
