import React, { ReactNode } from "react";
import { TokenChip } from "../types/game";

interface PitchCanvasProps {
  chips: TokenChip[];
  ball: { x: number; y: number };
  highlightId?: string;
  children?: ReactNode;
  aimLine?: { from: { x: number; y: number }; to: { x: number; y: number } };
  onPointerDown?: (event: React.PointerEvent<SVGSVGElement>) => void;
  onPointerMove?: (event: React.PointerEvent<SVGSVGElement>) => void;
  onPointerUp?: (event: React.PointerEvent<SVGSVGElement>) => void;
}

/**
 * SVG replica of the tabletop pitch. Animations are purposely light-weight so it can run smoothly on mobile browsers.
 */
export function PitchCanvas({ chips, ball, highlightId, children, aimLine, onPointerDown, onPointerMove, onPointerUp }: Readonly<PitchCanvasProps>) {
  return (
    <div className="pitch-wrapper" style={{ background: "#0f2f12" }}>
      <svg
        viewBox="0 0 600 900"
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid slice"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <defs>
          <linearGradient id="pitch-stripes" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0f5a23" />
            <stop offset="50%" stopColor="#0d501f" />
            <stop offset="100%" stopColor="#0f5a23" />
          </linearGradient>
          <pattern id="pitch-bands" x="0" y="0" width="1" height="0.14">
            <rect x="0" y="0" width="600" height="126" fill="#0f5a23" />
            <rect x="0" y="63" width="600" height="63" fill="#0c4a1d" />
          </pattern>
          <linearGradient id="edge-glow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.18)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
        </defs>

        <rect width="600" height="900" fill="url(#pitch-bands)" />
        <rect width="600" height="900" fill="url(#pitch-stripes)" opacity="0.28" />
        <rect width="600" height="900" fill="url(#edge-glow)" opacity="0.6" />
        <rect x="46" y="40" width="508" height="820" rx="32" stroke="#dfe8d6" strokeWidth="5" fill="transparent" />
        <line x1="300" y1="40" x2="300" y2="860" stroke="#e8f0e0" strokeWidth="4" />
        <circle cx="300" cy="450" r="90" stroke="#e8f0e0" strokeWidth="4" fill="transparent" />
        <circle cx="300" cy="450" r="6" fill="#e8f0e0" />

        {/* Top penalty box */}
        <rect x="160" y="40" width="280" height="140" stroke="#e8f0e0" strokeWidth="4" fill="transparent" />
        <rect x="210" y="40" width="180" height="70" stroke="#e8f0e0" strokeWidth="4" fill="transparent" />
        <circle cx="300" cy="150" r="6" fill="#e8f0e0" />
        <path d="M160 180 Q300 240 440 180" fill="transparent" stroke="#e8f0e0" strokeWidth="4" />

        {/* Bottom penalty box */}
        <rect x="160" y="720" width="280" height="140" stroke="#e8f0e0" strokeWidth="4" fill="transparent" />
        <rect x="210" y="790" width="180" height="70" stroke="#e8f0e0" strokeWidth="4" fill="transparent" />
        <circle cx="300" cy="750" r="6" fill="#e8f0e0" />
        <path d="M160 720 Q300 660 440 720" fill="transparent" stroke="#e8f0e0" strokeWidth="4" />

        {/* Goals top/bottom */}
        <rect x="210" y="18" width="180" height="18" stroke="#dfe8d6" strokeWidth="3" fill="rgba(223,232,214,0.25)" />
        <rect x="210" y="864" width="180" height="18" stroke="#dfe8d6" strokeWidth="3" fill="rgba(223,232,214,0.25)" />

        {aimLine && (
          <line
            x1={aimLine.from.x}
            y1={aimLine.from.y}
            x2={aimLine.to.x}
            y2={aimLine.to.y}
            stroke="#ffb347"
            strokeWidth={4}
            strokeLinecap="round"
            strokeDasharray="8 6"
          />
        )}

        {chips.map((chip) => (
          <g key={chip.id}>
            <circle cx={chip.x} cy={chip.y} r={chip.radius + 8} fill="rgba(255,179,71,0.35)" opacity={highlightId === chip.id ? 1 : 0}>
              <animate attributeName="opacity" values="0;1;0" dur="1.2s" repeatCount="indefinite" />
            </circle>
            <circle cx={chip.x} cy={chip.y} r={chip.radius} fill={chip.fill} stroke="#ffffff" strokeWidth="3" />
            <text
              x={chip.x}
              y={chip.y + 6}
              textAnchor="middle"
              fontSize="18"
              fill="#ffffff"
              style={{ fontFamily: "Chakra Petch, sans-serif" }}
            >
              {chip.flagEmoji}
            </text>
          </g>
        ))}

        <circle cx={ball.x} cy={ball.y} r={12} fill="#ffffff" stroke="#111" strokeWidth="3" />
      </svg>
      <div className="pitch-overlay" />
      {children}
    </div>
  );
}
