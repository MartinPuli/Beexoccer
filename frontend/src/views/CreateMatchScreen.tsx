import { ChangeEvent, FormEvent, useState, useEffect } from "react";
import { createMatch } from "../services/matchService";
import { useGameStore } from "../hooks/useGameStore";
import { GoalTarget, MatchMode, TIMED_MATCH_DURATION_MS } from "../types/game";
import { walletService, TokenInfo } from "../services/walletService";
import { toast } from "../components/Toast";

export function CreateMatchScreen() {
  const [goals, setGoals] = useState<GoalTarget>(3);
  const [matchMode, setMatchMode] = useState<MatchMode>("goals");
  const [isBet, setIsBet] = useState(false);
  const [stakeAmount, setStakeAmount] = useState("10");
  const [selectedToken, setSelectedToken] = useState("POL");
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const setView = useGameStore((state) => state.setView);
  const setWaitingMatch = useGameStore((state) => state.setWaitingMatch);
  const userAddress = useGameStore((state) => state.userAddress);

  // Cargar tokens disponibles
  useEffect(() => {
    const loadTokens = async () => {
      try {
        await walletService.init();
        const tokenList = walletService.getTokens();
        if (tokenList.length === 0) {
          await walletService.fetchTokenBalances();
          setTokens(walletService.getTokens());
        } else {
          setTokens(tokenList);
        }
      } catch {
        setTokens([
          { symbol: "POL", name: "Polygon", address: "native", decimals: 18, type: "native", balance: "0" }
        ]);
      }
    };
    loadTokens();
  }, []);

  const currentToken = tokens.find(t => t.symbol === selectedToken);
  const currentBalance = currentToken?.balance || "0";

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      let tokenAddress = "0x0000000000000000000000000000000000000000";
      let amount = "0";
      
      if (isBet) {
        const token = tokens.find(t => t.symbol === selectedToken);
        tokenAddress = token?.type === "native" || token?.address === "native"
          ? "0x0000000000000000000000000000000000000000"
          : token?.address || "0x0000000000000000000000000000000000000000";
        amount = stakeAmount;
      }
      
      const result = await createMatch({
        goals,
        mode: matchMode,
        durationMs: matchMode === "time" ? TIMED_MATCH_DURATION_MS : undefined,
        isFree: !isBet,
        stakeAmount: amount,
        stakeToken: tokenAddress
      });
      
      toast.success("¡Partida creada!", `Match #${result.matchId} esperando rival`);
      
      setWaitingMatch({
        matchId: result.matchId,
        goals,
        mode: matchMode,
        durationMs: matchMode === "time" ? TIMED_MATCH_DURATION_MS : undefined,
        isFree: !isBet,
        stakeAmount: isBet ? stakeAmount : "0",
        creatorAddress: userAddress
      });
      setView("waiting");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (errorMessage.includes("insufficient funds")) {
        toast.error(
          "Sin fondos para gas",
          "Necesitas más POL para pagar la transacción",
          {
            label: "Obtener POL gratis",
            onClick: () => window.open("https://faucet.polygon.technology/", "_blank")
          }
        );
      } else if (errorMessage.includes("user rejected") || errorMessage.includes("ACTION_REJECTED")) {
        toast.warning("Transacción cancelada", "Rechazaste la transacción en tu wallet");
      } else {
        toast.error("Error al crear partida", errorMessage.slice(0, 100));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="create-screen">
      <div className="create-header">
        <button className="create-back" onClick={() => setView("accept")}>←</button>
        <span className="create-title">Crear Partida</span>
        <span style={{ width: 32 }} />
      </div>

      <form className="create-body" onSubmit={handleSubmit}>
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

        {/* Selector de token y cantidad */}
        {isBet && (
          <div className="create-section">
            <span className="create-label">Apuesta</span>
            
            {/* Input de cantidad */}
            <input
              type="number"
              className="stake-input full-width"
              value={stakeAmount}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setStakeAmount(e.target.value)}
              placeholder="Cantidad"
              min="0"
              step="0.1"
            />
            
            {/* Selector de token */}
            <div className="token-selector-row">
              {tokens.map(token => (
                <button
                  key={token.symbol}
                  type="button"
                  className={`token-btn ${selectedToken === token.symbol ? "active" : ""}`}
                  onClick={() => setSelectedToken(token.symbol)}
                >
                  <span className="token-icon">{token.icon}</span>
                  <span className="token-name">{token.symbol}</span>
                </button>
              ))}
            </div>
            
            <div className="stake-balance">
              Balance: {currentBalance} {selectedToken}
            </div>
          </div>
        )}
      </form>

      <div className="create-footer">
        <button
          type="submit"
          className="create-submit"
          disabled={loading}
          onClick={handleSubmit}
        >
          {loading ? "Enviando..." : "Enviar a blockchain"}
        </button>
      </div>
    </div>
  );
}
