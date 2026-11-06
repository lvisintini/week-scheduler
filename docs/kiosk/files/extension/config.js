// ===== Kiosk settings: edit this file, then restart the kiosk =====
self.KIOSK_CONFIG = {
  // Seconds each screen is shown while rotating (minimum 30).
  rotateSeconds: 60,

  // After you tap Home and walk away, rotation restarts by itself after
  // this many minutes without a touch. 0 = never. It never auto-resumes
  // while a recipe is open.
  autoResumeMinutes: 15,

  // Screens that rotate, in order. "url" can be a web address or one of
  // the built-in pages: "clock.html", "weather.html".
  rotation: [
    { id: "planner", title: "Week planner", url: "https://lvisintini.github.io/week-scheduler/" },
    { id: "weather", title: "Weather",      url: "weather.html" },
    { id: "clock",   title: "Clock",        url: "clock.html" }
  ],

  // Recipes shown as buttons on the launcher.
  recipes: [
    { title: "Recipe one", url: "https://example.com/recipe-one" },
    { title: "Recipe two", url: "https://example.com/recipe-two" }
  ],

  // Location for the weather page (find yours on a map site).
  weather: { place: "London", latitude: 51.5072, longitude: -0.1276 },

  // Where the small Home button sits on every page:
  // "bottom-right", "bottom-left", "top-right" or "top-left".
  homeButtonCorner: "bottom-right"
};
