const state = {
  filter: "all",
  selectedId: window.WORLD_CUP_FIXTURES[0].id,
  dateStart: "2026-06-17",
  dateEnd: "2026-06-17",
  sortMode: "score-desc",
  predictions: {},
  reviews: {},
  weights: {
    strength: 1.25,
    coach: 1.2,
    tactics: 1.2,
    players: 1,
    motivation: 0.9,
    market: 0.55,
    uncertainty: -1
  }
};

const statusText = {
  actionable: "推荐关注",
  watch: "谨慎观察",
  avoid: "建议跳过",
  review: "已赛复盘",
  synced: "待补资料"
};

const riskText = {
  low: "低风险",
  mid: "中风险",
  high: "高风险"
};

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

const el = {
  list: document.getElementById("matchList"),
  hero: document.getElementById("matchHero"),
  verdict: document.getElementById("verdictGrid"),
  script: document.getElementById("scriptPanel"),
  factors: document.getElementById("factorList"),
  ring: document.getElementById("confidenceRing"),
  dateStart: document.getElementById("dateStart"),
  dateEnd: document.getElementById("dateEnd"),
  applyDate: document.getElementById("applyDate"),
  sortMode: document.getElementById("sortMode"),
  predictionResult: document.getElementById("predictionResult"),
  predictLink: document.getElementById("predictLink"),
};

function zhTeam(name) {
  return teamNameZh[name] || name || "待确认";
}

function getSelectedMatch() {
  return window.WORLD_CUP_FIXTURES.find((match) => match.id === state.selectedId) || window.WORLD_CUP_FIXTURES[0];
}

function factorScore(factor) {
  return Array.isArray(factor) ? factor[0] : factor.score;
}

function factorSummary(factor) {
  return Array.isArray(factor) ? factor[1] : factor.summary;
}

function normalizedAnalysisScore(match) {
  const prediction = predictionFor(match);
  if (prediction?.score) return Number(prediction.score);
  const entries = Object.entries(match.factors);
  const totalWeight = entries.reduce((sum, [key]) => sum + Math.abs(state.weights[key]), 0);
  const weighted = entries.reduce((sum, [key, factor]) => sum + factorScore(factor) * state.weights[key], 0);
  const uncertainty = factorScore(match.factors.uncertainty);
  const uncertaintyPenalty = Math.max(0, uncertainty - 50) * 0.28;
  const raw = weighted / totalWeight + 18 - uncertaintyPenalty;
  return Math.max(20, Math.min(88, Math.round(raw)));
}

function isFutureMatch(match) {
  return match.score === "未赛" || match.status !== "review";
}

function matchesDateRange(match) {
  if (!state.dateStart || !state.dateEnd) return true;
  const [start, end] = normalizeDateRange(state.dateStart, state.dateEnd);
  return match.date >= start && match.date <= end;
}

function dateRangeMatches() {
  return window.WORLD_CUP_FIXTURES.filter(matchesDateRange);
}

function filterCounts() {
  return dateRangeMatches().reduce((counts, match) => {
    counts.all += 1;
    counts[match.status] = (counts[match.status] || 0) + 1;
    return counts;
  }, { all: 0 });
}

function ensureUsableFilter() {
  const counts = filterCounts();
  if (state.filter !== "all" && !counts[state.filter]) {
    state.filter = "all";
  }
  document.querySelectorAll(".filter-tabs button").forEach((button) => {
    const count = counts[button.dataset.filter] || 0;
    button.classList.toggle("active", button.dataset.filter === state.filter);
    button.disabled = count === 0;
    button.dataset.count = count;
  });
}

function visibleMatches() {
  let matches = dateRangeMatches();
  if (state.filter !== "all") {
    matches = matches.filter((match) => match.status === state.filter);
  }
  return sortMatches(matches);
}

function sortMatches(matches) {
  return [...matches].sort((a, b) => {
    const predicted = Number(Boolean(predictionFor(b))) - Number(Boolean(predictionFor(a)));
    if (state.sortMode === "score-desc") {
      return predicted || a.date.localeCompare(b.date);
    }
    if (state.sortMode === "date-desc") {
      return b.date.localeCompare(a.date) || predicted || (a.kickoffTime || "").localeCompare(b.kickoffTime || "");
    }
    return a.date.localeCompare(b.date) || predicted || (a.kickoffTime || "").localeCompare(b.kickoffTime || "");
  });
}

function predictionFor(match) {
  return state.predictions[match.id] || state.predictions[`${match.date}|${match.home}|${match.away}`];
}

