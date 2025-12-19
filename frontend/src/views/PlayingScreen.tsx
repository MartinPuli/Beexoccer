import { useEffect, useRef, useState, useCallback } from "react";
import { PitchCanvas } from "../components/PitchCanvas";
import { useGameStore } from "../hooks/useGameStore";
import { socketService } from "../services/socketService";
import { reportResult } from "../services/matchService";
import { TokenChip, PlayingSnapshot } from "../types/game";

/**
 * PlayingScreen - Partida online 1v1 con sincronización por sockets
 * - Mecánicas idénticas a BotMatchScreen
 * - Sin iconos en las fichas
 * - Cada jugador ve sus fichas abajo (azules)
 * - Perder automático si 3 turnos sin tiempo consecutivos
 */

const FIELD_WIDTH = 600;
const FIELD_HEIGHT = 900;
const TURN_TIME = 15000;
const MAX_DRAG_DISTANCE = 200;  // Distancia máxima de arrastre (estilo Table Soccer)
const MAX_TIMEOUTS_TO_LOSE = 3;

// Constantes de física estilo Table Soccer (sincronizadas con BotMatchScreen y servidor)
const MIN_SPEED = 3;
const MAX_SPEED = 28;  // Velocidad máxima controlada
const POWER_CURVE_FACTOR = 0.7; // Factor de curva de potencia (igual que BotMatchScreen)

interface AimLine {
  from: { x: number; y: number };
  to: { x: number; y: number };
}

// Transformar coordenadas para que el jugador siempre vea sus fichas abajo
function transformForPlayer(
  chips: TokenChip[],
  ball: { x: number; y: number },
  isChallenger: boolean
): { chips: TokenChip[]; ball: { x: number; y: number } } {
  // En el servidor: Creator está abajo (y alto), Challenger está arriba (y bajo)
  // Creator quiere ver sus fichas abajo → no invertir
  // Challenger quiere ver sus fichas abajo → invertir todo
  
  if (isChallenger) {
    // Challenger: invertir para ver sus fichas abajo
    return {
      chips: chips.map(c => ({
        ...c,
        x: FIELD_WIDTH - c.x,
        y: FIELD_HEIGHT - c.y,
        // Challenger = azul (yo), Creator = rojo (rival)
        fill: c.owner === "challenger" ? "#00a8ff" : "#ff4d5a",
        flagEmoji: ""
      })),
      ball: {
        x: FIELD_WIDTH - ball.x,
        y: FIELD_HEIGHT - ball.y
      }
    };
  }
  // Creator: las fichas del servidor ya están correctas (creator abajo)
  return {
    chips: chips.map(c => ({
      ...c,
      // Creator = azul (yo), Challenger = rojo (rival)
      fill: c.owner === "creator" ? "#00a8ff" : "#ff4d5a",
      flagEmoji: ""
    })),
    ball
  };
}

