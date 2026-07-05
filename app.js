import { PLAYER_DB } from './db.js';

/* ─────────────────── State ─────────────────── */
let squad = [];          // [{name, role, batting_avg, ...}]
let lastXI = null;

const DEMO_PLAYERS = [
  "Virat Kohli", "Steve Smith", "Kane Williamson", "AB de Villiers", "Jasprit Bumrah",
  "Jos Buttler", "Glenn Maxwell", "Shakib Al Hasan", "Rashid Khan", "Pat Cummins",
  "Mitchell Starc", "Babar Azam", "Rohit Sharma", "MS Dhoni", "Ravindra Jadeja"
];

/* ─────────────────── Theme ─────────────────── */
function toggleTheme() {
  const html = document.documentElement;
  const dark = html.getAttribute('data-theme') === 'dark';
  html.setAttribute('data-theme', dark ? 'light' : 'dark');
  document.getElementById('theme-icon').textContent  = dark ? '🌙' : '☀️';
  document.getElementById('theme-label').textContent = dark ? 'Dark' : 'Light';
  
  // Update chart elements color scheme if a chart is currently drawn
  if (lastXI && document.getElementById('tab-compare').style.display !== 'none') {
    renderCompare();
  }
}

/* ─────────────────── Alert ─────────────────── */
function showAlert(msg, type='error') {
  const el = document.getElementById('alert-box');
  el.textContent = msg;
  el.className = `alert alert-${type} show`;
  setTimeout(() => { el.classList.remove('show'); }, 4000);
}

/* ─────────────────── Loading ─────────────────── */
function setLoading(show, text='Fetching player data…') {
  const ov = document.getElementById('loading-overlay');
  document.getElementById('loading-text').textContent = text;
  ov.classList.toggle('show', show);
}

function setSearchSpinner(show) {
  document.getElementById('search-spinner').style.display = show ? 'block' : 'none';
}

/* ─────────────────── Analytics Engine (JS equivalent of Pandas/NumPy) ─────────────────── */
function computeScores(squadList) {
  if (squadList.length === 0) return [];

  // Extract arrays for min-max normalization
  const getMinMax = (key) => {
    const vals = squadList.map(p => parseFloat(p[key] || 0));
    return { min: Math.min(...vals), max: Math.max(...vals) };
  };

  const normVal = (val, min, max, inverse = false) => {
    if (max === min) return 0.5;
    const norm = (val - min) / (max - min);
    return inverse ? 1 - norm : norm;
  };

  const bounds = {
    batting_avg: getMinMax('batting_avg'),
    strike_rate: getMinMax('strike_rate'),
    total_runs: getMinMax('total_runs'),
    wickets: getMinMax('wickets'),
    economy: getMinMax('economy'),
    catches: getMinMax('catches'),
  };

  return squadList.map(p => {
    const batAvg = parseFloat(p.batting_avg || 0);
    const sr = parseFloat(p.strike_rate || 0);
    const runs = parseInt(p.total_runs || 0);
    const wkts = parseInt(p.wickets || 0);
    const econ = parseFloat(p.economy || 0);
    const ct = parseInt(p.catches || 0);
    const fit = parseFloat(p.fitness || 85);
    const form = parseFloat(p.recent_form || 70);

    // Batting Score
    const normBatAvg = normVal(batAvg, bounds.batting_avg.min, bounds.batting_avg.max);
    const normSR = normVal(sr, bounds.strike_rate.min, bounds.strike_rate.max);
    const normRuns = normVal(runs, bounds.total_runs.min, bounds.total_runs.max);
    const batScore = (normBatAvg * 0.4 + normSR * 0.3 + normRuns * 0.3) * 100;

    // Bowling Score (lower economy is better)
    let econScore = 1 - normVal(econ, bounds.economy.min, bounds.economy.max);
    if (econ === 0) econScore = 0; // non-bowlers
    const wktScore = normVal(wkts, bounds.wickets.min, bounds.wickets.max);
    let bowlScore = (wktScore * 0.6 + econScore * 0.4) * 100;
    if (wkts === 0) bowlScore = 0;

    // Fielding Score
    const fieldScore = normVal(ct, bounds.catches.min, bounds.catches.max) * 100;

    // Overall Score depending on role
    let overall = 0;
    const role = (p.role || "Batsman").toLowerCase();
    if (role.includes("bat")) {
      overall = 0.50 * batScore + 0.15 * fieldScore + 0.15 * fit + 0.20 * form;
    } else if (role.includes("bowl")) {
      overall = 0.50 * bowlScore + 0.15 * fieldScore + 0.15 * fit + 0.20 * form;
    } else if (role.includes("all")) {
      overall = 0.35 * batScore + 0.35 * bowlScore + 0.10 * fieldScore + 0.10 * fit + 0.10 * form;
    } else { // Wicketkeeper
      overall = 0.45 * batScore + 0.25 * fieldScore + 0.15 * fit + 0.15 * form;
    }

    return {
      ...p,
      batting_score: Math.round(batScore * 100) / 100,
      bowling_score: Math.round(bowlScore * 100) / 100,
      fielding_score: Math.round(fieldScore * 100) / 100,
      fitness_score: fit,
      form_score: form,
      overall_score: Math.round(overall * 100) / 100
    };
  });
}

