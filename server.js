const http = require("http");
const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const PORT = Number(process.env.PORT || 5174);
const HOST = process.env.HOST || "127.0.0.1";
const POLL_MINUTES = Number(process.env.POLL_MINUTES || 0.5);
const CACHE_DIR = path.join(__dirname, ".cache");
const SCOREBOARD_DIR = path.join(CACHE_DIR, "scoreboard");
const SQUAD_DIR = path.join(CACHE_DIR, "squads");
const PLAYER_DIR = path.join(CACHE_DIR, "players");
const TRANSLATION_CACHE = path.join(CACHE_DIR, "player-name-translations.json");
const TEAM_CACHE = path.join(CACHE_DIR, "teams.json");
const MODEL_CONFIG = path.join(__dirname, "model-config.json");
const MODEL_CONFIG_EXAMPLE = path.join(__dirname, "model-config.example.json");
const SOURCE_REGISTRY = path.join(__dirname, "source-registry.json");
const DB_FILE = path.join(__dirname, "football-agent.db");
const PREMATCH_SKILL = path.join(__dirname, "agent-skills", "prematch-analysis.md");
const LEARNING_SKILL = path.join(__dirname, "agent-skills", "learning-failures.md");
const PREDICTION_CACHE = path.join(CACHE_DIR, "predictions.json");
const SQUAD_TTL_MS = Number(process.env.SQUAD_TTL_HOURS || 12) * 60 * 60 * 1000;
const PLAYER_TTL_MS = Number(process.env.PLAYER_TTL_HOURS || 48) * 60 * 60 * 1000;
const STATIC_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8"
};

const TEAM_NAME_ZH = {
  Algeria: "阿尔及利亚",
  Argentina: "阿根廷",
  Australia: "澳大利亚",
  Austria: "奥地利",
  Belgium: "比利时",
  Brazil: "巴西",
  Canada: "加拿大",
  "Cape Verde": "佛得角",
  Chile: "智利",
  Colombia: "哥伦比亚",
  "Congo DR": "刚果（金）",
  Croatia: "克罗地亚",
  Denmark: "丹麦",
  Ecuador: "厄瓜多尔",
  Egypt: "埃及",
  England: "英格兰",
  France: "法国",
  Germany: "德国",
  Ghana: "加纳",
  Iran: "伊朗",
  Iraq: "伊拉克",
  Italy: "意大利",
  Japan: "日本",
  Jordan: "约旦",
  Mexico: "墨西哥",
  Morocco: "摩洛哥",
  Netherlands: "荷兰",
  "New Zealand": "新西兰",
  Norway: "挪威",
  Panama: "巴拿马",
  Portugal: "葡萄牙",
  Senegal: "塞内加尔",
  Serbia: "塞尔维亚",
  Spain: "西班牙",
  Switzerland: "瑞士",
  Tunisia: "突尼斯",
  "United States": "美国",
  Uruguay: "乌拉圭",
  Uzbekistan: "乌兹别克斯坦"
};

function ensureDirs() {
  fs.mkdirSync(SCOREBOARD_DIR, { recursive: true });
  fs.mkdirSync(SQUAD_DIR, { recursive: true });
  fs.mkdirSync(PLAYER_DIR, { recursive: true });
}

let db;

function database() {
  if (db) return db;
  db = new DatabaseSync(DB_FILE);
  db.exec(`
    CREATE TABLE IF NOT EXISTS model_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      provider TEXT,
      api_url TEXT,
      model TEXT,
      temperature REAL,
      output_language TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS teams (
      team TEXT PRIMARY KEY,
      payload_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS predictions (
      prediction_key TEXT PRIMARY KEY,
      match_id TEXT,
      match_date TEXT,
      home TEXT,
      away TEXT,
      model_name TEXT,
      summary_json TEXT,
      raw_json TEXT NOT NULL,
      generated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sync_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT NOT NULL,
      status TEXT NOT NULL,
      message TEXT,
      created_at TEXT NOT NULL
    );
  `);
  return db;
}

function writeSyncLog(source, status, message = "") {
  database().prepare(`
    INSERT INTO sync_log (source, status, message, created_at)
    VALUES (?, ?, ?, ?)
  `).run(source, status, message, new Date().toISOString());
}

function redactModel(model = {}) {
  return {
    provider: model.provider || "openai-compatible",
    apiUrl: model.apiUrl || "",
    apiKey: "",
    model: model.model || "",
    temperature: Number(model.temperature ?? 0.2),
    outputLanguage: model.outputLanguage || "zh-CN",
    profileName: model.profileName || ""
  };
}

