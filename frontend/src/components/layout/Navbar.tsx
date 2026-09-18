import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { navLinks, site } from "../../lib/site";
import { cn } from "../../lib/cn";

export function Navbar() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      <header
        className="fixed inset-x-0 top-0 z-40 bg-bg"
        style={{ backgroundColor: "var(--color-bg)" }}
      >
        <div className="mx-auto flex max-w-site items-center justify-between px-gutter py-eyebrow">
          <NavLink to="/" className="flex items-center" onClick={() => setOpen(false)}>
            <img src="/logo.png" alt="" className="h-[56px] w-auto sm:h-[68px]" />
            <span className="sr-only">{site.name}</span>
          </NavLink>

          <nav className="hidden items-center gap-5 lg:flex xl:gap-7" aria-label="Primary">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === "/"}
                className={({ isActive }) =>
                  cn(
                    "text-sm tracking-wide transition-colors",
                    isActive ? "text-accent-hover" : "text-text-secondary hover:text-text",
                  )
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          <button
            type="button"
            className="inline-flex min-h-11 min-w-11 items-center justify-center text-text lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
            <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
          </button>
        </div>

        {open ? (
          <nav
            id="mobile-nav"
            className="border-t border-elevated bg-bg px-gutter py-stack-sm lg:hidden"
            style={{ backgroundColor: "var(--color-bg)" }}
            aria-label="Mobile"
          >
            <ul className="flex flex-col gap-1">
              {navLinks.map((link) => (
                <li key={link.to}>
                  <NavLink
                    to={link.to}
                    end={link.to === "/"}
                    onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        "block min-h-11 py-3 text-base",
                        isActive ? "text-accent-hover" : "text-text",
                      )
                    }
                  >
                    {link.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
        <div aria-hidden="true" className="nav-edge pointer-events-none absolute inset-x-0 top-full h-8" />
      </header>
      <div className="h-[var(--pa-nav-h)] shrink-0" aria-hidden="true" />
    </>
  );
}
