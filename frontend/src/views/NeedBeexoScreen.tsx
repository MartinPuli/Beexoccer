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

  const handleConnect = async () => {
    setIsConnecting(true);
    setError(null);
    
    try {
      console.log("🐝 Iniciando conexión con Beexo via XO Connect...");
      const success = await xoConnectService.connect();
      
      if (success) {
        // Conexión exitosa
        const address = xoConnectService.getUserAddress();
        setAlias(xoConnectService.getAlias());
        setBalance(xoConnectService.getTokenBalance("POL") + " POL");
        setUserAddress(address);
        
        console.log("✅ Conectado con Beexo:", address);
        
        if (onConnected) {
          onConnected();
        } else {
          setView("lobby");
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
        {/* Logo de Beexo */}
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
          Firmá transacciones on-chain de forma segura 🐝
        </p>
        
        {/* Botón de conexión principal */}
        <button 
          className={`connect-btn ${isConnecting ? 'connecting' : ''}`}
          onClick={handleConnect}
          disabled={isConnecting}
        >
          {isConnecting ? (
            <>
              <span className="spinner"></span>
              Conectando...
            </>
          ) : (
            <>
              <span className="btn-icon">🐝</span>
              Conectar con Beexo
            </>
          )}
        </button>
        
        {/* Error message */}
        {error && (
          <div className="error-message">
            <span>⚠️</span> {error}
          </div>
        )}
        
        {/* Info de XO Connect */}
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
        
        {/* Link de descarga */}
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
        
        {/* Footer con branding */}
        <div className="beexo-footer">
          <span>Powered by</span>
          <img src={BEEXO_LOGO_URL} alt="Beexo" className="footer-logo" />
          <span className="xo-connect-badge">XO Connect</span>
        </div>
      </div>
      
      <style>{`
        .connect-beexo-screen {
          min-height: 100vh;
          min-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(180deg, #0D0D0D 0%, #1A1A2E 50%, #0D0D0D 100%);
          padding: 20px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        
        .connect-beexo-content {
          max-width: 420px;
          width: 100%;
          text-align: center;
          padding: 40px 24px;
          background: rgba(255, 255, 255, 0.02);
          border-radius: 24px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(20px);
        }
        
        .beexo-logo {
          margin-bottom: 24px;
        }
        
        .beexo-logo-img {
          width: 140px;
          height: auto;
          filter: drop-shadow(0 0 20px rgba(255, 200, 0, 0.3));
        }
        
        .connect-title {
          font-size: 24px;
          font-weight: 700;
          color: #FFFFFF;
          margin-bottom: 12px;
          line-height: 1.3;
        }
        
        .connect-title .highlight {
          background: linear-gradient(135deg, #FFC800, #FF9500);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        
        .connect-description {
          color: #A0A0B0;
          font-size: 15px;
          line-height: 1.6;
          margin-bottom: 28px;
        }
        
        .connect-description strong {
          color: #FFC800;
        }
        
        .connect-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 18px 40px;
          background: linear-gradient(135deg, #FFC800, #FF9500);
          color: #000;
          font-weight: 700;
          font-size: 17px;
          border-radius: 14px;
          border: none;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 4px 24px rgba(255, 200, 0, 0.25);
          width: 100%;
          margin-bottom: 16px;
        }
        
        .connect-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 32px rgba(255, 200, 0, 0.35);
        }
        
        .connect-btn:active:not(:disabled) {
          transform: translateY(0);
        }
        
        .connect-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
        
        .connect-btn.connecting {
          background: linear-gradient(135deg, #E0B000, #D08000);
        }
        
        .btn-icon {
          font-size: 22px;
        }
        
        .spinner {
          width: 20px;
          height: 20px;
          border: 3px solid rgba(0,0,0,0.2);
          border-top-color: #000;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
        .error-message {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px 16px;
          background: rgba(255, 80, 80, 0.1);
          border: 1px solid rgba(255, 80, 80, 0.2);
          border-radius: 10px;
          color: #FF6B6B;
          font-size: 14px;
          margin-bottom: 20px;
        }
        
        .xo-connect-info {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 24px;
          text-align: left;
        }
        
        .info-item {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 14px;
          background: rgba(255, 200, 0, 0.03);
          border-radius: 12px;
          border: 1px solid rgba(255, 200, 0, 0.08);
        }
        
        .info-icon {
          font-size: 24px;
          line-height: 1;
        }
        
        .info-item strong {
          color: #FFFFFF;
          font-size: 14px;
          display: block;
          margin-bottom: 2px;
        }
        
        .info-item p {
          color: #707080;
          font-size: 12px;
          margin: 0;
        }
        
        .download-section {
          padding: 16px;
          background: rgba(0, 0, 0, 0.3);
          border-radius: 12px;
          margin-bottom: 20px;
        }
        
        .download-section p {
          color: #606070;
          font-size: 13px;
          margin-bottom: 8px;
        }
        
        .download-link {
          color: #FFC800;
          text-decoration: none;
          font-size: 14px;
          font-weight: 600;
          transition: opacity 0.3s ease;
        }
        
        .download-link:hover {
          opacity: 0.8;
        }
        
        .beexo-footer {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding-top: 16px;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
        }
        
        .beexo-footer span {
          color: #505060;
          font-size: 12px;
        }
        
        .beexo-footer .footer-logo {
          height: 16px;
          width: auto;
          opacity: 0.6;
        }
        
        .beexo-footer .xo-connect-badge {
          color: #FFC800;
          font-weight: 600;
        }
        
        @media (max-width: 480px) {
          .connect-beexo-content {
            padding: 28px 18px;
          }
          
          .beexo-logo-img {
            width: 120px;
          }
          
          .connect-title {
            font-size: 20px;
          }
          
          .connect-btn {
            padding: 16px 32px;
            font-size: 16px;
          }
        }
      `}</style>
    </div>
  );
};
