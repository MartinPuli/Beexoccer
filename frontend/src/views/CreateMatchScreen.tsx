import { ChangeEvent, FormEvent, useState } from "react";
import { createMatch } from "../services/matchService";
import { useGameStore } from "../hooks/useGameStore";
import { GoalTarget, MatchMode, TIMED_MATCH_DURATION_MS } from "../types/game";
import { toast } from "../components/Toast";
import { BeexoccerPayButtonCustom } from "../components/BeexoccerPayButton";
import { env } from "../config/env";

// Stake amounts in USDC
const STAKE_OPTIONS = ["1", "5", "10", "25", "50"];

export function CreateMatchScreen() {
  const [goals, setGoals] = useState<GoalTarget>(3);
  const [matchMode, setMatchMode] = useState<MatchMode>("goals");
  const [isBet, setIsBet] = useState(false);
  const [stakeAmount, setStakeAmount] = useState("5");
  const [loading, setLoading] = useState(false);
  const [paymentPending, setPaymentPending] = useState(false);
  const setView = useGameStore((state) => state.setView);
  const setWaitingMatch = useGameStore((state) => state.setWaitingMatch);
  const userAddress = useGameStore((state) => state.userAddress);

  // Handler para crear partida GRATIS (sin Daimo Pay)
  const handleCreateFreeMatch = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      const result = await createMatch({
        goals,
        mode: matchMode,
        durationMs: matchMode === "time" ? TIMED_MATCH_DURATION_MS : undefined,
        isFree: true,
        stakeAmount: "0",
        stakeToken: "0x0000000000000000000000000000000000000000"
      });
      
      toast.success("¡Partida creada!", `Match #${result.matchId} esperando rival`);
      
      setWaitingMatch({
        matchId: result.matchId,
        goals,
        mode: matchMode,
        durationMs: matchMode === "time" ? TIMED_MATCH_DURATION_MS : undefined,
        isFree: true,
        stakeAmount: "0",
        creatorAddress: userAddress
      });
      setView("waiting");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast.error("Error al crear partida", errorMessage.slice(0, 100));
    } finally {
      setLoading(false);
    }
  };

  // Handlers para Daimo Pay (partidas con apuesta)
  const handlePaymentStarted = () => {
    setPaymentPending(true);
    toast.info("Procesando pago...", "Completa el pago para crear la partida");
  };

  const handlePaymentCompleted = async (event: unknown) => {
    setPaymentPending(false);
    console.log("Payment completed:", event);
    
    try {
      // Crear la partida después de que el pago fue exitoso
      const result = await createMatch({
        goals,
        mode: matchMode,
        durationMs: matchMode === "time" ? TIMED_MATCH_DURATION_MS : undefined,
        isFree: false,
        stakeAmount: stakeAmount,
        stakeToken: "USDC" // Daimo Pay siempre paga en USDC
      });
      
      toast.success("¡Pago completado!", `Match #${result.matchId} creado con ${stakeAmount} USDC`);
      
      setWaitingMatch({
        matchId: result.matchId,
        goals,
        mode: matchMode,
        durationMs: matchMode === "time" ? TIMED_MATCH_DURATION_MS : undefined,
        isFree: false,
        stakeAmount: stakeAmount,
        creatorAddress: userAddress
      });
      setView("waiting");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast.error("Error al crear partida", errorMessage.slice(0, 100));
    }
  };

  const handlePaymentBounced = () => {
    setPaymentPending(false);
    toast.error("Pago fallido", "El pago fue rechazado o cancelado");
  };

  return (
    <div className="create-screen">
      <div className="create-header">
        <button className="create-back" onClick={() => setView("accept")}>←</button>
        <span className="create-title">Crear Partida</span>
        <span style={{ width: 32 }} />
      </div>

      <form className="create-body" onSubmit={handleCreateFreeMatch}>
        {/* Modo de juego */}
        <div className="create-section">
          <span className="create-label">Tipo de partido</span>
          <div className="goals-row">
            <button
              type="button"
              className={`goal-btn ${matchMode === "goals" ? "active" : ""}`}
              onClick={() => setMatchMode("goals")}
            >
              Por goles
            </button>
            <button
              type="button"
              className={`goal-btn ${matchMode === "time" ? "active" : ""}`}
              onClick={() => setMatchMode("time")}
            >
              Por tiempo (3:00)
            </button>
          </div>
        </div>

        {/* Meta de goles */}
        {matchMode === "goals" && (
          <div className="create-section">
            <span className="create-label">Meta de goles</span>
            <div className="goals-row">
              {([2, 3, 5] as GoalTarget[]).map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`goal-btn ${goals === n ? "active" : ""}`}
                  onClick={() => setGoals(n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Toggle Gratis/Apostar */}
        <div className="create-section">
          <span className="create-label">Modo</span>
          <div className="mode-toggle">
            <span className={`mode-label ${!isBet ? "active" : ""}`}>GRATIS</span>
            <div
              className={`toggle-track ${isBet ? "on" : ""}`}
              onClick={() => setIsBet(!isBet)}
            >
              <div className="toggle-thumb" />
            </div>
            <span className={`mode-label ${isBet ? "active" : ""}`}>APOSTAR</span>
          </div>
        </div>

        {/* Selector de cantidad USDC con Daimo Pay */}
        {isBet && (
          <div className="create-section">
            <span className="create-label">Apuesta (USDC)</span>
            
            {/* Botones de cantidad predefinida */}
            <div className="goals-row" style={{ flexWrap: "wrap", gap: 8 }}>
              {STAKE_OPTIONS.map(amount => (
                <button
                  key={amount}
                  type="button"
                  className={`goal-btn ${stakeAmount === amount ? "active" : ""}`}
                  onClick={() => setStakeAmount(amount)}
                  style={{ minWidth: 60 }}
                >
                  ${amount}
                </button>
              ))}
            </div>
            
            {/* Input personalizado */}
            <div style={{ marginTop: 12 }}>
              <input
                type="number"
                className="stake-input full-width"
                value={stakeAmount}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setStakeAmount(e.target.value)}
                placeholder="Cantidad personalizada"
                min="1"
                step="1"
              />
            </div>
            
            <div className="stake-balance" style={{ marginTop: 8, textAlign: "center", color: "#888" }}>
              💳 Paga desde cualquier wallet o exchange con Daimo Pay
            </div>
          </div>
        )}
      </form>

      <div className="create-footer">
        {/* Partida gratis: botón normal */}
        {!isBet && (
          <button
            type="submit"
            className="create-submit"
            disabled={loading}
            onClick={handleCreateFreeMatch}
          >
            {loading ? "Creando..." : "Crear partida gratis"}
          </button>
        )}

        {/* Partida con apuesta: Daimo Pay button */}
        {isBet && (
          <BeexoccerPayButtonCustom
            amount={stakeAmount}
            toAddress={env.matchManagerAddress as `0x${string}`}
            intent="Apostar"
            onPaymentStarted={handlePaymentStarted}
            onPaymentCompleted={handlePaymentCompleted}
            onPaymentBounced={handlePaymentBounced}
            metadata={{ 
              matchGoals: String(goals),
              matchMode: matchMode,
              creator: userAddress 
            }}
          >
            {paymentPending ? "Procesando..." : `💰 Apostar ${stakeAmount} USDC`}
          </BeexoccerPayButtonCustom>
        )}
      </div>
    </div>
  );
}
