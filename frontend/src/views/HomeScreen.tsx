import { NeonButton } from "../components/NeonButton";
import { Panel } from "../components/Panel";
import { useGameStore } from "../hooks/useGameStore";
import { MatchList } from "../components/MatchList";
import logo from "../assets/logo-beexoccer.svg";

export function HomeScreen() {
  const setView = useGameStore((state) => state.setView);
  const matches = useGameStore((state) => state.pendingMatches);

  const noMatches = matches.length === 0;
  const partidaText = matches.length === 1 ? 'partida' : 'partidas';
  const disponibleText = matches.length === 1 ? 'disponible' : 'disponibles';
  const matchesSubtitle = noMatches
    ? "No hay partidas ahora"
    : `${matches.length} ${partidaText} ${disponibleText}`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {/* Hero section */}
      <div style={{
        background: "linear-gradient(135deg, rgba(15, 127, 36, 0.15) 0%, rgba(17, 177, 58, 0.08) 100%)",
        border: "2px solid var(--ui-border)",
        borderRadius: "28px",
        padding: "2.5rem 2rem",
        textAlign: "center",
        position: "relative",
        overflow: "hidden"
      }}>
        <div style={{
          position: "absolute",
          top: "-20%",
          right: "-10%",
          width: "300px",
          height: "300px",
          background: "radial-gradient(circle, rgba(17, 177, 58, 0.2), transparent 70%)",
          borderRadius: "50%",
          filter: "blur(60px)"
        }} />
        <img src={logo} alt="Beexoccer" style={{ width: 180, height: 50, marginBottom: "1.5rem", filter: "drop-shadow(0 4px 12px rgba(17, 177, 58, 0.4))" }} />
        <h1 style={{ fontSize: "2.2rem", margin: "0 0 0.75rem", fontWeight: 700, letterSpacing: "-0.02em", background: "linear-gradient(120deg, #11b13a, #0f7f24)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          Fútbol de Mesa Blockchain
        </h1>
        <p style={{ fontSize: "1.15rem", color: "var(--text-muted)", maxWidth: "620px", margin: "0 auto 1.75rem", lineHeight: 1.6 }}>
          Arrastra tus fichas, apunta y dispara. Compite 1v1 en tiempo real con apuestas en Polygon o juega gratis contra bots.
        </p>
        <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap", marginBottom: "1.5rem" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 1rem", background: "rgba(17, 177, 58, 0.15)", borderRadius: "999px", fontSize: "0.9rem", fontWeight: 600 }}>
            ⚡ Tiempo real
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 1rem", background: "rgba(17, 177, 58, 0.15)", borderRadius: "999px", fontSize: "0.9rem", fontWeight: 600 }}>
            💰 Apuestas XO
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 1rem", background: "rgba(17, 177, 58, 0.15)", borderRadius: "999px", fontSize: "0.9rem", fontWeight: 600 }}>
            ⚽ 2/3/5 goles
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.85rem", maxWidth: "700px", margin: "0 auto" }}>
          <NeonButton label="🎮 Jugar con Bot" onClick={() => setView("bot")} fullWidth />
          <NeonButton label="⚔️ Crear partida" onClick={() => setView("create")} fullWidth variant="secondary" />
        </div>
      </div>

      {/* Action cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.5rem" }}>
        <Panel title="🏆 Lobbies Activos" subtitle={matchesSubtitle}>
          {noMatches ? (
            <div style={{ textAlign: "center", padding: "1.5rem 0" }}>
              <div style={{ fontSize: "3rem", marginBottom: "1rem", opacity: 0.3 }}>⚽</div>
              <p style={{ color: "var(--text-muted)", marginBottom: "1.25rem" }}>Sé el primero en crear una partida épica</p>
              <NeonButton label="Crear partida" onClick={() => setView("create")} fullWidth />
            </div>
          ) : (
            <>
              <MatchList
                matches={matches}
                loading={false}
                onAccept={async (id) => {
                  setView("accept");
                }}
              />
              <div style={{ marginTop: "1rem" }}>
                <NeonButton label="Ver todos" onClick={() => setView("accept")} fullWidth variant="secondary" />
              </div>
            </>
          )}
        </Panel>

        <Panel title="⚡ Juego Rápido" subtitle="Elige tu modo">
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ padding: "1.25rem", background: "rgba(17, 177, 58, 0.08)", borderRadius: "16px", border: "1px solid rgba(17, 177, 58, 0.2)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
                <span style={{ fontSize: "1.5rem" }}>🎯</span>
                <strong style={{ fontSize: "1.05rem" }}>Partida Gratis</strong>
              </div>
              <p style={{ fontSize: "0.9rem", color: "var(--text-muted)", margin: "0 0 1rem" }}>Sin riesgo, pura diversión y práctica</p>
              <NeonButton label="Crear gratis" onClick={() => setView("create")} fullWidth variant="secondary" />
            </div>
            <div style={{ padding: "1.25rem", background: "rgba(247, 193, 77, 0.08)", borderRadius: "16px", border: "1px solid rgba(247, 193, 77, 0.25)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
                <span style={{ fontSize: "1.5rem" }}>💎</span>
                <strong style={{ fontSize: "1.05rem" }}>Con Apuesta</strong>
              </div>
              <p style={{ fontSize: "0.9rem", color: "var(--text-muted)", margin: "0 0 1rem" }}>Escrow seguro en Polygon</p>
              <NeonButton label="Apostar XO" onClick={() => setView("create")} fullWidth />
            </div>
          </div>
        </Panel>

        <Panel title="📖 Reglas" subtitle="Gana metiendo goles">
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <span style={{ fontSize: "1.5rem" }}>⏱️</span>
              <div>
                <strong style={{ display: "block", marginBottom: "0.25rem" }}>Turnos de 15s</strong>
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: 0 }}>Mueve una ficha por turno</p>
              </div>
            </div>
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <span style={{ fontSize: "1.5rem" }}>⚽</span>
              <div>
                <strong style={{ display: "block", marginBottom: "0.25rem" }}>Física realista</strong>
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: 0 }}>Rebotes, colisiones y fricción</p>
              </div>
            </div>
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <span style={{ fontSize: "1.5rem" }}>🎯</span>
              <div>
                <strong style={{ display: "block", marginBottom: "0.25rem" }}>Primero en 2/3/5</strong>
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: 0 }}>El que meta más goles gana</p>
              </div>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
