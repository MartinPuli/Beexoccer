import { useEffect, useRef, useState } from "react";
import { useGameStore } from "./hooks/useGameStore";
import { AcceptMatchScreen, BotMatchScreen, CreateBotMatchScreen, CreateMatchScreen, HomeScreen, PlayingScreen, WaitingScreen } from "./views";
import { NeedBeexoScreen } from "./views/NeedBeexoScreen";
import { xoConnectService } from "./services/xoConnectService";
import { ToastContainer, useToast, toast } from "./components/Toast";
import { cancelMatch, checkMatchStatus } from "./services/matchService";

export default function App() {
  const view = useGameStore((state) => state.view);
  const setView = useGameStore((state) => state.setView);
  const setAlias = useGameStore((state) => state.setAlias);
  const setBalance = useGameStore((state) => state.setBalance);
  const userAddress = useGameStore((state) => state.userAddress);
  const setUserAddress = useGameStore((state) => state.setUserAddress);
  const waitingMatch = useGameStore((state) => state.waitingMatch);
  const activeMatch = useGameStore((state) => state.activeMatch);
  const setWaitingMatch = useGameStore((state) => state.setWaitingMatch);
  const setActiveMatch = useGameStore((state) => state.setActiveMatch);
  const setCurrentMatchId = useGameStore((state) => state.setCurrentMatchId);
  const setPlayerSide = useGameStore((state) => state.setPlayerSide);
  const setMatchGoalTarget = useGameStore((state) => state.setMatchGoalTarget);
  const setMatchStatus = useGameStore((state) => state.setMatchStatus);
  const { toasts, dismissToast } = useToast();
  
  const initRef = useRef(false);
  const toastShownRef = useRef(false);
  
  // Estado para mostrar pantalla de conexión
  const [showConnectScreen, setShowConnectScreen] = useState(true);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  // Verificar si tiene wallet conectada
  const isWalletConnected = userAddress && userAddress !== "0x" + "0".repeat(40) && userAddress !== "";

  // Inicialización - verificar si hay sesión existente
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    
    void (async () => {
      console.log("🚀 Inicializando app con XO Connect...");
      try {
        // Verificar si hay sesión existente
        const existingSession = await xoConnectService.checkExistingConnection();
        console.log("🔍 Sesión existente:", existingSession);
        
        if (existingSession) {
          // Hay sesión - intentar reconectar
          console.log("🔄 Reconectando sesión existente...");
          const success = await xoConnectService.connect();
          
          if (success) {
            const address = xoConnectService.getUserAddress();
            setAlias(xoConnectService.getAlias());
            setBalance(xoConnectService.getTokenBalance("POL") + " POL");
            setUserAddress(address);
            setShowConnectScreen(false);
            
            if (!toastShownRef.current) {
              toastShownRef.current = true;
              toast.success("Beexo Wallet conectada", `${address.slice(0, 6)}...${address.slice(-4)}`);
            }
            
            // Restaurar partidas pendientes
            await restorePendingMatches(address);
          }
        }
        
        setIsCheckingSession(false);
      } catch (error) {
        console.error("❌ Error verificando sesión:", error);
        setIsCheckingSession(false);
      }
    })();
  }, []);

  // Restaurar partidas pendientes
  const restorePendingMatches = async (address: string) => {
    if (waitingMatch) {
      console.log("🔄 Restaurando partida en espera:", waitingMatch.matchId);
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
      } else {
        toast.info("Partida pendiente", "Sigues esperando un rival");
        setView("waiting");
      }
    } else if (activeMatch) {
      console.log("🔄 Restaurando partida activa:", activeMatch.matchId);
      toast.info("Partida en curso", "Volviendo a tu partida");
      setCurrentMatchId(activeMatch.matchId);
      setPlayerSide(activeMatch.playerSide);
      setMatchGoalTarget(activeMatch.goalTarget);
      setMatchStatus("playing");
      setView("playing");
    }
  };

  // Callback cuando se conecta exitosamente
  const handleConnected = () => {
    setShowConnectScreen(false);
    toast.success("Beexo Wallet conectada", xoConnectService.getAlias());
  };

  // Cancelar partida en espera cuando el usuario cierra la página
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (waitingMatch) {
        // Mostrar advertencia
        e.preventDefault();
        e.returnValue = "Tienes una partida esperando. Si sales, se cancelará.";
        
        // Intentar cancelar la partida (puede no completarse)
        // Nota: En un sistema real, el servidor debería manejar esto con timeouts
        cancelMatch(waitingMatch.matchId).catch(console.warn);
      }
    };
    
    const handleVisibilityChange = () => {
      // Cuando la página se oculta (cierra pestaña, cambia de app en móvil)
      if (document.visibilityState === "hidden" && waitingMatch) {
        // Guardar timestamp para verificar timeout al volver
        localStorage.setItem("beexoccer-hide-time", String(Date.now()));
      }
    };
    
    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [waitingMatch]);

  const renderView = () => {
    // Si está verificando sesión, mostrar loading
    if (isCheckingSession) {
      return (
        <div className="loading-screen" style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0a0a12 0%, #1a1a2e 50%, #0f0f23 100%)',
          color: '#FFC800',
          fontSize: '1.5rem'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🐝</div>
            <div>Cargando...</div>
          </div>
        </div>
      );
    }
    
    // Si no hay wallet conectada, mostrar pantalla de conexión con XO Connect
    if (showConnectScreen || !isWalletConnected) {
      // Excepto para bot mode que no requiere wallet
      if (view !== "bot" && view !== "createBot") {
        return <NeedBeexoScreen onConnected={handleConnected} />;
      }
    }
    
    switch (view) {
      case "connect":
        return <NeedBeexoScreen onConnected={handleConnected} />;
      case "create":
        return <CreateMatchScreen />;
      case "createBot":
        return <CreateBotMatchScreen />;
      case "accept":
        return <AcceptMatchScreen />;
      case "playing":
        return <PlayingScreen />;
      case "bot":
        return <BotMatchScreen />;
      case "waiting":
        return <WaitingScreen />;
      default:
        return <HomeScreen />;
    }
  };

  return (
    <>
      {renderView()}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
