import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import { App } from "./App";
import { ConsentProvider } from "./lib/consent";
import { SiteSettingsProvider } from "./lib/settings";
import "./index.css";

if ("scrollRestoration" in window.history) {
  window.history.scrollRestoration = "manual";
}

const bootStartedAt = performance.now();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HelmetProvider>
      <SiteSettingsProvider>
        <ConsentProvider>
          <App />
        </ConsentProvider>
      </SiteSettingsProvider>
    </HelmetProvider>
  </StrictMode>,
);

function dismissPaBoot() {
  const boot = document.getElementById("pa-boot");
  if (!boot) return;
  const hide = () => {
    boot.classList.add("is-done");
    window.setTimeout(() => boot.remove(), 280);
  };
  const remaining = Math.max(0, 480 - (performance.now() - bootStartedAt));
  window.setTimeout(() => window.requestAnimationFrame(hide), remaining);
}

dismissPaBoot();
