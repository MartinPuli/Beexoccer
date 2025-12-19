import React, { ReactNode, useRef, useEffect, useState, useCallback } from "react";
import { TokenChip } from "../types/game";

interface PitchCanvasProps {
  chips: TokenChip[];
  ball: { x: number; y: number; vx?: number; vy?: number };
  highlightId?: string;
  activePlayer?: "creator" | "challenger";
  isPlayerTurn?: boolean;
  children?: ReactNode;
  aimLine?: { from: { x: number; y: number }; to: { x: number; y: number } };
  shotPower?: number;
  onPointerDown?: (event: React.PointerEvent<SVGSVGElement>) => void;
  onPointerMove?: (event: React.PointerEvent<SVGSVGElement>) => void;
  onPointerUp?: (event: React.PointerEvent<SVGSVGElement>) => void;
  onPointerCancel?: (event: React.PointerEvent<SVGSVGElement>) => void;
  // Touch event handlers for iOS Safari compatibility
  onTouchStart?: (event: React.TouchEvent<SVGSVGElement>) => void;
  onTouchMove?: (event: React.TouchEvent<SVGSVGElement>) => void;
  onTouchEnd?: (event: React.TouchEvent<SVGSVGElement>) => void;
  lowPerf?: boolean;
}

// Componente de esfera 3D real usando Canvas 2D con proyección 3D mejorada
function SoccerBall3DCanvas({ rotateX, rotateY, size = 40, lowPerf = false }: { rotateX: number; rotateY: number; size?: number; lowPerf?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const drawBall = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // respect devicePixelRatio for crisp rendering, but reduce on low perf
    const dpr = lowPerf ? 1 : (window.devicePixelRatio || 1);
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    const cx = w / 2;
    const cy = h / 2;
    const radius = (Math.min(w, h) / 2) - 4;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    
    // Limpiar canvas
    ctx.clearRect(0, 0, w, h);

    if (lowPerf) {
      // Simple, low-cost spherical ball for mobile/low-perf
      const grad = ctx.createRadialGradient(cx - radius * 0.3, cy - radius * 0.3, 0, cx, cy, radius);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.6, '#e0e0e0');
      grad.addColorStop(1, '#b0b0b0');
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(0,0,0,0.12)';
      ctx.stroke();
      return;
    }
    
    // Convertir ángulos a radianes
    const rx = (rotateX * Math.PI) / 180;
    const ry = (rotateY * Math.PI) / 180;
    
    // Función para rotar un punto 3D (orden: Y primero, luego X)
    const rotate3D = (x: number, y: number, z: number) => {
      // Rotar en Y (horizontal)
      const cosY = Math.cos(ry);
      const sinY = Math.sin(ry);
      const x1 = x * cosY - z * sinY;
      const z1 = x * sinY + z * cosY;
      
      // Rotar en X (vertical)
      const cosX = Math.cos(rx);
      const sinX = Math.sin(rx);
      const y1 = y * cosX - z1 * sinX;
      const z2 = y * sinX + z1 * cosX;
      
      return { x: x1, y: y1, z: z2 };
    };
    
    // Proyección 3D a 2D con perspectiva
    const project = (x: number, y: number, z: number) => {
      const fov = 300;
      const scale = fov / (fov + z);
      return {
        x: cx + x * scale,
        y: cy + y * scale,
        scale,
        depth: z
      };
    };
    
    // Dibujar sombra debajo de la pelota
    ctx.beginPath();
    ctx.ellipse(cx + 3, cy + radius + 5, radius * 0.7, radius * 0.15, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.fill();
    
    // Dibujar la esfera base con gradiente esférico mejorado
    const baseGradient = ctx.createRadialGradient(
      cx - radius * 0.35, cy - radius * 0.35, 0,
      cx, cy, radius * 1.1
    );
    baseGradient.addColorStop(0, '#ffffff');
    baseGradient.addColorStop(0.2, '#fafafa');
    baseGradient.addColorStop(0.5, '#e8e8e8');
    baseGradient.addColorStop(0.8, '#c0c0c0');
    baseGradient.addColorStop(1, '#909090');
    
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = baseGradient;
    ctx.fill();
    
    // Posiciones de los 12 pentágonos (vértices de icosaedro)
    const phi = (1 + Math.sqrt(5)) / 2;
    const pentagonCenters = [
      [0, 1, phi], [0, -1, phi], [0, 1, -phi], [0, -1, -phi],
      [1, phi, 0], [-1, phi, 0], [1, -phi, 0], [-1, -phi, 0],
      [phi, 0, 1], [phi, 0, -1], [-phi, 0, 1], [-phi, 0, -1],
    ];
    
    // Posiciones de los 20 hexágonos (caras del icosaedro)
    const hexagonCenters = [
      [1, 1, 1], [1, 1, -1], [1, -1, 1], [1, -1, -1],
      [-1, 1, 1], [-1, 1, -1], [-1, -1, 1], [-1, -1, -1],
      [0, phi, 1/phi], [0, phi, -1/phi], [0, -phi, 1/phi], [0, -phi, -1/phi],
      [1/phi, 0, phi], [-1/phi, 0, phi], [1/phi, 0, -phi], [-1/phi, 0, -phi],
      [phi, 1/phi, 0], [phi, -1/phi, 0], [-phi, 1/phi, 0], [-phi, -1/phi, 0],
    ];
    
    // Normalizar y transformar pentágonos
    const transformedPentagons = pentagonCenters.map(([px, py, pz]) => {
      const len = Math.sqrt(px * px + py * py + pz * pz);
      const nx = (px / len) * radius * 0.92;
      const ny = (py / len) * radius * 0.92;
      const nz = (pz / len) * radius * 0.92;
      const rotated = rotate3D(nx, ny, nz);
      const projected = project(rotated.x, rotated.y, rotated.z);
      return { rotated, projected, type: 'pentagon' as const };
    });
    
    // Normalizar y transformar hexágonos
    const transformedHexagons = hexagonCenters.map(([px, py, pz]) => {
      const len = Math.sqrt(px * px + py * py + pz * pz);
      const nx = (px / len) * radius * 0.92;
      const ny = (py / len) * radius * 0.92;
      const nz = (pz / len) * radius * 0.92;
      const rotated = rotate3D(nx, ny, nz);
      const projected = project(rotated.x, rotated.y, rotated.z);
      return { rotated, projected, type: 'hexagon' as const };
    });
    
    // Combinar y ordenar por profundidad
    const allShapes = [...transformedPentagons, ...transformedHexagons]
      .filter(shape => shape.rotated.z > -radius * 0.3)
      .sort((a, b) => a.rotated.z - b.rotated.z);
    
    // Dibujar formas
    allShapes.forEach(shape => {
      const { rotated, projected, type } = shape;
      const sides = type === 'pentagon' ? 5 : 6;
      const shapeRadius = radius * (type === 'pentagon' ? 0.18 : 0.14) * projected.scale;
      
      // Calcular iluminación basada en la normal
      const lightDir = { x: -0.5, y: -0.5, z: 1 };
      const normal = { 
        x: rotated.x / radius, 
        y: rotated.y / radius, 
        z: rotated.z / radius 
      };
      const lightIntensity = Math.max(0, 
        normal.x * lightDir.x + normal.y * lightDir.y + normal.z * lightDir.z
      );
      
      // Opacidad basada en profundidad y visibilidad
      const depthFactor = (rotated.z + radius) / (radius * 2);
      const opacity = Math.max(0.2, Math.min(1, depthFactor * 1.2));
      
      // Dibujar la forma
      ctx.beginPath();
      const rotationOffset = type === 'pentagon' ? -Math.PI / 2 : 0;
      for (let i = 0; i < sides; i++) {
        const angle = (i * 2 * Math.PI) / sides + rotationOffset;
        const px = projected.x + Math.cos(angle) * shapeRadius;
        const py = projected.y + Math.sin(angle) * shapeRadius;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      
      if (type === 'pentagon') {
        // Pentágonos negros con gradiente
        const brightness = Math.floor(20 + lightIntensity * 30);
        ctx.fillStyle = `rgba(${brightness}, ${brightness}, ${brightness}, ${opacity})`;
        ctx.fill();
        ctx.strokeStyle = `rgba(0, 0, 0, ${opacity * 0.6})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      } else {
        // Hexágonos blancos (solo borde)
        ctx.strokeStyle = `rgba(60, 60, 60, ${opacity * 0.4})`;
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
    });
    
    // Dibujar costuras adicionales entre las formas
    ctx.strokeStyle = 'rgba(100, 100, 100, 0.25)';
    ctx.lineWidth = 0.5;
    
    // Líneas de costura en latitudes
    for (let lat = 1; lat <= 4; lat++) {
      const latAngle = (lat / 5) * Math.PI;
      const y = Math.cos(latAngle) * radius * 0.9;
      const ringRadius = Math.sin(latAngle) * radius * 0.9;
      
      ctx.beginPath();
      for (let lon = 0; lon <= 32; lon++) {
        const lonAngle = (lon / 32) * Math.PI * 2;
        const point = rotate3D(
          Math.cos(lonAngle) * ringRadius,
          y,
          Math.sin(lonAngle) * ringRadius
        );
        
        if (point.z > -radius * 0.2) {
          const proj = project(point.x, point.y, point.z);
          if (lon === 0 || point.z <= -radius * 0.2) {
            ctx.moveTo(proj.x, proj.y);
          } else {
            ctx.lineTo(proj.x, proj.y);
          }
        }
      }
      ctx.stroke();
    }
    
    // Brillo especular principal
    const highlightGradient = ctx.createRadialGradient(
      cx - radius * 0.4, cy - radius * 0.4, 0,
      cx - radius * 0.4, cy - radius * 0.4, radius * 0.5
    );
    highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
    highlightGradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.4)');
    highlightGradient.addColorStop(0.7, 'rgba(255, 255, 255, 0.1)');
    highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = highlightGradient;
    ctx.fill();
    
    // Brillo secundario pequeño
    ctx.beginPath();
    ctx.ellipse(cx - radius * 0.25, cy - radius * 0.3, radius * 0.15, radius * 0.08, -0.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fill();
    
    // Borde sutil de la esfera
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();
    
  }, [rotateX, rotateY, lowPerf]);
  
  useEffect(() => {
    drawBall();
  }, [drawBall]);
  
  return (
    <canvas
      ref={canvasRef}
      width={Math.round(size * 2 * (lowPerf ? 1 : (window.devicePixelRatio || 1)))}
      height={Math.round(size * 2 * (lowPerf ? 1 : (window.devicePixelRatio || 1)))}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        filter: lowPerf ? 'none' : 'drop-shadow(2px 3px 4px rgba(0,0,0,0.4))',
      }}
    />
  );
}

// Detect iOS Safari where foreignObject with Canvas has rendering bugs
const isIOS = typeof navigator !== 'undefined' && 
  /iPad|iPhone|iPod/.test(navigator.userAgent) && 
  !(window as unknown as { MSStream?: unknown }).MSStream;

export function PitchCanvas({ chips, ball, highlightId, activePlayer, isPlayerTurn, children, aimLine, shotPower: shotPowerProp = 0, onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onTouchStart, onTouchMove, onTouchEnd, lowPerf = false }: Readonly<PitchCanvasProps>) {
  // Sistema de rotación 3D realista para la pelota
  const lastBallPosRef = useRef({ x: ball.x, y: ball.y });
  const [ballRotation, setBallRotation] = useState({ rotateX: 0, rotateY: 0 });
  
  // Calcular rotación 3D basada en movimiento - efecto mejorado
  useEffect(() => {
    const dx = ball.x - lastBallPosRef.current.x;
    const dy = ball.y - lastBallPosRef.current.y;
    const distance = Math.hypot(dx, dy);
    
    if (distance > 0.2) {
      // Radio visual de la pelota
      const ballRadius = 20;
      // Circunferencia = 2 * PI * radio
      const circumference = 2 * Math.PI * ballRadius;
      // Grados por pixel de movimiento (una vuelta completa = circunferencia)
      const degreesPerPixel = 360 / circumference;
      
      // Multiplicador para hacer la rotación más visible
      const visualMultiplier = 2.5;
      
      // Rotación física correcta:
      // - Movimiento en Y (arriba/abajo) -> rota en eje X (rueda hacia adelante/atrás)
      // - Movimiento en X (izq/der) -> rota en eje Y (rueda hacia los lados)
      setBallRotation(prev => ({
        rotateX: prev.rotateX + dy * degreesPerPixel * visualMultiplier,
        rotateY: prev.rotateY - dx * degreesPerPixel * visualMultiplier,
      }));
    }
    
    lastBallPosRef.current = { x: ball.x, y: ball.y };
  }, [ball.x, ball.y]);
  
  // Usar el prop de shotPower directamente
  const shotPower = shotPowerProp;
  
  // Función para interpolar entre dos colores RGB
  const lerpColor = (color1: [number, number, number], color2: [number, number, number], t: number): string => {
    const r = Math.round(color1[0] + (color2[0] - color1[0]) * t);
    const g = Math.round(color1[1] + (color2[1] - color1[1]) * t);
    const b = Math.round(color1[2] + (color2[2] - color1[2]) * t);
    return `rgb(${r}, ${g}, ${b})`;
  };
  
  // Sistema de colores con gradiente continuo según potencia
  const getAimLineColor = (power: number) => {
    // Colores: verde -> amarillo -> naranja -> rojo
    const green: [number, number, number] = [34, 197, 94];    // #22c55e
    const yellow: [number, number, number] = [234, 179, 8];   // #eab308
    const orange: [number, number, number] = [249, 115, 22];  // #f97316
    const red: [number, number, number] = [239, 68, 68];      // #ef4444
    
    if (power < 0.33) {
      // Verde a Amarillo
      return lerpColor(green, yellow, power / 0.33);
    } else if (power < 0.66) {
      // Amarillo a Naranja
      return lerpColor(yellow, orange, (power - 0.33) / 0.33);
    } else {
      // Naranja a Rojo
      return lerpColor(orange, red, (power - 0.66) / 0.34);
    }
  };
  
  // Ancho progresivo de la línea
  const getAimLineWidth = (power: number) => {
    return 3 + (power * 8); // Ancho entre 3 y 11
  };
  
  // Opacidad alta siempre para mejor visibilidad
  const getAimLineOpacity = (power: number) => {
    return 0.7 + (power * 0.3); // Opacidad entre 0.7 y 1
  };
  
  // Obtener texto de potencia - ahora muestra el porcentaje exacto
  const getPowerLabel = (power: number) => {
    return `${Math.round(power * 100)}%`;
  };
  
  // Clamp ball position to field boundaries (visual fix for iOS)
  const clampedBall = {
    x: Math.max(50, Math.min(550, ball.x)),
    y: Math.max(15, Math.min(885, ball.y)), // Allow ball in goal area (15-885)
  };

  return (
    <>
      <svg
        className="pitch-svg"
        viewBox="0 0 600 900"
        preserveAspectRatio="xMidYMid meet"
        style={{ 
          touchAction: 'none',
          WebkitTouchCallout: 'none',
          WebkitUserSelect: 'none',
          userSelect: 'none',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel ?? onPointerUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <defs>
          {/* Clip path para mantener la pelota dentro del campo visual */}
          <clipPath id="fieldClip">
            <rect x="0" y="0" width="600" height="900" />
          </clipPath>
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
          {/* Gradiente para brillo de la flecha */}
          <linearGradient id="arrowShine" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="white" stopOpacity="0.8" />
            <stop offset="40%" stopColor="white" stopOpacity="0.3" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </linearGradient>
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

        {/* Flecha de potencia apuntando hacia atrás (dirección opuesta al tiro) */}
        {aimLine && (() => {
          // Calcular dirección del tiro
          const dx = aimLine.to.x - aimLine.from.x;
          const dy = aimLine.to.y - aimLine.from.y;
          // Invertir el ángulo para que apunte hacia atrás
          const angle = Math.atan2(-dy, -dx);
          
          // Dimensiones fijas de la punta triangular
          const arrowHeadLength = 18; // Largo fijo de la punta
          const arrowHeadWidth = 14; // Ancho fijo de las alas
          const bodyThickness = 5; // Grosor fijo del cuerpo
          
          // Solo el cuerpo se extiende con la potencia
          const bodyLength = 10 + (shotPower * 50); // 10-60 px de largo del cuerpo
          
          // Posición inicial (base del cuerpo, cerca del chip)
          const startDistance = 38;
          const startX = aimLine.from.x + Math.cos(angle) * startDistance;
          const startY = aimLine.from.y + Math.sin(angle) * startDistance;
          
          // Puntos perpendiculares al ángulo
          const perpAngle = angle + Math.PI / 2;
          
          // Puntos de la base del cuerpo (inicio, cerca del chip)
          const baseLeftX = startX + Math.cos(perpAngle) * bodyThickness;
          const baseLeftY = startY + Math.sin(perpAngle) * bodyThickness;
          const baseRightX = startX - Math.cos(perpAngle) * bodyThickness;
          const baseRightY = startY - Math.sin(perpAngle) * bodyThickness;
          
          // Puntos donde termina el cuerpo y empieza la punta (se mueve con la potencia)
          const bodyEndX = startX + Math.cos(angle) * bodyLength;
          const bodyEndY = startY + Math.sin(angle) * bodyLength;
          const bodyEndLeftX = bodyEndX + Math.cos(perpAngle) * bodyThickness;
          const bodyEndLeftY = bodyEndY + Math.sin(perpAngle) * bodyThickness;
          const bodyEndRightX = bodyEndX - Math.cos(perpAngle) * bodyThickness;
          const bodyEndRightY = bodyEndY - Math.sin(perpAngle) * bodyThickness;
          
          // Puntos de las alas (donde se ensancha para la punta)
          const wingLeftX = bodyEndX + Math.cos(perpAngle) * arrowHeadWidth;
          const wingLeftY = bodyEndY + Math.sin(perpAngle) * arrowHeadWidth;
          const wingRightX = bodyEndX - Math.cos(perpAngle) * arrowHeadWidth;
          const wingRightY = bodyEndY - Math.sin(perpAngle) * arrowHeadWidth;
          
          // Punta de la flecha (siempre a distancia fija desde el fin del cuerpo)
          const tipX = bodyEndX + Math.cos(angle) * arrowHeadLength;
          const tipY = bodyEndY + Math.sin(angle) * arrowHeadLength;
          
          // Path: cuerpo rectangular + punta triangular
          const arrowPath = `
            M ${baseLeftX} ${baseLeftY}
            L ${bodyEndLeftX} ${bodyEndLeftY}
            L ${wingLeftX} ${wingLeftY}
            L ${tipX} ${tipY}
            L ${wingRightX} ${wingRightY}
            L ${bodyEndRightX} ${bodyEndRightY}
            L ${baseRightX} ${baseRightY}
            Z
          `;
          
          return (
            <>
              {/* Sombra de la flecha */}
              <path
                d={arrowPath}
                fill="rgba(0,0,0,0.5)"
                transform="translate(2, 2)"
              />
              {/* Flecha blanca principal */}
              <path
                d={arrowPath}
                fill="white"
                stroke="rgba(255,255,255,0.9)"
                strokeWidth="1.5"
                strokeLinejoin="round"
                opacity={0.9 + (shotPower * 0.1)}
              />
              {/* Brillo en el centro */}
              <path
                d={arrowPath}
                fill="url(#arrowShine)"
                opacity={0.6}
              />
            </>
          );
        })()}

        {/* Fichas */}
        {chips.map((chip) => {
          // Azul = mi ficha, Rojo = rival (ya transformado por PlayingScreen)
          const isMyChip = chip.fill === "#00a8ff";
          const chipColor = chip.fill || (isMyChip ? "var(--accent-blue, #00a8ff)" : "var(--accent-red, #ff4d5a)");
          const borderColor = isMyChip ? "#0066cc" : "#cc0022";
          // Glow solo si es mi turno y es mi ficha
          const isActive = isPlayerTurn && isMyChip;
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
                  stroke={chipColor}
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

        {/* Pelota - SVG nativo para iOS, Canvas 3D para otros navegadores */}
        <g clipPath="url(#fieldClip)">
          {isIOS ? (
            /* Pelota SVG nativa para iOS Safari - foreignObject tiene bugs */
            <g transform={`translate(${clampedBall.x}, ${clampedBall.y})`}>
              {/* Sombra */}
              <ellipse cx="2" cy="22" rx="14" ry="4" fill="rgba(0,0,0,0.3)" />
              {/* Pelota base con gradiente esférico */}
              <defs>
                <radialGradient id="ballGradient" cx="35%" cy="35%" r="60%">
                  <stop offset="0%" stopColor="#ffffff" />
                  <stop offset="50%" stopColor="#e8e8e8" />
                  <stop offset="100%" stopColor="#a0a0a0" />
                </radialGradient>
              </defs>
              <circle cx="0" cy="0" r="18" fill="url(#ballGradient)" stroke="rgba(0,0,0,0.15)" strokeWidth="1" />
              {/* Patrón de pentágonos simplificado */}
              <circle cx="0" cy="0" r="6" fill="#2a2a2a" />
              <circle cx="-10" cy="-8" r="4" fill="#2a2a2a" opacity="0.8" />
              <circle cx="10" cy="-8" r="4" fill="#2a2a2a" opacity="0.8" />
              <circle cx="-10" cy="8" r="4" fill="#2a2a2a" opacity="0.7" />
              <circle cx="10" cy="8" r="4" fill="#2a2a2a" opacity="0.7" />
              {/* Brillo */}
              <ellipse cx="-5" cy="-6" rx="4" ry="2" fill="rgba(255,255,255,0.7)" />
            </g>
          ) : (
            /* Canvas 3D para navegadores que soportan foreignObject */
            <foreignObject
              x={clampedBall.x - 20}
              y={clampedBall.y - 20}
              width="40"
              height="40"
              style={{ overflow: 'visible' }}
            >
              <SoccerBall3DCanvas 
                rotateX={ballRotation.rotateX} 
                rotateY={ballRotation.rotateY}
                size={40}
                lowPerf={lowPerf}
              />
            </foreignObject>
          )}
        </g>
      </svg>
      {children}
    </>
  );
}
