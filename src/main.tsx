import { createRoot } from "react-dom/client";
import { AppRouter } from "./AppRouter.tsx";
import "./index.css";

if (import.meta.env.DEV) {
  const hideLovableEditButton = () => {
    const buttons = Array.from(document.querySelectorAll<HTMLElement>("a, button, div"));

    buttons.forEach((element) => {
      const label = element.textContent?.trim().toLowerCase();
      if (label?.includes("edit with lovable")) {
        element.style.opacity = "0";
        element.style.pointerEvents = "none";
        element.style.transition = "opacity 200ms ease";
      }
    });
  };

  const observer = new MutationObserver(() => {
    window.setTimeout(hideLovableEditButton, 2500);
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.setTimeout(hideLovableEditButton, 2500);
}

createRoot(document.getElementById("root")!).render(<AppRouter />);
