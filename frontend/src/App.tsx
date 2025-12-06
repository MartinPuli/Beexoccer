import { useEffect } from "react";
import { TopNav } from "./components/TopNav";
import { useGameStore } from "./hooks/useGameStore";
import { AcceptMatchScreen, BotMatchScreen, CreateMatchScreen, HomeScreen, PlayingScreen } from "./views";
import { xoConnectService } from "./services/xoConnectService";

/**
 * Root component orchestrating navigation between screens. The store keeps the current view id so we
 * can avoid adding a full router until V2 when deep links and sharable lobby URLs are required.
 */
export default function App() {
  const view = useGameStore((state) => state.view);
  const setView = useGameStore((state) => state.setView);
  const setAlias = useGameStore((state) => state.setAlias);
  const setBalance = useGameStore((state) => state.setBalance);

  useEffect(() => {
    /**
     * On mount we initialize XO-CONNECT (or the dev fallback) and hydrate alias/balance. An actual XO balance
     * endpoint will replace the mocked value as soon as the wallet exposes it via the SDK.
     */
    void (async () => {
      await xoConnectService.init();
      setAlias(xoConnectService.getAlias());
      setBalance("Demo 15.2 XO"); // TODO: read from XO-CONNECT balance endpoint once published.
    })();
  }, [setAlias, setBalance]);

  const renderView = () => {
    switch (view) {
      case "create":
        return <CreateMatchScreen />;
      case "accept":
        return <AcceptMatchScreen />;
      case "playing":
        return <PlayingScreen />;
      case "bot":
        return <BotMatchScreen />;
      default:
        return <HomeScreen />;
    }
  };

  return (
    <div className="app-shell">
      <TopNav onPlayBot={() => setView("bot")} />
      {renderView()}
    </div>
  );
}
