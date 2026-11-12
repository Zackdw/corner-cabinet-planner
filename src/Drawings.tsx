import { useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import type { Design, Point, Section } from './model';
import { carcass, doorLeaves, finishes, fmt, frameHeader, frameOpening, geometry, hingeBlocks, hingeHeights, hasLight, hasShelves, kinds, layout, lightGroove, minimumSectionHeight, shelfClearHeight, trayPoints, triangularDrawer } from './model';

export function FrontDrawing({ design, selected = '', select = () => {}, resize, reorder, reportError, compact = false }: {
  design: Design; selected?: string; select?: (id: string) => void;
  resize?: (id: string, delta: number, baseline: Section[]) => void;
  reorder?: (source: string, target: string) => void;
  reportError?: (message: string) => void;
  compact?: boolean;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ kind: 'resize' | 'reorder'; id: string; start: number; pixelsPerInch: number; baseline: Section[]; target?: string } | null>(null);
  const [dropTarget, setDropTarget] = useState('');
  const c = design.config, g = geometry(c), sections = layout(c, design.sections), box = carcass(c);
  const scale = Math.min(4.3, 405 / c.height, 190 / (g.outerHalf * 2));
  const x = 195 - g.outerHalf * scale, w = g.outerHalf * 2 * scale;
  const y = (inches: number) => 465 - inches * scale;
  function pointerY(event: PointerEvent) {
    const matrix = svgRef.current?.getScreenCTM();
    if (!matrix) { reportError?.('The drawing is not ready for dragging. Try again when it is visible.'); return null; }
    return new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse()).y;
  }
  function begin(event: PointerEvent, kind: 'resize' | 'reorder', id: string) {
    if (event.button !== 0) return;
    const matrix = svgRef.current?.getScreenCTM();
    if (!matrix) { reportError?.('The drawing is not ready for dragging. Try again when it is visible.'); return; }
    event.preventDefault();
    event.stopPropagation();
    // Keep the inspector stable during a drag; switching storage types can move the drawing.
    drag.current = { kind, id, start: event.clientY, pixelsPerInch: scale * Math.hypot(matrix.c, matrix.d),
      baseline: design.sections.map(item => ({ ...item })) };
    svgRef.current?.setPointerCapture(event.pointerId);
  }
  function move(event: PointerEvent<SVGSVGElement>) {
    const active = drag.current;
    if (!active) return;
    if (active.kind === 'resize') {
      resize?.(active.id, (active.start - event.clientY) / active.pixelsPerInch, active.baseline);
    } else {
      const current = pointerY(event);
      if (current === null) return;
      const target = sections.find(item => current >= y(item.top) && current <= y(item.bottom));
      active.target = target?.id;
      setDropTarget(target?.id ?? '');
    }
  }
  function end(event: PointerEvent<SVGSVGElement>, cancelled = false) {
    const active = drag.current;
    drag.current = null;
    setDropTarget('');
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (!cancelled && active?.kind === 'reorder' && active.target && active.target !== active.id)
      reorder?.(active.id, active.target);
    else if (!cancelled && active) select(active.id);
  }
  return <svg ref={svgRef} viewBox="0 0 440 530" role={resize || reorder ? 'group' : 'img'}
    aria-label={compact ? 'Interactive layout editor' : 'Dimensioned front elevation'} className={`technical ${resize || reorder ? 'interactive-drawing' : ''}`}
    onPointerMove={move} onPointerUp={event => end(event)} onPointerCancel={event => end(event, true)}>
    <text x="24" y="28" className="drawing-title">FRONT ELEVATION</text>
    <text x="24" y="46" className="drawing-note">{resize ? 'Drag green bars: 1-inch resize / drag openings: reorder' : 'Closed position / clear opening heights'}</text>
    <rect x={x} y={y(box.top)} width={w} height={(box.top - box.base) * scale} fill={finishes[design.finish].color} stroke="#655846" />
    {c.topTrim > 0 && (() => {
      const header = frameHeader(c), bottom = header?.bottom ?? box.top;
      return <g aria-label={header ? 'One-piece header' : 'Top trim'}>
        <rect x={x} y={y(c.height)} width={w} height={(c.height - bottom) * scale} fill={finishes[design.finish].color} stroke="#655846" />
        <text x="195" y={y((c.height + bottom) / 2) + 3} textAnchor="middle" className="drawing-note">
          {header ? `HEADER ${fmt(header.height)}"` : `TRIM ${fmt(c.topTrim)}"`}</text>
      </g>;
    })()}
    {box.base > 0 && (() => {
      const zk = g.depth - c.toeKickDepth, xk = g.outerHalf * (zk - g.outerTip) / (g.depth - g.outerTip);
      return <g aria-label="Toe kick">
        <rect x={195 - xk * scale} y={y(box.base)} width={2 * xk * scale} height={box.base * scale} fill="#5f5446" />
        <text x={x + w + 8} y={y(box.base / 2) + 3} className="drawing-note">{fmt(box.base)}" x {fmt(c.toeKickDepth)}" toe kick</text>
      </g>;
    })()}
    {sections.map(s => {
      // sy/sh: the visible opening (inside the face frame rails); dy/dh: the carcass clear opening.
      const [ob, ot] = frameOpening(c, s), sy = y(ot), sh = (ot - ob) * scale, dy = y(s.top), dh = s.height * scale;
      const fx = 195 - g.frontWidth * scale / 2, fw = g.frontWidth * scale;
      return <g key={s.id} className="selectable" role="button" tabIndex={0} aria-label={`Select ${s.name}`}
        onPointerDown={reorder ? event => begin(event, 'reorder', s.id) : undefined}
        onClick={() => select(s.id)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(s.id); } }}>
        <rect x={fx} y={sy} width={fw} height={sh} fill={s.kind === 'cubby' || s.kind === 'swing' ? '#d6c4a7' : finishes[design.finish].color}
          stroke={dropTarget === s.id ? '#c07821' : selected === s.id ? '#20705a' : '#6e5940'}
          strokeWidth={dropTarget === s.id ? 4 : selected === s.id ? 2.5 : 0.7} />
        {s.kind === 'door' && <line x1="195" y1={sy} x2="195" y2={sy + sh} stroke="#776044" />}
        {s.kind === 'single-door' && <path d={s.hinge === 'right'
          ? `M ${fx + fw} ${sy} L ${fx + 4} ${sy + sh / 2} L ${fx + fw} ${sy + sh}`
          : `M ${fx} ${sy} L ${fx + fw - 4} ${sy + sh / 2} L ${fx} ${sy + sh}`}
          fill="none" stroke="#776044" strokeDasharray="3 3" />}
        {s.kind === 'drawers' && Array.from({ length: s.drawers - 1 }, (_, i) =>
          <line key={i} x1={fx} x2={fx + fw} y1={sy + (i + 1) * sh / s.drawers} y2={sy + (i + 1) * sh / s.drawers} stroke="#776044" />)}
        {hasShelves(s.kind) && Array.from({ length: s.shelves }, (_, i) =>
          <rect key={i} x={fx} y={y(s.bottom + (i + 1) * (shelfClearHeight(c, s) + c.thickness))}
            width={fw} height={c.thickness * scale} fill="#91754f" opacity={s.kind === 'door' ? 0.35 : 1} />)}
        {(s.kind === 'door' || s.kind === 'single-door') && doorLeaves(c, s).flatMap(({ side }) => hingeHeights(c, s).map(hy =>
          <rect key={`${side}-${hy}`} x={side < 0 ? fx + 1 : fx + fw - 4} y={y(hy) - 4} width="3" height="8" fill="#6e5940" />))}
        {hasLight(s) && <g aria-label="LED light groove under the panel above">
          <line x1={195 - lightGroove(c).length * scale / 2} x2={195 + lightGroove(c).length * scale / 2}
            y1={dy + 1.5} y2={dy + 1.5} stroke="#d99a1e" strokeWidth="2.5" strokeLinecap="round"
            strokeDasharray={c.faceFrame > 0 ? '4 3' : undefined} />
          <text x={fx + 4} y={sy + 12} className="drawing-note">{c.faceFrame > 0 ? 'LED (behind rail)' : 'LED'}</text>
        </g>}
        {s.kind === 'swing' && <rect x={195 - s.boxWidth * scale / 2} y={y(s.bottom + 3)}
          width={s.boxWidth * scale} height={3 * scale} fill="#af8c5c" stroke="#776044" />}
        <line x1={x + w + 8} x2={x + w + 17} y1={dy} y2={dy} className="dim-line" />
        <line x1={x + w + 8} x2={x + w + 17} y1={dy + dh} y2={dy + dh} className="dim-line" />
        <line x1={x + w + 13} x2={x + w + 13} y1={dy} y2={dy + dh} className="dim-line" />
        <text x={x + w + 23} y={dy + dh / 2 - 3} className="dim-text">{fmt(s.height)}"</text>
        <text x={x + w + 23} y={dy + dh / 2 + 13} className="drawing-note">{kinds[s.kind]}</text>
      </g>;
    })}
    {resize && sections.slice(0, -1).map((s, i) => <g key={`resize-${s.id}`} className="shelf-resize"
      role="slider" tabIndex={0} aria-label={`Resize above ${s.name}`} aria-orientation="vertical"
      aria-valuenow={s.top} aria-valuetext={`${fmt(s.height)} inches below, ${fmt(sections[i + 1].height)} inches above`}
      aria-valuemin={s.bottom + minimumSectionHeight(c, s)}
      aria-valuemax={s.top + sections[i + 1].height - minimumSectionHeight(c, sections[i + 1])}
      onPointerDown={event => begin(event, 'resize', s.id)}
      onKeyDown={event => {
        if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
          event.preventDefault();
          resize(s.id, event.key === 'ArrowUp' ? 1 : -1, design.sections);
        }
      }}>
      <title>Drag up or down to resize adjacent openings in 1-inch steps. Arrow keys also work.</title>
      <rect x={x - 8} y={y(s.top + c.thickness / 2) - 8} width={w + 16} height="16" fill="transparent" />
      <rect x={x - 5} y={y(s.top + c.thickness / 2) - 2} width={w + 10} height="4" rx="2" fill="#20705a" />
      <rect x="183" y={y(s.top + c.thickness / 2) - 5} width="24" height="10" rx="4" fill="#20705a" stroke="#f4f7ef" />
    </g>)}
    <line x1={x - 30} y1={y(c.height)} x2={x - 30} y2={y(0)} className="dim-line" />
    <line x1={x - 36} y1={y(c.height)} x2={x - 12} y2={y(c.height)} className="dim-line" />
    <line x1={x - 36} y1={y(0)} x2={x - 12} y2={y(0)} className="dim-line" />
    <text transform={`translate(${x - 39},${y(c.height / 2)}) rotate(-90)`} textAnchor="middle" className="dim-text">{fmt(c.height)}" OVERALL</text>
    <line x1={x} y1="486" x2={x + w} y2="486" className="dim-line" />
    <text x="195" y="505" textAnchor="middle" className="dim-text">{fmt(g.outerHalf * 2)}" CABINET WIDTH</text>
  </svg>;
}
export function TopDrawing({ design, selected = '', opening = 0 }: { design: Design; selected?: string; opening?: number }) {
  const c = design.config, g = geometry(c);
  const section = design.sections.find(s => s.id === selected);
  const drawer = triangularDrawer(c);
  const travel = section?.kind === 'drawers' ? opening * drawer.depth * 0.9 : 0;
  const scale = Math.min(8, 300 / (g.depth + travel), 330 / g.width);
  const px = (x: number) => 220 + x * scale, pz = (z: number) => 90 + z * scale;
  const polygon = (points: Point[]) => points.map(([x, z]) => `${px(x)},${pz(z)}`).join(' ');
  const tipY = pz(0), frontY = pz(g.depth), leftX = px(-g.width / 2), rightX = px(g.width / 2);
  return <svg viewBox="0 0 440 530" role="img" aria-label="Dimensioned top plan" className="technical">
    <text x="24" y="28" className="drawing-title">TOP PLAN</text>
    <text x="24" y="46" className="drawing-note">{fmt(c.wallRun)}" is along each wall, not straight-back depth.</text>
    <polygon points={polygon([[0, 0], [g.width / 2, g.depth], [-g.width / 2, g.depth]])} fill="#e6e8df" stroke="#8a9386" strokeDasharray="4 3" />
    <polygon points={polygon(g.outer)} fill={finishes[design.finish].color} stroke="#776044" />
    <polygon points={polygon(g.shelf)} fill="#f0e8d9" stroke="#9b886e" />
    <line x1="220" y1={tipY} x2="220" y2={frontY} stroke="#9c9d92" strokeDasharray="4 4" />
    <text x="230" y={tipY + 40} className="dim-text">{fmt(c.angle)} deg</text>
    <text x={leftX - 12} y={frontY - 85} textAnchor="end" className="dim-text">{fmt(c.wallRun)}"</text>
    <text x={rightX + 12} y={frontY - 85} className="dim-text">{fmt(c.wallRun)}"</text>
    <text x="229" y={tipY + (frontY - tipY) * 0.55} className="drawing-note">{fmt(g.depth)}" center depth</text>
    <rect x={px(-g.frontWidth / 2)} y={pz(g.depth - c.frontThickness)} width={g.frontWidth * scale} height={c.frontThickness * scale}
      fill="#55796a" stroke="#35594b" />
    {section?.kind === 'drawers' && <g aria-label="Triangular drawer footprint">
      <polygon data-testid="drawer-footprint" points={polygon(drawer.outer.map(([x, z]) => [x, z + travel]))}
        fill="#c2a16e" fillOpacity=".65" stroke="#91601e" />
      <polygon points={polygon(drawer.inner.map(([x, z]) => [x, z + travel]))} fill="#f4ead5" stroke="#aa8a55" />
      <text x="220" y={pz(g.frontInside - drawer.depth / 3 + travel)} textAnchor="middle" className="drawing-note">
        {fmt(drawer.width)} x {fmt(drawer.depth)}" triangle
      </text>
    </g>}
    {(section?.kind === 'door' || section?.kind === 'single-door') && doorLeaves(c, section).map(({ side, width }) => {
      const angle = side * opening * Math.PI / 2;
      const points: Point[] = [[0, 0], [-side * width, 0], [-side * width, -c.frontThickness], [0, -c.frontThickness]];
      return <polygon key={side} aria-label={side < 0 ? 'Left hinged door' : 'Right hinged door'}
        points={polygon(points.map(([x, z]) => [
          side * g.frontWidth / 2 + x * Math.cos(angle) + z * Math.sin(angle),
          g.depth - x * Math.sin(angle) + z * Math.cos(angle),
        ]))} fill="#55796a" stroke="#35594b" />;
    })}
    {g.stiles.map((points, i) => <polygon key={`stile-${i}`} aria-label="Face frame stile" points={polygon(points)} fill="#a8814f" stroke="#6e5940" />)}
    {g.stiles.length > 0 && <text x="220" y={pz(g.depth) - 6} textAnchor="middle" className="drawing-note">{fmt(c.faceFrame)}" face frame, {fmt(g.frameOpening)}" opening</text>}
    {c.toeKickHeight > 0 && c.toeKickDepth > 0 && <g aria-label="Toe kick line">
      <line x1={px(-g.outerHalf * (g.depth - c.toeKickDepth - g.outerTip) / (g.depth - g.outerTip))} y1={pz(g.depth - c.toeKickDepth)}
        x2={px(g.outerHalf * (g.depth - c.toeKickDepth - g.outerTip) / (g.depth - g.outerTip))} y2={pz(g.depth - c.toeKickDepth)}
        stroke="#5f5446" strokeDasharray="6 3" />
      <text x={rightX + 6} y={pz(g.depth - c.toeKickDepth) + 4} className="drawing-note">toe kick</text>
    </g>}
    {section && (() => {
      const placedSection = layout(c, design.sections).find(item => item.id === section.id);
      const blocks = placedSection ? hingeBlocks(c, placedSection) : [];
      const seen = new Set<number>();
      return blocks.filter(b => !seen.has(b.side) && seen.add(b.side)).map(b =>
        <polygon key={b.side} aria-label="Hinge mounting block" points={polygon(b.points)} fill="#b98d58" stroke="#7a5a2f" />);
    })()}
    {section && hasLight(section) && (() => {
      const lg = lightGroove(c), h = lg.length / 2;
      return <g aria-label="LED light groove">
        <polygon points={polygon([[-h, lg.zBack], [h, lg.zBack], [h, lg.zFront], [-h, lg.zFront]])}
          fill="#f2c25c" stroke="#b07a12" strokeDasharray="3 2" />
        <text x="220" y={pz(lg.zBack) - 8} textAnchor="middle" className="drawing-note">LED groove under panel above, {fmt(lg.length)}" long</text>
      </g>;
    })()}
    {section?.kind === 'swing' && <>
      <polygon points={polygon([
        [-section.boxWidth / 2, g.frontInside], [section.boxWidth / 2, g.frontInside],
        [section.boxWidth / 2, g.frontInside - section.boxDepth], [-section.boxWidth / 2, g.frontInside - section.boxDepth],
      ])} fill="#b48a4d" fillOpacity=".3" stroke="#91601e" />
      {section.kind === 'swing' && <polygon points={polygon(trayPoints(c, section, opening * 90))}
        fill="#4c8c76" fillOpacity=".25" stroke="#21624d" strokeDasharray="5 3" />}
      <text x="220" y={pz(g.frontInside - section.boxDepth / 2)} textAnchor="middle" className="drawing-note">{fmt(section.boxWidth)} x {fmt(section.boxDepth)}"</text>
    </>}
    <line x1={leftX} y1={frontY + 24} x2={rightX} y2={frontY + 24} className="dim-line" />
    <line x1={leftX} y1={frontY + 16} x2={leftX} y2={frontY + 31} className="dim-line" />
    <line x1={rightX} y1={frontY + 16} x2={rightX} y2={frontY + 31} className="dim-line" />
    <text x="220" y={frontY + 45} textAnchor="middle" className="dim-text">{fmt(g.width)}" FINISHED ENVELOPE</text>
    <text x="24" y="494" className="drawing-note">Green = reserved inset front thickness. Dashed = room limit.</text>
    <text x="24" y="512" className="drawing-note">Panels / installation gaps consume space inside this outline.</text>
  </svg>;
}
