import { useEffect, useRef, useState } from "react";
import ballImg from "./assets/ball.png";

// Helper para animar favicon
function setAnimatedFavicon(isLoading: boolean) {
  const faviconId = "dynamic-favicon-loading";
  // Elimina todos los favicons existentes antes de agregar el nuestro
  document.querySelectorAll('link[rel="icon"]').forEach((el) => el.parentNode?.removeChild(el));
  let favicon = document.getElementById(faviconId) as HTMLLinkElement | null;
  if (!favicon) {
    favicon = document.createElement("link");
    favicon.id = faviconId;
    favicon.rel = "icon";
    document.head.appendChild(favicon);
  }
  if (isLoading) {
    let angle = 0;
    function animate() {
      const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 64 64'><g transform='rotate(${angle},32,32)'><circle cx='32' cy='32' r='30' fill='%2300ff6a' opacity='0.13'/><circle cx='32' cy='32' r='24' fill='%230a1a10' stroke='%2300ff6a' stroke-width='2'/><path d='M32 12 L38 20 L35 28 L29 28 L26 20 Z' fill='%2300ff6a' opacity='0.9'/><path d='M48 26 L52 34 L48 42 L40 40 L38 32 Z' fill='%2300ff6a' opacity='0.9'/><path d='M16 26 L26 32 L24 40 L16 42 L12 34 Z' fill='%2300ff6a' opacity='0.9'/><path d='M22 48 L30 44 L38 48 L36 56 L28 56 Z' fill='%2300ff6a' opacity='0.9'/></g></svg>`;
      favicon!.type = "image/svg+xml";
      favicon!.href = "data:image/svg+xml," + encodeURIComponent(svg);
      angle = (angle + 12) % 360;
      (window as any)._faviconAnimFrame = requestAnimationFrame(animate);
    }
    animate();
  } else {
    if ((window as any)._faviconAnimFrame) {
      cancelAnimationFrame((window as any)._faviconAnimFrame);
      (window as any)._faviconAnimFrame = null;
    }
    favicon!.type = "image/png";
    favicon!.href = "/favicon.png";
  }
}
import { useGameStore } from "./hooks/useGameStore";
import {
  AcceptMatchScreen,
  BotMatchScreen,
  CreateBotMatchScreen,
  CreateMatchScreen,
  HomeScreen,
  PlayingScreen,
  RankingScreen,
  TournamentsScreen,
  TeamSelectScreen,
  WaitingScreen
} from "./views";
import { NeedBeexoScreen } from "./views/NeedBeexoScreen";
import { walletService } from "./services/walletService";
import { ToastContainer, useToast, toast } from "./components/Toast";
import { RematchPopup } from "./components/RematchPopup";
import { cancelMatch, checkMatchStatus } from "./services/matchService";

