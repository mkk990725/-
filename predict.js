const predictDate = document.getElementById("predictDate");
const predictMatch = document.getElementById("predictMatch");
const runPrediction = document.getElementById("runPrediction");
const predictResult = document.getElementById("predictResult");

const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000;

const teamNameZh = {
  Argentina: "阿根廷",
  Algeria: "阿尔及利亚",
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

function getQuery(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function zhTeam(name) {
  return teamNameZh[name] || name || "待确认";
}

function formatDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function addDays(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function dateRangeKeys(start, end) {
  const keys = [];
  const cursor = new Date(`${start}T00:00:00`);
  const last = new Date(`${end}T00:00:00`);
  while (cursor <= last) {
    keys.push(formatDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return keys;
}

function beijingDateFromIso(isoDateTime) {
  if (!isoDateTime) return "";
  return new Date(new Date(isoDateTime).getTime() + BEIJING_OFFSET_MS).toISOString().slice(0, 10);
}

function beijingTimeFromIso(isoDateTime) {
  if (!isoDateTime) return "时间待确认";
  const shifted = new Date(new Date(isoDateTime).getTime() + BEIJING_OFFSET_MS);
  const hours = String(shifted.getUTCHours()).padStart(2, "0");
  const minutes = String(shifted.getUTCMinutes()).padStart(2, "0");
  return `${shifted.toISOString().slice(0, 10)} ${hours}:${minutes} 北京时间`;
}

function matchKey(match) {
  return `${match.date}|${match.home}|${match.away}`;
}

function statusPriority(match) {
  if (match.status === "review" || match.score !== "未赛") return 3;
  if (match.status === "watch") return 2;
  if (match.status === "actionable") return 1;
  return 0;
}

function makeSyncedMatch(event) {
  const competition = event.competitions?.[0] || {};
  const competitors = competition.competitors || [];
  const home = competitors.find((item) => item.homeAway === "home") || competitors[0];
  const away = competitors.find((item) => item.homeAway === "away") || competitors[1];
  const status = competition.status?.type || event.status?.type || {};
  const completed = Boolean(status.completed);
  const homeName = zhTeam(home?.team?.displayName);
  const awayName = zhTeam(away?.team?.displayName);
  const score = completed ? `${home?.score ?? 0}-${away?.score ?? 0}` : "未赛";
  return {
    id: `espn-${event.id}`,
    status: completed ? "review" : "synced",
    date: beijingDateFromIso(event.date),
    utcDate: event.date?.slice(0, 10) || "",
    kickoffTime: beijingTimeFromIso(event.date),
    group: competition.altGameNote?.replace("FIFA World Cup, ", "") || "世界杯",
    venue: competition.venue?.fullName || competition.venue?.displayName || "待确认球场",
    home: homeName,
    away: awayName,
    score,
    headline: completed ? "已赛比赛，进入复盘样本池。" : "已同步赛程，等待大模型分析。",
    recommendation: completed ? "赛后复盘" : "待预测",
    resultNote: completed ? `${status.detail || "FT"} · ${beijingTimeFromIso(event.date)}` : `${status.shortDetail || "Scheduled"} · ${beijingTimeFromIso(event.date)}`,
    factors: {},
    verdicts: [],
    scripts: {}
  };
}

function mergeMatches(matches) {
  const merged = new Map(window.WORLD_CUP_FIXTURES.map((match) => [matchKey(match), match]));
  matches.forEach((incoming) => {
    const key = matchKey(incoming);
    const existing = merged.get(key);
    if (!existing || statusPriority(incoming) > statusPriority(existing)) {
      merged.set(key, { ...existing, ...incoming });
    } else {
      Object.assign(existing, incoming.score !== "未赛" ? incoming : { espnId: incoming.id, kickoffTime: incoming.kickoffTime });
    }
  });
  window.WORLD_CUP_FIXTURES = [...merged.values()];
}

function uniqueEvents(events) {
  const seen = new Set();
  return events.filter((event) => {
    if (!event?.id || seen.has(event.id)) return false;
    seen.add(event.id);
    return true;
  });
}

async function fetchScoreboard(dateKey) {
  const endpoint = window.location.protocol.startsWith("http")
    ? `/api/scoreboard?dates=${dateKey}`
    : `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=${dateKey}`;
  const response = await fetch(endpoint);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function syncSelectedDate() {
  if (!predictDate.value || !window.location.protocol.startsWith("http")) return;
  const dateKeys = dateRangeKeys(addDays(predictDate.value, -1), addDays(predictDate.value, 1));
  predictMatch.innerHTML = `<option value="">正在同步赛程...</option>`;
  runPrediction.disabled = true;
  const payloads = await Promise.all(dateKeys.map(fetchScoreboard));
  const events = uniqueEvents(payloads.flatMap((payload) => payload.events || []))
    .filter((event) => beijingDateFromIso(event.date) === predictDate.value);
  mergeMatches(events.map(makeSyncedMatch));
}

function matchesForDate(date) {
  return window.WORLD_CUP_FIXTURES
    .filter((match) => match.date === date)
    .sort((a, b) => (a.kickoffTime || "").localeCompare(b.kickoffTime || "") || a.home.localeCompare(b.home, "zh-CN"));
}

function renderMatchOptions() {
  const matches = matchesForDate(predictDate.value);
  predictMatch.innerHTML = matches.length
    ? matches.map((match) => `<option value="${match.id}">${match.kickoffTime || match.date} · ${match.home} vs ${match.away}</option>`).join("")
    : `<option value="">当前日期暂无赛程，或后台数据源暂未返回</option>`;
  runPrediction.disabled = !matches.length;
}

function selectedMatch() {
  return window.WORLD_CUP_FIXTURES.find((match) => match.id === predictMatch.value);
}

async function refreshOptions() {
  try {
    await syncSelectedDate();
  } catch (error) {
    predictResult.textContent = `赛程同步失败：${error.message}`;
  } finally {
    renderMatchOptions();
  }
}

async function generatePrediction() {
  const match = selectedMatch();
  if (!match) return;
  runPrediction.disabled = true;
  runPrediction.textContent = "生成中";
  predictResult.textContent = "正在整理比赛、球队、球员、信息源校验和分析技能输入...";
  try {
    const response = await fetch("/api/predict", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ match })
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    predictResult.textContent = payload.mode === "prompt-only"
      ? `${payload.warning}\n\n${payload.prompt}`
      : JSON.stringify(payload.saved || payload.result, null, 2);
  } catch (error) {
    predictResult.textContent = `预测失败：${error.message}`;
  } finally {
    runPrediction.disabled = false;
    runPrediction.textContent = "生成预测";
  }
}

predictDate.addEventListener("change", refreshOptions);
runPrediction.addEventListener("click", generatePrediction);

const matchId = getQuery("match");
const initial = window.WORLD_CUP_FIXTURES.find((match) => match.id === matchId);
if (initial) predictDate.value = initial.date;
refreshOptions().then(() => {
  if (initial && matchesForDate(initial.date).some((match) => match.id === initial.id)) {
    predictMatch.value = initial.id;
  }
});