function statusClass(match) {
  return `status-pill ${match.status}`;
}

function formatDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function formatIsoDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function beijingDateFromIso(isoDateTime) {
  if (!isoDateTime) return "2026-06-17";
  return new Date(new Date(isoDateTime).getTime() + BEIJING_OFFSET_MS).toISOString().slice(0, 10);
}

function beijingTimeFromIso(isoDateTime) {
  if (!isoDateTime) return "时间待确认";
  const shifted = new Date(new Date(isoDateTime).getTime() + BEIJING_OFFSET_MS);
  const hours = String(shifted.getUTCHours()).padStart(2, "0");
  const minutes = String(shifted.getUTCMinutes()).padStart(2, "0");
  return `${shifted.toISOString().slice(0, 10)} ${hours}:${minutes} 北京时间`;
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

function syncDateRangeKeysForBeijing(start, end) {
  // 北京时间某一天对应 UTC 前一天下午到当天傍晚；多抓前后一天避免 ESPN 日期桶漏赛。
  return dateRangeKeys(addDays(start, -1), addDays(end, 1));
}

function normalizeDateRange(start, end) {
  return start <= end ? [start, end] : [end, start];
}

function applyDateRange() {
  if (!el.dateStart.value || !el.dateEnd.value) return;
  const [start, end] = normalizeDateRange(el.dateStart.value, el.dateEnd.value);
  state.dateStart = start;
  state.dateEnd = end;
  el.dateStart.value = start;
  el.dateEnd.value = end;
  ensureUsableFilter();
  const next = visibleMatches()[0];
  if (next) state.selectedId = next.id;
  render();
  refreshScoreboards().then(render).catch(() => {});
}

function getStat(competitor, name) {
  const stat = competitor.statistics?.find((item) => item.name === name);
  return stat ? Number.parseFloat(stat.displayValue) : null;
}

function moneylineFavorite(odds) {
  const moneyline = odds?.moneyline;
  if (!moneyline) return null;
  const entries = [
    ["home", Number(moneyline.home?.close?.odds ?? moneyline.home?.open?.odds)],
    ["away", Number(moneyline.away?.close?.odds ?? moneyline.away?.open?.odds)],
    ["draw", Number(moneyline.draw?.close?.odds ?? moneyline.draw?.open?.odds)]
  ].filter(([, value]) => Number.isFinite(value));
  if (!entries.length) return null;
  return entries.sort((a, b) => a[1] - b[1])[0];
}

function squadLink(competitor) {
  return competitor?.team?.links?.find((link) => link.rel?.includes("squad"))?.href;
}

function ensureTeamProfile(name, competitor) {
  if (!name || window.TEAM_PROFILES?.[name]) return;
  const link = squadLink(competitor);
  window.TEAM_PROFILES[name] = {
    coach: "待核验",
    summary: "已从赛程同步识别球队。需要补充主教练、国家队大名单、球员年龄、身体素质、俱乐部和联赛等级。",
    links: link ? [link] : []
  };
}

function makeSyncedMatch(event) {
  const competition = event.competitions?.[0] || {};
  const competitors = competition.competitors || [];
  const home = competitors.find((item) => item.homeAway === "home") || competitors[0];
  const away = competitors.find((item) => item.homeAway === "away") || competitors[1];
  const homeName = zhTeam(home?.team?.displayName);
  const awayName = zhTeam(away?.team?.displayName);
  ensureTeamProfile(homeName, home);
  ensureTeamProfile(awayName, away);
  const status = competition.status?.type || event.status?.type || {};
  const completed = Boolean(status.completed);
  const score = completed ? `${home?.score ?? 0}-${away?.score ?? 0}` : "未赛";
  const odds = competition.odds?.find(Boolean);
  const favorite = moneylineFavorite(odds);
  const favoriteSide = favorite?.[0] === "home" ? homeName : favorite?.[0] === "away" ? awayName : "平局";
  const favoriteValue = Math.abs(favorite?.[1] || 0);
  const strengthScore = favoriteValue > 300 ? 76 : favoriteValue > 160 ? 64 : 54;
  const homeShots = getStat(home, "totalShots");
  const awayShots = getStat(away, "totalShots");
  const shotsNote = completed && homeShots !== null && awayShots !== null
    ? `射门 ${homeName} ${homeShots} - ${awayShots} ${awayName}，可作为赛后复盘输入。`
    : "自动同步只拿到赛程/比分/部分盘口，尚未核验首发、教练策略和战术新闻。";

  const autoStatus = completed ? "review" : favoriteValue > 300 ? "avoid" : favorite ? "watch" : "synced";

  return {
    id: `espn-${event.id}`,
    status: autoStatus,
    date: beijingDateFromIso(event.date),
    utcDate: event.date?.slice(0, 10) || "",
    kickoffTime: beijingTimeFromIso(event.date),
    group: competition.altGameNote?.replace("FIFA World Cup, ", "") || "世界杯",
    venue: competition.venue?.fullName || competition.venue?.displayName || "待确认球场",
    home: homeName,
    away: awayName,
    score,
    resultNote: completed ? `${status.detail || "FT"} · ${beijingTimeFromIso(event.date)} · ${shotsNote}` : `${status.shortDetail || "Scheduled"} · ${beijingTimeFromIso(event.date)} · ${shotsNote}`,
    headline: completed ? "已赛比赛，进入复盘样本池。" : "已同步赛程，但还没有完成深度分析。",
    recommendation: completed ? "赛后复盘" : autoStatus === "avoid" ? "建议跳过：热门过深且资料不足" : autoStatus === "watch" ? "谨慎观察：待补资料" : "待补资料：不直接给结论",
    confidence: completed ? 50 : 42,
    factors: {
      strength: {
        score: strengthScore,
        summary: favorite ? `市场初步倾向：${favoriteSide}。这只是强弱线索，不等于上半场过程优势。` : "缺少赔率线索，实力边界暂不稳定。",
        evidence: "自动同步阶段只用于初筛，不能把强弱差直接等同于半场领先。",
        sources: ["ESPN scoreboard"]
      },
      coach: {
        score: 44,
        summary: "缺少可靠教练策略信息，不能假设开局打法。",
        evidence: "需要补充主教练过往执行风格、当前队伍磨合经验、赛前发布会、首发结构和类似比赛调整记录。",
        sources: ["官方发布会", "官方首发", "过往比赛录像"]
      },
      tactics: {
        score: 48,
        summary: "只完成赛程同步，战术对位需要补充球队风格和关键区域。",
        evidence: "需要识别双方是高压、低位、控球、转换，还是定位球导向。",
        sources: ["比赛录像", "战术数据源"]
      },
      players: {
        score: 45,
        summary: "首发和核心球员状态未接入，球员层判断保持低权重。",
        evidence: "需要核验伤停、训练状态、是否轮换、关键球员是否完整出场。",
        sources: ["球队官方伤情", "官方首发"]
      },
      motivation: {
        score: 58,
        summary: "世界杯小组赛天然有拿分压力，但具体动机受组内形势影响。",
        evidence: "需要结合小组积分、净胜球需求、下一场对手和赛程密度。",
        sources: ["FIFA 赛程", "小组积分榜"]
      },
      market: {
        score: favorite ? 60 : 42,
        summary: odds?.details ? `盘口摘要：${odds.details}。只用于校验风险，不直接决定判断。` : "没有稳定盘口摘要。",
        evidence: "市场信息的作用是发现基本面与市场预期是否冲突，冲突无法解释时应降级。",
        sources: ["ESPN / DraftKings odds"]
      },
      uncertainty: {
        score: 82,
        summary: "同步比赛未经完整建模，应默认高不确定性。",
        evidence: "未核验的信息不能给出明确投资判断。",
        sources: ["系统默认规则"]
      }
    },
    verdicts: [
      ["赛前直接判断", "high", "建议跳过", "这场只是自动同步，还没有完成教练、战术和人员核验。"],
      ["上半场剧本", "mid", "待补充", "需要首发、教练习惯、弱队是否敢压迫等信息。"],
      ["候选池保留", "low", "可以保留", "先进入列表，深挖后再升级或剔除。"]
    ],
    scripts: {
      half: "当前只有赛程、比分、市场和少量统计。不能把强弱关系直接转成上半场领先判断。",
      full: "后续补齐阵容、战术新闻、赔率变化和球队近期半场样本后，才能升级为可分析比赛。",
      scenarios: [
        ["待补首发", 72],
        ["待补教练策略", 68],
        ["市场线索可用", favorite ? 58 : 35],
        ["暂不判断", 82]
      ]
    }
  };
}

function matchKey(match) {
  return `${match.date}|${match.home}|${match.away}`;
}

function mergeMatch(existing, incoming) {
  existing.espnId = incoming.id;
  existing.venue = existing.venue || incoming.venue;
  existing.group = existing.group || incoming.group;
  existing.utcDate = incoming.utcDate;
  existing.kickoffTime = incoming.kickoffTime;
  if (incoming.score !== "未赛" || incoming.status === "review") {
    existing.score = incoming.score;
    existing.status = "review";
    existing.resultNote = incoming.resultNote;
    existing.headline = incoming.headline;
    existing.recommendation = incoming.recommendation;
  }
  if (existing.status === "synced") {
    Object.assign(existing, incoming);
  }
}

function statusPriority(match) {
  if (match.status === "review" || match.score !== "未赛") return 3;
  if (match.status === "watch") return 2;
  if (match.status === "actionable") return 1;
  return 0;
}

function dedupeMatchesByKey() {
  const merged = new Map();
  window.WORLD_CUP_FIXTURES.forEach((match) => {
    const key = matchKey(match);
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, match);
      return;
    }
    const keepIncoming = statusPriority(match) > statusPriority(existing);
    const primary = keepIncoming ? match : existing;
    const secondary = keepIncoming ? existing : match;
    mergeMatch(primary, secondary);
    merged.set(key, primary);
  });
  window.WORLD_CUP_FIXTURES = [...merged.values()];
}

