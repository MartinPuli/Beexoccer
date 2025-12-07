import React, { ReactNode } from "react";
import { TokenChip } from "../types/game";

interface PitchCanvasProps {
  chips: TokenChip[];
  ball: { x: number; y: number };
  highlightId?: string;
  activePlayer?: "creator" | "challenger";
  isPlayerTurn?: boolean;
  children?: ReactNode;
  aimLine?: { from: { x: number; y: number }; to: { x: number; y: number } };
  onPointerDown?: (event: React.PointerEvent<SVGSVGElement>) => void;
  onPointerMove?: (event: React.PointerEvent<SVGSVGElement>) => void;
  onPointerUp?: (event: React.PointerEvent<SVGSVGElement>) => void;
}

export function PitchCanvas({ chips, ball, highlightId, activePlayer, isPlayerTurn, children, aimLine, onPointerDown, onPointerMove, onPointerUp }: Readonly<PitchCanvasProps>) {
  return (
    <>
      <svg
        className="pitch-svg"
        viewBox="0 0 600 900"
        preserveAspectRatio="xMidYMid meet"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <defs>
          <filter id="neonGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
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
          <filter id="activeGlow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="6" result="glow"/>
            <feMerge>
              <feMergeNode in="glow"/>
              <feMergeNode in="glow"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          {/* Patrón de franjas de césped alternadas */}
          <pattern id="grassStripes" patternUnits="userSpaceOnUse" width="600" height="100">
            <rect width="600" height="50" fill="#0d3320" />
            <rect y="50" width="600" height="50" fill="#1a5035" />
          </pattern>
        </defs>

        {/* Fondo con franjas de césped */}
        <rect width="600" height="900" fill="url(#grassStripes)" />
        
        {/* Borde exterior oscuro */}
        <rect width="600" height="50" fill="#0a1a12" />
        <rect y="850" width="600" height="50" fill="#0a1a12" />
        <rect width="50" height="900" fill="#0a1a12" />
        <rect x="550" width="50" height="900" fill="#0a1a12" />

        {/* Líneas exteriores del campo con glow neón */}
        <rect x="50" y="50" width="500" height="800" rx="0" stroke="var(--neon-green, #00ff6a)" strokeWidth="4" fill="none" filter="url(#neonGlow)" />
        
        {/* Línea del medio - MUY visible con doble línea */}
        <line x1="50" y1="450" x2="550" y2="450" stroke="#00ff6a" strokeWidth="6" opacity="1" />
        <line x1="50" y1="450" x2="550" y2="450" stroke="#ffffff" strokeWidth="2" opacity="0.9" />
        
        {/* Círculo central */}
        <circle cx="300" cy="450" r="70" stroke="var(--neon-green, #00ff6a)" strokeWidth="4" fill="none" filter="url(#neonGlow)" />
        <circle cx="300" cy="450" r="6" fill="var(--neon-green, #00ff6a)" filter="url(#neonGlow)" />

        {/* Área grande superior */}
        <rect x="150" y="50" width="300" height="120" stroke="var(--neon-green, #00ff6a)" strokeWidth="3" fill="none" filter="url(#neonGlow)" />
        {/* Área chica superior */}
        <rect x="200" y="50" width="200" height="50" stroke="var(--neon-green, #00ff6a)" strokeWidth="3" fill="none" filter="url(#neonGlow)" />
        {/* Punto penal superior */}
        <circle cx="300" cy="130" r="5" fill="var(--neon-green, #00ff6a)" filter="url(#neonGlow)" />

        {/* Área grande inferior */}
        <rect x="150" y="730" width="300" height="120" stroke="var(--neon-green, #00ff6a)" strokeWidth="3" fill="none" filter="url(#neonGlow)" />
        {/* Área chica inferior */}
        <rect x="200" y="800" width="200" height="50" stroke="var(--neon-green, #00ff6a)" strokeWidth="3" fill="none" filter="url(#neonGlow)" />
        {/* Punto penal inferior */}
        <circle cx="300" cy="770" r="5" fill="var(--neon-green, #00ff6a)" filter="url(#neonGlow)" />

        {/* Arco superior - portería */}
        <rect x="220" y="15" width="160" height="35" fill="rgba(0,255,106,0.15)" stroke="var(--neon-green, #00ff6a)" strokeWidth="3" rx="2" filter="url(#neonGlow)" />
        
        {/* Arco inferior - portería */}
        <rect x="220" y="850" width="160" height="35" fill="rgba(0,255,106,0.15)" stroke="var(--neon-green, #00ff6a)" strokeWidth="3" rx="2" filter="url(#neonGlow)" />

        {/* Línea de tiro (aiming) - con límite visual */}
        {aimLine && (
          <line
            x1={aimLine.from.x}
            y1={aimLine.from.y}
            x2={aimLine.to.x}
            y2={aimLine.to.y}
            stroke="var(--accent-gold, #ffc85c)"
            strokeWidth={6}
            strokeLinecap="round"
            strokeDasharray="12 8"
            filter="url(#neonGlow)"
          />
        )}

        {/* Fichas */}
        {chips.map((chip) => {
          const isPlayer = chip.owner === "creator";
          const chipColor = isPlayer ? "var(--accent-blue, #00a8ff)" : "var(--accent-red, #ff4d5a)";
          const borderColor = isPlayer ? "#0066cc" : "#cc0022";
          // Glow solo si es el turno del jugador correspondiente
          const isActive = activePlayer === chip.owner && (isPlayerTurn || chip.owner === "challenger");
          const isSelected = highlightId === chip.id;
          
          return (
            <g key={chip.id}>
              {/* Glow para fichas del jugador activo */}
              {isActive && (
                <circle 
                  cx={chip.x} 
                  cy={chip.y} 
                  r={chip.radius + 8} 
                  fill="none" 
                  stroke={isPlayer ? "var(--accent-blue, #00a8ff)" : "var(--accent-red, #ff4d5a)"}
                  strokeWidth="3"
                  opacity="0.6"
                  filter="url(#activeGlow)"
                >
                  <animate attributeName="opacity" values="0.4;0.8;0.4" dur="1.2s" repeatCount="indefinite" />
                </circle>
              )}
              {/* Highlight de selección específica */}
              {isSelected && (
                <circle 
                  cx={chip.x} 
                  cy={chip.y} 
                  r={chip.radius + 14} 
                  fill="none" 
                  stroke="var(--accent-gold, #ffc85c)" 
                  strokeWidth="4"
                  opacity="0.9"
                >
                  <animate attributeName="r" values={`${chip.radius + 10};${chip.radius + 18};${chip.radius + 10}`} dur="0.8s" repeatCount="indefinite" />
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
                filter={isActive ? "url(#activeGlow)" : "url(#chipGlow)"}
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
          <circle cx={ball.x} cy={ball.y} r={16} fill="#ffffff" stroke="#dddddd" strokeWidth="2" />
          <circle cx={ball.x} cy={ball.y} r={6} fill="#333333" />
          <circle cx={ball.x - 4} cy={ball.y - 4} r={4} fill="rgba(255,255,255,0.7)" />
        </g>
      </svg>
      {children}
    </>
  );
}
