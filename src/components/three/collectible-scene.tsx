"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Environment,
  Lightformer,
  Float,
  OrbitControls,
  ContactShadows,
  Sparkles,
  MeshTransmissionMaterial,
  Edges,
  useGLTF,
} from "@react-three/drei";
import * as THREE from "three";
import type { CollectibleArt } from "@/lib/types";
import {
  COLLECTIBLE_MODEL_URL,
  COLLECTIBLE_MODEL_SCALE,
} from "@/lib/three-config";

function hsl(h: number, s: number, l: number): string {
  return `hsl(${((h % 360) + 360) % 360}, ${s}%, ${l}%)`;
}

/**
 * The "memory capsule" — a faceted crystal core suspended inside a glass
 * artifact, wrapped by a glowing orbital ring. Tuned to read as a proof
 * artifact / digital memory, not a spinning coin.
 */
function Artifact({
  art,
  reveal,
  spin = 0.25,
}: {
  art: CollectibleArt;
  reveal: boolean;
  spin?: number;
}) {
  const group = useRef<THREE.Group>(null);
  const core = useRef<THREE.Mesh>(null);
  const ring = useRef<THREE.Mesh>(null);
  const ring2 = useRef<THREE.Mesh>(null);
  const revealRef = useRef(0);

  const colors = useMemo(
    () => ({
      shell: new THREE.Color(hsl(art.hue, 70, 60)),
      core: new THREE.Color(hsl(art.hue, 85, 62)),
      accent: new THREE.Color(hsl(art.accentHue, 90, 60)),
    }),
    [art.hue, art.accentHue],
  );

  useFrame((state, delta) => {
    // Reveal easing: scale + settle.
    const target = reveal ? 1 : 0.0001;
    revealRef.current = THREE.MathUtils.damp(
      revealRef.current,
      target,
      4,
      delta,
    );
    const s = revealRef.current;
    if (group.current) {
      group.current.scale.setScalar(s);
      group.current.rotation.y += delta * spin;
    }
    const t = state.clock.elapsedTime;
    if (core.current) {
      core.current.rotation.x = t * 0.4;
      core.current.rotation.z = t * 0.2;
    }
    if (ring.current) ring.current.rotation.z = t * 0.6;
    if (ring2.current) {
      ring2.current.rotation.x = Math.PI / 2.4;
      ring2.current.rotation.y = t * 0.5;
    }
  });

  return (
    <group ref={group} scale={0.0001}>
      {/* Glowing faceted core */}
      <mesh ref={core}>
        <icosahedronGeometry args={[0.82, 0]} />
        <meshStandardMaterial
          color={colors.core}
          emissive={colors.core}
          emissiveIntensity={1.6}
          roughness={0.25}
          metalness={0.1}
          toneMapped={false}
        />
        <Edges threshold={15} scale={1.001} color={colors.accent} />
      </mesh>

      {/* Glass capsule shell */}
      <mesh>
        <icosahedronGeometry args={[1.5, 0]} />
        <MeshTransmissionMaterial
          backside
          backsideThickness={0.4}
          thickness={0.6}
          transmission={1}
          roughness={0.06}
          ior={1.42}
          chromaticAberration={0.06}
          anisotropy={0.3}
          distortion={0.2}
          distortionScale={0.3}
          temporalDistortion={0.1}
          color={colors.shell}
          attenuationColor={colors.shell}
          attenuationDistance={2.5}
        />
      </mesh>

      {/* Orbital rings */}
      <mesh ref={ring}>
        <torusGeometry args={[1.95, 0.022, 16, 120]} />
        <meshStandardMaterial
          color={colors.accent}
          emissive={colors.accent}
          emissiveIntensity={1.2}
          metalness={0.6}
          roughness={0.3}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={ring2}>
        <torusGeometry args={[2.15, 0.012, 16, 120]} />
        <meshStandardMaterial
          color={colors.shell}
          emissive={colors.shell}
          emissiveIntensity={0.8}
          metalness={0.7}
          roughness={0.35}
          toneMapped={false}
        />
      </mesh>

      <Sparkles
        count={28}
        scale={3.4}
        size={2.4}
        speed={0.3}
        color={colors.accent}
        opacity={0.7}
      />
    </group>
  );
}