function calculateBestXI(players) {
  const scored = computeScores(players);
  // Sort players by Overall Score descending
  const sorted = [...scored].sort((a, b) => b.overall_score - a.overall_score);
  
  const selected = [];
  const selectedNames = new Set();

  // Role limits matching Flask system logic: Wicketkeeper (1), Batsman (4), All-Rounder (2), Bowler (4)
  const rolesNeeded = {
    wicketkeeper: 1,
    batsman: 4,
    allrounder: 2,
    bowler: 4
  };
  const roleCounts = {
    wicketkeeper: 0,
    batsman: 0,
    allrounder: 0,
    bowler: 0
  };

  const getRoleKey = (role) => {
    const r = (role || "").toLowerCase();
    if (r.includes("wick")) return "wicketkeeper";
    if (r.includes("all")) return "allrounder";
    if (r.includes("bowl")) return "bowler";
    if (r.includes("bat")) return "batsman";
    return "unknown";
  };

  // First pass: Fill role quotas
  for (const p of sorted) {
    const roleKey = getRoleKey(p.role);
    if (roleKey !== "unknown" && roleCounts[roleKey] < rolesNeeded[roleKey]) {
      selected.push(p);
      selectedNames.add(p.name);
      roleCounts[roleKey]++;
    }
  }

  // Second pass: Top up to 11 with remaining players by overall score
  for (const p of sorted) {
    if (selected.length >= 11) break;
    if (!selectedNames.has(p.name)) {
      selected.push(p);
      selectedNames.add(p.name);
    }
  }

  // Pick Captain & Vice-Captain using Leadership Score:
  // Leadership Score = 40% Overall Score + 30% Leadership Rating + 30% Recent Form (Form Score)
  const candidates = selected.map(p => {
    const leadRating = parseFloat(p.leadership_rating || 50);
    const form = parseFloat(p.recent_form || 70);
    const leadScore = 0.4 * p.overall_score + 0.3 * leadRating + 0.3 * form;
    return {
      ...p,
      leadership_score: Math.round(leadScore * 100) / 100
    };
  });

  candidates.sort((a, b) => b.leadership_score - a.leadership_score);

  return {
    xi: candidates,
    captain: candidates[0] ? candidates[0].name : null,
    vice_captain: candidates[1] ? candidates[1].name : null,
    full_squad: sorted
  };
}

/* ─────────────────── ESPNcricinfo Client Scraper (using CORS proxy) ─────────────────── */
async function fetchHtmlWithFallback(targetUrl) {
  // Try 1: corsproxy.io (direct raw HTML proxy, reliable for client-side)
  try {
    const corsProxyUrl = 'https://corsproxy.io/?' + encodeURIComponent(targetUrl);
    const res = await fetch(corsProxyUrl);
    if (res.ok) {
      const text = await res.text();
      if (text && !text.includes('Server-side requests are not allowed') && !text.includes('pricing')) {
        return text;
      }
    }
  } catch (err) {
    console.warn("corsproxy.io failed, trying allorigins fallback:", err);
  }

  // Try 2: api.allorigins.win (returns wrapped JSON response)
  try {
    const alloriginsUrl = 'https://api.allorigins.win/get?url=' + encodeURIComponent(targetUrl);
    const res = await fetch(alloriginsUrl);
    if (res.ok) {
      const json = await res.json();
      if (json && json.contents) {
        return json.contents;
      }
    }
  } catch (err) {
    console.warn("allorigins fallback failed:", err);
  }

  throw new Error("Failed to fetch HTML content via all available CORS proxies.");
}

async function searchPlayerWeb(playerName) {
  const searchUrl = `https://www.espncricinfo.com/ci/content/player/search.html?search=${encodeURIComponent(playerName)}`;
  
  try {
    const contents = await fetchHtmlWithFallback(searchUrl);
    const parser = new DOMParser();
    const doc = parser.parseFromString(contents, 'text/html');
    const links = doc.querySelectorAll("a[href*='/player/']");
    if (links.length === 0) return null;
    
    let playerId = null;
    for (const link of links) {
      const href = link.getAttribute('href');
      const match = href.match(/\/player\/[^/]+-(\d+)/);
      if (match) {
        playerId = match[1];
        break;
      }
    }
    if (!playerId) return null;
    
    return await fetchPlayerStatsWeb(playerId, playerName);
  } catch (e) {
    console.error("Web lookup error:", e);
    return null;
  }
}

async function fetchPlayerStatsWeb(playerId, playerName) {
  const url = `https://stats.espncricinfo.com/ci/engine/player/${playerId}.html?class=2;type=allround`;
  
  try {
    const contents = await fetchHtmlWithFallback(url);
    const parser = new DOMParser();
    const doc = parser.parseFromString(contents, 'text/html');
    
    const stats = { name: playerName, player_id: playerId };
    const tables = doc.querySelectorAll("table.engineTable");
    
    tables.forEach(tbl => {
      const caption = tbl.querySelector("caption");
      if (!caption) return;
      const capText = caption.textContent.trim().toLowerCase();
      
      const rows = tbl.querySelectorAll("tr");
      if (rows.length < 2) return;
      
      const headers = Array.from(rows[0].querySelectorAll("th, td")).map(el => el.textContent.trim());
      
      for (let i = 1; i < rows.length; i++) {
        const cols = Array.from(rows[i].querySelectorAll("td")).map(td => td.textContent.trim());
        if (cols.length === 0) continue;
        
        const rowDict = {};
        headers.forEach((h, idx) => {
          rowDict[h] = cols[idx] || "";
        });
        
        if (capText.includes("batting") || capText.includes("bat")) {
          stats["batting_matches"] = safeInt(rowDict["Mat"] || rowDict["M"]);
          stats["total_runs"] = safeInt(rowDict["Runs"]);
          stats["batting_avg"] = safeFloat(rowDict["Ave"]);
          stats["strike_rate"] = safeFloat(rowDict["SR"]);
          stats["hundreds"] = safeInt(rowDict["100"]);
          stats["fifties"] = safeInt(rowDict["50"]);
          break;
        }
        
        if (capText.includes("bowling") || capText.includes("bowl")) {
          stats["wickets"] = safeInt(rowDict["Wkts"] || rowDict["Wkt"]);
          stats["bowling_avg"] = safeFloat(rowDict["Ave"]);
          stats["economy"] = safeFloat(rowDict["Econ"]);
          stats["bowling_sr"] = safeFloat(rowDict["SR"]);
          break;
        }
      }
    });
    
    return stats;
  } catch (e) {
    console.error("Error fetching player stats:", e);
    return null;
  }
}

