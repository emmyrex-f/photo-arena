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
