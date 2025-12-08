import { useEffect, useRef, useState } from "react";
import { useGameStore } from "./hooks/useGameStore";
import {
  AcceptMatchScreen,
  BotMatchScreen,
  CreateBotMatchScreen,
  CreateMatchScreen,
  HomeScreen,
  PlayingScreen,
  WaitingScreen
} from "./views";
import { NeedBeexoScreen } from "./views/NeedBeexoScreen";
import { walletService } from "./services/walletService";
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
    if (waitingMatch) {
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
      toast.info("Partida en curso", "Volviendo a tu partida");
      setCurrentMatchId(activeMatch.matchId);
      setPlayerSide(activeMatch.playerSide);
      setMatchGoalTarget(activeMatch.goalTarget);
      setMatchStatus("playing");
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

            {/* ⭐ PELOTA SVG (no requiere archivo, siempre funciona) */}
            <div
              style={{
                width: "120px",
                height: "120px",
                margin: "0 auto 1.5rem",
                animation:
                  "bounce 1.6s ease-in-out infinite, spin 3s linear infinite",
                transformOrigin: "center",
                filter: "drop-shadow(0 0 25px rgba(0,255,120,0.7))"
              }}
            >
              <svg
                viewBox="0 0 100 100"
                style={{ width: "100%", height: "100%" }}
              >
                <circle cx="50" cy="50" r="47" fill="#e9e9e9" stroke="#00ff88" strokeWidth="3" />
                <path d="M50 8 L72 30 L62 55 L38 55 L28 30 Z" fill="#000" />
                <path d="M72 30 L90 45 L82 70 L62 55 Z" fill="#000" />
                <path d="M28 30 L10 45 L18 70 L38 55 Z" fill="#000" />
              </svg>
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
                  50% { transform: translateY(-22px); }
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