function safeInt(v) {
  if (!v) return 0;
  const cleaned = String(v).replace(/,/g, '').replace(/-/g, '0');
  return parseInt(cleaned) || 0;
}

function safeFloat(v) {
  if (!v) return 0.0;
  const cleaned = String(v).replace(/,/g, '').replace(/-/g, '0');
  return parseFloat(cleaned) || 0.0;
}

function inferRole(d) {
  const runs = d.total_runs || 0;
  const wkts = d.wickets || 0;
  if (runs >= 2000 && wkts >= 100) return "All-Rounder";
  if (wkts >= 100) return "Bowler";
  if (runs >= 1000) return "Batsman";
  return "Unknown";
}

function enrichDefaults(d, name) {
  const role = d.role || inferRole(d);
  
  return {
    name: name || d.name,
    player_id: d.player_id || "",
    role: role,
    batting_avg: d.batting_avg || 0.0,
    strike_rate: d.strike_rate || 0.0,
    total_runs: d.total_runs || 0,
    hundreds: d.hundreds || 0,
    fifties: d.fifties || 0,
    wickets: d.wickets || 0,
    economy: d.economy || 0.0,
    bowling_avg: d.bowling_avg || 0.0,
    bowling_sr: d.bowling_sr || 0.0,
    batting_matches: d.batting_matches || 0,
    matches: d.batting_matches || d.matches || 0,
    fitness: d.fitness || 85,
    recent_form: d.recent_form || 70,
    catches: d.catches || 0,
    leadership_rating: d.leadership_rating || 50,
  };
}

async function lookupPlayerClientSide(playerName) {
  const key = playerName.trim().toLowerCase();
  
  // 1. Curated database direct match
  if (PLAYER_DB[key]) {
    const p = enrichDefaults(PLAYER_DB[key], PLAYER_DB[key].name);
    p.source = 'local';
    return p;
  }
  
  // 2. Curated database partial match
  for (const k in PLAYER_DB) {
    if (k.includes(key) || key.includes(k)) {
      const p = enrichDefaults(PLAYER_DB[k], PLAYER_DB[k].name);
      p.source = 'local';
      return p;
    }
  }
  
  // 3. Web crawler scraping
  try {
    const webData = await searchPlayerWeb(playerName);
    if (webData && (webData.total_runs || webData.wickets)) {
      const p = enrichDefaults(webData, playerName);
      p.source = 'web';
      return p;
    }
  } catch (err) {
    console.warn("ESPN Scrape failed, falling back to local shell:", err);
  }
  
  // 4. Default shell player profile if not found
  const p = enrichDefaults({ name: playerName }, playerName);
  p.source = 'shell';
  return p;
}

/* ─────────────────── Add player ─────────────────── */
async function addPlayer() {
  const input = document.getElementById('player-input');
  const name = input.value.trim();
  if (!name) { showAlert('Enter a player name.'); return; }
  if (squad.length >= 25) { showAlert('Squad is full (max 25 players).'); return; }
  if (squad.find(p => p.name.toLowerCase() === name.toLowerCase())) {
    showAlert('Player already in squad.', 'info'); return;
  }

  // Hide suggestions when adding
  hideSuggestions();

  setSearchSpinner(true);
  try {
    const data = await lookupPlayerClientSide(name);
    squad.push(data);
    input.value = '';
    renderSquad();
    updateCompareSelects();
    saveSquadState();
    
    // Custom success alerts based on data source
    if (data.source === 'web') {
      showAlert(`${data.name} successfully loaded with live stats from Cricinfo!`, 'success');
    } else if (data.source === 'local') {
      showAlert(`${data.name} loaded from curated database!`, 'success');
    } else {
      showAlert(`Could not connect to cricinfo to fetch live stats for "${data.name}". Created a customizable profile for you! Click the player card below to edit stats manually.`, 'info');
    }
    
    // Auto refresh Playing XI if already calculated
    if (lastXI && squad.length >= 11) {
      selectXI();
    }
  } catch(e) {
    showAlert('Error fetching player. Default profile loaded.');
  } finally {
    setSearchSpinner(false);
  }
}

/* ─────────────────── Autocomplete / Suggestions Dropdown ─────────────────── */
const suggestionsBox = document.getElementById('suggestions-box');
const playerInput = document.getElementById('player-input');
let activeSuggestionIndex = -1;

