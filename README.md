# Playform (WT)  
_"Bring imagination back to your play."_

**Live site:** https://simonralphralph.github.io/BashGames/

Playform is a single-page web app that lets creators **design browser-based games by speaking them to life** (using a pre-primed LLM with playable outputs `<canvas>` games), then **publish** them for others to **play, like, share, and comment**.  
Non-signed-in users can **play**; accounts are required to **create, name, save, publish, like, comment, and subscribe**.



**Features**
- Minimal, modern UI (akin to OpenAI)
- Central prompt box (studio area) to describe a game → render in CGPT's `<canvas>`
- Game pages with title, creator, likes, comments, and share actions
- **Trending** and **Suggested** grids (mock data)
- **Subscriptions** list (for signed-in users)
- “Liked games” view
- **LocalStorage**-backed mock auth and persistence (no server)
- Preloaded demo games (e.g., Snake, Pong, Breakout)



**Stack**
- **HTML** (structure)
- **CSS** in `css/styles.css` (styling)
- **JavaScript** in `js/app.js` (logic, mock backend via `localStorage`)
- **GitHub Pages** for hosting (static)



**Quick Start Payform**

**View online**
 **https://simonralphralph.github.io/BashGames/**

**Run locally**
```bash
# clone
git clone https://github.com/SimonRalphRalph/BashGames.git
cd BashGames

# open in your browser (macOS)
open index.html
# or with VS Code Live Server / any static server
