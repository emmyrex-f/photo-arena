import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { AnalyticsLoader } from "../../lib/analytics";
import { CookieBanner } from "./CookieBanner";
import { Footer } from "./Footer";
import { Navbar } from "./Navbar";
import { MobileBookBar, WhatsAppFab } from "./SiteChrome";

export function SiteLayout() {
  const { pathname } = useLocation();
  const hideBookBar = pathname.startsWith("/book");

  useEffect(() => {
    document.documentElement.classList.toggle("pa-book-bar-off", hideBookBar);
    return () => document.documentElement.classList.remove("pa-book-bar-off");
  }, [hideBookBar]);

  // #region agent log
  useEffect(() => {
    const section = document.querySelector("main section");
    const header = document.querySelector("main > div");
    const container = document.querySelector("main .px-gutter");
    const se = document.scrollingElement;
    const hasRule = [...document.styleSheets].some((sheet) => {
      try {
        return [...sheet.cssRules].some((rule) => (rule.cssText || "").includes(".px-gutter"));
      } catch {
        return false;
      }
    });
    fetch("http://127.0.0.1:7692/ingest/cb172e59-2268-4533-a30f-2583756cd36a", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "399eda" },
      body: JSON.stringify({
        sessionId: "399eda",
        runId: "mobile-audit",
        hypothesisId: "A",
        location: "SiteLayout.tsx:spacing",
        message: "public mobile spacing + overflow",
        data: {
          path: pathname,
          inner: window.innerWidth,
          scrollW: se?.scrollWidth ?? null,
          overflow: (se?.scrollWidth ?? 0) > window.innerWidth + 2,
          sectionPt: section ? getComputedStyle(section).paddingTop : null,
          headerPt: header ? getComputedStyle(header).paddingTop : null,
          gutterPl: container ? getComputedStyle(container).paddingLeft : null,
          hasPxGutterRule: hasRule,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
  }, [pathname]);
  // #endregion

  return (
    <div className="flex min-h-dvh min-w-0 flex-col bg-bg">
      <AnalyticsLoader />
      <Navbar />
      <main id="main" className="min-w-0 flex-1">
        <Outlet />
      </main>
      <Footer />
      <CookieBanner />
      <WhatsAppFab />
      <MobileBookBar />
    </div>
  );
}