function showSuggestions(val) {
  const query = val.trim().toLowerCase();
  if (!query) {
    hideSuggestions();
    return;
  }

  // Filter curated database for matches
  const matches = [];
  for (const key in PLAYER_DB) {
    if (key.includes(query) || PLAYER_DB[key].name.toLowerCase().includes(query)) {
      matches.push(PLAYER_DB[key]);
    }
  }

  // Build items list
  let html = '';
  matches.forEach((p, idx) => {
    html += `
      <div class="suggestion-item" data-name="${p.name}" data-index="${idx}">
        <span>🔍 ${p.name}</span>
        <span class="role-badge ${roleBadgeClass(p.role)}">${p.role}</span>
      </div>
    `;
  });

  // Always append a "Search web" fallback option at the end
  html += `
    <div class="suggestion-item search-web-item" data-name="${val.trim()}" data-index="${matches.length}">
      <span>🌐 Search cricinfo for "<b>${val.trim()}</b>"</span>
      <span style="font-size:10px; opacity:0.7;">web lookup</span>
    </div>
  `;

  suggestionsBox.innerHTML = html;
  suggestionsBox.style.display = 'block';
  activeSuggestionIndex = -1;

  // Add click listeners to items
  const items = suggestionsBox.querySelectorAll('.suggestion-item');
  items.forEach(item => {
    item.addEventListener('click', () => {
      playerInput.value = item.getAttribute('data-name');
      hideSuggestions();
      addPlayer(); // Automatically execute search on selection!
    });
  });
}

function hideSuggestions() {
  suggestionsBox.style.display = 'none';
  suggestionsBox.innerHTML = '';
  activeSuggestionIndex = -1;
}

// Input event listener for real-time suggestions
playerInput.addEventListener('input', (e) => {
  showSuggestions(e.target.value);
});

// Key navigation for suggestions
playerInput.addEventListener('keydown', (e) => {
  const items = suggestionsBox.querySelectorAll('.suggestion-item');
  if (suggestionsBox.style.display === 'block' && items.length > 0) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeSuggestionIndex = (activeSuggestionIndex + 1) % items.length;
      updateActiveSuggestion(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeSuggestionIndex = (activeSuggestionIndex - 1 + items.length) % items.length;
      updateActiveSuggestion(items);
    } else if (e.key === 'Enter' && activeSuggestionIndex > -1) {
      e.preventDefault();
      items[activeSuggestionIndex].click();
    } else if (e.key === 'Escape') {
      hideSuggestions();
    }
  }
});

// Enter key support for regular searches
playerInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && activeSuggestionIndex === -1) {
    addPlayer();
  }
});

function updateActiveSuggestion(items) {
  items.forEach((item, idx) => {
    item.classList.toggle('active', idx === activeSuggestionIndex);
    if (idx === activeSuggestionIndex) {
      item.scrollIntoView({ block: 'nearest' });
    }
  });
}

// Hide dropdown when clicking outside
document.addEventListener('click', (e) => {
  if (e.target !== playerInput && !suggestionsBox.contains(e.target)) {
    hideSuggestions();
  }
});

/* ─────────────────── Remove player ─────────────────── */
function removePlayer(idx) {
  const removedPlayer = squad[idx].name;
  squad.splice(idx, 1);
  renderSquad();
  updateCompareSelects();
  saveSquadState();
  
  // Reset XI if player removed
  document.getElementById('xi-results').style.display = 'none';
  document.getElementById('xi-empty').style.display = 'block';
  lastXI = null;
  showAlert(`${removedPlayer} removed. Re-select Best XI to update.`, 'info');
}

/* ─────────────────── Render squad list ─────────────────── */
function renderSquad() {
  const list = document.getElementById('squad-list');
  document.getElementById('squad-count').textContent = squad.length;
  document.getElementById('select-btn').disabled = squad.length < 11;

  list.innerHTML = squad.map((p, i) => `
    <div class="squad-item" onclick="openPlayerProfile('${p.name}')">
      <span class="num">${String(i+1).padStart(2,'0')}</span>
      <span class="name">${p.name}</span>
      <span class="role-badge ${roleBadgeClass(p.role)}">${p.role || '?'}</span>
      <button class="btn btn-danger" onclick="event.stopPropagation(); removePlayer(${i})">✕</button>
    </div>
  `).join('');

  if (document.getElementById('tab-rankings').style.display !== 'none') {
    renderRankings();
  }
}

function roleBadgeClass(role) {
  if (!role) return 'badge-unk';
  const r = role.toLowerCase();
  if (r.includes('all')) return 'badge-ar';
  if (r.includes('bowl')) return 'badge-bowl';
  if (r.includes('wick')) return 'badge-wk';
  if (r.includes('bat')) return 'badge-bat';
  return 'badge-unk';
}

/* ─────────────────── Clear squad ─────────────────── */
function clearSquad() {
  if (!confirm('Clear all players?')) return;
  squad = [];
  lastXI = null;
  renderSquad();
  updateCompareSelects();
  saveSquadState();
  document.getElementById('xi-results').style.display = 'none';
  document.getElementById('xi-empty').style.display = 'block';
}

/* ─────────────────── Demo ─────────────────── */
async function loadDemo() {
  if (squad.length > 0 && !confirm('Replace current squad?')) return;
  squad = [];
  setLoading(true, 'Loading sample squad…');
  
  // Direct database lookup for instant loading
  for (const name of DEMO_PLAYERS) {
    try {
      const data = await lookupPlayerClientSide(name);
      squad.push(data);
      renderSquad();
    } catch(e) {}
  }
  setLoading(false);
  updateCompareSelects();
  saveSquadState();
  showAlert(`Loaded ${squad.length} players!`, 'success');
}



