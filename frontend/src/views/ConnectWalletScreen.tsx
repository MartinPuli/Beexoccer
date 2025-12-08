import { useState } from "react";
import { walletService } from "../services/walletService";
import { useGameStore } from "../hooks/useGameStore";
import { checkMatchStatus } from "../services/matchService";
import { toast } from "../components/Toast";
import logoSvg from "../assets/logo.svg";

// URL de descarga de Beexo
const BEEXO_DOWNLOAD_URL = "https://share.beexo.com/?type=download";

export function ConnectWalletScreen() {
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
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

  const handleConnect = async () => {
    setConnecting(true);
    setError(null);
    
    try {
      // Conectar usando Beexo Wallet
      const success = await walletService.connectBeexo();
      
      if (!success) {
        setError(walletService.getConnectionError() || "No se pudo conectar con Beexo Wallet");
        return;
      }
      
      const address = walletService.getUserAddress();
      
      if (address && address !== "0x" + "0".repeat(40)) {
        setAlias(walletService.getAlias());
        setBalance(walletService.getTokenBalance("POL") + " POL");
        setUserAddress(address);
        toast.success("Beexo conectada", `${address.slice(0, 6)}...${address.slice(-4)}`);
        
        // Verificar si hay partida PENDIENTE para esta wallet
        if (waitingMatch && waitingMatch.creatorAddress?.toLowerCase() === address.toLowerCase()) {
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
          } catch {
            setWaitingMatch(undefined);
          }
        }
        
        // Verificar si hay partida ACTIVA para esta wallet
        if (activeMatch && activeMatch.userAddress?.toLowerCase() === address.toLowerCase()) {
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
      const message = err instanceof Error ? err.message : "Error desconocido";
      setError(message);
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="connect-screen">
      <div className="connect-logo" style={{ marginBottom: 32 }}>
        <img src={logoSvg} alt="Beexoccer" style={{ width: 68, height: 68, opacity: 0.92 }} />
      </div>
      <div className="connect-content" style={{ maxWidth: 350, margin: '0 auto', background: 'none', boxShadow: 'none', padding: 0 }}>
        <h1 style={{ fontSize: '1.55rem', fontWeight: 700, margin: '0 0 18px 0', color: '#ffe45b', letterSpacing: '.01em', textAlign: 'center' }}>
          Conectá tu Beexo Wallet
        </h1>
        <p style={{ color: '#888', fontSize: '1.02rem', margin: '0 0 32px 0', textAlign: 'center' }}>
          Para jugar online y apostar cripto necesitas conectar tu wallet.
        </p>
        <button
          className="connect-btn primary"
          onClick={handleConnect}
          disabled={connecting}
          style={{ width: '100%', marginBottom: 22, padding: '13px 0', fontSize: '1.07rem', borderRadius: 12, boxShadow: 'none' }}
        >
          {connecting ? (
            <span><span className="connect-spinner">⏳</span> Conectando...</span>
          ) : (
            <span>🐝 Conectar con Beexo</span>
          )}
        </button>
        {error && (
          <div className="connect-error" style={{ marginBottom: 18, textAlign: 'center', color: '#e74c3c', fontSize: '1rem' }}>
            <span className="connect-error-icon">⚠️</span> {error}
          </div>
        )}
        <a
          href={BEEXO_DOWNLOAD_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="connect-link"
          style={{ display: 'block', textAlign: 'center', fontWeight: 500, color: '#ffe45b', marginBottom: 30, fontSize: '1.01rem', textDecoration: 'none' }}
        >
          ¿No tenés Beexo Wallet? Descargala gratis
        </a>
        <div className="or-divider" style={{ margin: '18px 0', textAlign: 'center', color: '#bbb', fontSize: '1.09rem', letterSpacing: '.1em' }}>
          <span>o</span>
        </div>
        <button
          className="connect-btn secondary"
          onClick={() => setView("createBot")}
          style={{ width: '100%', padding: '13px 0', fontSize: '1.07rem', borderRadius: 12, background: 'none', border: '1.5px solid #ffe45b', color: '#ffe45b', marginBottom: 8, boxShadow: 'none' }}
        >
          🤖 Jugar contra el Bot (sin wallet)
        </button>
      </div>
      <div className="connect-footer" style={{ marginTop: 40, fontSize: '0.98rem', color: '#aaa', textAlign: 'center', letterSpacing: '.02em' }}>
        <p>Polygon Amoy Testnet • XO Connect</p>
      </div>
    </div>
  );
}