function mergeSyncedMatches(events) {
  const synced = events.map(makeSyncedMatch);
  const existingById = new Map(window.WORLD_CUP_FIXTURES.map((match) => [match.id, match]));
  const existingByKey = new Map(window.WORLD_CUP_FIXTURES.map((match) => [matchKey(match), match]));
  synced.forEach((match) => {
    if (existingById.has(match.id)) {
      Object.assign(existingById.get(match.id), match);
    } else if (existingByKey.has(matchKey(match))) {
      mergeMatch(existingByKey.get(matchKey(match)), match);
    } else {
      window.WORLD_CUP_FIXTURES.push(match);
    }
  });
  dedupeMatchesByKey();
  window.WORLD_CUP_FIXTURES.sort((a, b) => a.date.localeCompare(b.date) || a.home.localeCompare(b.home, "zh-CN"));
}

function uniqueEvents(events) {
  const seen = new Set();
  return events.filter((event) => {
    if (!event?.id || seen.has(event.id)) return false;
    seen.add(event.id);
    return true;
  });
}

function renderMatchList() {
  ensureUsableFilter();
  const matches = visibleMatches();
  el.list.innerHTML = matches.length ? matches
    .map((match) => {
      const active = match.id === state.selectedId ? " active" : "";
      const prediction = predictionFor(match);
      return `
        <button class="match-card${active}" data-match-id="${match.id}" type="button">
          <div class="match-card-top">
            <span>${match.date} · ${match.group}</span>
            <span class="${statusClass(match)}">${statusText[match.status]}</span>
          </div>
          <div class="team-line">
            <span>${match.home}</span>
            <span>${match.score}</span>
            <span>${match.away}</span>
          </div>
          <div class="mini-score">
            <span>${match.kickoffTime || "可分析度"}</span>
            <strong>${prediction ? "已预测" : "未预测"}</strong>
          </div>
        </button>
      `;
    })
    .join("") : `<div class="empty-state">当前筛选下没有比赛。可以调整日期范围后点击“确定”。</div>`;
}

