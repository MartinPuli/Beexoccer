import { useEffect, useMemo, useState } from "react";
import { useGameStore } from "../hooks/useGameStore";
import type { GoalTarget, MatchMode } from "../types/game";
import { TIMED_MATCH_DURATION_MS } from "../types/game";
import type { TournamentLobby, TournamentPlayer, TournamentSize } from "../types/tournaments";
import { socketService } from "../services/socketService";
import { toast } from "../components/Toast";
import { createTournament as createTournamentOnChain, joinTournament as joinTournamentOnChain } from "../services/tournamentService";

function prizeDistribution(size: TournamentSize) {
  if (size === 4) return [{ place: 1, pct: 100 }];
  if (size === 8) return [{ place: 1, pct: 75 }, { place: 2, pct: 25 }];
  return [{ place: 1, pct: 70 }, { place: 2, pct: 20 }, { place: 3, pct: 10 }];
}

type BracketMatch = {
  id: string;
  round: number;
  order: number;
  label: string;
  a: TournamentPlayer | null;
  b: TournamentPlayer | null;
  winner?: "a" | "b";
};

function buildMainMatchIds(size: TournamentSize) {
  const makeId = (round: number, order: number) => `main-r${round}-m${order}`;
  const ids: { id: string; round: number; order: number }[] = [];
  const firstRoundMatches = size / 2;
  for (let i = 0; i < firstRoundMatches; i++) {
    ids.push({ id: makeId(1, i + 1), round: 1, order: i + 1 });
  }
  let round = 2;
  let prevRoundCount = firstRoundMatches;
  while (prevRoundCount > 1) {
    const roundCount = prevRoundCount / 2;
    for (let i = 0; i < roundCount; i++) {
      ids.push({ id: makeId(round, i + 1), round, order: i + 1 });
    }
    prevRoundCount = roundCount;
    round++;
  }
  return ids;
}

function mainDependsOn(size: TournamentSize, matchId: string): { left?: string; right?: string } {
  if (!matchId.startsWith("main-r")) return {};
  const parts = matchId.split("-");
  const roundPart = parts[1];
  const orderPart = parts[2];
  const round = Number(roundPart.slice(1));
  const order = Number(orderPart.slice(1));
  if (!Number.isFinite(round) || !Number.isFinite(order)) return {};
  if (round <= 1) return {};
  const left = `main-r${round - 1}-m${order * 2 - 1}`;
  const right = `main-r${round - 1}-m${order * 2}`;
  const all = new Set(buildMainMatchIds(size).map((x) => x.id));
  return {
    left: all.has(left) ? left : undefined,
    right: all.has(right) ? right : undefined,
  };
}

function labelForRound(size: TournamentSize, round: number, isFinal: boolean) {
  if (isFinal) return "Final";
  if (round === 1) {
    if (size === 4) return "Semifinal";
    if (size === 8) return "Cuartos";
    return "Ronda 1";
  }
  if (size === 8 && round === 2) return "Semifinal";
  return `Ronda ${round}`;
}

