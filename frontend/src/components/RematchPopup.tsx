import { useEffect, useState } from "react";
import { socketService } from "../services/socketService";
import { useGameStore } from "../hooks/useGameStore";

interface RematchRequest {
  fromSide: "creator" | "challenger";
  fromAlias: string;
  matchId: string;
  expiresAt: number;
}

export function RematchPopup() {
  const [request, setRequest] = useState<RematchRequest | null>(null);
  const setView = useGameStore((s) => s.setView);
  const setCurrentMatchId = useGameStore((s) => s.setCurrentMatchId);
  const setMatchStatus = useGameStore((s) => s.setMatchStatus);
  const setPendingRematch = useGameStore((s) => s.setPendingRematch);
  const currentMatchId = useGameStore((s) => s.currentMatchId);
  const view = useGameStore((s) => s.view);
  
  useEffect(() => {
    // Escuchar solicitudes de revancha
    const handleRematchRequested = (data: { fromSide: "creator" | "challenger"; fromAlias: string; matchId: string }) => {
      // Solo mostrar popup si no estamos ya en la pantalla de juego mirando el modal de fin
      // o si la solicitud es de otro jugador (no nuestra propia solicitud)
      const playerSide = useGameStore.getState().playerSide;
      if (data.fromSide !== playerSide) {
        setRequest({
          ...data,
          expiresAt: Date.now() + 20000 // 20 segundos para responder
        });
        
        // También guardar en el store para persistencia
        setPendingRematch({
          matchId: data.matchId,
          fromSide: data.fromSide,
          rivalAlias: data.fromAlias,
          expiresAt: Date.now() + 20000
        });
      }
    };

    socketService.onRematchRequested(handleRematchRequested);

    return () => {
      socketService.offRematch();
    };
  }, [setPendingRematch]);

  // Timer para expirar la solicitud
  useEffect(() => {
    if (!request) return;

    const interval = setInterval(() => {
      if (Date.now() >= request.expiresAt) {
        setRequest(null);
        setPendingRematch(undefined);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [request, setPendingRematch]);

  const handleAccept = () => {
    if (!request) return;
    
    socketService.acceptRematch(request.matchId);
    setRequest(null);
    setPendingRematch(undefined);
    
    // Si no estamos en la pantalla de juego, ir a ella
    if (view !== "playing") {
      setCurrentMatchId(request.matchId);
      setMatchStatus("playing");
      setView("playing");
    }
  };

  const handleDecline = () => {
    if (!request) return;
    
    socketService.declineRematch(request.matchId);
    setRequest(null);
    setPendingRematch(undefined);
  };

  if (!request) return null;

  const remainingSeconds = Math.max(0, Math.ceil((request.expiresAt - Date.now()) / 1000));

  return (
    <div className="rematch-popup-overlay">
      <div className="rematch-popup">
        <div className="rematch-icon">🔄</div>
        <h3>¡Solicitud de Revancha!</h3>
        <p className="rematch-from">
          <span className="rival-name">{request.fromAlias}</span> quiere la revancha
        </p>
        <p className="rematch-timer">Expira en {remainingSeconds}s</p>
        <div className="rematch-buttons">
          <button className="rematch-btn accept" onClick={handleAccept}>
            ✓ Aceptar
          </button>
          <button className="rematch-btn decline" onClick={handleDecline}>
            ✕ Rechazar
          </button>
        </div>
      </div>

      <style>{`
        .rematch-popup-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          animation: fadeIn 0.3s ease-out;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .rematch-popup {
          background: linear-gradient(180deg, #1a2a1a 0%, #0a150a 100%);
          border: 2px solid #00ff6a;
          border-radius: 20px;
          padding: 24px 32px;
          text-align: center;
          min-width: 280px;
          box-shadow: 0 0 40px rgba(0, 255, 106, 0.3);
          animation: popIn 0.3s ease-out;
        }

        @keyframes popIn {
          from { 
            transform: scale(0.8);
            opacity: 0;
          }
          to { 
            transform: scale(1);
            opacity: 1;
          }
        }

        .rematch-icon {
          font-size: 48px;
          margin-bottom: 12px;
          animation: spin 2s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .rematch-popup h3 {
          color: #00ff6a;
          font-size: 22px;
          margin: 0 0 12px 0;
          text-shadow: 0 0 10px rgba(0, 255, 106, 0.5);
        }

        .rematch-from {
          color: #fff;
          font-size: 16px;
          margin: 0 0 8px 0;
        }

        .rival-name {
          color: #00a8ff;
          font-weight: bold;
        }

        .rematch-timer {
          color: #ffaa00;
          font-size: 14px;
          margin: 0 0 20px 0;
        }

        .rematch-buttons {
          display: flex;
          gap: 12px;
          justify-content: center;
        }

        .rematch-btn {
          padding: 12px 24px;
          border-radius: 12px;
          font-weight: bold;
          font-size: 15px;
          cursor: pointer;
          border: none;
          transition: all 0.2s;
        }

        .rematch-btn:active {
          transform: scale(0.95);
        }

        .rematch-btn.accept {
          background: linear-gradient(135deg, #00ff6a, #00cc55);
          color: #000;
        }

        .rematch-btn.accept:hover {
          box-shadow: 0 0 20px rgba(0, 255, 106, 0.5);
        }

        .rematch-btn.decline {
          background: #333;
          color: #ff4d5a;
          border: 1px solid #ff4d5a;
        }

        .rematch-btn.decline:hover {
          background: rgba(255, 77, 90, 0.2);
        }
      `}</style>
    </div>
  );
}
