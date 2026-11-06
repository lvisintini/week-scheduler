const W = self.KIOSK_CONFIG.weather;
const CODES = { 0:"Clear", 1:"Mostly clear", 2:"Partly cloudy", 3:"Overcast", 45:"Fog", 48:"Fog",
  51:"Light drizzle", 53:"Drizzle", 55:"Heavy drizzle", 56:"Freezing drizzle", 57:"Freezing drizzle",
  61:"Light rain", 63:"Rain", 65:"Heavy rain", 66:"Freezing rain", 67:"Freezing rain",
  71:"Light snow", 73:"Snow", 75:"Heavy snow", 77:"Snow grains",
  80:"Showers", 81:"Showers", 82:"Heavy showers", 85:"Snow showers", 86:"Snow showers",
  95:"Thunderstorm", 96:"Thunder & hail", 99:"Thunder & hail" };
const $ = (id) => document.getElementById(id);
$("place").textContent = W.place;

async function load() {
  const url = "https://api.open-meteo.com/v1/forecast"
    + `?latitude=${W.latitude}&longitude=${W.longitude}`
    + "&current=temperature_2m,weather_code,wind_speed_10m"
    + "&daily=weather_code,temperature_2m_max,temperature_2m_min"
    + "&wind_speed_unit=mph&timezone=auto&forecast_days=5";
  try {
    const d = await (await fetch(url)).json();
    $("temp").textContent = Math.round(d.current.temperature_2m) + "°";
    $("desc").textContent = CODES[d.current.weather_code] || "";
    $("wind").textContent = `Wind ${Math.round(d.current.wind_speed_10m)} mph`;
    $("days").replaceChildren(...d.daily.time.map((t, i) => {
      const el = document.createElement("div");
      el.className = "day";
      const name = new Date(t + "T12:00").toLocaleDateString("en-GB", { weekday: "short" });
      el.innerHTML = `<b></b><span></span><span class="t"></span>`;
      el.children[0].textContent = i === 0 ? "Today" : name;
      el.children[1].textContent = CODES[d.daily.weather_code[i]] || "";
      el.children[2].textContent =
        `${Math.round(d.daily.temperature_2m_max[i])}° / ${Math.round(d.daily.temperature_2m_min[i])}°`;
      return el;
    }));
    $("updated").textContent = "Updated " +
      new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  } catch (e) {
    $("updated").textContent = "Couldn't reach the weather service – will retry.";
  }
}
load(); setInterval(load, 15 * 60 * 1000);