export function PlayingScreen() {
  const playerSide = useGameStore((s) => s.playerSide);
  const currentMatchId = useGameStore((s) => s.currentMatchId);
  const goalTarget = useGameStore((s) => s.matchGoalTarget);
  const setView = useGameStore((s) => s.setView);
  const setMatchStatus = useGameStore((s) => s.setMatchStatus);
  const setCurrentMatchId = useGameStore((s) => s.setCurrentMatchId);
  const setActiveMatch = useGameStore((s) => s.setActiveMatch);
  const alias = useGameStore((s) => s.alias);

  const isChallenger = playerSide === "challenger";

  const [chips, setChips] = useState<TokenChip[]>([]);
  const [ball, setBall] = useState({ x: 300, y: 450 });
  const [activePlayer, setActivePlayer] = useState<"creator" | "challenger">("creator");
  const [myScore, setMyScore] = useState(0);
  const [rivalScore, setRivalScore] = useState(0);
  const [aim, setAim] = useState<AimLine | undefined>();
  const [selectedChipId, setSelectedChipId] = useState<string | null>(null);
  const [timerPercent, setTimerPercent] = useState(100);
  const [showEnd, setShowEnd] = useState(false);
  const [winner, setWinner] = useState<"you" | "rival" | null>(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [commentary, setCommentary] = useState("Conectando...");
  const [connected, setConnected] = useState(false);
  const [shotPower, setShotPower] = useState(0);
  const [goalAnimation, setGoalAnimation] = useState<"you" | "rival" | null>(null);
  const [turnLostAnimation, setTurnLostAnimation] = useState(false);
  const [consecutiveTimeouts, setConsecutiveTimeouts] = useState(0);
  const [rematchRequested, setRematchRequested] = useState(false);
  const [waitingRematchResponse, setWaitingRematchResponse] = useState(false);
  const [rivalRequestedRematch, setRivalRequestedRematch] = useState(false);
  const [rivalRematchAlias, setRivalRematchAlias] = useState("");
  const [settling, setSettling] = useState(false);

  const dragRef = useRef<{ chipId: string; start: { x: number; y: number } } | null>(null);
  const turnEndRef = useRef<number>(Date.now() + TURN_TIME);
  const lastTurnPlayerRef = useRef<"creator" | "challenger" | null>(null);
  const resultReportedRef = useRef(false);

  // Snapshot buffering and mobile throttling
  const latestSnapshotRef = useRef<{
    chips: TokenChip[];
    ball: { x: number; y: number };
    activePlayer: "creator" | "challenger";
    challengerScore: number;
    creatorScore: number;
    commentary: string;
    turnEndsAt: number;
    awaitingInput: boolean;
  } | null>(null);
  const isMobileRef = useRef(false);
  const [isMobile, setIsMobile] = useState(false);
  // Inicializar como false para que cuando llegue el primer snapshot con true, se resetee el timeout flag
  const [awaitingInput, setAwaitingInput] = useState(false);

  const isMyTurn = (isChallenger && activePlayer === "challenger") || (!isChallenger && activePlayer === "creator");

  // Prevenir scroll/zoom en iOS durante el gameplay
  useEffect(() => {
    const preventDefault = (e: TouchEvent) => {
      // Solo prevenir si el touch es en el área de juego
      const target = e.target as HTMLElement;
      if (target.closest('.playing-pitch') || target.closest('.pitch-svg')) {
        e.preventDefault();
      }
    };

    // Agregar listeners pasivos en falso para poder hacer preventDefault
    document.addEventListener('touchmove', preventDefault, { passive: false });
    document.addEventListener('touchstart', preventDefault, { passive: false });

    return () => {
      document.removeEventListener('touchmove', preventDefault);
      document.removeEventListener('touchstart', preventDefault);
    };
  }, []);

  // Conectar al servidor de tiempo real
  useEffect(() => {
    if (!currentMatchId) return;

    // Primero registrar los listeners, luego conectar
    socketService.connect(currentMatchId, playerSide, goalTarget);

    socketService.onSnapshot((snapshot: PlayingSnapshot) => {
      setConnected(true);
      
      // Debug: log snapshot received
      if (import.meta.env.DEV) {
        console.log("[PlayingScreen] Snapshot received:", { 
          activePlayer: snapshot.activePlayer, 
          turnEndsAt: snapshot.turnEndsAt,
          chipCount: snapshot.chips.length 
        });
      }
      
      // Transformar según perspectiva del jugador
      const { chips: transformedChips, ball: transformedBall } = transformForPlayer(
        snapshot.chips,
        snapshot.ball,
        isChallenger
      );

      // Throttle visual updates on mobile: write to refs every snapshot,
      // and update React state at a capped frequency.
      latestSnapshotRef.current = {
        chips: transformedChips,
        ball: transformedBall,
        activePlayer: snapshot.activePlayer,
        challengerScore: snapshot.challengerScore,
        creatorScore: snapshot.creatorScore,
        commentary: snapshot.commentary,
        turnEndsAt: snapshot.turnEndsAt,
        awaitingInput: snapshot.awaitingInput ?? true,
      };

      // If not throttling (desktop), apply immediately
      if (!isMobileRef.current) {
        setChips(transformedChips);
        setBall(transformedBall);
        setActivePlayer(snapshot.activePlayer);
        setAwaitingInput(snapshot.awaitingInput ?? true);
        if (isChallenger) {
          setMyScore(snapshot.challengerScore);
          setRivalScore(snapshot.creatorScore);
        } else {
          setMyScore(snapshot.creatorScore);
          setRivalScore(snapshot.challengerScore);
        }
        turnEndRef.current = snapshot.turnEndsAt;
        setCommentary(snapshot.commentary);
      }
      
      // Verificar si cambió de turno para tracking
      if (lastTurnPlayerRef.current !== null && lastTurnPlayerRef.current !== snapshot.activePlayer) {
        // Cambió el turno - resetear flag de timeout enviado
        // El reset del contador se hace cuando el jugador hace una jugada, no aquí
      }
      lastTurnPlayerRef.current = snapshot.activePlayer;
      
      // Scores desde perspectiva local (only apply immediately on non-mobile)
      if (!isMobileRef.current) {
        if (isChallenger) {
          setMyScore(snapshot.challengerScore);
          setRivalScore(snapshot.creatorScore);
        } else {
          setMyScore(snapshot.creatorScore);
          setRivalScore(snapshot.challengerScore);
        }
      }

      // When throttling, commentary/turnEndsAt are updated from latestSnapshotRef
      if (!isMobileRef.current) {
        turnEndRef.current = snapshot.turnEndsAt;
        setCommentary(snapshot.commentary);
      }
    });

    socketService.onEvent((event) => {
      const myServerSide = isChallenger ? "challenger" : "creator";
      
      if (event.type === "goal-self" && event.from) {
        // Interpretar desde la perspectiva del jugador
        const iScored = event.from === myServerSide;
        if (iScored) {
          setCommentary("¡GOOOL!");
          setGoalAnimation("you");
        } else {
          setCommentary("Gol rival...");
          setGoalAnimation("rival");
        }
        setTimeout(() => setGoalAnimation(null), 2000);
      } else if (event.type === "timeout") {
        // Mostrar animación de turno perdido
        setTurnLostAnimation(true);
        setAim(undefined); // Limpiar aim cuando hay timeout
        setSelectedChipId(null);
        setTimeout(() => setTurnLostAnimation(false), 1500);
        // Incrementar contador local solo para mostrar (el servidor maneja la lógica de derrota)
        if (event.from === myServerSide) {
          setConsecutiveTimeouts(prev => prev + 1);
        } else {
          // El rival perdió un turno, reseteamos nuestro contador
          setConsecutiveTimeouts(0);
        }
      }
    });

    // Listen for rival forfeit
    socketService.onPlayerForfeited((side) => {
      const myServerSide = isChallenger ? "challenger" : "creator";
      if (side !== myServerSide) {
        // Rival forfeited, we win!
        setWinner("you");
        setShowEnd(true);
        setMatchStatus("ended");
        setCommentary("¡Tu rival abandonó!");
      }
    });

    // Listen for match ended
    socketService.onMatchEnded((data) => {
      console.log("[PlayingScreen] matchEnded received:", data);
      const myServerSide = isChallenger ? "challenger" : "creator";
      if (data.winner === myServerSide) {
        setWinner("you");
      } else {
        setWinner("rival");
      }
      setShowEnd(true);
      setMatchStatus("ended");
    });

    // Listen for rematch events
    socketService.onRematchAccepted((data) => {
      // Si hay un nuevo matchId (revancha con blockchain), actualizar
      if (data.matchId && data.matchId !== currentMatchId) {
        setCurrentMatchId(data.matchId);
        // Reconectar al nuevo match
        socketService.joinMatch(data.matchId);
      }
      
      // Reiniciar estado de la partida
      setShowEnd(false);
      setWinner(null);
      setRematchRequested(false);
      setWaitingRematchResponse(false);
      setRivalRequestedRematch(false);
      setMatchStatus("playing");
      setCommentary("¡Revancha! Comienza el partido");
      
      // Pedir sync para obtener el estado inicial
      setTimeout(() => {
        socketService.requestSync();
      }, 200);
    });

    socketService.onRematchDeclined(() => {
      setWaitingRematchResponse(false);
      setRematchRequested(false);
      setRivalRequestedRematch(false);
      setCommentary("El rival rechazó la revancha");
    });

    // Listen for rival rematch request
    socketService.onRematchRequested((data) => {
      const myServerSide = isChallenger ? "challenger" : "creator";
      if (data.fromSide === myServerSide) return;
      setRivalRequestedRematch(true);
      setRivalRematchAlias(data.fromAlias);
    });

    // Listen for blockchain rematch flow
    socketService.onRematchBlockchainRequired(async (data) => {
      const myServerSide = isChallenger ? "challenger" : "creator";
      
      // Solo el lado indicado como initiator crea el match
      if (data.initiatorSide === myServerSide) {
        try {
          setCommentary("Creando nueva partida en blockchain...");
          // Import dinámico para evitar dependencia circular
          const { createMatch } = await import("../services/matchService");
          const { walletService } = await import("../services/walletService");
          
          const result = await createMatch({
            goals: data.matchConfig.goals as 2 | 3 | 5,
            isFree: data.matchConfig.isFree,
            stakeAmount: data.matchConfig.stakeAmount,
            stakeToken: data.matchConfig.stakeToken,
          });
          
          const address = await walletService.getAddress();
          socketService.notifyRematchBlockchainCreated(
            data.oldMatchId,
            String(result.matchId),
            address || ""
          );
        } catch (error) {
          console.error("Error creating rematch on blockchain:", error);
          setCommentary("Error al crear la revancha");
        }
      }
    });

    // Listen for blockchain rematch ready (challenger needs to join)
    socketService.onRematchBlockchainReady(async (data) => {
      const myServerSide = isChallenger ? "challenger" : "creator";
      
      // El challenger se une al nuevo match
      if (myServerSide === "challenger") {
        try {
          setCommentary("Uniéndose a la nueva partida...");
          const { joinMatch } = await import("../services/matchService");
          
          await joinMatch(Number(data.newMatchId));
          
          socketService.notifyRematchBlockchainJoined(data.oldMatchId, data.newMatchId);
          
          // Actualizar matchId en el store
          setCurrentMatchId(data.newMatchId);
        } catch (error) {
          console.error("Error joining rematch on blockchain:", error);
          setCommentary("Error al unirse a la revancha");
        }
      } else {
        // El creator también actualiza su matchId
        setCurrentMatchId(data.newMatchId);
      }
    });

    // Request sync after listeners are registered to ensure we get the current state
    const syncTimeout = setTimeout(() => {
      socketService.requestSync();
    }, 500);

    return () => {
      clearTimeout(syncTimeout);
      socketService.offAll();
      socketService.disconnect();
    };
  }, [currentMatchId, playerSide, isChallenger, setMatchStatus]);

  // Detect mobile and start throttled visual updater
  useEffect(() => {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const mobile = /Mobi|Android|iPhone|iPad|iPod/.test(ua) || window.innerWidth < 720;
    isMobileRef.current = mobile;
    setIsMobile(mobile);

    // Throttle interval: target ~25-30 FPS on mobile
    const throttleMs = mobile ? 40 : 0; // 40ms ~= 25fps

    let interval: ReturnType<typeof setInterval> | undefined = undefined;
    if (mobile) {
      interval = setInterval(() => {
        const snap = latestSnapshotRef.current;
        if (!snap) return;

        setChips(snap.chips);
        setBall(snap.ball);
        setActivePlayer(snap.activePlayer);
        setAwaitingInput(snap.awaitingInput);
        if (isChallenger) {
          setMyScore(snap.challengerScore);
          setRivalScore(snap.creatorScore);
        } else {
          setMyScore(snap.creatorScore);
          setRivalScore(snap.challengerScore);
        }
        turnEndRef.current = snap.turnEndsAt;
        setCommentary(snap.commentary);
      }, throttleMs);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isChallenger]);

  // Timer visual y detección de timeout
  const timeoutSentRef = useRef(false);
  
  useEffect(() => {
    const interval = setInterval(() => {
      // Solo mostrar timer decreciente si estamos esperando input
      if (awaitingInput) {
        const remaining = Math.max(0, turnEndRef.current - Date.now());
        setTimerPercent((remaining / TURN_TIME) * 100);
        
        // Si es mi turno y el tiempo llegó a 0, enviar timeout al servidor
        // El servidor manejará el conteo y emitirá el evento de vuelta
        if (remaining <= 0 && isMyTurn && !timeoutSentRef.current && currentMatchId) {
          console.log("[PlayingScreen] Sending timeout to server for match:", currentMatchId);
          timeoutSentRef.current = true;
          setAim(undefined); // Limpiar flecha de apuntado
          setSelectedChipId(null); // Deseleccionar ficha
          // Localmente marcar que no estamos esperando input para evitar enviar duplicados
          setAwaitingInput(false);
          socketService.sendTimeout(currentMatchId);
        }
      } else {
        // Mientras la pelota se mueve, mostrar barra llena
        setTimerPercent(100);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [isMyTurn, currentMatchId, awaitingInput]);

  // Reset timeout flag cuando cambia de turno O cuando awaitingInput vuelve a true
  const prevAwaitingInputRef = useRef(true);
  useEffect(() => {
    // Reset cuando cambia activePlayer o cuando awaitingInput pasa de false a true
    if (!prevAwaitingInputRef.current && awaitingInput) {
      timeoutSentRef.current = false;
    }
    prevAwaitingInputRef.current = awaitingInput;
  }, [activePlayer, awaitingInput]);

  // Verificar victoria por goles
  useEffect(() => {
    if (showEnd) return;
    if (myScore >= goalTarget) {
      setWinner("you");
      setShowEnd(true);
      setMatchStatus("ended");
    } else if (rivalScore >= goalTarget) {
      setWinner("rival");
      setShowEnd(true);
      setMatchStatus("ended");
    }
  }, [myScore, rivalScore, goalTarget, setMatchStatus, showEnd]);

  const getSvgPoint = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    const svg = e.currentTarget;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM()?.inverse();
    if (!ctm) return { x: 0, y: 0 };
    const p = pt.matrixTransform(ctm);
    return { x: p.x, y: p.y };
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (!isMyTurn || showEnd) return;
    
    // Prevenir comportamientos del navegador y capturar el pointer
    e.preventDefault();
    (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
    
    const { x, y } = getSvgPoint(e);
    
    // Buscar ficha propia cercana (azules = mías)
    const myChips = chips.filter((c) => c.fill === "#00a8ff");
    const hit = myChips.find((c) => Math.hypot(c.x - x, c.y - y) < c.radius + 15);
    
    if (hit) {
      // Guardamos la posición del chip, no del toque
      dragRef.current = { chipId: hit.id, start: { x: hit.x, y: hit.y } };
      setSelectedChipId(hit.id);
      setAim({ from: { x: hit.x, y: hit.y }, to: { x, y } });
      setShotPower(0);
      (globalThis as Record<string, unknown>).shotPower = 0;
    }
  }, [chips, isMyTurn, showEnd, getSvgPoint]);

  const handlePointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragRef.current) return;
    
    const { x, y } = getSvgPoint(e);
    const chip = chips.find((c) => c.id === dragRef.current?.chipId);
    if (!chip) return;

    // Calcular vector de arrastre (desde ficha hacia posición actual del dedo)
    const dragDx = x - chip.x;
    const dragDy = y - chip.y;
    const dist = Math.min(Math.hypot(dragDx, dragDy), MAX_DRAG_DISTANCE);
    
    // Calcular potencia con curva cuadrática (igual que BotMatchScreen)
    const rawPower = dist / (MAX_DRAG_DISTANCE * POWER_CURVE_FACTOR);
    const powerScale = Math.min(1, rawPower * rawPower);
    setShotPower(powerScale);
    (globalThis as Record<string, unknown>).shotPower = powerScale;

    // Limitar la posición del aim a la distancia máxima
    let aimX = x;
    let aimY = y;
    if (dist >= MAX_DRAG_DISTANCE) {
      const angle = Math.atan2(dragDy, dragDx);
      aimX = chip.x + Math.cos(angle) * MAX_DRAG_DISTANCE;
      aimY = chip.y + Math.sin(angle) * MAX_DRAG_DISTANCE;
    }
    
    // Pasamos to como la posición del arrastre
    // PitchCanvas invertirá la dirección para mostrar hacia dónde irá el tiro
    // La línea de apuntado muestra hacia dónde IRÁ la ficha
    setAim({
      from: { x: chip.x, y: chip.y },
      to: { x: aimX, y: aimY }
    });
  }, [chips, getSvgPoint]);

  const handlePointerUp = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragRef.current || !currentMatchId || !isMyTurn) {
      setAim(undefined);
      setShotPower(0);
      dragRef.current = null;
      return;
    }

    const chip = chips.find((c) => c.id === dragRef.current?.chipId);
    if (!chip) {
      setAim(undefined);
      setShotPower(0);
      dragRef.current = null;
      return;
    }

    const { x, y } = getSvgPoint(e);
    // Vector de arrastre (desde ficha hacia donde soltó)
    const dragDx = x - chip.x;
    const dragDy = y - chip.y;
    const dist = Math.min(Math.hypot(dragDx, dragDy), MAX_DRAG_DISTANCE);
    
    if (dist > 20) {
      // === SISTEMA DE POTENCIA (igual que BotMatchScreen) ===
      // Potencia lineal: velocidad = porcentaje * MAX_SPEED
      const normalizedDist = Math.min(1, dist / MAX_DRAG_DISTANCE);
      const targetSpeed = normalizedDist * MAX_SPEED;
      
      // Dirección del tiro = opuesto al arrastre (arrastra abajo = tira arriba)
      // Las coordenadas ya están en espacio visual del jugador
      const dirX = chip.x - x;
      const dirY = chip.y - y;
      const dirMag = Math.hypot(dirX, dirY) || 1;
      
      // Impulso en coordenadas visuales del jugador
      let impulseX = (dirX / dirMag) * targetSpeed;
      let impulseY = (dirY / dirMag) * targetSpeed;

      // Para el challenger, las coordenadas están invertidas visualmente,
      // pero el servidor espera coordenadas del mundo real.
      // La dirección visual es correcta, pero necesitamos invertir para el servidor.
      if (isChallenger) {
        impulseX = -impulseX;
        impulseY = -impulseY;
      }

      // Resetear timeout counter porque hicimos una jugada
      setConsecutiveTimeouts(0);

      socketService.sendInput(currentMatchId, dragRef.current.chipId, {
        dx: impulseX,
        dy: impulseY
      });
    }

    setAim(undefined);
    setShotPower(0);
    setSelectedChipId(null);
    dragRef.current = null;
  }, [currentMatchId, isChallenger, isMyTurn, getSvgPoint, chips]);

  const handlePointerCancel = useCallback(() => {
    setAim(undefined);
    setShotPower(0);
    setSelectedChipId(null);
    dragRef.current = null;
  }, []);

  // ===== iOS TOUCH EVENT HANDLERS =====
  // iOS Safari tiene problemas con pointer events en SVG, usamos touch events como fallback
  const getSvgPointFromTouch = useCallback((touch: React.Touch, svg: SVGSVGElement) => {
    const pt = svg.createSVGPoint();
    pt.x = touch.clientX;
    pt.y = touch.clientY;
    const ctm = svg.getScreenCTM()?.inverse();
    if (!ctm) return { x: 0, y: 0 };
    const p = pt.matrixTransform(ctm);
    return { x: p.x, y: p.y };
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent<SVGSVGElement>) => {
    if (!isMyTurn || showEnd || e.touches.length !== 1) return;
    
    e.preventDefault();
    const touch = e.touches[0];
    const { x, y } = getSvgPointFromTouch(touch, e.currentTarget);
    
    const myChips = chips.filter((c) => c.fill === "#00a8ff");
    const hit = myChips.find((c) => Math.hypot(c.x - x, c.y - y) < c.radius + 15);
    
    if (hit) {
      dragRef.current = { chipId: hit.id, start: { x: hit.x, y: hit.y } };
      setSelectedChipId(hit.id);
      setAim({ from: { x: hit.x, y: hit.y }, to: { x, y } });
      setShotPower(0);
      (globalThis as Record<string, unknown>).shotPower = 0;
    }
  }, [chips, isMyTurn, showEnd, getSvgPointFromTouch]);

  const handleTouchMove = useCallback((e: React.TouchEvent<SVGSVGElement>) => {
    if (!dragRef.current || e.touches.length !== 1) return;
    
    e.preventDefault();
    const touch = e.touches[0];
    const { x, y } = getSvgPointFromTouch(touch, e.currentTarget);
    const chip = chips.find((c) => c.id === dragRef.current?.chipId);
    if (!chip) return;

    const dragDx = x - chip.x;
    const dragDy = y - chip.y;
    const dist = Math.min(Math.hypot(dragDx, dragDy), MAX_DRAG_DISTANCE);
    
    const rawPower = dist / (MAX_DRAG_DISTANCE * POWER_CURVE_FACTOR);
    const powerScale = Math.min(1, rawPower * rawPower);
    setShotPower(powerScale);
    (globalThis as Record<string, unknown>).shotPower = powerScale;

    let aimX = x;
    let aimY = y;
    if (dist >= MAX_DRAG_DISTANCE) {
      const angle = Math.atan2(dragDy, dragDx);
      aimX = chip.x + Math.cos(angle) * MAX_DRAG_DISTANCE;
      aimY = chip.y + Math.sin(angle) * MAX_DRAG_DISTANCE;
    }
    
    setAim({
      from: { x: chip.x, y: chip.y },
      to: { x: aimX, y: aimY }
    });
  }, [chips, getSvgPointFromTouch]);

  const handleTouchEnd = useCallback((e: React.TouchEvent<SVGSVGElement>) => {
    if (!dragRef.current || !currentMatchId || !isMyTurn) {
      setAim(undefined);
      setShotPower(0);
      setSelectedChipId(null);
      dragRef.current = null;
      return;
    }

    e.preventDefault();
    const touch = e.changedTouches[0];
    if (!touch) {
      setAim(undefined);
      setShotPower(0);
      setSelectedChipId(null);
      dragRef.current = null;
      return;
    }

    const chip = chips.find((c) => c.id === dragRef.current?.chipId);
    if (!chip) {
      setAim(undefined);
      setShotPower(0);
      setSelectedChipId(null);
      dragRef.current = null;
      return;
    }

    const { x, y } = getSvgPointFromTouch(touch, e.currentTarget);
    const dragDx = x - chip.x;
    const dragDy = y - chip.y;
    const dist = Math.min(Math.hypot(dragDx, dragDy), MAX_DRAG_DISTANCE);
    
    if (dist > 20) {
      const normalizedDist = Math.min(1, dist / MAX_DRAG_DISTANCE);
      const targetSpeed = normalizedDist * MAX_SPEED;
      
      const dirX = chip.x - x;
      const dirY = chip.y - y;
      const dirMag = Math.hypot(dirX, dirY) || 1;
      
      let impulseX = (dirX / dirMag) * targetSpeed;
      let impulseY = (dirY / dirMag) * targetSpeed;

      if (isChallenger) {
        impulseX = -impulseX;
        impulseY = -impulseY;
      }

      setConsecutiveTimeouts(0);

      socketService.sendInput(currentMatchId, dragRef.current.chipId, {
        dx: impulseX,
        dy: impulseY
      });
    }

    setAim(undefined);
    setShotPower(0);
    setSelectedChipId(null);
    dragRef.current = null;
  }, [currentMatchId, isChallenger, isMyTurn, getSvgPointFromTouch, chips]);

  const handleExit = () => setShowExitConfirm(true);
  const confirmExit = () => {
    setShowExitConfirm(false);
    // If game is not over, forfeit the match
    if (!showEnd && currentMatchId) {
      socketService.sendForfeit(currentMatchId);
    }
    socketService.disconnect();
    // Limpiar estado del store
    setCurrentMatchId(undefined);
    setActiveMatch(undefined);
    setMatchStatus("idle");
    setView("home");
  };
  const cancelExit = () => setShowExitConfirm(false);

  const handleGoHome = async () => {
    if (settling) return;

    // Settle on-chain if we won and haven't reported yet
    if (showEnd && winner === "you" && currentMatchId && !resultReportedRef.current) {
      const matchIdNum = Number.parseInt(currentMatchId, 10);
      const userAddress = useGameStore.getState().userAddress;
      if (matchIdNum && userAddress) {
        setSettling(true);
        try {
          await reportResult(matchIdNum, userAddress);
          resultReportedRef.current = true;
        } catch (err) {
          console.error("[PlayingScreen] Error reporting result:", err);
          // Continue to home even if reporting fails (might be free match)
        } finally {
          setSettling(false);
        }
      }
    }

    socketService.disconnect();
    // Limpiar estado del store
    setCurrentMatchId(undefined);
    setActiveMatch(undefined);
    setMatchStatus("idle");
    setView("home");
  };

  const handleRequestRematch = async () => {
    if (!currentMatchId || waitingRematchResponse || settling) return;

    // Settle on-chain if we won and haven't reported yet
    if (showEnd && winner === "you" && !resultReportedRef.current) {
      const matchIdNum = Number.parseInt(currentMatchId, 10);
      const userAddress = useGameStore.getState().userAddress;
      if (matchIdNum && userAddress) {
        setSettling(true);
        try {
          await reportResult(matchIdNum, userAddress);
          resultReportedRef.current = true;
        } catch (err) {
          console.error("[PlayingScreen] Error reporting result:", err);
          // Continue with rematch even if reporting fails
        } finally {
          setSettling(false);
        }
      }
    }

    socketService.requestRematch(currentMatchId, alias);
    setRematchRequested(true);
    setWaitingRematchResponse(true);
  };

  const handleAcceptRematch = () => {
    if (!currentMatchId) return;
    socketService.acceptRematch(currentMatchId);
    setRivalRequestedRematch(false);
    setWaitingRematchResponse(true);
  };

  const handleDeclineRematch = () => {
    if (!currentMatchId) return;
    socketService.declineRematch(currentMatchId);
    setRivalRequestedRematch(false);
  };

  // Momentum bar como en BotMatchScreen
  const momentum = myScore - rivalScore;
  const momentumPercent = 50 + (momentum / Math.max(1, goalTarget)) * 50;

  return (
    <div className="playing-screen">
      {/* Header con scores estilo BotMatch */}
      <div className="game-header">
        <button className="exit-btn" onClick={handleExit}>✕</button>
        
        <div className="score-section">
          <div className="player-score-box me">
            <span className="score-label">TÚ</span>
            <span className="score-value">{myScore}</span>
          </div>
          
          <div className="vs-section">
            <span className="vs-text">VS</span>
            <span className="goal-target">Meta: {goalTarget}</span>
          </div>
          
          <div className="player-score-box rival">
            <span className="score-label">RIVAL</span>
            <span className="score-value">{rivalScore}</span>
          </div>
        </div>
      </div>

      {/* Momentum bar */}
      <div className="momentum-bar">
        <div className="momentum-fill me" style={{ width: `${momentumPercent}%` }} />
        <div className="momentum-fill rival" style={{ width: `${100 - momentumPercent}%` }} />
      </div>

      {/* Timer bar */}
      <div className="turn-timer">
        <div 
          className="timer-bar" 
          style={{ 
            width: `${timerPercent}%`,
            backgroundColor: timerPercent > 30 ? '#00ff6a' : timerPercent > 10 ? '#ffaa00' : '#ff4444'
          }} 
        />
      </div>

      {/* Turn indicator */}
      <div className={`turn-indicator ${isMyTurn ? 'my-turn' : 'rival-turn'}`}>
        {isMyTurn ? "🎯 TU TURNO" : "⏳ TURNO RIVAL"}
      </div>

      {/* Power meter cuando arrastra */}
      {shotPower > 0 && (() => {
        // Interpolación de color continua: verde -> amarillo -> naranja -> rojo
        const lerpColor = (c1: [number, number, number], c2: [number, number, number], t: number) => {
          const r = Math.round(c1[0] + (c2[0] - c1[0]) * t);
          const g = Math.round(c1[1] + (c2[1] - c1[1]) * t);
          const b = Math.round(c1[2] + (c2[2] - c1[2]) * t);
          return `rgb(${r}, ${g}, ${b})`;
        };
        const green: [number, number, number] = [0, 255, 106];
        const yellow: [number, number, number] = [255, 170, 0];
        const red: [number, number, number] = [255, 68, 68];
        
        let bgColor: string;
        if (shotPower < 0.5) {
          bgColor = lerpColor(green, yellow, shotPower / 0.5);
        } else {
          bgColor = lerpColor(yellow, red, (shotPower - 0.5) / 0.5);
        }
        
        return (
          <div className="power-meter">
            <div className="power-fill" style={{ 
              width: `${shotPower * 100}%`,
              backgroundColor: bgColor
            }} />
            <span className="power-label">{Math.round(shotPower * 100)}%</span>
          </div>
        );
      })()}

      {/* Pitch */}
      <PitchCanvas
        chips={chips}
        ball={ball}
        highlightId={selectedChipId ?? undefined}
        activePlayer={activePlayer}
        isPlayerTurn={isMyTurn}
        aimLine={aim}
        shotPower={shotPower}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        lowPerf={isMobile}
      />

      {/* Commentary */}
      <div className="commentary">
        {!connected ? "🔄 Conectando al servidor..." : commentary}
      </div>

      {/* Animación de GOL */}
      {goalAnimation && (
        <div className={`goal-overlay ${goalAnimation === "you" ? "goal-you" : "goal-rival"}`}>
          <div className="goal-text">
            {goalAnimation === "you" ? "⚽ ¡GOOOL!" : "😔 Gol rival"}
          </div>
        </div>
      )}

      {/* Animación de turno perdido */}
      {turnLostAnimation && (
        <div className="turn-lost-overlay">
          <div className="turn-lost-text">⏱️ Turno perdido</div>
        </div>
      )}

      {/* Player info */}
      <div className="player-info">
        <span className="player-alias">{alias}</span>
        <span className="player-side">({isChallenger ? "Retador" : "Creador"})</span>
      </div>

      {/* Exit confirmation */}
      {showExitConfirm && (
        <div className="modal-overlay">
          <div className="modal-box">
            <p>¿Salir de la partida?</p>
            <p className="modal-subtitle">Perderás la partida</p>
            <div className="modal-buttons">
              <button className="modal-btn cancel" onClick={cancelExit}>Cancelar</button>
              <button className="modal-btn confirm" onClick={confirmExit}>Salir</button>
            </div>
          </div>
        </div>
      )}

      {/* End screen */}
      {showEnd && (
        <div className="modal-overlay">
          <div className="modal-box end-modal">
            <div className={`end-icon ${winner === "you" ? "win" : "lose"}`}>
              {winner === "you" ? "🏆" : "😢"}
            </div>
            <h2 className={winner === "you" ? "win-title" : "lose-title"}>
              {winner === "you" ? "¡VICTORIA!" : "DERROTA"}
            </h2>
            <p className="final-score">{myScore} - {rivalScore}</p>
            <div className="modal-buttons">
              {/* Rematch button disabled temporarily
              <button 
                className="modal-btn secondary" 
                onClick={handleRequestRematch}
                disabled={waitingRematchResponse || rivalRequestedRematch || settling}
              >
                {settling ? "💳 Cobrando..." : waitingRematchResponse ? "⏳ Esperando..." : "🔄 Revancha"}
              </button>
              */}
              <button className="modal-btn primary" onClick={handleGoHome} disabled={settling}>
                {settling ? "💳 Cobrando..." : "🏠 Inicio"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rival rematch request popup */}
      {rivalRequestedRematch && (
        <div className="modal-overlay">
          <div className="modal-box rematch-modal">
            <div className="rematch-icon">🔄</div>
            <h2 className="rematch-title">¡Revancha!</h2>
            <p className="rematch-message">
              {rivalRematchAlias || "Tu rival"} quiere la revancha
            </p>
            <div className="modal-buttons">
              <button 
                className="modal-btn primary" 
                onClick={handleAcceptRematch}
              >
                ✓ Aceptar
              </button>
              <button 
                className="modal-btn secondary" 
                onClick={handleDeclineRematch}
              >
                ✕ Rechazar
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .playing-screen {
          min-height: 100vh;
          min-height: 100dvh;
          min-height: -webkit-fill-available;
          height: 100%;
          background: linear-gradient(180deg, #001a00 0%, #000 100%);
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 4px;
          padding-top: max(4px, env(safe-area-inset-top));
          padding-bottom: max(4px, env(safe-area-inset-bottom));
          padding-left: env(safe-area-inset-left);
          padding-right: env(safe-area-inset-right);
          overflow: hidden;
          box-sizing: border-box;
          -webkit-overflow-scrolling: touch;
          gap: 4px;
        }

        .game-header {
          width: 100%;
          max-width: 600px;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 4px 8px;
        }

        .exit-btn {
          background: rgba(255,77,90,0.2);
          border: 1px solid #ff4d5a;
          color: #ff4d5a;
          font-size: 16px;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          cursor: pointer;
          transition: all 0.2s;
        }
        .exit-btn:hover {
          background: #ff4d5a;
          color: #000;
        }

        .score-section {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
        }

        .player-score-box {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 4px 12px;
          border-radius: 8px;
          min-width: 50px;
        }
        .player-score-box.me {
          background: rgba(0,168,255,0.15);
          border: 1px solid #00a8ff;
        }
        .player-score-box.rival {
          background: rgba(255,77,90,0.15);
          border: 1px solid #ff4d5a;
        }

        .score-label {
          font-size: 10px;
          font-weight: 600;
          opacity: 0.8;
        }
        .player-score-box.me .score-label { color: #00a8ff; }
        .player-score-box.rival .score-label { color: #ff4d5a; }

        .score-value {
          font-size: 22px;
          font-weight: bold;
          color: #fff;
        }

        .vs-section {
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .vs-text {
          font-size: 14px;
          font-weight: bold;
          color: #666;
        }
        .goal-target {
          font-size: 10px;
          color: #888;
        }

        .momentum-bar {
          width: 100%;
          max-width: 600px;
          height: 4px;
          background: #222;
          border-radius: 2px;
          display: flex;
          overflow: hidden;
          margin-bottom: 2px;
        }
        .momentum-fill.me {
          background: linear-gradient(90deg, #00a8ff, #00ff6a);
          transition: width 0.3s;
        }
        .momentum-fill.rival {
          background: linear-gradient(90deg, #ff4d5a, #ff8800);
          transition: width 0.3s;
        }

        .turn-timer {
          width: 100%;
          max-width: 600px;
          height: 8px;
          background: #111;
          border-radius: 4px;
          overflow: hidden;
          margin-bottom: 8px;
          border: 1px solid #333;
        }

        .timer-bar {
          height: 100%;
          transition: width 0.1s linear;
          box-shadow: 0 0 10px currentColor;
        }

        .turn-indicator {
          padding: 10px 24px;
          border-radius: 20px;
          font-weight: bold;
          font-size: 14px;
          margin-bottom: 10px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .my-turn {
          background: rgba(0, 168, 255, 0.2);
          color: #00a8ff;
          border: 1px solid #00a8ff;
          animation: pulse 1s ease-in-out infinite;
        }
        .rival-turn {
          background: rgba(255, 77, 90, 0.15);
          color: #ff4d5a;
          border: 1px solid rgba(255, 77, 90, 0.5);
        }
        .timeout-warning {
          color: #ffaa00;
          font-size: 12px;
        }

        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(0, 168, 255, 0.4); }
          50% { box-shadow: 0 0 0 8px rgba(0, 168, 255, 0); }
        }

        .power-meter {
          width: 200px;
          height: 20px;
          background: #111;
          border-radius: 10px;
          overflow: hidden;
          margin-bottom: 8px;
          position: relative;
          border: 1px solid #333;
        }
        .power-fill {
          height: 100%;
          transition: width 0.05s;
        }
        .power-label {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          color: #fff;
          font-size: 12px;
          font-weight: bold;
          text-shadow: 0 0 4px #000;
        }

        .commentary {
          color: #00ff6a;
          font-size: 14px;
          margin-top: 12px;
          text-align: center;
          padding: 8px 16px;
          background: rgba(0, 255, 106, 0.1);
          border-radius: 8px;
        }

        .player-info {
          display: flex;
          gap: 8px;
          margin-top: 8px;
          color: #888;
          font-size: 13px;
        }
        .player-alias { color: #00a8ff; }

        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.9);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
        }

        .modal-box {
          background: linear-gradient(180deg, #1a1a1a 0%, #0a0a0a 100%);
          border: 1px solid #333;
          border-radius: 20px;
          padding: 28px;
          text-align: center;
          min-width: 300px;
        }
        .modal-box p {
          color: #fff;
          margin-bottom: 8px;
          font-size: 18px;
        }
        .modal-subtitle {
          color: #888 !important;
          font-size: 14px !important;
        }

        .modal-buttons {
          display: flex;
          gap: 12px;
          margin-top: 24px;
          justify-content: center;
        }

        .modal-btn {
          padding: 14px 28px;
          border-radius: 12px;
          font-weight: bold;
          cursor: pointer;
          border: none;
          font-size: 15px;
          transition: transform 0.1s;
        }
        .modal-btn:active {
          transform: scale(0.95);
        }
        .modal-btn.cancel {
          background: #333;
          color: #fff;
        }
        .modal-btn.confirm {
          background: #ff4d5a;
          color: #fff;
        }
        .modal-btn.primary {
          background: linear-gradient(135deg, #00ff6a, #00cc55);
          color: #000;
        }
        .modal-btn.secondary {
          background: #333;
          color: #fff;
        }

        .end-modal .end-icon {
          font-size: 48px;
          margin-bottom: 12px;
        }
        .end-icon.win {
          animation: bounce 0.5s ease-out;
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }

        .end-modal h2 {
          font-size: 28px;
          margin-bottom: 12px;
        }
        .win-title { color: #00ff6a; text-shadow: 0 0 20px #00ff6a; }
        .lose-title { color: #ff4d5a; }

        .final-score {
          font-size: 32px;
          color: #fff;
          font-weight: bold;
          margin-bottom: 8px;
        }

        /* Rematch popup styles */
        .rematch-modal .rematch-icon {
          font-size: 48px;
          margin-bottom: 12px;
          animation: spin 1s ease-in-out;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .rematch-title {
          font-size: 24px;
          color: #00ff6a;
          margin-bottom: 8px;
        }
        .rematch-message {
          font-size: 16px;
          color: #ccc;
          margin-bottom: 16px;
        }
      `}</style>
    </div>
  );
}
