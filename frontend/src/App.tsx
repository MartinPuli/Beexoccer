import { useEffect } from "react";
import { useGameStore } from "./hooks/useGameStore";
import { AcceptMatchScreen, BotMatchScreen, CreateBotMatchScreen, CreateMatchScreen, HomeScreen, PlayingScreen } from "./views";
import { xoConnectService } from "./services/xoConnectService";

export default function App() {
  const view = useGameStore((state) => state.view);
  const setAlias = useGameStore((state) => state.setAlias);
  const setBalance = useGameStore((state) => state.setBalance);

  useEffect(() => {
    void (async () => {
      await xoConnectService.init();
      setAlias(xoConnectService.getAlias());
      setBalance("Demo 15.2 XO");
    })();
  }, [setAlias, setBalance]);

  switch (view) {
    case "create":
      return <CreateMatchScreen />;
    case "createBot":
      return <CreateBotMatchScreen />;
    case "accept":
      return <AcceptMatchScreen />;
    case "playing":
      return <PlayingScreen />;
    case "bot":
      return <BotMatchScreen />;
    default:
      return <HomeScreen />;
  }
}
