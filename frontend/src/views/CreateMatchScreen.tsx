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
    <Panel title="Crear partida" subtitle="Elige condiciones y firma con XO-CONNECT">
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        <div>
          <strong>Objetivo de goles</strong>
          <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
            {[2, 3, 5].map((value) => (
              <label key={value} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                <input
                  type="radio"
                  name="goals"
                  value={value}
                  checked={form.goals === value}
                  onChange={() => update({ goals: value as GoalTarget })}
                />
                <span>{value} goles</span>
              </label>
            ))}
          </div>
        </div>
        <div>
          <strong>Modalidad</strong>
          <div style={{ marginTop: "0.5rem" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
              <input type="checkbox" checked={form.isFree} onChange={(event) => update({ isFree: event.target.checked })} />
              <span>Partida gratis (sin escrow)</span>
            </label>
          </div>
        </div>
        {!form.isFree && (
          <div style={{ display: "flex", gap: "1rem" }}>
            <label style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.35rem" }}>
              <span>Stake XO</span>
              <input
                type="number"
                min="0"
                step="0.1"
                value={form.stakeAmount}
                onChange={(event: ChangeEvent<HTMLInputElement>) => update({ stakeAmount: event.target.value })}
                style={{ width: "100%", padding: "0.65rem", borderRadius: "12px", border: "1px solid var(--ui-border)" }}
              />
            </label>
            <label style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.35rem" }}>
              <span>Token address</span>
              <input
                type="text"
                value={form.stakeToken}
                onChange={(event: ChangeEvent<HTMLInputElement>) => update({ stakeToken: event.target.value })}
                style={{ width: "100%", padding: "0.65rem", borderRadius: "12px", border: "1px solid var(--ui-border)" }}
              />
            </label>
          </div>
        )}
        <NeonButton label={loading ? "Firmando..." : "Crear partida"} fullWidth disabled={loading} type="submit" />
      </form>
    </Panel>
  );
}
