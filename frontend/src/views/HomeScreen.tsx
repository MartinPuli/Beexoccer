import { NeonButton } from "../components/NeonButton";
import { Panel } from "../components/Panel";
import { useGameStore } from "../hooks/useGameStore";

/**
 * Landing experience referencing Beexo's dark UI. Presents quick actions to jump into each mode.
 */
export function HomeScreen() {
  const setView = useGameStore((state) => state.setView);
  const appendMockMatch = useGameStore((state) => state.appendMockMatch);

  return (
    <div className="app-panels">
      <Panel title="Tu identidad Beexo" subtitle="Alias y control XO-CONNECT">
        <div className="button-grid">
          <NeonButton label="Crear partida" onClick={() => setView("create")} fullWidth />
          <NeonButton label="Aceptar partida" onClick={() => setView("accept")} fullWidth variant="secondary" />
          <NeonButton label="Jugar con Bot" onClick={() => setView("bot")} fullWidth />
          <NeonButton label="Añadir lobby demo" onClick={appendMockMatch} fullWidth variant="secondary" />
        </div>
      </Panel>
      <Panel title="Modo 1 vs 1" subtitle="Multiplayer XO-CONNECT con escrow en Polygon">
        <p>
          Configura una partida con 2, 3 o 5 goles, define si quieres apuesta y firma con XO-CONNECT. Las apuestas viven en un escrow del
          contrato <code>MatchManager</code> hasta que reportes el ganador.
        </p>
      </Panel>
      <Panel title="Modo Bot" subtitle="Gratis y listo en segundos">
        <p>
          Practica tiros con física sencilla, rebotes precisos y turnos de 15 segundos. Ideal para onboarding antes de apostar tokens XO u
          otros activos Polygon.
        </p>
      </Panel>
    </div>
  );
}
