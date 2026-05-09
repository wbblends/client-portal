"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

type Theme = "light" | "dark";

const STORAGE_KEY = "wbb.theme";

/**
 * Sun/moon toggle bound to the `data-theme` attribute on `<html>`. Persists in
 * localStorage so the choice carries across reloads. The pre-paint script in
 * `app/layout.tsx` reads the same key to set the attribute *before* React
 * hydrates, so there's no flash of wrong theme on initial load.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const initial =
      (document.documentElement.getAttribute("data-theme") as Theme | null) ?? "light";
    setTheme(initial);
    setMounted(true);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // private mode — silently degrade to in-memory
    }
  }

  // Render a static placeholder until mounted so server + client match.
  // (Otherwise the icon swap would hydrate-mismatch when the pre-paint
  // script has already set dark mode.)
  if (!mounted) {
    return (
      <button
        type="button"
        aria-hidden
        tabIndex={-1}
        className={cn(
          "rounded-md p-1.5 text-muted opacity-0",
          className,
        )}
      >
        <Sun className="h-4 w-4" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      title={theme === "dark" ? "Light mode" : "Dark mode"}
      className={cn(
        "rounded-md p-1.5 text-muted hover:bg-accent hover:text-foreground transition-colors",
        className,
      )}
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
