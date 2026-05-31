import { cn } from "@/lib/utils";
import { useEffect, useMemo, useRef } from "react";

export type WendyOrbState = "idle" | "thinking" | "speaking" | "listening";

interface WendyOrbProps {
  state: WendyOrbState;
  size?: number;
  level?: number;
  className?: string;
}

const STATE_LABEL: Record<WendyOrbState, string> = {
  idle: "Wendy in attesa",
  thinking: "Wendy sta pensando",
  speaking: "Wendy sta parlando",
  listening: "Wendy ti ascolta",
};

interface OrbNode {
  x: number;
  y: number;
  z: number;
  nearest: number[];
}

function buildNodes(count: number): OrbNode[] {
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const points = Array.from({ length: count }, (_, index) => {
    const y = 1 - (index / (count - 1)) * 2;
    const radius = Math.sqrt(1 - y * y);
    const theta = goldenAngle * index;
    return {
      x: Math.cos(theta) * radius,
      y,
      z: Math.sin(theta) * radius,
      nearest: [] as number[],
    };
  });

  return points.map((point, index) => {
    const nearest = points
      .map((candidate, candidateIndex) => ({
        candidateIndex,
        distance:
          (point.x - candidate.x) ** 2 +
          (point.y - candidate.y) ** 2 +
          (point.z - candidate.z) ** 2,
      }))
      .filter((candidate) => candidate.candidateIndex !== index)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 3)
      .map((candidate) => candidate.candidateIndex);

    return { ...point, nearest };
  });
}

function rotate(node: OrbNode, angleY: number, angleX: number) {
  const cosY = Math.cos(angleY);
  const sinY = Math.sin(angleY);
  const cosX = Math.cos(angleX);
  const sinX = Math.sin(angleX);

  const x1 = node.x * cosY - node.z * sinY;
  const z1 = node.x * sinY + node.z * cosY;
  const y1 = node.y * cosX - z1 * sinX;
  const z2 = node.y * sinX + z1 * cosX;

  return { x: x1, y: y1, z: z2 };
}

function stateSpeed(state: WendyOrbState) {
  if (state === "thinking") return 0.018;
  if (state === "speaking") return 0.012;
  if (state === "listening") return 0.009;
  return 0.0045;
}

export function WendyOrb({
  state,
  size = 188,
  level = 0.5,
  className,
}: WendyOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const stateRef = useRef(state);
  const levelRef = useRef(level);
  const nodes = useMemo(() => buildNodes(70), []);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    levelRef.current = level;
  }, [level]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;
    const ctx = context;

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const ratio = window.devicePixelRatio || 1;
    canvas.width = size * ratio;
    canvas.height = size * ratio;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

    let angle = 0;

    function draw(timestamp = 0) {
      const currentState = stateRef.current;
      const center = size / 2;
      const radius = size * 0.36;
      const pulse = 0.5 + Math.sin(timestamp / 360) * 0.5;
      const levelPulse = Math.max(0.2, Math.min(1, levelRef.current));

      ctx.clearRect(0, 0, size, size);

      const glow = ctx.createRadialGradient(center, center, 0, center, center, size * 0.48);
      glow.addColorStop(0, currentState === "idle" ? "rgba(193,158,74,0.16)" : "rgba(193,158,74,0.28)");
      glow.addColorStop(0.7, "rgba(193,158,74,0.06)");
      glow.addColorStop(1, "rgba(193,158,74,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(center, center, size * 0.48, 0, Math.PI * 2);
      ctx.fill();

      const projected = nodes.map((node) => {
        const rotated = rotate(node, angle, angle * 0.42);
        const depth = (rotated.z + 1) / 2;
        const scale = 0.72 + depth * 0.38;
        return {
          x: center + rotated.x * radius * scale,
          y: center + rotated.y * radius * scale,
          depth,
          scale,
        };
      });

      ctx.lineWidth = 1;
      for (let i = 0; i < nodes.length; i += 1) {
        const from = projected[i];
        if (!from) continue;
        for (const nearest of nodes[i]?.nearest ?? []) {
          if (nearest < i) continue;
          const to = projected[nearest];
          if (!to) continue;
          const opacity = 0.06 + Math.min(from.depth, to.depth) * 0.2;
          ctx.strokeStyle = `rgba(212,186,124,${opacity})`;
          ctx.beginPath();
          ctx.moveTo(from.x, from.y);
          ctx.lineTo(to.x, to.y);
          ctx.stroke();
        }
      }

      if (currentState === "listening" || currentState === "speaking") {
        const ringOpacity = currentState === "speaking" ? 0.18 + pulse * 0.16 : 0.14 + levelPulse * 0.22;
        ctx.strokeStyle = `rgba(212,186,124,${ringOpacity})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(center, center, size * (0.39 + pulse * 0.025), 0, Math.PI * 2);
        ctx.stroke();
      }

      for (const point of projected) {
        const activeBoost =
          currentState === "thinking" ? pulse * 1.5 :
          currentState === "speaking" ? levelPulse * 1.2 :
          currentState === "listening" ? levelPulse : 0;
        const nodeRadius = (1.5 + point.depth * 2.3 + activeBoost) * point.scale;
        ctx.fillStyle = `rgba(230,210,157,${0.38 + point.depth * 0.52})`;
        ctx.beginPath();
        ctx.arc(point.x, point.y, nodeRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = "rgba(193,158,74,0.95)";
      ctx.shadowColor = "rgba(193,158,74,0.55)";
      ctx.shadowBlur = currentState === "idle" ? 12 : 24;
      ctx.beginPath();
      ctx.arc(center, center, size * 0.045 + pulse * 1.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      if (!media.matches) angle += stateSpeed(currentState);
      if (!media.matches) frameRef.current = window.requestAnimationFrame(draw);
    }

    draw();

    return () => {
      if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
    };
  }, [nodes, size]);

  return (
    <div
      className={cn("flex items-center justify-center", className)}
      role="img"
      aria-label={STATE_LABEL[state]}
    >
      <canvas ref={canvasRef} className="max-w-full" />
    </div>
  );
}
