const INITIAL_DATE = currentBeijingIsoDate();
const MATCH_CACHE_KEY = "footballAgent.matchesCache.v1";

const state = {
  filter: "all",
  selectedId: initialSelectedMatchId(),
  dateStart: INITIAL_DATE,
  dateEnd: INITIAL_DATE,
  sortMode: "score-desc",
  predictions: {},
  reviews: {},
  prematchInfoByMatch: {},
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

const pageMode = document.body?.dataset?.page || "match-detail";

function currentBeijingIsoDate() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Shanghai" });
}

function initialSelectedMatchId() {
  const urlMatchId = new URLSearchParams(window.location.search).get("match");
  if (urlMatchId && window.WORLD_CUP_FIXTURES.some((match) => match.id === urlMatchId)) return urlMatchId;
  const cachedMatchId = localStorage.getItem("selectedMatchId");
  if (cachedMatchId && window.WORLD_CUP_FIXTURES.some((match) => match.id === cachedMatchId)) return cachedMatchId;
  const firstToday = window.WORLD_CUP_FIXTURES
    .filter((match) => match.date === INITIAL_DATE)
    .sort((a, b) => (a.kickoffTime || "").localeCompare(b.kickoffTime || ""))[0];
  return (firstToday || window.WORLD_CUP_FIXTURES[0]).id;
}

