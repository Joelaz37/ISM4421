// FAU Owl Weather — vanilla JS client for the Open-Meteo APIs (no API key needed).
(() => {
  "use strict";

  const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
  const GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";

  // Default location: FAU Boca Raton campus.
  const BOCA = {
    name: "Boca Raton",
    detail: "Florida Atlantic University · Florida, United States",
    latitude: 26.3705,
    longitude: -80.1022,
  };

  // WMO weather interpretation codes -> [description, day icon, night icon]
  const WEATHER_CODES = {
    0: ["Clear sky", "☀️", "🌙"],
    1: ["Mainly clear", "🌤️", "🌙"],
    2: ["Partly cloudy", "⛅", "☁️"],
    3: ["Overcast", "☁️", "☁️"],
    45: ["Fog", "🌫️", "🌫️"],
    48: ["Depositing rime fog", "🌫️", "🌫️"],
    51: ["Light drizzle", "🌦️", "🌧️"],
    53: ["Drizzle", "🌦️", "🌧️"],
    55: ["Dense drizzle", "🌧️", "🌧️"],
    56: ["Light freezing drizzle", "🌧️", "🌧️"],
    57: ["Freezing drizzle", "🌧️", "🌧️"],
    61: ["Light rain", "🌦️", "🌧️"],
    63: ["Rain", "🌧️", "🌧️"],
    65: ["Heavy rain", "🌧️", "🌧️"],
    66: ["Light freezing rain", "🌧️", "🌧️"],
    67: ["Freezing rain", "🌧️", "🌧️"],
    71: ["Light snow", "🌨️", "🌨️"],
    73: ["Snow", "🌨️", "🌨️"],
    75: ["Heavy snow", "❄️", "❄️"],
    77: ["Snow grains", "🌨️", "🌨️"],
    80: ["Light showers", "🌦️", "🌧️"],
    81: ["Showers", "🌧️", "🌧️"],
    82: ["Violent showers", "⛈️", "⛈️"],
    85: ["Light snow showers", "🌨️", "🌨️"],
    86: ["Snow showers", "❄️", "❄️"],
    95: ["Thunderstorm", "⛈️", "⛈️"],
    96: ["Thunderstorm with hail", "⛈️", "⛈️"],
    99: ["Severe thunderstorm with hail", "⛈️", "⛈️"],
  };

  const $ = (id) => document.getElementById(id);
  const els = {
    status: $("status"),
    current: $("current"),
    hourlySection: $("hourly-section"),
    dailySection: $("daily-section"),
    hourly: $("hourly"),
    daily: $("daily"),
    form: $("search-form"),
    input: $("search-input"),
    results: $("search-results"),
    locateBtn: $("locate-btn"),
    homeBtn: $("home-btn"),
    unitButtons: document.querySelectorAll(".unit-toggle button"),
  };

  // Preferences are a per-browser convenience only; everything works without storage.
  const store = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem(key);
        return v ? JSON.parse(v) : fallback;
      } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
    },
  };

  const state = {
    unit: store.get("fauwx.unit", "fahrenheit"),
    location: store.get("fauwx.location", BOCA),
    requestId: 0,
  };

  function describe(code, isDay = 1) {
    const entry = WEATHER_CODES[code] || ["Unknown", "🌡️", "🌡️"];
    return { text: entry[0], icon: isDay ? entry[1] : entry[2] };
  }

  function setStatus(message, isError = false) {
    els.status.textContent = message || "";
    els.status.classList.toggle("error", Boolean(isError));
  }

  const round = (n) => (n == null || Number.isNaN(n) ? "–" : Math.round(n));
  const tempUnit = () => (state.unit === "celsius" ? "°C" : "°F");
  const windUnit = () => (state.unit === "celsius" ? "km/h" : "mph");

  function compass(deg) {
    if (deg == null) return "";
    const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
    return dirs[Math.round(deg / 22.5) % 16];
  }

  // Open-Meteo returns local times ("2026-09-28T14:00") when timezone=auto.
  // Parsing them without an offset keeps them in the location's wall-clock time
  // as long as we also format them without converting zones, which we do via UTC.
  function parseLocal(iso) {
    const [d, t = "00:00"] = iso.split("T");
    const [y, m, day] = d.split("-").map(Number);
    const [hh, mm] = t.split(":").map(Number);
    return new Date(Date.UTC(y, m - 1, day, hh, mm));
  }
  const fmt = (opts) => new Intl.DateTimeFormat("en-US", { ...opts, timeZone: "UTC" });
  const fmtHour = fmt({ hour: "numeric" });
  const fmtTime = fmt({ hour: "numeric", minute: "2-digit" });
  const fmtWeekday = fmt({ weekday: "short" });
  const fmtDate = fmt({ month: "short", day: "numeric" });

  async function fetchJSON(url) {
    const res = await fetch(url);
    if (!res.ok) {
      let reason = "";
      try { reason = (await res.json()).reason || ""; } catch { /* ignore */ }
      throw new Error(`Request failed (${res.status}) ${reason}`.trim());
    }
    return res.json();
  }

  async function loadWeather(location) {
    const id = ++state.requestId;
    state.location = location;
    store.set("fauwx.location", location);
    setStatus(`Loading weather for ${location.name}…`);

    const params = new URLSearchParams({
      latitude: location.latitude,
      longitude: location.longitude,
      current: [
        "temperature_2m", "relative_humidity_2m", "apparent_temperature", "is_day",
        "precipitation", "weather_code", "pressure_msl", "wind_speed_10m",
        "wind_direction_10m", "wind_gusts_10m",
      ].join(","),
      hourly: ["temperature_2m", "precipitation_probability", "weather_code", "is_day"].join(","),
      daily: [
        "weather_code", "temperature_2m_max", "temperature_2m_min", "sunrise", "sunset",
        "uv_index_max", "precipitation_probability_max",
      ].join(","),
      temperature_unit: state.unit,
      wind_speed_unit: state.unit === "celsius" ? "kmh" : "mph",
      precipitation_unit: state.unit === "celsius" ? "mm" : "inch",
      timezone: "auto",
      forecast_days: "7",
    });

    try {
      const data = await fetchJSON(`${FORECAST_URL}?${params}`);
      if (id !== state.requestId) return; // a newer request superseded this one
      render(location, data);
      setStatus("");
    } catch (err) {
      if (id !== state.requestId) return;
      console.error(err);
      setStatus(`Couldn't load the weather. ${err.message}. Please try again.`, true);
    }
  }

  function render(location, data) {
    const c = data.current;
    const d = data.daily;
    const cur = describe(c.weather_code, c.is_day);

    $("location-name").textContent = location.name;
    $("location-detail").textContent = location.detail || "";
    $("updated").textContent = `Updated ${fmtTime.format(parseLocal(c.time))} local time (${data.timezone_abbreviation || data.timezone})`;
    $("current-icon").textContent = cur.icon;
    $("current-temp").textContent = `${round(c.temperature_2m)}${tempUnit()}`;
    $("current-desc").textContent = `${cur.text} · High ${round(d.temperature_2m_max[0])}° / Low ${round(d.temperature_2m_min[0])}°`;
    $("stat-feels").textContent = `${round(c.apparent_temperature)}${tempUnit()}`;
    $("stat-humidity").textContent = `${round(c.relative_humidity_2m)}%`;
    $("stat-wind").textContent = `${round(c.wind_speed_10m)} ${windUnit()} ${compass(c.wind_direction_10m)}`;
    $("stat-gusts").textContent = `${round(c.wind_gusts_10m)} ${windUnit()}`;
    $("stat-uv").textContent = d.uv_index_max[0] == null ? "–" : d.uv_index_max[0].toFixed(1);
    $("stat-pressure").textContent = `${round(c.pressure_msl)} hPa`;
    $("stat-sunrise").textContent = fmtTime.format(parseLocal(d.sunrise[0]));
    $("stat-sunset").textContent = fmtTime.format(parseLocal(d.sunset[0]));

    renderHourly(data);
    renderDaily(data);

    document.title = `${round(c.temperature_2m)}${tempUnit()} ${location.name} · FAU Owl Weather`;
    els.current.hidden = false;
    els.hourlySection.hidden = false;
    els.dailySection.hidden = false;
  }

  function renderHourly(data) {
    const h = data.hourly;
    const nowHour = data.current.time.slice(0, 13); // "YYYY-MM-DDTHH"
    let start = h.time.findIndex((t) => t.slice(0, 13) >= nowHour);
    if (start < 0) start = 0;

    const items = [];
    for (let i = start; i < Math.min(start + 24, h.time.length); i++) {
      const w = describe(h.weather_code[i], h.is_day[i]);
      const label = i === start ? "Now" : fmtHour.format(parseLocal(h.time[i]));
      const pop = h.precipitation_probability[i];
      items.push(`
        <li class="hour" title="${w.text}">
          <div class="time">${label}</div>
          <div class="icon" aria-hidden="true">${w.icon}</div>
          <div class="temp">${round(h.temperature_2m[i])}°</div>
          <div class="pop">${pop == null ? "&nbsp;" : `💧 ${pop}%`}</div>
          <span class="visually-hidden">${w.text}</span>
        </li>`);
    }
    els.hourly.innerHTML = items.join("");
  }

  function renderDaily(data) {
    const d = data.daily;
    els.daily.innerHTML = d.time.map((t, i) => {
      const date = parseLocal(t);
      const w = describe(d.weather_code[i], 1);
      const name = i === 0 ? "Today" : fmtWeekday.format(date);
      const pop = d.precipitation_probability_max[i];
      return `
        <li class="day">
          <div><div class="name">${name}</div><div class="pop">${fmtDate.format(date)}</div></div>
          <div class="icon" aria-hidden="true">${w.icon}</div>
          <div class="desc">${w.text}${pop == null ? "" : `<div class="pop">💧 ${pop}% chance of rain</div>`}</div>
          <div class="range">${round(d.temperature_2m_max[i])}°<span class="lo">${round(d.temperature_2m_min[i])}°</span></div>
        </li>`;
    }).join("");
  }

  // --- Search ---------------------------------------------------------------
  const escapeHTML = (s) => String(s).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[ch]);

  function hideResults() {
    els.results.hidden = true;
    els.results.innerHTML = "";
  }

  async function search(query) {
    // "Jupiter, FL" -> search "Jupiter" and prefer results matching "FL"/"Florida".
    const [name, hint = ""] = query.split(",").map((s) => s.trim());
    if (!name) return;
    setStatus(`Searching for “${query}”…`);
    try {
      const params = new URLSearchParams({ name, count: "10", language: "en", format: "json" });
      const data = await fetchJSON(`${GEOCODE_URL}?${params}`);
      let results = data.results || [];
      if (hint) {
        const h = hint.toLowerCase();
        const matches = results.filter((r) =>
          [r.admin1, r.country, r.country_code, r.admin1_code].some((v) => v && String(v).toLowerCase().startsWith(h)) ||
          (h.length === 2 && US_STATES[h.toUpperCase()] === r.admin1));
        if (matches.length) results = matches;
      }
      setStatus("");
      if (!results.length) {
        setStatus(`No places found for “${query}”.`, true);
        hideResults();
        return;
      }
      if (results.length === 1) {
        choose(results[0]);
        return;
      }
      els.results.innerHTML = results.slice(0, 6).map((r, i) => `
        <li><button type="button" data-index="${i}">
          <strong>${escapeHTML(r.name)}</strong>
          <span class="sub">${escapeHTML([r.admin1, r.country].filter(Boolean).join(", "))}</span>
        </button></li>`).join("");
      els.results.hidden = false;
      els.results.querySelectorAll("button").forEach((btn) => {
        btn.addEventListener("click", () => choose(results[Number(btn.dataset.index)]));
      });
      els.results.querySelector("button").focus();
    } catch (err) {
      console.error(err);
      setStatus(`Search failed. ${err.message}.`, true);
    }
  }

  function choose(r) {
    hideResults();
    els.input.value = "";
    loadWeather({
      name: r.name,
      detail: [r.admin1, r.country].filter(Boolean).join(", "),
      latitude: r.latitude,
      longitude: r.longitude,
    });
  }

  const US_STATES = {
    AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado",
    CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho",
    IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana",
    ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota",
    MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada",
    NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina",
    ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
    RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas",
    UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia",
    WI: "Wisconsin", WY: "Wyoming", DC: "District of Columbia",
  };

  // --- Events ---------------------------------------------------------------
  els.form.addEventListener("submit", (e) => {
    e.preventDefault();
    search(els.input.value.trim());
  });

  document.addEventListener("click", (e) => {
    if (!els.results.hidden && !e.target.closest(".search-bar")) hideResults();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hideResults();
  });

  els.homeBtn.addEventListener("click", () => {
    hideResults();
    loadWeather(BOCA);
  });

  els.locateBtn.addEventListener("click", () => {
    hideResults();
    if (!("geolocation" in navigator)) {
      setStatus("Your browser doesn't support location lookup.", true);
      return;
    }
    setStatus("Finding your location…");
    navigator.geolocation.getCurrentPosition(
      (pos) => loadWeather({
        name: "Your location",
        detail: `${pos.coords.latitude.toFixed(3)}, ${pos.coords.longitude.toFixed(3)}`,
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      }),
      (err) => setStatus(`Couldn't get your location (${err.message}).`, true),
      { timeout: 10000, maximumAge: 600000 },
    );
  });

  function syncUnitButtons() {
    els.unitButtons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.unit === state.unit)));
  }
  els.unitButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.dataset.unit === state.unit) return;
      state.unit = btn.dataset.unit;
      store.set("fauwx.unit", state.unit);
      syncUnitButtons();
      loadWeather(state.location);
    });
  });

  // --- Theme picker -----------------------------------------------------------
  const themeSelect = $("theme-select");
  if (themeSelect && window.FAUTheme) {
    themeSelect.value = window.FAUTheme.current();
    themeSelect.addEventListener("change", () => window.FAUTheme.set(themeSelect.value));
  }

  // --- Welcome message -------------------------------------------------------
  function greet() {
    const hour = new Date().getHours();
    const part = hour < 5 ? "Burning the midnight oil" : hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
    $("welcome-title").textContent = `${part}, Joe Lozoraitis! 🦉`;
    $("welcome-text").textContent = `Welcome back to FAU Owl Weather. It's ${new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(new Date())}. Go Owls!`;
  }

  greet();
  syncUnitButtons();
  loadWeather(state.location);
})();
