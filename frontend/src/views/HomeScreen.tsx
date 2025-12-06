import { NeonButton } from "../components/NeonButton";
import { Panel } from "../components/Panel";
import { useGameStore } from "../hooks/useGameStore";
import { MatchList } from "../components/MatchList";
import logo from "../assets/logo-placeholder.svg";

export function HomeScreen() {
  const setView = useGameStore((state) => state.setView);
  const appendMockMatch = useGameStore((state) => state.appendMockMatch);
  const matches = useGameStore((state) => state.pendingMatches);

  const noMatches = matches.length === 0;

  return (
    <div className="app-panels">
      <Panel title="Beexoccer" subtitle="Fútbol de mesa 1v1 en tiempo real">
        <div style={{ display: "flex", gap: "1.25rem", alignItems: "center" }}>
          <img src={logo} alt="Beexoccer" style={{ width: 88, height: 88 }} />
          <div>
            <p style={{ marginTop: "0.35rem", color: "var(--text-muted)" }}>
              Arrastra, apunta y dispara sobre una cancha metálica. Juega gratis o con apuesta en Polygon con turnos de 15s y rebotes elásticos.
            </p>
            <div className="badge-row" style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.35rem" }}>
              <span className="badge">Tiempo real con sockets</span>
              <span className="badge">Gratis o escrow</span>
              <span className="badge">2 / 3 / 5 goles</span>
            </div>
          </div>
        </div>
        <div className="button-grid" style={{ marginTop: "1rem" }}>
          <NeonButton label="Crear partida gratis" onClick={() => setView("create")} fullWidth />
          <NeonButton label="Crear partida con apuesta" onClick={() => setView("create")} fullWidth variant="secondary" />
          <NeonButton label="Ver lobbies" onClick={() => setView("accept")} fullWidth />
          <NeonButton label="Jugar con Bot" onClick={() => setView("bot")} fullWidth variant="secondary" />
        </div>
      </Panel>

      <Panel title="Lobbies abiertos" subtitle="Únete o crea uno al vuelo">
        {noMatches ? (
          <div className="empty-state">
            <p>No hay partidas disponibles ahora mismo.</p>
            <p style={{ color: "var(--text-muted)", marginTop: "0.35rem" }}>Crea una sala o vuelve a consultar en unos segundos.</p>
            <div className="button-grid" style={{ marginTop: "0.75rem" }}>
              <NeonButton label="Crear partida" onClick={() => setView("create")} fullWidth />
              <NeonButton label="Añadir lobby demo" onClick={appendMockMatch} fullWidth variant="secondary" />
            </div>
          </div>
        ) : (
          <MatchList
            matches={matches}
            loading={false}
            onAccept={async (id) => {
              setView("accept");
            }}
          />
        )}
      </Panel>

      <Panel title="Cómo se gana" subtitle="2, 3 o 5 goles">
        <p>Turnos de 15s, rebotes elásticos y gol cuando la pelota cruza el rectángulo del arco rival.</p>
      </Panel>

      <Panel title="Economía" subtitle="Gratis o con escrow en Polygon">
        <p>Si habilitas apuesta, el escrow vive en el contrato MatchManager. Al finalizar, ambos reportan o se verifica on-chain.</p>
      </Panel>
    </div>
  );
}
