import { createRoot } from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { PinWindow } from "./components/PinWindow";
import "./styles/app.css";
import "./styles/pin.css";

createRoot(document.getElementById("root")!).render(
  <PinWindow label={getCurrentWindow().label} />,
);
