// Applies the saved theme before the page paints, so there's no flash of the wrong colors.
// Choices: "system" (follows the device setting), "light", "white", "dark".
(() => {
  "use strict";
  const KEY = "fauwx.theme";
  const THEMES = ["system", "light", "white", "dark"];
  const media = window.matchMedia("(prefers-color-scheme: dark)");

  function saved() {
    try {
      const v = localStorage.getItem(KEY);
      return THEMES.includes(v) ? v : "system";
    } catch { return "system"; }
  }

  function apply(choice) {
    const resolved = choice === "system" ? (media.matches ? "dark" : "light") : choice;
    document.documentElement.dataset.theme = resolved;
    document.documentElement.dataset.themeChoice = choice;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = resolved === "dark" ? "#0b1726" : "#003366";
  }

  apply(saved());

  // Keep "system" in sync if the device switches between light and dark.
  media.addEventListener("change", () => {
    if (saved() === "system") apply("system");
  });

  window.FAUTheme = {
    THEMES,
    current: saved,
    set(choice) {
      if (!THEMES.includes(choice)) return;
      try { localStorage.setItem(KEY, choice); } catch { /* ignore */ }
      apply(choice);
    },
  };
})();
