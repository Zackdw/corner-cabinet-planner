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
export const finishes: Record<string, { name: string; color: string }> = {
  oak: { name: 'Natural oak', color: '#c6a479' },
  walnut: { name: 'Walnut', color: '#78533c' },
  painted: { name: 'Warm white', color: '#e6dfd1' },
};
export const initialConfig: Config = {
  angle: 42, wallRun: 32, height: 103, thickness: 0.75,
  frontThickness: 0.75, wallGap: 0, reveal: 0.125,
  boxThickness: 0.5, slideClearance: 0.5,
};
export function preset(config: Config, style: 'balanced' | 'library' | 'drawers'): Section[] {
  const types: StorageKind[] = style === 'library'
    ? ['door', 'cubby', 'cubby', 'cubby', 'cubby']
    : style === 'drawers' ? ['drawers', 'drawers', 'door'] : ['drawers', 'door', 'swing', 'cubby'];
  const weights = style === 'balanced' ? [24, 32, 22, 21.25]
    : style === 'library' ? [25, 18, 18, 18, 20] : [30, 30, 40];
  const available = config.height - (types.length + 1) * config.thickness;
  return types.map((kind, i) => ({
    id: crypto.randomUUID(), name: `Section ${i + 1}`, kind,
    height: available * weights[i] / weights.reduce((a, b) => a + b, 0),
    shelves: kind === 'door' ? 1 : 0, drawers: 2, boxWidth: 8, boxDepth: 10,
  }));
}
export function initialDesign(): Design {
  return { name: 'The 42-degree corner', config: { ...initialConfig }, sections: preset(initialConfig, 'balanced'), finish: 'oak' };
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
  const frontWidth = 2 * halfAt(depth - c.frontThickness) - 2 * c.reveal;
  const innerTip = (c.wallGap + c.thickness) / sin;
  const outerTip = c.wallGap / sin;
  const outer: Point[] = [[0, outerTip], [outerHalf, depth], [-outerHalf, depth]];
  const shelf: Point[] = [[0, innerTip], [halfAt(frontInside), frontInside], [-halfAt(frontInside), frontInside]];
  const leftSide: Point[] = [[0, outerTip], [-outerHalf, depth], [-halfAt(depth), depth], [0, innerTip]];
  const rightSide: Point[] = leftSide.map(([x, z]) => [-x, z]);
  return { sin, cos, tan, depth, width, outerHalf, frontWidth, frontInside, innerTip, outerTip,
    outer, shelf, leftSide, rightSide, halfAt,
    usableDepth: frontInside - innerTip, shelfWidth: 2 * halfAt(frontInside) };
}
export function layout(c: Config, sections: Section[]): PlacedSection[] {
  const topHeight = c.height - (sections.length + 1) * c.thickness
    - sections.slice(0, -1).reduce((sum, s) => sum + s.height, 0);
  let bottom = c.thickness;
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
  ];
  for (const [key, min, max, label] of ranges) {
    if (!Number.isFinite(c[key]) || c[key] < min || c[key] > max)
      errors.push(`${label} must be between ${min} and ${max}.`);
  }
  if (sections.length < 1 || sections.length > 12) errors.push('Use between 1 and 12 sections.');
  if (errors.length) return errors;
  const g = geometry(c);
  if (g.frontWidth < 2 || g.usableDepth < 2) errors.push('The materials leave too little interior space. Increase the footprint or reduce thicknesses.');
  for (const s of layout(c, sections)) {
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
  if (design.sections.some(s => s.kind === 'drawers'))
    warnings.push('Triangular drawers require a custom runner/support design. Side clearance is an allowance only; conventional parallel side slides and mounting rails are not modeled or verified.');
  if (design.config.wallGap === 0) warnings.push(WALL_CLEARANCE_WARNING);
  return warnings;
}
export function fmt(n: number) {
  return Number.isFinite(n) ? n.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1') : '--';
}
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
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
    ids.add(s.id);
    return ['height', 'shelves', 'drawers', 'boxWidth', 'boxDepth'].every(k => typeof s[k] === 'number' && Number.isFinite(s[k]));
  });
}