/**
 * Renders a custom `.glb` (from `public/models/`) with the same reveal +
 * auto-rotate behavior as the procedural artifact.
 */
/** Largest dimension the model is normalized to (world units) — keeps any
 *  GLB at a consistent "medium" size regardless of its native scale. */
const MODEL_TARGET_SIZE = 2.2;

function GltfArtifact({
  url,
  reveal,
  position = [0, 0, 0],
  scaleMul = 1,
  spin = 0.25,
}: {
  url: string;
  reveal: boolean;
  position?: [number, number, number];
  scaleMul?: number;
  /** Auto-rotate speed (radians/sec). */
  spin?: number;
}) {
  const group = useRef<THREE.Group>(null);
  const revealRef = useRef(0);
  const { scene } = useGLTF(url);

  // Recenter on origin and normalize size via the bounding box so the asset
  // always renders centered and medium-sized.
  const { model, center, fit } = useMemo(() => {
    const clone = scene.clone(true);
    const box = new THREE.Box3().setFromObject(clone);
    const size = box.getSize(new THREE.Vector3());
    const c = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    return { model: clone, center: c, fit: MODEL_TARGET_SIZE / maxDim };
  }, [scene]);

  useFrame((_, delta) => {
    const target = reveal ? 1 : 0.0001;
    revealRef.current = THREE.MathUtils.damp(revealRef.current, target, 4, delta);
    if (group.current) {
      group.current.scale.setScalar(
        revealRef.current * fit * COLLECTIBLE_MODEL_SCALE * scaleMul,
      );
      group.current.rotation.y += delta * spin;
    }
  });

  return (
    <group ref={group} position={position} scale={0.0001}>
      <group position={[-center.x, -center.y, -center.z]}>
        <primitive object={model} />
      </group>
    </group>
  );
}

if (COLLECTIBLE_MODEL_URL) {
  useGLTF.preload(COLLECTIBLE_MODEL_URL);
}

/**
 * Pulls the camera to a distance where the content (given its half-extents in
 * world units) fits the live viewport on any aspect ratio — so the collectible
 * never clips on a tall portrait phone or a short landscape one. Re-runs on
 * resize / orientation change.
 */
function FitCamera({
  halfWidth,
  halfHeight,
}: {
  halfWidth: number;
  halfHeight: number;
}) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);

  useEffect(() => {
    if (!width || !height) return;
    const aspect = width / height;
    const vFov = (camera.fov * Math.PI) / 180;
    const margin = 1.35;
    const distForHeight = (halfHeight * margin) / Math.tan(vFov / 2);
    const hFovHalf = Math.atan(Math.tan(vFov / 2) * aspect);
    const distForWidth = (halfWidth * margin) / Math.tan(hFovHalf);
    const dist = Math.max(distForHeight, distForWidth, 4.5);
    camera.position.set(0, 0, dist);
    camera.updateProjectionMatrix();
  }, [camera, width, height, halfWidth, halfHeight]);

  return null;
}