const statusText = {
  actionable: "推荐关注",
  watch: "谨慎观察",
  avoid: "建议跳过",
  review: "已赛复盘",
  synced: "待预测"
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
  prevMatchDay: document.getElementById("prevMatchDay"),
  nextMatchDay: document.getElementById("nextMatchDay"),
  predictionResult: document.getElementById("predictionResult"),
  predictLink: document.getElementById("predictLink"),
  prematchUpdate: document.getElementById("prematchUpdate"),
  prematchPanel: document.getElementById("prematchPanel"),
  tacticalProfilePanel: document.getElementById("tacticalProfilePanel"),
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

function numericPercent(value) {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(String(value).replace(/[^\d.]/g, ""));
  return Number.isFinite(num) ? Math.max(0, Math.min(100, num)) : null;
}

function hasUsefulValue(value) {
  if (value === null || value === undefined || value === "") return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

function sourceCompletenessScore(summary) {
  if (!summary || !Object.keys(summary).length) {
    return { score: 0, reasons: ["未生成预测，尚未做信息源校验"] };
  }
  const reasons = [];
  let score = 0;
  const sourceCheck = summary.source_check || summary.sourceCheck;
  const reliability = summary.source_reliability || summary.sourceReliability;
  const teamData = summary.team_data_check || summary.teamDataCheck;
  const gaps = summary.information_gaps || summary.missing_sources || summary.informationGaps;

  if (hasUsefulValue(sourceCheck)) {
    score += 25;
    reasons.push("有信息源校验结论 +25");
    const text = valueText(sourceCheck, "").toLowerCase();
    if (/通过|充足|完整|可靠|confirmed|sufficient|high/.test(text)) {
      score += 15;
      reasons.push("来源校验偏正向 +15");
    } else if (/不足|缺失|failed|low|无|缺/.test(text)) {
      score -= 8;
      reasons.push("来源校验提示缺失 -8");
    }
  } else {
    reasons.push("缺少 source_check +0");
  }

  if (hasUsefulValue(reliability)) {
    score += 18;
    reasons.push("有来源可靠性说明 +18");
  }
  if (hasUsefulValue(teamData)) {
    score += 17;
    reasons.push("有球队/球员数据校验 +17");
  }
  if (hasUsefulValue(gaps)) {
    score += 10;
    reasons.push("明确列出信息缺口 +10");
  }
  if (hasUsefulValue(summary.key_evidence || summary.evidence)) {
    score += 15;
    reasons.push("有关键证据链 +15");
  }

  return { score: Math.max(0, Math.min(100, Math.round(score))), reasons };
}

function matchBaseEvidenceScore(match) {
  let score = 0;
  const reasons = [];
  if (match.id && String(match.id).startsWith("espn-")) {
    score += 15;
    reasons.push("ESPN 赛程事件确认 +15");
  }
  if (match.date && match.kickoffTime && match.group && match.venue) {
    score += 20;
    reasons.push("比赛时间/小组/场地完整 +20");
  }
  if (match.home && match.away) {
    score += 10;
    reasons.push("双方球队明确 +10");
  }
  if (match.status === "review" || match.score !== "未赛") {
    score += 10;
    reasons.push("已赛结果可用于复盘校验 +10");
  }
  if (match.factors) {
    score += 15;
    reasons.push("存在本地启发式因子 +15");
  } else {
    reasons.push("未接入阵容/战术/表现质量因子");
  }
  return { score: Math.max(0, Math.min(100, score)), reasons };
}

function scoreMatchEvidence(match) {
  const prediction = predictionFor(match);
  const summary = normalizePredictionSummary(prediction);
  const modelAnalysisScore = numericPercent(summary?.analysis_score || summary?.score || prediction?.score);
  const modelConfidence = numericPercent(summary?.confidence_score || summary?.confidence);
  const base = matchBaseEvidenceScore(match);
  const source = sourceCompletenessScore(summary);

  if (prediction) {
    const modelScore = modelAnalysisScore ?? Math.round((source.score * 0.65) + (base.score * 0.35));
    const confidencePart = modelConfidence ?? modelScore;
    const finalScore = Math.round(modelScore * 0.45 + source.score * 0.35 + base.score * 0.2);
    return {
      score: Math.max(0, Math.min(100, finalScore)),
      sourceScore: source.score,
      confidenceScore: Math.max(0, Math.min(100, Math.round(confidencePart))),
      reasons: [
        ...(modelAnalysisScore === null ? ["模型未给 analysis_score，使用来源/基础证据推算"] : [`模型可分析度 ${modelAnalysisScore}`]),
        ...(modelConfidence === null ? ["模型未给 confidence_score"] : [`模型信心 ${modelConfidence}`]),
        ...source.reasons,
        ...base.reasons
      ]
    };
  }

  const entries = match.factors ? Object.entries(match.factors) : [];
  if (entries.length) {
    const totalWeight = entries.reduce((sum, [key]) => sum + Math.abs(state.weights[key]), 0);
    const weighted = entries.reduce((sum, [key, factor]) => sum + factorScore(factor) * state.weights[key], 0);
    const uncertainty = factorScore(match.factors.uncertainty);
    const uncertaintyPenalty = Math.max(0, uncertainty - 50) * 0.28;
    const raw = weighted / totalWeight + 18 - uncertaintyPenalty;
    return {
      score: Math.max(20, Math.min(88, Math.round(raw))),
      sourceScore: 0,
      confidenceScore: Math.max(20, Math.min(88, Math.round(raw))),
      reasons: ["本地启发式因子加权", `不确定性惩罚 ${Math.round(uncertaintyPenalty)}`, ...base.reasons]
    };
  }

  return {
    score: base.score,
    sourceScore: 0,
    confidenceScore: base.score,
    reasons: base.reasons
  };
}

function normalizedAnalysisScore(match) {
  return scoreMatchEvidence(match).score;
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
      return predicted || normalizedAnalysisScore(b) - normalizedAnalysisScore(a) || a.date.localeCompare(b.date);
    }
    if (state.sortMode === "date-desc") {
      return b.date.localeCompare(a.date) || predicted || (a.kickoffTime || "").localeCompare(b.kickoffTime || "");
    }
    return a.date.localeCompare(b.date) || predicted || (a.kickoffTime || "").localeCompare(b.kickoffTime || "");
  });
}

