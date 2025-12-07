import { useState, useEffect } from "react";
import { xoConnectService } from "../services/xoConnectService";
import { useGameStore } from "../hooks/useGameStore";
import { checkMatchStatus } from "../services/matchService";
import { toast } from "../components/Toast";
import logoSvg from "../assets/logo.svg";

export function ConnectWalletScreen() {
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasWallet, setHasWallet] = useState<boolean | null>(null);
  const setAlias = useGameStore((state) => state.setAlias);
  const setBalance = useGameStore((state) => state.setBalance);
  const setUserAddress = useGameStore((state) => state.setUserAddress);
  const setView = useGameStore((state) => state.setView);
  
  // Para restaurar partidas pendientes
  const waitingMatch = useGameStore((state) => state.waitingMatch);
  const activeMatch = useGameStore((state) => state.activeMatch);
  const setWaitingMatch = useGameStore((state) => state.setWaitingMatch);
  const setActiveMatch = useGameStore((state) => state.setActiveMatch);
  const setCurrentMatchId = useGameStore((state) => state.setCurrentMatchId);
  const setPlayerSide = useGameStore((state) => state.setPlayerSide);
  const setMatchGoalTarget = useGameStore((state) => state.setMatchGoalTarget);
  const setMatchStatus = useGameStore((state) => state.setMatchStatus);

  // Detectar si hay wallet disponible
  useEffect(() => {
    const checkWallet = () => {
      const ethereum = (window as Window & { ethereum?: unknown }).ethereum;
      setHasWallet(!!ethereum);
    };
    checkWallet();
    // Re-check cuando la página vuelva a tener foco (por si el usuario instala MetaMask)
    window.addEventListener("focus", checkWallet);
    return () => window.removeEventListener("focus", checkWallet);
  }, []);

  // Generar URL para abrir en MetaMask Mobile
  const getMetaMaskDeepLink = () => {
    const currentUrl = window.location.href;
    return `https://metamask.app.link/dapp/${currentUrl.replace(/^https?:\/\//, "")}`;
  };

  const handleConnect = async () => {
    // Si no hay wallet, abrir MetaMask deep link en móvil
    if (!hasWallet) {
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (isMobile) {
        window.location.href = getMetaMaskDeepLink();
        return;
      }
    }
    
    setConnecting(true);
    setError(null);
    
    try {
      // Reset service in case of previous failed attempts
      xoConnectService.reset();
      await xoConnectService.init();
      const address = xoConnectService.getUserAddress();
      
      if (address && address !== "0x" + "0".repeat(40)) {
        setAlias(xoConnectService.getAlias());
        setBalance("Demo 15.2 XO");
        setUserAddress(address);
        toast.success("Wallet conectada", `${address.slice(0, 6)}...${address.slice(-4)}`);
        
        // Verificar si hay partida PENDIENTE para esta wallet
        if (waitingMatch && waitingMatch.creatorAddress?.toLowerCase() === address.toLowerCase()) {
          console.log("🔄 Restaurando partida en espera:", waitingMatch.matchId);
          try {
            const status = await checkMatchStatus(waitingMatch.matchId);
            if (status.hasChallenger) {
              toast.info("¡Tu partida comenzó!", "Un rival se unió mientras no estabas");
              setCurrentMatchId(String(waitingMatch.matchId));
              setPlayerSide("creator");
              setMatchGoalTarget(waitingMatch.goals);
              setMatchStatus("playing");
              setActiveMatch({
                matchId: String(waitingMatch.matchId),
                playerSide: "creator",
                goalTarget: waitingMatch.goals,
                userAddress: address
              });
              setWaitingMatch(undefined);
              setView("playing");
              return;
            } else {
              toast.info("Partida pendiente", "Sigues esperando un rival");
              setView("waiting");
              return;
            }
          } catch (err) {
            console.warn("Error verificando partida pendiente:", err);
            setWaitingMatch(undefined); // Limpiar partida inválida
          }
        }
        
        // Verificar si hay partida ACTIVA para esta wallet
        if (activeMatch && activeMatch.userAddress?.toLowerCase() === address.toLowerCase()) {
          console.log("🔄 Restaurando partida activa:", activeMatch.matchId);
          toast.info("Partida en curso", "Volviendo a tu partida");
          setCurrentMatchId(activeMatch.matchId);
          setPlayerSide(activeMatch.playerSide);
          setMatchGoalTarget(activeMatch.goalTarget);
          setMatchStatus("playing");
          setView("playing");
          return;
        }
        
        // No hay partida pendiente, ir al home
        setView("home");
      } else {
        setError("No se pudo obtener la dirección de la wallet");
      }
    } catch (err) {
      console.error("Error conectando wallet:", err);
      const message = err instanceof Error ? err.message : "Error desconocido";
      
      if (message.includes("-32002")) {
        setError("Abre MetaMask y aprueba la solicitud pendiente");
      } else if (message.includes("User rejected")) {
        setError("Rechazaste la conexión. Intenta de nuevo.");
      } else {
        setError("No se detectó wallet. Instala MetaMask o usa Beexo Wallet.");
      }
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="connect-screen">
      {/* Logo */}
      <div className="connect-logo">
        <img src={logoSvg} alt="Beexoccer" className="connect-logo-img" />
      </div>

      {/* Mensaje principal */}
      <div className="connect-content">
        <h1 className="connect-title">Conecta tu Wallet</h1>
        <p className="connect-subtitle">
          Necesitas una wallet para jugar partidas online y apostar cripto.
        </p>

        {/* Botón de conexión */}
        <button 
          className="connect-btn primary"
          onClick={handleConnect}
          disabled={connecting}
        >
          {connecting ? (
            <>
              <span className="connect-spinner">⏳</span>
              Conectando...
            </>
          ) : hasWallet ? (
            <>
              🦊 Conectar MetaMask
            </>
          ) : (
            <>
              📱 Abrir en MetaMask
            </>
          )}
        </button>

        {/* Error */}
        {error && (
          <div className="connect-error">
            <span className="connect-error-icon">⚠️</span>
            {error}
          </div>
        )}

        {/* Info adicional - diferente para móvil/desktop */}
        <div className="connect-info">
          {hasWallet === false ? (
            <>
              <p>No detectamos una wallet en este navegador.</p>
              <p style={{ marginTop: 8, fontSize: 13 }}>
                Si estás en celular, haz clic arriba para abrir en la app de MetaMask.
              </p>
              <a 
                href="https://metamask.io/download/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="connect-link"
                style={{ marginTop: 12, display: "inline-block" }}
              >
                Instalar MetaMask →
              </a>
            </>
          ) : (
            <>
              <p>¿No tienes wallet?</p>
              <a 
                href="https://metamask.io/download/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="connect-link"
              >
                Descargar MetaMask →
              </a>
            </>
          )}
        </div>

        {/* Botón para jugar sin wallet (solo bot) */}
        <button 
          className="connect-btn secondary"
          onClick={() => setView("createBot")}
        >
          🤖 Jugar contra Bot (sin wallet)
        </button>
      </div>

      {/* Footer */}
      <div className="connect-footer">
        <p>Red: Polygon Amoy Testnet</p>
      </div>
    </div>
  );
}
