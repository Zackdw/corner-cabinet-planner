import { useEffect, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Edges, OrbitControls } from '@react-three/drei';
import { Shape } from 'three';
import type { Design, PlacedSection, Point } from './model';
import { doorLeaves, finishes, geometry, hasShelves, layout, shelfClearHeight, triangularDrawer } from './model';

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
  return <group onClick={event => { event.stopPropagation(); select(); }}>
    {hasShelves(s.kind) && Array.from({ length: s.shelves }, (_, i) => (
      <Slab key={i} points={g.shelf} bottom={s.bottom + (i + 1) * shelfClearHeight(c, s) + i * c.thickness}
        height={c.thickness} color={frontColor} />
    ))}
    {s.kind === 'cubby' && <mesh position={[0, s.bottom + s.height / 2, g.frontInside]}>
      <planeGeometry args={[g.frontWidth, s.height]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>}
    {(s.kind === 'door' || s.kind === 'single-door') && doorLeaves(c, s).map(({ side, width: leafWidth }) => {
      return <group key={side} position={[side * g.frontWidth / 2, s.bottom + s.height / 2, g.depth]}
        rotation={[0, side * opening * Math.PI / 2, 0]}>
        <Board size={[leafWidth, s.height - 2 * gap, c.frontThickness]}
          at={[-side * leafWidth / 2, 0, -c.frontThickness / 2]} color={frontColor} />
      </group>;
    })}
    {s.kind === 'drawers' && <>
      {Array.from({ length: s.drawers }, (_, i) => {
        const h = (s.height - (s.drawers + 1) * gap) / s.drawers;
        const y = s.bottom + gap + i * (h + gap);
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
  const c = design.config, g = geometry(c), sections = layout(c, design.sections);
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
    <Slab points={g.leftSide} bottom={c.thickness} height={c.height - 2 * c.thickness} color={color} ghost={ghost} />
    <Slab points={g.rightSide} bottom={c.thickness} height={c.height - 2 * c.thickness} color={color} ghost={ghost} />
    <Slab points={g.outer} bottom={0} height={c.thickness} color={color} />
    <Slab points={g.outer} bottom={c.height - c.thickness} height={c.thickness} color={color} ghost={ghost} />
    {sections.map((s, i) => <group key={s.id}>
      {i < sections.length - 1 && <Slab points={g.shelf} bottom={s.top} height={c.thickness} color={color} />}
      <Storage design={design} section={s} opening={openings[s.id] ?? 0}
        selected={s.id === selected} select={() => onSelect(s.id)} />
    </group>)}
  </Canvas>;
}
