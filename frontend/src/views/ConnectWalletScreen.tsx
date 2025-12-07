import { useState } from "react";
import { xoConnectService } from "../services/xoConnectService";
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
      console.log("🐝 Iniciando conexión con Beexo via XO Connect...");
      
      // Conectar usando XO Connect
      const success = await xoConnectService.connect();
      
      if (!success) {
        setError(xoConnectService.getConnectionError() || "No se pudo conectar con Beexo Wallet");
        return;
      }
      
      const address = xoConnectService.getUserAddress();
      
      if (address && address !== "0x" + "0".repeat(40)) {
        setAlias(xoConnectService.getAlias());
        setBalance(xoConnectService.getTokenBalance("POL") + " POL");
        setUserAddress(address);
        toast.success("Beexo conectada", `${address.slice(0, 6)}...${address.slice(-4)}`);
        
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
            setWaitingMatch(undefined);
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
      console.error("❌ Error conectando wallet:", err);
      const message = err instanceof Error ? err.message : "Error desconocido";
      setError(message);
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

        {/* Botón de conexión con Beexo */}
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
          ) : (
            <>
              🐝 Conectar con Beexo
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

        {/* Info adicional */}
        <div className="connect-info">
          <p><strong>¿Cómo conectar?</strong></p>
          <p style={{ marginTop: 8, fontSize: 13 }}>
            📱 <strong>Celular:</strong> Abre este link desde la app Beexo Wallet<br />
            💻 <strong>PC:</strong> Copia el link y ábrelo en Beexo móvil
          </p>
          <a 
            href={BEEXO_DOWNLOAD_URL}
            target="_blank" 
            rel="noopener noreferrer"
            className="connect-link"
            style={{ marginTop: 12, display: "inline-block" }}
          >
            Descargar Beexo Wallet →
          </a>
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
        <p>Red: Polygon Amoy Testnet • Powered by XO Connect</p>
      </div>
    </div>
  );
}
