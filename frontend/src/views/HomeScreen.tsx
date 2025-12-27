import { useGameStore } from "../hooks/useGameStore";
import logoImg from "../assets/BEEXOCCER.png";
import ballImg from "../assets/ball.png";
import { useMemo } from "react";
import { getArgentinaTeam2025 } from "../data/argentinaTeams2025";

export function HomeScreen() {
  const setView = useGameStore((state) => state.setView);
  const userAddress = useGameStore((state) => state.userAddress);
  const selectedTeamId = useGameStore((state) => state.selectedTeamId);
  const selectedTeam = getArgentinaTeam2025(selectedTeamId);

  const walletLabel = useMemo(() => {
    const addr = (userAddress || "").trim();
    if (!addr) return "WALLET";
    if (addr.length <= 12) return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  }, [userAddress]);

  return (
    <div className="home-screen">
      <button
        className="home-user-badge"
        title={userAddress || ""}
      >
        {walletLabel}
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
        Wallet Conectada: <span title={userAddress || ""}>{walletLabel}</span>
      </p>
    </div>
  );
}
