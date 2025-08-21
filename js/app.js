/*
      Playform — Single-file SPA with a mock backend using localStorage.
      Key features:
        - Accounts (signup/signin/signout)
        - LLM-simulated game generator that produces canvas-based games from prompts
        - Save & Publish games (with thumbnail snapshot)
        - Game pages with Like, Comment, Share
        - Creator profiles, Subscriptions, Liked list
        - Trending & Suggested grids, Search

      Data shapes:
        localStorage['gba_users'] = [ { username, password, likedGames:[id], subscriptions:[username] } ]
        localStorage['gba_currentUser'] = 'username' | null
        localStorage['gba_games'] = [ { id, title, description, creator, code, likes, published, createdAt, thumbnail } ]
        localStorage['gba_comments_<id>'] = [ { user, text, ts } ]
        localStorage['gba_initialized'] = 'yes'

      All code below is heavily commented for extendability.
    */

function getCSSVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

    // ---------- Utilities ----------
    const $ = sel => document.querySelector(sel);
    const $$ = sel => Array.from(document.querySelectorAll(sel));
    const uid = () => Math.random().toString(36).slice(2, 10);
    const nowISO = () => new Date().toISOString();

    function toast(msg){
      const t = document.createElement('div');
      t.textContent = msg;
      t.style.cssText = `position:fixed;left:50%;top:20px;transform:translateX(-50%);background:var(--panel);color:var(--text);border:1px solid var(--stroke);padding:10px 14px;border-radius:999px;z-index:80;box-shadow:var(--shadow)`;
      document.body.appendChild(t); setTimeout(()=>t.remove(), 1800);
    }

    function toggleModal(id, show){
      const m = document.getElementById(id);
      if(!m) return; m.classList.toggle('active', !!show);
    }

    // ---------- Keyboard state (shared across all games) ----------
    const KEY_STATE = new Set();

    function isTextTarget(t){
      return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
    }

    function onKeyDown(e){
      if (isTextTarget(e?.target)) return;
      const k = (e?.key || '').toLowerCase();
      if (!k) return;
      KEY_STATE.add(k);
    }

    function onKeyUp(e){
      if (isTextTarget(e?.target)) return;
      const k = (e?.key || '').toLowerCase();
      if (!k) return;
      KEY_STATE.delete(k);
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // ---------- Storage API (mock backend) ----------
    function getUsers(){ return JSON.parse(localStorage.getItem('gba_users')||'[]'); }
    function setUsers(v){ localStorage.setItem('gba_users', JSON.stringify(v)); }
    function getCurrentUser(){ return localStorage.getItem('gba_currentUser'); }
    function setCurrentUser(u){ if(u) localStorage.setItem('gba_currentUser', u); else localStorage.removeItem('gba_currentUser'); updateAuthUI(); }
    function getGames(){ return JSON.parse(localStorage.getItem('gba_games')||'[]'); }
    function setGames(v){ localStorage.setItem('gba_games', JSON.stringify(v)); }
    function getComments(id){ return JSON.parse(localStorage.getItem('gba_comments_'+id)||'[]'); }
    function setComments(id, arr){ localStorage.setItem('gba_comments_'+id, JSON.stringify(arr)); }

    // Preload sample games only once
    function preloadGames(){
      if(localStorage.getItem('gba_initialized')) return;
      // Minimal playable code templates are defined below in GAME_TEMPLATES
      const samples = [
        { key:'snake', title:'Snake', description:'Classic arrow-key snake game. Eat pellets, avoid yourself!', code: GAME_TEMPLATES.snake },
        { key:'pong', title:'Pong', description:'Two paddles and a ball. Up/Down arrows vs. W/S keys.', code: GAME_TEMPLATES.pong },
        { key:'breakout', title:'Breakout', description:'Bounce the ball to clear bricks. Move with left/right arrows.', code: GAME_TEMPLATES.breakout },
      ];
      const creators = ['ArcadeLab', 'RetroCoder', 'BrickSmith'];
      const games = getGames();
      samples.forEach((s, i)=>{
        const id = uid();
        games.push({ id, title:s.title, description:s.description, creator: creators[i]||'Guest', code:s.code, likes: Math.floor(Math.random()*200+50), published:true, createdAt: nowISO(), thumbnail: PLACEHOLDER_THUMB(s.title) });
        setComments(id, [ {user:'DemoFan', text:'Love this!', ts: nowISO()}, {user:'PlayerTwo', text:'So nostalgic 👾', ts: nowISO()} ]);
      });
      setGames(games);
      // seed some users & follows
      setUsers([
        {username:'ArcadeLab', password:'demo', likedGames:[], subscriptions:['RetroCoder']},
        {username:'RetroCoder', password:'demo', likedGames:[], subscriptions:[]},
        {username:'BrickSmith', password:'demo', likedGames:[], subscriptions:['ArcadeLab']},
      ]);
      localStorage.setItem('gba_initialized','yes');
    }

    // ---------- Thumbnails ----------
    function PLACEHOLDER_THUMB(title){
      // data URI SVG with title initials
      const initials = (title||'G').split(/\s+/).map(w=>w[0]).slice(0,2).join('').toUpperCase();
      const hue = Math.abs(hashCode(title))%360;
      const svg = encodeURIComponent(`<?xml version="1.0"?>\n<svg xmlns='http://www.w3.org/2000/svg' width='480' height='280'>\n  <defs>\n    <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>\n      <stop offset='0%' stop-color='hsl(${hue},70%,50%)'/>\n      <stop offset='100%' stop-color='hsl(${(hue+60)%360},70%,50%)'/>\n    </linearGradient>\n  </defs>\n  <rect width='100%' height='100%' fill='url(#g)'/>\n  <text x='50%' y='52%' dominant-baseline='middle' text-anchor='middle' font-family='Arial, Helvetica, sans-serif' font-size='110' fill='rgba(255,255,255,.9)' font-weight='800'>${initials}</text>\n</svg>`);
      return `data:image/svg+xml,${svg}`;
    }
    function hashCode(str=""){let h=0; for(let i=0;i<str.length;i++){h=((h<<5)-h)+str.charCodeAt(i)|0;} return h;}

    // ---------- Auth UI ----------
    function updateAuthUI(){
      const isLogged = !!getCurrentUser();
      document.getElementById('sidebar').style.display = isLogged? 'block':'none';
      document.getElementById('authButtons').style.display = isLogged? 'none':'flex';
      document.getElementById('userMenu').style.display = isLogged? 'flex':'none';
      if(isLogged) buildSubsList();
    }

    function openAuth(mode){ // mode: 'signin' | 'signup'
      toggleModal('authModal', true);
      $('#authTitle').textContent = mode==='signin'? 'Welcome back' : 'Start creating games with a free account';
      $('#authConfirm').dataset.mode = mode;
      $('#authPassword').value=''; $('#authUsername').value='';
    }

    function handleAuth(){
      const mode = $('#authConfirm').dataset.mode||'signup';
      const u = $('#authUsername').value.trim();
      const p = $('#authPassword').value.trim();
      if(!u || !p) return toast('Please enter a username & password.');
      const users = getUsers();
      if(mode==='signup'){
        if(users.some(x=>x.username.toLowerCase()===u.toLowerCase())) return toast('Username already exists.');
        users.push({username:u, password:p, likedGames:[], subscriptions:[]}); setUsers(users); setCurrentUser(u); toggleModal('authModal', false); toast('Account created!');
      } else {
        const acc = users.find(x=>x.username.toLowerCase()===u.toLowerCase() && x.password===p);
        if(!acc) return toast('Invalid credentials.'); setCurrentUser(acc.username); toggleModal('authModal', false); toast('Signed in.');
      }
      router();
    }

    // ---------- Router ----------
    function parseHash(){
      const h = location.hash.replace('#','');
      const [path, query] = h.split('?');
      const q = Object.fromEntries(new URLSearchParams(query||'').entries());
      return { path: path||'home', query:q };
    }

    function router(){
      const {path, query} = parseHash();
      if(path==='home') renderHome();
      else if(path==='game') renderGamePage(query.id);
      else if(path==='profile') renderProfile(query.user);
      else if(path==='liked') renderLiked();
      else if(path==='subs') renderSubscriptions();
      else if(path==='search') renderSearch(query.q||'');
      else renderHome();
      updateAuthUI();
    }

    // ---------- Home Views ----------
    function renderHome(){
      const isLogged = !!getCurrentUser();
      const view = document.getElementById('view');
      view.innerHTML = '';

      // Studio prompt (always visible). Non-logged-in cannot actually generate.
      const studio = document.createElement('section');
      studio.className='studio u-surface';
      studio.innerHTML = `
        <div class="prompt-wrap">
          <textarea id="promptText" placeholder="Play anything... 'a cozy farming sim with cats'; 'a platformer where gravity flips'."></textarea>
        </div>
        <div class="prompt-actions">
          <button class="pill-btn brand" id="btnGenerate">✨ Generate Game</button>
          <button class="pill-btn" id="btnClear">Clear</button>
        </div>
        <div class="canvas-wrap">
          <div class="play-area"><canvas id="studioCanvas" width="800" height="500" aria-label="Game preview"></canvas></div>
          <div class="game-meta">
            <div class="field"><label>Game Title</label><input id="gameTitle" placeholder="Untitled Game"></div>
            <div class="field"><label>Description</label><textarea id="gameDesc" rows="5" placeholder="What have you created?..."></textarea></div>
            <div class="row" style="gap:8px; flex-wrap:wrap">
              <button class="btn brand" id="btnSave">Save Draft</button>
              <button class="btn" id="btnPublish">Publish</button>
              <span id="saveStatus" style="color:var(--muted)"></span>
            </div>
            <small style="color:var(--muted)">Use the arrow keys or WASD to play. A snapshot of your game becomes the thumbnail.</small>
          </div>
        </div>
      `;
      view.appendChild(studio);

      // Grids: Trending (non-logged: trending). Logged-in: Suggested + Trending
      const games = getGames().filter(g=>g.published);
      const trending = [...games].sort((a,b)=>b.likes-a.likes).slice(0,8);

      if(isLogged){
        const suggestions = suggestForUser(getCurrentUser(), games).slice(0,8);
        view.appendChild(sectionGrid('Suggested for you', suggestions, false));
      }
      view.appendChild(sectionGrid(isLogged? 'Trending now' : 'Trending games', trending, true));

      // Hook up studio actions
      $('#btnClear').onclick = ()=>{ $('#promptText').value=''; runGameCode(GAME_TEMPLATES.blank, $('#studioCanvas')); };
      $('#btnGenerate').onclick = ()=>{
  const prompt = $('#promptText').value.trim();
  const template = selectTemplate(prompt);
  runGameCode(template, $('#studioCanvas'));
  toast('LLM generated game logic ✅ (simulated)');
};
      
      $('#btnSave').onclick = ()=>saveGame(false);
      $('#btnPublish').onclick = ()=>saveGame(true);

      // Start with a blank preview
      runGameCode(GAME_TEMPLATES.blank, $('#studioCanvas'));
    }

    function sectionGrid(title, items, showPill){
      const wrap = document.createElement('section');
      const st = document.createElement('div'); st.className='section-title';
      st.innerHTML = `<h2>${title}</h2>`; wrap.appendChild(st);
      const grid = document.createElement('div'); grid.className='grid';
      if(!items.length){ grid.innerHTML = `<div class='empty'>Nothing to see here yet.</div>`; }
      items.forEach(g=> grid.appendChild(gameCard(g, showPill)) );
      wrap.appendChild(grid);
      return wrap;
    }

    function gameCard(game, showPill){
      const t = document.getElementById('cardTemplate').content.cloneNode(true);
      const card = t.querySelector('article');
      const link = t.querySelector('.thumb'); link.href = `#game?id=${game.id}`;
      const titleLink = t.querySelector('[data-titleLink]'); titleLink.href = `#game?id=${game.id}`;
      t.querySelector('[data-title]').textContent = game.title;
      t.querySelector('[data-creator]').innerHTML = `<a class='link' href='#profile?user=${encodeURIComponent(game.creator)}'>@${game.creator}</a>`;
      t.querySelector('[data-likes]').textContent = game.likes;
      const pill = t.querySelector('[data-pill]'); pill.style.display = showPill? 'block':'none';
      t.querySelector('[data-thumb]').src = game.thumbnail || PLACEHOLDER_THUMB(game.title);
      return card;
    }

    function suggestForUser(user, all){
      const acc = getUsers().find(x=>x.username===user);
      if(!acc) return all.slice(0,8);
      const subs = new Set(acc.subscriptions||[]);
      const liked = new Set(acc.likedGames||[]);
      const bySubs = all.filter(g=>subs.has(g.creator));
      const byLikedCreators = all.filter(g => liked.has(g.id));
      const rest = all.filter(g=>!bySubs.includes(g) && !byLikedCreators.includes(g));
      return [...bySubs, ...byLikedCreators, ...rest];
    }

    // ---------- Save / Publish ----------
    function captureCanvas(canvas){ try{ return canvas.toDataURL('image/png'); } catch(e){ return PLACEHOLDER_THUMB('Game'); } }

    function saveGame(publish){
      const user = getCurrentUser();
      if(!user){ toggleModal('requireModal', true); return; }
      const title = $('#gameTitle').value.trim() || 'Untitled Game';
      const description = $('#gameDesc').value.trim() || 'Turn your ideas into play';
      // The last code used in studio is kept in window.__studioCode.
      const code = window.__studioCode || GAME_TEMPLATES.blank;
      const games = getGames();
      const id = uid();
      const thumbnail = captureCanvas($('#studioCanvas'));
      games.push({ id, title, description, creator:user, code, likes:0, published: !!publish, createdAt: nowISO(), thumbnail });
      setGames(games);
      setComments(id, []);
      $('#saveStatus').textContent = publish? 'Published!':'Draft saved.';
      if(publish){ toast('Published 🎉'); setTimeout(()=> location.hash = `#game?id=${id}`, 400); }
      else toast('Draft saved');
    }

    // ---------- Game Page ----------
    function renderGamePage(id){
      const game = getGames().find(g=>g.id===id);
      const view = $('#view');
      if(!game){ view.innerHTML = `<div class='empty'>Game not found.</div>`; return; }

      const comments = getComments(id);
      view.innerHTML = `
        <div class="game-page">
          <div class="game-hero">
            <canvas id="gameCanvas" width="900" height="560"></canvas>
            <div class="row spread" style="margin-top:10px">
              <div>
                <h2 style="margin:0">${game.title}</h2>
                <div class="mini">by <a class="link" href="#profile?user=${encodeURIComponent(game.creator)}">@${game.creator}</a> • ${new Date(game.createdAt).toLocaleString()}</div>
              </div>
              <div class="row" style="gap:8px">
                <button class="pill-btn" id="likeBtn">❤ Like <span id="likeCount">${game.likes}</span></button>
                <button class="pill-btn" id="shareBtn">Share</button>
                <a class="pill-btn" href="#home">Back</a>
              </div>
            </div>
          </div>
          <aside class="game-side">
            <div class="game-box">
              <strong>Description</strong>
              <p style="color:var(--muted)">${game.description}</p>
              <div class="row" style="gap:8px">
                <button class="btn" id="subBtn">Subscribe to @${game.creator}</button>
              </div>
            </div>
            <div class="game-box" id="commentsBox">
              <strong>Comments</strong>
              <div id="commentsList"></div>
              <div id="commentInputWrap" class="row" style="margin-top:8px; gap:8px">
                <input id="commentInput" class="field" placeholder="Write a comment..." style="flex:1; padding:10px 12px; border-radius:999px; background:var(--panel); border:1px solid var(--stroke)"/>
                <button class="btn brand" id="commentSend">Send</button>
              </div>
              <div id="commentLoginHint" class="empty" style="display:none">Sign in to comment.</div>
            </div>
          </aside>
        </div>
      `;

      // Playable canvas
      const canvas = $('#gameCanvas');
      runGameCode(game.code, canvas);

      // Like button
      $('#likeBtn').onclick = ()=>{
        const user = getCurrentUser();
        if(!user) return openAuth('signin');
        const users = getUsers(); const me = users.find(x=>x.username===user);
        me.likedGames = me.likedGames||[];
        const liked = me.likedGames.includes(game.id);
        if(liked){
          me.likedGames = me.likedGames.filter(x=>x!==game.id);
          game.likes = Math.max(0, (game.likes||0) - 1);
        } else {
          me.likedGames.push(game.id);
          game.likes = (game.likes||0) + 1;
        }
        setUsers(users); const all = getGames(); const idx = all.findIndex(g=>g.id===game.id); all[idx]=game; setGames(all);
        $('#likeCount').textContent = game.likes;
        toast(liked? 'Unliked' : 'Liked ❤');
      };

      // Share button
      $('#shareBtn').onclick = async ()=>{
        const link = location.origin + location.pathname + `#game?id=${game.id}`;
        try{ await navigator.clipboard.writeText(link); toast('Link copied to clipboard'); }catch(e){ alert('Share this link: '+link); }
      };

      // Subscribe
      $('#subBtn').onclick = ()=>{
        const user = getCurrentUser(); if(!user) return openAuth('signin');
        const users = getUsers(); const me = users.find(x=>x.username===user);
        me.subscriptions = me.subscriptions||[];
        if(me.subscriptions.includes(game.creator)){
          me.subscriptions = me.subscriptions.filter(x=>x!==game.creator); toast('Unsubscribed');
        } else { me.subscriptions.push(game.creator); toast('Subscribed ✅'); }
        setUsers(users); buildSubsList();
      };

      // Comments
      function renderComments(){
        const list = $('#commentsList'); list.innerHTML='';
        const data = getComments(id);
        if(!data.length) list.innerHTML = `<div class='empty'>No comments yet.</div>`;
        data.slice().reverse().forEach(c=>{
          const el = document.createElement('div'); el.className='comment';
          el.innerHTML = `<strong>@${c.user}</strong><br><small>${new Date(c.ts).toLocaleString()}</small><p>${escapeHTML(c.text)}</p>`;
          list.appendChild(el);
        });
      }
      const logged = !!getCurrentUser();
      $('#commentInputWrap').style.display = logged? 'flex':'none';
      $('#commentLoginHint').style.display = logged? 'none':'block';
      $('#commentSend').onclick = ()=>{
        const user = getCurrentUser(); if(!user) return openAuth('signin');
        const text = $('#commentInput').value.trim(); if(!text) return;
        const arr = getComments(id); arr.push({user, text, ts: nowISO()}); setComments(id, arr);
        $('#commentInput').value=''; renderComments();
      };
      renderComments();
    }

    function escapeHTML(s){ return s.replace(/[&<>\"']/g, m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m])); }

    // ---------- Profile Page ----------
    function renderProfile(user){
      const games = getGames().filter(g=>g.published && g.creator.toLowerCase()===String(user||'').toLowerCase());
      const view = $('#view');
      view.innerHTML = `
        <div class="section-title"><h2>Creator: @${escapeHTML(user||'')}</h2>
          <div class="row" style="gap:8px">
            <button class="pill-btn" id="subBtnProfile">Subscribe</button>
            <a class="pill-btn" href="#subs">View subscriptions</a>
          </div>
        </div>
        <section class="grid" id="profileGrid"></section>
      `;
      const grid = $('#profileGrid');
      if(!games.length) grid.innerHTML = `<div class='empty' style='grid-column:1/-1'>No published games yet.</div>`;
      else games.forEach(g=> grid.appendChild(gameCard(g,false)) );
      $('#subBtnProfile').onclick = ()=>{
        const me = getCurrentUser(); if(!me) return openAuth('signin');
        const users = getUsers(); const mine = users.find(x=>x.username===me); mine.subscriptions = mine.subscriptions||[];
        if(mine.subscriptions.includes(user)){ mine.subscriptions = mine.subscriptions.filter(x=>x!==user); toast('Unsubscribed'); }
        else{ mine.subscriptions.push(user); toast('Subscribed ✅'); }
        setUsers(users); buildSubsList();
      };
    }

    // ---------- Subscriptions Page ----------
    function renderSubscriptions(){
      const user = getCurrentUser(); const view = $('#view');
      if(!user){ view.innerHTML = `<div class='empty'>Sign in to see subscriptions.</div>`; return; }
      const me = getUsers().find(x=>x.username===user);
      const subs = new Set(me.subscriptions||[]);
      const games = getGames().filter(g=>g.published && subs.has(g.creator));
      view.innerHTML = `<div class='section-title'><h2>Subscriptions</h2></div>`;
      view.appendChild(sectionGrid('From creators you follow', games, false));
    }

    // ---------- Liked Page ----------
    function renderLiked(){
      const user = getCurrentUser(); const view = $('#view');
      if(!user){ view.innerHTML = `<div class='empty'>Sign in to see your liked games.</div>`; return; }
      const me = getUsers().find(x=>x.username===user);
      const likedIds = new Set(me.likedGames||[]);
      const games = getGames().filter(g=>g.published && likedIds.has(g.id));
      view.innerHTML = `<div class='section-title'><h2>Liked Games</h2></div>`;
      view.appendChild(sectionGrid('You liked', games, false));
    }

    // ---------- Search ----------
    function renderSearch(q){
      const view = $('#view');
      const term = (q||'').toLowerCase();
      const games = getGames().filter(g=>g.published && (g.title.toLowerCase().includes(term) || g.description.toLowerCase().includes(term) || g.creator.toLowerCase().includes(term)));
      view.innerHTML = `<div class='section-title'><h2>Search results for "${escapeHTML(q)}"</h2></div>`;
      view.appendChild(sectionGrid('Results', games, false));
    }

    // ---------- Sidebar (subscriptions quick list) ----------
    function buildSubsList(){
      const box = $('#subsList'); if(!box) return; box.innerHTML='';
      const user = getCurrentUser(); if(!user) return;
      const me = getUsers().find(x=>x.username===user) || {subscriptions:[]};
      if(!me.subscriptions || !me.subscriptions.length){ box.innerHTML = `<div class='empty'>No subscriptions yet.</div>`; return; }
      me.subscriptions.forEach(u=>{
        const a = document.createElement('a'); a.href = `#profile?user=${encodeURIComponent(u)}`; a.className='sub-item';
        a.innerHTML = `<div class='avatar'></div><div style='display:grid'><strong>@${u}</strong><span class='mini'>Creator</span></div>`;
        box.appendChild(a);
      });
    }

    // ---------- Header controls ----------
    function wireHeader(){
      $('#btnSignIn').onclick = ()=> openAuth('signin');
      $('#btnSignUp').onclick = ()=> openAuth('signup');
      $('#authCancel').onclick = ()=> toggleModal('authModal', false);
      $('#authConfirm').onclick = handleAuth;
      $('#btnSignOut').onclick = ()=>{ setCurrentUser(null); toast('Signed out'); router(); };
      $('#btnSubscriptions').onclick = ()=> location.hash = '#subs';
      $('#btnLiked').onclick = ()=> location.hash = '#liked';
      $('#sidebarLikedBtn')?.addEventListener('click', ()=> location.hash = '#liked');
      $('#searchInput').addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ location.hash = `#search?q=${encodeURIComponent(e.target.value)}`; e.target.blur(); } });
    }

    // ---------- Game Runtime (safe-ish sandbox) ----------
    let CURRENT_STOP = null; // cleanup function for running game

    function runGameCode(code, canvas){
      // Stop previous game loop if any
      if(typeof CURRENT_STOP === 'function'){ try{ CURRENT_STOP(); }catch(e){} CURRENT_STOP=null; }

      const ctx = canvas.getContext('2d');
      // Basic utils exposed to the game code (no window/document)
      const utils = {
        width: canvas.width, height: canvas.height,
        rand:(a,b)=> Math.random()*(b-a)+a,
        keys: KEY_STATE,
        _bg: getCSSVar('--canvas-bg', '#0A0B0D'),
clear() {
  ctx.fillStyle = this._bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
},
        text:(s,x,y,size=16)=>{ ctx.fillStyle=getCSSVar('--text', '#e6e8ee'); ctx.font=`${size}px ui-sans-serif, system-ui`; ctx.fillText(s,x,y); },
        circle:(x,y,r,c='#fff')=>{ ctx.fillStyle=c; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill(); },
        rect:(x,y,w,h,c='#fff')=>{ ctx.fillStyle=c; ctx.fillRect(x,y,w,h); },
        now:()=> performance.now(),
      };

      //React to live theme changes.
      function startLoop(update){
        let id; let last = performance.now();
        const loop = (t)=> {
          id = requestAnimationFrame(loop);
          const dt = (t - last) / 1000; last = t;
          // keep bg in sync if theme changed
          if (utils._bg !== getCSSVar('--canvas-bg', utils._bg)) {
            utils._bg = getCSSVar('--canvas-bg', utils._bg);
          }
          update(dt);
        };
        id = requestAnimationFrame(loop);
        return ()=> cancelAnimationFrame(id);
      }

      // Execute code in a constrained Function scope.
      try{
        const fn = new Function('canvas','ctx','utils','startLoop', code+"\n;return typeof startGame==='function'? startGame(canvas, ctx, utils, startLoop) : null;");
        const stop = fn(canvas, ctx, utils, startLoop);
        CURRENT_STOP = ()=>{ try{ if(stop) stop(); }catch(e){} };
      } catch(err){
        console.error(err); utils.clear(); utils.text('Error in game code. See console.', 20, 30, 18);
        CURRENT_STOP = ()=>{};
      }

      // store last code for saving/publishing
      window.__studioCode = code;
    }

    // ---------- LLM Simulation ----------
    function selectTemplate(prompt){
      const p = (prompt||'').toLowerCase();
      if(p.includes('snake')) return GAME_TEMPLATES.snake;
      if(p.includes('pong')) return GAME_TEMPLATES.pong;
      if(p.includes('breakout')||p.includes('bricks')) return GAME_TEMPLATES.breakout;
      if(p.includes('flappy')) return GAME_TEMPLATES.flappy;
      if(p.includes('runner')) return GAME_TEMPLATES.runner;
      if(p.includes('space')||p.includes('shooter')) return GAME_TEMPLATES.shooter;
      return GAME_TEMPLATES.bouncer; // fallback
    }

    // ---------- Game Templates (stringified JS) ----------
    const GAME_TEMPLATES = {
      // Blank canvas (for initial state)
      blank: `function startGame(canvas, ctx, utils, startLoop){\n  utils.clear();\n  utils.text('Describe a game in the box above, then click Generate.', 20, 40, 18);\n  return ()=>{};\n}`,

      // Simple bouncing demo
      bouncer: `function startGame(canvas, ctx, utils, startLoop){\n  let x=100,y=100,vx=140,vy=170,r=18;\n  const stop = startLoop(dt=>{\n    utils.clear();\n    x+=vx*dt; y+=vy*dt;\n    if(x<r||x>canvas.width-r) vx*=-1; if(y<r||y>canvas.height-r) vy*=-1;\n    if(utils.keys.has('arrowup')||utils.keys.has('w')){ vy-=10; }\n    if(utils.keys.has('arrowdown')||utils.keys.has('s')){ vy+=10; }\n    if(utils.keys.has('arrowleft')||utils.keys.has('a')){ vx-=10; }\n    if(utils.keys.has('arrowright')||utils.keys.has('d')){ vx+=10; }\n    utils.circle(x,y,r,'#7c5cff');\n    utils.text('Bouncer — press arrow keys', 14, 24, 16);\n  });\n  return ()=> stop();\n}`,

      // Flappy clone (basic)
      flappy: `function startGame(canvas, ctx, utils, startLoop){\n  let birdY = canvas.height/2, vel=0, grav=800, jump=-300, t=0;\n  let pipes=[]; let score=0;\n  function spawn(){\n    const gap=140; const top = Math.random()* (canvas.height-200) + 60;\n    pipes.push({x:canvas.width, top: top-gap/2, bottom: top+gap/2});\n  } spawn();\n  const stop = startLoop(dt=>{\n    t+=dt; if(t>1.5){ spawn(); t=0;}\n    vel += grav*dt; birdY += vel*dt;\n    if(utils.keys.has(' ')||utils.keys.has('arrowup')||utils.keys.has('w')){ vel = jump; }\n    pipes.forEach(p=> p.x -= 180*dt);\n    pipes = pipes.filter(p=> p.x>-80);\n    // collisions
    pipes.forEach(p=>{ if((birdY< p.top || birdY>p.bottom) && Math.abs(p.x-120)<16){ score=0; birdY=canvas.height/2; vel=0; pipes=[]; spawn(); } });\n    // draw
    utils.clear();\n    utils.circle(120,birdY,12,'#00e0b8');\n    pipes.forEach(p=>{ utils.rect(p.x-20,0,40,p.top,'#445'); utils.rect(p.x-20,p.bottom,40,canvas.height-p.bottom,'#445'); });\n    utils.text('Flappy-ish — space to flap | Score:'+score, 14, 24, 16);\n    score+=dt;\n  });\n  return ()=> stop();\n}`,

      // Endless runner (ground + jumps)
      runner: `function startGame(canvas, ctx, utils, startLoop){\n  let x=120,y=0,vy=0,ground=canvas.height-80;\n  const obstacles=[]; let t=0,score=0;\n  const stop = startLoop(dt=>{\n    t+=dt; if(t>1.2){ t=0; obstacles.push({x:canvas.width, y:ground-24, w:24,h:24}); }\n    vy+=900*dt; y+=vy*dt; if(y>ground){ y=ground; vy=0;}\n    if((utils.keys.has(' ')||utils.keys.has('arrowup')||utils.keys.has('w')) && y===ground){ vy=-450; }\n    obstacles.forEach(o=> o.x-=220*dt);\n    // collision
    obstacles.forEach(o=>{ if(Math.abs(o.x-x)<18 && y>o.y-18){ score=0; obstacles.length=0; } });\n    utils.clear(); utils.rect(0,ground,canvas.width,4,'#4a4');\n    utils.circle(x,y-12,12,'#7c5cff'); obstacles.forEach(o=> utils.rect(o.x,o.y,o.w,o.h,'#a44'));\n    score+=dt; utils.text('Runner — jump with space',14,24,16);\n  });\n  return ()=> stop();\n}`,

      // Shooter (asteroids-ish)
      shooter: `function startGame(canvas, ctx, utils, startLoop){\n  let ship={x:canvas.width/2,y:canvas.height/2,a:0}; let bullets=[]; let rocks=[]; let t=0;\n  function rock(){ return {x:utils.rand(0,canvas.width), y:utils.rand(0,canvas.height), vx:utils.rand(-60,60), vy:utils.rand(-60,60), r: utils.rand(16,30)} }\n  for(let i=0;i<8;i++) rocks.push(rock());\n  const stop = startLoop(dt=>{\n    // input
    if(utils.keys.has('a')||utils.keys.has('arrowleft')) ship.a-=2*dt;\n    if(utils.keys.has('d')||utils.keys.has('arrowright')) ship.a+=2*dt;\n    if(utils.keys.has('w')||utils.keys.has('arrowup')){ ship.x+=Math.cos(ship.a)*140*dt; ship.y+=Math.sin(ship.a)*140*dt; }\n    if(utils.keys.has(' ')){ bullets.push({x:ship.x, y:ship.y, vx:Math.cos(ship.a)*280, vy:Math.sin(ship.a)*280, t:0}); }\n    bullets.forEach(b=>{ b.x+=b.vx*dt; b.y+=b.vy*dt; b.t+=dt; }); bullets=bullets.filter(b=>b.t<2.5);\n    rocks.forEach(r=>{ r.x+=r.vx*dt; r.y+=r.vy*dt; if(r.x<0)r.x=canvas.width; if(r.x>canvas.width)r.x=0; if(r.y<0)r.y=canvas.height; if(r.y>canvas.height)r.y=0; });\n    // collisions
    bullets.forEach(b=>{ rocks.forEach(r=>{ if((b.x-r.x)**2 + (b.y-r.y)**2 < (r.r)**2){ r.r-=8; b.t=10; } }); });\n    rocks=rocks.filter(r=> r.r>8); if(rocks.length<6) rocks.push(rock());\n    // draw
    utils.clear();\n    // ship
    ctx.save(); ctx.translate(ship.x, ship.y); ctx.rotate(ship.a); ctx.strokeStyle='#e6e8ee'; ctx.beginPath(); ctx.moveTo(14,0); ctx.lineTo(-10,8); ctx.lineTo(-4,0); ctx.lineTo(-10,-8); ctx.closePath(); ctx.stroke(); ctx.restore();\n    // bullets & rocks
    bullets.forEach(b=> utils.circle(b.x,b.y,2,'#00e0b8'));\n    rocks.forEach(r=> utils.circle(r.x,r.y,r.r,'#445'));\n    utils.text('Shooter — WASD + Space',14,24,16);\n  });\n  return ()=> stop();\n}`,

      // Snake (classic)
      snake: `function startGame(canvas, ctx, utils, startLoop){\n  const grid=20; let snake=[{x:10,y:10}], dir={x:1,y:0}, food={x:15,y:10}, t=0, speed=8;\n  function placeFood(){ food={ x: Math.floor(utils.rand(0, canvas.width/grid)), y: Math.floor(utils.rand(0, canvas.height/grid)) }; }\n  const stop = startLoop(dt=>{\n    t+=dt; if(t<1/speed) return; t=0;\n    // input
    if(utils.keys.has('arrowup')||utils.keys.has('w')) dir={x:0,y:-1};
    if(utils.keys.has('arrowdown')||utils.keys.has('s')) dir={x:0,y:1};
    if(utils.keys.has('arrowleft')||utils.keys.has('a')) dir={x:-1,y:0};
    if(utils.keys.has('arrowright')||utils.keys.has('d')) dir={x:1,y:0};
    const head={x:(snake[0].x+dir.x+Math.floor(canvas.width/grid))%Math.floor(canvas.width/grid), y:(snake[0].y+dir.y+Math.floor(canvas.height/grid))%Math.floor(canvas.height/grid)};\n    if(snake.some(p=>p.x===head.x && p.y===head.y)){ snake=[{x:10,y:10}]; dir={x:1,y:0}; placeFood(); } else { snake.unshift(head); }\n    if(head.x===food.x && head.y===food.y){ placeFood(); } else { snake.pop(); }\n    utils.clear(); ctx.fillStyle='#7c5cff'; snake.forEach(p=> ctx.fillRect(p.x*grid,p.y*grid,grid-1,grid-1)); ctx.fillStyle='#00e0b8'; ctx.fillRect(food.x*grid,food.y*grid,grid-1,grid-1);\n    utils.text('Snake — arrows/WASD', 14, 24, 16);\n  });\n  return ()=> stop();\n}`,

      // Pong (2-player)
      pong: `function startGame(canvas, ctx, utils, startLoop){\n  let p1={y:canvas.height/2-35}, p2={y:canvas.height/2-35}, ball={x:canvas.width/2,y:canvas.height/2,vx:180,vy:140}; const w=12,h=70;\n  const stop = startLoop(dt=>{\n    // inputs: W/S for left, Up/Down for right
    if(utils.keys.has('w')) p1.y-=220*dt; if(utils.keys.has('s')) p1.y+=220*dt; if(utils.keys.has('arrowup')) p2.y-=220*dt; if(utils.keys.has('arrowdown')) p2.y+=220*dt;\n    p1.y=Math.max(0,Math.min(canvas.height-h,p1.y)); p2.y=Math.max(0,Math.min(canvas.height-h,p2.y));\n    ball.x+=ball.vx*dt; ball.y+=ball.vy*dt; if(ball.y<6||ball.y>canvas.height-6) ball.vy*=-1;\n    // collide paddles
    if(ball.x<22 && ball.y>p1.y && ball.y<p1.y+h){ ball.vx=Math.abs(ball.vx)+10; }
    if(ball.x>canvas.width-22 && ball.y>p2.y && ball.y<p2.y+h){ ball.vx=-Math.abs(ball.vx)-10; }
    // reset if out of bounds
    if(ball.x<0||ball.x>canvas.width){ ball={x:canvas.width/2,y:canvas.height/2,vx:(Math.random()<.5?-1:1)*180,vy:(Math.random()<.5?-1:1)*140}; }
    // draw
    utils.clear(); utils.rect(10,p1.y,w,h,'#7c5cff'); utils.rect(canvas.width-22,p2.y,w,h,'#00e0b8'); utils.circle(ball.x,ball.y,6,'#e6e8ee');\n    ctx.setLineDash([6,8]); ctx.strokeStyle='#2b2f46'; ctx.beginPath(); ctx.moveTo(canvas.width/2,0); ctx.lineTo(canvas.width/2,canvas.height); ctx.stroke(); ctx.setLineDash([]);\n    utils.text('Pong — W/S vs Arrows',14,24,16);\n  });\n  return ()=> stop();\n}`,

      // Breakout
      breakout: `function startGame(canvas, ctx, utils, startLoop){\n  const paddle={x:canvas.width/2-40, y:canvas.height-24, w:80, h:10};
  let ball={x:canvas.width/2, y:canvas.height-60, vx:160, vy:-160, r:6};
  const rows=5, cols=8, bricks=[]; for(let r=0;r<rows;r++)for(let c=0;c<cols;c++)bricks.push({x:40+c* ( (canvas.width-80)/cols ), y:40+r*22, w:(canvas.width-80)/cols-6, h:14, hit:false});
  let remaining = bricks.length;
  const stop = startLoop(dt=>{
    // input
    if(utils.keys.has('arrowleft')||utils.keys.has('a')) paddle.x-=300*dt; if(utils.keys.has('arrowright')||utils.keys.has('d')) paddle.x+=300*dt;
    paddle.x = Math.max(8, Math.min(canvas.width-paddle.w-8, paddle.x));
    // move ball
    ball.x+=ball.vx*dt; ball.y+=ball.vy*dt; if(ball.x<ball.r||ball.x>canvas.width-ball.r) ball.vx*=-1; if(ball.y<ball.r) ball.vy*=-1; if(ball.y>canvas.height){ ball={x:canvas.width/2,y:canvas.height-60,vx:160,vy:-160,r:6}; }
    // paddle collision
    if(ball.y>paddle.y-ball.r && ball.x>paddle.x && ball.x<paddle.x+paddle.w && ball.vy>0){ ball.vy*=-1; const off=(ball.x-(paddle.x+paddle.w/2))/(paddle.w/2); ball.vx += off*60; }
    // bricks
    bricks.forEach(b=>{ if(!b.hit && ball.x>b.x && ball.x<b.x+b.w && ball.y>b.y && ball.y<b.y+b.h){ b.hit=true; remaining--; ball.vy*=-1; } });
    // draw
    utils.clear(); utils.rect(paddle.x,paddle.y,paddle.w,paddle.h,'#e6e8ee'); utils.circle(ball.x,ball.y,ball.r,'#7c5cff');
    bricks.forEach(b=>{ if(!b.hit) utils.rect(b.x,b.y,b.w,b.h,'#445'); });
    utils.text(remaining? 'Breakout — clear all bricks' : 'You win! Press any key', 14, 24, 16);
  });
  return ()=> stop();
}`,
    };

    // ---------- App Bootstrap ----------
    preloadGames();
    wireHeader();
    updateAuthUI();
    window.addEventListener('hashchange', router);
    if(!location.hash) location.hash = '#home';
    router();

    // Keyboard accessibility for closing modals
    window.addEventListener('keydown', e=>{ if(e.key==='Escape'){ toggleModal('authModal', false); toggleModal('requireModal', false);} });
