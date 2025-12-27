import React from "react";
import ReactDOM from "react-dom/client";
import "modern-css-reset";
import "./styles/theme.css";
import "./styles/layout.css";
import App from "./App";
import { DaimoPayProvider } from "./components/DaimoPayProvider";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <DaimoPayProvider>
      <App />
    </DaimoPayProvider>
  </React.StrictMode>
);
