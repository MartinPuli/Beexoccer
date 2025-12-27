import { useEffect, useState } from "react";
import { useGameStore } from "../hooks/useGameStore";
import { env } from "../config/env";

type WeeklyRankingEntry = {
  rank: number;
  id: string;
  address: string;
  alias?: string;
  xo: number;
};

type WeeklyRankingResponse = {
  weekStartMs: number;
  weekEndMs: number;
  generatedAt: number;
  players: WeeklyRankingEntry[];
};

export function RankingScreen() {
  const setView = useGameStore((s) => s.setView);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<WeeklyRankingResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const url = new URL(env.realtimeUrl);
        url.pathname = "/api/ranking/weekly";
        const res = await fetch(url.toString(), {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const json = (await res.json()) as WeeklyRankingResponse;
        if (!cancelled) setData(json);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!cancelled) setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="create-screen">
      <div className="create-header">
        <button className="create-back" onClick={() => setView("home")}>
          ←
        </button>
        <span className="create-title">Ranking semanal</span>
        <span style={{ width: 32 }} />
      </div>

      <div className="create-body">
        {loading && (
          <div style={{
            textAlign: "center",
            color: "white",
            padding: "40px 20px",
            fontSize: "1rem"
          }}>
            Cargando ranking...
          </div>
        )}
        {error && (
          <div className="turn-indicator" style={{ color: "var(--accent-red)" }}>
            Error: {error}
          </div>
        )}

        {!loading && !error && data && data.players.length > 0 && (
          <div style={{ width: "100%" }}>
            <div style={{ 
              textAlign: "center", 
              marginBottom: 16, 
              color: "white",
              fontSize: "1.1rem",
              fontWeight: 600
            }}>
              🏆 Top jugadores
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {data.players.map((p) => (
                <div
                  key={p.address}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 16px",
                    borderRadius: 12,
                    background: "rgba(0,0,0,0.35)",
                    border: "1px solid rgba(0,255,106,0.25)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div
                      style={{
                        width: 36,
                        textAlign: "center",
                        fontWeight: 800,
                        color: p.rank === 1 ? "#ffd700" : p.rank === 2 ? "#c0c0c0" : p.rank === 3 ? "#cd7f32" : "#00ff6a",
                        fontSize: p.rank <= 3 ? "1.2rem" : "1rem",
                      }}
                    >
                      {p.rank === 1 ? "🥇" : p.rank === 2 ? "🥈" : p.rank === 3 ? "🥉" : `#${p.rank}`}
                    </div>
                    <div style={{ fontWeight: 600, color: "white" }}>{p.alias || p.id}</div>
                  </div>
                  <div style={{ fontWeight: 800, color: "#ffe45b" }}>{p.xo} XO</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && !error && data && data.players.length === 0 && (
          <div style={{ 
            textAlign: "center", 
            color: "white", 
            padding: "40px 20px",
            fontSize: "1rem"
          }}>
            Aún no hay jugadores rankeados esta semana.
          </div>
        )}
      </div>
    </div>
  );
}
