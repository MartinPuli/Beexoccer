import React from "react";

interface SoccerBallProps {
  size?: number;
  color?: string;
  spinning?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const SoccerBall: React.FC<SoccerBallProps> = ({
  size = 100,
  color = "#11B13A",
  spinning = false,
  className = "",
  style = {},
}) => {
  const darkColor = color === "#11B13A" ? "#0d8a2e" : color;
  
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{
        animation: spinning ? "spin 2s linear infinite" : "none",
        ...style,
      }}
    >
      <defs>
        <radialGradient id="ballShine" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="70%" stopColor="#f5f5f5" />
          <stop offset="100%" stopColor="#e8e8e8" />
        </radialGradient>
        <filter id="ballShadow">
          <feDropShadow dx="2" dy="2" stdDeviation="2" floodOpacity="0.3" />
        </filter>
      </defs>

      {/* Sombra exterior */}
      <ellipse cx="52" cy="92" rx="30" ry="6" fill="rgba(0,0,0,0.2)" />

      {/* Círculo base de la pelota */}
      <circle cx="50" cy="50" r="44" fill="url(#ballShine)" filter="url(#ballShadow)" />
      <circle cx="50" cy="50" r="44" fill="none" stroke="#1a1a1a" strokeWidth="1.5" />

      {/* Pentágono central */}
      <path d="M50,22 L63,35 L58,52 L42,52 L37,35 Z" fill={color} stroke={darkColor} strokeWidth="0.5" />

      {/* Pentágono superior */}
      <path d="M50,6 L58,14 L50,22 L42,14 Z" fill={color} stroke={darkColor} strokeWidth="0.5" />

      {/* Pentágono superior derecho */}
      <path d="M72,18 L78,32 L63,35 L58,22 L63,14 Z" fill={color} stroke={darkColor} strokeWidth="0.5" />

      {/* Pentágono derecho */}
      <path d="M88,48 L85,62 L70,58 L63,52 L63,35 L78,32 Z" fill={color} stroke={darkColor} strokeWidth="0.5" />

      {/* Pentágono inferior derecho */}
      <path d="M75,78 L62,82 L58,68 L63,52 L70,58 Z" fill={color} stroke={darkColor} strokeWidth="0.5" />

      {/* Pentágono inferior */}
      <path d="M50,94 L38,86 L42,68 L58,68 L62,86 Z" fill={color} stroke={darkColor} strokeWidth="0.5" />

      {/* Pentágono inferior izquierdo */}
      <path d="M25,78 L30,58 L37,52 L42,68 L38,82 Z" fill={color} stroke={darkColor} strokeWidth="0.5" />

      {/* Pentágono izquierdo */}
      <path d="M12,48 L22,32 L37,35 L37,52 L30,58 L15,62 Z" fill={color} stroke={darkColor} strokeWidth="0.5" />

      {/* Pentágono superior izquierdo */}
      <path d="M28,18 L37,14 L42,22 L37,35 L22,32 Z" fill={color} stroke={darkColor} strokeWidth="0.5" />

      {/* Líneas de costura */}
      <path d="M50,22 L58,14" stroke="#1a1a1a" strokeWidth="0.8" fill="none" />
      <path d="M50,22 L42,14" stroke="#1a1a1a" strokeWidth="0.8" fill="none" />
      <path d="M63,35 L78,32" stroke="#1a1a1a" strokeWidth="0.8" fill="none" />
      <path d="M63,35 L63,52" stroke="#1a1a1a" strokeWidth="0.8" fill="none" />
      <path d="M58,52 L70,58" stroke="#1a1a1a" strokeWidth="0.8" fill="none" />
      <path d="M58,52 L58,68" stroke="#1a1a1a" strokeWidth="0.8" fill="none" />
      <path d="M42,52 L42,68" stroke="#1a1a1a" strokeWidth="0.8" fill="none" />
      <path d="M42,52 L30,58" stroke="#1a1a1a" strokeWidth="0.8" fill="none" />
      <path d="M37,35 L22,32" stroke="#1a1a1a" strokeWidth="0.8" fill="none" />
      <path d="M37,35 L37,52" stroke="#1a1a1a" strokeWidth="0.8" fill="none" />

      {/* Brillo superior */}
      <ellipse cx="38" cy="28" rx="8" ry="5" fill="rgba(255,255,255,0.4)" transform="rotate(-30 38 28)" />
    </svg>
  );
};

export default SoccerBall;
