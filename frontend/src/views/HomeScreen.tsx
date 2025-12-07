import { useGameStore } from "../hooks/useGameStore";
import logoSvg from "../assets/logo.svg";

export function HomeScreen() {
  const setView = useGameStore((state) => state.setView);
  const alias = useGameStore((state) => state.alias);

  return (
    <div className="home-screen">
      {/* Logo con pelota neón */}
      <div className="home-logo">
        <img src={logoSvg} alt="Beexoccer" className="home-logo-img" />
      </div>

      {/* Botones principales */}
      <button className="home-btn primary" onClick={() => setView("accept")}>
        JUGAR 1 VS 1
      </button>

      <button className="home-btn primary" onClick={() => setView("createBot")}>
        JUGAR CONTRA BOT
      </button>

      {/* Torneos como en el mock */}
      <div className="torneos-box">
        <span className="torneos-lock">🔒</span>
        <span className="torneos-soon">PRÓXIMAMENTE</span>
        <span className="torneos-title">TORNEOS</span>
      </div>

      {/* Wallet */}
      <p className="home-wallet">
        Wallet Conectada: {alias || "0x1234..."}
      </p>
    </div>
  );
}
