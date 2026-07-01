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
  const teams = [match.home, match.away].map((team) => String(team || "").trim()).sort((a, b) => a.localeCompare(b, "zh-CN"));
  return `${match.date}|${teams[0]}|${teams[1]}`;
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
  const merged = new Map();
  [...window.WORLD_CUP_FIXTURES, ...matches].forEach((incoming) => {
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
  mergeMatches([]);
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
  const match = window.WORLD_CUP_FIXTURES.find((item) => item.id === predictMatch.value);
  if (match) localStorage.setItem("selectedMatchId", match.id);
  return match;
}

function setProgress(lines) {
  predictResult.innerHTML = `
    <div class="progress-log">
      ${lines.map((line) => `<div>${escapeHtml(line)}</div>`).join("")}
    </div>
  `;
}

function appendProgress(lines, line) {
  lines.push(line);
  setProgress(lines);
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function assistantText(payload) {
  const result = payload?.saved?.result || payload?.result || payload;
  return result?.choices?.[0]?.message?.content
    || result?.choices?.[0]?.text
    || result?.output_text
    || "";
}

function parsePredictionObject(payload) {
  if (payload?.mode === "prompt-only") return null;
  const text = assistantText(payload);
  if (!text) return payload?.saved || payload?.result || payload;
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return { rawText: text };
    try {
      return JSON.parse(match[0]);
    } catch {
      return { rawText: text };
    }
  }
}

function valueText(value, fallback = "待模型给出") {
  if (value === null || value === undefined || value === "") return fallback;
  if (Array.isArray(value)) return value.map((item) => typeof item === "object" ? JSON.stringify(item) : item).join("；");
  if (typeof value === "object") return value.summary || value.text || value.result || JSON.stringify(value);
  return String(value);
}

function confidenceText(prediction) {
  return valueText(
    prediction.confidence
      || prediction.confidence_score
      || prediction.source_reliability?.confidence
      || prediction.uncertainty?.confidence,
    "模型未给出明确信心程度"
  );
}

function renderTop3(items) {
  const list = Array.isArray(items) ? items.slice(0, 3) : [];
  if (!list.length) return `<div class="empty-state">模型没有给出娱乐比分前三项。</div>`;
  return `
    <div class="entertainment-grid">
      ${list.map((item, index) => `
        <div class="mini-prediction-card">
          <span>娱乐 ${index + 1}</span>
          <strong>${escapeHtml(valueText(item.score || item.scoreline || item.result, "-"))}</strong>
          <p>${escapeHtml(valueText(item.half_full || item.halfFull || item.ht_ft, "半全场未给出"))}</p>
          <p>${escapeHtml(valueText(item.reason || item.note || item.confidence, ""))}</p>
        </div>
      `).join("")}
    </div>
  `;
}

function renderLayerBlock(title, value, fallback = "模型未给出。") {
  return `
    <article class="result-card">
      <span>${escapeHtml(title)}</span>
      <p>${escapeHtml(valueText(value, fallback))}</p>
    </article>
  `;
}

function renderLayeredPrediction(prediction) {
  const layers = prediction.option_layers || prediction.optionLayers || {};
  const matchFilter = prediction.match_filter || prediction.matchFilter || prediction.filter_reason;
  const portfolio = prediction.portfolio_structure || prediction.portfolioStructure;
  const cost = prediction.cost_efficiency || prediction.costEfficiency;
  const review = prediction.review_checklist || prediction.reviewChecklist;
  return `
    <div class="prediction-section">
      <h3>分层判断</h3>
      <div class="prediction-summary-grid">
        ${renderLayerBlock("比赛筛选", matchFilter, "模型未给出比赛筛选。")}
        ${renderLayerBlock("主选", layers.main_pick || layers.mainPick || layers.primary || layers.main, "未给出主选。")}
        ${renderLayerBlock("次选", layers.secondary_pick || layers.secondaryPick || layers.secondary, "未给出次选。")}
        ${renderLayerBlock("小防", layers.small_hedge || layers.smallHedge || layers.hedge, "未给出小防。")}
        ${renderLayerBlock("不建议", layers.avoid_pick || layers.avoidPick || layers.avoid, "未给出不建议选项。")}
        ${renderLayerBlock("组合结构", portfolio, "未给出主单/保护单/搏冷单结构。")}
        ${renderLayerBlock("成本效率", cost, "未给出成本效率判断。")}
        ${renderLayerBlock("复盘检查点", review, "未给出复盘检查点。")}
      </div>
    </div>
  `;
}

function renderPrediction(payload) {
  if (payload.mode === "prompt-only") {
    predictResult.innerHTML = `
      <div class="info-warning">${escapeHtml(payload.warning)}</div>
      <pre>${escapeHtml(payload.prompt)}</pre>
    `;
    return;
  }
  const prediction = parsePredictionObject(payload);
  if (prediction?.rawText) {
    predictResult.innerHTML = `<pre>${escapeHtml(prediction.rawText)}</pre>`;
    return;
  }
  const sourceCheck = prediction.source_check || prediction.sourceCheck || {};
  const winner = prediction.winner || prediction.win_tendency || prediction.full_time?.winner || prediction.full_time?.tendency;
  predictResult.innerHTML = `
    <div class="prediction-summary-grid">
      <article class="result-card accent">
        <span>胜负倾向</span>
        <strong>${escapeHtml(valueText(winner, "模型未给出明确胜负倾向"))}</strong>
        <p>信心程度：${escapeHtml(confidenceText(prediction))}</p>
      </article>
      <article class="result-card">
        <span>是否可分析</span>
        <strong>${escapeHtml(prediction.is_analyzable === false ? "建议跳过" : "可分析 / 谨慎观察")}</strong>
        <p>${escapeHtml(valueText(prediction.filter_reason, "模型未给出过滤理由"))}</p>
      </article>
      <article class="result-card">
        <span>信息源校验</span>
        <strong>${escapeHtml(valueText(sourceCheck.status || sourceCheck.result, "已纳入校验"))}</strong>
        <p>${escapeHtml(valueText(sourceCheck.summary || prediction.source_reliability, "模型未给出来源摘要"))}</p>
      </article>
    </div>
    <div class="prediction-section">
      <h3>上半场可能走势</h3>
      <p>${escapeHtml(valueText(prediction.first_half || prediction.firstHalf))}</p>
    </div>
    <div class="prediction-section">
      <h3>全场可能走势</h3>
      <p>${escapeHtml(valueText(prediction.full_time || prediction.fullTime))}</p>
    </div>
    <div class="prediction-section">
      <h3>关键依据</h3>
      <p>${escapeHtml(valueText(prediction.key_evidence || prediction.evidence))}</p>
    </div>
    ${renderLayeredPrediction(prediction)}
    <div class="prediction-section">
      <h3>娱乐参考前三项</h3>
      ${renderTop3(prediction.entertainment_top3 || prediction.entertainmentTop3)}
    </div>
  `;
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
  const progress = [];
  appendProgress(progress, "1. 已锁定比赛，开始整理赛程与双方球队。");
  try {
    appendProgress(progress, "2. 正在读取球队资料、球员名单、身高体重、俱乐部和已配置的信息源策略。");
    appendProgress(progress, "3. 正在执行信息源充足性与真实性校验，并准备大模型输入。");
    appendProgress(progress, "4. 正在调用大模型生成预测，请等待响应。");
    const response = await fetch("/api/predict", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ match })
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    appendProgress(progress, "5. 模型响应已返回，正在解析为可读结果。");
    renderPrediction(payload);
  } catch (error) {
    predictResult.innerHTML = `<div class="info-warning">预测失败：${escapeHtml(error.message)}</div>`;
  } finally {
    runPrediction.disabled = false;
    runPrediction.textContent = "生成预测";
  }
}

predictDate.addEventListener("change", refreshOptions);
predictMatch.addEventListener("change", selectedMatch);
runPrediction.addEventListener("click", generatePrediction);

const matchId = getQuery("match");
const initial = window.WORLD_CUP_FIXTURES.find((match) => match.id === matchId);
if (initial) predictDate.value = initial.date;
refreshOptions().then(() => {
  if (initial && matchesForDate(initial.date).some((match) => match.id === initial.id)) {
    predictMatch.value = initial.id;
  }
});
