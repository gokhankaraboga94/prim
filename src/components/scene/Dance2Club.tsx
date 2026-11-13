import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { DANCE2_SECONDS, DANCE3_SECONDS, danceT } from "../../danceReel";

const CYAN = "#3de7ff";
const AMBER = "#ffc15a";
const MAGENTA = "#ff4fd8";
const LIME = "#7cff6b";

/** Neon club built for first-frame stop-scroll — dense stage, not empty void. */
export function Dance2Club({ lite = false }: { lite?: boolean }) {
  const ring = useRef<THREE.Mesh>(null);
  const ring2 = useRef<THREE.Mesh>(null);
  const ring3 = useRef<THREE.Mesh>(null);
  const screens = useRef<THREE.Group>(null);
  const ball = useRef<THREE.Mesh>(null);
  const pulse = useRef<THREE.PointLight>(null);
  const spots = useRef<THREE.Group>(null);

  const mats = useMemo(() => {
    const neon = (color: string) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 });
    return {
      floor: new THREE.MeshLambertMaterial({ color: "#080a10" }),
      stage: new THREE.MeshLambertMaterial({ color: "#12151e" }),
      tile: new THREE.MeshLambertMaterial({ color: "#1a1f2c" }),
      cyan: neon(CYAN),
      amber: neon(AMBER),
      magenta: neon(MAGENTA),
      lime: neon(LIME),
      wall: new THREE.MeshLambertMaterial({ color: "#0d1018" }),
      metal: new THREE.MeshLambertMaterial({ color: "#2a303c" }),
      screen: new THREE.MeshBasicMaterial({ color: "#152033" }),
      ball: new THREE.MeshBasicMaterial({ color: "#e8f6ff" }),
    };
  }, []);

  const pillars = useMemo(() => {
    const n = lite ? 6 : 12;
    const out: Array<{ x: number; z: number; h: number; tone: "cyan" | "amber" | "magenta" | "lime" }> = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = 7.4;
      const tones = ["cyan", "amber", "magenta", "lime"] as const;
      out.push({
        x: Math.cos(a) * r,
        z: Math.sin(a) * r - 1.35,
        h: 5.4 + (i % 3) * 0.55,
        tone: tones[i % 4],
      });
    }
    return out;
  }, [lite]);

  const segs = lite ? 32 : 64;
  const spotN = lite ? 1 : 4;

  useFrame(() => {
    const t = danceT();
    const u = Math.min(1, Math.max(0, t) / Math.max(DANCE2_SECONDS, DANCE3_SECONDS));
    const beat = 0.5 + 0.5 * Math.sin(t * 9.4);
    const swirl = t * 0.7;
    if (ring.current) {
      ring.current.rotation.z = swirl * 0.4;
      const s = 1 + beat * 0.06;
      ring.current.scale.setScalar(s);
      (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.65 + beat * 0.3;
    }
    if (ring2.current) {
      ring2.current.rotation.z = -swirl * 0.65;
      (ring2.current.material as THREE.MeshBasicMaterial).opacity = 0.4 + (1 - beat) * 0.45;
    }
    if (ring3.current) {
      ring3.current.rotation.z = swirl * 0.25;
      const s = 1 + (1 - beat) * 0.05;
      ring3.current.scale.setScalar(s);
    }
    if (ball.current) {
      ball.current.rotation.y = t * 1.4;
      ball.current.rotation.x = Math.sin(t * 0.8) * 0.35;
    }
    if (screens.current) {
      screens.current.children.forEach((child, i) => {
        const mesh = child as THREE.Mesh;
        const m = mesh.material as THREE.MeshBasicMaterial;
        const flash = 0.35 + 0.65 * Math.max(0, Math.sin(t * 6 + i * 1.3));
        m.color.setRGB(0.08 + flash * 0.15, 0.35 + flash * 0.55, 0.55 + flash * 0.4);
      });
    }
    if (pulse.current) {
      pulse.current.intensity = (lite ? 8 : 10) + beat * (lite ? 10 : 16) + u * 5;
      pulse.current.position.y = 3.8 + Math.sin(t * 2.6) * 0.4;
    }
    if (spots.current) {
      spots.current.children.forEach((child, i) => {
        const light = child as THREE.SpotLight;
        if (!light.isSpotLight) return;
        const ang = swirl * (i % 2 === 0 ? 1.25 : -1.05) + i * 1.4;
        light.target.position.set(Math.sin(ang) * 2.8, 0.15, Math.cos(ang) * 2.2 - 1.35);
        light.target.updateMatrixWorld();
        light.intensity = (lite ? 18 : 28) + beat * (lite ? 12 : 22);
      });
    }
  });

  return (
    <group>
      <color attach="background" args={["#05070c"]} />
      <fog attach="fog" args={["#05070c", lite ? 12 : 14, lite ? 36 : 42]} />
      <hemisphereLight args={["#7ad4ff", "#1a0e22", lite ? 0.85 : 0.7]} />
      <ambientLight intensity={lite ? 0.4 : 0.28} />
      <directionalLight position={[5, 12, 3]} intensity={lite ? 1.2 : 1.05} color="#f2f6ff" />
      <pointLight ref={pulse} position={[0, 3.8, -1.35]} color={CYAN} intensity={14} distance={26} />
      {!lite && <pointLight position={[-4.5, 3.2, 1.5]} color={AMBER} intensity={9} distance={18} />}
      {!lite && <pointLight position={[4.8, 3.4, -3.5]} color={MAGENTA} intensity={8} distance={18} />}
      {!lite && <pointLight position={[0, 5.5, -8]} color={LIME} intensity={6} distance={20} />}
      {lite && <pointLight position={[-3.5, 3.2, 1.2]} color={AMBER} intensity={7} distance={16} />}
      {lite && <pointLight position={[3.8, 3.4, -3]} color={MAGENTA} intensity={6} distance={16} />}

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, -1.35]} material={mats.floor}>
        <circleGeometry args={[20, lite ? 40 : 72]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.0, -1.35]} material={mats.stage}>
        <circleGeometry args={[6.6, lite ? 32 : 56]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, -1.35]} material={mats.tile}>
        <ringGeometry args={[7.5, 9.8, segs]} />
      </mesh>
      <mesh ref={ring3} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, -1.35]} material={mats.magenta}>
        <ringGeometry args={[1.85, 2.1, lite ? 32 : 56]} />
      </mesh>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.035, -1.35]} material={mats.cyan}>
        <ringGeometry args={[3.7, 4.05, segs]} />
      </mesh>
      <mesh ref={ring2} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, -1.35]} material={mats.amber}>
        <ringGeometry args={[5.15, 5.5, segs]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.045, -1.35]} material={mats.lime}>
        <ringGeometry args={[6.2, 6.45, segs]} />
      </mesh>

      {pillars.map((p, i) => (
        <group key={i} position={[p.x, 0, p.z]}>
          <mesh position={[0, p.h / 2, 0]} material={mats[p.tone]}>
            <boxGeometry args={[0.22, p.h, 0.22]} />
          </mesh>
          <mesh position={[0, p.h + 0.08, 0]} material={mats[p.tone]}>
            <boxGeometry args={[0.7, 0.14, 0.7]} />
          </mesh>
          {!lite && (
            <pointLight
              position={[0, p.h * 0.65, 0]}
              color={p.tone === "amber" ? AMBER : p.tone === "magenta" ? MAGENTA : p.tone === "lime" ? LIME : CYAN}
              intensity={5.5}
              distance={8}
            />
          )}
        </group>
      ))}

      {[-1, 1].map((side) => (
        <group key={side} position={[side * 5.2, 0, 4.2]}>
          <mesh position={[0, 2.4, 0]} material={mats.cyan}>
            <boxGeometry args={[0.16, 4.8, 0.16]} />
          </mesh>
          <mesh position={[side * -1.1, 2.4, 0]} material={mats.amber}>
            <boxGeometry args={[0.16, 4.8, 0.16]} />
          </mesh>
          <mesh position={[side * -0.55, 4.85, 0]} material={mats.magenta}>
            <boxGeometry args={[1.4, 0.16, 0.16]} />
          </mesh>
        </group>
      ))}

      <mesh position={[0, 3.6, -10.2]} material={mats.wall}>
        <boxGeometry args={[22, 9, 0.5]} />
      </mesh>
      <group ref={screens} position={[0, 3.8, -9.9]}>
        {(lite ? [-4.5, 0, 4.5] : [-6, -3, 0, 3, 6]).map((x, i) => (
          <mesh key={i} position={[x, (i % 2) * 0.4, 0]} material={mats.screen.clone()}>
            <boxGeometry args={[2.4, 3.2, 0.08]} />
          </mesh>
        ))}
      </group>
      <mesh position={[0, 6.7, -9.85]} material={mats.cyan}>
        <boxGeometry args={[18, 0.14, 0.14]} />
      </mesh>
      <mesh position={[-9.2, 3.6, -9.85]} material={mats.amber}>
        <boxGeometry args={[0.14, 7.2, 0.14]} />
      </mesh>
      <mesh position={[9.2, 3.6, -9.85]} material={mats.magenta}>
        <boxGeometry args={[0.14, 7.2, 0.14]} />
      </mesh>

      <mesh position={[-14.5, 3.4, -2]} material={mats.wall} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[20, 8.5, 0.45]} />
      </mesh>
      <mesh position={[14.5, 3.4, -2]} material={mats.wall} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[20, 8.5, 0.45]} />
      </mesh>

      {(lite
        ? [
            [-6.4, -5.2],
            [6.4, -5.2],
          ]
        : [
            [-6.4, -5.2],
            [6.4, -5.2],
            [-6.8, 1.6],
            [6.8, 1.6],
          ]
      ).map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 1.1, 0]} material={mats.metal}>
            <boxGeometry args={[1.1, 2.2, 0.9]} />
          </mesh>
          <mesh position={[0, 2.35, 0.2]} material={i % 2 ? mats.cyan : mats.amber}>
            <boxGeometry args={[0.85, 0.12, 0.12]} />
          </mesh>
          <mesh position={[0, 0.55, 0.48]} material={mats.metal}>
            <cylinderGeometry args={[0.32, 0.32, 0.12, lite ? 12 : 20]} />
          </mesh>
          <mesh position={[0, 1.35, 0.48]} material={mats.metal}>
            <cylinderGeometry args={[0.28, 0.28, 0.12, lite ? 12 : 20]} />
          </mesh>
        </group>
      ))}

      <group position={[0, 0, -7.4]}>
        <mesh position={[0, 0.7, 0]} material={mats.metal}>
          <boxGeometry args={[4.2, 1.4, 1.3]} />
        </mesh>
        <mesh position={[0, 1.5, 0.1]} material={mats.cyan}>
          <boxGeometry args={[3.6, 0.1, 0.9]} />
        </mesh>
        <mesh position={[-1.1, 1.75, 0.15]} material={mats.magenta}>
          <boxGeometry args={[0.7, 0.35, 0.5]} />
        </mesh>
        <mesh position={[1.1, 1.75, 0.15]} material={mats.amber}>
          <boxGeometry args={[0.7, 0.35, 0.5]} />
        </mesh>
      </group>

      <mesh position={[0, 7.1, -1.35]} material={mats.metal}>
        <boxGeometry args={[13, 0.2, 9]} />
      </mesh>
      {(lite ? [-3, 3] : [-4.5, -1.5, 1.5, 4.5]).map((x, i) => (
        <mesh key={i} position={[x, 6.9, -1.35]} material={i % 2 ? mats.cyan : mats.amber}>
          <boxGeometry args={[0.1, 0.1, 8]} />
        </mesh>
      ))}
      <mesh ref={ball} position={[0, 6.35, -1.35]} material={mats.ball}>
        <icosahedronGeometry args={[0.55, lite ? 0 : 1]} />
      </mesh>
      <mesh position={[0, 6.85, -1.35]} material={mats.metal}>
        <cylinderGeometry args={[0.04, 0.04, 0.7, 8]} />
      </mesh>

      <group ref={spots}>
        {Array.from({ length: spotN }, (_, i) => (
          <spotLight
            key={i}
            position={[Math.cos(i * 1.6) * 5.2, 6.5, Math.sin(i * 1.6) * 5.2 - 1.35]}
            angle={0.28}
            penumbra={0.5}
            intensity={lite ? 22 : 34}
            color={i % 2 === 0 ? CYAN : i === 1 ? AMBER : MAGENTA}
            distance={28}
          >
            <object3D attach="target" position={[0, 0.2, -1.35]} />
          </spotLight>
        ))}
      </group>
    </group>
  );
}