/* ─────────────────── Select XI (Invoked from UI Button) ─────────────────── */
function selectXIButton() {
  selectXI();
  switchTab('xi');
}

function selectXI() {
  if (squad.length < 11) { showAlert('Add at least 11 players.'); return; }
  setLoading(true, 'Selecting optimal Playing XI…');
  
  setTimeout(() => {
    try {
      lastXI = calculateBestXI(squad);
      renderXI(lastXI);
    } catch(e) {
      console.error(e);
      showAlert('Error selecting XI. Check your stats entries.');
    } finally {
      setLoading(false);
    }
  }, 400);
}

/* ─────────────────── Render XI ─────────────────── */
function renderXI(data) {
  document.getElementById('xi-empty').style.display = 'none';
  document.getElementById('xi-results').style.display = 'block';

  // Leadership recommendation cards
  document.getElementById('leadership-cards').innerHTML = `
    <div class="leader-card captain">
      <div class="leader-title">Captain</div>
      <div class="leader-name">${data.captain || '—'}</div>
      <div class="leader-meta">Leadership · Consistency · Pressure Handling</div>
    </div>
    <div class="leader-card vc">
      <div class="leader-title">Vice Captain</div>
      <div class="leader-name">${data.vice_captain || '—'}</div>
      <div class="leader-meta">Match Impact · Experience · Form</div>
    </div>
  `;

  // Playing XI display cards
  document.getElementById('xi-grid').innerHTML = data.xi.map(p => {
    const isC  = p.name === data.captain;
    const isVC = p.name === data.vice_captain;
    return `
      <div class="xi-player-card ${isC?'is-captain':''} ${isVC?'is-vc':''}" onclick="openPlayerProfile('${p.name}')" style="cursor: pointer;">
        ${isC  ? '<div class="xi-badge c">CAPTAIN</div>' : ''}
        ${isVC ? '<div class="xi-badge vc">VICE-C</div>' : ''}
        <div class="xi-name">${p.name}</div>
        <div class="xi-role">${p.role || 'Player'}</div>
        <div class="xi-score">${p.overall_score ?? '—'}</div>
        <div class="score-bar"><div class="score-bar-fill" style="width:${p.overall_score ?? 0}%"></div></div>
      </div>
    `;
  }).join('');

  // Selection Analysis Table
  const rows = data.xi.map((p,i) => `
    <tr>
      <td class="rank">${i+1}</td>
      <td class="player-name">${p.name}${p.name===data.captain?' 👑':''}${p.name===data.vice_captain?' ⭐':''}</td>
      <td><span class="role-badge ${roleBadgeClass(p.role)}">${p.role||'?'}</span></td>
      <td>${fmt(p.batting_avg)}</td>
      <td>${fmt(p.strike_rate)}</td>
      <td>${p.total_runs ?? 0}</td>
      <td>${p.wickets ?? 0}</td>
      <td>${fmt(p.economy)}</td>
      <td class="score-cell">${p.overall_score ?? '—'}</td>
    </tr>
  `).join('');

  document.getElementById('xi-table-wrap').innerHTML = `
    <table class="stats-table">
      <thead><tr>
        <th>#</th><th>Player</th><th>Role</th>
        <th data-tip="Batting Average">Bat Avg</th>
        <th data-tip="Strike Rate">SR</th>
        <th>Runs</th><th>Wkts</th>
        <th data-tip="Economy Rate">Econ</th>
        <th data-tip="AI Overall Score (0-100)">Score</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function fmt(v) {
  if (v === undefined || v === null || isNaN(v)) return '—';
  return parseFloat(v).toFixed(1);
}

/* ─────────────────── Rankings tab ─────────────────── */
function renderRankings() {
  const wrap = document.getElementById('rankings-table');
  const empty = document.getElementById('rankings-empty');
  if (squad.length === 0) { empty.style.display='block'; wrap.innerHTML=''; return; }
  empty.style.display = 'none';

  const scored = computeScores(squad);
  const sorted = [...scored].sort((a,b)=>(b.overall_score||0)-(a.overall_score||0));
  const rows = sorted.map((p,i) => `
    <tr>
      <td class="rank">${i+1}</td>
      <td class="player-name">${p.name}</td>
      <td><span class="role-badge ${roleBadgeClass(p.role)}">${p.role||'?'}</span></td>
      <td>${fmt(p.batting_avg)}</td>
      <td>${fmt(p.strike_rate)}</td>
      <td>${p.total_runs??0}</td>
      <td>${p.wickets??0}</td>
      <td>${fmt(p.economy)}</td>
      <td>${fmt(p.bowling_avg)}</td>
      <td class="score-cell">${p.overall_score??'—'}</td>
    </tr>
  `).join('');

  wrap.innerHTML = `
    <table class="stats-table">
      <thead><tr>
        <th>Rank</th><th>Player</th><th>Role</th>
        <th>Bat Avg</th><th>SR</th><th>Runs</th>
        <th>Wkts</th><th>Econ</th><th>Bowl Avg</th>
        <th>AI Score</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

/* ─────────────────── Compare tab ─────────────────── */
function updateCompareSelects() {
  ['compare-a','compare-b'].forEach(id => {
    const sel = document.getElementById(id);
    const cur = sel.value;
    sel.innerHTML = `<option value="">— Select Player —</option>` +
      squad.map(p=>`<option value="${p.name}" ${p.name===cur?'selected':''}>${p.name}</option>`).join('');
  });
  renderCompare();
}

document.addEventListener('change', e => {
  if (e.target.id === 'compare-a' || e.target.id === 'compare-b') renderCompare();
});

let compareChartInstance = null;

function renderCompare() {
  const aName = document.getElementById('compare-a').value;
  const bName = document.getElementById('compare-b').value;
  const empty  = document.getElementById('compare-empty');
  const result = document.getElementById('compare-result');

  if (!aName || !bName || aName === bName) {
    empty.style.display = 'block'; result.innerHTML = ''; return;
  }
  empty.style.display = 'none';

  const scored = computeScores(squad);
  const a = scored.find(p=>p.name===aName);
  const b = scored.find(p=>p.name===bName);
  if (!a || !b) return;

  const stats = [
    {label:'AI Score', key:'overall_score', higher:true},
    {label:'Bat Avg',  key:'batting_avg',   higher:true},
    {label:'Strike Rate', key:'strike_rate', higher:true},
    {label:'Total Runs',  key:'total_runs',  higher:true},
    {label:'Wickets',     key:'wickets',     higher:true},
    {label:'Economy',     key:'economy',     higher:false},
    {label:'Bowl Avg',    key:'bowling_avg', higher:false},
    {label:'Leadership',  key:'leadership_rating', higher:true},
  ];

  const rows = stats.map(s => {
    const va = parseFloat(a[s.key]||0);
    const vb = parseFloat(b[s.key]||0);
    const aWins = s.higher ? va > vb : va < vb;
    const bWins = s.higher ? vb > va : vb < va;
    const max = Math.max(va, vb, 1);
    return `
      <tr>
        <td style="text-align:right;width:28%">
          <span style="font-weight:${aWins?700:400};color:${aWins?'var(--accent)':'var(--text2)'}">${va.toFixed(1)}</span>
          <div class="score-bar" style="margin-top:4px">
            <div class="score-bar-fill" style="width:${(va/max*100).toFixed(0)}%;background:${aWins?'var(--accent)':'var(--text3)'}"></div>
          </div>
        </td>
        <td style="text-align:center;font-size:10px;color:var(--text3);width:44%">${s.label}</td>
        <td style="width:28%">
          <span style="font-weight:${bWins?700:400};color:${bWins?'var(--accent)':'var(--text2)'}">${vb.toFixed(1)}</span>
          <div class="score-bar" style="margin-top:4px">
            <div class="score-bar-fill" style="width:${(vb/max*100).toFixed(0)}%;background:${bWins?'var(--accent)':'var(--text3)'}"></div>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  const aScore = stats.filter(s => {
    const va=parseFloat(a[s.key]||0), vb=parseFloat(b[s.key]||0);
    return s.higher ? va>vb : va<vb;
  }).length;
  const bScore = stats.length - aScore;

  result.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <div style="font-weight:700;font-size:15px">${a.name}<br><small style="color:var(--text3);font-weight:400">${a.role||'?'}</small></div>
      <div style="text-align:center">
        <div style="font-family:'JetBrains Mono';font-size:22px;color:var(--accent)">${aScore} – ${bScore}</div>
        <div style="font-size:10px;color:var(--text3);margin-top:2px">categories won</div>
      </div>
      <div style="text-align:right;font-weight:700;font-size:15px">${b.name}<br><small style="color:var(--text3);font-weight:400">${b.role||'?'}</small></div>
    </div>
    
    <div class="chart-wrap" style="width:100%;max-width:380px;margin:10px auto 20px auto">
      <canvas id="compare-radar-chart"></canvas>
    </div>
    
    <table class="stats-table" style="table-layout:fixed">${rows}</table>
  `;

  drawRadarChart(a, b);
}

function drawRadarChart(playerA, playerB) {
  const ctx = document.getElementById('compare-radar-chart').getContext('2d');
  
  const categories = ["Batting", "Bowling", "Fielding", "Fitness", "Form"];
  const datasetA = [
    playerA.batting_score || 0,
    playerA.bowling_score || 0,
    playerA.fielding_score || 0,
    playerA.fitness_score || 0,
    playerA.form_score || 0
  ];
  const datasetB = [
    playerB.batting_score || 0,
    playerB.bowling_score || 0,
    playerB.fielding_score || 0,
    playerB.fitness_score || 0,
    playerB.form_score || 0
  ];

  if (compareChartInstance) {
    compareChartInstance.destroy();
  }

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const gridColor = isDark ? '#1e2d42' : '#d0dce8';
  const labelColor = isDark ? '#8899aa' : '#4a6278';
  const angleLineColor = isDark ? '#1e2d42' : '#d0dce8';

  compareChartInstance = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: categories,
      datasets: [
        {
          label: playerA.name,
          data: datasetA,
          backgroundColor: 'rgba(0, 200, 83, 0.15)',
          borderColor: '#00c853',
          borderWidth: 2,
          pointBackgroundColor: '#00c853',
          pointHoverBorderColor: '#fff',
        },
        {
          label: playerB.name,
          data: datasetB,
          backgroundColor: 'rgba(33, 150, 243, 0.15)',
          borderColor: '#2196f3',
          borderWidth: 2,
          pointBackgroundColor: '#2196f3',
          pointHoverBorderColor: '#fff',
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          labels: {
            color: labelColor,
            font: { family: 'Inter', size: 12 }
          }
        }
      },
      scales: {
        r: {
          angleLines: { color: angleLineColor },
          grid: { color: gridColor },
          pointLabels: {
            color: labelColor,
            font: { family: 'Inter', size: 11, weight: '600' }
          },
          ticks: {
            backdropColor: 'transparent',
            color: labelColor,
            showLabelBackdrop: false,
            stepSize: 20
          },
          min: 0,
          max: 100
        }
      }
    }
  });
}

