import logo from "../assets/logo-placeholder.svg";
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
  const setView = useGameStore((state) => state.setView);

  return (
    <header className="top-nav">
      <div className="top-nav-logo">
        <img src={logo} alt="Beexoccer logo" />
        <div>
          <strong>Beexoccer</strong>
          <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.85rem" }}>Minijuego táctico 1 vs 1</p>
        </div>
      </div>
      <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
        <div>
          <div className="badge">Alias: <span style={{ color: "var(--neon-green)" }}>{alias}</span></div>
          <div className="badge" style={{ color: "var(--text-muted)" }}>Balance: {balance}</div>
        </div>
        <NeonButton label="Lobby" onClick={() => setView("home")} variant="secondary" />
        <NeonButton label="Vs Bot" onClick={onPlayBot} variant="primary" />
      </div>
    </header>
  );
}
