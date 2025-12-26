import { useEffect, useState, useRef } from "react";
import { useGameStore } from "../hooks/useGameStore";
import { cancelMatch, checkMatchStatus } from "../services/matchService";
import { toast } from "../components/Toast";
import { ConfirmModal } from "../components/ConfirmModal";
import ballImg from "../assets/ball.png";

export function WaitingScreen() {
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [dots, setDots] = useState("");
  const waitingMatch = useGameStore((state) => state.waitingMatch);
  const setView = useGameStore((state) => state.setView);
  const setWaitingMatch = useGameStore((state) => state.setWaitingMatch);
  const setActiveMatch = useGameStore((state) => state.setActiveMatch);
  const setCurrentMatchId = useGameStore((state) => state.setCurrentMatchId);
  const setPlayerSide = useGameStore((state) => state.setPlayerSide);
  const setMatchGoalTarget = useGameStore((state) => state.setMatchGoalTarget);
  const setMatchStatus = useGameStore((state) => state.setMatchStatus);
  const userAddress = useGameStore((state) => state.userAddress);
  
  const pollingRef = useRef<number | null>(null);
  const foundChallengerRef = useRef(false); // Evitar notificaciones dobles

  // Animación de puntos
  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "" : prev + "."));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Polling para detectar cuando alguien se une
  useEffect(() => {
    if (!waitingMatch) return;
    
    // Reset flag cuando cambia la partida
    foundChallengerRef.current = false;

    const checkForChallenger = async () => {
      // Si ya encontramos challenger, no seguir chequeando
      if (foundChallengerRef.current) return;
      
      try {
        const status = await checkMatchStatus(waitingMatch.matchId);
        if (status.hasChallenger && !foundChallengerRef.current) {
          // Marcar como encontrado para evitar dobles
          foundChallengerRef.current = true;
          
          // Limpiar polling inmediatamente
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
          
          // ¡Alguien se unió! Ir a jugar
          toast.success("¡Rival encontrado!", "Preparando el campo de juego...");
          
          // Guardar partida activa para persistencia
          setActiveMatch({
            matchId: String(waitingMatch.matchId),
            playerSide: "creator",
            goalTarget: waitingMatch.goals,
            mode: waitingMatch.mode,
            durationMs: waitingMatch.durationMs,
            userAddress
          });
          
          setCurrentMatchId(String(waitingMatch.matchId));
          setPlayerSide("creator");
          setMatchGoalTarget(waitingMatch.goals);
          setMatchStatus("playing");
          setWaitingMatch(undefined);
          setView("playing");
        }
      } catch {
        // Error silenciado en producción
      }
    };

    // Chequear inmediatamente y luego cada 3 segundos
    checkForChallenger();
    pollingRef.current = window.setInterval(checkForChallenger, 3000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [waitingMatch, setCurrentMatchId, setPlayerSide, setMatchGoalTarget, setMatchStatus, setWaitingMatch, setView, setActiveMatch]);

  const handleBackClick = () => {
    setShowCancelModal(true);
  };

  const handleConfirmCancel = async () => {
    if (!waitingMatch) return;
    
    // Validar matchId antes de intentar cancelar
    if (!waitingMatch.matchId || waitingMatch.matchId <= 0) {
      toast.error("Error", "ID de partida inválido. Vuelve al lobby.");
      setWaitingMatch(undefined);
      setView("accept");
      return;
    }
    
    setCancelling(true);
    try {
      await cancelMatch(waitingMatch.matchId);
      toast.info("Partida cancelada", "Volviendo al lobby");
      setWaitingMatch(undefined);
      setView("accept");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Mensajes específicos según el error
      if (errorMessage.includes("creador")) {
        toast.error("No autorizado", errorMessage);
      } else if (errorMessage.includes("abierta")) {
        toast.error("Partida cerrada", errorMessage);
        setWaitingMatch(undefined);
        setView("accept");
      } else if (errorMessage.includes("rival")) {
        toast.warning("¡Ya tienes rival!", "La partida comenzará pronto");
      } else if (errorMessage.includes("inválido")) {
        toast.error("Error", errorMessage);
        setWaitingMatch(undefined);
        setView("accept");
      } else if (errorMessage.includes("insufficient funds") || errorMessage.includes("Fondos insuficientes")) {
        toast.error("Sin fondos", "Necesitas POL para cancelar");
      } else if (errorMessage.includes("user rejected") || errorMessage.includes("cancelada por el usuario")) {
        toast.warning("Cancelación rechazada", "Sigues esperando rival");
      } else if (errorMessage.includes("MetaMask") || errorMessage.includes("-32603")) {
        toast.error("Error de MetaMask", errorMessage);
      } else {
        toast.error("Error", errorMessage || "No se pudo cancelar la partida");
      }
    } finally {
      setCancelling(false);
      setShowCancelModal(false);
    }
  };

  const handleDismissModal = () => {
    setShowCancelModal(false);
  };

  if (!waitingMatch) {
    return null;
  }

  return (
    <div className="waiting-screen">
      <div className="waiting-header">
        <button className="waiting-back" onClick={handleBackClick}>←</button>
        <span className="waiting-title">Esperando Rival</span>
        <span style={{ width: 32 }} />
      </div>

      <div className="waiting-content">
        {/* Animación de pelota */}
        <div className="waiting-ball-container">
          <img src={ballImg} alt="Ball" className="waiting-ball" />
        </div>

        <h2 className="waiting-message">Buscando oponente{dots}</h2>
        
        <div className="waiting-match-info">
          <div className="waiting-info-row">
            <span className="waiting-info-label">Meta de goles:</span>
            <span className="waiting-info-value">{waitingMatch.goals}</span>
          </div>
          <div className="waiting-info-row">
            <span className="waiting-info-label">Modo:</span>
            <span className="waiting-info-value">{waitingMatch.isFree ? "Gratis" : "Apuesta"}</span>
          </div>
          {!waitingMatch.isFree && (
            <div className="waiting-info-row">
              <span className="waiting-info-label">Apuesta:</span>
              <span className="waiting-info-value">{waitingMatch.stakeAmount} POL</span>
            </div>
          )}
        </div>

        <p className="waiting-tip">
          💡 Tu partida está visible en el lobby. Cuando alguien se una, comenzará el partido automáticamente.
        </p>
      </div>

      {/* Modal de confirmación */}
      <ConfirmModal
        isOpen={showCancelModal}
        title="¿Cancelar partida?"
        message={
          waitingMatch.isFree
            ? "Se cancelará tu partida y volverás al lobby."
            : `Se cancelará tu partida y se te devolverán ${waitingMatch.stakeAmount} POL.`
        }
        confirmLabel="Cancelar partida"
        cancelLabel="Seguir esperando"
        variant="danger"
        icon="🚫"
        onConfirm={handleConfirmCancel}
        onCancel={handleDismissModal}
        loading={cancelling}
      />
    </div>
  );
}
