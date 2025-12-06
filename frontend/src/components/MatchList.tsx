import { MatchLobby } from "../types/game";
import { NeonButton } from "./NeonButton";

interface MatchListProps {
  matches: MatchLobby[];
  loading?: boolean;
  onAccept: (matchId: number) => Promise<void>;
}

/**
 * Renders open lobbies with CTA to accept a match. Used by the AcceptMatchScreen.
 */
export function MatchList({ matches, loading, onAccept }: Readonly<MatchListProps>) {
  if (!matches.length) {
    return (
      <div style={{ textAlign: "center", padding: "2rem 0" }}>
        <div style={{ fontSize: "3rem", opacity: 0.3, marginBottom: "1rem" }}>⚽</div>
        <p style={{ color: "var(--text-muted)" }}>No hay partidas disponibles. Refresca en unos segundos.</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
      {matches.map((match) => (
        <article
          key={match.id}
          style={{
            border: "2px solid var(--ui-border)",
            borderRadius: "16px",
            padding: "1.25rem",
            background: "linear-gradient(135deg, rgba(10, 24, 12, 0.85) 0%, rgba(6, 48, 18, 0.7) 100%)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "1rem",
            transition: "all 0.2s ease",
            cursor: "pointer"
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--neon-green)";
            e.currentTarget.style.transform = "translateY(-2px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--ui-border)";
            e.currentTarget.style.transform = "translateY(0)";
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.35rem" }}>
              <span style={{ fontSize: "1.2rem" }}>⚽</span>
              <strong style={{ fontSize: "1.05rem" }}>Partida #{match.id}</strong>
            </div>
            <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--text-muted)" }}>
              {match.isFree ? (
                <span style={{ color: "var(--neon-green)" }}>🎮 Gratis</span>
              ) : (
                <span style={{ color: "var(--accent-amber)" }}>💎 {match.stakeAmount} XO escrow</span>
              )} • 🎯 {match.goals} goles
            </p>
            {!match.isFree && (
              <p style={{ margin: "0.25rem 0 0", fontSize: "0.75rem", color: "var(--text-muted)", fontFamily: "monospace" }}>
                Token: {match.stakeToken.slice(0, 6)}...{match.stakeToken.slice(-4)}
              </p>
            )}
          </div>
          <NeonButton label="⚔️ Unirse" onClick={() => void onAccept(match.id)} disabled={loading || !match.open} />
        </article>
      ))}
    </div>
  );
}