/* ─────────────────── Tabs ─────────────────── */
function switchTab(name) {
  ['xi','rankings','compare'].forEach(t => {
    document.getElementById(`tab-${t}`).style.display = t===name ? 'block' : 'none';
  });
  document.querySelectorAll('.tab').forEach((el,i) => {
    el.classList.toggle('active', ['xi','rankings','compare'][i]===name);
  });
  if (name === 'rankings') renderRankings();
  if (name === 'compare')  updateCompareSelects();
}

/* ─────────────────── Expose globals for inline onclick handlers ─────────────────── */
// ES modules are scoped — functions need to be on `window` to work in HTML onclick="..."
Object.assign(window, {
  toggleTheme,
  addPlayer,
  clearSquad,
  loadDemo,
  selectXIButton,
  switchTab,
  removePlayer,
  openPlayerProfile,
  closeProfileModal,
  closeProfileModalDirect,
});

/* ─────────────────── Player Images & Profile Modal Logic ─────────────────── */
const PLAYER_IMAGES = {
  "virat kohli": "https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_320,q_50/lsci/db/PICTURES/CMS/316600/316629.png",
  "rohit sharma": "https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_320,q_50/lsci/db/PICTURES/CMS/384100/384131.png",
  "ms dhoni": "https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_320,q_50/lsci/db/PICTURES/CMS/384100/384144.png",
  "steve smith": "https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_320,q_50/lsci/db/PICTURES/CMS/384200/384284.png",
  "kane williamson": "https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_320,q_50/lsci/db/PICTURES/CMS/384300/384351.png",
  "babar azam": "https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_320,q_50/lsci/db/PICTURES/CMS/384300/384393.png",
  "ab de villiers": "https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_320,q_50/lsci/db/PICTURES/CMS/384300/384308.png",
  "sachin tendulkar": "https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_320,q_50/lsci/db/PICTURES/CMS/384100/384120.png",
  "jasprit bumrah": "https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_320,q_50/lsci/db/PICTURES/CMS/384100/384134.png",
  "pat cummins": "https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_320,q_50/lsci/db/PICTURES/CMS/384200/384287.png",
  "mitchell starc": "https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_320,q_50/lsci/db/PICTURES/CMS/384200/384293.png",
  "ben stokes": "https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_320,q_50/lsci/db/PICTURES/CMS/384300/384323.png",
  "jos buttler": "https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_320,q_50/lsci/db/PICTURES/CMS/384300/384324.png",
  "glenn maxwell": "https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_320,q_50/lsci/db/PICTURES/CMS/384200/384288.png",
  "shakib al hasan": "https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_320,q_50/lsci/db/PICTURES/CMS/384300/384365.png",
  "rashid khan": "https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_320,q_50/lsci/db/PICTURES/CMS/384300/384379.png",
  "ravindra jadeja": "https://img1.hscicdn.com/image/upload/f_auto,t_ds_square_w_320,q_50/lsci/db/PICTURES/CMS/384100/384140.png"
};

