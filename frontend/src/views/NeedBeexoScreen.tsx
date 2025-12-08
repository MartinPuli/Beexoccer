/**
 * ConnectBeexoScreen - Pantalla para conectar con Beexo Wallet via XO Connect
 * El usuario puede conectar desde cualquier browser usando XO Connect
 */

import React, { useState } from "react";
import { xoConnectService } from "../services/xoConnectService";
import { useGameStore } from "../hooks/useGameStore";

// URLs oficiales de Beexo
const BEEXO_DOWNLOAD_URL = "https://share.beexo.com/?type=download";
const BEEXO_LOGO_URL = "https://beexo.com/logo-beexo.svg";

interface ConnectBeexoScreenProps {
  onConnected?: () => void;
}

export const NeedBeexoScreen: React.FC<ConnectBeexoScreenProps> = ({ onConnected }) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const setAlias = useGameStore((state) => state.setAlias);
  const setBalance = useGameStore((state) => state.setBalance);
  const setUserAddress = useGameStore((state) => state.setUserAddress);
  const setView = useGameStore((state) => state.setView);

  const handlePlayWithBot = () => {
    // Establecer valores por defecto para jugar con bot
    setAlias("Jugador Local");
    setBalance("0 POL");
    setUserAddress("0x" + "0".repeat(40)); // Dirección vacía
    setView("createBot"); // Navegar a la pantalla de crear partida contra bot
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    setError(null);
    
    try {
      console.log("🐝 Iniciando conexión con Beexo via XO Connect...");
      const success = await xoConnectService.connect();
      
      if (success) {
        const address = xoConnectService.getUserAddress();
        setAlias(xoConnectService.getAlias());
        setBalance(xoConnectService.getTokenBalance("POL") + " POL");
        setUserAddress(address);
        
        console.log("✅ Conectado con Beexo:", address);
        
        if (onConnected) {
          onConnected();
        } else {
          setView("home"); // Cambiado de "lobby" a "home"
        }
      } else {
        setError(xoConnectService.getConnectionError() || "No se pudo conectar");
      }
    } catch (err) {
      console.error("❌ Error conectando:", err);
      setError(err instanceof Error ? err.message : "Error de conexión");
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="connect-beexo-screen">
      <div className="connect-beexo-content">

        <div className="beexo-logo">
          <img 
            src={BEEXO_LOGO_URL}
            alt="Beexo Wallet" 
            className="beexo-logo-img"
          />
        </div>
        
        <h1 className="connect-title">
          Conectá tu <span className="highlight">Beexo Wallet</span>
        </h1>
        
        <p className="connect-description">
          Beexoccer usa <strong>XO Connect</strong> para conectar con tu wallet.
          <br />
          Firmá transacciones on-chain de forma segura ⚽
        </p>
        
        <button 
          className={`connect-btn ${isConnecting ? 'connecting' : ''}`}
          onClick={handleConnect}
          disabled={isConnecting}
        >
          {isConnecting ? (
            <div className="button-content">
              <div className="soccer-ball-container">
                <span className="soccer-ball">⚽</span>
              </div>
              <span>Conectando...</span>
            </div>
          ) : (
            <div className="button-content">
              <span className="btn-icon">⚽</span>
              <span>Conectar con Beexo</span>
            </div>
          )}
        </button>
        
        {error && (
          <div className="error-message">
            <span>⚠️</span> {error}
          </div>
        )}
        
        <div className="xo-connect-info">
          <div className="info-item">
            <span className="info-icon">📱</span>
            <div>
              <strong>Desde celular</strong>
              <p>Se abre Beexo Wallet automáticamente</p>
            </div>
          </div>
          <div className="info-item">
            <span className="info-icon">💻</span>
            <div>
              <strong>Desde computadora</strong>
              <p>Escaneá el QR con tu Beexo Wallet</p>
            </div>
          </div>
        </div>
        
        <div className="download-section">
          <p>¿No tenés Beexo Wallet?</p>
          <a 
            href={BEEXO_DOWNLOAD_URL} 
            target="_blank" 
            rel="noopener noreferrer"
            className="download-link"
          >
            Descargala gratis →
          </a>
        </div>
        
        <div className="or-divider">
          <span>o bien</span>
        </div>

        <button 
          className="play-offline-btn"
          onClick={handlePlayWithBot}
        >
          <span className="btn-icon">🤖</span>
          <span>Jugar contra el Bot (Sin conexión)</span>
        </button>

        <div className="beexo-footer">
          <span>Powered by</span>
          <img src={BEEXO_LOGO_URL} alt="Beexo" className="footer-logo" />
          <span className="xo-connect-badge">XO Connect</span>
        </div>
      </div>
      
      <style>{`
        /* ————————————————————————————————
         🔥 NUEVA ESTÉTICA (solo CSS)
        ———————————————————————————————— */

        .connect-beexo-screen {
          min-height: 100vh;
          min-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: radial-gradient(circle at center, #001a00 0%, #000000 80%);
          padding: 20px;
          position: relative;
          overflow: hidden;
        }

        /* partículas */
        .connect-beexo-screen::before {
          content: "";
          position: absolute;
          inset: 0;
          background: url("https://www.transparenttextures.com/patterns/asfalt-dark.png");
          opacity: 0.25;
        }

        .connect-beexo-content {
          max-width: 420px;
          width: 100%;
          text-align: center;
          padding: 40px 24px;
          background: rgba(0, 20, 0, 0.45);
          border-radius: 24px;
          border: 1px solid rgba(0, 255, 100, 0.25);
          box-shadow: 0 0 25px rgba(0, 255, 100, 0.18);
          backdrop-filter: blur(18px);
        }

        .beexo-logo-img {
          width: 140px;
          filter: drop-shadow(0 0 25px rgba(0, 255, 120, 0.4));
        }

        .connect-title {
          font-size: 24px;
          font-weight: 700;
          color: #CCFFCC;
          margin-bottom: 12px;
        }

        .highlight {
          color: #00FF88;
          text-shadow: 0 0 8px #00FF88;
        }

        .connect-description {
          color: #80FF80;
          font-size: 15px;
          margin-bottom: 28px;
        }

        .connect-description strong {
          color: #00FF88;
        }

        .connect-btn {
          background: linear-gradient(135deg, #00FF88, #009944);
          color: black;
          font-weight: 700;
          box-shadow: 0 0 20px rgba(0, 255, 120, 0.35);
          transition: 0.2s;
        }

        .connect-btn:hover:not(:disabled) {
          transform: scale(1.03);
          box-shadow: 0 0 30px rgba(0, 255, 120, 0.5);
        }

        .connect-btn.connecting {
          background: linear-gradient(135deg, #00CC66, #007733);
        }

        .button-content {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .soccer-ball-container {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          position: relative;
        }

        .soccer-ball {
          display: block;
          font-size: 20px;
          line-height: 1;
          animation: bounce 1s ease-in-out infinite;
        }

        .soccer-ball-container::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: transparent;
          border-radius: 50%;
          border: 2px solid #00FF88;
          opacity: 0;
          animation: pulse 1.5s ease-out infinite;
        }

        @keyframes bounce {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          25% { transform: translateY(-8px) rotate(90deg); }
          50% { transform: translateY(0) rotate(180deg); }
          75% { transform: translateY(-4px) rotate(270deg); }
          100% { transform: translateY(0) rotate(360deg); }
        }

        @keyframes pulse {
          0% { transform: scale(0.8); opacity: 0.7; }
          70% { transform: scale(1.5); opacity: 0; }
          100% { transform: scale(0.8); opacity: 0; }
        }

        .error-message {
          background: rgba(255, 0, 0, 0.15);
          border: 1px solid rgba(255, 0, 0, 0.3);
          color: #FF6666;
        }

        .info-item {
          background: rgba(0, 255, 120, 0.05);
          border: 1px solid rgba(0, 255, 120, 0.1);
        }

        .info-item strong {
          color: #AAFFAA;
        }

        .info-item p {
          color: #66CC66;
        }

        .or-divider {
          display: flex;
          align-items: center;
          margin: 24px 0;
          color: #66CC66;
          font-size: 14px;
        }
        
        .or-divider::before,
        .or-divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: rgba(0, 255, 100, 0.2);
          margin: 0 12px;
        }

        .play-offline-btn {
          width: 100%;
          padding: 16px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #CCCCCC;
          border-radius: 12px;
          font-size: 16px;
          font-weight: 500;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          margin-bottom: 24px;
          transition: all 0.2s ease;
          cursor: pointer;
        }

        .play-offline-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          transform: translateY(-1px);
        }

        .play-offline-btn .btn-icon {
          font-size: 20px;
        }

        .beexo-footer {
          background: rgba(0, 40, 0, 0.4);
        }

        .download-link {
          color: #00FF88;
          text-shadow: 0 0 6px #00FF88;
        }

        .beexo-footer span,
        .footer-logo {
          opacity: 0.7;
        }

        .xo-connect-badge {
          color: #00FF88;
          text-shadow: 0 0 6px #00FF88;
        }
      `}</style>
    </div>
  );
};
