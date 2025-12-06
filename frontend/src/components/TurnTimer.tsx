import { useEffect, useRef, useState } from "react";

interface TurnTimerProps {
  expiresAt: number;
  durationMs?: number;
  onTimeout: () => void;
}

/**
 * Visual countdown + auto timeout callback whenever a player fails to take action.
 */
export function TurnTimer({ expiresAt, durationMs = 15_000, onTimeout }: Readonly<TurnTimerProps>) {
  const [remaining, setRemaining] = useState(() => Math.max(0, expiresAt - Date.now()));
  const firedRef = useRef(false);

  useEffect(() => {
    firedRef.current = false;
    let animationFrameRef = 0;
    const tick = () => {
      const nextValue = Math.max(0, expiresAt - Date.now());
      setRemaining(nextValue);
      if (nextValue <= 0 && !firedRef.current) {
        firedRef.current = true;
        onTimeout();
      } else if (nextValue > 0) {
        animationFrameRef = requestAnimationFrame(tick);
      }
    };

    animationFrameRef = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrameRef);
  }, [expiresAt, onTimeout]);

  const safeDuration = durationMs <= 0 ? 1 : durationMs;
  const percent = Math.min(100, Math.max(0, (remaining / safeDuration) * 100));

  return (
    <div className="turn-timer" aria-label="Temporizador de turno">
      <span>Tiempo</span>
      <div className="turn-timer-track">
        <div className="turn-timer-progress" style={{ width: `${percent}%` }} />
      </div>
      <span>{(remaining / 1000).toFixed(1)}s</span>
    </div>
  );
}
