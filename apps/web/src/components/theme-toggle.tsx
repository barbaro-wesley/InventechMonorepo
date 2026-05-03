"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  // Avoid hydration mismatch
  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button
        className="w-9 h-9 rounded-full flex items-center justify-center text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        aria-label="Alternar tema"
      >
        <span className="w-4 h-4" />
      </button>
    );
  }

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="w-9 h-9 rounded-full flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
      aria-label="Alternar tema"
    >
      {theme === "dark" ? (
        <Sun className="w-4 h-4" />
      ) : (
        <Moon className="w-4 h-4" />
      )}
    </button>
  );
}

export function ThemeToggleMenuItem() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors opacity-50">
        <span className="w-4 h-4 mr-2" />
        Alternar Tema
      </div>
    );
  }

  return (
    <div
      onClick={(e) => {
        e.preventDefault();
        setTheme(theme === "dark" ? "light" : "dark");
      }}
      className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-50 focus:bg-zinc-100 focus:text-zinc-900 dark:focus:bg-zinc-800 dark:focus:text-zinc-50"
    >
      {theme === "dark" ? (
        <Sun className="w-4 h-4 mr-2" />
      ) : (
        <Moon className="w-4 h-4 mr-2" />
      )}
      {theme === "dark" ? "Modo Claro" : "Modo Escuro"}
    </div>
  );
}
