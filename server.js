const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT || 5174);
const HOST = process.env.HOST || "127.0.0.1";
const POLL_MINUTES = Number(process.env.POLL_MINUTES || 15);
const CACHE_DIR = path.join(__dirname, ".cache");
const SCOREBOARD_DIR = path.join(CACHE_DIR, "scoreboard");
const SQUAD_DIR = path.join(CACHE_DIR, "squads");
const TEAM_CACHE = path.join(CACHE_DIR, "teams.json");
const SQUAD_TTL_MS = Number(process.env.SQUAD_TTL_HOURS || 12) * 60 * 60 * 1000;
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

function squadCachePath(teamName) {
  const safeName = encodeURIComponent(teamName).replace(/%/g, "_");
  return path.join(SQUAD_DIR, `${safeName}.json`);
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
  const players = parseSquadHtml(html);
  return {
    players,
    source: link,
    warning: players.length ? "" : "已访问 squad 页面，但没有解析到球员表。"
  };
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
    return JSON.parse(fs.readFileSync(cacheFile, "utf8"));
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
      sources: ["ESPN scoreboard allowlist", "ESPN squad allowlist"],
      note: "This service polls safe allowlisted data sources. It does not run a prediction model yet."
    });
  }

  if (url.pathname === "/api/scoreboard") {
    const dateKey = url.searchParams.get("dates");
    if (!dateKey) return jsonResponse(res, 400, { error: "Missing dates=YYYYMMDD" });
    const payload = await getScoreboard(dateKey);
    return jsonResponse(res, 200, payload);
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

  if (url.pathname === "/api/sync-now") {
    const results = await pollWindow();
    return jsonResponse(res, 200, { ok: true, results });
  }

  return jsonResponse(res, 404, { error: "Unknown API route" });
}

function handleStatic(req, res, url) {
  const absolute = safeStaticPath(url.pathname);
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
