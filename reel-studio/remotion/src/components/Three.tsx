import {ThreeCanvas} from '@remotion/three';
import {useThree} from '@react-three/fiber';
import {useEffect, useMemo, useState} from 'react';
import {continueRender, delayRender, interpolate, random, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import * as THREE from 'three';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {BODY, CANVAS_HEAD, fontsReady, HEAD} from '../fonts';
import type {OverlayProps} from './Overlays';

// Studio-Reflexionen fuer Metall/Lack-Look (Keramik = Glanz)
const Env: React.FC = () => {
  const {gl, scene} = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    return () => pmrem.dispose();
  }, [gl, scene]);
  return null;
};

const useCoinFace = (text: string, accent: string, dark: string) => {
  const [handle] = useState(() => delayRender('coin-texture'));
  const [tex, setTex] = useState<THREE.CanvasTexture | null>(null);
  useEffect(() => {
    fontsReady.then(() => {
      const c = document.createElement('canvas');
      c.width = c.height = 1024;
      const g = c.getContext('2d')!;
      const grd = g.createRadialGradient(420, 380, 40, 512, 512, 520);
      grd.addColorStop(0, '#fff7c9');
      grd.addColorStop(0.5, accent);
      grd.addColorStop(1, '#a88400');
      g.fillStyle = grd;
      g.fillRect(0, 0, 1024, 1024);
      g.lineWidth = 24;
      g.strokeStyle = dark;
      g.beginPath();
      g.arc(512, 512, 440, 0, Math.PI * 2);
      g.stroke();
      g.fillStyle = dark;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.font = `300px ${CANVAS_HEAD}`;
      g.fillText(text, 512, 548);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
      setTex(t);
      continueRender(handle);
    });
  }, [text, accent, dark, handle]);
  return tex;
};

// Sich drehende 3D-Muenze mit Rabatt (z. B. "-50%")
export const Badge3D: React.FC<OverlayProps> = ({o, brand}) => {
  const f = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const tex = useCoinFace(o.text, brand.accent, brand.dark);
  const size: number = o.size ?? 340;
  const t = f / fps;
  const s = spring({frame: f, fps, config: {damping: 12, stiffness: 90}});
  const end = (o.to - o.from) * fps;
  const out = interpolate(f, [end - 8, end], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const rotY = (1 - s) * Math.PI * 4 + Math.sin(t * 2) * 0.35;
  return (
    <div style={{position: 'absolute', left: o.x * width - size / 2, top: o.y * height - size / 2, width: size, height: size}}>
      <div style={{position: 'absolute', inset: '12%', borderRadius: '50%', background: `radial-gradient(circle, ${brand.accent}88 0%, transparent 70%)`, opacity: s * out, transform: `scale(${1.25 + 0.08 * Math.sin(t * 3)})`}} />
      <ThreeCanvas width={size} height={size} camera={{fov: 30, position: [0, 0, 5.2]}}>
        <Env />
        <ambientLight intensity={0.5} />
        <directionalLight position={[3, 4, 5]} intensity={2.4} />
        <directionalLight position={[-4, -2, 3]} intensity={0.8} />
        <group rotation={[0.18, rotY, -0.12]} position={[0, Math.sin(t * 2.5) * 0.08, 0]} scale={s * out}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[1, 1, 0.24, 96]} />
            <meshStandardMaterial color="#c9a200" metalness={0.9} roughness={0.22} />
          </mesh>
          {tex && (
            <>
              <mesh position={[0, 0, 0.121]}>
                <circleGeometry args={[1, 96]} />
                <meshStandardMaterial map={tex} metalness={0.35} roughness={0.28} />
              </mesh>
              <mesh position={[0, 0, -0.121]} rotation={[0, Math.PI, 0]}>
                <circleGeometry args={[1, 96]} />
                <meshStandardMaterial map={tex} metalness={0.35} roughness={0.28} />
              </mesh>
            </>
          )}
        </group>
      </ThreeCanvas>
    </div>
  );
};

const Flakes: React.FC<{count: number; t: number; opacity: number}> = ({count, t, opacity}) => {
  const sprite = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.4, 'rgba(255,255,255,.8)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }, []);
  const seeds = useMemo(
    () => Array.from({length: count}, (_, i) => ({
      x: (random(`x${i}`) - 0.5) * 9, y: random(`y${i}`) * 12, z: (random(`z${i}`) - 0.5) * 6,
      v: 0.6 + random(`v${i}`) * 1.0, p: random(`p${i}`) * 6.28,
    })),
    [count],
  );
  const geo = useMemo(() => new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3)), [count]);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  seeds.forEach((b, i) => {
    const y = (((b.y - b.v * t) % 12) + 12) % 12 - 6;
    pos.setXYZ(i, b.x + Math.sin(t * 1.3 + b.p) * 0.25, y, b.z);
  });
  pos.needsUpdate = true;
  return (
    <points geometry={geo}>
      <pointsMaterial map={sprite} size={0.11} transparent depthWrite={false} opacity={opacity} sizeAttenuation />
    </points>
  );
};

const Snowflake: React.FC<{color: string}> = ({color}) => (
  <svg width="46" height="46" viewBox="-12 -12 24 24" stroke={color} strokeWidth="2" strokeLinecap="round" fill="none">
    {[0, 60, 120].map((r) => (
      <g key={r} transform={`rotate(${r})`}>
        <line y1={-10} y2={10} />
        <path d="M-3 -7 L0 -10 L3 -7 M-3 7 L0 10 L3 7" />
      </g>
    ))}
  </svg>
);

// 3D-Schneefall mit Tiefenstaffelung + Label
export const Snow: React.FC<OverlayProps> = ({o, brand}) => {
  const f = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const end = (o.to - o.from) * fps;
  const op = interpolate(f, [0, 8, end - 8, end], [0, 1, 1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const s = spring({frame: f - 4, fps, config: {damping: 12, stiffness: 150}});
  return (
    <>
      <div style={{position: 'absolute', inset: 0}}>
        <ThreeCanvas width={width} height={height} camera={{fov: 60, position: [0, 0, 6]}}>
          <Flakes count={420} t={f / fps + 3} opacity={op} />
        </ThreeCanvas>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: o.y * height, display: 'flex', justifyContent: 'center', opacity: op}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 18, padding: '18px 34px', borderRadius: 999, background: 'rgba(10,12,16,.72)', border: `3px solid ${brand.accent}`, transform: `scale(${s})`}}>
          <Snowflake color={brand.accent} />
          <div style={{fontFamily: HEAD, fontSize: 64, lineHeight: 1, color: '#fff'}}>{o.label}</div>
        </div>
      </div>
      {o.sub && (
        <div style={{position: 'absolute', left: 0, right: 0, top: o.y * height + 120, textAlign: 'center', fontFamily: BODY, fontWeight: 800, fontSize: 38, color: '#fff', textShadow: '0 4px 16px rgba(0,0,0,.7)', opacity: op * s}}>
          {o.sub}
        </div>
      )}
    </>
  );
};
