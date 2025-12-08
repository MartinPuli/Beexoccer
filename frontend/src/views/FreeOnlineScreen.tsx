import { useEffect, useState, useCallback } from "react";
import { socketService } from "../services/socketService";
import { useGameStore } from "../hooks/useGameStore";
import { GoalTarget } from "../types/game";
import { toast } from "../components/Toast";

interface FreeLobby {
  id: string;
  creator: string;
  creatorAlias: string;
  goals: GoalTarget;
  createdAt: number;
}

/**
 * FreeOnlineScreen - Lobby para partidas online gratuitas sin blockchain
 * - Crea y une partidas solo mediante sockets
 * - Sin transacciones ni wallet requerida (aunque usa el alias)
 */
export function FreeOnlineScreen() {
  const [lobbies, setLobbies] = useState<FreeLobby[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [goals, setGoals] = useState<GoalTarget>(3);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [myLobbyId, setMyLobbyId] = useState<string | null>(null);

  const setView = useGameStore((state) => state.setView);
  const setCurrentMatchId = useGameStore((state) => state.setCurrentMatchId);
  const setPlayerSide = useGameStore((state) => state.setPlayerSide);
  const setMatchGoalTarget = useGameStore((state) => state.setMatchGoalTarget);
  const setMatchStatus = useGameStore((state) => state.setMatchStatus);
  const alias = useGameStore((state) => state.alias);
  const userAddress = useGameStore((state) => state.userAddress);

  // ID único para este usuario (usar address si existe, sino generar uno temporal)
  const odUserId = userAddress || `guest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Conectar al servidor de lobbies gratuitos
  useEffect(() => {
    setLoading(true);
    
    // Conectar al sistema de lobbies gratuitos
    socketService.connectFreeLobbies();
    
    // Escuchar actualizaciones de lobbies
    socketService.onFreeLobbiesUpdate((updatedLobbies: FreeLobby[]) => {
      setLobbies(updatedLobbies);
      setLoading(false);
    });

    // Escuchar cuando alguien se une a mi partida
    socketService.onFreeMatchReady((data: { matchId: string; rivalAlias: string }) => {
      toast.success("¡Rival encontrado!", `${data.rivalAlias} se unió`);
      setCurrentMatchId(data.matchId);
      setPlayerSide("creator");
      setMatchStatus("playing");
      setView("playing");
    });

    // Escuchar cuando mi lobby es cancelado o expirado
    socketService.onFreeLobbyRemoved((lobbyId: string) => {
      if (lobbyId === myLobbyId) {
        setMyLobbyId(null);
        toast.info("Lobby cerrado", "Tu partida fue cancelada");
      }
    });

    return () => {
      socketService.disconnectFreeLobbies();
    };
  }, [myLobbyId, setCurrentMatchId, setMatchStatus, setPlayerSide, setView]);

  // Crear una partida gratuita
  const handleCreate = useCallback(() => {
    if (creating) return;
    setCreating(true);

    const lobbyId = `free-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    
    socketService.createFreeLobby({
      id: lobbyId,
      creator: odUserId,
      creatorAlias: alias || "Jugador",
      goals,
      createdAt: Date.now()
    });

    setMyLobbyId(lobbyId);
    setMatchGoalTarget(goals);
    setShowCreateModal(false);
    setCreating(false);
    toast.success("Partida creada", "Esperando rival...");
  }, [creating, odUserId, alias, goals, setMatchGoalTarget]);

  // Unirse a una partida existente
  const handleJoin = useCallback((lobby: FreeLobby) => {
    if (loading) return;
    setLoading(true);

    socketService.joinFreeLobby(lobby.id, {
      odUserId,
      alias: alias || "Jugador"
    });

    // El servidor enviará matchReady al crear y al challenger
    setCurrentMatchId(lobby.id);
    setPlayerSide("challenger");
    setMatchGoalTarget(lobby.goals);
    setMatchStatus("playing");
    setView("playing");
  }, [loading, odUserId, alias, setCurrentMatchId, setMatchGoalTarget, setMatchStatus, setPlayerSide, setView]);

  // Cancelar mi lobby
  const handleCancelLobby = useCallback(() => {
    if (myLobbyId) {
      socketService.cancelFreeLobby(myLobbyId);
      setMyLobbyId(null);
    }
  }, [myLobbyId]);

  // Filtrar lobbies: no mostrar el mío
  const availableLobbies = lobbies.filter(l => l.id !== myLobbyId && l.creator !== odUserId);

  return (
    <div className="lobbies-screen">
      <div className="lobbies-header">
        <button className="lobbies-back" onClick={() => setView("home")}>←</button>
        <span className="lobbies-title">🎮 Online Gratis</span>
        <span style={{ width: 32 }} />
      </div>

      {/* Mi partida en espera */}
      {myLobbyId && (
        <div className="my-waiting-lobby">
          <div className="waiting-pulse" />
          <div className="waiting-info">
            <span className="waiting-label">Tu partida</span>
            <span className="waiting-goals">Meta: {goals} goles</span>
          </div>
          <button className="waiting-cancel" onClick={handleCancelLobby}>
            Cancelar
          </button>
        </div>
      )}

      <div className="lobbies-list">
        {loading && lobbies.length === 0 && (
          <p style={{ color: "var(--text-muted)", textAlign: "center", padding: "40px" }}>
            Cargando lobbies...
          </p>
        )}

        {!loading && availableLobbies.length === 0 && !myLobbyId && (
          <p style={{ color: "var(--text-muted)", textAlign: "center", padding: "40px" }}>
            No hay partidas disponibles.<br/>¡Crea una nueva!
          </p>
        )}

        {availableLobbies.map((lobby) => (
          <div key={lobby.id} className="lobby-card">
            <div className="lobby-info">
              <div className="lobby-header-row">
                <span className="lobby-badge free">🆓 Gratis</span>
                <span className="lobby-badge">🏆 {lobby.goals} goles</span>
              </div>
              <span className="lobby-creator">
                👤 {lobby.creatorAlias}
              </span>
            </div>
            <button className="lobby-join" onClick={() => handleJoin(lobby)}>
              JUGAR
            </button>
          </div>
        ))}
      </div>

      {/* Footer con botón de crear */}
      {!myLobbyId && (
        <div className="lobbies-footer">
          <button 
            className="lobbies-create-btn" 
            onClick={() => setShowCreateModal(true)}
          >
            + CREAR PARTIDA GRATIS
          </button>
        </div>
      )}

      {/* Modal de creación */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content create-modal" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">Nueva Partida</h3>
            
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

            <div className="modal-buttons">
              <button 
                className="modal-btn cancel" 
                onClick={() => setShowCreateModal(false)}
              >
                Cancelar
              </button>
              <button 
                className="modal-btn primary" 
                onClick={handleCreate}
                disabled={creating}
              >
                {creating ? "Creando..." : "Crear"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .my-waiting-lobby {
          background: linear-gradient(135deg, rgba(0, 168, 255, 0.15) 0%, rgba(0, 255, 106, 0.1) 100%);
          border: 2px solid var(--accent-blue);
          border-radius: 16px;
          padding: 16px 20px;
          margin: 0 16px 16px;
          display: flex;
          align-items: center;
          gap: 16px;
          animation: pulseGlow 2s ease-in-out infinite;
        }

        .waiting-pulse {
          width: 12px;
          height: 12px;
          background: var(--accent-blue);
          border-radius: 50%;
          animation: pulse 1.5s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.3); opacity: 0.7; }
        }

        .waiting-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .waiting-label {
          font-size: 14px;
          font-weight: 700;
          color: var(--accent-blue);
        }

        .waiting-goals {
          font-size: 12px;
          color: var(--text-muted);
        }

        .waiting-cancel {
          background: rgba(255, 77, 90, 0.2);
          border: 1px solid var(--accent-red);
          color: var(--accent-red);
          padding: 8px 16px;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .waiting-cancel:hover {
          background: var(--accent-red);
          color: white;
        }

        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.85);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
          padding: 20px;
        }

        .modal-content {
          background: var(--dark-panel);
          border: 2px solid var(--border-green);
          border-radius: 20px;
          padding: 24px;
          max-width: 340px;
          width: 100%;
        }

        .modal-title {
          color: var(--neon-green);
          font-size: 20px;
          font-weight: 700;
          text-align: center;
          margin-bottom: 20px;
        }

        .modal-buttons {
          display: flex;
          gap: 12px;
          margin-top: 24px;
        }

        .modal-btn {
          flex: 1;
          padding: 14px;
          border-radius: 12px;
          font-weight: 700;
          cursor: pointer;
          border: none;
          transition: all 0.2s;
        }

        .modal-btn.cancel {
          background: var(--dark-panel-alt);
          color: var(--text-muted);
          border: 1px solid var(--border-green);
        }

        .modal-btn.primary {
          background: var(--neon-green);
          color: var(--dark-panel);
        }

        .modal-btn.primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 20px rgba(0, 255, 106, 0.4);
        }

        .lobby-badge.free {
          background: rgba(0, 255, 106, 0.2);
          color: var(--neon-green);
        }
      `}</style>
    </div>
  );
}
