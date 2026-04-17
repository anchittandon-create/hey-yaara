import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Silence known browser extension noise
window.addEventListener("unhandledrejection", (event) => {
  const msg = String(event.reason || "")
  if (msg.includes("message channel closed")) {
    event.preventDefault()
    return
  }
})
window.addEventListener("error", (event) => {
  if (event.message?.includes("message channel closed")) {
    event.preventDefault()
  }
})

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.warn("[PWA] Service worker registration failed:", error);
    });
  });
}