function renderHero(match) {
  const teamsHref = `teams.html?match=${encodeURIComponent(match.id)}`;

  el.hero.innerHTML = `
    <div class="hero-content">
      <div>
        <div class="hero-top">
          <span class="tag">${match.date}</span>
          <span class="tag">${match.kickoffTime || "北京时间待确认"}</span>
          <span class="tag dark">${match.group}</span>
          <span class="tag dark">${match.venue}</span>
        </div>
        <h2 class="hero-title">
          <a class="team-name" href="${teamsHref}">${match.home}</a>
          <span>vs</span>
          <a class="team-name" href="${teamsHref}">${match.away}</a>
        </h2>
        <p class="hero-subtitle">${match.headline}</p>
      </div>
      <div class="score-board">
        <div class="score-row">
          <div>
            <span>比分/状态</span>
            <strong>${match.score}</strong>
          </div>
          <span class="${statusClass(match)}">${statusText[match.status]}</span>
        </div>
        <div class="badges-row">
          <span class="tag">${match.recommendation}</span>
          <span class="tag">${predictionFor(match) ? "已有大模型预测" : "未生成预测"}</span>
          <a class="tag link-tag" href="${teamsHref}">双方球队情报</a>
        </div>
        <p class="hero-subtitle">${match.resultNote}</p>
      </div>
    </div>
  `;
}

