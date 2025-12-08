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
  const alias = useGameStore((state) => state.alias);
  const balance = useGameStore((state) => state.balance);
  const userAddress = useGameStore((state) => state.userAddress);
  const setView = useGameStore((state) => state.setView);

  const isConnected = userAddress && userAddress !== "0x" + "0".repeat(40);
  const shortAddress = isConnected 
    ? `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`
    : "No conectado";

  return (
    <header className="top-nav">
      <div className="top-nav-logo">
        {/* Pelota SVG estilo favicon/logo */}
        <svg width="28" height="28" viewBox="0 0 64 64" style={{ marginRight: 10 }} xmlns="http://www.w3.org/2000/svg">
          <circle cx="32" cy="32" r="30" fill="#00ff6a" opacity="0.13"/>
          <circle cx="32" cy="32" r="24" fill="#0a1a10" stroke="#00ff6a" strokeWidth="2"/>
          <path d="M32 12 L38 20 L35 28 L29 28 L26 20 Z" fill="#00ff6a" opacity="0.9"/>
          <path d="M48 26 L52 34 L48 42 L40 40 L38 32 Z" fill="#00ff6a" opacity="0.9"/>
          <path d="M16 26 L26 32 L24 40 L16 42 L12 34 Z" fill="#00ff6a" opacity="0.9"/>
          <path d="M22 48 L30 44 L38 48 L36 56 L28 56 Z" fill="#00ff6a" opacity="0.9"/>
        </svg>
        <div>
          <strong style={{ letterSpacing: "0.04em" }}>Beexoccer</strong>
          <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.85rem" }}>Fútbol de mesa 1 vs 1</p>
        </div>
      </div>
      <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
        <div>
          <div className="badge">
            <span style={{ color: isConnected ? "var(--neon-green)" : "var(--neon-yellow)" }}>
              {isConnected ? "🟢" : "🟡"} {shortAddress}
            </span>
          </div>
          <div className="badge">Alias: <span style={{ color: "var(--neon-green)" }}>{alias}</span></div>
          <div className="badge" style={{ color: "var(--text-muted)" }}>Balance: {balance}</div>
        </div>
        <NeonButton label="Lobby" onClick={() => setView("home")} variant="secondary" />
        <NeonButton label="Vs Bot" onClick={onPlayBot} variant="primary" />
      </div>
    </header>
  );
}
