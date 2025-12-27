import logo from "../assets/logo-beexoccer.svg";
import { NeonButton } from "./NeonButton";
import { useGameStore } from "../hooks/useGameStore";

interface TopNavProps {
  onPlayBot: () => void;
}

/**
 * Sticky navigation used on every screen. Shows the player's alias + balance pulled from XO-CONNECT.
 */
export function TopNav({ onPlayBot }: Readonly<TopNavProps>) {
  const balance = useGameStore((state) => state.balance);
  const userAddress = useGameStore((state) => state.userAddress);
  const setView = useGameStore((state) => state.setView);

  const isConnected = userAddress && userAddress !== "0x" + "0".repeat(40);
  const shortAddress = isConnected 
    ? `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`
    : "No conectado";

  return (
    <header className="top-nav" style={{ 
      display: "flex", 
      justifyContent: "space-between", 
      alignItems: "center", 
      padding: "1rem 2rem",
      background: "rgba(10, 26, 16, 0.95)",
      borderBottom: "1px solid rgba(17, 177, 58, 0.2)"
    }}>
      <div className="top-nav-logo" style={{ 
        display: "flex", 
        justifyContent: "center",
        alignItems: "center",
        flex: "0 0 auto",
        pointerEvents: "none"
      }}>
        <img src={logo} alt="Beexoccer" style={{ height: "50px", width: "auto", display: "block" }} />
      </div>
      <div style={{ 
        display: "flex", 
        gap: "1rem", 
        alignItems: "center",
        flex: 1,
        justifyContent: "flex-end"
      }}>
        <div>
          <div className="badge">
            <span style={{ color: isConnected ? "var(--neon-green)" : "var(--neon-yellow)" }}>
              {isConnected ? "🟢" : "🟡"} {shortAddress}
            </span>
          </div>
          <div className="badge" style={{ color: "var(--text-muted)" }}>Balance: {balance}</div>
        </div>
        <NeonButton label="Lobby" onClick={() => setView("home")} variant="secondary" />
        <NeonButton label="Vs Bot" onClick={onPlayBot} variant="primary" />
      </div>
    </header>
  );
}
