import { CSSProperties, ReactNode } from "react";

interface NeonButtonProps {
  label: string;
  onClick?: () => void;
  icon?: ReactNode;
  fullWidth?: boolean;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  style?: CSSProperties;
}

/**
 * Shared CTA button. The gradient / glow styling is defined in CSS but the component
 * centralizes logic for variants and disabled states so all screens remain consistent.
 */
export function NeonButton({ label, onClick, icon, fullWidth, variant = "primary", disabled, type = "button", style }: Readonly<NeonButtonProps>) {
  const gradient = {
    primary: "linear-gradient(120deg, #1e8f32, #00ff9d)",
    secondary: "linear-gradient(120deg, #0f2b24, #1e8f32)",
    danger: "linear-gradient(120deg, #7e1322, #ff4f64)"
  }[variant];

  return (
    <button
      className="neon-button"
      style={{ width: fullWidth ? "100%" : "auto", backgroundImage: gradient, ...style }}
      onClick={onClick}
      disabled={disabled}
      type={type}
    >
      {icon && <span style={{ marginRight: "0.65rem", display: "inline-flex" }}>{icon}</span>}
      {label}
    </button>
  );
}
