import { useState } from "react";
import { walletService } from "../services/walletService";
import { useGameStore } from "../hooks/useGameStore";
import { checkMatchStatus } from "../services/matchService";
import { toast } from "../components/Toast";
import logoSvg from "../assets/logo.svg";

// URL de descarga de Beexo
const BEEXO_DOWNLOAD_URL = "https://share.beexo.com/?type=download";

export function ConnectWalletScreen() {
  const [connecting, setConnecting] = useState<"beexo" | "metamask" | null>(null);
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

  const handleAfterConnect = async (address: string) => {
    setAlias(walletService.getAlias());
    setBalance(walletService.getTokenBalance("POL") + " POL");
    setUserAddress(address);
    toast.success("Wallet conectada", `${address.slice(0, 6)}...${address.slice(-4)}`);
    
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
  };

  const handleConnectBeexo = async () => {
    setConnecting("beexo");
    setError(null);
    
    try {
      const success = await walletService.connectBeexo();
      
      if (!success) {
        setError(walletService.getConnectionError() || "No se pudo conectar con Beexo Wallet");
        return;
      }
      
      const address = walletService.getUserAddress();
      
      if (address && address !== "0x" + "0".repeat(40)) {
        await handleAfterConnect(address);
      } else {
        setError("No se pudo obtener la dirección de la wallet");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      setError(message);
    } finally {
      setConnecting(null);
    }
  };

  const handleConnectMetaMask = async () => {
    setConnecting("metamask");
    setError(null);
    
    try {
      const success = await walletService.connectMetaMask();
      
      if (!success) {
        setError(walletService.getConnectionError() || "No se pudo conectar con MetaMask");
        return;
      }
      
      const address = walletService.getUserAddress();
      
      if (address && address !== "0x" + "0".repeat(40)) {
        await handleAfterConnect(address);
      } else {
        setError("No se pudo obtener la dirección de la wallet");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      setError(message);
    } finally {
      setConnecting(null);
    }
  };

  return (
    <div className="connect-screen" style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '20px',
      background: 'linear-gradient(180deg, #0a1a0a 0%, #0d2818 50%, #0a1a0a 100%)'
    }}>
      {/* Logo centrado */}
      <div style={{ marginBottom: 24, textAlign: 'center' }}>
        <img src={logoSvg} alt="Beexoccer" style={{ width: 220, height: 'auto' }} />
      </div>

      {/* Título */}
      <h1 style={{ 
        fontSize: '1.6rem', 
        fontWeight: 700, 
        margin: '0 0 8px 0', 
        color: '#fff', 
        textAlign: 'center',
        textTransform: 'uppercase',
        letterSpacing: '0.05em'
      }}>
        Conectá tu <span style={{ color: '#00ff6a' }}>Wallet</span>
      </h1>
      <p style={{ color: '#888', fontSize: '0.95rem', margin: '0 0 24px 0', textAlign: 'center' }}>
        Elegí cómo conectar para jugar partidas online
      </p>

      {/* Botones de conexión */}
      <div style={{ width: '100%', maxWidth: 340 }}>
        {/* Beexo Button */}
        <button
          onClick={handleConnectBeexo}
          disabled={connecting !== null}
          style={{
            width: '100%',
            padding: '14px 20px',
            fontSize: '1rem',
            fontWeight: 600,
            borderRadius: 12,
            border: 'none',
            background: 'linear-gradient(135deg, #00ff6a 0%, #00cc55 100%)',
            color: '#000',
            cursor: connecting ? 'wait' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            marginBottom: 12,
            opacity: connecting === "metamask" ? 0.6 : 1
          }}
        >
          <img src="/beexo.png" alt="Beexo" style={{ width: 24, height: 24 }} />
          {connecting === "beexo" ? "CONECTANDO..." : "CONECTAR CON BEEXO"}
        </button>

        {/* MetaMask Button */}
        <button
          onClick={handleConnectMetaMask}
          disabled={connecting !== null}
          style={{
            width: '100%',
            padding: '14px 20px',
            fontSize: '1rem',
            fontWeight: 600,
            borderRadius: 12,
            border: 'none',
            background: 'linear-gradient(135deg, #f6851b 0%, #e2761b 100%)',
            color: '#fff',
            cursor: connecting ? 'wait' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            marginBottom: 20,
            opacity: connecting === "beexo" ? 0.6 : 1
          }}
        >
          🦊
          {connecting === "metamask" ? "CONECTANDO..." : "CONECTAR CON METAMASK"}
        </button>

        {/* Wallet info cards */}
        <div style={{
          background: 'rgba(255,255,255,0.05)',
          borderRadius: 12,
          padding: '14px 16px',
          marginBottom: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          border: '1px solid rgba(255,255,255,0.1)'
        }}>
          <img src="/beexo.png" alt="Beexo" style={{ width: 28, height: 28 }} />
          <div>
            <div style={{ color: '#fff', fontWeight: 600, fontSize: '0.95rem' }}>Beexo Wallet</div>
            <div style={{ color: '#888', fontSize: '0.8rem' }}>Tu alias aparece en el juego</div>
          </div>
        </div>

        <div style={{
          background: 'rgba(255,255,255,0.05)',
          borderRadius: 12,
          padding: '14px 16px',
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          border: '1px solid rgba(255,255,255,0.1)'
        }}>
          <span style={{ fontSize: '1.5rem' }}>🦊</span>
          <div>
            <div style={{ color: '#fff', fontWeight: 600, fontSize: '0.95rem' }}>MetaMask</div>
            <div style={{ color: '#888', fontSize: '0.8rem' }}>Tu dirección abreviada como alias</div>
          </div>
        </div>

        {error && (
          <div style={{ 
            marginBottom: 16, 
            textAlign: 'center', 
            color: '#ff4444', 
            fontSize: '0.9rem',
            padding: '10px',
            background: 'rgba(255,68,68,0.1)',
            borderRadius: 8
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* Download link */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <span style={{ color: '#888', fontSize: '0.9rem' }}>¿No tenés wallet?</span>
          <br />
          <a
            href={BEEXO_DOWNLOAD_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#00ff6a', fontWeight: 500, fontSize: '0.95rem', textDecoration: 'none' }}
          >
            Descargar Beexo →
          </a>
        </div>

        {/* Divider */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          margin: '16px 0',
          gap: 12
        }}>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.2)' }} />
          <span style={{ color: '#888', fontSize: '0.85rem' }}>o bien</span>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.2)' }} />
        </div>

        {/* Bot button */}
        <button
          onClick={() => setView("createBot")}
          style={{
            width: '100%',
            padding: '14px 20px',
            fontSize: '0.95rem',
            fontWeight: 500,
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.2)',
            background: 'rgba(255,255,255,0.05)',
            color: '#fff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8
          }}
        >
          🤖 Jugar contra el Bot (sin wallet)
        </button>
      </div>

      {/* Footer */}
      <div style={{ marginTop: 30, fontSize: '0.85rem', color: '#666', textAlign: 'center' }}>
        Red: Polygon Mainnet
      </div>
    </div>
  );
}
