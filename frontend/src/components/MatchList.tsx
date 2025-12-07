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
            border: "2px solid rgba(109, 179, 138, 0.5)",
            borderRadius: "18px",
            padding: "1rem",
            background: "linear-gradient(135deg, rgba(5, 12, 8, 0.95) 0%, rgba(10, 26, 16, 0.85) 100%)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "1rem",
            transition: "all 0.2s ease",
            boxShadow: "0 12px 28px rgba(0,0,0,0.45)",
            cursor: "pointer"
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--neon-green)";
            e.currentTarget.style.transform = "translateY(-2px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "rgba(109, 179, 138, 0.5)";
            e.currentTarget.style.transform = "translateY(0)";
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
              <span style={{ fontSize: "1rem", color: "#f7c14d" }}>⛁ Stake</span>
              <span style={{ fontSize: "0.9rem", color: "var(--text-muted)" }}>👥 2</span>
              <span style={{ fontSize: "0.9rem", color: "var(--text-muted)" }}>🏆 Modo</span>
            </div>
            <p style={{ margin: 0, fontSize: "1rem", color: "var(--text-white)", fontWeight: 700 }}>
              Stake: {match.isFree ? "Gratis" : `${match.stakeAmount} MATIC`} <span style={{ color: "var(--text-muted)", marginLeft: "0.35rem" }}>Goles: {match.goals}</span>
            </p>
          </div>
          <NeonButton label="Unirse" onClick={() => void onAccept(match.id)} disabled={loading || !match.open} style={{ minWidth: "120px" }} />
        </article>
      ))}
    </div>
  );
}