function getRoleSvg(role) {
  const r = (role || "").toLowerCase();
  if (r.includes('wick')) {
    // Wicketkeeper stumps/gloves icon
    return `<svg viewBox="0 0 64 64" width="48" height="48" fill="currentColor"><rect x="18" y="8" width="4" height="48" rx="2"/><rect x="30" y="8" width="4" height="48" rx="2"/><rect x="42" y="8" width="4" height="48" rx="2"/><rect x="14" y="8" width="36" height="4" rx="2"/></svg>`;
  }
  if (r.includes('bowl')) {
    // Cricket ball icon
    return `<svg viewBox="0 0 64 64" width="48" height="48" fill="none" stroke="currentColor" stroke-width="3"><circle cx="32" cy="32" r="24"/><path d="M16 32 C 24 16, 40 16, 48 32 C 40 48, 24 48, 16 32"/></svg>`;
  }
  if (r.includes('all')) {
    // Crossed bat and ball
    return `<svg viewBox="0 0 64 64" width="48" height="48" fill="currentColor"><path d="M12 48 L48 12 A 4 4 0 0 1 54 18 L18 54 A 4 4 0 0 1 12 48 Z" /><circle cx="48" cy="48" r="8" /></svg>`;
  }
  // Batsman bat icon
  return `<svg viewBox="0 0 64 64" width="48" height="48" fill="none" stroke="currentColor" stroke-width="3"><path d="M44 8 L56 20 L24 52 L12 40 Z M12 40 L6 46 A 2 2 0 0 0 8 50 L14 44 Z"/></svg>`;
}

