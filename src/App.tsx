import { Component, useRef, useState } from 'react';
import type { ErrorInfo, PointerEvent, ReactNode } from 'react';
import { FrontDrawing, TopDrawing } from './Drawings';
import { Scene } from './Scene';
import { AnimatedContent } from './AnimatedContent';
import { NumberField } from './NumberField';
import type { Config, Design, Section, StorageKind } from './model';
import { finishes, fitWarnings, fmt, geometry, hasShelves, initialDesign, inspectorLimits, isDesign, kinds, layout, preset, reorderSections, resizeBoundary, shelfClearHeight, traySweep, triangularDrawer, validation, WALL_CLEARANCE_WARNING } from './model';

const STORAGE_KEY = 'corner-workshop-designs-v1';
function readSaved(): { designs: Design[]; error: string } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { designs: [], error: '' };
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.every(isDesign))
      throw new Error('Saved designs have an unsupported format.');
    return { designs: parsed, error: '' };
  } catch (error) {
    console.error('Could not load cabinet designs', error);
    return { designs: [], error: `Could not load browser-saved designs: ${error instanceof Error ? error.message : String(error)}. Existing saved data has not been changed.` };
  }
}
class SceneBoundary extends Component<{ children: ReactNode }, { error: string }> {
  state = { error: '' };
  static getDerivedStateFromError(error: Error) { return { error: error.message }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Cabinet 3D rendering failed', error, info); }
  render() {
    return this.state.error
      ? <div className="empty" role="alert"><h3>3D view is unavailable</h3><p>{this.state.error}</p><p>Use the front and top drawings above.</p></div>
      : this.props.children;
  }
}
export default function App() {
  const [loaded] = useState(readSaved);
  const [design, setDesign] = useState<Design>(() => loaded.designs[0] ?? initialDesign());
  const [saved, setSaved] = useState(loaded.designs);
  const [message, setMessage] = useState(loaded.error);
  const [selected, setSelected] = useState(design.sections[0].id);
  const [view, setView] = useState<'3d' | 'front' | 'top'>('3d');
  const [openings, setOpenings] = useState<Record<string, number>>({});
  const [ghost, setGhost] = useState(false);
  const [reset, setReset] = useState(0);
  const [dragged, setDragged] = useState('');
  const [dropTarget, setDropTarget] = useState('');
  const sectionDrag = useRef<{ id: string; x: number; y: number; target: string } | null>(null);
  const [layoutStatus, setLayoutStatus] = useState('Drag shelf bars to resize by 1 inch. Drag an opening onto another to reorder.');
  const c = design.config, g = geometry(c), placed = layout(c, design.sections);
  const s = placed.find(item => item.id === selected) ?? placed[0];
  const errors = validation(design), warnings = errors.length ? [] : fitWarnings(design);
  const screenWarnings = warnings.filter(warning => warning !== WALL_CLEARANCE_WARNING);
  const limits = inspectorLimits(c, design.sections, s.id);
  const drawer = triangularDrawer(c), swing = traySweep(c, s);
  const unchanged = saved.some(item => JSON.stringify(item) === JSON.stringify(design));
  const opening = openings[s.id] ?? 0;
  function setOpening(value: number) { setOpenings(previous => ({ ...previous, [s.id]: value })); }

  function config(key: keyof Config, value: number) {
    setDesign(previous => ({ ...previous, config: { ...previous.config, [key]: value } }));
  }
  function updateSection(patch: Partial<Section>) {
    setDesign(previous => ({ ...previous, sections: previous.sections.map(item => item.id === s.id ? { ...item, ...patch } : item) }));
  }
  function select(id: string) { setSelected(id); }
  function choosePreset(style: 'balanced' | 'library' | 'drawers') {
    const sections = preset(c, style);
    setDesign({ ...design, sections });
    select(sections[0].id);
  }
  function addSection() {
    const last = placed[placed.length - 1];
    if (last.height < 6 + c.thickness) { setMessage('Make the top section taller before splitting it; both new openings need at least 3 inches.'); return; }
    const newHeight = (last.height - c.thickness) / 2;
    const sections = design.sections.map(item => item.id === last.id ? { ...item, height: newHeight } : item);
    const added: Section = { ...last, id: crypto.randomUUID(), name: `Section ${sections.length + 1}`, kind: 'cubby', height: newHeight, shelves: 0 };
    sections.push(added);
    setDesign({ ...design, sections });
    select(added.id);
  }
  function removeSection() {
    const sections = design.sections.filter(item => item.id !== s.id);
    setDesign({ ...design, sections });
    select(sections[0].id);
  }
  function moveSection(direction: number) {
    const index = placed.findIndex(item => item.id === s.id), next = index + direction;
    if (next < 0 || next >= placed.length) return;
    reorderLayout(s.id, placed[next].id);
  }
  function reportLayoutError(error: unknown) {
    console.error('Cabinet layout edit failed', error);
    setLayoutStatus(error instanceof Error ? error.message : String(error));
  }
  function reorderLayout(source: string, target: string) {
    try {
      const sections = reorderSections(c, design.sections, source, target);
      setDesign({ ...design, sections });
      select(source);
      setLayoutStatus('Section moved. Opening heights and overall height are preserved.');
    } catch (error) { reportLayoutError(error); }
  }
  function resizeLayout(id: string, delta: number, baseline: Section[]) {
    try {
      const result = resizeBoundary(c, baseline, id, delta);
      setDesign({ ...design, sections: result.sections });
      setLayoutStatus(result.limited
        ? 'Stopped at the minimum usable opening height. No panels overlap.'
        : `Shelf moved ${result.delta >= 0 ? '+' : ''}${result.delta} in. Adjacent openings update live; overall height is unchanged.`);
    } catch (error) { reportLayoutError(error); }
  }
  function nudgeHeight(delta: number) {
    const index = placed.findIndex(item => item.id === s.id);
    const boundary = index === placed.length - 1 ? placed[index - 1] : s;
    resizeLayout(boundary.id, index === placed.length - 1 ? -delta : delta, design.sections);
  }
  function scrubHeight(value: number) {
    nudgeHeight(value - s.height);
  }
  function startSectionDrag(event: PointerEvent<HTMLButtonElement>, id: string) {
    if (event.button !== 0 || errors.length) return;
    event.preventDefault();
    sectionDrag.current = { id, x: event.clientX, y: event.clientY, target: '' };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function moveSectionDrag(event: PointerEvent<HTMLButtonElement>) {
    const active = sectionDrag.current;
    if (!active || Math.hypot(event.clientX - active.x, event.clientY - active.y) < 5) return;
    active.target = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-section-id]')?.getAttribute('data-section-id') ?? '';
    setDragged(active.id);
    setDropTarget(active.target);
  }
  function endSectionDrag(event: PointerEvent<HTMLButtonElement>, cancelled = false) {
    const active = sectionDrag.current;
    sectionDrag.current = null;
    setDragged(''); setDropTarget('');
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (!cancelled && active?.target && active.target !== active.id) reorderLayout(active.id, active.target);
    else if (!cancelled && active) select(active.id);
  }
  function saveDesign() {
    if (loaded.error && saved.length === 0) {
      setMessage('Saving is disabled to protect unreadable stored data. Export JSON instead, or clear this site’s saved data deliberately in browser settings.');
      return;
    }
    if (!design.name.trim()) { setMessage('Give this design a name before saving.'); return; }
    try {
      const next = [design, ...saved.filter(item => item.name !== design.name)];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setSaved(next);
      setMessage(`Saved "${design.name}" in this browser. Export JSON for a portable backup.`);
    } catch (error) {
      console.error('Could not save cabinet design', error);
      setMessage(`Could not save: ${error instanceof Error ? error.message : String(error)}. Export JSON instead.`);
    }
  }
  function exportDesign() {
    const data = { schemaVersion: 2, units: 'inches', ...design, sections: placed.map(item => item.kind === 'drawers'
      ? { ...item, drawerShape: 'triangular', boxWidth: drawer.width, boxDepth: drawer.depth } : item),
      derived: { frontEnvelopeWidth: g.width, centerDepth: g.depth, shelfFrontWidth: g.shelfWidth,
        triangularDrawer: { outsideWidth: drawer.width, outsideDepth: drawer.depth, insideWidth: drawer.insideWidth, insideDepth: drawer.insideDepth } },
      warnings, status: 'Concept proposal; not a shop drawing or approved cut list' };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url; link.download = `${design.name.replace(/[^a-z0-9-]/gi, '-').slice(0, 70) || 'cabinet'}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage('Design JSON exported. Keep it with your proposal as a dimension record.');
  }
  return <>
    <header className="app-header compact-header no-print">
      <h1 className="sr-only">Cabinet planner</h1>
      <div className="project-tag"><span className="status-dot" />{unchanged ? 'Saved in this browser' : 'Unsaved design'}</div>
      <button className="button primary" disabled={!!errors.length} onClick={() => window.print()}>Print proposal <span aria-hidden="true">&#8599;</span></button>
    </header>
    <main className="compact-main no-print">
      <AnimatedContent className="dimension-strip" distance={10}>
        <div><span>INSIDE CORNER</span><strong>{fmt(c.angle)}<small> deg</small></strong></div>
        <div><span>EACH WALL RUN</span><strong>{fmt(c.wallRun)}<small> in</small></strong></div>
        <div><span>OVERALL HEIGHT</span><strong>{fmt(c.height)}<small> in</small></strong></div>
        <div><span>FRONT ENVELOPE</span><strong data-testid="front-width">{fmt(g.width)}<small> in</small></strong></div>
        <div><span>CENTER DEPTH</span><strong data-testid="center-depth">{fmt(g.depth)}<small> in</small></strong></div>
      </AnimatedContent>
      {message && <div className="notice" role="status"><span>{message}</span><button aria-label="Dismiss notification" onClick={() => setMessage('')}>Dismiss</button></div>}
      <div className="workspace">
        <AnimatedContent className="panel setup" role="complementary" aria-label="Space and layout" delay={0.08}>
          <details className="space-settings" open>
          <summary className="panel-heading"><span className="step">01</span><h2>The space</h2><span className="unit-badge">INCHES</span><span className="collapse-arrow" aria-hidden="true">&#9662;</span></summary>
          <div className="form-grid">
            <NumberField label="Wall run (each)" value={c.wallRun} change={v => config('wallRun', v)} />
            <NumberField label="Inside angle" value={c.angle} change={v => config('angle', v)} unit="deg" />
            <NumberField label="Overall height" value={c.height} change={v => config('height', v)} />
            <NumberField label="Wall clearance" value={c.wallGap} change={v => config('wallGap', v)} />
          </div>
          <p className="small-note">Wall runs start at the corner and end at the front. All panels and closed fronts stay inside that triangle. Flush fronts; no projecting handles.</p>
          <details className="materials" open>
            <summary>Materials & allowances</summary>
            <div className="form-grid">
              <NumberField label="Side / shelf panels" value={c.thickness} change={v => config('thickness', v)} />
              <NumberField label="Doors / fronts" value={c.frontThickness} change={v => config('frontThickness', v)} />
              <NumberField label="Drawer box stock" value={c.boxThickness} change={v => config('boxThickness', v)} />
              <NumberField label="Front gap / reveal" value={c.reveal} change={v => config('reveal', v)} />
              <NumberField label="Drawer side clearance" value={c.slideClearance} change={v => config('slideClearance', v)} />
            </div>
            <p className="small-note">Both angled side panels enclose the back. No additional back panel. Fractions such as 3/4 are accepted; press Enter or leave a field to apply.</p>
          </details>
          </details>
          <div className="panel-heading section-heading"><span className="step">02</span><h2>The layout</h2></div>
          <div className="preset-buttons" aria-label="Layout presets">
            <button onClick={() => choosePreset('balanced')}>Mixed</button><button onClick={() => choosePreset('library')}>Shelving</button><button onClick={() => choosePreset('drawers')}>Drawers</button>
          </div>
          <p className="small-note">Drag sections to reorder, or use the editor below. Presets replace the layout; save an idea before switching.</p>
          <div className="section-list">
            {[...placed].reverse().map((item, i) => <button key={item.id} data-section-id={item.id}
              data-layout-drag={!errors.length} className={`section-row ${item.id === s.id ? 'active' : ''} ${dragged === item.id ? 'dragging' : ''} ${dropTarget === item.id ? 'drop-target' : ''}`}
              onPointerDown={event => startSectionDrag(event, item.id)} onPointerMove={moveSectionDrag}
              onPointerUp={event => endSectionDrag(event)} onPointerCancel={event => endSectionDrag(event, true)}
              onClick={() => select(item.id)}>
              <span className={`section-icon ${item.kind}`} aria-hidden="true">{item.kind === 'drawers' ? '=' : item.kind === 'swing' ? '\u21b7' : item.kind === 'door' ? '||' : item.kind === 'single-door' ? '|' : '\u25a1'}</span>
              <span><strong>{item.name}</strong><small>{kinds[item.kind]}{i === 0 ? ' / top' : ''}</small></span>
              <span className="section-size">{fmt(item.height)}"</span>
            </button>)}
          </div>
          <button className="button add-section" disabled={placed.length >= 12 || !!errors.length} onClick={addSection}>+ Split top section</button>
          <div className="layout-editor"><h3>Drag layout</h3>
            <p className="small-note">Green bars resize in 1-inch steps; drag openings to reorder. Keyboard: focus a green bar and use Up/Down arrows.</p>
            {!errors.length && <FrontDrawing design={design} selected={s.id} select={select} compact resize={resizeLayout} reorder={reorderLayout} reportError={reportLayoutError} />}
            <p className="layout-status" role="status">{layoutStatus}</p>
          </div>
        </AnimatedContent>
        <AnimatedContent className="viewer-panel" role="region" aria-label="Cabinet views" delay={0.16}>
          <div className="viewer-toolbar">
            <div className="view-tabs" aria-label="Drawing view">
              <button aria-pressed={view === '3d'} onClick={() => setView('3d')}>3D view</button>
              <button aria-pressed={view === 'front'} onClick={() => setView('front')}>Front</button>
              <button aria-pressed={view === 'top'} onClick={() => setView('top')}>Top plan</button>
            </div>
            <button className="text-button" onClick={() => { setReset(v => v + 1); setOpenings({}); }}>Reset view</button>
          </div>
          <div className={`viewer ${view !== '3d' ? 'drawing-view' : ''}`}>
            {errors.length > 0 ? <div className="empty" role="alert"><p className="eyebrow">DIMENSIONS NEED ATTENTION</p><h3>Let's make this fit.</h3><ul>{errors.map(error => <li key={error}>{error}</li>)}</ul></div>
              : view === '3d' ? <SceneBoundary><Scene design={design} selected={s.id} onSelect={select} openings={openings} ghost={ghost} reset={reset} /></SceneBoundary>
                : view === 'front' ? <FrontDrawing design={design} selected={s.id} select={select} resize={resizeLayout} reorder={reorderLayout} reportError={reportLayoutError} />
                  : <TopDrawing design={design} selected={s.id} opening={opening} />}
            {!errors.length && view !== '3d' && <div className="viewer-caption"><span className="status-dot" />{view === 'front' ? 'Drag green bars to resize / drag openings to reorder' : 'Looking down / front of cabinet at the bottom'}</div>}
          </div>
          <div className="viewer-options">
            <label><input type="checkbox" checked={ghost} onChange={e => setGhost(e.target.checked)} disabled={view !== '3d'} /> See through outer panels</label>
            <span>Visual proportions are not a fabrication drawing</span>
          </div>
          <div className="finish-bar"><span>EXPLORE A FINISH</span>{Object.entries(finishes).map(([key, finish]) =>
            <button key={key} className={design.finish === key ? 'chosen' : ''} onClick={() => setDesign({ ...design, finish: key })} aria-pressed={design.finish === key}>
              <i style={{ background: finish.color }} />{finish.name}
            </button>)}</div>
          <div className="geometry-note"><span className="note-icon">i</span><div><strong>Drawers shaped for this corner.</strong><p>Triangular boxes follow the wedge, with stock thickness and side clearance deducted. This replaces the old rectangular drawer dimensions, including in saved layouts. Custom runners and supports still need the woodworker's design.</p></div></div>
        </AnimatedContent>
        <AnimatedContent className="panel inspector" role="complementary" aria-label="Make it yours" delay={0.24}>
          <div className="panel-heading"><span className="step">03</span><h2>Make it yours</h2></div>
          <p className="small-note">Hold a number and drag left/right to adjust. Click to type.</p>
          <p className="eyebrow selection-label">SELECTED SECTION</p>
          <label className="field"><span>Section name</span><input aria-label="Section name" value={s.name} maxLength={45} onChange={e => updateSection({ name: e.target.value })} /></label>
          <label className="field"><span>Storage type</span><select aria-label="Storage type" value={s.kind} onChange={e => { updateSection({ kind: e.target.value as StorageKind }); setOpening(0); }}>
            {Object.entries(kinds).map(([key, label]) => <option value={key} key={key}>{label}</option>)}
          </select></label>
          {s.kind === 'single-door' && <div className="field"><span>Door opens from</span>
            <div className="view-tabs hinge-toggle" role="group" aria-label="Hinge side">
              {(['left', 'right'] as const).map(side => <button key={side} aria-pressed={(s.hinge ?? 'left') === side}
                onClick={() => updateSection({ hinge: side })}>{side === 'left' ? 'Left hinge' : 'Right hinge'}</button>)}
            </div></div>}
          <NumberField key={`${s.id}-height`} label="Clear opening height" value={s.height} change={v => updateSection({ height: v })}
            readOnly={s.autoHeight} disabled={s.autoHeight && placed.length < 2}
            scrub={placed.length > 1 ? { ...limits.height, change: scrubHeight } : undefined}
            hint={s.autoHeight ? 'Top opening fills the remainder. Drag its value to trade space with the opening below.' : 'Inside opening, excluding the panels above and below.'} />
          <div className="height-steps"><button disabled={placed.length < 2 || !!errors.length} onClick={() => nudgeHeight(-1)} aria-label="Decrease opening height by 1 inch">-1 in</button>
            <button disabled={placed.length < 2 || !!errors.length} onClick={() => nudgeHeight(1)} aria-label="Increase opening height by 1 inch">+1 in</button></div>
          <p className="small-note">One-inch steps transfer space to or from the adjacent opening, including the top one.</p>
          {hasShelves(s.kind) && <>
            <NumberField key={`${s.id}-shelves`} label="Adjustable shelves" value={s.shelves} change={v => updateSection({ shelves: v })} unit="qty" step={1} scrub={limits.shelves} />
            <div className="readout"><span>Clear height per shelf space</span><strong>{fmt(shelfClearHeight(c, s))}"</strong><small>Even spacing. For uneven heights, use separate cubby sections.</small></div>
          </>}
          {s.kind === 'drawers' && <>
            <NumberField key={`${s.id}-drawers`} label="Number of drawers" value={s.drawers} change={v => updateSection({ drawers: v })} unit="qty" step={1} scrub={limits.drawers} />
            <div className="readout"><span>Triangular box outside (front W x center D)</span><strong>{fmt(drawer.width)} x {fmt(drawer.depth)}"</strong>
              <small>Usable triangular interior: {fmt(drawer.insideWidth)} x {fmt(drawer.insideDepth)}". Automatically follows the room angle and material/clearance settings. Not a rectangle or a verified slide installation.</small>
            </div>
          </>}
          {s.kind === 'swing' && <>
            <div className="form-grid">
              <NumberField key={`${s.id}-width`} label="Box outside width" value={s.boxWidth} change={v => updateSection({ boxWidth: v })} step={1} scrub={limits.box} />
              <NumberField key={`${s.id}-depth`} label="Box outside depth" value={s.boxDepth} change={v => updateSection({ boxDepth: v })} step={1} scrub={limits.box} />
            </div>
            <div className="readout"><span>Usable tray interior (W x D)</span><strong>{fmt(s.boxWidth - 2 * c.boxThickness)} x {fmt(s.boxDepth - 2 * c.boxThickness)}"</strong></div>
          </>}
          {s.kind !== 'cubby' && <div className="opening-control">
            <label htmlFor="opening">Try opening it <strong>{Math.round(opening * (s.kind === 'drawers' ? 100 : 90))}{s.kind === 'drawers' ? '%' : ' deg'}</strong></label>
            <input id="opening" aria-label="Opening position" type="range" min="0" max="100" value={opening * 100} onChange={e => setOpening(Number(e.target.value) / 100)} />
            <div><span>Closed</span><span>{s.kind === 'drawers' ? '90% of box depth' : 'Open 90 deg'}</span></div>
            <p className="small-note">{view === 'front' ? 'The front drawing stays closed for dimensioning. Use 3D to see movement.' : 'Each section stays open as you move between them. Reset view closes everything. No hardware travel or load rating is implied.'}</p>
          </div>}
          {s.kind === 'swing' && <div className={`fit-note ${swing.clear ? '' : 'warning'}`}>
            <strong>{swing.clear ? 'Tray-only sweep clears the walls' : `Tray collision by ~${swing.firstCollision} deg`}</strong>
            <p>Simple front-left pivot, sampled every degree. Real hinges, linkage, access, loads, and clearances need a hardware specialist. Not a model of a commercial swing-out unit.</p>
          </div>}
          <div className="readout neutral"><span>Triangular shelf / front x center depth</span><strong>{fmt(g.shelfWidth)} x {fmt(g.usableDepth)}"</strong><small>These are maximum extents, not a rectangular shelf size. Material and front allowances are already subtracted.</small></div>
          <div className="section-actions">
            <button onClick={() => moveSection(1)} disabled={s.id === placed[placed.length - 1].id}>Move up</button>
            <button onClick={() => moveSection(-1)} disabled={s.id === placed[0].id}>Move down</button>
            <button className="danger" disabled={placed.length === 1} onClick={removeSection}>Remove</button>
          </div>
        </AnimatedContent>
      </div>
      {screenWarnings.length > 0 && <section className="review-notes" aria-label="Fit warnings"><ul>{screenWarnings.map(w => <li key={w}>{w}</li>)}</ul></section>}
      <AnimatedContent className="save-panel compact-save-panel" role="region" aria-label="Save design" delay={0.32} distance={12}>
        <div className="save-controls"><label className="field"><span>Design name</span><input aria-label="Design name" value={design.name} maxLength={80} onChange={e => setDesign({ ...design, name: e.target.value })} /></label>
          <div><button className="button primary" disabled={!!errors.length} onClick={saveDesign}>Save design</button><button className="button" disabled={!!errors.length} onClick={exportDesign}>Export JSON</button></div></div>
      </AnimatedContent>
      {saved.length > 0 && <section className="saved-designs" aria-label="Saved variations">{saved.map(item => <button key={item.name}
        onClick={() => { setDesign(item); select(item.sections[0].id); setMessage(`Loaded "${item.name}".`); }}>
        <span>SAVED VARIATION</span><strong>{item.name}</strong><small>{fmt(item.config.angle)} deg / {fmt(item.config.wallRun)}" each wall / {fmt(item.config.height)}" high</small>
        <small>{item.sections.map(section => kinds[section.kind]).join(' + ')}</small><b>Load design &#8594;</b>
      </button>)}</section>}
      <footer><span>Designed for conversation, not the saw.</span><span>3D guidance: <a href="https://github.com/CloudAI-X/threejs-skills" target="_blank" rel="noreferrer">Three.js skills</a> / <a href="https://github.com/emalorenzo/three-agent-skills" target="_blank" rel="noreferrer">React Three Fiber skills</a></span></footer>
    </main>
    <section className="print-only proposal">
      <p className="eyebrow">CUSTOM CABINET / REQUEST FOR DESIGN & QUOTATION</p><h1>{design.name}</h1>
      <p>Concept proposal. Dimensions in inches. Verify site measurements and construction details before fabrication.</p>
      <div className="print-specs"><strong>{fmt(c.angle)} deg interior corner</strong><strong>{fmt(c.wallRun)}" along each wall</strong><strong>{fmt(c.height)}" total height</strong><strong>{fmt(g.width)}" front envelope</strong></div>
      {errors.length ? <div><h2>INVALID DIMENSIONS - NOT FOR FABRICATION</h2><ul>{errors.map(e => <li key={e}>{e}</li>)}</ul></div>
        : <div className="print-drawings"><FrontDrawing design={design} /><TopDrawing design={design} /></div>}
      <h2>Requested layout (bottom to top)</h2>
      <table><thead><tr><th>Section</th><th>Use</th><th>Clear height</th><th>Internal arrangement</th></tr></thead>
        <tbody>{placed.map(item => <tr key={item.id}><td>{item.name}</td><td>{kinds[item.kind]}</td><td>{fmt(item.height)}"</td><td>
          {item.kind === 'drawers' ? `${item.drawers} triangular boxes, ${fmt(drawer.width)}" front W x ${fmt(drawer.depth)}" center D outside`
            : item.kind === 'swing' ? `${fmt(item.boxWidth)}" W x ${fmt(item.boxDepth)}" D tray, conceptual pivot`
              : `${item.kind === 'single-door' ? `${item.hinge ?? 'left'} hinge; ` : ''}${item.shelves} shelves; ${fmt(shelfClearHeight(c, item))}" clear per space`}
        </td></tr>)}</tbody></table>
      <h2>Envelope and material assumptions</h2>
      <p>Symmetric triangular footprint. Wall-run limit includes all modeled material. Straight center depth: {fmt(g.depth)}". Panels: {fmt(c.thickness)}"; inset fronts: {fmt(c.frontThickness)}"; box stock: {fmt(c.boxThickness)}"; front gap: {fmt(c.reveal)}"; wall clearance perpendicular to each wall: {fmt(c.wallGap)}". Triangular drawer side allowance: {fmt(c.slideClearance)}" perpendicular to each side. Runner/support hardware is not modeled; no parallel side rails are assumed. Finish reference: {finishes[design.finish].name}.</p>
      <p>Angled side panels enclose the back; no separate back. Top and bottom included in height. No projecting handles, crown, feet, plinth, or countertop. Wall scribing, joinery, actual stock thickness, hardware, service access, load ratings, and tolerances require the maker's design. Shelf dimensions are triangular extents, not rectangular cut sizes.</p>
      <h2>Review with the woodworker</h2>
      <ul>{warnings.map(w => <li key={w}>{w}</li>)}<li>Confirm all room measurements, obstacles, outlet access, floor level, anchoring and tip-over prevention.</li><li>Confirm installation at {fmt(c.height)}" height: ceiling clearance, delivery route, and sectional assembly.</li><li>Specify actual hinges/slides and check full swept hardware envelopes before approving doors, drawers, or trays.</li><li>Please quote materials, finish, hardware, installation, timeline, and any recommended layout revisions.</li></ul>
    </section>
  </>;
}
