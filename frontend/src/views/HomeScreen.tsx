import { useGameStore } from "../hooks/useGameStore";
import logoImg from "../assets/BEEXOCCER.png";
import ballImg from "../assets/ball.png";
import { useState } from "react";
import { getArgentinaTeam2025 } from "../data/argentinaTeams2025";
import { socketService } from "../services/socketService";

export function HomeScreen() {
  const [isHovered, setIsHovered] = useState(false);
  const setView = useGameStore((state) => state.setView);
  const alias = useGameStore((state) => state.alias);
  const username = useGameStore((state) => state.username);
  const usernameStatus = useGameStore((state) => state.usernameStatus);
  const setUsername = useGameStore((state) => state.setUsername);
  const selectedTeamId = useGameStore((state) => state.selectedTeamId);
  const selectedTeam = getArgentinaTeam2025(selectedTeamId);

  const [isUsernameOpen, setIsUsernameOpen] = useState(usernameStatus === "unset");
  const [usernameInput, setUsernameInput] = useState(username || "");
  const [usernameError, setUsernameError] = useState<string>("");
  const [usernameLoading, setUsernameLoading] = useState(false);
  const [usernameOffline, setUsernameOffline] = useState(false);

  const isValidUsername = (name: string) => {
    const trimmed = name.trim();
    if (trimmed.length < 3 || trimmed.length > 16) return false;
    return /^[a-zA-Z0-9_]+$/.test(trimmed);
  };

  const openUsername = () => {
    setUsernameInput(username || "");
    setUsernameError("");
    setUsernameOffline(false);
    setIsUsernameOpen(true);
  };

  const confirmUsername = async () => {
    const desired = usernameInput.trim();
    setUsernameError("");
    setUsernameOffline(false);

    if (!isValidUsername(desired)) {
      setUsernameError("Usuario inválido (3-16, letras/números/_) ");
      return;
    }

    setUsernameLoading(true);
    try {
      const res = await socketService.reserveUsername(desired);
      if (!res.ok) {
        if (res.reason === "taken") {
          setUsernameError("Ese usuario ya está en uso");
        } else if (res.reason === "unavailable") {
          // Fallback local: permitir elegir usuario aunque el server no valide.
          setUsernameOffline(true);
          setUsername(desired);
          setIsUsernameOpen(false);
          return;
        } else {
          setUsernameError("Usuario inválido (3-16, letras/números/_) ");
        }
        return;
      }
      setUsername(res.username || desired);
      setIsUsernameOpen(false);
    } catch {
      // Fallback local si hubo error de red
      setUsernameOffline(true);
      setUsername(desired);
      setIsUsernameOpen(false);
    } finally {
      setUsernameLoading(false);
    }
  };

  return (
    <div className="home-screen">
      <button
        className="home-user-badge"
        onClick={openUsername}
        title="Cambiar usuario"
        style={{ zIndex: 5 }}
      >
        {username ? `@${username}` : "ELEGIR USUARIO"}
      </button>

      <button
        onClick={() => setView("teamSelect")}
        style={{
          position: "absolute",
          top: 14,
          right: 14,
          zIndex: 5,
          padding: "8px 10px",
          borderRadius: 10,
          border: "1px solid rgba(0,255,106,0.35)",
          background: "rgba(0,0,0,0.35)",
          color: "white",
          fontWeight: 800,
          fontSize: 12,
          cursor: "pointer",
        }}
        title="Elegir equipo"
      >
        {selectedTeam?.shortName || "EQUIPO"}
      </button>

      {/* Logo con pelota neón */}
      <div 
        className="home-logo" 
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          width: '100%',
          marginBottom: '2rem',
          position: 'relative',
          pointerEvents: 'none'
        }}
      >
        {/* Logo original */}
        <img 
          src={logoImg} 
          alt="Beexoccer" 
          style={{
            width: '200px',
            height: 'auto'
          }}
        />
        {/* Pelota superpuesta que gira */}
        <img 
          src={ballImg} 
          alt="Ball" 
          style={{
            position: 'absolute',
            width: '27px',
            height: '27px',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            marginLeft: '6px',
            animation: 'spin 5s linear infinite',
            filter: 'drop-shadow(0 0 8px #00ff6a)'
          }}
        />
      </div>
      
      <style>{
        `
        @keyframes spin {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to { transform: translate(-50%, -50%) rotate(360deg); }
        }
        `
      }</style>

      {/* Botones principales */}
      <button className="home-btn primary" onClick={() => setView("accept")}>
        JUGAR 1 VS 1
      </button>

      <button className="home-btn primary" onClick={() => setView("createBot")}>
        JUGAR CONTRA BOT
      </button>

      <button className="home-btn primary" onClick={() => setView("ranking")}>
        RANKING
      </button>

      <button className="home-btn primary" onClick={() => setView("tournaments")}>
        TORNEOS
      </button>

      {/* Wallet */}
      <p className="home-wallet">
        Wallet Conectada: {alias || "0x1234..."}
      </p>

      {isUsernameOpen ? (
        <div className="tournament-modal-overlay" onMouseDown={() => (usernameStatus === "unset" ? null : setIsUsernameOpen(false))}>
          <div className="tournament-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="tournament-modal-header">
              <button className="create-back" onClick={() => (usernameStatus === "unset" ? null : setIsUsernameOpen(false))}>
                ←
              </button>
              <span className="create-title">Elige tu usuario</span>
              <span style={{ width: 32 }} />
            </div>

            <div className="tournament-modal-body">
              <div className="create-section">
                <span className="create-label">Usuario</span>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <input
                    className="stake-input"
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    placeholder="Escribe tu usuario"
                    autoFocus
                  />
                  <button className="lobby-join" disabled={usernameLoading} onClick={confirmUsername}>
                    {usernameLoading ? "..." : "CONFIRMAR"}
                  </button>
                </div>
                {usernameError ? (
                  <div style={{ color: "var(--accent-red)", fontWeight: 800, fontSize: 13 }}>{usernameError}</div>
                ) : usernameOffline ? (
                  <div style={{ color: "var(--accent-gold)", fontWeight: 800, fontSize: 13 }}>
                    Modo offline: el usuario puede no ser único.
                  </div>
                ) : (
                  <div style={{ color: "var(--text-muted)", fontWeight: 700, fontSize: 13 }}>
                    3-16 caracteres, letras/números/underscore.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
