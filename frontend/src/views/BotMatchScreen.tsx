import { useEffect } from "react";
import { Panel } from "../components/Panel";
import { PitchCanvas } from "../components/PitchCanvas";
import { useGameStore } from "../hooks/useGameStore";
import { TokenChip } from "../types/game";

const botChips: TokenChip[] = [
  { id: "bot-1", x: 220, y: 620, radius: 28, fill: "#00b870", flagEmoji: "🤖" },
  { id: "bot-2", x: 300, y: 680, radius: 28, fill: "#00b870", flagEmoji: "🤖" },
  { id: "bot-3", x: 380, y: 620, radius: 28, fill: "#00b870", flagEmoji: "🤖" }
];

/**
 * Quick scrimmage vs AI placeholder. The actual physics will evolve into a deterministic bot, but for now we animate
 * the user token and show guidance text.
 */
export function BotMatchScreen() {
  const setPlayingSnapshot = useGameStore((state) => state.setPlayingSnapshot);

  useEffect(() => {
    setPlayingSnapshot({
      activePlayer: "creator",
      turnEndsAt: Date.now() + 15_000,
      creatorScore: 0,
      challengerScore: 0,
      commentary: "Practica tiros y rebotes sin gastar XO",
      ball: { x: 300, y: 360 }
    } as any);
  }, [setPlayingSnapshot]);

  return (
    <Panel title="Modo Bot" subtitle="Ideal para onboarding en 30 segundos">
      <PitchCanvas chips={botChips} ball={{ x: 300, y: 360 }} highlightId="bot-2" />
      <ul style={{ marginTop: "1rem", color: "var(--text-muted)" }}>
        <li>Arrastra una ficha y suéltala para disparar.</li>
        <li>El bot responde instantáneamente con una potencia constante.</li>
        <li>Si fallas tu turno se descuenta y la posesión cambia.</li>
      </ul>
    </Panel>
  );
}
