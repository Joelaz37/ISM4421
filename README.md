# FAU Owl Weather 🦉

A weather app with Florida Atlantic University branding. It uses the free [Open-Meteo](https://open-meteo.com/) APIs, which need no account or API key. It opens on **Boca Raton, FL** (the FAU Boca campus) by default.

## Features

- Current conditions: temperature, feels-like, humidity, wind and gusts, UV index, pressure, sunrise and sunset
- Hourly forecast for the next 24 hours, with chance of rain
- 7-day forecast
- City search through the Open-Meteo Geocoding API (for example `Jupiter, FL` or `Miami`)
- 📍 **My location** button, which uses browser geolocation
- 🦉 **Boca** button to jump back to campus
- °F / °C toggle. The app remembers your unit and last location in the browser.
- Four themes (System, Light, White, Dark) picked from the header. System follows your device setting.
- **Continue with Google** sign-in (Supabase Auth). After login the header shows the person's name and profile picture from `user_metadata`, and the welcome message greets them by name, changing with the time of day
- Works on phones and uses the FAU colors: blue `#003366`, red `#CC0000` and gray `#CCCCCC`

## Project structure

```
index.html          Page markup
styles.css          FAU-themed styles
app.js              Open-Meteo API calls, rendering and welcome message (plain JavaScript)
auth.js             Google sign-in with Supabase, name and profile picture in the header
vendor/             Bundled Supabase client library (so no CDN is needed)
theme.js            Theme switcher: System, Light, White, Dark
assets/fau-logo.svg Logo shown in the header
favicon.svg         Browser tab icon
netlify.toml        Netlify deploy config (publish dir, security headers)
```

There is no build step and nothing to install. It's a plain static site.

## Sign in with Google

The app uses Supabase project `New` (`bgcpvsdafecjvtqkjnmy`). One-time setup:
1. Supabase Dashboard → Authentication → Sign In / Providers → **Google**: enabled, with your Google OAuth client ID and secret.
2. Google Cloud Console → your OAuth client → Authorized redirect URIs: `https://bgcpvsdafecjvtqkjnmy.supabase.co/auth/v1/callback`
3. Supabase Dashboard → Authentication → URL Configuration: set **Site URL** to your Netlify URL and add `https://YOUR-SITE.netlify.app/**` to **Redirect URLs** (add `http://localhost:8000/**` too for local testing). Otherwise Google sends people back to `localhost:3000`.

`netlify.toml`'s Content-Security-Policy allows the Supabase project and Google profile photos (`*.googleusercontent.com`).

## Run locally

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Deploy to Netlify

**Option A: connect the GitHub repo (recommended)**
1. Log in at [app.netlify.com](https://app.netlify.com) and choose **Add new site → Import an existing project**.
2. Pick GitHub and select this repository and the branch you want to deploy.
3. Leave **Build command** empty and set **Publish directory** to `.`. `netlify.toml` already sets both.
4. Click **Deploy**. Every push to that branch redeploys the site automatically.

**Option B: drag and drop**
Download this folder and drag it onto the **Sites** page at [app.netlify.com/drop](https://app.netlify.com/drop).

**Option C: Netlify CLI**
```bash
npm install -g netlify-cli
netlify deploy --prod --dir .
```

## About the logo

`assets/fau-logo.svg` is a custom owl badge in FAU red and blue, with a sun and a cloud for the weather theme. The browser tab icon (`favicon.svg`) is the same design. To use the official FAU logo, save it over `assets/fau-logo.svg`. If your file is a PNG, save it as `assets/fau-logo.png` and change the `src` in `index.html` to match. Official marks are available from FAU's brand guidelines site. They are trademarks of Florida Atlantic University.

## Credits

Weather data by [Open-Meteo.com](https://open-meteo.com/) (CC BY 4.0).