function predictionFor(match) {
  return state.predictions[match.id] || state.predictions[matchKey(match)] || state.predictions[`${match.date}|${match.home}|${match.away}`];
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
    recommendation: completed ? "赛后复盘" : autoStatus === "avoid" ? "建议跳过：热门过深且证据不足" : autoStatus === "watch" ? "谨慎观察：证据仍需校验" : "待预测：证据不足，先低信心比较",
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
  const teams = [match.home, match.away].map((team) => String(team || "").trim()).sort((a, b) => a.localeCompare(b, "zh-CN"));
  return `${match.date}|${teams[0]}|${teams[1]}`;
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

function mergeServerMatches(matches) {
  const existingById = new Map(window.WORLD_CUP_FIXTURES.map((match) => [match.id, match]));
  const existingByKey = new Map(window.WORLD_CUP_FIXTURES.map((match) => [matchKey(match), match]));
  matches.forEach((match) => {
    if (!match?.home || !match?.away) return;
    if (existingById.has(match.id)) {
      Object.assign(existingById.get(match.id), match);
    } else if (existingByKey.has(matchKey(match))) {
      mergeMatch(existingByKey.get(matchKey(match)), match);
    } else {
      window.WORLD_CUP_FIXTURES.push(match);
    }
  });
  dedupeMatchesByKey();
  window.WORLD_CUP_FIXTURES.sort((a, b) => a.date.localeCompare(b.date) || (a.kickoffTime || "").localeCompare(b.kickoffTime || ""));
}

function readMatchCache() {
  try {
    const cache = JSON.parse(localStorage.getItem(MATCH_CACHE_KEY) || "{}");
    if (Array.isArray(cache.matches) && cache.matches.length) {
      mergeServerMatches(cache.matches);
    }
  } catch {}
}

function writeMatchCache(matches) {
  try {
    localStorage.setItem(MATCH_CACHE_KEY, JSON.stringify({
      updatedAt: new Date().toISOString(),
      matches
    }));
  } catch {}
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
  if (!el.list) return;
  ensureUsableFilter();
  const matches = visibleMatches();
  el.list.innerHTML = matches.length ? matches
    .map((match) => {
      const active = match.id === state.selectedId ? " active" : "";
      const prediction = predictionFor(match);
      return `
        <button class="match-card${active}" data-match-id="${match.id}" type="button">
          <div class="match-card-top">
            <span class="match-meta">
              <span>${match.date}</span>
              <span>${match.group}</span>
            </span>
            <span class="prediction-pill ${prediction ? "predicted" : "pending"}">${prediction ? "已预测" : "待预测"}</span>
          </div>
          <div class="team-line">
            <span>${match.home}</span>
            <span>${match.score}</span>
            <span>${match.away}</span>
          </div>
        </button>
      `;
    })
    .join("") : `<div class="empty-state">当前筛选下没有比赛。可以调整日期范围后点击“确定”。</div>`;
}

function renderHero(match) {
  if (!el.hero) return;
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
  if (!el.predictionResult) return;
  const prediction = predictionFor(match);
  const actualPanel = match.status === "review" ? `
    <div class="review-card">
      <strong>已赛真实结果</strong>
      <p>${match.home} ${match.score} ${match.away}</p>
      <p>${match.resultNote || "已完赛，详细过程数据待补充。"}</p>
    </div>
  ` : "";
  const predictionPanel = prediction
    ? renderPredictionSummary(prediction)
    : renderPredictionPlaceholder();
  el.predictionResult.innerHTML = `${actualPanel}${predictionPanel}`;
  if (el.predictLink) el.predictLink.href = `predict.html?match=${encodeURIComponent(match.id)}`;
}

function renderPredictionPlaceholder() {
  return `
    <section class="prediction-brief empty-prediction">
      <span>整场局势预测分析</span>
      <strong>暂未生成预测</strong>
      <p>进入预测模块后，智能体会把赛前信息、球队技战术、球员功能、赛程动机和数据证据整理成可读结论，并同步回这里。</p>
    </section>
    <div class="prediction-summary-grid">
      <article class="result-card accent">
        <span>胜平负</span>
        <strong>待生成</strong>
        <p>预测后展示倾向、信心和主要触发条件。</p>
      </article>
      <article class="result-card">
        <span>进球数</span>
        <strong>待生成</strong>
        <p>预测后展示大/小球或区间判断。</p>
      </article>
      <article class="result-card">
        <span>比分</span>
        <strong>待生成</strong>
        <p>仅作娱乐参考，不作为投资建议。</p>
      </article>
      <article class="result-card wide">
        <span>半全场</span>
        <strong>待生成</strong>
        <p>预测后展示上半场走势、全场延展和关键触发条件。</p>
      </article>
    </div>
  `;
}

const textDictionary = [
  [/first[\s_-]*half/gi, "上半场"],
  [/second[\s_-]*half/gi, "下半场"],
  [/full[\s_-]*time/gi, "全场"],
  [/half[\s_-]*time/gi, "半场"],
  [/home[\s_-]*win/gi, "主队胜"],
  [/away[\s_-]*win/gi, "客队胜"],
  [/\bdraw\b/gi, "平局"],
  [/\bover\b/gi, "大球"],
  [/\bunder\b/gi, "小球"],
  [/\bhigh\b/gi, "高"],
  [/\bmedium\b/gi, "中"],
  [/\blow\b/gi, "低"],
  [/\bconfidence\b/gi, "信心"],
  [/\bprobability\b/gi, "概率"],
  [/\btrigger\b/gi, "触发条件"],
  [/\bcondition\b/gi, "条件"],
  [/\bscoreline\b/gi, "比分"],
  [/\blineup\b/gi, "首发"],
  [/\binjury\b/gi, "伤停"],
  [/\bpressing\b/gi, "压迫"],
  [/\bcounter[\s_-]*attack/gi, "反击"],
  [/\bset[\s_-]*piece/gi, "定位球"],
  [/\bxG\b/g, "预期进球"],
  [/\bTurkey\b/g, "土耳其"],
  [/\bUruguay\b/g, "乌拉圭"],
  [/\bSpain\b/g, "西班牙"],
  [/\bJapan\b/g, "日本"],
  [/\bEngland\b/g, "英格兰"],
  [/\bCroatia\b/g, "克罗地亚"]
];

const keyLabelMap = {
  winner: "胜平负",
  win_tendency: "胜负倾向",
  confidence: "信心",
  confidence_score: "信心分",
  first_half: "上半场",
  firstHalf: "上半场",
  full_time: "全场",
  fullTime: "全场",
  key_evidence: "关键依据",
  evidence: "依据",
  reason: "原因",
  summary: "摘要",
  text: "说明",
  result: "结果",
  tendency: "倾向",
  total_goals: "总进球",
  goal_line: "进球线",
  over_under: "大小球",
  half_full: "半全场",
  halfFull: "半全场",
  ht_ft: "半全场",
  score_range: "比分区间",
  scoreRange: "比分区间",
  tactical_profile: "技战术画像",
  tacticalProfile: "技战术画像",
  player_functions: "球员功能",
  playerFunctions: "球员功能",
  market_check: "市场校验",
  marketCheck: "市场校验",
  score: "比分",
  goals: "进球数",
  name: "分支名称",
  type: "类型",
  level: "概率等级",
  probability: "概率",
  trigger: "触发条件",
  condition: "条件",
  direction: "方向",
  bet_direction: "投注方向",
  source_check: "信息源校验",
  source_reliability: "来源可信度",
  information_gaps: "信息缺口",
  missing_sources: "缺失信息源",
  is_analyzable: "是否适合分析",
  filter_reason: "过滤理由",
  matchup: "对位分析",
  matchup_analysis: "对位分析",
  branches: "比赛分支",
  scenarios: "比赛分支",
  risk: "风险",
  cold_risk: "冷门风险",
  recommendation: "建议",
  avoid: "不建议选择"
};

function zhLabel(key) {
  return keyLabelMap[key] || "补充信息";
}

function polishText(text) {
  let output = String(text || "")
    .replace(/\s+/g, " ")
    .replace(/\s*;\s*/g, "；")
    .replace(/\s*,\s*/g, "，")
    .trim();
  for (const [pattern, replacement] of textDictionary) {
    output = output.replace(pattern, replacement);
  }
  return output;
}

function valueText(value, fallback = "待模型给出") {
  if (value === null || value === undefined || value === "") return fallback;
  if (Array.isArray(value)) return value.map((item) => valueText(item, "")).filter(Boolean).join("；");
  if (typeof value === "object") {
    if (value.summary || value.text || value.result || value.reason || value.tendency) {
      return polishText(value.summary || value.text || value.result || value.reason || value.tendency);
    }
    return Object.entries(value)
      .filter(([, item]) => item !== null && item !== undefined && item !== "")
      .map(([key, item]) => `${zhLabel(key)}：${valueText(item, "")}`)
      .join("；") || fallback;
  }
  return polishText(value);
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

function assistantText(payload) {
  return payload?.choices?.[0]?.message?.content
    || payload?.choices?.[0]?.text
    || payload?.output_text
    || "";
}

function normalizePredictionSummary(prediction) {
  let summary = prediction?.summary || prediction?.result?.summary || prediction?.result || prediction || {};
  const text = assistantText(summary) || assistantText(summary.result) || summary.rawText;
  const parsed = parseJsonObject(text);
  if (parsed) summary = parsed;
  return summary;
}

function percentText(value, fallback = "未给出") {
  if (value === null || value === undefined || value === "") return fallback;
  const raw = String(value);
  const num = Number(raw.replace(/[^\d.]/g, ""));
  if (!Number.isFinite(num)) return raw;
  return `${Math.round(Math.max(0, Math.min(100, num)))}%`;
}

function summaryText(value, fallback = "模型未给出") {
  const text = valueText(value, fallback);
  if (text === fallback) return text;
  return text.length > 140 ? `${text.slice(0, 140)}...` : text;
}

function renderEntertainmentTop3(items) {
  const list = Array.isArray(items) ? items.slice(0, 3) : [];
  if (!list.length) return `<div class="empty-state">模型没有给出娱乐比分前三项。</div>`;
  return `
    <div class="entertainment-grid">
      ${list.map((item, index) => `
        <div class="mini-prediction-card">
          <span>娱乐 ${index + 1}</span>
          <strong>${valueText(item.score || item.scoreline || item.result, "-")}</strong>
          <p>${valueText(item.half_full || item.halfFull || item.ht_ft, "半全场未给出")}</p>
        </div>
      `).join("")}
    </div>
  `;
}

function renderBranches(branches) {
  const list = Array.isArray(branches)
    ? branches
    : Object.entries(branches || {}).map(([name, value]) => ({ name, ...((typeof value === "object" && value) || { text: value }) }));
  if (!list.length) return `<div class="empty-state">模型未给出三分支推演。</div>`;
  return `
    <div class="branch-grid">
      ${list.slice(0, 3).map((item, index) => `
        <div class="branch-card">
          <span>${valueText(item.name || item.type || ["常规分支", "打穿分支", "钝化/冷门分支"][index])}</span>
          <strong>${valueText(item.score || item.score_range || item.scoreRange || item.result, "比分区间未给出")}</strong>
          <p>${valueText(item.trigger || item.condition || item.text, "触发条件未给出")}</p>
          <p>${valueText(item.direction || item.bet_direction || item.probability || item.level, "方向/概率未给出")}</p>
        </div>
      `).join("")}
    </div>
  `;
}

function actualWinner(match) {
  if (!match.score || match.score === "未赛" || !/^\d+-\d+$/.test(match.score)) return "";
  const [homeScore, awayScore] = match.score.split("-").map(Number);
  if (homeScore > awayScore) return match.home;
  if (awayScore > homeScore) return match.away;
  return "平局";
}

function simpleDirectionHit(match, summary) {
  const actual = actualWinner(match);
  if (!actual) return null;
  const text = valueText(summary.winner || summary.win_tendency || summary.full_time || summary.fullTime, "");
  if (!text) return { hit: false, note: "模型未给胜平负方向" };
  if (actual === "平局") return { hit: /平|draw/i.test(text), note: `真实结果：${actual}` };
  return { hit: text.includes(actual), note: `真实结果：${actual}` };
}

function renderPredictionSummary(prediction) {
  const summary = normalizePredictionSummary(prediction);
  const scoreDetail = scoreMatchEvidence(getSelectedMatch());
  const winner = summary.winner || summary.win_tendency || summary.full_time?.winner || summary.full_time?.tendency;
  const confidence = summary.confidence || summary.confidence_score || summary.source_reliability?.confidence || "模型未给出明确信心程度";
  const situation = summaryText(summary.full_time || summary.fullTime || summary.situation || summary.key_evidence, "模型未给出整场局势摘要。");
  const firstHalf = summaryText(summary.first_half || summary.firstHalf, "上半场走势待补充。");
  const goals = valueText(summary.total_goals || summary.goals || summary.goal_line || summary.over_under || summary.market_check?.total_goals, "未明确");
  const halfFull = valueText(summary.half_full || summary.halfFull || summary.ht_ft || summary.entertainment_top3?.[0]?.half_full || summary.entertainmentTop3?.[0]?.halfFull, "未明确");
  const scorePick = valueText(summary.score || summary.score_range || summary.scoreRange || summary.entertainment_top3?.[0]?.score || summary.entertainmentTop3?.[0]?.score, "未明确");
  return `
    <section class="prediction-brief">
      <span>整场局势预测分析</span>
      <strong>${situation}</strong>
      <p><b>上半场：</b>${firstHalf}</p>
    </section>
    <div class="prediction-summary-grid">
      <article class="result-card accent">
        <span>胜平负</span>
        <strong>${valueText(winner, "模型未给出明确胜负倾向")}</strong>
        <p><b class="score-chip">信心 ${percentText(confidence, `${scoreDetail.confidenceScore}%`)}</b></p>
      </article>
      <article class="result-card">
        <span>进球数</span>
        <strong>${goals}</strong>
        <p>只展示模型给出的真实判断，不展示硬编码评分。</p>
      </article>
      <article class="result-card">
        <span>比分</span>
        <strong>${scorePick}</strong>
        <p>娱乐参考，不作为投资建议</p>
      </article>
      <article class="result-card wide">
        <span>半全场</span>
        <strong>${halfFull}</strong>
        <p>${firstHalf}</p>
      </article>
    </div>
  `;
}

function renderScripts(match) {
  if (!el.script) return;
  el.script.innerHTML = `<div class="empty-state">走势推演由大模型预测生成，当前为空。</div>`;
}

function renderFactors(match) {
  if (!el.factors) return;
  el.factors.innerHTML = `<div class="empty-state">模型证据、信息缺口和来源可信度会在生成预测后展示。</div>`;
}

function renderTacticalProfile(match) {
  if (!el.tacticalProfilePanel) return;
  const prediction = predictionFor(match);
  const summary = prediction ? normalizePredictionSummary(prediction) : {};
  el.tacticalProfilePanel.innerHTML = `
    <div class="section-head compact">
      <div>
        <span class="muted-label">独立模块</span>
        <h2>技战术画像</h2>
      </div>
      <a class="tag link-tag" href="teams.html?match=${encodeURIComponent(match.id)}">查看球队资料</a>
    </div>
    <div class="tactical-clean-grid">
      <article>
        <span>球队技战术</span>
        <p>${valueText(summary.tactical_profile || summary.tacticalProfile, "暂无模型生成的技战术画像。")}</p>
      </article>
      <article>
        <span>关键球员功能</span>
        <p>${valueText(summary.player_functions || summary.playerFunctions, "暂无模型生成的球员功能拆解。")}</p>
      </article>
      <article>
        <span>双方对位</span>
        <p>${valueText(summary.matchup || summary.matchup_analysis || summary.matchupAnalysis, "暂无模型生成的双方对位分析。")}</p>
      </article>
    </div>
  `;
}

function renderPrematchInfo(info) {
  if (!el.prematchPanel) return;
  if (!info) {
    el.prematchPanel.innerHTML = `<div class="empty-state">点击“更新”检查 Reuters / AP / FIFA / Guardian / BBC / Sky / ESPN / The Analyst 与官方社媒入口。</div>`;
    return;
  }
  const accessible = (info.items || []).filter((item) => item.status === "checked");
  const manual = (info.items || []).filter((item) => item.status === "manual");
  const unavailable = (info.items || []).filter((item) => item.status === "unavailable");
  el.prematchPanel.innerHTML = `
    <section class="prematch-summary ${info.changed ? "changed" : ""}">
      <strong>${info.changed ? "✅ 更新内容摘要" : "赛前信息已检查"}</strong>
      <p>${escapeHtml(info.summary)}</p>
      <span>${escapeHtml(info.phase?.label || "赛前信息检查")} · ${new Date(info.checkedAt).toLocaleString("zh-CN", { hour12: false })}</span>
    </section>
    <div class="prematch-focus">
      ${(info.focus || []).map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
    </div>
    <div class="source-health">
      <b>可访问 ${accessible.length}</b>
      <b>需登录/人工核验 ${manual.length}</b>
      <b>暂不可抓取 ${unavailable.length}</b>
    </div>
    <div class="prematch-source-grid">
      ${(info.items || []).map((item) => `
        <article class="source-${escapeHtml(item.status)}">
          <div>
            <span>${escapeHtml(item.tier)}</span>
            <strong>${escapeHtml(item.name)}</strong>
          </div>
          <p>${escapeHtml(item.note)}</p>
          <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${item.status === "checked" ? "打开来源" : "查看配置/入口"}</a>
        </article>
      `).join("")}
    </div>
  `;
}

async function switchMatchDay(days) {
  const baseDate = state.dateStart || formatIsoDate();
  const nextDate = addDays(baseDate, days);
  state.dateStart = nextDate;
  state.dateEnd = nextDate;
  if (el.dateStart) el.dateStart.value = nextDate;
  if (el.dateEnd) el.dateEnd.value = nextDate;
  try {
    await refreshScoreboards();
  } catch {
    // Keep local cached matches visible if the live service is temporarily unavailable.
  }
  const firstMatch = visibleMatches()[0];
  if (firstMatch) state.selectedId = firstMatch.id;
  render();
}

async function updatePrematchInfoForSelectedMatch() {
  const match = getSelectedMatch();
  if (!match || !el.prematchPanel) return;
  const originalText = el.prematchUpdate?.textContent || "更新";
  if (el.prematchUpdate) {
    el.prematchUpdate.disabled = true;
    el.prematchUpdate.textContent = "更新中";
  }
  el.prematchPanel.innerHTML = `<div class="empty-state">正在检查赛前信息源，优先验证官方、通讯社、主流媒体和数据入口...</div>`;
  try {
    const response = await fetch("/api/prematch-update", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ match })
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const info = await response.json();
    state.prematchInfoByMatch[match.id] = info;
    renderPrematchInfo(info);
  } catch (error) {
    el.prematchPanel.innerHTML = `
      <div class="empty-state">
        赛前信息更新失败：${escapeHtml(error.message)}。如果是 HTTP 404，说明当前后端进程仍是旧版本，需要重启服务。
      </div>
    `;
  } finally {
    if (el.prematchUpdate) {
      el.prematchUpdate.disabled = false;
      el.prematchUpdate.textContent = originalText;
    }
  }
}

function render() {
  dedupeMatchesByKey();
  ensureUsableFilter();
  const visible = visibleMatches();
  if (pageMode === "match-list" && visible.length && !visible.some((item) => item.id === state.selectedId)) {
    state.selectedId = visible[0].id;
  }
  if (el.dateStart) el.dateStart.value = state.dateStart;
  if (el.dateEnd) el.dateEnd.value = state.dateEnd;
  const match = getSelectedMatch();
  localStorage.setItem("selectedMatchId", match.id);
  renderMatchList();
  renderHero(match);
  renderVerdicts(match);
  renderScripts(match);
  renderFactors(match);
  renderTacticalProfile(match);
  renderPrematchInfo(state.prematchInfoByMatch[match.id] || null);
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

el.list?.addEventListener("click", (event) => {
  const card = event.target.closest("[data-match-id]");
  if (!card) return;
  state.selectedId = card.dataset.matchId;
  localStorage.setItem("selectedMatchId", state.selectedId);
  if (pageMode === "match-list") {
    window.location.href = `match.html?match=${encodeURIComponent(state.selectedId)}`;
    return;
  }
  render();
});

el.applyDate?.addEventListener("click", applyDateRange);

el.prevMatchDay?.addEventListener("click", () => switchMatchDay(-1));

el.nextMatchDay?.addEventListener("click", () => switchMatchDay(1));

el.prematchUpdate?.addEventListener("click", updatePrematchInfoForSelectedMatch);

el.sortMode?.addEventListener("change", () => {
  state.sortMode = el.sortMode.value;
  render();
});

el.predictionResult?.addEventListener("click", async (event) => {
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

readMatchCache();
render();
loadPredictions()
  .then(refreshScoreboards)
  .finally(render);
setInterval(() => {
  refreshScoreboards().catch(() => {});
  loadPredictions().then(render).catch(() => {});
}, 30 * 1000);
setInterval(() => {
  loadPredictions().then(render).catch(() => {});
}, 5 * 1000);

async function loadPredictions() {
  if (!window.location.protocol.startsWith("http")) return;
  const response = await fetch("/api/predictions");
  if (response.ok) state.predictions = await response.json();
}

async function refreshScoreboards() {
  if (!window.location.protocol.startsWith("http")) return;
  const [start, end] = normalizeDateRange(state.dateStart || formatIsoDate(), state.dateEnd || state.dateStart || formatIsoDate());
  const response = await fetch(`/api/matches?start=${start}&end=${end}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload = await response.json();
  const matches = payload.matches || [];
  mergeServerMatches(matches);
  writeMatchCache(matches);
}
