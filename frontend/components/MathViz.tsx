"use client";
import { useEffect, useRef, useState } from "react";
import type { PiecewiseBranch, StateTransition } from "@/lib/types";

// These plot *known, standard* math functions (tanh/sigmoid/relu) that we already
// asserted appear in the formula -- never the user's code. No execution involved.
const KNOWN_FUNCS: Record<string, { fn: (x: number) => number; domain: [number, number]; range: [number, number] }> = {
  tanh: { fn: Math.tanh, domain: [-4, 4], range: [-1, 1] },
  sigmoid: { fn: (x) => 1 / (1 + Math.exp(-x)), domain: [-6, 6], range: [0, 1] },
  relu: { fn: (x) => Math.max(0, x), domain: [-4, 4], range: [0, 4] },
};

export function detectKnownFunction(text: string): keyof typeof KNOWN_FUNCS | null {
  const t = text.toLowerCase();
  if (t.includes("tanh")) return "tanh";
  if (t.includes("sigmoid") || t.includes("\\sigma")) return "sigmoid";
  if (t.includes("relu")) return "relu";
  return null;
}

export function ActivationCurve({ name }: { name: keyof typeof KNOWN_FUNCS }) {
  const { fn, domain, range } = KNOWN_FUNCS[name];
  const W = 280, H = 120, PAD = 10;
  const [x0, x1] = domain;
  const [y0, y1] = range;
  const toX = (x: number) => PAD + ((x - x0) / (x1 - x0)) * (W - 2 * PAD);
  const toY = (y: number) => H - PAD - ((y - y0) / (y1 - y0)) * (H - 2 * PAD);
  const points = Array.from({ length: 61 }, (_, i) => {
    const x = x0 + (i / 60) * (x1 - x0);
    return [x, toX(x), toY(fn(x))] as const;
  });
  const path = points.map(([, px, py], i) => `${i === 0 ? "M" : "L"}${px.toFixed(1)},${py.toFixed(1)}`).join(" ");
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const hovered = hoverIdx !== null ? points[hoverIdx] : null;

  return (
    <div className="mt-3 rounded-lg bg-[#FAFAFC] p-3">
      <svg
        width="100%"
        viewBox={`0 0 ${W} ${H}`}
        className="overflow-visible"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - rect.left) / rect.width) * W;
          const idx = Math.round(((px - PAD) / (W - 2 * PAD)) * 60);
          setHoverIdx(Math.max(0, Math.min(60, idx)));
        }}
        onMouseLeave={() => setHoverIdx(null)}
      >
        {y0 < 0 && y1 > 0 && (
          <line x1={PAD} x2={W - PAD} y1={toY(0)} y2={toY(0)} stroke="rgba(84,84,86,.18)" strokeWidth="1" />
        )}
        {x0 < 0 && x1 > 0 && (
          <line x1={toX(0)} x2={toX(0)} y1={PAD} y2={H - PAD} stroke="rgba(84,84,86,.18)" strokeWidth="1" />
        )}
        <path d={path} fill="none" stroke="#007AFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {hovered && (
          <>
            <line x1={hovered[1]} x2={hovered[1]} y1={PAD} y2={H - PAD} stroke="rgba(84,84,86,.3)" strokeWidth="1" />
            <circle cx={hovered[1]} cy={hovered[2]} r="4" fill="#007AFF" stroke="white" strokeWidth="1.5" />
          </>
        )}
      </svg>
      <div className="mt-1 text-center font-mono text-[11px] text-[#0062CC]" style={{ visibility: hovered ? "visible" : "hidden" }}>
        x = {hovered ? hovered[0].toFixed(2) : "0.00"}, {name}(x) = {hovered ? fn(hovered[0]).toFixed(3) : "0.000"}
      </div>
      <div className="mt-1 text-center text-[10.5px] text-[rgba(60,60,67,.5)]">
        {name}(x) — 코드를 실행한 값이 아니라 알려진 표준 함수를 그린 참고용 그래프입니다
      </div>
    </div>
  );
}

export function isNumericPiecewise(piecewise: PiecewiseBranch[]): boolean {
  return piecewise.length > 0 && piecewise.every((b) => !Number.isNaN(parseFloat(b.value)));
}

