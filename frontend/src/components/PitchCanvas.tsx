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

export function PitchCanvas({ chips, ball, highlightId, children, aimLine, onPointerDown, onPointerMove, onPointerUp }: Readonly<PitchCanvasProps>) {
  return (
    <>
      <svg
        className="pitch-svg"
        viewBox="0 0 600 900"
        preserveAspectRatio="xMidYMid slice"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <defs>
          <filter id="neonGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <filter id="chipGlow">
            <feGaussianBlur stdDeviation="4" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Fondo negro sólido */}
        <rect width="600" height="900" fill="#050808" />

        {/* Líneas exteriores del campo con glow neón */}
        <rect x="50" y="50" width="500" height="800" rx="0" stroke="#00ff6a" strokeWidth="4" fill="none" filter="url(#neonGlow)" />
        
        {/* Línea del medio */}
        <line x1="50" y1="450" x2="550" y2="450" stroke="#00ff6a" strokeWidth="3" filter="url(#neonGlow)" />
        
        {/* Círculo central */}
        <circle cx="300" cy="450" r="70" stroke="#00ff6a" strokeWidth="3" fill="none" filter="url(#neonGlow)" />
        <circle cx="300" cy="450" r="6" fill="#00ff6a" filter="url(#neonGlow)" />

        {/* Área grande superior */}
        <rect x="150" y="50" width="300" height="120" stroke="#00ff6a" strokeWidth="3" fill="none" filter="url(#neonGlow)" />
        {/* Área chica superior */}
        <rect x="200" y="50" width="200" height="50" stroke="#00ff6a" strokeWidth="3" fill="none" filter="url(#neonGlow)" />
        {/* Punto penal superior */}
        <circle cx="300" cy="130" r="5" fill="#00ff6a" filter="url(#neonGlow)" />

        {/* Área grande inferior */}
        <rect x="150" y="730" width="300" height="120" stroke="#00ff6a" strokeWidth="3" fill="none" filter="url(#neonGlow)" />
        {/* Área chica inferior */}
        <rect x="200" y="800" width="200" height="50" stroke="#00ff6a" strokeWidth="3" fill="none" filter="url(#neonGlow)" />
        {/* Punto penal inferior */}
        <circle cx="300" cy="770" r="5" fill="#00ff6a" filter="url(#neonGlow)" />

        {/* Arco superior - portería */}
        <rect x="220" y="15" width="160" height="35" fill="rgba(0,255,106,0.12)" stroke="#00ff6a" strokeWidth="3" rx="2" filter="url(#neonGlow)" />
        
        {/* Arco inferior - portería */}
        <rect x="220" y="850" width="160" height="35" fill="rgba(0,255,106,0.12)" stroke="#00ff6a" strokeWidth="3" rx="2" filter="url(#neonGlow)" />

        {/* Línea de tiro (aiming) */}
        {aimLine && (
          <line
            x1={aimLine.from.x}
            y1={aimLine.from.y}
            x2={aimLine.to.x}
            y2={aimLine.to.y}
            stroke="#ffc85c"
            strokeWidth={5}
            strokeLinecap="round"
            strokeDasharray="10 8"
          />
        )}

        {/* Fichas */}
        {chips.map((chip) => {
          const isPlayer = chip.owner === "creator";
          const chipColor = isPlayer ? "#00a8ff" : "#ff4d5a";
          const borderColor = isPlayer ? "#0066cc" : "#cc0022";
          
          return (
            <g key={chip.id}>
              {/* Highlight de selección */}
              {highlightId === chip.id && (
                <circle 
                  cx={chip.x} 
                  cy={chip.y} 
                  r={chip.radius + 12} 
                  fill="none" 
                  stroke="#ffc85c" 
                  strokeWidth="4"
                  opacity="0.9"
                >
                  <animate attributeName="r" values={`${chip.radius + 8};${chip.radius + 16};${chip.radius + 8}`} dur="0.8s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.6;1;0.6" dur="0.8s" repeatCount="indefinite" />
                </circle>
              )}
              {/* Ficha principal */}
              <circle 
                cx={chip.x} 
                cy={chip.y} 
                r={chip.radius} 
                fill={chipColor}
                stroke={borderColor}
                strokeWidth="4"
                filter="url(#chipGlow)"
              />
              {/* Icono */}
              <text
                x={chip.x}
                y={chip.y + 7}
                textAnchor="middle"
                fontSize="20"
                fill="#fff"
                fontWeight="bold"
              >
                {chip.flagEmoji}
              </text>
            </g>
          );
        })}

        {/* Pelota neón */}
        <g filter="url(#neonGlow)">
          <circle cx={ball.x} cy={ball.y} r={16} fill="#ffffff" stroke="#cccccc" strokeWidth="2" />
          <circle cx={ball.x} cy={ball.y} r={6} fill="#333333" />
          {/* Brillo */}
          <circle cx={ball.x - 4} cy={ball.y - 4} r={4} fill="rgba(255,255,255,0.6)" />
        </g>
      </svg>
      {children}
    </>
  );
}
