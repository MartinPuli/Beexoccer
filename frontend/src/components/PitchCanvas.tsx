import { TokenChip } from "../types/game";

interface PitchCanvasProps {
  chips: TokenChip[];
  ball: { x: number; y: number };
  highlightId?: string;
}

/**
 * SVG replica of the tabletop pitch. Animations are purposely light-weight so it can run smoothly on mobile browsers.
 */
export function PitchCanvas({ chips, ball, highlightId }: Readonly<PitchCanvasProps>) {
  return (
    <div className="pitch-wrapper">
      <svg viewBox="0 0 600 900" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
        <rect x="60" y="60" width="480" height="780" rx="32" stroke="#ffffff" strokeWidth="4" fill="transparent" />
        <line x1="300" y1="60" x2="300" y2="840" stroke="#ffffff" strokeWidth="3" />
        <circle cx="300" cy="450" r="88" stroke="#ffffff" strokeWidth="3" fill="transparent" />
        <circle cx="300" cy="450" r="6" fill="#ffffff" />
        <rect x="60" y="240" width="80" height="420" stroke="#ffffff" strokeWidth="3" fill="transparent" rx="24" />
        <rect x="460" y="240" width="80" height="420" stroke="#ffffff" strokeWidth="3" fill="transparent" rx="24" />

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
    </div>
  );
}
