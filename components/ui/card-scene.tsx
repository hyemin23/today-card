'use client';

import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, RoundedBox } from '@react-three/drei';
import type { Group } from 'three';

/**
 * Monotone "floating card-news" 3D scene (React Three Fiber).
 * On-brand replacement for the generic Spline robot — a loose cluster of
 * INK cards (paper + ink) drifting in space, the whole group parallaxing
 * toward the pointer. Pure monochrome, low-poly, transparent background so
 * it sits on the dark showcase band.
 */

type Tone = 'paper' | 'ink';

interface CardDef {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
  tone: Tone;
  speed: number;
}

// tight, center-weighted cluster (centroid ≈ origin) so the cards gather mid-stage
const CARDS: CardDef[] = [
  { position: [0, 0, 0.3], rotation: [0.08, -0.16, 0.04], scale: 1.0, tone: 'ink', speed: 1.3 },
  { position: [-1.2, 0.5, -0.5], rotation: [0.05, 0.28, -0.07], scale: 0.9, tone: 'paper', speed: 1.7 },
  { position: [1.15, -0.18, -0.4], rotation: [-0.05, -0.3, 0.09], scale: 0.92, tone: 'paper', speed: 1.45 },
  { position: [0.5, 0.85, -1.4], rotation: [0.09, 0.1, -0.1], scale: 0.76, tone: 'paper', speed: 2.0 },
  { position: [-0.65, -0.8, -0.9], rotation: [-0.07, 0.2, 0.05], scale: 0.74, tone: 'ink', speed: 1.85 },
];

function NewsCard({ position, rotation, scale, tone, speed }: CardDef) {
  const isInk = tone === 'ink';
  const face = isInk ? '#17150f' : '#f1efe8';
  const detail = isInk ? '#d8d3c8' : '#1a1813';
  const bar = (
    x: number,
    y: number,
    w: number,
    h: number,
    o: number
  ) => (
    <mesh position={[x, y, 0.05]}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial color={detail} transparent opacity={o} />
    </mesh>
  );
  return (
    <Float speed={speed} rotationIntensity={0.4} floatIntensity={0.5}>
      <group position={position} rotation={rotation} scale={scale}>
        <RoundedBox args={[1.8, 2.4, 0.09]} radius={0.07} smoothness={4}>
          <meshStandardMaterial color={face} roughness={0.55} metalness={0.08} />
        </RoundedBox>
        {/* category tag + headline + body lines → reads as a card-news card */}
        {bar(-0.45, 0.85, 0.62, 0.16, isInk ? 0.6 : 0.8)}
        {bar(0, 0.2, 1.2, 0.16, isInk ? 0.9 : 0.95)}
        {bar(-0.1, -0.05, 1.0, 0.16, isInk ? 0.9 : 0.95)}
        {bar(-0.25, -0.46, 0.8, 0.07, isInk ? 0.4 : 0.5)}
        {bar(-0.35, -0.62, 0.6, 0.07, isInk ? 0.4 : 0.5)}
      </group>
    </Float>
  );
}

function Scene() {
  const group = useRef<Group>(null);
  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    g.rotation.y += (state.pointer.x * 0.35 - g.rotation.y) * 0.045;
    g.rotation.x += (-state.pointer.y * 0.22 - g.rotation.x) * 0.045;
  });
  return (
    <>
      <ambientLight intensity={0.75} />
      <directionalLight position={[4, 6, 5]} intensity={1.15} />
      <directionalLight position={[-5, -3, -4]} intensity={0.35} />
      <group ref={group}>
        {CARDS.map((c, i) => (
          <NewsCard key={i} {...c} />
        ))}
      </group>
    </>
  );
}

export default function CardScene({ className }: { className?: string }) {
  return (
    <Canvas
      className={className}
      dpr={[1, 1.8]}
      gl={{ alpha: true, antialias: true }}
      camera={{ position: [0, 0, 8.4], fov: 35 }}
    >
      <Scene />
    </Canvas>
  );
}
