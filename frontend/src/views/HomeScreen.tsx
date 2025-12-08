import { useGameStore } from "../hooks/useGameStore";
import logoImg from "../assets/BEEXOCCER.png";
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
          marginBottom: '2rem'
        }}
      >
        <img 
          src={logoImg} 
          alt="Beexoccer" 
          className="home-logo-img" 
          style={{
            width: '200px',
            height: 'auto',
            animation: isHovered ? 'spin 2s linear infinite' : 'none',
            transition: 'transform 0.3s ease-in-out'
          }}
        />
      </div>
      
      <style>{
        `
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
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
