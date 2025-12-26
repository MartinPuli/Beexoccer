import { useMemo } from "react";
import { useGameStore } from "../hooks/useGameStore";
import { ARGENTINA_TEAMS_2025 } from "../data/argentinaTeams2025";

export function TeamSelectScreen() {
  const setView = useGameStore((s) => s.setView);
  const selectedTeamId = useGameStore((s) => s.selectedTeamId);
  const setSelectedTeamId = useGameStore((s) => s.setSelectedTeamId);

  const teams = useMemo(() => {
    return [...ARGENTINA_TEAMS_2025].sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  return (
    <div className="create-screen">
      <div className="create-header">
        <button className="create-back" onClick={() => setView("home")}>
          ←
        </button>
        <span className="create-title">Elegí tu equipo</span>
        <span style={{ width: 32 }} />
      </div>

      <div className="create-body" style={{ width: "100%" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
          {teams.map((t) => {
            const active = t.id === selectedTeamId;
            return (
              <button
                key={t.id}
                onClick={() => {
                  setSelectedTeamId(t.id);
                  setView("home");
                }}
                className="home-btn primary"
                style={{
                  width: "100%",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  opacity: active ? 1 : 0.95,
                  border: active ? "2px solid #00ff6a" : undefined,
                }}
              >
                <span style={{ fontWeight: 800 }}>{t.name}</span>
                <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <span
                    title="Local"
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 999,
                      background: t.home.primary,
                      border: `2px solid ${t.home.secondary}`,
                      display: "inline-block",
                    }}
                  />
                  <span
                    title="Visitante"
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 999,
                      background: t.away.primary,
                      border: `2px solid ${t.away.secondary}`,
                      display: "inline-block",
                    }}
                  />
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