function upsertModelProfile(profile) {
  const safeModel = redactModel(profile.model || profile);
  const name = profile.name || safeModel.profileName || safeModel.model || "未命名模型";
  const now = new Date().toISOString();
  const existing = database().prepare("SELECT id FROM model_profiles WHERE name = ?").get(name);
  if (existing) {
    database().prepare(`
      UPDATE model_profiles
      SET provider = ?, api_url = ?, model = ?, temperature = ?, output_language = ?, updated_at = ?
      WHERE name = ?
    `).run(safeModel.provider, safeModel.apiUrl, safeModel.model, safeModel.temperature, safeModel.outputLanguage, now, name);
  } else {
    database().prepare(`
      INSERT INTO model_profiles (name, provider, api_url, model, temperature, output_language, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name, safeModel.provider, safeModel.apiUrl, safeModel.model, safeModel.temperature, safeModel.outputLanguage, now, now);
  }
}

function syncModelProfilesToDb(config = readModelConfig()) {
  (config.profiles || []).forEach(upsertModelProfile);
  if (config.model?.model || config.model?.apiUrl) {
    upsertModelProfile({ name: config.model.profileName || config.model.model || "当前模型", model: config.model });
  }
}

function upsertTeamRecord(team, payload) {
  database().prepare(`
    INSERT INTO teams (team, payload_json, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(team) DO UPDATE SET payload_json = excluded.payload_json, updated_at = excluded.updated_at
  `).run(team, JSON.stringify(payload), new Date().toISOString());
}

function matchKeyForPrediction(match) {
  const teams = [match?.home, match?.away].map((team) => String(team || "").trim()).sort((a, b) => a.localeCompare(b, "zh-CN"));
  return `${match?.date || ""}|${teams[0] || ""}|${teams[1] || ""}`;
}

function extractAssistantText(payload) {
  return payload?.choices?.[0]?.message?.content
    || payload?.choices?.[0]?.text
    || payload?.output_text
    || "";
}

function parseJsonObject(text) {
  const raw = String(text || "").trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function summarizePredictionResult(result) {
  const text = extractAssistantText(result);
  return parseJsonObject(text) || {
    rawText: text || JSON.stringify(result)
  };
}

function upsertPrediction(match, result, modelName) {
  const summary = summarizePredictionResult(result);
  const keys = [...new Set([match?.id, matchKeyForPrediction(match)].filter(Boolean))];
  const now = new Date().toISOString();
  const stmt = database().prepare(`
    INSERT INTO predictions (prediction_key, match_id, match_date, home, away, model_name, summary_json, raw_json, generated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(prediction_key) DO UPDATE SET
      match_id = excluded.match_id,
      match_date = excluded.match_date,
      home = excluded.home,
      away = excluded.away,
      model_name = excluded.model_name,
      summary_json = excluded.summary_json,
      raw_json = excluded.raw_json,
      generated_at = excluded.generated_at
  `);
  keys.forEach((key) => stmt.run(
    key,
    match?.id || "",
    match?.date || "",
    match?.home || "",
    match?.away || "",
    modelName || "",
    JSON.stringify(summary),
    JSON.stringify(result),
    now
  ));
  return summary;
}

function jsonResponse(res, status, data) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(JSON.stringify(data, null, 2));
}

function safeStaticPath(urlPath) {
  const cleanPath = decodeURIComponent(urlPath.split("?")[0]);
  const target = cleanPath === "/" ? "index.html" : cleanPath.replace(/^\/+/, "");
  const absolute = path.resolve(__dirname, target);
  if (!absolute.startsWith(__dirname)) return null;
  return absolute;
}

function formatDateKey(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function addDays(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function dateRangeKeys(start, end) {
  const keys = [];
  const cursor = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (cursor <= last) {
    keys.push(formatDateKey(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return keys;
}

function currentBeijingDate() {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function beijingDateFromIso(isoDateTime) {
  if (!isoDateTime) return "";
  return new Date(new Date(isoDateTime).getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function beijingTimeFromIso(isoDateTime) {
  if (!isoDateTime) return "时间待确认";
  const shifted = new Date(new Date(isoDateTime).getTime() + 8 * 60 * 60 * 1000);
  const hours = String(shifted.getUTCHours()).padStart(2, "0");
  const minutes = String(shifted.getUTCMinutes()).padStart(2, "0");
  return `${shifted.toISOString().slice(0, 10)} ${hours}:${minutes} 北京时间`;
}

function scoreboardUrl(dateKey) {
  if (!/^\d{8}$/.test(dateKey)) throw new Error("Invalid date key");
  return `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=${dateKey}`;
}

function cachePath(dateKey) {
  return path.join(SCOREBOARD_DIR, `${dateKey}.json`);
}

async function fetchScoreboard(dateKey) {
  const url = scoreboardUrl(dateKey);
  const response = await fetch(url, {
    headers: { "user-agent": "football-analysis-agent/0.1" }
  });
  if (!response.ok) throw new Error(`ESPN ${dateKey} HTTP ${response.status}`);
  const payload = await response.json();
  fs.writeFileSync(cachePath(dateKey), JSON.stringify({
    fetchedAt: new Date().toISOString(),
    source: url,
    payload
  }, null, 2));
  updateTeamCache(payload);
  return payload;
}

function readCachedScoreboard(dateKey) {
  const file = cachePath(dateKey);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8")).payload;
}

function zhName(name) {
  return TEAM_NAME_ZH[name] || name || "待确认";
}

function squadLink(team) {
  return team?.links?.find((link) => link.rel?.includes("squad"))?.href || "";
}

function readSourceRegistry() {
  if (!fs.existsSync(SOURCE_REGISTRY)) {
    return { version: 0, stableEntrances: [], searchTemplates: [], officialFaDomains: {} };
  }
  return JSON.parse(fs.readFileSync(SOURCE_REGISTRY, "utf8"));
}

function normalizeTeamName(name) {
  return String(name || "")
    .trim()
    .replace(/^Türkiye$/i, "土耳其")
    .replace(/^Turkey$/i, "土耳其")
    .replace(/^Uruguay$/i, "乌拉圭")
    .toLowerCase();
}

function renderSourceQuery(template, values) {
  return template
    .replaceAll("{teamA}", values.teamA)
    .replaceAll("{teamB}", values.teamB)
    .replaceAll("{team}", values.team)
    .replaceAll("{officialFaDomain}", values.officialFaDomain || "官方足协域名");
}

async function sourceCheckForMatch(matchLike) {
  const registry = readSourceRegistry();
  const teamA = matchLike?.home || matchLike?.teamA || matchLike?.homeTeam || "";
  const teamB = matchLike?.away || matchLike?.teamB || matchLike?.awayTeam || "";
  const aliases = registry.teamSearchAliases || {};
  const teamAForGlobalSearch = aliases[teamA]?.international || teamA;
  const teamBForGlobalSearch = aliases[teamB]?.international || teamB;
  const start = matchLike?.start || "2026-06-11";
  const end = matchLike?.end || "2026-07-19";
  const matches = await getMatchesForBeijingRange(start, end);
  const wanted = [normalizeTeamName(teamA), normalizeTeamName(teamB)].sort().join("|");
  const fixture = matches.find((match) => (
    [normalizeTeamName(match.home), normalizeTeamName(match.away)].sort().join("|") === wanted
  )) || null;
  const officialFaDomains = registry.officialFaDomains || {};
  const teams = [teamA, teamB].filter(Boolean);
  const searchQueries = [];

  for (const template of registry.searchTemplates || []) {
    if (template.query.includes("{teamA}") || template.query.includes("{teamB}")) {
      searchQueries.push({
        id: template.id,
        name: template.name,
        tier: template.tier,
        query: renderSourceQuery(template.query, { teamA: teamAForGlobalSearch, teamB: teamBForGlobalSearch, team: teamAForGlobalSearch })
      });
      continue;
    }
    for (const team of teams) {
      const alias = aliases[team] || {};
      const queryTeam = template.id.includes("fa-domain") || template.id.includes("injury") || template.id.includes("press")
        ? (alias.international || team)
        : (alias.international || team);
      searchQueries.push({
        id: `${template.id}-${team}`,
        name: `${template.name}：${team}`,
        tier: template.tier,
        query: renderSourceQuery(template.query, {
          teamA,
          teamB,
          team: queryTeam,
          officialFaDomain: officialFaDomains[team] || officialFaDomains[teamA] || officialFaDomains[teamB] || ""
        })
      });
    }
  }

  return {
    checkedAt: new Date().toISOString(),
    requestedMatch: { teamA, teamB, start, end },
    fixtureConfirmed: Boolean(fixture),
    fixture,
    gate: fixture ? "可继续补充信息源" : "赛程真实性未确认，不能进入预测，只能做资料准备",
    stableEntrances: registry.stableEntrances || [],
    searchQueries,
    sourceTiers: registry.sourceTiers || []
  };
}

function eventToMatch(event) {
  const competition = event.competitions?.[0] || {};
  const competitors = competition.competitors || [];
  const home = competitors.find((item) => item.homeAway === "home") || competitors[0];
  const away = competitors.find((item) => item.homeAway === "away") || competitors[1];
  const status = competition.status?.type || event.status?.type || {};
  const completed = Boolean(status.completed);
  const homeName = zhName(home?.team?.displayName);
  const awayName = zhName(away?.team?.displayName);
  return {
    id: `espn-${event.id}`,
    espnId: event.id,
    status: completed ? "review" : "synced",
    date: beijingDateFromIso(event.date),
    utcDate: event.date?.slice(0, 10) || "",
    kickoffTime: beijingTimeFromIso(event.date),
    group: competition.altGameNote?.replace("FIFA World Cup, ", "") || "世界杯",
    venue: competition.venue?.fullName || competition.venue?.displayName || "待确认球场",
    home: homeName,
    away: awayName,
    score: completed ? `${home?.score ?? 0}-${away?.score ?? 0}` : "未赛",
    headline: completed ? "已赛比赛，进入复盘样本池。" : "已同步赛程，等待分析。",
    recommendation: completed ? "赛后复盘" : "待预测"
  };
}

function matchIdentity(match) {
  const teams = [match.home, match.away].map((team) => String(team || "").trim()).sort((a, b) => a.localeCompare(b, "zh-CN"));
  return `${match.date}|${teams[0]}|${teams[1]}`;
}

async function getMatchesForBeijingRange(start, end) {
  const keys = dateRangeKeys(addDays(start, -1), addDays(end, 1));
  const payloads = await Promise.all(keys.map(async (key) => {
    const cached = getScoreboardCachedFirst(key);
    if (cached) return cached;
    try {
      return await getScoreboard(key);
    } catch {
      return readCachedScoreboard(key) || { events: [] };
    }
  }));
  const seenEvents = new Set();
  const byMatch = new Map();
  payloads.flatMap((payload) => payload.events || []).forEach((event) => {
    if (!event?.id || seenEvents.has(event.id)) return;
    seenEvents.add(event.id);
    const match = eventToMatch(event);
    if (match.date < start || match.date > end) return;
    byMatch.set(matchIdentity(match), match);
  });
  return [...byMatch.values()].sort((a, b) => a.date.localeCompare(b.date) || a.kickoffTime.localeCompare(b.kickoffTime));
}

function squadCachePath(teamName) {
  const safeName = encodeURIComponent(teamName).replace(/%/g, "_");
  return path.join(SQUAD_DIR, `${safeName}.json`);
}

function playerCachePath(playerHref) {
  const safeName = encodeURIComponent(playerHref).replace(/%/g, "_");
  return path.join(PLAYER_DIR, `${safeName}.json`);
}

function isFresh(file, ttlMs) {
  if (!fs.existsSync(file)) return false;
  return Date.now() - fs.statSync(file).mtimeMs < ttlMs;
}

function isAllowedSquadUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return url.hostname === "www.espn.com" && url.pathname.startsWith("/soccer/team/squad/");
  } catch {
    return false;
  }
}

function isAllowedPlayerUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return url.hostname === "www.espn.com" && url.pathname.startsWith("/soccer/player/");
  } catch {
    return false;
  }
}

function decodeHtml(value = "") {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(Number.parseInt(num, 10)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function stripTags(value = "") {
  return decodeHtml(value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " "));
}

const POSITION_ZH = {
  G: "门将",
  GK: "门将",
  D: "后卫",
  DF: "后卫",
  M: "中场",
  MF: "中场",
  F: "前锋",
  FW: "前锋",
  Goalkeeper: "门将",
  Defender: "后卫",
  Midfielder: "中场",
  Forward: "前锋"
};

const COUNTRY_ZH = {
  Portugal: "葡萄牙",
  Spain: "西班牙",
  France: "法国",
  England: "英格兰",
  Germany: "德国",
  Italy: "意大利",
  Netherlands: "荷兰",
  Japan: "日本",
  Norway: "挪威",
  Iraq: "伊拉克",
  Ghana: "加纳",
  Panama: "巴拿马",
  Croatia: "克罗地亚",
  Colombia: "哥伦比亚",
  Uzbekistan: "乌兹别克斯坦",
  "Cape Verde": "佛得角",
  "Congo DR": "刚果（金）"
};

const CLUB_ZH = {
  "Al Nassr": "利雅得胜利",
  "Manchester City": "曼城",
  "Manchester United": "曼联",
  Liverpool: "利物浦",
  Arsenal: "阿森纳",
  Chelsea: "切尔西",
  Tottenham: "托特纳姆热刺",
  "Paris Saint-Germain": "巴黎圣日耳曼",
  "Real Madrid": "皇家马德里",
  Barcelona: "巴塞罗那",
  "Atletico Madrid": "马德里竞技",
  Bayern: "拜仁慕尼黑",
  "Bayern Munich": "拜仁慕尼黑",
  Benfica: "本菲卡",
  "FC Porto": "波尔图",
  Porto: "波尔图",
  "Sporting CP": "葡萄牙体育",
  "AC Milan": "AC米兰",
  Internazionale: "国际米兰",
  Juventus: "尤文图斯",
  Wolves: "狼队",
  "Wolverhampton Wanderers": "狼队",
  "Nottingham Forest": "诺丁汉森林",
  "Al Hilal": "利雅得新月",
  "Al Ittihad": "吉达联合",
  "Al Ahli": "吉达国民",
  Fenerbahce: "费内巴切",
  Villarreal: "比利亚雷亚尔",
  Mallorca: "马略卡",
  "Real Sociedad": "皇家社会"
};

const PLAYER_NAME_ZH = {
  "Unai Simón": "乌奈·西蒙",
  "David Raya": "大卫·拉亚",
  "Álex Remiro": "亚历克斯·雷米罗",
  "Joan García": "霍安·加西亚",
  "Dani Carvajal": "达尼·卡瓦哈尔",
  "Pedro Porro": "佩德罗·波罗",
  "Marc Pubill": "马克·普比尔",
  "Aymeric Laporte": "埃梅里克·拉波尔特",
  "Eric García": "埃里克·加西亚",
  "Robin Le Normand": "罗宾·勒诺尔芒",
  "Nacho": "纳乔",
  "Pau Cubarsí": "保·库巴西",
  "Alejandro Grimaldo": "亚历杭德罗·格里马尔多",
  "Marc Cucurella": "马克·库库雷利亚",
  "Rodri": "罗德里",
  "Martín Zubimendi": "马丁·苏维门迪",
  "Fabián Ruiz": "法比安·鲁伊斯",
  "Pedri": "佩德里",
  "Mikel Merino": "米克尔·梅里诺",
  "Marcos Llorente": "马科斯·略伦特",
  "Gavi": "加维",
  "Álex Baena": "亚历克斯·巴埃纳",
  "Dani Olmo": "达尼·奥尔莫",
  "Lamine Yamal": "拉明·亚马尔",
  "Nico Williams": "尼科·威廉姆斯",
  "Ferran Torres": "费兰·托雷斯",
  "Álvaro Morata": "阿尔瓦罗·莫拉塔",
  "Mikel Oyarzabal": "米克尔·奥亚萨瓦尔",
  "Joselu": "何塞卢",
  "Ansu Fati": "安苏·法蒂",
  "Yeremy Pino": "耶雷米·皮诺",
  "Yéremy Pino": "耶雷米·皮诺",
  "Víctor Muñoz": "维克托·穆尼奥斯",
  "Borja Iglesias": "博尔哈·伊格莱西亚斯",
  "Bryan Zaragoza": "布莱恩·萨拉戈萨",
  "Vozinha": "沃齐尼亚",
  "Bruno Varela": "布鲁诺·瓦雷拉",
  "Dylan Silva": "迪伦·席尔瓦",
  "Logan Costa": "洛根·科斯塔",
  "Roberto Lopes": "罗伯托·洛佩斯",
  "Steven Moreira": "史蒂文·莫雷拉",
  "Diney": "迪内",
  "João Paulo Fernandes": "若昂·保罗·费尔南德斯",
  "Patrick Andrade": "帕特里克·安德拉德",
  "Jamiro Monteiro": "贾米罗·蒙泰罗",
  "Kevin Pina": "凯文·皮纳",
  "Deroy Duarte": "德罗伊·杜阿尔特",
  "Bebé": "贝贝",
  "Ryan Mendes": "瑞安·门德斯",
  "Garry Rodrigues": "加里·罗德里格斯",
  "Jovane Cabral": "若瓦内·卡布拉尔",
  "Dailon Livramento": "戴隆·利夫拉门托",
  "Benchimol": "本希莫尔",
  "Willy Semedo": "威利·塞梅多",
  "Diogo Costa": "迪奥戈·科斯塔",
  "José Sá": "若泽·萨",
  "Rui Silva": "鲁伊·席尔瓦",
  "Nélson Semedo": "内尔松·塞梅多",
  "Rúben Dias": "鲁本·迪亚斯",
  "Tomás Araújo": "托马斯·阿劳若",
  "Diogo Dalot": "迪奥戈·达洛特",
  "Gonçalo Inácio": "贡萨洛·伊纳西奥",
  "João Cancelo": "若昂·坎塞洛",
  "Nuno Mendes": "努诺·门德斯",
  "Matheus Nunes": "马特乌斯·努内斯",
  "Bruno Fernandes": "布鲁诺·费尔南德斯",
  "Bernardo Silva": "贝尔纳多·席尔瓦",
  "Renato Veiga": "雷纳托·韦加",
  "João Neves": "若昂·内维斯",
  "Rúben Neves": "鲁本·内维斯",
  "Vitinha": "维蒂尼亚",
  "Samú Costa": "萨穆·科斯塔",
  "Cristiano Ronaldo": "克里斯蒂亚诺·罗纳尔多",
  "Gonçalo Ramos": "贡萨洛·拉莫斯",
  "João Félix": "若昂·菲利克斯",
  "Francisco Trincão": "弗朗西斯科·特林康",
  "Rafael Leão": "拉斐尔·莱奥",
  "Pedro Neto": "佩德罗·内托",
  "Gonçalo Guedes": "贡萨洛·格德斯",
  "Francisco Conceição": "弗朗西斯科·孔塞桑"
};

function translatePosition(position) {
  return POSITION_ZH[position] || position || "-";
}

function translateCountry(country) {
  return COUNTRY_ZH[country] || country || "-";
}

function translateClub(club) {
  if (!club) return "";
  return CLUB_ZH[club] || club;
}

function translatePlayerName(name) {
  return PLAYER_NAME_ZH[name] || "";
}

function readTranslationCache() {
  if (fs.existsSync(TRANSLATION_CACHE)) return JSON.parse(fs.readFileSync(TRANSLATION_CACHE, "utf8"));
  return {};
}

function writeTranslationCache(cache) {
  fs.writeFileSync(TRANSLATION_CACHE, JSON.stringify(cache, null, 2));
  return cache;
}

function modelSettings(config) {
  return {
    apiUrl: config.model?.apiUrl || process.env.LLM_API_URL,
    apiKey: config.model?.apiKey || process.env.LLM_API_KEY,
    model: config.model?.model || process.env.LLM_MODEL,
    temperature: Number(config.model?.temperature ?? 0.2)
  };
}

async function callChatCompletions(config, messages, temperature = config.model?.temperature ?? 0.2, timeoutMs = 30000) {
  const settings = modelSettings(config);
  if (!settings.apiUrl || !settings.apiKey || !settings.model) {
    throw new Error("缺少 API URL / API Key / 模型名");
  }
  const response = await fetch(settings.apiUrl, {
    method: "POST",
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${settings.apiKey}`
    },
    body: JSON.stringify({
      model: settings.model,
      messages,
      temperature: Number(temperature)
    })
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`LLM HTTP ${response.status}${body ? `: ${body.slice(0, 240)}` : ""}`);
  }
  return response.json();
}

async function translateMissingPlayerNames(names) {
  const cache = readTranslationCache();
  const missing = [...new Set(names.filter((name) => name && !PLAYER_NAME_ZH[name] && !cache[name]))];
  if (!missing.length) return cache;
  const config = readModelConfig();
  const settings = modelSettings(config);
  if (!settings.apiUrl || !settings.apiKey || !settings.model) return cache;
  try {
    const payload = await callChatCompletions(config, [
      { role: "system", content: "你只负责把足球运动员英文/拉丁字母姓名翻译成中文常用译名。只输出 JSON 对象，不要解释。" },
      { role: "user", content: `请把这些球员名翻译成中文常用译名，保持一一对应：${JSON.stringify(missing)}` }
    ], 0, 10000);
    const parsed = parseJsonObject(extractAssistantText(payload));
    if (parsed && typeof parsed === "object") {
      missing.forEach((name) => {
        if (typeof parsed[name] === "string" && parsed[name].trim()) cache[name] = parsed[name].trim();
      });
      writeTranslationCache(cache);
    }
  } catch {
    return cache;
  }
  return cache;
}

function heightToCm(height) {
  const match = String(height || "").match(/(\d+)'\s*(\d+)?/);
  if (!match) return "";
  const feet = Number(match[1]);
  const inches = Number(match[2] || 0);
  return `${Math.round((feet * 12 + inches) * 2.54)} cm`;
}

function weightToKg(weight) {
  const match = String(weight || "").match(/(\d+)/);
  if (!match) return "";
  return `${Math.round(Number(match[1]) * 0.453592)} kg`;
}

function positionFromTitle(title) {
  return Object.keys(POSITION_ZH).find((position) => title.endsWith(` ${position}`)) || "";
}

function parsePlayerProfileHtml(html) {
  const title = decodeHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "");
  const cleanTitle = title.replace(/\s+-\s+ESPN\s*$/i, "");
  const parts = cleanTitle.split(" - ");
  let club = "";
  let position = "";
  if (parts.length >= 2) {
    const clubAndPosition = parts[1];
    position = positionFromTitle(clubAndPosition);
    club = position ? clubAndPosition.slice(0, -position.length).trim() : clubAndPosition.trim();
  }
  const clubLink = html.match(/PlayerHeader__Team_Info[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
  if (clubLink) {
    club = stripTags(clubLink[2]) || club;
  }
  return {
    club,
    clubZh: translateClub(club),
    positionName: position,
    positionZh: translatePosition(position)
  };
}

async function fetchPlayerProfile(player) {
  if (!player.href || !isAllowedPlayerUrl(player.href)) return {};
  const file = playerCachePath(player.href);
  if (isFresh(file, PLAYER_TTL_MS)) {
    const cached = JSON.parse(fs.readFileSync(file, "utf8"));
    cached.clubZh = translateClub(cached.club);
    return cached;
  }
  const response = await fetch(player.href, {
    headers: { "user-agent": "football-analysis-agent/0.1" }
  });
  if (!response.ok) throw new Error(`ESPN player HTTP ${response.status}`);
  const profile = {
    ...parsePlayerProfileHtml(await response.text()),
    source: player.href,
    fetchedAt: new Date().toISOString()
  };
  fs.writeFileSync(file, JSON.stringify(profile, null, 2));
  return profile;
}

async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await mapper(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

async function enrichPlayers(players) {
  const translatedNames = await translateMissingPlayerNames(players.map((player) => player.name));
  const profiles = await mapLimit(players, 4, async (player) => {
    try {
      return await fetchPlayerProfile(player);
    } catch {
      return {};
    }
  });
  return players.map((player, index) => ({
    ...player,
    nameZh: translatePlayerName(player.name) || translatedNames[player.name] || "",
    positionZh: translatePosition(player.position),
    heightCm: heightToCm(player.height),
    weightKg: weightToKg(player.weight),
    nationalityZh: translateCountry(player.nationality),
    club: profiles[index]?.club || "",
    clubZh: profiles[index]?.clubZh || "",
    marketValue: profiles[index]?.marketValue || "",
    profileSource: profiles[index]?.source || ""
  }));
}

function parseSquadHtml(html) {
  const rows = [...html.matchAll(/<tr[^>]*data-idx="[^"]*"[^>]*>([\s\S]*?)<\/tr>/g)];
  const players = [];

  for (const [, row] of rows) {
    if (!row.includes('data-resource-id="AthleteName"')) continue;
    const link = row.match(/data-resource-id="AthleteName"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    if (!link) continue;
    const jersey = row.match(/class="pl2 roster-jersey">([\s\S]*?)<\/span>/);
    const cells = [...row.matchAll(/<td[^>]*class="Table__TD"[^>]*>([\s\S]*?)<\/td>/g)].map((cell) => stripTags(cell[1]));
    const position = cells[1] || "";
    const age = cells[2] || "";
    const height = cells[3] || "";
    const weight = cells[4] || "";
    const nationality = cells[5] || "";

    players.push({
      name: stripTags(link[2]),
      href: decodeHtml(link[1]),
      jersey: jersey ? stripTags(jersey[1]) : "",
      position,
      age,
      height,
      weight,
      nationality
    });
  }

  return players;
}

async function fetchSquad(team) {
  const link = team?.squadLink;
  if (!link || !isAllowedSquadUrl(link)) {
    return {
      players: [],
      source: link || "",
      warning: "该球队暂未从赛程数据中发现可用的 ESPN squad 链接。"
    };
  }

  const response = await fetch(link, {
    headers: { "user-agent": "football-analysis-agent/0.1" }
  });
  if (!response.ok) throw new Error(`ESPN squad HTTP ${response.status}`);
  const html = await response.text();
  const players = await enrichPlayers(parseSquadHtml(html));
  return {
    players,
    source: link,
    warning: players.length ? "" : "已访问 squad 页面，但没有解析到球员表。"
  };
}

function readModelConfig() {
  if (fs.existsSync(MODEL_CONFIG)) return JSON.parse(fs.readFileSync(MODEL_CONFIG, "utf8"));
  if (fs.existsSync(MODEL_CONFIG_EXAMPLE)) return JSON.parse(fs.readFileSync(MODEL_CONFIG_EXAMPLE, "utf8"));
  return {};
}

function readPredictions() {
  const predictions = fs.existsSync(PREDICTION_CACHE) ? JSON.parse(fs.readFileSync(PREDICTION_CACHE, "utf8")) : {};
  const rows = database().prepare("SELECT prediction_key, match_id, match_date, home, away, model_name, summary_json, raw_json, generated_at FROM predictions").all();
  rows.forEach((row) => {
    predictions[row.prediction_key] = {
      matchId: row.match_id,
      date: row.match_date,
      home: row.home,
      away: row.away,
      modelName: row.model_name,
      generatedAt: row.generated_at,
      result: JSON.parse(row.raw_json),
      summary: row.summary_json ? JSON.parse(row.summary_json) : null
    };
  });
  return predictions;
}

function writePredictions(predictions) {
  fs.writeFileSync(PREDICTION_CACHE, JSON.stringify(predictions, null, 2));
  return predictions;
}

function writeModelConfig(config) {
  (config.profiles || []).forEach(upsertModelProfile);
  if (config.model?.model || config.model?.apiUrl) {
    upsertModelProfile({ name: config.model.profileName || config.model.model || "当前模型", model: config.model });
  }
  fs.writeFileSync(MODEL_CONFIG, JSON.stringify(config, null, 2));
  return config;
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 2_000_000) {
        req.destroy();
        reject(new Error("Request body too large"));
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function readPrematchSkill() {
  return fs.existsSync(PREMATCH_SKILL) ? fs.readFileSync(PREMATCH_SKILL, "utf8") : "";
}

function readLearningSkill() {
  return fs.existsSync(LEARNING_SKILL) ? fs.readFileSync(LEARNING_SKILL, "utf8") : "";
}

function compactTeamDetail(detail) {
  return {
    team: detail.team,
    profile: detail.profile ? {
      nameZh: detail.profile.nameZh,
      nameEn: detail.profile.nameEn,
      squadLink: detail.profile.squadLink,
      source: detail.profile.source,
      updatedAt: detail.profile.updatedAt
    } : null,
    players: (detail.players || []).map((player) => ({
      name: player.name,
      jersey: player.jersey,
      position: player.positionZh || player.position,
      age: player.age,
      height: player.heightCm || player.height,
      weight: player.weightKg || player.weight,
      club: player.clubZh || player.club,
      marketValue: player.marketValue || ""
    })),
    warning: detail.warning
  };
}

async function buildAnalysisInput(match) {
  const teams = [match?.home, match?.away].filter(Boolean);
  const teamDetails = await Promise.all(teams.map(async (team) => compactTeamDetail(await getTeamDetail(team))));
  const sourceCheck = await sourceCheckForMatch(match);
  return {
    match,
    teams: teamDetails,
    sourceCheck,
    generatedAt: new Date().toISOString()
  };
}

function buildEvaluationPrompt(analysisInput, config) {
  const skill = readPrematchSkill();
  return [
    "你是赛前足球分析智能体。你的目标不是评价页面，而是基于输入信息分析比赛走势。",
    "大模型负责主要分析与判断；技能只告诉你如何使用数据、如何过滤、如何表达不确定性，不要把技能写成死板打分公式。",
    "必须先做信息源充足性与真实性校验：区分官方事实、结构化数据、媒体报道、舆情线索、模型推断；识别未经交叉验证的伤停、首发、战术烟雾弹和市场噪声。信息源不足时必须降级或跳过。",
    "必须输出：1）是否可分析/是否建议跳过；2）信息源校验；3）上半场走势；4）全场走势边界；5）最关键证据；6）信息缺口；7）来源可靠性；8）不确定性；9）娱乐参考的前三个比分与半全场选项。",
    "如果信息源不足，必须明确列出缺哪些信息、去哪类来源补：The Guardian 比赛直播记录、The Analyst/Opta 赛前和数据分析文章、FIFA 官方技术统计、全场录像观察、官方首发/伤停/发布会。",
    "分析球队整体时必须区分控球/推进/射门数量与稳定破门能力。优先寻找能表达真实表现质量的数据族，例如机会质量、射门位置与每脚射门质量、禁区触球、重大机会、定位球质量、压迫强度、推进到三区次数和防线承压。xG、每脚射门平均 xG 只是这类数据的例子，不是唯一指标。示例：如果球队首轮射门很多但每脚射门质量很低，应警惕其进攻被射门数量高估。",
    "不要承诺精确比分，不要承诺稳定盈利。娱乐比分和半全场只能标注为娱乐参考，不能作为投资建议。",
    "建议输出 JSON，字段至少包含 source_check、is_analyzable、analysis_score、confidence_score、filter_reason、first_half、full_time、key_evidence、information_gaps、source_reliability、uncertainty、team_data_check、entertainment_top3。analysis_score 是 0-100 的可分析度/证据充足度评分，即使证据不足也要给出低分并说明原因，不能只写待补资料。",
    `分析技能：\n${skill}`,
    `当前配置：${JSON.stringify(config)}`,
    `比赛与球队输入：${JSON.stringify(analysisInput)}`
  ].join("\n\n");
}

function buildReviewPrompt({ match, prediction }, config) {
  const prematchSkill = readPrematchSkill();
  const learningSkill = readLearningSkill();
  return [
    "你是赛后复盘智能体。请对照赛前预测和已赛真实情况，评估预测哪里正确、哪里失败，以及失败原因。",
    "必须按维度比较：信息源校验、上半场走势、全场走势、关键球员/教练决策、赛程动机、市场校验、娱乐比分/半全场。",
    "给出 0-100 的预测得分，并解释扣分点。最后根据学习失败经验 skill，提出需要调整的分析技能、需要补充的信息源、需要摒弃的噪声信息。",
    `赛前分析技能：\n${prematchSkill}`,
    `学习失败经验技能：\n${learningSkill}`,
    `当前配置：${JSON.stringify(config)}`,
    `已赛真实情况：${JSON.stringify(match)}`,
    `赛前预测：${JSON.stringify(prediction)}`
  ].join("\n\n");
}

async function evaluateWithModel(match, config) {
  const analysisInput = await buildAnalysisInput(match);
  const prompt = buildEvaluationPrompt(analysisInput, config);
  const settings = modelSettings(config);
  if (!settings.apiUrl || !settings.apiKey || !settings.model) {
    return {
      ok: false,
      mode: "prompt-only",
      warning: "未配置 API URL / API Key / 模型名，已返回可直接发送给大模型的赛前分析输入包。",
      analysisInput,
      prompt
    };
  }

  return {
    ok: true,
    mode: "llm",
    result: await callChatCompletions(config, [
      { role: "system", content: "你是严谨的足球赛前分析师。你分析比赛走势和过滤纪律，禁止承诺稳定盈利。不要输出隐藏推理链，只输出结论、证据和不确定性。" },
      { role: "user", content: prompt }
    ], config.model?.temperature ?? 0.2, 60000)
  };
}

async function reviewPrediction(match, prediction, config) {
  const prompt = buildReviewPrompt({ match, prediction }, config);
  const settings = modelSettings(config);
  if (!settings.apiUrl || !settings.apiKey || !settings.model) {
    return {
      ok: false,
      mode: "prompt-only",
      warning: "未配置 API URL / API Key / 模型名，已返回可直接发送给大模型的赛后复盘输入包。",
      prompt
    };
  }
  return {
    ok: true,
    mode: "llm",
    result: await callChatCompletions(config, [
      { role: "system", content: "你是严谨的足球赛后复盘分析师。你要找出预测失败原因，并改进下一次输入和技能。" },
      { role: "user", content: prompt }
    ], config.model?.temperature ?? 0.2, 60000)
  };
}

async function testModelConnection(config) {
  const startedAt = Date.now();
  const payload = await callChatCompletions(config, [
    { role: "system", content: "你是模型连通性测试助手。只回复 JSON。" },
    { role: "user", content: "请回复 {\"ok\":true,\"message\":\"pong\"}" }
  ], 0, 30000);
  return {
    ok: true,
    model: modelSettings(config).model,
    elapsedMs: Date.now() - startedAt,
    responsePreview: extractAssistantText(payload).slice(0, 200)
  };
}

function matchPredictionKey(match) {
  return match?.id || `${match?.date || ""}|${match?.home || ""}|${match?.away || ""}`;
}

async function predictMatch(match) {
  const config = readModelConfig();
  const result = await evaluateWithModel(match, config);
  if (result.mode !== "llm") return result;
  const predictions = readPredictions();
  const key = matchPredictionKey(match);
  const summary = upsertPrediction(match, result.result, config.model?.model || "");
  predictions[key] = {
    matchId: match?.id || "",
    date: match?.date || "",
    home: match?.home || "",
    away: match?.away || "",
    generatedAt: new Date().toISOString(),
    result: result.result,
    summary
  };
  predictions[matchKeyForPrediction(match)] = predictions[key];
  writePredictions(predictions);
  return { ...result, saved: predictions[key] };
}

async function getTeamDetail(teamName) {
  const teams = fs.existsSync(TEAM_CACHE) ? JSON.parse(fs.readFileSync(TEAM_CACHE, "utf8")) : {};
  const team = teams[teamName];
  const cacheFile = squadCachePath(teamName);

  if (!team) {
    return {
      team: teamName,
      profile: null,
      players: [],
      fetchedAt: "",
      source: "",
      warning: "本地球队缓存中还没有该队。请先同步包含这支球队的赛程。"
    };
  }

  if (isFresh(cacheFile, SQUAD_TTL_MS)) {
    const cached = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
    const needsPlayerRefresh = cached.players?.some((player) => (
      !player.heightCm
      || !player.nameZh
      || !Object.prototype.hasOwnProperty.call(player, "marketValue")
      || player.clubZh?.includes("待校验")
    ));
    if (needsPlayerRefresh) {
      enrichPlayers(cached.players).then((players) => {
        cached.players = players;
        cached.fetchedAt = new Date().toISOString();
        fs.writeFileSync(cacheFile, JSON.stringify(cached, null, 2));
        upsertTeamRecord(teamName, cached);
      }).catch((error) => {
        console.warn(`Background player refresh failed for ${teamName}: ${error.message}`);
      });
    }
    return cached;
  }

  try {
    const squad = await fetchSquad(team);
    const payload = {
      team: teamName,
      profile: team,
      players: squad.players,
      fetchedAt: new Date().toISOString(),
      source: squad.source,
      warning: squad.warning || ""
    };
    upsertTeamRecord(teamName, payload);
    fs.writeFileSync(cacheFile, JSON.stringify(payload, null, 2));
    return payload;
  } catch (error) {
    if (fs.existsSync(cacheFile)) return JSON.parse(fs.readFileSync(cacheFile, "utf8"));
    return {
      team: teamName,
      profile: team,
      players: [],
      fetchedAt: "",
      source: team.squadLink || "",
      warning: error.message
    };
  }
}

function updateTeamCache(payload) {
  const existing = fs.existsSync(TEAM_CACHE) ? JSON.parse(fs.readFileSync(TEAM_CACHE, "utf8")) : {};
  for (const event of payload.events || []) {
    const competition = event.competitions?.[0];
    for (const competitor of competition?.competitors || []) {
      const displayName = competitor.team?.displayName;
      const nameZh = zhName(displayName);
      existing[nameZh] = {
        nameZh,
        nameEn: displayName,
        abbreviation: competitor.team?.abbreviation || "",
        logo: competitor.team?.logo || "",
        squadLink: squadLink(competitor.team),
        officialLinks: competitor.team?.links || [],
        updatedAt: new Date().toISOString(),
        source: "ESPN scoreboard team links"
      };
      upsertTeamRecord(nameZh, existing[nameZh]);
    }
  }
  fs.writeFileSync(TEAM_CACHE, JSON.stringify(existing, null, 2));
}

async function getScoreboard(dateKey) {
  try {
    return await fetchScoreboard(dateKey);
  } catch (error) {
    const cached = readCachedScoreboard(dateKey);
    if (cached) return cached;
    throw error;
  }
}

function getScoreboardCachedFirst(dateKey) {
  const cached = readCachedScoreboard(dateKey);
  if (!cached) return null;
  fetchScoreboard(dateKey).catch((error) => {
    console.warn(`Background scoreboard refresh failed for ${dateKey}: ${error.message}`);
  });
  return cached;
}

async function pollWindow() {
  const today = currentBeijingDate();
  const start = addDays(today, -1);
  const end = addDays(today, 3);
  const keys = dateRangeKeys(start, end);
  const results = [];
  for (const key of keys) {
    try {
      await fetchScoreboard(key);
      results.push({ key, ok: true });
    } catch (error) {
      results.push({ key, ok: false, error: error.message });
    }
  }
  return results;
}

async function handleApi(req, res, url) {
  if (url.pathname === "/api/health") {
    return jsonResponse(res, 200, {
      ok: true,
      pollMinutes: POLL_MINUTES,
      cacheDir: CACHE_DIR,
      sources: readSourceRegistry().stableEntrances,
      note: "This service polls safe allowlisted data sources. Prediction runs only after API URL, API key, and model name are configured."
    });
  }

  if (url.pathname === "/api/data-sources") {
    return jsonResponse(res, 200, readSourceRegistry());
  }

  if (url.pathname === "/api/source-check") {
    const teamA = url.searchParams.get("teamA") || url.searchParams.get("home") || "";
    const teamB = url.searchParams.get("teamB") || url.searchParams.get("away") || "";
    const start = url.searchParams.get("start") || "2026-06-11";
    const end = url.searchParams.get("end") || "2026-07-19";
    if (!teamA || !teamB) return jsonResponse(res, 400, { error: "Missing teamA/teamB" });
    return jsonResponse(res, 200, await sourceCheckForMatch({ teamA, teamB, start, end }));
  }

  if (url.pathname === "/api/scoreboard") {
    const dateKey = url.searchParams.get("dates");
    if (!dateKey) return jsonResponse(res, 400, { error: "Missing dates=YYYYMMDD" });
    const payload = await getScoreboard(dateKey);
    return jsonResponse(res, 200, payload);
  }

  if (url.pathname === "/api/matches") {
    const start = url.searchParams.get("start") || "2026-06-11";
    const end = url.searchParams.get("end") || "2026-06-27";
    return jsonResponse(res, 200, {
      start,
      end,
      matches: await getMatchesForBeijingRange(start, end)
    });
  }

  if (url.pathname === "/api/teams") {
    const teams = fs.existsSync(TEAM_CACHE) ? JSON.parse(fs.readFileSync(TEAM_CACHE, "utf8")) : {};
    return jsonResponse(res, 200, {
      updatedAt: new Date().toISOString(),
      count: Object.keys(teams).length,
      teams
    });
  }

  if (url.pathname === "/api/team-detail") {
    const team = url.searchParams.get("team");
    if (!team) return jsonResponse(res, 400, { error: "Missing team=" });
    return jsonResponse(res, 200, await getTeamDetail(team));
  }

  if (url.pathname === "/api/model-config") {
    if (req.method === "GET") return jsonResponse(res, 200, readModelConfig());
    if (req.method === "POST") return jsonResponse(res, 200, writeModelConfig(await readRequestBody(req)));
  }

  if (url.pathname === "/api/test-model") {
    if (req.method !== "POST") return jsonResponse(res, 405, { error: "POST required" });
    const body = await readRequestBody(req);
    return jsonResponse(res, 200, await testModelConnection(body.config || readModelConfig()));
  }

  if (url.pathname === "/api/model-evaluate") {
    if (req.method !== "POST") return jsonResponse(res, 405, { error: "POST required" });
    const body = await readRequestBody(req);
    return jsonResponse(res, 200, await evaluateWithModel(body.match, readModelConfig()));
  }

  if (url.pathname === "/api/predictions") {
    return jsonResponse(res, 200, readPredictions());
  }

  if (url.pathname === "/api/predict") {
    if (req.method !== "POST") return jsonResponse(res, 405, { error: "POST required" });
    const body = await readRequestBody(req);
    return jsonResponse(res, 200, await predictMatch(body.match));
  }

  if (url.pathname === "/api/codex-analysis-package") {
    if (req.method !== "POST") return jsonResponse(res, 405, { error: "POST required" });
    const body = await readRequestBody(req);
    const analysisInput = await buildAnalysisInput(body.match);
    return jsonResponse(res, 200, {
      mode: "codex-package",
      note: "浏览器无法直接调用当前 Codex 对话。这里生成可发送给 Codex 的完整分析包。",
      missingSources: [
        "The Guardian 比赛直播记录或赛后 minute-by-minute",
        "The Analyst / Opta 赛前与赛后数据文章",
        "FIFA 官方技术统计与 match report",
        "全场录像观察：高压触发点、出球路线、射门质量、换人后结构变化",
        "小组赛第一轮真实表现质量数据：机会质量、射门位置与每脚射门质量、禁区触球、重大机会、定位球质量、压迫强度、推进到三区次数"
      ],
      prompt: buildEvaluationPrompt(analysisInput, readModelConfig()),
      analysisInput
    });
  }

  if (url.pathname === "/api/review-prediction") {
    if (req.method !== "POST") return jsonResponse(res, 405, { error: "POST required" });
    const body = await readRequestBody(req);
    return jsonResponse(res, 200, await reviewPrediction(body.match, body.prediction, readModelConfig()));
  }

  if (url.pathname === "/api/sync-now") {
    const results = await pollWindow();
    return jsonResponse(res, 200, { ok: true, results });
  }

  return jsonResponse(res, 404, { error: "Unknown API route" });
}

function handleStatic(req, res, url) {
  const absolute = safeStaticPath(url.pathname);
  if (absolute === MODEL_CONFIG) {
    res.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }
  if (!absolute || !fs.existsSync(absolute) || fs.statSync(absolute).isDirectory()) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }
  const type = STATIC_TYPES[path.extname(absolute)] || "application/octet-stream";
  res.writeHead(200, { "content-type": type });
  fs.createReadStream(absolute).pipe(res);
}

async function requestHandler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);
  try {
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
    } else {
      handleStatic(req, res, url);
    }
  } catch (error) {
    jsonResponse(res, 500, { error: error.message });
  }
}

async function main() {
  ensureDirs();
  database();
  syncModelProfilesToDb();
  if (process.argv.includes("--once")) {
    const results = await pollWindow();
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  http.createServer(requestHandler).listen(PORT, HOST, () => {
    console.log(`Football analysis service: http://${HOST}:${PORT}`);
    console.log(`Polling ESPN scoreboard every ${POLL_MINUTES} minutes`);
  });

  pollWindow().catch((error) => console.error("[poll]", error));
  setInterval(() => {
    pollWindow().catch((error) => console.error("[poll]", error));
  }, POLL_MINUTES * 60 * 1000);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
