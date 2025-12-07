import { useEffect, useState } from "react";
import { fetchOpenMatches, acceptMatch } from "../services/matchService";
import { socketService } from "../services/socketService";
import { useGameStore } from "../hooks/useGameStore";
import { MatchLobby } from "../types/game";
import { xoConnectService } from "../services/xoConnectService";
import { toast } from "../components/Toast";

export function AcceptMatchScreen() {
  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState<MatchLobby[]>([]);
  const setView = useGameStore((state) => state.setView);
  const setCurrentMatchId = useGameStore((state) => state.setCurrentMatchId);
  const setMatchStatus = useGameStore((state) => state.setMatchStatus);
  const setPlayerSide = useGameStore((state) => state.setPlayerSide);
  const setMatchGoalTarget = useGameStore((state) => state.setMatchGoalTarget);
  const setWaitingMatch = useGameStore((state) => state.setWaitingMatch);

  // Obtener dirección del usuario actual
  const userAddress = xoConnectService.getAddress()?.toLowerCase() ?? "";

  useEffect(() => {
    // Carga inicial
    void (async () => {
      setLoading(true);
      try {
        const initial = await fetchOpenMatches();
        setMatches(initial);
        if (initial.length > 0) {
          toast.info("Lobby actualizado", `${initial.length} partida(s) disponible(s)`);
        }
      } catch (error) {
        console.error(error);
        toast.error("Error cargando partidas", "No se pudo conectar al contrato");
      }
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
      toast.info("Nueva partida", `Match #${lobby.id} disponible`);
    });

    return () => {
      socketService.offLobbies();
      socketService.disconnect();
    };
  }, []);

  // Filtrar partidas: separar las mías de las de otros
  const myMatches = matches.filter(
    (m) => m.creator.toLowerCase() === userAddress
  );
  const otherMatches = matches.filter(
    (m) => m.creator.toLowerCase() !== userAddress
  );

  const handleAccept = async (matchId: number) => {
    setLoading(true);
    const chosen = matches.find((item) => item.id === matchId);
    if (!chosen) return;
    try {
      await acceptMatch(matchId, chosen);
      toast.success("¡Unido a la partida!", "Preparando el campo...");
      setCurrentMatchId(String(matchId));
      setPlayerSide("challenger");
      setMatchGoalTarget(chosen.goals);
      setMatchStatus("playing");
      setView("playing");
    } catch (error) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (errorMessage.includes("insufficient funds") || errorMessage.includes("Internal JSON-RPC")) {
        toast.error(
          "Sin fondos para gas",
          "Necesitas POL para unirte",
          {
            label: "Obtener POL gratis",
            onClick: () => window.open("https://faucet.polygon.technology/", "_blank")
          }
        );
      } else if (errorMessage.includes("user rejected")) {
        toast.warning("Cancelado", "Rechazaste la transacción");
      } else {
        toast.error("No pudimos unirnos", "La partida ya fue tomada o cancelada");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const refreshed = await fetchOpenMatches();
      setMatches(refreshed);
      toast.success("Actualizado", `${refreshed.length} partida(s) encontrada(s)`);
    } catch (error) {
      toast.error("Error", "No se pudo actualizar el lobby");
    }
    setLoading(false);
  };

  const handleGoToWaiting = (match: MatchLobby) => {
    setWaitingMatch({
      matchId: match.id,
      goals: match.goals,
      isFree: match.isFree,
      stakeAmount: match.stakeAmount,
      creatorAddress: match.creator // El creador es el dueño de esta partida
    });
    setView("waiting");
  };

  return (
    <div className="lobbies-screen">
      <div className="lobbies-header">
        <button className="lobbies-back" onClick={() => setView("home")}>←</button>
        <span className="lobbies-title">Lobbies</span>
        <button className="lobbies-refresh" onClick={handleRefresh} disabled={loading}>
          🔄
        </button>
      </div>

      <div className="lobbies-list">
        {loading && <p style={{ color: "var(--text-muted)", textAlign: "center" }}>Cargando...</p>}
        
        {/* Mis partidas esperando rival */}
        {myMatches.length > 0 && (
          <>
            <div className="lobbies-section-title">🎮 Mis Partidas</div>
            {myMatches.map((m) => (
              <div key={m.id} className="lobby-card my-match">
                <div className="lobby-info">
                  <div className="lobby-header-row">
                    <span className="lobby-badge own">⏳ Esperando</span>
                  </div>
                  <span className={`lobby-stake ${m.isFree ? "free" : ""}`}>
                    {m.isFree ? "GRATIS" : `Stake: ${m.stakeAmount} MATIC`}
                  </span>
                  <span className="lobby-meta">Goles: {m.goals}</span>
                </div>
                <button className="lobby-join waiting" onClick={() => handleGoToWaiting(m)}>
                  VER
                </button>
              </div>
            ))}
          </>
        )}

        {/* Partidas de otros jugadores */}
        {otherMatches.length > 0 && (
          <>
            <div className="lobbies-section-title">🌐 Partidas Disponibles</div>
            {otherMatches.map((m) => (
              <div key={m.id} className="lobby-card">
                <div className="lobby-info">
                  <div className="lobby-header-row">
                    <span className="lobby-badge">💰 Stake</span>
                    <span className="lobby-badge">🏆 {m.goals} goles</span>
                  </div>
                  <span className={`lobby-stake ${m.isFree ? "free" : ""}`}>
                    {m.isFree ? "GRATIS" : `Stake: ${m.stakeAmount} MATIC`}
                  </span>
                  <span className="lobby-creator">
                    {m.creator.slice(0, 6)}...{m.creator.slice(-4)}
                  </span>
                </div>
                <button className="lobby-join" onClick={() => handleAccept(m.id)}>
                  UNIRSE
                </button>
              </div>
            ))}
          </>
        )}

        {!loading && matches.length === 0 && (
          <p style={{ color: "var(--text-muted)", textAlign: "center", padding: "40px 20px" }}>
            No hay partidas abiertas.<br/>¡Crea una nueva!
          </p>
        )}
      </div>

      <div className="lobbies-footer">
        <button className="lobbies-create-btn" onClick={() => setView("create")}>
          + CREAR PARTIDA
        </button>
      </div>
    </div>
  );
}
