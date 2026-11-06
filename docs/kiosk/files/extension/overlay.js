// Adds a small Home button to every kiosk page and reports touches.
(() => {
  if (window.top !== window || document.getElementById("kiosk-home-host")) return;
  const send = (cmd) => { try { chrome.runtime.sendMessage({ cmd }); } catch (e) {} };

  let last = 0;
  addEventListener("pointerdown", () => {
    const now = Date.now();
    if (now - last > 10000) { last = now; send("activity"); }
  }, { capture: true, passive: true });

  const corner = ((self.KIOSK_CONFIG || {}).homeButtonCorner || "bottom-right").split("-");
  const host = document.createElement("div");
  host.id = "kiosk-home-host";
  host.style.cssText = `position:fixed;${corner[0]}:14px;${corner[1]}:14px;z-index:2147483647;`;
  const root = host.attachShadow({ mode: "closed" });
  root.innerHTML = `
    <style>
      button { width:56px; height:56px; border-radius:50%; border:none; cursor:pointer;
               background:rgba(20,24,32,.55); display:grid; place-items:center;
               box-shadow:0 2px 8px rgba(0,0,0,.3); -webkit-tap-highlight-color:transparent; }
      button:active { background:rgba(20,24,32,.85); transform:scale(.95); }
      svg { width:28px; height:28px; }
    </style>
    <button aria-label="Home" title="Home">
      <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"
           stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 11l9-7 9 7"/><path d="M5 10v10h5v-6h4v6h5V10"/>
      </svg>
    </button>`;
  root.querySelector("button").addEventListener("click", () => send("home"));
  (document.body || document.documentElement).appendChild(host);
})();
