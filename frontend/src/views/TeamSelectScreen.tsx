import { useMemo } from "react";
import { useGameStore } from "../hooks/useGameStore";
import { ARGENTINA_TEAMS_2025, makeTeamBadgeUrl } from "../data/argentinaTeams2025";

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
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            width: "100%",
            maxHeight: "70vh",
            overflowY: "auto",
            paddingRight: 6,
          }}
        >
          {teams.map((t) => {
            const active = t.id === selectedTeamId;
            const badgeUrl = makeTeamBadgeUrl({ teamId: t.id, fill: t.home.primary, stroke: t.home.secondary });
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
                  {badgeUrl ? (
                    <span
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 14,
                        background: "rgba(0,0,0,0.25)",
                        border: "1px solid rgba(0,255,106,0.20)",
                        boxShadow: active
                          ? "0 0 16px rgba(0,255,106,0.25)"
                          : "0 0 10px rgba(0,0,0,0.35)",
                        display: "grid",
                        placeItems: "center",
                        overflow: "hidden",
                      }}
                      title="Escudo"
                    >
                      <img src={badgeUrl} alt={t.shortName} style={{ width: 34, height: 34, display: "block" }} />
                    </span>
                  ) : null}
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
