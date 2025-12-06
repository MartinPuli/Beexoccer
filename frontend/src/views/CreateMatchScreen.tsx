import { ChangeEvent, FormEvent, useState } from "react";
import { NeonButton } from "../components/NeonButton";
import { Panel } from "../components/Panel";
import { createMatch } from "../services/matchService";
import { useGameStore } from "../hooks/useGameStore";
import { GoalTarget } from "../types/game";

const defaultForm = {
  goals: 3 as GoalTarget,
  isFree: true,
  stakeAmount: "0",
  stakeToken: "0x0000000000000000000000000000000000000000"
};

/**
 * Screen to configure lobbies. All fields are intentionally simple for V1 (radio buttons + toggles) so players can publish
 * matches in less than 10 seconds.
 */
export function CreateMatchScreen() {
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(false);
  const setView = useGameStore((state) => state.setView);

  const update = (patch: Partial<typeof form>) => setForm((prev) => ({ ...prev, ...patch }));

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      await createMatch(form);
      alert("Partida registrada. Invita a un rival o espera que alguien se una.");
      setView("accept");
    } catch (error) {
      console.error(error);
      alert("No pudimos crear la partida. Revisa tu firma XO-CONNECT.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Panel title="⚽ Crear Partida" subtitle="Configura tu desafío futbolero">
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <div style={{ padding: "1.25rem", background: "rgba(17, 177, 58, 0.05)", borderRadius: "16px", border: "1px solid rgba(17, 177, 58, 0.15)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
            <span style={{ fontSize: "1.3rem" }}>🎯</span>
            <strong style={{ fontSize: "1.05rem" }}>Objetivo de goles</strong>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem" }}>
            {[2, 3, 5].map((value) => (
              <label
                key={value}
                style={{
                  cursor: "pointer",
                  padding: "1rem",
                  borderRadius: "12px",
                  border: form.goals === value ? "2px solid var(--neon-green)" : "2px solid var(--ui-border)",
                  background: form.goals === value ? "rgba(17, 177, 58, 0.15)" : "rgba(10, 24, 12, 0.5)",
                  textAlign: "center",
                  transition: "all 0.2s ease",
                  fontWeight: 600
                }}
              >
                <input
                  type="radio"
                  name="goals"
                  value={value}
                  checked={form.goals === value}
                  onChange={() => update({ goals: value as GoalTarget })}
                  style={{ display: "none" }}
                />
                <div style={{ fontSize: "1.8rem", marginBottom: "0.25rem" }}>⚽</div>
                <span>{value} goles</span>
              </label>
            ))}
          </div>
        </div>

        <div style={{ padding: "1.25rem", background: "rgba(17, 177, 58, 0.05)", borderRadius: "16px", border: "1px solid rgba(17, 177, 58, 0.15)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
            <span style={{ fontSize: "1.3rem" }}>💰</span>
            <strong style={{ fontSize: "1.05rem" }}>Modalidad</strong>
          </div>
          <label
            htmlFor="isFree"
            style={{
              cursor: "pointer",
              padding: "1rem",
              borderRadius: "12px",
              border: "2px solid var(--ui-border)",
              background: "rgba(10, 24, 12, 0.5)",
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              transition: "all 0.2s ease"
            }}
          >
            <input
              id="isFree"
              type="checkbox"
              checked={form.isFree}
              onChange={(event: ChangeEvent<HTMLInputElement>) => update({ isFree: event.target.checked })}
              style={{ width: "20px", height: "20px", cursor: "pointer" }}
              aria-label="Partida gratis sin escrow"
            />
            <div>
              <strong style={{ display: "block", marginBottom: "0.25rem" }}>Partida gratis</strong>
              <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Sin escrow, juega por diversión</span>
            </div>
          </label>
        </div>

        {!form.isFree && (
          <div style={{ padding: "1.25rem", background: "rgba(247, 193, 77, 0.08)", borderRadius: "16px", border: "1px solid rgba(247, 193, 77, 0.25)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
              <span style={{ fontSize: "1.3rem" }}>💎</span>
              <strong style={{ fontSize: "1.05rem" }}>Configuración de apuesta</strong>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <span style={{ fontWeight: 600 }}>Cantidad XO</span>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.stakeAmount}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => update({ stakeAmount: event.target.value })}
                  placeholder="ej: 5.0"
                  style={{
                    width: "100%",
                    padding: "0.9rem",
                    borderRadius: "12px",
                    border: "2px solid var(--ui-border)",
                    background: "rgba(10, 24, 12, 0.7)",
                    color: "var(--text-white)",
                    fontSize: "1rem",
                    fontFamily: "inherit"
                  }}
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <span style={{ fontWeight: 600 }}>Token address</span>
                <input
                  type="text"
                  value={form.stakeToken}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => update({ stakeToken: event.target.value })}
                  placeholder="0x0000..."
                  style={{
                    width: "100%",
                    padding: "0.9rem",
                    borderRadius: "12px",
                    border: "2px solid var(--ui-border)",
                    background: "rgba(10, 24, 12, 0.7)",
                    color: "var(--text-white)",
                    fontSize: "0.9rem",
                    fontFamily: "monospace"
                  }}
                />
              </label>
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: "0.75rem" }}>
          <NeonButton label="Volver" onClick={() => setView("home")} fullWidth variant="secondary" disabled={loading} />
          <NeonButton label={loading ? "Firmando..." : "🚀 Crear partida"} fullWidth disabled={loading} type="submit" />
        </div>
      </form>
    </Panel>
  );
}
