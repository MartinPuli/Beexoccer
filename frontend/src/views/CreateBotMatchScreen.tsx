import { FormEvent, useState } from "react";
import { useGameStore } from "../hooks/useGameStore";
import { GoalTarget } from "../types/game";

export function CreateBotMatchScreen() {
  const [goals, setGoals] = useState<GoalTarget>(3);
  const setView = useGameStore((state) => state.setView);
  const setMatchGoalTarget = useGameStore((state) => state.setMatchGoalTarget);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setMatchGoalTarget(goals);
    setView("bot");
  };

  return (
    <div className="create-screen">
      <div className="create-header">
        <button className="create-back" onClick={() => setView("home")}>←</button>
        <span className="create-title">Jugar vs Bot</span>
        <span style={{ width: 32 }} />
      </div>

      <form className="create-body" onSubmit={handleSubmit}>
        <div className="create-section">
          <span className="create-label">Meta de goles</span>
          <div className="goals-row">
            {([2, 3, 5] as GoalTarget[]).map((n) => (
              <button
                key={n}
                type="button"
                className={`goal-btn ${goals === n ? "active" : ""}`}
                onClick={() => setGoals(n)}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </form>

      <div className="create-footer">
        <button type="submit" className="create-submit" onClick={handleSubmit}>
          Entrar a la cancha
        </button>
      </div>
    </div>
  );
}
