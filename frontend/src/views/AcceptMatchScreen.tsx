import { useEffect, useState } from "react";
import { fetchOpenMatches, acceptMatch } from "../services/matchService";
import { socketService } from "../services/socketService";
import { useGameStore } from "../hooks/useGameStore";
import { MatchLobby } from "../types/game";

export function AcceptMatchScreen() {
  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState<MatchLobby[]>([]);
  const setView = useGameStore((state) => state.setView);
  const setCurrentMatchId = useGameStore((state) => state.setCurrentMatchId);
  const setMatchStatus = useGameStore((state) => state.setMatchStatus);
  const setPlayerSide = useGameStore((state) => state.setPlayerSide);
  const setMatchGoalTarget = useGameStore((state) => state.setMatchGoalTarget);

  useEffect(() => {
    // Carga inicial
    void (async () => {
      setLoading(true);
      const initial = await fetchOpenMatches();
      setMatches(initial);
      setLoading(false);
    })();

    // Suscribirse a actualizaciones en tiempo real
    socketService.connectLobbies();
    socketService.onLobbiesUpdate((lobbies) => {
      setMatches(lobbies);
    });
    socketService.onLobbyCreated((lobby) => {
      setMatches((prev) => {
        if (prev.some((m) => m.id === lobby.id)) return prev;
        return [...prev, lobby];
      });
    });

    return () => {
      socketService.offLobbies();
      socketService.disconnect();
    };
  }, []);

  const handleAccept = async (matchId: number) => {
    setLoading(true);
    const chosen = matches.find((item) => item.id === matchId);
    if (!chosen) return;
    try {
      await acceptMatch(matchId, chosen);
      setCurrentMatchId(String(matchId));
      setPlayerSide("challenger");
      setMatchGoalTarget(chosen.goals);
      setMatchStatus("playing");
      setView("playing");
    } catch (error) {
      console.error(error);
      alert("No pudimos unirnos. ¿La partida ya fue tomada?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lobbies-screen">
      <div className="lobbies-header">
        <button className="lobbies-back" onClick={() => setView("home")}>←</button>
        <span className="lobbies-title">Lobbies Disponibles</span>
        <span style={{ width: 32 }} />
      </div>

      <div className="lobbies-list">
        {loading && <p style={{ color: "var(--text-muted)", textAlign: "center" }}>Cargando...</p>}
        {!loading && matches.length === 0 && (
          <p style={{ color: "var(--text-muted)", textAlign: "center" }}>No hay partidas abiertas</p>
        )}
        {matches.map((m) => (
          <div key={m.id} className="lobby-card">
            <div className="lobby-info">
              <div className="lobby-header-row">
                <span className="lobby-badge">💰 Stake</span>
                <span className="lobby-badge">👥 2</span>
                <span className="lobby-badge">🏆 Mode</span>
              </div>
              <span className={`lobby-stake ${m.isFree ? "free" : ""}`}>
                {m.isFree ? "GRATIS" : `Stake: ${m.stakeAmount} MATIC`}
              </span>
              <span className="lobby-meta">Goles: {m.goals}</span>
            </div>
            <button className="lobby-join" onClick={() => handleAccept(m.id)}>
              UNIRSE
            </button>
          </div>
        ))}
      </div>

      <div className="lobbies-footer">
        <button className="lobbies-create-btn" onClick={() => setView("create")}>
          + CREAR PARTIDA
        </button>
      </div>
    </div>
  );
}
