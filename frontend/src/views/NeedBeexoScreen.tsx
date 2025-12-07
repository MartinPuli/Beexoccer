/**
 * NeedBeexoScreen - Pantalla que muestra cuando no se detecta Beexo Wallet
 */

import React from "react";

const BEEXO_DOWNLOAD_URL = "https://beexo.com/download"; // URL de descarga de Beexo
const BEEXO_WEBSITE_URL = "https://beexo.com";

export const NeedBeexoScreen: React.FC = () => {
  return (
    <div className="need-beexo-screen">
      <div className="need-beexo-content">
        <div className="beexo-logo">
          <img 
            src="/logos/beexo-logo.png" 
            alt="Beexo Wallet" 
            onError={(e) => {
              // Si no hay logo, mostrar emoji
              e.currentTarget.style.display = 'none';
              e.currentTarget.nextElementSibling?.classList.remove('hidden');
            }}
          />
          <span className="beexo-emoji hidden">🐝</span>
        </div>
        
        <h1 className="need-beexo-title">Necesitas Beexo Wallet</h1>
        
        <p className="need-beexo-description">
          Beexoccer funciona exclusivamente con <strong>Beexo Wallet</strong>.
          <br />
          Descarga la app y abrí este juego desde el navegador integrado de Beexo.
        </p>
        
        <div className="need-beexo-steps">
          <div className="step">
            <span className="step-number">1</span>
            <span className="step-text">Descarga Beexo Wallet</span>
          </div>
          <div className="step">
            <span className="step-number">2</span>
            <span className="step-text">Crea o importa tu wallet</span>
          </div>
          <div className="step">
            <span className="step-number">3</span>
            <span className="step-text">Abrí este link desde Beexo</span>
          </div>
        </div>
        
        <div className="need-beexo-actions">
          <a 
            href={BEEXO_DOWNLOAD_URL} 
            target="_blank" 
            rel="noopener noreferrer"
            className="beexo-download-btn"
          >
            📱 Descargar Beexo Wallet
          </a>
          
          <a 
            href={BEEXO_WEBSITE_URL}
            target="_blank" 
            rel="noopener noreferrer"
            className="beexo-learn-more"
          >
            Más información sobre Beexo →
          </a>
        </div>
        
        <div className="current-url">
          <p>Abrí esta URL en Beexo:</p>
          <code>{window.location.href}</code>
          <button 
            className="copy-url-btn"
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              alert("URL copiada!");
            }}
          >
            📋 Copiar
          </button>
        </div>
      </div>
      
      <style>{`
        .need-beexo-screen {
          min-height: 100vh;
          min-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #0a0a12 0%, #1a1a2e 50%, #0f0f23 100%);
          padding: 20px;
        }
        
        .need-beexo-content {
          max-width: 400px;
          text-align: center;
          padding: 40px 30px;
          background: rgba(255, 255, 255, 0.03);
          border-radius: 24px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(10px);
        }
        
        .beexo-logo img {
          width: 100px;
          height: 100px;
          margin-bottom: 20px;
        }
        
        .beexo-emoji {
          font-size: 80px;
          display: block;
          margin-bottom: 20px;
        }
        
        .beexo-emoji.hidden {
          display: none;
        }
        
        .need-beexo-title {
          font-size: 28px;
          color: #FFD700;
          margin-bottom: 16px;
          text-shadow: 0 0 20px rgba(255, 215, 0, 0.4);
        }
        
        .need-beexo-description {
          color: #b0b0c0;
          font-size: 16px;
          line-height: 1.6;
          margin-bottom: 30px;
        }
        
        .need-beexo-description strong {
          color: #FFD700;
        }
        
        .need-beexo-steps {
          margin-bottom: 30px;
        }
        
        .step {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          margin-bottom: 8px;
          background: rgba(255, 215, 0, 0.05);
          border-radius: 12px;
          border: 1px solid rgba(255, 215, 0, 0.1);
        }
        
        .step-number {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #FFD700, #FFA500);
          color: #000;
          font-weight: bold;
          border-radius: 50%;
          font-size: 14px;
        }
        
        .step-text {
          color: #e0e0e0;
          font-size: 14px;
          text-align: left;
        }
        
        .need-beexo-actions {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 30px;
        }
        
        .beexo-download-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 16px 32px;
          background: linear-gradient(135deg, #FFD700, #FFA500);
          color: #000;
          font-weight: bold;
          font-size: 16px;
          border-radius: 12px;
          text-decoration: none;
          transition: all 0.3s ease;
          box-shadow: 0 4px 20px rgba(255, 215, 0, 0.3);
        }
        
        .beexo-download-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 30px rgba(255, 215, 0, 0.4);
        }
        
        .beexo-learn-more {
          color: #FFD700;
          text-decoration: none;
          font-size: 14px;
          opacity: 0.8;
          transition: opacity 0.3s ease;
        }
        
        .beexo-learn-more:hover {
          opacity: 1;
        }
        
        .current-url {
          padding: 20px;
          background: rgba(0, 0, 0, 0.3);
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.05);
        }
        
        .current-url p {
          color: #808090;
          font-size: 12px;
          margin-bottom: 8px;
        }
        
        .current-url code {
          display: block;
          color: #00ffaa;
          font-size: 11px;
          word-break: break-all;
          margin-bottom: 12px;
          padding: 8px;
          background: rgba(0, 255, 170, 0.05);
          border-radius: 6px;
        }
        
        .copy-url-btn {
          padding: 8px 16px;
          background: rgba(255, 255, 255, 0.1);
          color: #fff;
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 8px;
          cursor: pointer;
          font-size: 12px;
          transition: all 0.3s ease;
        }
        
        .copy-url-btn:hover {
          background: rgba(255, 255, 255, 0.15);
        }
      `}</style>
    </div>
  );
};