function renderVerdicts(match) {
  const prediction = predictionFor(match);
  const review = state.reviews[match.id];
  const actualPanel = match.status === "review" ? `
    <div class="review-card">
      <strong>已赛真实情况（自动同步）</strong>
      <p>${match.home} ${match.score} ${match.away}</p>
      <p>${match.resultNote || "已完赛，详细过程数据待补充。"}</p>
    </div>
  ` : "";
  const comparePanel = match.status === "review" && prediction ? `
    <div class="review-card">
      <strong>预测情况对比</strong>
      <p>预测得分：${review ? "见下方复盘结果" : "待大模型复盘评分"}</p>
      <p>复盘会对照上半场走势、全场走势、关键证据、信息缺口和最终比分逐项解释偏差。</p>
      <button class="secondary-action" type="button" data-review-match="${match.id}">调用大模型复盘</button>
    </div>
  ` : "";
  const reviewPanel = review ? `<pre>${JSON.stringify(review.result || review, null, 2)}</pre>` : "";
  const predictionPanel = prediction
    ? `<pre>${JSON.stringify(prediction.result || prediction, null, 2)}</pre>`
    : `<div class="empty-state">这场比赛还没有大模型预测结果。请进入预测模块生成。</div>`;
  el.predictionResult.innerHTML = `${actualPanel}${predictionPanel}${comparePanel}${reviewPanel}`;
  if (el.predictLink) el.predictLink.href = `predict.html?match=${encodeURIComponent(match.id)}`;
}

function renderScripts(match) {
  el.script.innerHTML = `<div class="empty-state">走势推演由大模型预测生成，当前为空。</div>`;
}

function renderFactors(match) {
  el.factors.innerHTML = `<div class="empty-state">模型证据、信息缺口和来源可信度会在生成预测后展示。</div>`;
}

function render() {
  ensureUsableFilter();
  const match = getSelectedMatch();
  renderMatchList();
  renderHero(match);
  renderVerdicts(match);
  renderScripts(match);
  renderFactors(match);
}

document.querySelectorAll(".filter-tabs button").forEach((button) => {
  button.addEventListener("click", () => {
    if (button.disabled) return;
    document.querySelectorAll(".filter-tabs button").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    state.filter = button.dataset.filter;
    const next = visibleMatches()[0];
    if (next && !visibleMatches().some((match) => match.id === state.selectedId)) {
      state.selectedId = next.id;
    }
    render();
  });
});

el.list.addEventListener("click", (event) => {
  const card = event.target.closest("[data-match-id]");
  if (!card) return;
  state.selectedId = card.dataset.matchId;
  render();
});

el.applyDate.addEventListener("click", applyDateRange);

el.sortMode.addEventListener("change", () => {
  state.sortMode = el.sortMode.value;
  render();
});

el.predictionResult.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-review-match]");
  if (!button) return;
  const match = getSelectedMatch();
  const prediction = predictionFor(match);
  if (!prediction) return;
  button.disabled = true;
  button.textContent = "复盘中";
  try {
    const response = await fetch("/api/review-prediction", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ match, prediction })
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.reviews[match.id] = await response.json();
  } catch (error) {
    state.reviews[match.id] = { ok: false, error: error.message };
  } finally {
    renderVerdicts(match);
  }
});

loadPredictions()
  .then(refreshScoreboards)
  .finally(render);
setInterval(() => {
  refreshScoreboards().catch(() => {});
  loadPredictions().then(render).catch(() => {});
}, 30 * 1000);

async function fetchScoreboard(dateKey) {
  const endpoint = window.location.protocol.startsWith("http")
    ? `/api/scoreboard?dates=${dateKey}`
    : `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=${dateKey}`;
  const response = await fetch(endpoint);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function loadPredictions() {
  if (!window.location.protocol.startsWith("http")) return;
  const response = await fetch("/api/predictions");
  if (response.ok) state.predictions = await response.json();
}

async function refreshScoreboards() {
  if (!window.location.protocol.startsWith("http")) return;
  const [start, end] = normalizeDateRange(state.dateStart || formatIsoDate(), state.dateEnd || state.dateStart || formatIsoDate());
  const payloads = await Promise.all(syncDateRangeKeysForBeijing(start, end).map(fetchScoreboard));
  const events = uniqueEvents(payloads.flatMap((payload) => payload.events || []))
    .filter((event) => {
      const eventDate = beijingDateFromIso(event.date);
      return eventDate && eventDate >= start && eventDate <= end;
    });
  mergeSyncedMatches(events);
}
