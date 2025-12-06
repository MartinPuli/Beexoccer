import { MatchEvent } from "../types/game";

interface EventOverlayProps {
  event?: MatchEvent;
}

/**
 * Animated overlay for goals and skipped turns. The styling is defined in theme.css with neon bursts / shakes.
 */
export function EventOverlay({ event }: Readonly<EventOverlayProps>) {
  if (!event) return null;

  const className = `event-overlay ${event.type}`;

  return (
    <div className={className} key={event.timestamp}>
      <span>{event.message}</span>
    </div>
  );
}