export default function App() {
  // Estado de loading global (ajusta esto según tu lógica)
  const [isLoading, setIsLoading] = useState(false);
  useEffect(() => {
    setAnimatedFavicon(isLoading);
    return () => setAnimatedFavicon(false);
  }, [isLoading]);
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
  const setMatchMode = useGameStore((state) => state.setMatchMode);
  const setMatchDurationMs = useGameStore((state) => state.setMatchDurationMs);
  const setMatchStatus = useGameStore((state) => state.setMatchStatus);

  const { toasts, dismissToast } = useToast();

  const initRef = useRef(false);
  const toastShownRef = useRef(false);

  const [showConnectScreen, setShowConnectScreen] = useState(true);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  const isWalletConnected =
    userAddress &&
    userAddress !== "0x" + "0".repeat(40) &&
    userAddress !== "";

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    void (async () => {
      try {
        const existingType = await walletService.checkExistingConnection();

        if (existingType) {
          let success = false;
          if (existingType === "beexo") {
            success = await walletService.connectBeexo();
          } else if (existingType === "metamask") {
            success = await walletService.connectMetaMask();
          }

          if (success) {
            const address = walletService.getUserAddress();
            setAlias(walletService.getAlias());
            setBalance(walletService.getTokenBalance("POL") + " POL");
            setUserAddress(address);
            setShowConnectScreen(false);

            if (!toastShownRef.current) {
              toastShownRef.current = true;
              toast.success(
                "Wallet conectada",
                `${address.slice(0, 6)}...${address.slice(-4)}`
              );
            }

            await restorePendingMatches(address);
          }
        }

        setIsCheckingSession(false);
      } catch {
        setIsCheckingSession(false);
      }
    })();
  }, []);

  const restorePendingMatches = async (address: string) => {
    // Leer directamente de localStorage porque zustand persist puede no haber hidratado aún
    let storedWaitingMatch = waitingMatch;
    let storedActiveMatch = activeMatch;
    
    if (!storedWaitingMatch && !storedActiveMatch) {
      try {
        const stored = localStorage.getItem("beexoccer-session");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.state) {
            storedWaitingMatch = parsed.state.waitingMatch;
            storedActiveMatch = parsed.state.activeMatch;
          }
        }
      } catch (e) {
        console.warn("Error parsing stored session:", e);
      }
    }
    
    if (storedWaitingMatch) {
      // Verificar que la partida pertenece a este usuario
      if (storedWaitingMatch.creatorAddress?.toLowerCase() !== address.toLowerCase()) {
        console.log("Waiting match belongs to different user, clearing");
        setWaitingMatch(undefined);
        return;
      }
      
      const status = await checkMatchStatus(storedWaitingMatch.matchId);
      if (status.hasChallenger) {
        toast.info("¡Tu partida comenzó!", "Un rival se unió mientras no estabas");
        setCurrentMatchId(String(storedWaitingMatch.matchId));
        setPlayerSide("creator");
        setMatchGoalTarget(storedWaitingMatch.goals);
        if (storedWaitingMatch.mode) setMatchMode(storedWaitingMatch.mode);
        if (storedWaitingMatch.durationMs) setMatchDurationMs(storedWaitingMatch.durationMs);
        setMatchStatus("playing");
        setActiveMatch({
          matchId: String(storedWaitingMatch.matchId),
          playerSide: "creator",
          goalTarget: storedWaitingMatch.goals,
          mode: storedWaitingMatch.mode,
          durationMs: storedWaitingMatch.durationMs,
          userAddress: address
        });
        setWaitingMatch(undefined);
        setView("playing");
      } else {
        toast.info("Partida pendiente", "Sigues esperando un rival");
        setWaitingMatch(storedWaitingMatch); // Asegurar que esté en el store
        setView("waiting");
      }
    } else if (storedActiveMatch) {
      // Verificar que la partida pertenece a este usuario
      if (storedActiveMatch.userAddress?.toLowerCase() !== address.toLowerCase()) {
        console.log("Active match belongs to different user, clearing");
        setActiveMatch(undefined);
        return;
      }
      
      toast.info("Partida en curso", "Volviendo a tu partida");
      setCurrentMatchId(storedActiveMatch.matchId);
      setPlayerSide(storedActiveMatch.playerSide);
      setMatchGoalTarget(storedActiveMatch.goalTarget);
      if (storedActiveMatch.mode) setMatchMode(storedActiveMatch.mode);
      if (storedActiveMatch.durationMs) setMatchDurationMs(storedActiveMatch.durationMs);
      setMatchStatus("playing");
      setActiveMatch(storedActiveMatch); // Asegurar que esté en el store
      setView("playing");
    }
  };

  const handleConnected = () => {
    setShowConnectScreen(false);
    toast.success("Wallet conectada", walletService.getAlias());
  };

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (waitingMatch) {
        e.preventDefault();
        e.returnValue =
          "Tienes una partida esperando. Si sales, se cancelará.";
        cancelMatch(waitingMatch.matchId).catch(() => {});
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden" && waitingMatch) {
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


  // -------------------------------------------------------
  // 🎨 *** PANTALLA DE CARGA VERDE NEÓN — SVG INTEGRADO ***
  // -------------------------------------------------------

  const renderView = () => {
    if (isCheckingSession) {
      return (
        <div
          className="loading-screen"
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            overflow: "hidden",
            background:
              "radial-gradient(circle at center, #003b1f 0%, #001a0d 70%, #000 100%)"
          }}
        >
          {/* Glow de fondo */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(circle at 20% 30%, rgba(0,255,100,0.15) 0%, transparent 60%)," +
                "radial-gradient(circle at 80% 70%, rgba(0,255,140,0.12) 0%, transparent 65%)," +
                "radial-gradient(circle at 50% 50%, rgba(0,255,120,0.08) 0%, transparent 70%)",
              filter: "blur(40px)",
              zIndex: 1
            }}
          />

          <div style={{ textAlign: "center", zIndex: 2 }}>

            {/* ⭐ PELOTA PNG extraída del logo BEEXOCCER */}
            {/* Contenedor exterior para bounce */}
            <div
              style={{
                width: "120px",
                height: "120px",
                margin: "0 auto 1.5rem",
                animation: "bounce 1s ease-in-out infinite",
              }}
            >
              {/* Contenedor interior para spin */}
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  animation: "spin 2s linear infinite",
                  filter: "drop-shadow(0 0 25px rgba(0,255,120,0.7))"
                }}
              >
                <img 
                  src={ballImg} 
                  alt="Loading" 
                  style={{ width: "100%", height: "100%", objectFit: "contain" }} 
                />
              </div>
            </div>

            <div
              style={{
                color: "#00ff9d",
                fontSize: "1.4rem",
                letterSpacing: "1px",
                textShadow: "0 0 8px #00ff8a"
              }}
            >
              Cargando...
            </div>

            <style>
              {`
                @keyframes spin {
                  0% { transform: rotate(0deg); }
                  100% { transform: rotate(360deg); }
                }

                @keyframes bounce {
                  0%, 100% { transform: translateY(0); }
                  50% { transform: translateY(-40px); }
                }
              `}
            </style>
          </div>
        </div>
      );
    }

    // -------------------------------------------------------

    if (showConnectScreen || !isWalletConnected) {
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
      case "ranking":
        return <RankingScreen />;
      case "teamSelect":
        return <TeamSelectScreen />;
      case "tournaments":
        return <TournamentsScreen />;
      default:
        return <HomeScreen />;
    }
  };

  return (
    <>
      {renderView()}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <RematchPopup />
    </>
  );
}
