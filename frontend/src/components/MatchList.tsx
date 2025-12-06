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
    return <p>No hay partidas disponibles. Refresca en unos segundos.</p>;
  }

  return (
    <div>
      {matches.map((match) => (
        <article key={match.id} className="match-card">
          <div>
            <strong>Partida #{match.id}</strong>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-muted)" }}>
              {match.isFree ? "Gratis" : `${match.stakeAmount} XO stake`} • {match.goals} goles
            </p>
          </div>
          <NeonButton label="Aceptar" onClick={() => onAccept(match.id)} disabled={loading || !match.open} />
        </article>
      ))}
    </div>
  );
}
