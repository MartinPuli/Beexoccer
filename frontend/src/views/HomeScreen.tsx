import { useGameStore } from "../hooks/useGameStore";
import logoImg from "../assets/BEEXOCCER.png";
import ballImg from "../assets/ball.png";
import { useState } from "react";

export function HomeScreen() {
  const [isHovered, setIsHovered] = useState(false);
  const setView = useGameStore((state) => state.setView);
  const alias = useGameStore((state) => state.alias);

  return (
    <div className="home-screen">
      {/* Logo con pelota neón */}
      <div 
        className="home-logo" 
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          width: '100%',
          marginBottom: '2rem',
          cursor: 'pointer',
          position: 'relative'
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
            animation: isHovered ? 'spin 1s linear infinite' : 'none',
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

      {/* Torneos como en el mock */}
      <div className="torneos-box">
        <span className="torneos-lock">🔒</span>
        <span className="torneos-soon">PRÓXIMAMENTE</span>
        <span className="torneos-title">TORNEOS</span>
      </div>

      {/* Wallet */}
      <p className="home-wallet">
        Wallet Conectada: {alias || "0x1234..."}
      </p>
    </div>
  );
}
