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
      <header className="tone-dark fixed inset-x-0 top-0 z-50 border-b border-accent/30 bg-gradient-to-r from-ink via-[#2c241c] to-ink shadow-nav">
        <div className="mx-auto flex max-w-site items-center justify-between px-gutter py-eyebrow">
          <NavLink to="/" className="flex items-center" onClick={() => setOpen(false)}>
            <img src="/logo.png" alt="" className="h-10 w-auto sm:h-[52px]" />
            <span className="sr-only">{site.name}</span>
          </NavLink>

          <nav className="hidden items-center gap-1 lg:flex xl:gap-2" aria-label="Primary">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === "/"}
                className={({ isActive }) =>
                  cn(
                    "rounded-lg px-3 py-1.5 text-sm font-subtitle tracking-wide transition-colors",
                    isActive
                      ? "bg-accent/15 text-accent"
                      : "text-sage hover:bg-white/5 hover:text-accent",
                  )
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          <button
            type="button"
            className="inline-flex min-h-11 min-w-11 items-center justify-center text-sage lg:hidden"
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
            className="border-t border-accent/20 bg-ink px-gutter py-stack-sm lg:hidden"
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
                        "block min-h-11 rounded-lg px-3 py-3 text-base",
                        isActive ? "bg-accent/15 text-accent" : "text-sage",
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
      </header>
      <div className="h-[var(--pa-nav-h)] shrink-0" aria-hidden="true" />
    </>
  );
}