function computeBracket(t: TournamentLobby): { rounds: Array<[number, BracketMatch[]]>; thirdPlace: BracketMatch | null } {
  const size = t.config.size;
  const players = t.players;
  const results = t.results;

  const mainIds = buildMainMatchIds(size);
  const maxRound = Math.max(...mainIds.map((x) => x.round));

  const matchMap = new Map<string, BracketMatch>();

  for (const { id, round, order } of mainIds) {
    matchMap.set(id, {
      id,
      round,
      order,
      label: labelForRound(size, round, round === maxRound),
      a: null,
      b: null,
      winner: results[id]?.winner,
    });
  }

  const round1 = mainIds.filter((x) => x.round === 1).sort((a, b) => a.order - b.order);
  let idx = 0;
  for (const m of round1) {
    const node = matchMap.get(m.id)!;
    node.a = players[idx] ?? null;
    node.b = players[idx + 1] ?? null;
    idx += 2;
  }

  const pickWinner = (matchId: string): TournamentPlayer | null => {
    const node = matchMap.get(matchId);
    if (!node || !node.a || !node.b || !node.winner) return null;
    return node.winner === "a" ? node.a : node.b;
  };

  const pickLoser = (matchId: string): TournamentPlayer | null => {
    const node = matchMap.get(matchId);
    if (!node || !node.a || !node.b || !node.winner) return null;
    return node.winner === "a" ? node.b : node.a;
  };

  for (const { id } of mainIds.filter((x) => x.round > 1).sort((a, b) => a.round - b.round || a.order - b.order)) {
    const deps = mainDependsOn(size, id);
    const node = matchMap.get(id)!;
    if (deps.left) node.a = pickWinner(deps.left);
    if (deps.right) node.b = pickWinner(deps.right);
  }

  const roundsMap = new Map<number, BracketMatch[]>();
  for (const m of matchMap.values()) {
    const arr = roundsMap.get(m.round) ?? [];
    arr.push(m);
    roundsMap.set(m.round, arr);
  }
  for (const [k, arr] of roundsMap.entries()) {
    roundsMap.set(k, arr.sort((a, b) => a.order - b.order));
  }

  const rounds = Array.from(roundsMap.entries()).sort((a, b) => a[0] - b[0]);

  let thirdPlace: BracketMatch | null = null;
  if (size === 16) {
    const semi1 = "main-r3-m1";
    const semi2 = "main-r3-m2";
    thirdPlace = {
      id: "third-place",
      round: 0,
      order: 0,
      label: "3er / 4to",
      a: pickLoser(semi1),
      b: pickLoser(semi2),
      winner: results["third-place"]?.winner,
    };
  }

  return { rounds, thirdPlace };
}

function canPlayMatch(m: BracketMatch) {
  return Boolean(m.a && m.b && !m.winner);
}

function computeBracketLayout(size: TournamentSize) {
  const rounds = Math.log2(size);
  const bubbleW = 160;
  const bubbleH = 34;
  const slotGap = 14;
  const matchGap = 22;
  const colGap = 220;
  const padX = 18;
  const padY = 18;
  const matchBlockH = bubbleH * 2 + slotGap;
  const round1BlockH = matchBlockH + matchGap;

  const topYByRound: number[][] = [];
  const matchCountR1 = size / 2;
  topYByRound[0] = Array.from({ length: matchCountR1 }, (_, i) => padY + i * round1BlockH);
  for (let r = 1; r < rounds; r++) {
    const prev = topYByRound[r - 1];
    const count = prev.length / 2;
    const current: number[] = [];
    for (let i = 0; i < count; i++) {
      const c1 = prev[i * 2] + bubbleH + slotGap / 2;
      const c2 = prev[i * 2 + 1] + bubbleH + slotGap / 2;
      const center = (c1 + c2) / 2;
      current.push(center - (bubbleH + slotGap / 2));
    }
    topYByRound[r] = current;
  }

  const width = padX * 2 + colGap * (rounds - 1) + bubbleW;
  const height = padY * 2 + round1BlockH * matchCountR1 - matchGap;
  return { rounds, bubbleW, bubbleH, slotGap, colGap, padX, padY, width, height, topYByRound };
}

