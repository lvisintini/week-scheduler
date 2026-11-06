function tick() {
  const d = new Date();
  document.getElementById("time").textContent =
    d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  document.getElementById("date").textContent =
    d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}
tick(); setInterval(tick, 1000);
