import { useEffect, useRef } from "react";
import { useGameStore } from "./hooks/useGameStore";
import { AcceptMatchScreen, BotMatchScreen, CreateBotMatchScreen, CreateMatchScreen, HomeScreen, PlayingScreen, WaitingScreen, ConnectWalletScreen } from "./views";
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
  const toastShownRef = useRef(false); // Evitar toasts dobles

  // Verificar si tiene wallet conectada
  const isWalletConnected = userAddress && userAddress !== "0x" + "0".repeat(40) && userAddress !== "";

  // Inicialización - intentar recuperar sesión existente
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    
    void (async () => {
      console.log("🚀 Inicializando app...");
      try {
        // Verificar si hay wallet instalada
        const hasWallet = !!(globalThis as Window & typeof globalThis).ethereum;
        if (!hasWallet) {
          console.log("⚠️ No hay wallet detectada");
          setView("connect");
          return;
        }

        // Verificar si ya hay conexión existente SIN pedir permiso
        const existingAddress = await xoConnectService.checkExistingConnection();
        console.log("🔍 Conexión existente:", existingAddress);
        
        if (!existingAddress) {
          // No hay conexión previa - mostrar pantalla de conexión
          console.log("📱 No hay conexión previa, mostrando pantalla de conexión");
          setView("connect");
          return;
        }
        
        // Hay conexión existente - inicializar completamente
        await xoConnectService.init();
        const address = xoConnectService.getUserAddress();
        console.log("📍 Dirección obtenida:", address);
        
        setAlias(xoConnectService.getAlias());
        setBalance("Demo 15.2 XO");
        setUserAddress(address);
        
        // Mostrar toast de conexión solo una vez
        if (!toastShownRef.current) {
          toastShownRef.current = true;
          toast.success("Wallet conectada", `${address.slice(0, 6)}...${address.slice(-4)}`);
        }
        
        // Restaurar sesión si hay partida pendiente
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
      } catch (error) {
        console.error("Error inicializando:", error);
        setView("connect");
      }
    })();
  }, [setAlias, setBalance, setUserAddress, waitingMatch, activeMatch, setView, setCurrentMatchId, setPlayerSide, setMatchGoalTarget, setMatchStatus, setWaitingMatch, setActiveMatch]);

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
    // Si no hay wallet y no está en bot/createBot, forzar conexión
    if (!isWalletConnected && view !== "bot" && view !== "createBot" && view !== "connect") {
      return <ConnectWalletScreen />;
    }
    
    switch (view) {
      case "connect":
        return <ConnectWalletScreen />;
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
