/**
 * NeedBeexoScreen - Pantalla que muestra cuando no se detecta Beexo Wallet
 * Diseño basado en el branding oficial de Beexo (beexo.com)
 */

import React from "react";

// URLs oficiales de Beexo
const BEEXO_DOWNLOAD_URL = "https://share.beexo.com/?type=download";
const BEEXO_LOGO_URL = "https://beexo.com/logo-beexo.svg";

// URL de la app para abrir en Beexo
const APP_URL = typeof window !== 'undefined' ? window.location.href : "https://beexoccer.vercel.app";

export const NeedBeexoScreen: React.FC = () => {
  const copyToClipboard = () => {
    navigator.clipboard.writeText(APP_URL);
    const btn = document.querySelector('.copy-url-btn') as HTMLButtonElement;
    if (btn) {
      btn.textContent = "✓ Copiado!";
      setTimeout(() => {
        btn.textContent = "📋 Copiar URL";
      }, 2000);
    }
  };

  return (
    <div className="need-beexo-screen">
      <div className="need-beexo-content">
        {/* Logo de Beexo */}
        <div className="beexo-logo">
          <img 
            src={BEEXO_LOGO_URL}
            alt="Beexo Wallet" 
            className="beexo-logo-img"
          />
        </div>
        
        <h1 className="need-beexo-title">
          Abrí <span className="highlight">Beexoccer</span> desde Beexo
        </h1>
        
        <p className="need-beexo-description">
          Este juego funciona exclusivamente dentro de <strong>Beexo Wallet</strong>.
          <br />
          Es la wallet self-custodial más user-friendly del planeta 🐝
        </p>
        
        <div className="need-beexo-steps">
          <div className="step">
            <span className="step-number">1</span>
            <div className="step-content">
              <span className="step-title">Descargá Beexo Wallet</span>
              <span className="step-subtitle">Disponible en iOS, Android y PWA</span>
            </div>
          </div>
          <div className="step">
            <span className="step-number">2</span>
            <div className="step-content">
              <span className="step-title">Creá tu wallet</span>
              <span className="step-subtitle">Simple, seguro y en segundos</span>
            </div>
          </div>
          <div className="step">
            <span className="step-number">3</span>
            <div className="step-content">
              <span className="step-title">Abrí este link en el browser de Beexo</span>
              <span className="step-subtitle">Navegá a la URL desde dentro de la app</span>
            </div>
          </div>
        </div>
        
        <div className="need-beexo-actions">
          <a 
            href={BEEXO_DOWNLOAD_URL} 
            target="_blank" 
            rel="noopener noreferrer"
            className="beexo-download-btn"
          >
            <span className="btn-icon">🐝</span>
            Descargar Beexo Wallet
          </a>
        </div>
        
        <div className="current-url">
          <p>Copiá esta URL y abrila en el browser de Beexo:</p>
          <code>{APP_URL}</code>
          <button 
            className="copy-url-btn"
            onClick={copyToClipboard}
          >
            📋 Copiar URL
          </button>
        </div>
        
        <div className="how-to-open">
          <h3>¿Cómo abrir en Beexo?</h3>
          <div className="how-to-steps">
            <p>1. Abrí la app Beexo Wallet</p>
            <p>2. Tocá el ícono del <strong>🌐 Browser</strong> (abajo)</p>
            <p>3. Pegá la URL de arriba</p>
            <p>4. ¡Listo! Jugá Beexoccer on-chain</p>
          </div>
        </div>
        
        {/* Footer con branding */}
        <div className="beexo-footer">
          <span>Powered by</span>
          <img src={BEEXO_LOGO_URL} alt="Beexo" className="footer-logo" />
          <span className="xo-connect">XO Connect</span>
        </div>
      </div>
      
      <style>{`
        .need-beexo-screen {
          min-height: 100vh;
          min-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(180deg, #0D0D0D 0%, #1A1A2E 50%, #0D0D0D 100%);
          padding: 20px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        
        .need-beexo-content {
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
          width: 160px;
          height: auto;
          filter: drop-shadow(0 0 20px rgba(255, 200, 0, 0.3));
        }
        
        .need-beexo-title {
          font-size: 24px;
          font-weight: 700;
          color: #FFFFFF;
          margin-bottom: 12px;
          line-height: 1.3;
        }
        
        .need-beexo-title .highlight {
          background: linear-gradient(135deg, #FFC800, #FF9500);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        
        .need-beexo-description {
          color: #A0A0B0;
          font-size: 15px;
          line-height: 1.6;
          margin-bottom: 28px;
        }
        
        .need-beexo-description strong {
          color: #FFC800;
        }
        
        .need-beexo-steps {
          margin-bottom: 28px;
          text-align: left;
        }
        
        .step {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          padding: 14px;
          margin-bottom: 10px;
          background: rgba(255, 200, 0, 0.03);
          border-radius: 14px;
          border: 1px solid rgba(255, 200, 0, 0.08);
          transition: all 0.3s ease;
        }
        
        .step:hover {
          background: rgba(255, 200, 0, 0.06);
          border-color: rgba(255, 200, 0, 0.15);
        }
        
        .step-number {
          width: 32px;
          height: 32px;
          min-width: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #FFC800, #FF9500);
          color: #000;
          font-weight: 700;
          border-radius: 10px;
          font-size: 14px;
        }
        
        .step-content {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        
        .step-title {
          color: #FFFFFF;
          font-size: 14px;
          font-weight: 600;
        }
        
        .step-subtitle {
          color: #707080;
          font-size: 12px;
        }
        
        .need-beexo-actions {
          margin-bottom: 24px;
        }
        
        .beexo-download-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 16px 36px;
          background: linear-gradient(135deg, #FFC800, #FF9500);
          color: #000;
          font-weight: 700;
          font-size: 16px;
          border-radius: 14px;
          text-decoration: none;
          transition: all 0.3s ease;
          box-shadow: 0 4px 24px rgba(255, 200, 0, 0.25);
          width: 100%;
        }
        
        .beexo-download-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 32px rgba(255, 200, 0, 0.35);
        }
        
        .beexo-download-btn:active {
          transform: translateY(0);
        }
        
        .btn-icon {
          font-size: 20px;
        }
        
        .current-url {
          padding: 18px;
          background: rgba(0, 0, 0, 0.4);
          border-radius: 14px;
          border: 1px solid rgba(255, 255, 255, 0.05);
          margin-bottom: 24px;
        }
        
        .current-url p {
          color: #707080;
          font-size: 12px;
          margin-bottom: 10px;
        }
        
        .current-url code {
          display: block;
          color: #00E676;
          font-size: 12px;
          word-break: break-all;
          margin-bottom: 14px;
          padding: 10px 12px;
          background: rgba(0, 230, 118, 0.08);
          border-radius: 8px;
          font-family: 'SF Mono', Monaco, monospace;
        }
        
        .copy-url-btn {
          padding: 10px 20px;
          background: rgba(255, 255, 255, 0.08);
          color: #fff;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 10px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
          transition: all 0.3s ease;
          width: 100%;
        }
        
        .copy-url-btn:hover {
          background: rgba(255, 255, 255, 0.12);
        }
        
        .how-to-open {
          padding: 18px;
          background: rgba(255, 200, 0, 0.03);
          border-radius: 14px;
          border: 1px solid rgba(255, 200, 0, 0.08);
          margin-bottom: 24px;
          text-align: left;
        }
        
        .how-to-open h3 {
          color: #FFC800;
          font-size: 14px;
          font-weight: 600;
          margin-bottom: 12px;
        }
        
        .how-to-steps p {
          color: #A0A0B0;
          font-size: 13px;
          margin-bottom: 6px;
          padding-left: 4px;
        }
        
        .how-to-steps strong {
          color: #FFFFFF;
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
        
        .beexo-footer .xo-connect {
          color: #FFC800;
          font-weight: 600;
        }
        
        @media (max-width: 480px) {
          .need-beexo-content {
            padding: 28px 18px;
          }
          
          .beexo-logo-img {
            width: 130px;
          }
          
          .need-beexo-title {
            font-size: 20px;
          }
          
          .beexo-download-btn {
            padding: 14px 28px;
            font-size: 15px;
          }
        }
      `}</style>
    </div>
  );
};