export function TournamentsScreen() {
  const setView = useGameStore((s) => s.setView);
  const userAddress = useGameStore((s) => s.userAddress);
  const tournamentLobbies = useGameStore((s) => s.tournamentLobbies);
  const selectedTournamentId = useGameStore((s) => s.selectedTournamentId);
  const createTournamentStore = useGameStore((s) => s.createTournament);
  const selectTournament = useGameStore((s) => s.selectTournament);
  const joinTournamentStore = useGameStore((s) => s.joinTournament);
  const setTournamentWinner = useGameStore((s) => s.setTournamentWinner);
  const setTournamentLobbies = useGameStore((s) => s.setTournamentLobbies);

  const [size, setSize] = useState<TournamentSize>(4);
  const [mode, setMode] = useState<MatchMode>("goals");
  const [goals, setGoals] = useState<GoalTarget>(3);
  const [isBet, setIsBet] = useState(false);
  const [entryFee, setEntryFee] = useState("10");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const selectedTournament = useMemo(
    () => tournamentLobbies.find((t) => t.id === selectedTournamentId) ?? null,
    [tournamentLobbies, selectedTournamentId]
  );

  const bracket = useMemo(() => (selectedTournament ? computeBracket(selectedTournament) : null), [selectedTournament]);
  const thirdPlace = bracket?.thirdPlace ?? null;

  const distribution = useMemo(
    () => prizeDistribution(selectedTournament ? selectedTournament.config.size : size),
    [selectedTournament, size]
  );

  useEffect(() => {
    socketService.connectTournaments();
    // Assuming socketService has a way to get initial state or we rely on the update event
    // For now, let's just listen
    const handler = (lobbies: TournamentLobby[]) => {
      if (setTournamentLobbies) setTournamentLobbies(lobbies);
    };
    socketService.onTournamentsUpdate(handler);

    return () => {
      socketService.unsubscribeTournaments();
    };
  }, [setTournamentLobbies]);

  const myLower = (userAddress || "").toLowerCase();

  const canJoin = (t: TournamentLobby) => {
    if (t.players.length >= t.config.size) return false;
    if (!myLower) return true;
    return !t.players.some((p) => (p.address || "").toLowerCase() === myLower);
  };

  const formatMatchType = (t: TournamentLobby) => {
    if (t.config.mode === "time") return "Por tiempo (3:00)";
    return `Por goles (${t.config.goals})`;
  };

  const formatCreator = (t: TournamentLobby) => {
    const addr = t.creatorAddress || "";
    if (addr.length >= 10) return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    const a = (t.creatorAlias || "").trim();
    if (a) return a;
    return addr || "-";
  };

  const onCreate = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      let externalId: string | undefined = undefined;
      const config = {
        size,
        mode,
        goals,
        durationMs: mode === "time" ? TIMED_MATCH_DURATION_MS : undefined,
        isFree: !isBet,
        entryFee: isBet ? entryFee : "0",
      };

      if (isBet) {
        if (!userAddress) {
          alert("Conecta tu wallet para crear un torneo pago");
          setIsLoading(false);
          return;
        }
        const txId = await createTournamentOnChain(config);
        externalId = txId.toString();
      }

      createTournamentStore(config, externalId);
      setIsCreateOpen(false);
      toast.success("Torneo creado", externalId ? `ID: ${externalId}` : "Local");
    } catch (e) {
      console.error(e);
      alert("Error al crear torneo: " + (e as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const onJoin = async (t: TournamentLobby) => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      if (!t.config.isFree) {
        if (!userAddress) {
          alert("Conecta tu wallet para unirte");
          setIsLoading(false);
          return;
        }
        // Need to join on chain
        await joinTournamentOnChain(t.id, t.config.entryFee);
      }
      await joinTournamentStore(t.id);
      toast.success("Te uniste", "Esperando bracket listo");
    } catch (e) {
      console.error(e);
      alert("Error al unirse: " + (e as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const onSetWinner = async (matchId: string, winner: "a" | "b") => {
    if (!selectedTournament) return;
    try {
      await setTournamentWinner(selectedTournament.id, matchId, winner);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo guardar el resultado";
      toast.error("Error", msg);
    }
  };

  return (
    <div className={selectedTournament ? "create-screen" : "lobbies-screen"}>
      <div className={selectedTournament ? "create-header" : "lobbies-header"}>
        <button
          className={selectedTournament ? "create-back" : "lobbies-back"}
          onClick={() => (selectedTournament ? selectTournament(undefined) : setView("home"))}
        >
          ←
        </button>
        <span className={selectedTournament ? "create-title" : "lobbies-title"}>
          {selectedTournament ? "Bracket" : "Torneos"}
        </span>
        <span style={{ width: 32 }} />
      </div>

      {!selectedTournament ? (
        <>
          <div className="lobbies-list">
            {tournamentLobbies.length === 0 ? (
              <p style={{ color: "var(--text-muted)", textAlign: "center", padding: "40px 20px" }}>
                No hay torneos creados.<br />¡Crea uno nuevo!
              </p>
            ) : (
              tournamentLobbies.map((t) => (
                <div key={t.id} className="lobby-card">
                  <div className="lobby-info">
                    <div className="lobby-header-row">
                      <span className="lobby-badge">🏟️ {t.config.size} jugadores</span>
                      <span className="lobby-badge">⚔️ {formatMatchType(t)}</span>
                    </div>
                    <span className={`lobby-stake ${t.config.isFree ? "free" : ""}`}>
                      {t.config.isFree ? "GRATIS" : `${t.config.entryFee} POL`}
                    </span>
                    <span className="lobby-meta">Cupos: {t.players.length}/{t.config.size}</span>
                    <span className="lobby-creator">{formatCreator(t)}</span>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="lobby-join" onClick={() => selectTournament(t.id)}>
                      VER
                    </button>
                    <button className="lobby-join" disabled={!canJoin(t) || isLoading} onClick={() => onJoin(t)}>
                      {isLoading ? "..." : "UNIRSE"}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="lobbies-footer">
            <button className="lobbies-create-btn" onClick={() => setIsCreateOpen(true)}>
              + CREAR TORNEO
            </button>
          </div>

          {isCreateOpen ? (
            <div className="tournament-modal-overlay" onMouseDown={() => setIsCreateOpen(false)}>
              <div className="tournament-modal" onMouseDown={(e) => e.stopPropagation()}>
                <div className="tournament-modal-header">
                  <button className="create-back" onClick={() => setIsCreateOpen(false)}>
                    ←
                  </button>
                  <span className="create-title">Crear Torneo</span>
                  <span style={{ width: 32 }} />
                </div>

                <div className="tournament-modal-body">
                  <div className="create-section">
                    <span className="create-label">Jugadores</span>
                    <div className="tournament-size-row">
                      <button type="button" className={`goal-btn ${size === 4 ? "active" : ""}`} onClick={() => setSize(4)}>4</button>
                      <button type="button" className={`goal-btn ${size === 8 ? "active" : ""}`} onClick={() => setSize(8)}>8</button>
                      <button type="button" className={`goal-btn ${size === 16 ? "active" : ""}`} onClick={() => setSize(16)}>16</button>
                    </div>
                  </div>

                  <div className="create-section">
                    <span className="create-label">Tipo de partido</span>
                    <div className="goals-row">
                      <button type="button" className={`goal-btn ${mode === "goals" ? "active" : ""}`} onClick={() => setMode("goals")}>
                        Por goles
                      </button>
                      <button type="button" className={`goal-btn ${mode === "time" ? "active" : ""}`} onClick={() => setMode("time")}>
                        Por tiempo (3:00)
                      </button>
                    </div>
                  </div>

                  {mode === "goals" ? (
                    <div className="create-section">
                      <span className="create-label">Meta de goles</span>
                      <div className="goals-row">
                        {([2, 3, 5] as GoalTarget[]).map((n) => (
                          <button key={n} type="button" className={`goal-btn ${goals === n ? "active" : ""}`} onClick={() => setGoals(n)}>
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="create-section">
                    <span className="create-label">Modo</span>
                    <div className="mode-toggle">
                      <span className={`mode-label ${!isBet ? "active" : ""}`}>GRATIS</span>
                      <div className={`toggle-track ${isBet ? "on" : ""}`} onClick={() => setIsBet(!isBet)}>
                        <div className="toggle-thumb" />
                      </div>
                      <span className={`mode-label ${isBet ? "active" : ""}`}>APOSTAR</span>
                    </div>
                  </div>

                  {isBet ? (
                    <div className="create-section">
                      <span className="create-label">Entrada (POL)</span>
                      <input
                        type="number"
                        className="stake-input full-width"
                        value={entryFee}
                        onChange={(e) => setEntryFee(e.target.value)}
                        min="0"
                        step="0.1"
                      />
                    </div>
                  ) : null}

                  <div style={{ marginTop: 4, color: "var(--text-muted)", fontWeight: 700, fontSize: 13 }}>
                    Distribución: {distribution.map((d) => `${d.place}° ${d.pct}%`).join(" - ")}
                  </div>
                </div>

                <div className="create-footer">
                  <button className="create-submit" onClick={onCreate}>
                    {isLoading ? "Creando..." : "CREAR"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <>
          <div className="create-body" style={{ gap: 14 }}>
            <div className="tournament-detail-bar">
              <div className="tournament-detail-title">
                Torneo {selectedTournament.config.size} ({selectedTournament.players.length}/{selectedTournament.config.size})
              </div>
              <div className="tournament-detail-meta">
                {selectedTournament.config.isFree ? "Gratis" : `Entrada ${selectedTournament.config.entryFee} POL`}
              </div>
              <div className="tournament-detail-meta">{formatMatchType(selectedTournament)}</div>
              <div className="tournament-detail-actions">
                <button className="lobby-join" disabled={!canJoin(selectedTournament) || isLoading} onClick={() => onJoin(selectedTournament)}>
                  {isLoading ? "..." : "UNIRSE"}
                </button>
              </div>
            </div>

            <div style={{ color: "var(--text-light)", fontWeight: 700, fontSize: 13, padding: "0 20px 10px" }}>
              Distribución: {distribution.map((d) => `${d.place}° ${d.pct}%`).join(" - ")}
            </div>

            <div className="bracket-scroll">
              {bracket ? (() => {
                const size = selectedTournament.config.size;
                const layout = computeBracketLayout(size);
                const rounds = bracket.rounds;

                const getRoundName = (roundNo: number, isFinal: boolean) => {
                  if (isFinal) return "Final";
                  if (roundNo === 1) {
                    if (size === 4) return "Semifinales";
                    if (size === 8) return "Cuartos";
                    return "Ronda 1";
                  }
                  return `Ronda ${roundNo}`;
                };

                const bubbleRx = 18;
                const winStroke = "rgba(0,255,106,0.85)";
                const normalStroke = "rgba(255,255,255,0.16)";
                const fill = "url(#bubbleFill)";
                const lineStroke = "rgba(0,255,106,0.22)";
                const connPad = 16;

                const colX = (rIdx: number) => layout.padX + rIdx * layout.colGap;
                const matchTopY = (rIdx: number, mIdx: number) => layout.topYByRound[rIdx]?.[mIdx] ?? layout.padY;

                const bubbleCenterY = (topY: number) => topY + layout.bubbleH / 2;

                const renderBubble = (
                  key: string,
                  x: number,
                  y: number,
                  label: string,
                  isWinner: boolean,
                  canClick: boolean,
                  onClick: () => void
                ) => (
                  <g
                    key={key}
                    style={{ cursor: canClick ? "pointer" : "default" }}
                    onClick={() => (canClick ? onClick() : null)}
                    filter={isWinner ? "url(#glow)" : undefined}
                  >
                    <rect
                      x={x}
                      y={y}
                      width={layout.bubbleW}
                      height={layout.bubbleH}
                      rx={bubbleRx}
                      ry={bubbleRx}
                      fill={fill}
                      stroke={isWinner ? winStroke : normalStroke}
                      strokeWidth={2}
                    />
                    <text
                      x={x + layout.bubbleW / 2}
                      y={y + layout.bubbleH / 2 + 4}
                      fill="rgba(224,240,230,0.95)"
                      fontFamily="Chakra Petch, monospace"
                      fontWeight={900}
                      fontSize={12}
                      textAnchor="middle"
                    >
                      {label.length > 14 ? label.slice(0, 12) + ".." : label}
                    </text>
                  </g>
                );

                const svgWidth = thirdPlace ? layout.width + layout.colGap : layout.width;
                const svgHeight = layout.height;
                const finalRoundIdx = rounds.length - 1;

                const lines: JSX.Element[] = [];
                for (let rIdx = 0; rIdx < rounds.length - 1; rIdx++) {
                  const [, ms] = rounds[rIdx];
                  for (let i = 0; i < ms.length; i++) {
                    const x1 = colX(rIdx) + layout.bubbleW;
                    const xMid = x1 + connPad;
                    const x2 = colX(rIdx + 1);

                    const top = matchTopY(rIdx, i);
                    const yA = bubbleCenterY(top);
                    const yB = bubbleCenterY(top + layout.bubbleH + layout.slotGap);
                    const parentTop = matchTopY(rIdx + 1, Math.floor(i / 2));
                    const yP = bubbleCenterY(parentTop + (i % 2 === 0 ? 0 : layout.bubbleH + layout.slotGap));

                    lines.push(
                      <path
                        key={`c-${rIdx}-${i}`}
                        d={`M ${x1} ${i % 2 === 0 ? yA : yB} H ${xMid} V ${yP} H ${x2}`}
                        fill="none"
                        stroke={lineStroke}
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    );
                  }
                }

                const content: JSX.Element[] = [];
                for (let rIdx = 0; rIdx < rounds.length; rIdx++) {
                  const [roundNo, ms] = rounds[rIdx];
                  const x = colX(rIdx);
                  const title = getRoundName(roundNo, rIdx === finalRoundIdx);
                  content.push(
                    <text
                      key={`t-${rIdx}`}
                      x={x}
                      y={14}
                      fill="rgba(122,154,136,0.95)"
                      fontSize={12}
                      fontWeight={900}
                      style={{ letterSpacing: "0.08em", textTransform: "uppercase" } as any}
                    >
                      {title}
                    </text>
                  );

                  for (let mIdx = 0; mIdx < ms.length; mIdx++) {
                    const m = ms[mIdx];
                    const topY = matchTopY(rIdx, mIdx);
                    const canA = canPlayMatch(m) && Boolean(m.a);
                    const canB = canPlayMatch(m) && Boolean(m.b);

                    content.push(
                      renderBubble(
                        `${m.id}-a`,
                        x,
                        topY,
                        m.a?.id ?? "-",
                        m.winner === "a",
                        canA,
                        () => onSetWinner(m.id, "a")
                      )
                    );
                    content.push(
                      renderBubble(
                        `${m.id}-b`,
                        x,
                        topY + layout.bubbleH + layout.slotGap,
                        m.b?.id ?? "-",
                        m.winner === "b",
                        canB,
                        () => onSetWinner(m.id, "b")
                      )
                    );
                  }
                }

                if (thirdPlace) {
                  const x = colX(rounds.length);
                  content.push(
                    <text
                      key={`t-third`}
                      x={x}
                      y={14}
                      fill="rgba(122,154,136,0.95)"
                      fontSize={12}
                      fontWeight={900}
                      style={{ letterSpacing: "0.08em", textTransform: "uppercase" } as any}
                    >
                      3er / 4to
                    </text>
                  );
                  const topY = layout.padY;
                  content.push(
                    renderBubble(
                      `third-a`,
                      x,
                      topY,
                      thirdPlace.a?.id ?? "-",
                      thirdPlace.winner === "a",
                      canPlayMatch(thirdPlace) && Boolean(thirdPlace.a),
                      () => onSetWinner(thirdPlace.id, "a")
                    )
                  );
                  content.push(
                    renderBubble(
                      `third-b`,
                      x,
                      topY + layout.bubbleH + layout.slotGap,
                      thirdPlace.b?.id ?? "-",
                      thirdPlace.winner === "b",
                      canPlayMatch(thirdPlace) && Boolean(thirdPlace.b),
                      () => onSetWinner(thirdPlace.id, "b")
                    )
                  );
                }

                return (
                  <svg
                    className="bracket-svg"
                    width={svgWidth}
                    height={svgHeight}
                    viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <defs>
                      <linearGradient id="bubbleFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgba(12, 30, 18, 0.85)" />
                        <stop offset="100%" stopColor="rgba(0, 0, 0, 0.25)" />
                      </linearGradient>
                      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                        <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="rgba(0,255,106,0.55)" />
                        <feDropShadow dx="0" dy="0" stdDeviation="8" floodColor="rgba(0,255,106,0.18)" />
                      </filter>
                    </defs>
                    {lines}
                    {content}
                  </svg>
                );
              })() : null}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
