const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT || 5174);
const HOST = process.env.HOST || "127.0.0.1";
const POLL_MINUTES = Number(process.env.POLL_MINUTES || 15);
const CACHE_DIR = path.join(__dirname, ".cache");
const SCOREBOARD_DIR = path.join(CACHE_DIR, "scoreboard");
const SQUAD_DIR = path.join(CACHE_DIR, "squads");
const PLAYER_DIR = path.join(CACHE_DIR, "players");
const TEAM_CACHE = path.join(CACHE_DIR, "teams.json");
const MODEL_CONFIG = path.join(__dirname, "model-config.json");
const PREMATCH_SKILL = path.join(__dirname, "agent-skills", "prematch-analysis.md");
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
  return CLUB_ZH[club] || `${club}（中文名待校验）`;
}

function translatePlayerName(name) {
  return PLAYER_NAME_ZH[name] || "";
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
  const profiles = await mapLimit(players, 4, async (player) => {
    try {
      return await fetchPlayerProfile(player);
    } catch {
      return {};
    }
  });
  return players.map((player, index) => ({
    ...player,
    nameZh: translatePlayerName(player.name),
    positionZh: translatePosition(player.position),
    heightCm: heightToCm(player.height),
    weightKg: weightToKg(player.weight),
    nationalityZh: translateCountry(player.nationality),
    club: profiles[index]?.club || "",
    clubZh: profiles[index]?.clubZh || "",
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
  return {};
}

function writeModelConfig(config) {
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
      nationality: player.nationalityZh || player.nationality
    })),
    warning: detail.warning
  };
}

async function buildAnalysisInput(match) {
  const teams = [match?.home, match?.away].filter(Boolean);
  const teamDetails = await Promise.all(teams.map(async (team) => compactTeamDetail(await getTeamDetail(team))));
  return {
    match,
    teams: teamDetails,
    generatedAt: new Date().toISOString()
  };
}

function buildEvaluationPrompt(analysisInput, config) {
  const skill = readPrematchSkill();
  return [
    "你是赛前足球分析智能体。你的目标不是评价页面，而是基于输入信息分析比赛走势。",
    "必须输出：1）是否可分析/是否建议跳过；2）上半场走势；3）全场走势边界；4）最关键证据；5）信息缺口；6）来源可靠性；7）不确定性。",
    "不要承诺精确比分，不要承诺稳定盈利。可以给倾向，但必须说明证据强弱和过滤纪律。",
    `分析技能：\n${skill}`,
    `当前配置：${JSON.stringify(config)}`,
    `比赛与球队输入：${JSON.stringify(analysisInput)}`
  ].join("\n\n");
}

async function evaluateWithModel(match, config) {
  const analysisInput = await buildAnalysisInput(match);
  const prompt = buildEvaluationPrompt(analysisInput, config);
  const llmApiUrl = config.model?.apiUrl || process.env.LLM_API_URL;
  const llmApiKey = config.model?.apiKey || process.env.LLM_API_KEY;
  const llmModel = config.model?.model || process.env.LLM_MODEL;
  if (!llmApiUrl || !llmApiKey || !llmModel) {
    return {
      ok: false,
      mode: "prompt-only",
      warning: "未配置 API URL / API Key / 模型名，已返回可直接发送给大模型的赛前分析输入包。",
      analysisInput,
      prompt
    };
  }

  const response = await fetch(llmApiUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${llmApiKey}`
    },
    body: JSON.stringify({
      model: llmModel,
      messages: [
        { role: "system", content: "你是严谨的足球赛前分析师。你分析比赛走势和过滤纪律，禁止承诺稳定盈利。" },
        { role: "user", content: prompt }
      ],
      temperature: Number(config.model?.temperature ?? 0.2)
    })
  });
  if (!response.ok) throw new Error(`LLM HTTP ${response.status}`);
  return {
    ok: true,
    mode: "llm",
    result: await response.json()
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
    const cached = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
    const needsPlayerRefresh = cached.players?.some((player) => !player.heightCm || !player.nameZh || player.clubZh?.includes("待校验"));
    if (needsPlayerRefresh) {
      cached.players = await enrichPlayers(cached.players);
      cached.fetchedAt = new Date().toISOString();
      fs.writeFileSync(cacheFile, JSON.stringify(cached, null, 2));
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

  if (url.pathname === "/api/model-config") {
    if (req.method === "GET") return jsonResponse(res, 200, readModelConfig());
    if (req.method === "POST") return jsonResponse(res, 200, writeModelConfig(await readRequestBody(req)));
  }

  if (url.pathname === "/api/model-evaluate") {
    if (req.method !== "POST") return jsonResponse(res, 405, { error: "POST required" });
    const body = await readRequestBody(req);
    return jsonResponse(res, 200, await evaluateWithModel(body.match, readModelConfig()));
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
