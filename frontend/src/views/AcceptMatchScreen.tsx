import { useEffect, useState } from "react";
import { Panel } from "../components/Panel";
import { MatchList } from "../components/MatchList";
import { fetchOpenMatches, acceptMatch } from "../services/matchService";
import { useGameStore } from "../hooks/useGameStore";
import { MatchLobby } from "../types/game";

/**
 * Lists open games awaiting a challenger. Includes wiring to the smart contract service and mock fallback.
 */
export function AcceptMatchScreen() {
  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState<MatchLobby[]>([]);
  const setView = useGameStore((state) => state.setView);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setMatches(await fetchOpenMatches());
      setLoading(false);
    })();
  }, []);

  const handleAccept = async (matchId: number) => {
    setLoading(true);
    const chosen = matches.find((item) => item.id === matchId);
    if (!chosen) return;
    try {
      await acceptMatch(matchId, chosen);
      alert("Te uniste a la partida. Saltamos directo al campo.");
      setView("playing");
    } catch (error) {
      console.error(error);
      alert("No pudimos unirnos. ¿La partida ya fue tomada?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Panel title="Partidas disponibles" subtitle="Acepta y ve directo al campo">
      <MatchList matches={matches} loading={loading} onAccept={handleAccept} />
    </Panel>
  );
}
