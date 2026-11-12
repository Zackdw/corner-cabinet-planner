import { useEffect, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Edges, OrbitControls } from '@react-three/drei';
import { Shape } from 'three';
import type { Design, PlacedSection, Point } from './model';
import { BLUM_HINGE, carcass, doorLeaves, finishes, frameHeader, frameOpening, frameParts, geometry, HINGE_BLOCK_HEIGHT, hingeBlocks, hingeHeights, hingePlate, hasLight, hasShelves, layout, lightGroove, shelfClearHeight, triangularDrawer } from './model';

function Slab({ points, bottom, height, color, ghost = false }: {
  points: Point[]; bottom: number; height: number; color: string; ghost?: boolean;
}) {
  const shape = useMemo(() => {
    const result = new Shape();
    points.forEach(([x, z], i) => i ? result.lineTo(x, -z) : result.moveTo(x, -z));
    result.closePath();
    return result;
  }, [points]);
  return <mesh position={[0, bottom, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
    <extrudeGeometry args={[shape, { depth: height, bevelEnabled: false }]} />
    <meshStandardMaterial color={color} roughness={0.78} transparent={ghost} opacity={ghost ? 0.12 : 1} depthWrite={!ghost} />
    <Edges color={ghost ? '#a9a297' : '#69533e'} transparent opacity={ghost ? 0.2 : 0.42} />
  </mesh>;
}
function Board({ size, at, color }: { size: [number, number, number]; at: [number, number, number]; color: string }) {
  return <mesh position={at} castShadow receiveShadow>
    <boxGeometry args={size} />
    <meshStandardMaterial color={color} roughness={0.75} />
    <Edges color="#614c37" transparent opacity={0.35} />
  </mesh>;
}
const NICKEL = { color: '#b9bec4', metalness: 0.75, roughness: 0.32 };
/** A metal bar between two plan points (x, z) at height y. */
function Bar({ from: [xa, za], to: [xb, zb], y, height, thickness }: {
  from: Point; to: Point; y: number; height: number; thickness: number;
}) {
  const dx = xb - xa, dz = zb - za, length = Math.hypot(dx, dz);
  return <mesh position={[(xa + xb) / 2, y, (za + zb) / 2]} rotation={[0, Math.atan2(-dz, dx), 0]} castShadow>
    <boxGeometry args={[length, height, thickness]} />
    <meshStandardMaterial {...NICKEL} />
  </mesh>;
}
/**
 * Blum concealed hinge on one door leaf, in the door's own coordinates (origin at the
 * pivot edge, front face at z = 0), so the cup and arm swing with the door.
 */
function HingeOnDoor({ side, y, plate, pivotX, depth, frontThickness }: {
  side: number; y: number; plate: { x0: number; x1: number; z0: number; z1: number };
  pivotX: number; depth: number; frontThickness: number;
}) {
  const cupX = -side * BLUM_HINGE.cupCenterFromEdge, back = -frontThickness;
  const plateLocal: Point = [side * (plate.x0 + plate.x1) / 2 - pivotX, (plate.z0 + plate.z1) / 2 - depth];
  return <group>
    <mesh position={[cupX, y, back - 0.02]} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[BLUM_HINGE.cupDiameter / 2 + 0.08, BLUM_HINGE.cupDiameter / 2 + 0.08, 0.06, 24]} />
      <meshStandardMaterial {...NICKEL} />
    </mesh>
    <Bar from={[cupX, back - 0.2]} to={plateLocal} y={y} height={0.55} thickness={0.32} />
  </group>;
}
function TrayBox({ width, depth, height, thickness, color }: {
  width: number; depth: number; height: number; thickness: number; color: string;
}) {
  return <group>
    <Board size={[width, thickness, depth]} at={[width / 2, thickness / 2, -depth / 2]} color={color} />
    <Board size={[thickness, height - thickness, depth]} at={[thickness / 2, (height + thickness) / 2, -depth / 2]} color={color} />
    <Board size={[thickness, height - thickness, depth]} at={[width - thickness / 2, (height + thickness) / 2, -depth / 2]} color={color} />
    <Board size={[width - 2 * thickness, height - thickness, thickness]} at={[width / 2, (height + thickness) / 2, -depth + thickness / 2]} color={color} />
    <Board size={[width - 2 * thickness, height - thickness, thickness]} at={[width / 2, (height + thickness) / 2, -thickness / 2]} color={color} />
  </group>;
}
function Storage({ design, section: s, opening, selected, select }: {
  design: Design; section: PlacedSection; opening: number; selected: boolean; select: () => void;
}) {
  const c = design.config, g = geometry(c), color = finishes[design.finish].color;
  const frontColor = selected ? '#d5af6f' : color;
  const gap = c.reveal;
  const drawer = triangularDrawer(c);
  const groove = hasLight(s) ? lightGroove(c) : null;
  const [ob, ot] = frameOpening(c, s), oh = ot - ob;
  const plate = hingePlate(c);
  return <group onClick={event => { event.stopPropagation(); select(); }}>
    {(s.kind === 'door' || s.kind === 'single-door') && doorLeaves(c, s).flatMap(({ side }) => hingeHeights(c, s).map(hy =>
      <mesh key={`plate-${side}-${hy}`} position={[side * (plate.x0 + plate.x1) / 2, hy, (plate.z0 + plate.z1) / 2]}>
        <boxGeometry args={[plate.x1 - plate.x0, BLUM_HINGE.plateHeight, plate.z1 - plate.z0]} />
        <meshStandardMaterial {...NICKEL} />
      </mesh>))}
    {hingeBlocks(c, s).map((b, i) => <Slab key={`block-${i}`} points={b.points}
      bottom={b.y - HINGE_BLOCK_HEIGHT / 2} height={HINGE_BLOCK_HEIGHT} color="#b98d58" />)}
    {groove && <group>
      <mesh position={[0, s.top - 0.03, groove.zCenter]}>
        <boxGeometry args={[groove.length, 0.06, groove.width]} />
        <meshStandardMaterial color="#fff4d6" emissive="#ffd27a" emissiveIntensity={1.6} />
      </mesh>
      <pointLight position={[0, s.top - 1, groove.zCenter - 4]} color="#ffd9a0" intensity={140}
        distance={Math.max(20, s.height * 2)} decay={2} />
    </group>}
    {hasShelves(s.kind) && Array.from({ length: s.shelves }, (_, i) => (
      <Slab key={i} points={g.shelf} bottom={s.bottom + (i + 1) * shelfClearHeight(c, s) + i * c.thickness}
        height={c.thickness} color={frontColor} />
    ))}
    {s.kind === 'cubby' && <mesh position={[0, s.bottom + s.height / 2, g.frontInside]}>
      <planeGeometry args={[g.frontWidth, s.height]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>}
    {(s.kind === 'door' || s.kind === 'single-door') && doorLeaves(c, s).map(({ side, width: leafWidth }) => {
      return <group key={side} position={[side * g.frontWidth / 2, ob + oh / 2, g.depth]}
        rotation={[0, side * opening * Math.PI / 2, 0]}>
        <Board size={[leafWidth, oh - 2 * gap, c.frontThickness]}
          at={[-side * leafWidth / 2, 0, -c.frontThickness / 2]} color={frontColor} />
        {hingeHeights(c, s).map(hy => <HingeOnDoor key={hy} side={side} y={hy - (ob + oh / 2)} plate={plate}
          pivotX={side * g.frontWidth / 2} depth={g.depth} frontThickness={c.frontThickness} />)}
      </group>;
    })}
    {s.kind === 'drawers' && <>
      {Array.from({ length: s.drawers }, (_, i) => {
        const h = (oh - (s.drawers + 1) * gap) / s.drawers;
        const y = ob + gap + i * (h + gap);
        return <group key={i} position={[0, 0, opening * drawer.depth * 0.9]}>
          <Board size={[g.frontWidth, h, c.frontThickness]} at={[0, y + h / 2, g.depth - c.frontThickness / 2]} color={frontColor} />
          <group position={[0, y + 0.5, 0]}>
            <Slab points={drawer.outer} bottom={0} height={c.boxThickness} color="#d9c7a5" />
            {drawer.walls.map((points, wall) => <Slab key={wall} points={points} bottom={c.boxThickness}
              height={h - 1 - c.boxThickness} color="#d9c7a5" />)}
          </group>
        </group>;
      })}
    </>}
    {s.kind === 'swing' && <group position={[-s.boxWidth / 2, s.bottom + gap, g.frontInside]}
      rotation={[0, -opening * Math.PI / 2, 0]}>
      <TrayBox width={s.boxWidth} depth={s.boxDepth} height={Math.min(3, s.height - 2 * gap)}
        thickness={c.boxThickness} color={frontColor} />
    </group>}
  </group>;
}
function CameraPosition({ height, depth, reset }: { height: number; depth: number; reset: number }) {
  const { camera, invalidate } = useThree();
  useEffect(() => {
    const distance = Math.max(height, depth * 2);
    camera.position.set(distance * 0.72, height * 0.67, depth / 2 + distance * 1.95);
    camera.lookAt(0, height / 2, depth / 2);
    camera.updateProjectionMatrix();
    invalidate();
  }, [camera, height, depth, reset, invalidate]);
  return null;
}
export function Scene({ design, selected, onSelect, openings, ghost, reset }: {
  design: Design; selected: string; onSelect: (id: string) => void; openings: Record<string, number>; ghost: boolean; reset: number;
}) {
  const c = design.config, g = geometry(c), sections = layout(c, design.sections), box = carcass(c);
  // With a one-piece header, the trim board runs down to the upper doors and the stiles stop under it.
  const trimBottom = frameHeader(c)?.bottom ?? box.top;
  const color = finishes[design.finish].color;
  return <Canvas shadows frameloop="demand" dpr={[1, 2]} camera={{ fov: 34, near: 0.1, far: 1500 }} gl={{ alpha: true }}
    fallback={<div className="empty">WebGL is unavailable. Front and top views still work.</div>}>
    <ambientLight intensity={1.05} />
    <hemisphereLight args={['#fff8e9', '#b6b4a7', 1.1]} />
    <directionalLight position={[60, 140, 100]} intensity={2.2} castShadow shadow-mapSize={[2048, 2048]}
      shadow-camera-left={-90} shadow-camera-right={90} shadow-camera-top={150} shadow-camera-bottom={-40}
      shadow-camera-far={450} shadow-bias={-0.001} />
    <CameraPosition height={c.height} depth={g.depth} reset={reset} />
    <OrbitControls key={reset} makeDefault target={[0, c.height / 2, g.depth / 2]}
      minDistance={20} maxDistance={550} maxPolarAngle={Math.PI * 0.88} />
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.06, 0]} receiveShadow>
      <planeGeometry args={[1500, 1500]} />
      <shadowMaterial transparent opacity={0.14} />
    </mesh>
    <Slab points={g.leftSide} bottom={box.base + c.thickness} height={box.top - box.base - 2 * c.thickness} color={color} ghost={ghost} />
    <Slab points={g.rightSide} bottom={box.base + c.thickness} height={box.top - box.base - 2 * c.thickness} color={color} ghost={ghost} />
    <Slab points={g.carcassOuter} bottom={box.base} height={c.thickness} color={color} />
    <Slab points={g.carcassOuter} bottom={box.top - c.thickness} height={c.thickness} color={color} ghost={ghost} />
    {g.stiles.map((points, i) => <Slab key={`stile-${i}`} points={points} bottom={box.base} height={trimBottom - box.base} color={color} />)}
    {frameParts(c, design.sections)?.rails.map(([a, b], i) => <Board key={`rail-${i}`} size={[g.frameOpening, b - a, c.frontThickness]}
      at={[0, (a + b) / 2, g.depth - c.frontThickness / 2]} color={color} />)}
    {box.base > 0 && (() => {
      const zk = g.depth - c.toeKickDepth, xk = g.outerHalf * (zk - g.outerTip) / (g.depth - g.outerTip);
      return <Slab points={[[0, g.outerTip], [xk, zk], [-xk, zk]]} bottom={0} height={box.base} color="#5f5446" />;
    })()}
    {c.topTrim > 0 && <Board size={[2 * g.outerHalf, c.height - trimBottom, c.frontThickness]}
      at={[0, (trimBottom + c.height) / 2, g.depth - c.frontThickness / 2]} color={color} />}
    {sections.map((s, i) => <group key={s.id}>
      {i < sections.length - 1 && <Slab points={g.shelf} bottom={s.top} height={c.thickness} color={color} />}
      <Storage design={design} section={s} opening={openings[s.id] ?? 0}
        selected={s.id === selected} select={() => onSelect(s.id)} />
    </group>)}
  </Canvas>;
}
