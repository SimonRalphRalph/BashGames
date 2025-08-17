# BashGames 🎮  
_“YouTube for browser-based games” — create, play, like, share._

**Live site:** https://simonralphralph.github.io/BashGames/

BashGames is a single-page web app that lets creators **design browser-based games with an integrated LLM** (pre-primed to output playable `<canvas>` games), then **publish** them for others to **play, like, share, and comment**.  
Non-signed-in users can **play**; accounts are required to **create, name, save, publish, like, comment, and subscribe**.

---

## Features
- Minimal, modern UI (ChatGPT × YouTube vibes)
- Central prompt box to describe a game → render in `<canvas>`
- Game pages with title, creator, likes, comments, and share actions
- **Trending** and **Suggested** grids (mock data)
- **Subscriptions** list (for signed-in users)
- “Liked games” view
- **LocalStorage**-backed mock auth and persistence (no server)
- Preloaded demo games (e.g., Snake, Pong, Breakout)

---

## Tech Stack
- **HTML** (structure)
- **CSS** in `css/styles.css` (styling)
- **JavaScript** in `js/app.js` (logic, mock backend via `localStorage`)
- **GitHub Pages** for hosting (static)

---

## Quick Start

### View online
Just visit: **https://simonralphralph.github.io/BashGames/**

### Run locally
```bash
# clone
git clone https://github.com/SimonRalphRalph/BashGames.git
cd BashGames

# open in your browser (macOS)
open index.html
# or with VS Code Live Server / any static server if you prefer