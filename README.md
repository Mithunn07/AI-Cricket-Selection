# 🏏 CrickSelect AI — AI-Powered Cricket Team Selection Platform

An AI-driven, data-first web platform that selects the most balanced **Playing XI** from up to 25 players, recommends the optimal **Captain** and **Vice-Captain**, and visualises player metrics with interactive radar charts.

> **100% client-side** — No backend, no database, no build step required. Runs entirely in the browser.

---

## 🚀 Quick Start (Local)

### Option A — PowerShell Server (No Node required)
```powershell
powershell -ExecutionPolicy Bypass -File serve.ps1
```
Then open [http://localhost:8000](http://localhost:8000) in your browser.

### Option B — Vite Dev Server
```bash
npm install
npm run dev
```
Then open [http://localhost:5173](http://localhost:5173).

### Option C — Any Static Server
Since this is a pure static site, any HTTP server works:
```bash
# Python 3
python -m http.server 8000

# Node (npx)
npx serve .
```

---

## ☁️ Deploy to the Web

### Vercel (Recommended — Free, instant)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

1. Push this folder to a GitHub repository
2. Go to [vercel.com](https://vercel.com) → **New Project** → Import your repo
3. Leave all settings as default — Vercel auto-detects it as a static site
4. Click **Deploy** ✅

Or use the Vercel CLI:
```bash
npm i -g vercel
vercel
```

---

### Netlify (Free tier available)
[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start)

1. Push this folder to a GitHub repository
2. Go to [netlify.com](https://netlify.com) → **Add new site** → **Import an existing project**
3. Choose your repo — Netlify reads `netlify.toml` automatically
4. Click **Deploy site** ✅

Or use the Netlify CLI:
```bash
npm i -g netlify-cli
netlify deploy --dir=. --prod
```

---

### GitHub Pages (Free, needs a repo)
1. Push to a GitHub repository
2. Go to **Settings → Pages**
3. Set **Source** to `Deploy from a branch` → select `main` branch and `/ (root)` folder
4. Save — your site will be live at `https://<username>.github.io/<repo-name>/` ✅

---

### Streamlit Dashboard (Python version)
If you want to use the Streamlit version (`app.py`) with advanced visualisations:

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
2. Run locally:
   ```bash
   streamlit run app.py
   ```
3. Deploy to [Streamlit Community Cloud](https://streamlit.io/cloud):
   - Push to GitHub, then connect your repo at `share.streamlit.io`

---

## 📁 Project Structure

```
crickselect-ai/
├── index.html         # Main HTML shell — clean, semantic markup
├── style.css          # All CSS: dark/light themes, layout, components
├── db.js              # Curated player database (30+ top internationals)
├── app.js             # Core logic: scoring engine, XI selector, UI, charts
├── app.py             # Streamlit version (Python, optional)
├── requirements.txt   # Python dependencies for app.py
├── serve.ps1          # PowerShell local HTTP server helper
├── vercel.json        # Vercel deployment config
├── netlify.toml       # Netlify deployment config
├── package.json       # Vite dev server + build config
└── README.md          # This file
```

---

## 🌟 Features

| Feature | Description |
|---|---|
| **Dark / Light Mode** | Toggle with one click; theme persists across UI components |
| **Curated Player DB** | 30+ top international cricketers — instant offline lookup |
| **Live Cricinfo Scraper** | Falls back to CORS-proxied ESPN Cricinfo for unknown players |
| **Smart Stats Drawer** | Click any player to slide out a form and edit all statistics |
| **AI Playing XI** | Role-balanced selection: 1 WK · 4 Bat · 2 AR · 4 Bowl |
| **Captain Recommender** | Leadership Score = 40% performance + 30% rating + 30% form |
| **Radar Chart Compare** | Chart.js-powered head-to-head visual comparison of any 2 players |
| **Rankings Table** | Full squad ranked by AI Overall Score with all key stats |

---

## 📊 Scoring Methodology

| Score | Formula |
|---|---|
| **Batting** | `40% Batting Average + 30% Strike Rate + 30% Total Runs` (all min-max normalised) |
| **Bowling** | `60% Wickets Taken + 40% Economy` (economy is inverse normalised; non-bowlers = 0) |
| **Fielding** | `Catches` (normalised) |
| **Overall** | Role-adaptive blend — see weights below |
| **Leadership** | `40% Overall Score + 30% Leadership Rating + 30% Recent Form` |

### Role Weights for Overall Score

| Role | Batting | Bowling | Fielding | Fitness | Form |
|---|---|---|---|---|---|
| Batsman | 50% | — | 15% | 15% | 20% |
| Bowler | — | 50% | 15% | 15% | 20% |
| All-Rounder | 35% | 35% | 10% | 10% | 10% |
| Wicketkeeper | 45% | — | 25% | 15% | 15% |

---

## 🛠 Tech Stack

- **HTML5** — Semantic, accessible markup
- **CSS3** — Custom properties (CSS vars), flexbox/grid, animations, glassmorphism
- **Vanilla JavaScript (ES2020+)** — No frameworks, no bundler required for production
- **Chart.js** — CDN-loaded, radar chart visualisation
- **Google Fonts** — Bebas Neue, Inter, JetBrains Mono
- **Vite** *(optional)* — Local HMR dev server + production bundling
