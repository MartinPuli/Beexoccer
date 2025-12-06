import { ReactNode } from "react";

interface PanelProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

/**
 * Lightweight glass panel wrapper to keep typography + spacing consistent across views.
 */
export function Panel({ title, subtitle, children }: Readonly<PanelProps>) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      {subtitle && <p>{subtitle}</p>}
      <div style={{ marginTop: "1rem" }}>{children}</div>
    </section>
  );
}