export function PiecewiseChart({ piecewise }: { piecewise: PiecewiseBranch[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const parsed = piecewise.map((b) => ({ ...b, num: parseFloat(b.value) }));
  const max = Math.max(...parsed.map((b) => Math.abs(b.num)), 1);

  return (
    <div className="mt-3 rounded-lg bg-[#FAFAFC] p-3">
      <div className="flex items-end gap-3" style={{ height: 96 }}>
        {parsed.map((b, i) => (
          <div
            key={i}
            className="flex h-full flex-1 flex-col items-center justify-end gap-1"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <span
              className="font-mono text-[11.5px] font-semibold"
              style={{ color: hover === i ? "#0062CC" : "#1D1D1F" }}
            >
              {b.num}
            </span>
            <div
              className="w-full rounded-t-[4px]"
              style={{
                height: `${(Math.abs(b.num) / max) * 72}px`,
                background: hover === i ? "#0062CC" : "#007AFF",
                transition: "background .12s ease",
              }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-3">
        {parsed.map((b, i) => (
          <div key={i} className="flex-1 truncate text-center font-mono text-[10.5px] text-[rgba(60,60,67,.6)]">
            {b.condition}
          </div>
        ))}
      </div>
    </div>
  );
}

// A quadratic cost J = w‖x - x_ref‖² is a bowl shape (paraboloid) no matter what
// w/x_ref actually are -- we draw the canonical shape z = x²+y² as an illustration
// of "this is convex, minimized at the reference," never the user's real x_ref.
// Detects the norm-squared LaTeX pattern PHASE_1_SLICE.md calls out explicitly.
export function detectQuadraticCost(latex: string): boolean {
  return /(\\lVert|\\Vert|\\\|)/.test(latex) && /\^2|\^\{2\}/.test(latex);
}

export function QuadraticCostSurface() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const W = 280, H = 200;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    const N = 13; // grid resolution -- enough to read as a surface, cheap to redraw every frame
    const grid: [number, number, number][][] = [];
    for (let i = 0; i < N; i++) {
      const row: [number, number, number][] = [];
      for (let j = 0; j < N; j++) {
        const x = (i / (N - 1)) * 4 - 2;
        const y = (j / (N - 1)) * 4 - 2;
        row.push([x, y, (x * x + y * y) * 0.5]);
      }
      grid.push(row);
    }

    const pitch = 0.55;
    let theta = 0.6;
    let raf = 0;

    function project(x: number, y: number, z: number): [number, number] {
      const cosT = Math.cos(theta), sinT = Math.sin(theta);
      const x1 = x * cosT + z * sinT;
      const z1 = -x * sinT + z * cosT;
      const cosP = Math.cos(pitch), sinP = Math.sin(pitch);
      const y1 = y * cosP - z1 * sinP - 0.6;
      const z2 = y * sinP + z1 * cosP;
      const camDist = 6;
      const f = camDist / (camDist + z2);
      return [W / 2 + x1 * 42 * f, H / 2 - y1 * 42 * f];
    }

    function draw() {
      if (!ctx) return;
      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = "#007AFF";
      ctx.lineWidth = 1.1;
      ctx.lineJoin = "round";
      ctx.globalAlpha = 0.85;
      for (let i = 0; i < N; i++) {
        ctx.beginPath();
        for (let j = 0; j < N; j++) {
          const [x, y, z] = grid[i][j];
          const [px, py] = project(x, y, z);
          j === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
      for (let j = 0; j < N; j++) {
        ctx.beginPath();
        for (let i = 0; i < N; i++) {
          const [x, y, z] = grid[i][j];
          const [px, py] = project(x, y, z);
          i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
      // mark the minimum (x_ref) with a dot so the "bowl converges here" reading is explicit
      const [mx, my] = project(0, 0, 0);
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#C93400";
      ctx.beginPath();
      ctx.arc(mx, my, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    function tick() {
      if (!paused) theta += 0.006;
      draw();
      raf = requestAnimationFrame(tick);
    }
    tick();
    return () => cancelAnimationFrame(raf);
  }, [paused]);

  return (
    <div className="mt-3 rounded-lg bg-[#FAFAFC] p-3">
      <canvas
        ref={canvasRef}
        style={{ width: 280, height: 200, cursor: "pointer" }}
        onClick={() => setPaused((p) => !p)}
        title={paused ? "클릭하면 다시 회전합니다" : "클릭하면 멈춥니다"}
      />
      <div className="mt-1 text-center text-[10.5px] text-[rgba(60,60,67,.5)]">
        예시 cost surface — 실제 x_ref/실행값이 아니라 &ldquo;볼록하고 기준점에서 최소&rdquo;라는
        이차함수 형태 자체를 보여주는 참고용 그래프입니다 (빨간 점 = 최소점). 클릭하면 멈춥니다.
      </div>
    </div>
  );
}

export function StateDiagramView({ diagram }: { diagram: StateTransition[] }) {
  return (
    <div className="mt-3 flex flex-col gap-1.5">
      {diagram.map((t, i) => (
        <div key={i} className="flex items-center gap-2 text-[12.5px] font-mono">
          <span className="rounded-full px-3 py-1.5 font-semibold" style={{ background: "white", border: "0.5px solid rgba(84,84,86,.18)" }}>
            {t.from_state}
          </span>
          <svg width="36" height="12" viewBox="0 0 36 12" className="shrink-0">
            <line x1="0" y1="6" x2="28" y2="6" stroke="#007AFF" strokeWidth="2" strokeLinecap="round" />
            <polygon points="28,2 36,6 28,10" fill="#007AFF" />
          </svg>
          <span className="rounded-full px-3 py-1.5 font-semibold" style={{ background: "white", border: "0.5px solid rgba(84,84,86,.18)" }}>
            {t.to_state}
          </span>
          <span className="text-[11px] text-[#0062CC]">{t.edge}</span>
        </div>
      ))}
    </div>
  );
}
