// Google sign-in with Supabase Auth.
// The page shows a sign-in card until someone is logged in, then the weather app.
// Their name and profile picture come from Supabase's user_metadata (filled in by Google).
(() => {
  "use strict";
  // Supabase project "New". The publishable key is safe to use in the browser.
  const SUPABASE_URL = "https://bgcpvsdafecjvtqkjnmy.supabase.co";
  const SUPABASE_KEY = "sb_publishable_lNqpllOWMT4wJScCMQ7_cg_5CzwNVkp";
  const OFFLINE = "Sign-in is unavailable right now. Check your connection and refresh the page.";

  const $ = (id) => document.getElementById(id);
  const siteUrl = location.origin + location.pathname;

  let sb = null;
  try { sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY); }
  catch (err) { console.error("Supabase failed to start:", err); }

  // Errors Supabase puts in the URL after a failed Google sign-in.
  const params = new URLSearchParams(location.hash.slice(1) || location.search);
  const urlError = params.get("error_description");
  if (urlError) history.replaceState(null, "", location.pathname);

  function showError(text) { $("auth-error").textContent = text || ""; }

  function showSignIn() {
    $("boot").hidden = true;
    $("app-view").hidden = true;
    $("user-chip").hidden = true;
    $("auth-view").hidden = false;
    $("google-btn").disabled = false;
  }

  function showApp(user) {
    const meta = user.user_metadata || {};
    const name = meta.full_name || meta.name || (user.email || "").split("@")[0];
    const picture = meta.avatar_url || meta.picture;

    $("user-name").textContent = name;
    $("user-chip").title = user.email || name;
    const img = $("user-avatar");
    img.alt = name ? `${name}'s profile picture` : "Profile picture";
    img.onerror = () => { img.hidden = true; };
    if (picture) { img.src = picture; img.hidden = false; } else { img.hidden = true; }

    $("boot").hidden = true;
    $("auth-view").hidden = true;
    $("user-chip").hidden = false;
    $("app-view").hidden = false;
    if (window.startWeatherApp) window.startWeatherApp(name);
  }

  $("google-btn").addEventListener("click", async () => {
    showError("");
    if (!sb) return showError(OFFLINE);
    $("google-btn").disabled = true;
    const { error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: siteUrl } });
    if (error) { $("google-btn").disabled = false; showError(error.message); }
    // On success the browser goes to Google, then comes back here signed in.
  });

  $("sign-out").addEventListener("click", async () => {
    if (sb) await sb.auth.signOut();
    location.reload();
  });

  if (!sb) { showSignIn(); showError(OFFLINE); return; }

  // Never leave people stuck on "Loading…".
  setTimeout(() => { if (!$("boot").hidden) showSignIn(); }, 5000);

  sb.auth.onAuthStateChange((event, session) => {
    // Supabase calls listeners synchronously; do UI work afterwards.
    setTimeout(() => {
      if (session && session.user) return showApp(session.user);
      if (event === "SIGNED_OUT" || event === "INITIAL_SESSION") {
        showSignIn();
        if (urlError) showError(urlError);
      }
    }, 0);
  });
})();
