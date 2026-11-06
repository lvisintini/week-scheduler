const CFG = self.KIOSK_CONFIG;
const $ = (id) => document.getElementById(id);
const send = (msg) => chrome.runtime.sendMessage(msg).then(render);

function button(label, onClick) {
  const b = document.createElement("button");
  b.textContent = label;
  b.addEventListener("click", onClick);
  return b;
}

CFG.rotation.forEach(p => $("screens").append(button(p.title, () => send({ cmd: "show", id: p.id }))));
CFG.recipes.forEach(r => $("recipes").append(button(r.title, () => send({ cmd: "recipe", url: r.url }))));

$("back").onclick   = () => send({ cmd: "backToRecipe" });
$("close").onclick  = () => send({ cmd: "closeRecipe" });
$("toggle").onclick = () => send({ cmd: "resume" });

function render(st) {
  if (!st) return;
  const s = $("status");
  s.textContent = st.paused ? "Rotation paused" : `Rotating every ${Math.max(30, CFG.rotateSeconds)}s`;
  s.className = st.paused ? "paused" : "";
  $("back").classList.toggle("hidden", !st.recipeOpen);
  $("close").classList.toggle("hidden", !st.recipeOpen);
  $("toggle").textContent = st.recipeOpen ? "Close recipe & rotate" : "Resume rotation";
}

function tick() {
  $("time").textContent = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}
tick(); setInterval(tick, 5000);

// Background tells us when rotation/recipe state changes.
chrome.runtime.onMessage.addListener((msg) => { if (msg.type === "state") render(msg); });

// Refresh status whenever the launcher comes into view.
const refresh = () => send({ cmd: "status" });
document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });
refresh();
