/**
 * ConnectWalletScreen - Pantalla para conectar con Beexo Wallet o MetaMask
 * - Beexo: Alias del usuario desde XO Connect
 * - MetaMask: Dirección abreviada como alias
 */

import React, { useState } from "react";
import { Capacitor } from "@capacitor/core";
import { walletService } from "../services/walletService";
import { useGameStore } from "../hooks/useGameStore";
import beexoccerLogo from "../assets/BEEXOCCER.png";
import beexoLogo from "../assets/beexo.png";

const BEEXO_DOWNLOAD_URL = "https://share.beexo.com/?type=download";
const METAMASK_LOGO_URL = "https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg";
const METAMASK_DEEP_LINK = "https://metamask.app.link/dapp/";
const APP_URL = "beexoccer.vercel.app"; // URL de tu app web

// Detectar si estamos en móvil
const isMobile = (): boolean => {
  if (typeof navigator === "undefined") return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

// Detectar si estamos en app nativa de Capacitor
const isNativeApp = (): boolean => {
  return Capacitor.isNativePlatform();
};

interface ConnectWalletScreenProps {
  onConnected?: () => void;
}

export const NeedBeexoScreen: React.FC<ConnectWalletScreenProps> = ({ onConnected }) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectingType, setConnectingType] = useState<"beexo" | "metamask" | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const setAlias = useGameStore((state) => state.setAlias);
  const setBalance = useGameStore((state) => state.setBalance);
  const setUserAddress = useGameStore((state) => state.setUserAddress);
  const setView = useGameStore((state) => state.setView);

  const handlePlayWithBot = () => {
    setAlias("Jugador Local");
    setBalance("0 POL");
    setUserAddress("0x" + "0".repeat(40));
    setView("createBot");
  };

  const handleConnectBeexo = async () => {
    setIsConnecting(true);
    setConnectingType("beexo");
    setError(null);
    
    try {
      const success = await walletService.connectBeexo();
      
      if (success) {
        const address = walletService.getUserAddress();
        setAlias(walletService.getAlias());
        setBalance(walletService.getTokenBalance("POL") + " POL");
        setUserAddress(address);
        
        if (onConnected) {
          onConnected();
        } else {
          setView("home");
        }
      } else {
        setError(walletService.getConnectionError() || "No se pudo conectar con Beexo");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de conexión");
    } finally {
      setIsConnecting(false);
      setConnectingType(null);
    }
  };

  const handleConnectMetaMask = async () => {
    // En app nativa de Capacitor, no podemos usar deep links de MetaMask
    // El usuario debe abrir la app desde el navegador de MetaMask
    if (isNativeApp()) {
      setError(
        "Para usar MetaMask, abrí la app de MetaMask → Navegador → " + APP_URL + " o usá Beexo Wallet"
      );
      return;
    }
    
    // En móvil web sin MetaMask inyectado, redirigir a la app de MetaMask
    if (!walletService.isMetaMaskAvailable() && isMobile()) {
      const currentUrl = globalThis.location.href.replace(/^https?:\/\//, '');
      globalThis.location.href = METAMASK_DEEP_LINK + currentUrl;
      return;
    }
    
    if (!walletService.isMetaMaskAvailable()) {
      setError("MetaMask no está instalado. Descárgalo desde metamask.io");
      return;
    }
    
    setIsConnecting(true);
    setConnectingType("metamask");
    setError(null);
    
    try {
      const success = await walletService.connectMetaMask();
      
      if (success) {
        const address = walletService.getUserAddress();
        setAlias(walletService.getAlias());
        setBalance(walletService.getTokenBalance("POL") + " POL");
        setUserAddress(address);
        
        if (onConnected) {
          onConnected();
        } else {
          setView("home");
        }
      } else {
        setError(walletService.getConnectionError() || "No se pudo conectar con MetaMask");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de conexión");
    } finally {
      setIsConnecting(false);
      setConnectingType(null);
    }
  };

  return (
    <div className="connect-beexo-screen">
      <div className="connect-beexo-content">

        <div className="beexo-logo">
          <img 
            src={beexoccerLogo}
            alt="BEEXOCCER" 
            className="beexo-logo-img"
          />
        </div>
        
        <h1 className="connect-title">
          Conectá tu <span className="highlight">Wallet</span>
        </h1>
        
        <p className="connect-description">
          Elegí cómo conectar para jugar partidas online
        </p>
        
        {/* Botón Beexo */}
        <button 
          className={`connect-btn beexo-btn ${connectingType === "beexo" ? 'connecting' : ''}`}
          onClick={handleConnectBeexo}
          disabled={isConnecting}
        >
          {connectingType === "beexo" ? (
            <div className="button-content">
              <div className="soccer-ball-container">
                <span className="soccer-ball">⚽</span>
              </div>
              <span>Conectando...</span>
            </div>
          ) : (
            <div className="button-content">
              <img src={beexoLogo} alt="Beexo" className="wallet-icon" />
              <span>Conectar con Beexo</span>
            </div>
          )}
        </button>
        
        {/* Botón MetaMask */}
        <button 
          className={`connect-btn metamask-btn ${connectingType === "metamask" ? 'connecting' : ''}`}
          onClick={handleConnectMetaMask}
          disabled={isConnecting}
        >
          {connectingType === "metamask" ? (
            <div className="button-content">
              <div className="soccer-ball-container">
                <span className="soccer-ball">⚽</span>
              </div>
              <span>Conectando...</span>
            </div>
          ) : (
            <div className="button-content">
              <img src={METAMASK_LOGO_URL} alt="MetaMask" className="wallet-icon" />
              <span>Conectar con MetaMask</span>
            </div>
          )}
        </button>
        
        {error && (
          <div className="error-message">
            <span>⚠️</span> {error}
          </div>
        )}
        
        <div className="wallet-info">
          <div className="info-item">
            <img src={beexoLogo} alt="Beexo" className="info-icon-img" />
            <div>
              <strong>Beexo Wallet</strong>
              <p>Tu alias aparece en el juego</p>
            </div>
          </div>
          <div className="info-item">
            <img src={METAMASK_LOGO_URL} alt="" className="info-icon-img" />
            <div>
              <strong>MetaMask</strong>
              <p>Tu dirección abreviada como alias</p>
            </div>
          </div>
        </div>
        
        <div className="download-section">
          <p>¿No tenés wallet?</p>
          <a 
            href={BEEXO_DOWNLOAD_URL} 
            target="_blank" 
            rel="noopener noreferrer"
            className="download-link"
          >
            Descargar Beexo →
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
          <span>Jugar contra el Bot (sin wallet)</span>
        </button>

        <div className="beexo-footer">
          <span>Red: Polygon Mainnet</span>
        </div>
      </div>
      
      <style>{`
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
          position: relative;
          z-index: 1;
        }

        .beexo-logo {
          width: 100%;
          display: flex;
          justify-content: center;
          margin-bottom: 10px;
        }

        .beexo-logo-img {
          width: 220px;
          max-width: 80%;
          filter: drop-shadow(0 0 25px rgba(0, 255, 120, 0.4));
          margin-bottom: 20px;
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

        .connect-btn {
          width: 100%;
          padding: 16px;
          border-radius: 12px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
          margin-bottom: 12px;
        }
        
        .beexo-btn {
          background: linear-gradient(135deg, #00FF88, #009944);
          color: black;
          box-shadow: 0 0 20px rgba(0, 255, 120, 0.35);
        }

        .beexo-btn:hover:not(:disabled) {
          transform: scale(1.02);
          box-shadow: 0 0 30px rgba(0, 255, 120, 0.5);
        }
        
        .metamask-btn {
          background: linear-gradient(135deg, #F6851B, #E2761B);
          color: white;
          box-shadow: 0 0 20px rgba(246, 133, 27, 0.35);
        }

        .metamask-btn:hover:not(:disabled) {
          transform: scale(1.02);
          box-shadow: 0 0 30px rgba(246, 133, 27, 0.5);
        }

        .connect-btn.connecting {
          opacity: 0.7;
        }

        .button-content {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
        }
        
        .wallet-icon {
          width: 24px;
          height: 24px;
        }

        .soccer-ball-container {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
        }

        .soccer-ball {
          font-size: 20px;
          animation: bounce 1s ease-in-out infinite;
        }

        @keyframes bounce {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-8px) rotate(180deg); }
        }

        .error-message {
          background: rgba(255, 0, 0, 0.15);
          border: 1px solid rgba(255, 0, 0, 0.3);
          color: #FF6666;
          padding: 12px;
          border-radius: 8px;
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          gap: 8px;
          justify-content: center;
        }

        .wallet-info {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin: 24px 0;
        }

        .info-item {
          background: rgba(0, 255, 120, 0.05);
          border: 1px solid rgba(0, 255, 120, 0.1);
          padding: 12px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          gap: 12px;
          text-align: left;
        }

        .info-icon {
          font-size: 24px;
        }
        
        .info-icon-img {
          width: 24px;
          height: 24px;
        }

        .info-item strong {
          color: #AAFFAA;
          display: block;
        }

        .info-item p {
          color: #66CC66;
          font-size: 13px;
          margin: 0;
        }

        .or-divider {
          display: flex;
          align-items: center;
          margin: 20px 0;
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
          padding: 14px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #CCCCCC;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 500;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          margin-bottom: 20px;
          transition: all 0.2s ease;
          cursor: pointer;
        }

        .play-offline-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          transform: translateY(-1px);
        }

        .download-section {
          margin: 16px 0;
        }
        
        .download-section p {
          color: #888;
          margin-bottom: 4px;
        }

        .download-link {
          color: #00FF88;
          text-decoration: none;
        }

        .beexo-footer {
          color: #555;
          font-size: 12px;
          margin-top: 16px;
        }
      `}</style>
    </div>
  );
};
