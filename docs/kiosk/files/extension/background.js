importScripts("config.js");
const CFG = self.KIOSK_CONFIG;
const ALARM = "rotate";
const LAUNCHER_URL = chrome.runtime.getURL("launcher.html");
const DEFAULTS = { tabs: {}, launcherTab: null, recipeTab: null,
                   paused: false, index: 0, lastActivity: 0, started: false };

const fullUrl = (u) => (/^[a-z]+:/i.test(u) ? u : chrome.runtime.getURL(u));
const getState = () => chrome.storage.session.get(DEFAULTS);
const setState = (patch) => chrome.storage.session.set(patch);

async function alive(id) {
  if (id == null) return false;
  try { await chrome.tabs.get(id); return true; } catch { return false; }
}

// Make sure every kiosk tab exists. On browser start, also close stray tabs.
let busy = null;
function ensureTabs(closeExtras = false) {
  busy = (busy || Promise.resolve()).then(() => doEnsure(closeExtras)).catch(console.error);
  return busy;
}
async function doEnsure(closeExtras) {
  const st = await getState();
  const tabs = { ...st.tabs };
  const keep = new Set();
  for (const page of CFG.rotation) {
    if (!(await alive(tabs[page.id]))) {
      tabs[page.id] = (await chrome.tabs.create({ url: fullUrl(page.url), active: false })).id;
    }
    keep.add(tabs[page.id]);
  }
  let launcherTab = st.launcherTab;
  if (!(await alive(launcherTab))) {
    launcherTab = (await chrome.tabs.create({ url: LAUNCHER_URL, active: false })).id;
  }
  keep.add(launcherTab);
  const recipeTab = (await alive(st.recipeTab)) ? st.recipeTab : null;
  if (recipeTab) keep.add(recipeTab);

  if (closeExtras) {
    const extra = (await chrome.tabs.query({})).filter(t => !keep.has(t.id)).map(t => t.id);
    if (extra.length) await chrome.tabs.remove(extra);
  }
  await setState({ tabs, launcherTab, recipeTab });

  if (!st.started) {
    await setState({ started: true, index: 0, paused: false });
    await chrome.alarms.clear(ALARM);
    chrome.alarms.create(ALARM, { periodInMinutes: Math.max(30, CFG.rotateSeconds) / 60 });
    await chrome.tabs.update(tabs[CFG.rotation[0].id], { active: true });
  }
}

async function show(index) {
  await ensureTabs();
  const st = await getState();
  await setState({ index });
  await chrome.tabs.update(st.tabs[CFG.rotation[index].id], { active: true });
}

async function goHome() {
  await ensureTabs();
  const st = await getState();
  await chrome.tabs.update(st.launcherTab, { active: true });
}

async function closeRecipe() {
  const st = await getState();
  if (await alive(st.recipeTab)) await chrome.tabs.remove(st.recipeTab);
  await setState({ recipeTab: null });
}

chrome.runtime.onStartup.addListener(() => ensureTabs(true));
chrome.runtime.onInstalled.addListener(() => ensureTabs(true));

chrome.tabs.onRemoved.addListener(async (id) => {
  const st = await getState();
  if (id === st.recipeTab) await setState({ recipeTab: null });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM) return;
  await ensureTabs();
  const st = await getState();
  if (st.paused) {
    const idleMs = Date.now() - st.lastActivity;
    if (CFG.autoResumeMinutes > 0 && !st.recipeTab && idleMs > CFG.autoResumeMinutes * 60000) {
      await setState({ paused: false });
      await show(st.index);
      broadcast();
    }
    return;
  }
  await show((st.index + 1) % CFG.rotation.length);
});

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg.type === "state") return false; // our own broadcast
  handle(msg).then(reply, (e) => reply({ error: String(e) }));
  return true; // reply asynchronously
});

async function status() {
  const st = await getState();
  return { type: "state", paused: st.paused, recipeOpen: !!st.recipeTab,
           current: CFG.rotation[st.index] && CFG.rotation[st.index].id };
}
// Tell the launcher (if it's listening) that something changed.
async function broadcast() {
  try { await chrome.runtime.sendMessage(await status()); } catch (e) {}
}

async function handle(msg) {
  const touched = { lastActivity: Date.now() };
  switch (msg.cmd) {
    case "activity":
      await setState(touched);
      break;
    case "home":                       // Home button: pause and open the launcher
      await setState({ ...touched, paused: true });
      await goHome();
      break;
    case "show": {                     // Show one screen and stay on it
      const i = CFG.rotation.findIndex(p => p.id === msg.id);
      if (i >= 0) { await setState({ ...touched, paused: true }); await show(i); }
      break;
    }
    case "resume": {                   // Close any recipe and start rotating again
      await closeRecipe();
      const st = await getState();
      await setState({ ...touched, paused: false });
      await show(st.index);
      break;
    }
    case "recipe": {                   // Open a recipe (reuses one tab to save memory)
      await setState({ ...touched, paused: true });
      const st = await getState();
      if (await alive(st.recipeTab)) {
        await chrome.tabs.update(st.recipeTab, { url: msg.url, active: true });
      } else {
        const t = await chrome.tabs.create({ url: msg.url, active: true });
        await setState({ recipeTab: t.id });
      }
      break;
    }
    case "backToRecipe": {
      const st = await getState();
      if (await alive(st.recipeTab)) await chrome.tabs.update(st.recipeTab, { active: true });
      break;
    }
    case "closeRecipe":
      await closeRecipe();
      await goHome();
      break;
  }
  broadcast();
  return status();
}
