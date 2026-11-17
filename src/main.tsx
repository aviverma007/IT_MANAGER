import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

try {
  const theme = localStorage.getItem("itm.theme");
  document.documentElement.classList.toggle("dark", theme !== "light");
} catch {
  /* storage blocked */
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
