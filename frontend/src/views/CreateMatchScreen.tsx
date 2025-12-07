import { ChangeEvent, FormEvent, useState, useEffect } from "react";
import { createMatch } from "../services/matchService";
import { useGameStore } from "../hooks/useGameStore";
import { GoalTarget } from "../types/game";
import { xoConnectService, TokenInfo } from "../services/xoConnectService";

export function CreateMatchScreen() {
  const [goals, setGoals] = useState<GoalTarget>(3);
  const [isBet, setIsBet] = useState(false);
  const [stakeAmount, setStakeAmount] = useState("10");
  const [selectedToken, setSelectedToken] = useState("MATIC");
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const setView = useGameStore((state) => state.setView);

  // Cargar tokens disponibles
  useEffect(() => {
    const loadTokens = async () => {
      await xoConnectService.fetchTokenBalances();
      setTokens(xoConnectService.getTokens());
    };
    loadTokens();
  }, []);

  const currentToken = tokens.find(t => t.symbol === selectedToken);
  const currentBalance = currentToken?.balance || "0";

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      const token = tokens.find(t => t.symbol === selectedToken);
      await createMatch({
        goals,
        isFree: !isBet,
        stakeAmount: isBet ? stakeAmount : "0",
        stakeToken: token?.address || "0x0000000000000000000000000000000000000000"
      });
      alert("Partida creada. Esperando rival...");
      setView("accept");
    } catch (error) {
      console.error(error);
      alert("Error al crear partida");
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
        {/* Meta de goles */}
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
            <div className="stake-row">
              <input
                type="number"
                className="stake-input"
                value={stakeAmount}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setStakeAmount(e.target.value)}
                placeholder="10"
                min="0"
                step="0.1"
              />
              <div className="token-selector">
                <select 
                  className="token-select"
                  value={selectedToken}
                  onChange={(e) => setSelectedToken(e.target.value)}
                >
                  {tokens.map(token => (
                    <option key={token.symbol} value={token.symbol}>
                      {token.icon} {token.symbol}
                    </option>
                  ))}
                </select>
              </div>
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