function openPlayerProfile(playerName) {
  const p = squad.find(player => player.name.toLowerCase() === playerName.toLowerCase());
  if (!p) return;

  document.getElementById('profile-modal-name').textContent = p.name;
  document.getElementById('profile-modal-role').textContent = p.role;
  document.getElementById('profile-modal-role').className = `role-badge ${roleBadgeClass(p.role)}`;
  document.getElementById('profile-modal-meta').textContent = `Matches: ${p.matches || p.batting_matches || 0} · Source: ${p.source === 'local' ? 'Database' : p.source === 'web' ? 'Live Cricinfo' : 'Manual'}`;

  document.getElementById('profile-stat-bat-avg').textContent = fmt(p.batting_avg);
  document.getElementById('profile-stat-sr').textContent = fmt(p.strike_rate);
  document.getElementById('profile-stat-runs').textContent = p.total_runs || 0;
  document.getElementById('profile-stat-wickets').textContent = p.wickets || 0;
  document.getElementById('profile-stat-econ').textContent = fmt(p.economy);
  document.getElementById('profile-stat-catches').textContent = p.catches || 0;

  // Progress bars
  document.getElementById('profile-metric-fitness').textContent = `${p.fitness || 85}%`;
  document.getElementById('profile-bar-fitness').style.width = `${p.fitness || 85}%`;
  document.getElementById('profile-metric-form').textContent = `${p.recent_form || 70}%`;
  document.getElementById('profile-bar-form').style.width = `${p.recent_form || 70}%`;
  document.getElementById('profile-metric-leadership').textContent = `${p.leadership_rating || 50}%`;
  document.getElementById('profile-bar-leadership').style.width = `${p.leadership_rating || 50}%`;

  // Image handling
  const imgEl = document.getElementById('profile-img');
  const fallbackEl = document.getElementById('profile-img-fallback');
  const key = p.name.toLowerCase().trim();

  if (PLAYER_IMAGES[key]) {
    imgEl.src = PLAYER_IMAGES[key];
    imgEl.style.display = 'block';
    fallbackEl.style.display = 'none';
  } else {
    imgEl.style.display = 'none';
    fallbackEl.innerHTML = getRoleSvg(p.role);
    fallbackEl.style.display = 'flex';
  }

  document.getElementById('profile-modal').classList.add('open');
}

function closeProfileModal(event) {
  if (event.target === document.getElementById('profile-modal')) {
    closeProfileModalDirect();
  }
}

function closeProfileModalDirect() {
  document.getElementById('profile-modal').classList.remove('open');
}

/* ─────────────────── LocalStorage Persistence Helpers ─────────────────── */
function saveSquadState() {
  localStorage.setItem('crickselect_squad', JSON.stringify(squad));
}

// Auto-run on load to restore saved state and initialize custom cursor
window.addEventListener('DOMContentLoaded', () => {
  const saved = localStorage.getItem('crickselect_squad');
  if (saved) {
    try {
      squad = JSON.parse(saved);
      renderSquad();
      updateCompareSelects();
      if (squad.length >= 11) {
        selectXI();
      }
    } catch(e) {
      console.warn("Error restoring squad from localStorage:", e);
      squad = [];
    }
  }

  // Initialize the premium custom cursor follower
  initCustomCursor();
});

/* ─────────────────── Custom Cursor Follower ─────────────────── */
function initCustomCursor() {
  // Only enable on desktop screens (larger than 768px)
  if (window.innerWidth <= 768) return;

  const dot = document.createElement('div');
  dot.className = 'custom-cursor-dot';
  const outline = document.createElement('div');
  outline.className = 'custom-cursor-outline';
  
  document.body.appendChild(dot);
  document.body.appendChild(outline);
  
  document.documentElement.classList.add('custom-cursor-active');

  let mouseX = 0;
  let mouseY = 0;
  let outlineX = 0;
  let outlineY = 0;
  let isMoving = false;

  // Track position
  window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    
    // Set dot position immediately
    dot.style.left = `${mouseX}px`;
    dot.style.top = `${mouseY}px`;
    
    // Make cursor visible on first move
    if (!isMoving) {
      dot.style.opacity = '1';
      outline.style.opacity = '1';
      isMoving = true;
    }
  });

  // Smooth lagging animation using lerp (Linear Interpolation)
  function animateOutline() {
    outlineX += (mouseX - outlineX) * 0.15;
    outlineY += (mouseY - outlineY) * 0.15;
    
    outline.style.left = `${outlineX}px`;
    outline.style.top = `${outlineY}px`;
    
    requestAnimationFrame(animateOutline);
  }
  requestAnimationFrame(animateOutline);

  // Hide cursor when leaving window
  document.addEventListener('mouseleave', () => {
    dot.style.opacity = '0';
    outline.style.opacity = '0';
    isMoving = false;
  });

  // Add reactive hover states using event delegation
  document.addEventListener('mouseover', (e) => {
    const target = e.target;
    if (!target) return;

    // Check if target or parent is interactive
    const isInteractive = target.closest('button, input, select, .squad-item, .tab, .theme-toggle, .close-drawer, [onclick]');
    const isDanger = target.closest('.btn-danger, .close-drawer');
    const isGold = target.closest('.is-captain, .captain');

    if (isInteractive) {
      dot.classList.add('hovered');
      outline.classList.add('hovered');
      
      if (isDanger) {
        dot.classList.add('danger-hovered');
        outline.classList.add('danger-hovered');
      } else if (isGold) {
        dot.classList.add('gold-hovered');
        outline.classList.add('gold-hovered');
      }
    }
  });

  document.addEventListener('mouseout', (e) => {
    dot.className = 'custom-cursor-dot';
    outline.className = 'custom-cursor-outline';
  });
}