export default function CollectibleScene({
  art,
  reveal = true,
  interactive = true,
  modelUrl,
  modelUrls,
  camera = false,
  modelScale = 1,
  spin = 0.25,
}: {
  art: CollectibleArt;
  reveal?: boolean;
  interactive?: boolean;
  /** Auto-rotate speed (radians/sec). */
  spin?: number;
  /** Explicit model override (e.g. the camera/AR model). Falls back to the
   *  art's model, then the global default, then the procedural artifact. */
  modelUrl?: string;
  /** Render multiple models side by side (e.g. a paired camera reveal). */
  modelUrls?: string[];
  /** AR camera-feed mode: render smaller and stack the models vertically so
   *  they sit nicely over a portrait mobile viewport. */
  camera?: boolean;
  /** Extra multiplier on the model size (e.g. shrink a model floating over a
   *  captured photo so it reads as an accent, not a cover). */
  modelScale?: number;
}) {
  const effectiveModel = modelUrl ?? art.modelUrl ?? COLLECTIBLE_MODEL_URL;
  const models =
    modelUrls && modelUrls.length > 0
      ? modelUrls
      : effectiveModel
        ? [effectiveModel]
        : [];

  const count = models.length;
  const groupScaleMul = (count > 1 ? 0.62 : 1) * modelScale;
  const cameraMul = camera ? 0.7 : 1;
  const spread = count > 1 ? ((count - 1) / 2) * 2.3 : 0;
  // Rendered half-size of one model (its max dimension is normalized to
  // MODEL_TARGET_SIZE before the scale multipliers are applied).
  const perHalf =
    (MODEL_TARGET_SIZE * COLLECTIBLE_MODEL_SCALE * groupScaleMul * cameraMul) /
    2;
  // Camera mode stacks the models vertically, so the content is tallest there.
  const fitHalfHeight = spread + perHalf;
  const fitHalfWidth = perHalf;

  return (
    <Canvas
      camera={{ position: [0, 0.4, 6], fov: 35 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
      style={{ touchAction: "pan-y" }}
    >
      {camera && (
        <FitCamera halfWidth={fitHalfWidth} halfHeight={fitHalfHeight} />
      )}
      <ambientLight intensity={0.6} />
      <directionalLight position={[4, 6, 4]} intensity={1.2} />
      <pointLight
        position={[-4, -2, -3]}
        intensity={30}
        color={hsl(art.accentHue, 90, 60)}
      />

      <Suspense fallback={null}>
        <Float speed={1.4} rotationIntensity={0.5} floatIntensity={0.7}>
          {models.length > 0 ? (
            models.map((url, i) => {
              const offset = count === 1 ? 0 : (i - (count - 1) / 2) * 2.3;
              // Stack vertically (top/bottom) on the portrait camera feed,
              // otherwise lay the models out side by side.
              const position: [number, number, number] = camera
                ? [0, -offset, 0]
                : [offset, 0, 0];
              return (
                <GltfArtifact
                  key={`${url}-${i}`}
                  url={url}
                  reveal={reveal}
                  position={position}
                  scaleMul={groupScaleMul * cameraMul}
                  spin={spin}
                />
              );
            })
          ) : (
            <Artifact art={art} reveal={reveal} spin={spin} />
          )}
        </Float>

        <ContactShadows
          position={[0, -2.3, 0]}
          opacity={0.35}
          scale={9}
          blur={2.6}
          far={4}
          color={hsl(art.hue, 60, 30)}
        />

        {/* Self-contained lighting environment for reflections/refraction —
            no external HDR fetch required. */}
        <Environment resolution={256}>
          <Lightformer
            form="rect"
            intensity={3}
            position={[0, 3, 2]}
            scale={[6, 3, 1]}
            color="white"
          />
          <Lightformer
            form="circle"
            intensity={2.5}
            position={[-3, 1, 3]}
            scale={3}
            color={hsl(art.hue, 80, 70)}
          />
          <Lightformer
            form="circle"
            intensity={2.5}
            position={[3, -1, 2]}
            scale={3}
            color={hsl(art.accentHue, 85, 68)}
          />
          <Lightformer
            form="rect"
            intensity={1.5}
            position={[0, -3, -2]}
            scale={[6, 3, 1]}
            color="white"
          />
        </Environment>
      </Suspense>

      {interactive && (
        <OrbitControls
          enablePan={false}
          enableZoom={false}
          autoRotate={false}
          minPolarAngle={Math.PI / 3}
          maxPolarAngle={(Math.PI * 2) / 3}
        />
      )}
    </Canvas>
  );
}
