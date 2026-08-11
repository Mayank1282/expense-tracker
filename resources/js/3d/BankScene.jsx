import { useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import * as THREE from 'three';
import { useTheme } from '../theme';
import { usePrefersReducedMotion } from '../Components/IsoStat';

/**
 * A neoclassical bank with a deposit slot in its pediment, and a hand posting
 * rupee notes into it — the building treated as a piggy bank.
 *
 * The loop is one deposit cycle: the hand descends with a fan of notes, the
 * front note slides into the slot and disappears inside, the hand lifts, the
 * fan replenishes. Everything is driven from a single normalised `phase`, so
 * the hand, the note and the slot glow can never drift out of sync the way
 * they would with independent timers.
 *
 * The architecture is built to real proportions rather than eyeballed: stepped
 * crepidoma, columns with base/shaft/capital, a three-part entablature and a
 * pediment sized off the cornice.
 */

const CYCLE = 4.2; // seconds per deposit

/* -------------------------------------------------------------------------- */
/* Banknote texture — stylised, not a facsimile of real currency.             */
/* -------------------------------------------------------------------------- */
function useNoteTexture(dark) {
    return useMemo(() => {
        const w = 512;
        const h = 240;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;

        const ctx = canvas.getContext('2d');

        const base = ctx.createLinearGradient(0, 0, w, h);
        base.addColorStop(0, dark ? '#146E5C' : '#2FAE90');
        base.addColorStop(0.5, dark ? '#1A8A72' : '#4FC4A6');
        base.addColorStop(1, dark ? '#116052' : '#1E9E82');
        ctx.fillStyle = base;
        ctx.fillRect(0, 0, w, h);

        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 1.4;
        for (let i = 0; i < 24; i++) {
            ctx.beginPath();
            ctx.moveTo(0, i * 11 + 4);
            ctx.bezierCurveTo(w * 0.3, i * 11 - 15, w * 0.7, i * 11 + 25, w, i * 11 + 2);
            ctx.stroke();
        }

        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 3;
        ctx.strokeRect(13, 13, w - 26, h - 26);

        ctx.globalAlpha = 0.22;
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.ellipse(w - 92, h / 2, 44, 58, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;

        ctx.fillStyle = '#FFFFFF';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 84px "Space Grotesk", system-ui, sans-serif';
        ctx.fillText('₹', 44, h / 2);
        ctx.font = 'bold 62px "Space Grotesk", system-ui, sans-serif';
        ctx.fillText('500', 108, h / 2 + 3);

        const texture = new THREE.CanvasTexture(canvas);
        texture.anisotropy = 4;

        return texture;
    }, [dark]);
}

function NoteMesh({ texture, opacity = 1 }) {
    return (
        <mesh castShadow>
            <planeGeometry args={[0.46, 0.22]} />
            <meshStandardMaterial
                map={texture}
                side={THREE.DoubleSide}
                transparent
                opacity={opacity}
                roughness={0.78}
                metalness={0.02}
            />
        </mesh>
    );
}

/* -------------------------------------------------------------------------- */
/* Money above the bank                                                       */
/* -------------------------------------------------------------------------- */
/*
 * There is deliberately no hand here.
 *
 * A convincing human hand cannot be built out of boxes and capsules — the
 * earlier attempt read as a mannequin arm pushed through the roof, which is
 * worse than no hand at all. Hands are the hardest thing to fake in low-poly
 * and a bad one draws every eye straight to it.
 *
 * So the money floats over the pediment and settles into the slot on its own.
 * It fills the empty space above the building, keeps the deposit idea, and has
 * no uncanny geometry to get wrong.
 */
function FloatingNotes({ texture, reduced }) {
    const group = useRef();

    // A loose fan, offset on all three axes so it reads as a handful of notes
    // rather than a neatly squared deck.
    const notes = useMemo(
        () => [
            { pos: [-0.66, 0.04, -0.12], rot: [-1.24, 0.3, -0.22], bob: 0.0 },
            { pos: [-0.22, 0.2, 0.12], rot: [-1.3, -0.16, 0.14], bob: 1.1 },
            { pos: [0.24, -0.02, -0.06], rot: [-1.18, 0.42, 0.3], bob: 2.2 },
            { pos: [0.68, 0.18, 0.14], rot: [-1.34, -0.3, -0.12], bob: 3.3 },
            { pos: [0.04, 0.38, -0.26], rot: [-1.22, 0.1, 0.06], bob: 4.4 },
        ],
        []
    );

    useFrame((state) => {
        if (!group.current || reduced) return;

        const t = state.clock.elapsedTime;
        group.current.rotation.y = Math.sin(t * 0.2) * 0.12;
        group.current.position.y = 3.78 + Math.sin(t * 0.5) * 0.07;
    });

    return (
        <group ref={group} position={[0, 3.78, 0.85]}>
            {notes.map((note, i) => (
                <FloatingNote key={i} texture={texture} reduced={reduced} {...note} />
            ))}
        </group>
    );
}

function FloatingNote({ texture, pos, rot, bob, reduced }) {
    const ref = useRef();

    useFrame((state) => {
        if (!ref.current || reduced) return;

        const t = state.clock.elapsedTime;
        // Each note drifts on its own clock so the cluster never pulses as one.
        ref.current.position.y = pos[1] + Math.sin(t * 0.75 + bob) * 0.07;
        ref.current.rotation.z = rot[2] + Math.sin(t * 0.6 + bob) * 0.09;
        ref.current.rotation.x = rot[0] + Math.sin(t * 0.45 + bob) * 0.06;
    });

    return (
        <group ref={ref} position={pos} rotation={rot}>
            <NoteMesh texture={texture} />
        </group>
    );
}

/* -------------------------------------------------------------------------- */
/* One note peeling off the cluster and dropping into the slot                */
/* -------------------------------------------------------------------------- */
function DepositedNote({ texture, reduced }) {
    const group = useRef();
    const material = useRef();

    useFrame((state) => {
        if (!group.current) return;

        const phase = reduced ? 0.1 : (state.clock.elapsedTime % CYCLE) / CYCLE;
        const startY = 3.7;
        const slotY = 3.16;

        if (phase < 0.55) {
            // Fall from the cluster to the slot.
            const t = phase / 0.55;
            const eased = t * t;
            group.current.position.y = startY - eased * (startY - slotY);
            group.current.scale.set(1, 1, 1);
            if (material.current) material.current.opacity = 1;
        } else if (phase < 0.72) {
            // Swallowed: it shortens into the slot and fades.
            const t = (phase - 0.55) / 0.17;
            group.current.position.y = slotY;
            group.current.scale.set(1, Math.max(1 - t, 0.02), 1);
            if (material.current) material.current.opacity = 1 - t;
        } else {
            group.current.scale.setScalar(0.001);
            if (material.current) material.current.opacity = 0;
        }
    });

    return (
        <group ref={group} position={[0.02, 3.7, 1.1]} rotation={[-1.26, 0, 0.04]}>
            <mesh>
                <planeGeometry args={[0.46, 0.22]} />
                <meshStandardMaterial
                    ref={material}
                    map={texture}
                    side={THREE.DoubleSide}
                    transparent
                    roughness={0.78}
                />
            </mesh>
        </group>
    );
}

/* -------------------------------------------------------------------------- */
/* The building                                                               */
/* -------------------------------------------------------------------------- */
function Bank({ stone, stoneDark, accent, interior }) {
    const columnX = [-1.45, -0.87, -0.29, 0.29, 0.87, 1.45];

    const pediment = useMemo(() => {
        const shape = new THREE.Shape();
        shape.moveTo(-1.95, 0);
        shape.lineTo(1.95, 0);
        shape.lineTo(0, 0.72);
        shape.closePath();

        return shape;
    }, []);

    const stoneMat = <meshPhysicalMaterial color={stone} roughness={0.62} metalness={0.04} clearcoat={0.18} />;
    const trimMat = <meshPhysicalMaterial color={stoneDark} roughness={0.55} metalness={0.08} clearcoat={0.2} />;

    return (
        <group position={[0, -1.35, 0]}>
            {/* Crepidoma — three stepped courses. */}
            {[
                [4.4, 0.16, 2.8, 0.08],
                [4.1, 0.16, 2.6, 0.24],
                [3.8, 0.16, 2.4, 0.4],
            ].map(([w, h, d, y]) => (
                <mesh key={y} position={[0, y, 0]} receiveShadow castShadow>
                    <boxGeometry args={[w, h, d]} />
                    {trimMat}
                </mesh>
            ))}

            {/* Cella */}
            <mesh position={[0, 1.32, -0.3]} castShadow receiveShadow>
                <boxGeometry args={[3.0, 1.68, 1.5]} />
                {stoneMat}
            </mesh>

            {/* Doorway */}
            <mesh position={[0, 1.02, 0.46]}>
                <boxGeometry args={[0.86, 1.28, 0.06]} />
                {trimMat}
            </mesh>
            <mesh position={[0, 1.0, 0.5]}>
                <boxGeometry args={[0.68, 1.14, 0.06]} />
                <meshStandardMaterial color={interior} roughness={0.95} />
            </mesh>

            {/* Columns */}
            {columnX.map((x) => (
                <group key={x} position={[x, 0, 0.95]}>
                    <mesh position={[0, 0.53, 0]} castShadow>
                        <boxGeometry args={[0.3, 0.1, 0.3]} />
                        {trimMat}
                    </mesh>
                    <mesh position={[0, 1.35, 0]} castShadow>
                        <cylinderGeometry args={[0.1, 0.12, 1.54, 24]} />
                        {stoneMat}
                    </mesh>
                    <mesh position={[0, 2.17, 0]} castShadow>
                        <boxGeometry args={[0.32, 0.11, 0.32]} />
                        {trimMat}
                    </mesh>
                </group>
            ))}

            {/* Entablature */}
            <mesh position={[0, 2.32, 0.3]} castShadow>
                <boxGeometry args={[3.7, 0.18, 2.4]} />
                {stoneMat}
            </mesh>
            <mesh position={[0, 2.52, 0.3]} castShadow>
                <boxGeometry args={[3.6, 0.22, 2.32]} />
                {trimMat}
            </mesh>
            <mesh position={[0, 2.7, 0.3]} castShadow>
                <boxGeometry args={[3.9, 0.14, 2.5]} />
                {stoneMat}
            </mesh>

            {/* Pediment */}
            <mesh position={[0, 2.77, -0.95]} castShadow>
                <extrudeGeometry args={[pediment, { depth: 2.5, bevelEnabled: false }]} />
                <meshPhysicalMaterial color={accent} roughness={0.42} metalness={0.3} clearcoat={0.45} />
            </mesh>

            {/* The deposit slot, cut into the tympanum. A recessed dark bar with
                a lip above it, so it reads as an opening rather than a sticker. */}
            <mesh position={[0, 3.13, 1.46]}>
                <boxGeometry args={[0.78, 0.11, 0.12]} />
                <meshStandardMaterial color={interior} roughness={1} />
            </mesh>
            <mesh position={[0, 3.21, 1.53]}>
                <boxGeometry args={[0.9, 0.05, 0.06]} />
                {trimMat}
            </mesh>
        </group>
    );
}

/* -------------------------------------------------------------------------- */
/* Camera                                                                     */
/* -------------------------------------------------------------------------- */
function CameraRig({ reduced }) {
    const { camera } = useThree();
    const elapsed = useRef(0);

    // Framed to hold the whole building AND the hand above it. The earlier
    // framing cropped at the canvas edge, which was the actual complaint.
    const from = useMemo(() => new THREE.Vector3(0, 1.0, 7.0), []);
    const to = useMemo(() => new THREE.Vector3(0.3, 1.2, 10.2), []);
    const look = useMemo(() => new THREE.Vector3(0, 0.55, 0), []);

    useFrame((state, delta) => {
        if (reduced) {
            camera.position.copy(to);
            camera.lookAt(look);

            return;
        }

        elapsed.current += delta;

        const t = Math.min(elapsed.current / 2.4, 1);
        const eased = 1 - Math.pow(1 - t, 4);

        camera.position.lerpVectors(from, to, eased);

        if (t >= 1) {
            const e = state.clock.elapsedTime;
            camera.position.x = to.x + Math.sin(e * 0.22) * 0.2;
            camera.position.y = to.y + Math.sin(e * 0.17) * 0.08;
        }

        camera.lookAt(look);
    });

    return null;
}

/* -------------------------------------------------------------------------- */

export default function BankScene() {
    const { theme } = useTheme();
    const reduced = usePrefersReducedMotion();
    const dark = theme === 'dark';

    const accent = dark ? '#3FBFA3' : '#0E8E76';
    const stone = dark ? '#2E3634' : '#FAFDFC';
    const stoneDark = dark ? '#232A29' : '#E4EDEA';
    const interior = dark ? '#050D0C' : '#08221D';

    const noteTexture = useNoteTexture(dark);

    return (
        <Canvas
            dpr={[1, 1.75]}
            shadows
            camera={{ fov: 34, near: 0.1, far: 80 }}
            gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
            style={{ width: '100%', height: '100%' }}
        >
            <CameraRig reduced={reduced} />

            <ambientLight intensity={dark ? 0.6 : 1.0} />
            <directionalLight
                position={[5, 8, 6]}
                intensity={dark ? 2.0 : 2.3}
                castShadow
                shadow-mapSize={[1024, 1024]}
            />
            <directionalLight position={[-6, 3, -4]} intensity={0.4} color={accent} />

            <Environment preset={dark ? 'night' : 'city'} />

            <Bank stone={stone} stoneDark={stoneDark} accent={accent} interior={interior} />

            <group position={[0, -1.35, 0]}>
                <FloatingNotes texture={noteTexture} reduced={reduced} />
                <DepositedNote texture={noteTexture} reduced={reduced} />
            </group>
        </Canvas>
    );
}
