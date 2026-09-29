import { createRoot } from "react-dom/client";
import { CaptureOverlay } from "./components/CaptureOverlay";
import "./styles/app.css";
import "./styles/capture.css";

createRoot(document.getElementById("root")!).render(<CaptureOverlay />);
