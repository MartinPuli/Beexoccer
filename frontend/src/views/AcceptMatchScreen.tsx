import { useEffect, useState } from "react";
import { fetchOpenMatches, acceptMatch } from "../services/matchService";
import { socketService } from "../services/socketService";
import { useGameStore } from "../hooks/useGameStore";
import { MatchLobby } from "../types/game";
import { walletService } from "../services/walletService";
import { toast } from "../components/Toast";

export function AcceptMatchScreen() {
  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState<MatchLobby[]>([]);
  const setView = useGameStore((state) => state.setView);
  const setCurrentMatchId = useGameStore((state) => state.setCurrentMatchId);
  const setMatchStatus = useGameStore((state) => state.setMatchStatus);
  const setPlayerSide = useGameStore((state) => state.setPlayerSide);
  const setMatchGoalTarget = useGameStore((state) => state.setMatchGoalTarget);
  const setMatchMode = useGameStore((state) => state.setMatchMode);
  const setMatchDurationMs = useGameStore((state) => state.setMatchDurationMs);
  const setWaitingMatch = useGameStore((state) => state.setWaitingMatch);

  // Obtener dirección del usuario actual
  const userAddress = walletService.getAddress()?.toLowerCase() ?? "";

  useEffect(() => {
    // Carga inicial desde blockchain (fuente de verdad)
    void (async () => {
      setLoading(true);
      try {
        const initial = await fetchOpenMatches();
        console.log(`[AcceptMatchScreen] Carga inicial blockchain: ${initial.length} matches`, initial);
        setMatches(initial);
        if (initial.length > 0) {
          toast.info("Lobby actualizado", `${initial.length} partida(s) disponible(s)`);
        }
      } catch {
        toast.error("Error cargando partidas", "No se pudo conectar al contrato");
      }
      setLoading(false);
    })();

    // Suscribirse a actualizaciones en tiempo real del servidor de sockets
    // NOTA: El socket solo sirve para notificaciones en tiempo real, 
    // pero el blockchain es la fuente de verdad
    socketService.connectLobbies();
    
    // Ignoramos lobbiesUpdate del servidor - puede tener datos desactualizados
    // Solo usamos el socket para notificaciones de nuevos lobbies
    socketService.onLobbiesUpdate((lobbies) => {
      console.log(`[AcceptMatchScreen] lobbiesUpdate recibido (ignorado): ${lobbies.length} lobbies`);
      // NO actualizamos el estado con esto - podría tener datos viejos
    });
    
    socketService.onLobbyCreated((lobby) => {
      console.log(`[AcceptMatchScreen] lobbyCreated recibido:`, lobby);
      setMatches((prev) => {
        if (prev.some((m) => m.id === lobby.id)) return prev;
        return [...prev, lobby];
      });
      toast.info("Nueva partida", `Match #${lobby.id} disponible`);
    });
    
    // Escuchar cuando alguien se une a una partida para quitarla de la lista
    socketService.onLobbyJoined((data) => {
      console.log(`[AcceptMatchScreen] lobbyJoined recibido:`, data);
      setMatches((prev) => prev.filter((m) => m.id !== Number(data.matchId)));
    });
    
    // Escuchar cuando alguien cancela una partida para quitarla de la lista
    socketService.onLobbyCancelled((matchId) => {
      console.log(`[AcceptMatchScreen] lobbyCancelled recibido: matchId=${matchId}`);
      setMatches((prev) => prev.filter((m) => m.id !== Number(matchId)));
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
    if (!chosen) {
      setLoading(false);
      toast.error("Error", "No se encontró la partida seleccionada");
      return;
    }
    try {
      await acceptMatch(matchId, chosen);
      toast.success("¡Unido a la partida!", "Preparando el campo...");
      setCurrentMatchId(String(matchId));
      setPlayerSide("challenger");
      setMatchGoalTarget(chosen.goals);
      if (chosen.mode) setMatchMode(chosen.mode);
      if (chosen.durationMs) setMatchDurationMs(chosen.durationMs);
      setMatchStatus("playing");
      setView("playing");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[AcceptMatchScreen] Error al unirse a match ${matchId}:`, errorMessage);
      
      if (errorMessage.includes("insufficient funds") || errorMessage.includes("Internal JSON-RPC")) {
        toast.error(
          "Sin fondos para gas",
          "Necesitas POL para unirte",
          {
            label: "Obtener POL gratis",
            onClick: () => window.open("https://faucet.polygon.technology/", "_blank")
          }
        );
      } else if (errorMessage.includes("user rejected") || errorMessage.includes("cancelada por el usuario")) {
        toast.warning("Cancelado", "Rechazaste la transacción");
      } else {
        // Mostrar el mensaje de error real en lugar de un mensaje genérico
        toast.error("No pudimos unirnos", errorMessage);
      }
      
      // Recargar la lista desde blockchain para asegurar datos frescos
      try {
        const fresh = await fetchOpenMatches();
        setMatches(fresh);
      } catch {
        // Ignorar error de recarga
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoToWaiting = (match: MatchLobby) => {
    setWaitingMatch({
      matchId: match.id,
      goals: match.goals,
      mode: match.mode,
      durationMs: match.durationMs,
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
                    {m.isFree ? "GRATIS" : `${m.stakeAmount || "0"} POL`}
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
                    <span className="lobby-badge">{m.isFree ? "🆓 Gratis" : "💰 Apuesta"}</span>
                    <span className="lobby-badge">🏆 {m.goals} goles</span>
                  </div>
                  <span className={`lobby-stake ${m.isFree ? "free" : ""}`}>
                    {m.isFree ? "GRATIS" : `${m.stakeAmount || "0"} POL`}
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
