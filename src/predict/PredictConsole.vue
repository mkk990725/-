<template>
  <n-config-provider>
    <n-message-provider>
      <main class="page-shell">
        <header class="navbar">
          <a class="brand" href="/index.html">智能体工作台</a>
          <div class="nav-right">
            <a href="/index.html" class="home-link">返回主界面</a>
            <span class="status-dot"></span>
            <span class="status-text">运行中</span>
          </div>
        </header>

        <div class="layout">
          <aside class="sidebar">
            <div class="brand-block">
              <div class="brand-mark">AI</div>
              <div>
                <h1>赛前分析台</h1>
                <p>世界杯赛程 · 预测工作台</p>
              </div>
            </div>
            <nav class="side-nav" aria-label="主导航">
              <a href="/index.html">比赛分析</a>
              <a href="/config.html">模型配置</a>
              <a class="active" href="/predict.html">预测模块</a>
              <a href="/teams.html">球队资料</a>
              <a href="/skills.html">分析技能</a>
            </nav>
          </aside>

          <section class="main-content">
            <n-card class="glass-card control-card" :bordered="false">
              <template #header>
                <div class="card-title">
                  <span>AI智能体任务处理监控台</span>
                  <n-tag type="info" round>Vue 3 / Vite / Naive UI</n-tag>
                </div>
              </template>

              <n-grid :cols="24" :x-gap="14" :y-gap="14" responsive="screen">
                <n-grid-item :span="24" :m="7">
                  <n-form-item label="比赛日期">
                    <div class="date-row">
                      <n-button secondary @click="shiftDate(-1)">‹</n-button>
                      <input
                        v-model="selectedDate"
                        type="date"
                        class="date-picker native-control"
                        @change="loadMatches"
                      />
                      <n-button secondary @click="shiftDate(1)">›</n-button>
                    </div>
                  </n-form-item>
                </n-grid-item>

                <n-grid-item :span="24" :m="17">
                  <n-form-item label="比赛">
                    <select v-model="selectedMatchKey" class="match-select native-control">
                      <option value="" disabled>请选择比赛</option>
                      <option v-for="match in matches" :key="match.key" :value="match.key">
                        {{ match.kickoffTime }} · {{ match.home }} vs {{ match.away }}
                      </option>
                    </select>
                  </n-form-item>
                </n-grid-item>
              </n-grid>

              <div class="button-row">
                <button
                  id="startButton"
                  type="button"
                  class="primary-run-button"
                  :disabled="!selectedMatch || running"
                  @click="runTask"
                >
                  {{ buttonText }}
                </button>
                <button
                  type="button"
                  class="codex-mini-button"
                  :disabled="!selectedMatch || running"
                  @click="runCodexPackage"
                >
                  使用 Codex 大脑
                </button>
              </div>

              <div v-if="errorNotice" class="feedback-banner feedback-error">
                <span>!</span>
                <p>{{ errorNotice }}</p>
              </div>

              <div class="stepper">
                <div
                  v-for="(step, index) in steps"
                  :key="step"
                  class="step"
                  :class="{ completed: completedSteps > index }"
                >
                  {{ step }}
                </div>
              </div>

              <section ref="logPanel" class="log-area">
                <div v-for="entry in logs" :key="entry.id">[{{ entry.time }}] {{ entry.text }}</div>
              </section>
            </n-card>

            <n-card v-if="prediction" class="glass-card result-card" :bordered="false">
              <template #header>预测结果</template>
              <section class="situation-summary">
                <span>整场局势预测分析</span>
                <strong>{{ resultSituation }}</strong>
                <p>{{ resultEvidence }}</p>
              </section>

              <div class="prediction-units">
                <article>
                  <span>胜平负</span>
                  <strong>{{ resultWinner }}</strong>
                  <p>{{ resultConfidence }}</p>
                </article>
                <article>
                  <span>进球数</span>
                  <strong>{{ resultGoals }}</strong>
                  <p>{{ resultAnalyzable }}</p>
                </article>
                <article>
                  <span>半全场</span>
                  <strong>{{ resultHalfFull }}</strong>
                  <p>{{ resultFirstHalf }}</p>
                </article>
                <article>
                  <span>比分</span>
                  <strong>{{ resultScore }}</strong>
                  <p>娱乐参考，不作为投资建议</p>
                </article>
              </div>

              <div class="layered-units">
                <article v-for="item in layeredItems" :key="item.title">
                  <span>{{ item.title }}</span>
                  <strong>{{ item.value }}</strong>
                </article>
              </div>

              <div ref="chartEl" class="chart"></div>

              <section class="visible-reasoning">
                <h3>分析过程</h3>
                <p>{{ resultReasoning }}</p>
              </section>
            </n-card>

            <n-card v-if="codexPackage" class="glass-card result-card" :bordered="false">
              <template #header>Codex 大脑分析包</template>
              <section class="situation-summary">
                <span>当前状态</span>
                <strong>已整理输入，等待当前 Codex 对话执行分析</strong>
                <p>网页不能直接调用你正在聊天的 Codex 会话，所以这里不再伪装成预测结果。真正的张路式判断需要在当前对话里基于这份输入继续分析。</p>
              </section>
              <section class="visible-reasoning">
                <h3>可见处理过程</h3>
                <p>{{ codexPackage.process }}</p>
              </section>
              <details class="package-details">
                <summary>查看给 Codex 的分析输入</summary>
                <pre>{{ codexPackage.prompt }}</pre>
              </details>
            </n-card>
          </section>
        </div>
      </main>
    </n-message-provider>
  </n-config-provider>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref } from "vue";
import { createDiscreteApi } from "naive-ui";
import * as echarts from "echarts";

const { message } = createDiscreteApi(["message"]);
const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000;
const steps = ["①连接知识库", "②检索信息", "③推理分析", "④生成回复"];

const teamNameZh = {
  Argentina: "阿根廷",
  Australia: "澳大利亚",
  Brazil: "巴西",
  Croatia: "克罗地亚",
  England: "英格兰",
  Ghana: "加纳",
  Iraq: "伊拉克",
  Norway: "挪威",
  Portugal: "葡萄牙",
  Spain: "西班牙",
  Turkey: "土耳其",
  Türkiye: "土耳其",
  Uruguay: "乌拉圭",
  "Congo DR": "刚果（金）",
  "United States": "美国"
};

const selectedDate = ref(currentBeijingIsoDate());
const selectedMatchKey = ref("");
const matches = ref([]);
const logs = ref([]);
const completedSteps = ref(0);
const running = ref(false);
const buttonText = ref("开始处理");
const prediction = ref(null);
const codexPackage = ref(null);
const errorNotice = ref("");
const logPanel = ref(null);
const chartEl = ref(null);
let chart;
let jobTimer;

const selectedMatch = computed(() => matches.value.find((match) => match.key === selectedMatchKey.value));
const resultWinner = computed(() => valueText(prediction.value?.winner || prediction.value?.win_tendency || prediction.value?.full_time?.winner || prediction.value?.full_time?.tendency, "未明确"));
const resultConfidence = computed(() => valueText(prediction.value?.confidence || prediction.value?.confidence_score || prediction.value?.source_reliability?.confidence, "未明确"));
const resultAnalyzable = computed(() => prediction.value?.is_analyzable === false ? "建议跳过" : "可分析 / 谨慎观察");
const resultSituation = computed(() => summarizeText(prediction.value?.full_time || prediction.value?.fullTime || prediction.value?.situation || prediction.value?.key_evidence, "模型未给出整场局势摘要。"));
const resultEvidence = computed(() => summarizeText(prediction.value?.key_evidence || prediction.value?.evidence || prediction.value?.filter_reason, "暂无明确关键依据。"));
const resultFirstHalf = computed(() => summarizeText(prediction.value?.first_half || prediction.value?.firstHalf, "暂无明确上半场走势。"));
const resultGoals = computed(() => valueText(prediction.value?.total_goals || prediction.value?.goals || prediction.value?.goal_line || prediction.value?.over_under || prediction.value?.market_check?.total_goals, "未明确"));
const resultHalfFull = computed(() => valueText(prediction.value?.half_full || prediction.value?.halfFull || prediction.value?.ht_ft || prediction.value?.entertainment_top3?.[0]?.half_full || prediction.value?.entertainmentTop3?.[0]?.halfFull, "未明确"));
const resultScore = computed(() => valueText(prediction.value?.score || prediction.value?.score_range || prediction.value?.scoreRange || prediction.value?.entertainment_top3?.[0]?.score || prediction.value?.entertainmentTop3?.[0]?.score, "未明确"));
const resultReasoning = computed(() => summarizeText(
  prediction.value?.reasoning
    || prediction.value?.analysis_process
    || prediction.value?.key_evidence
    || prediction.value?.evidence,
  "本次结果没有返回可展示的分析过程。"
));
const optionLayers = computed(() => prediction.value?.option_layers || prediction.value?.optionLayers || {});
const layeredItems = computed(() => [
  {
    title: "比赛筛选",
    value: valueText(prediction.value?.match_filter || prediction.value?.matchFilter || prediction.value?.filter_reason, "模型未给出比赛筛选")
  },
  {
    title: "主选",
    value: valueText(optionLayers.value.main_pick || optionLayers.value.mainPick || optionLayers.value.primary || optionLayers.value.main, "未给出主选")
  },
  {
    title: "次选",
    value: valueText(optionLayers.value.secondary_pick || optionLayers.value.secondaryPick || optionLayers.value.secondary, "未给出次选")
  },
  {
    title: "小防",
    value: valueText(optionLayers.value.small_hedge || optionLayers.value.smallHedge || optionLayers.value.hedge, "未给出小防")
  },
  {
    title: "不建议",
    value: valueText(optionLayers.value.avoid_pick || optionLayers.value.avoidPick || optionLayers.value.avoid, "未给出不建议选项")
  },
  {
    title: "成本效率",
    value: valueText(prediction.value?.cost_efficiency || prediction.value?.costEfficiency, "未给出成本效率")
  }
]);

function zhTeam(name) {
  return teamNameZh[name] || name || "待确认";
}

function timestamp() {
  return new Date().toLocaleTimeString("zh-CN", { hour12: false });
}

function currentBeijingIsoDate() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Shanghai" });
}

function log(text) {
  logs.value.push({ id: `${Date.now()}-${logs.value.length}`, time: timestamp(), text });
  nextTick(() => {
    if (logPanel.value) logPanel.value.scrollTop = logPanel.value.scrollHeight;
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function addDays(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatDateKey(date = new Date()) {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
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
  return new Date(new Date(isoDateTime).getTime() + BEIJING_OFFSET_MS).toISOString().slice(0, 10);
}

function beijingTimeFromIso(isoDateTime) {
  const shifted = new Date(new Date(isoDateTime).getTime() + BEIJING_OFFSET_MS);
  return `${shifted.toISOString().slice(0, 10)} ${String(shifted.getUTCHours()).padStart(2, "0")}:${String(shifted.getUTCMinutes()).padStart(2, "0")} 北京时间`;
}

function matchKey(match) {
  return `${match.date}|${[match.home, match.away].sort((a, b) => a.localeCompare(b, "zh-CN")).join("|")}`;
}

function eventToMatch(event) {
  const competition = event.competitions?.[0] || {};
  const competitors = competition.competitors || [];
  const home = competitors.find((item) => item.homeAway === "home") || competitors[0];
  const away = competitors.find((item) => item.homeAway === "away") || competitors[1];
  const match = {
    id: `espn-${event.id}`,
    date: beijingDateFromIso(event.date),
    kickoffTime: beijingTimeFromIso(event.date),
    group: competition.altGameNote?.replace("FIFA World Cup, ", "") || "世界杯",
    venue: competition.venue?.fullName || competition.venue?.displayName || "待确认球场",
    home: zhTeam(home?.team?.displayName),
    away: zhTeam(away?.team?.displayName),
    score: "未赛",
    status: "synced"
  };
  return { ...match, key: matchKey(match) };
}

async function loadMatches() {
  if (!selectedDate.value) return;
  const previousKey = selectedMatchKey.value;
  errorNotice.value = "";
  const response = await fetch(`/api/matches?start=${selectedDate.value}&end=${selectedDate.value}`);
  if (!response.ok) throw new Error(`赛程接口 HTTP ${response.status}`);
  const payload = await response.json();
  matches.value = (payload.matches || [])
    .map((match) => ({ ...match, key: match.key || matchKey(match) }))
    .sort((a, b) => a.kickoffTime.localeCompare(b.kickoffTime));
  selectedMatchKey.value = matches.value.some((match) => match.key === previousKey)
    ? previousKey
    : matches.value[0]?.key || "";
}

function shiftDate(days) {
  selectedDate.value = addDays(selectedDate.value, days);
  loadMatches().catch((error) => {
    log(`赛程同步失败：${error.message}`);
    message.error(error.message);
  });
}

function assistantText(payload) {
  const result = payload?.saved?.result || payload?.result || payload;
  return result?.choices?.[0]?.message?.content || result?.choices?.[0]?.text || result?.output_text || "";
}

function parsePrediction(payload) {
  if (payload.mode === "prompt-only") {
    return {
      information_gaps: payload.warning,
      key_evidence: payload.prompt,
      is_analyzable: false
    };
  }
  if (payload.saved?.summary) return normalizePredictionSummary(payload.saved.summary);
  const text = assistantText(payload);
  try {
    return normalizePredictionSummary(JSON.parse(text));
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return normalizePredictionSummary(JSON.parse(match[0]));
      } catch {}
    }
  }
  return { key_evidence: text || valueText(payload) };
}

function normalizePredictionSummary(summary) {
  const text = assistantText(summary) || assistantText(summary?.result) || summary?.rawText;
  if (text) {
    try {
      return JSON.parse(text);
    } catch {
      const match = String(text).match(/\{[\s\S]*\}/);
      if (match) {
        try {
          return JSON.parse(match[0]);
        } catch {}
      }
    }
  }
  return summary || {};
}

function valueText(value, fallback = "未返回明确结论") {
  if (value === null || value === undefined || value === "") return fallback;
  if (Array.isArray(value)) return value.map((item) => valueText(item, "")).filter(Boolean).join("；");
  if (typeof value === "object") {
    if (value.summary || value.text || value.result || value.reason || value.tendency) {
      return value.summary || value.text || value.result || value.reason || value.tendency;
    }
    return Object.entries(value)
      .filter(([, item]) => item !== null && item !== undefined && item !== "")
      .map(([key, item]) => `${key}：${valueText(item, "")}`)
      .join("；") || fallback;
  }
  return String(value);
}

function summarizeText(value, fallback = "未返回明确结论") {
  const text = valueText(value, fallback);
  if (text === fallback) return text;
  return text.length > 120 ? `${text.slice(0, 120)}...` : text;
}

function confidenceNumber() {
  const raw = prediction.value?.confidence_score || prediction.value?.confidence || 50;
  const num = Number(String(raw).replace(/[^\d.]/g, ""));
  return Number.isFinite(num) ? Math.max(0, Math.min(100, num)) : 50;
}

function renderChart() {
  if (!chartEl.value) return;
  chart = chart || echarts.init(chartEl.value);
  chart.setOption({
    backgroundColor: "transparent",
    radar: {
      indicator: [
        { name: "来源", max: 100 },
        { name: "战术", max: 100 },
        { name: "球员", max: 100 },
        { name: "赛程", max: 100 },
        { name: "市场", max: 100 }
      ],
      axisName: { color: "#6b7688" },
      splitLine: { lineStyle: { color: "rgba(101,119,143,.22)" } },
      splitArea: { areaStyle: { color: ["rgba(47,111,236,.06)", "rgba(245,247,251,.75)"] } },
      axisLine: { lineStyle: { color: "rgba(101,119,143,.22)" } }
    },
    series: [{
      type: "radar",
      data: [{ value: [confidenceNumber(), 62, 58, 55, 45], name: "预测依据强度" }],
      areaStyle: { color: "rgba(47,111,236,.18)" },
      lineStyle: { color: "#2f6fec" },
      itemStyle: { color: "#2f6fec" }
    }]
  });
}

async function runTask() {
  if (!selectedMatch.value) return;
  const taskMatchKey = selectedMatchKey.value;
  const taskMatch = { ...selectedMatch.value };
  running.value = true;
  buttonText.value = "后台处理中...";
  completedSteps.value = 0;
  logs.value = [];
  prediction.value = null;
  codexPackage.value = null;
  errorNotice.value = "";
  try {
    log("正在提交后台预测任务...");
    completedSteps.value = 1;
    const response = await fetch("/api/predict-task", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ match: taskMatch })
    });
    if (!response.ok) throw new Error(`预测任务接口 HTTP ${response.status}`);
    const job = await response.json();
    localStorage.setItem("footballAgent.activePredictionJob", JSON.stringify({ id: job.id, matchKey: taskMatchKey }));
    log("后台任务已启动，可以切换到主界面或其他页面。");
    selectedMatchKey.value = taskMatchKey;
    completedSteps.value = 2;
    await pollPredictionJob(job.id);
  } catch (error) {
    log(`任务失败：${error.message}`);
    errorNotice.value = error.message;
    message.error(error.message);
    buttonText.value = "重新处理";
  } finally {
    running.value = false;
  }
}

async function pollPredictionJob(id) {
  clearTimeout(jobTimer);
  const response = await fetch(`/api/predict-task?id=${encodeURIComponent(id)}`);
  if (!response.ok) throw new Error(`任务状态接口 HTTP ${response.status}`);
  const job = await response.json();
  for (const entry of job.logs || []) {
    const text = entry.text || "";
    if (text && !logs.value.some((item) => item.text === text)) log(text);
  }
  if (job.status === "running" || job.status === "queued") {
    completedSteps.value = Math.max(2, Math.min(3, Math.ceil((job.progress || 0) / 35)));
    jobTimer = setTimeout(() => pollPredictionJob(id).catch((error) => {
      log(`任务轮询失败：${error.message}`);
      buttonText.value = "重新处理";
      running.value = false;
    }), 2000);
    return;
  }
  if (job.status === "completed") {
    prediction.value = parsePrediction(job.result || {});
    completedSteps.value = 4;
    buttonText.value = "处理完成";
    running.value = false;
    localStorage.removeItem("footballAgent.activePredictionJob");
    await nextTick();
    renderChart();
    message.success("预测完成，结果已同步到比赛分析页。");
    return;
  }
  throw new Error(job.error || "后台任务失败");
}

async function runCodexPackage() {
  if (!selectedMatch.value) return;
  running.value = true;
  buttonText.value = "整理中...";
  completedSteps.value = 0;
  logs.value = [];
  prediction.value = null;
  codexPackage.value = null;
  errorNotice.value = "";
  try {
    log("正在整理当前比赛信息...");
    completedSteps.value = 1;
    const response = await fetch("/api/codex-analysis-package", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ match: selectedMatch.value })
    });
    if (!response.ok) throw new Error(`Codex 分析包接口 HTTP ${response.status}`);
    completedSteps.value = 2;
    log("已读取赛程、球队、可用数据源和分析技能。");
    const payload = await response.json();
    completedSteps.value = 3;
    log("已生成张路式分析输入包：先看技战术和人员功能，再看信息缺口，最后才校验市场。");
    codexPackage.value = {
      process: [
        `比赛：${selectedMatch.value.home} vs ${selectedMatch.value.away}`,
        "处理顺序：官方信息 -> 权威媒体 -> 数据源 -> 技战术画像 -> 球员功能 -> 对位分支。",
        "注意：当前网页不能直接连接这条 Codex 对话，因此不会在页面里编造预测结果。"
      ].join("；"),
      prompt: payload.prompt
    };
    completedSteps.value = 4;
    log("整理完成。需要我在当前对话里继续分析这场比赛时，直接告诉我比赛名称即可。");
    buttonText.value = "处理完成";
  } catch (error) {
    log(`Codex 分析包生成失败：${error.message}`);
    errorNotice.value = error.message;
    message.error(error.message);
    buttonText.value = "重新处理";
  } finally {
    running.value = false;
  }
}

function scrollToLog() {
  logPanel.value?.scrollIntoView({ behavior: "smooth", block: "center" });
}

async function loadHistory() {
  const response = await fetch("/api/predictions");
  if (!response.ok) return;
  const payload = await response.json();
  log(`历史记录读取完成：${Object.keys(payload).length} 条预测索引。`);
}

function restoreActiveJob() {
  try {
    const cached = JSON.parse(localStorage.getItem("footballAgent.activePredictionJob") || "null");
    if (!cached?.id) return;
    running.value = true;
    buttonText.value = "后台处理中...";
    log("已恢复一个后台预测任务，继续监听结果。");
    pollPredictionJob(cached.id).catch((error) => {
      log(`恢复任务失败：${error.message}`);
      running.value = false;
      buttonText.value = "重新处理";
    });
  } catch {}
}

window.addEventListener("resize", () => chart?.resize());
onBeforeUnmount(() => {
  clearTimeout(jobTimer);
  chart?.dispose();
});

loadMatches().catch((error) => {
  log(`赛程同步失败：${error.message}`);
  message.error(error.message);
});
restoreActiveJob();
</script>

<style scoped>
:global(body) {
  margin: 0;
  background: #f9fafb;
  color: #111827;
  font-family:
    Manrope,
    Inter,
    system-ui,
    -apple-system,
    "PingFang SC",
    "Microsoft YaHei",
    sans-serif;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

.page-shell {
  min-height: 100vh;
  background:
    radial-gradient(circle at 12% 8%, rgba(196, 81, 0, 0.08), transparent 28%),
    radial-gradient(circle at 88% 4%, rgba(0, 94, 162, 0.08), transparent 24%),
    #f9fafb;
}

.navbar {
  position: sticky;
  top: 0;
  z-index: 30;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 28px;
  border-bottom: 1px solid rgba(229, 231, 235, 0.78);
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(18px);
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.85) inset;
}

.brand,
.home-link {
  color: #111827;
  text-decoration: none;
  font-weight: 900;
}

.brand {
  letter-spacing: -0.03em;
  font-size: 18px;
}

.home-link {
  min-height: 34px;
  display: inline-flex;
  align-items: center;
  padding: 0 10px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  color: #4b5563;
  background: #fff;
  font-size: 13px;
  box-shadow: 0 8px 24px -20px rgba(28, 28, 25, 0.55);
}

.nav-right {
  display: inline-flex;
  align-items: center;
  gap: 12px;
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #22c55e;
  box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.12);
}

.status-text {
  color: #166534;
  font-weight: 800;
}

.layout {
  display: grid;
  grid-template-columns: 256px minmax(0, 1fr);
  min-height: calc(100vh - 64px);
}

.sidebar {
  padding: 20px 16px;
  border-right: 1px solid #e5e7eb;
  background: rgba(255, 255, 255, 0.78);
  backdrop-filter: blur(18px);
}

.brand-block {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 18px;
  padding-bottom: 16px;
  border-bottom: 1px solid #f0f1f4;
}

.brand-mark {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border-radius: 12px;
  color: #fff;
  background: linear-gradient(145deg, #9c3f00, #c45100);
  box-shadow: 0 14px 32px -22px rgba(156, 63, 0, 0.9);
  font-weight: 900;
}

.brand-block h1 {
  margin: 0;
  font-size: 18px;
  color: #111827;
}

.brand-block p {
  margin: 4px 0 0;
  color: #6b7280;
  font-size: 12px;
}

.side-nav {
  display: grid;
  gap: 6px;
}

.side-nav {
  margin-bottom: 18px;
}

.side-nav a {
  display: flex;
  align-items: center;
  min-height: 40px;
  padding: 0 12px;
  border: 1px solid transparent;
  border-radius: 10px;
  color: #4b5563;
  text-decoration: none;
  font-size: 13px;
  font-weight: 800;
}

.side-nav a.active,
.side-nav a:hover {
  color: #9c3f00;
  border-color: rgba(196, 81, 0, 0.18);
  background: rgba(196, 81, 0, 0.08);
  box-shadow: inset 3px 0 0 rgba(196, 81, 0, 0.78);
}

.main-content {
  padding: 32px;
}

.glass-card {
  border: 1px solid rgba(224, 192, 178, 0.32);
  border-radius: 24px;
  background: #ffffff;
  box-shadow: 0 18px 48px -40px rgba(28, 28, 25, 0.55);
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
}

.glass-card:hover {
  transform: translateY(-1px);
  border-color: rgba(196, 81, 0, 0.22);
  box-shadow: 0 28px 70px -50px rgba(28, 28, 25, 0.68);
}

:deep(.n-card) {
  color: #172033;
}

:deep(.n-card-header) {
  padding-bottom: 12px;
}

:deep(.n-card-header__main) {
  font-weight: 800;
  letter-spacing: -0.02em;
}

:deep(.n-form-item-label__text) {
  color: #6b7688;
  font-size: 13px;
  font-weight: 800;
}

:deep(.n-card--embedded) {
  border: 1px solid #dce4ee;
  border-radius: 12px;
  background: #f8fafc;
  box-shadow: none;
}

:deep(.n-statistic .n-statistic-value) {
  color: #172033;
  font-weight: 850;
}

:deep(.n-statistic .n-statistic-label) {
  color: #6b7688;
  font-weight: 700;
}

.control-card,
.result-card {
  max-width: 1040px;
  margin: 0 auto 20px;
}

.card-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.date-row {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) 42px;
  gap: 8px;
}

.date-picker {
  width: 100%;
}

.native-control {
  min-height: 42px;
  border: 1px solid #d1d5db;
  border-radius: 12px;
  color: #111827;
  background: #ffffff;
  padding: 0 12px;
  font: inherit;
  outline: none;
}

.native-control:hover,
.native-control:focus {
  border-color: #d47030;
  box-shadow: 0 0 0 4px rgba(196, 81, 0, 0.1);
}

.match-select {
  width: 100%;
}

.match-select option {
  color: #172033;
  background: #ffffff;
}

.button-row {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  margin: 24px 0;
}

.primary-run-button,
.codex-mini-button {
  border: 1px solid transparent;
  border-radius: 10px;
  font: inherit;
  font-weight: 900;
  cursor: pointer;
  transition: transform 0.16s cubic-bezier(0.22, 1, 0.36, 1), border-color 0.16s ease, background 0.16s ease, opacity 0.16s ease, box-shadow 0.16s ease;
}

.primary-run-button {
  min-width: 168px;
  min-height: 46px;
  padding: 0 26px;
  color: #ffffff;
  border-color: #c45100;
  border-radius: 12px;
  background: linear-gradient(135deg, #9c3f00, #c45100);
  box-shadow: 0 16px 32px -22px rgba(156, 63, 0, 0.85);
}

.codex-mini-button {
  min-height: 42px;
  padding: 0 16px;
  color: #005ea2;
  border-color: rgba(0, 94, 162, 0.22);
  border-radius: 12px;
  background: #f0f7ff;
  font-size: 13px;
}

.primary-run-button:hover:not(:disabled),
.codex-mini-button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 18px 38px -26px rgba(156, 63, 0, 0.72);
}

.primary-run-button:focus-visible,
.codex-mini-button:focus-visible,
.home-link:focus-visible,
.native-control:focus-visible {
  outline: none;
  box-shadow: 0 0 0 4px rgba(196, 81, 0, 0.14);
}

.primary-run-button:disabled,
.codex-mini-button:disabled {
  cursor: not-allowed;
  opacity: 0.52;
  box-shadow: none;
}

.stepper {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  margin: 18px 0;
}

.step {
  padding: 13px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  color: #6b7280;
  background: #f9fafb;
  text-align: center;
  font-weight: 900;
}

.step.completed {
  color: #9c3f00;
  border-color: rgba(196, 81, 0, 0.28);
  background: #fff7ed;
}

.log-area {
  height: 200px;
  overflow-y: auto;
  padding: 14px;
  border: 1px solid #111827;
  border-radius: 12px;
  background: #111827;
  color: #e5e7eb;
  font: 13px/1.7 Consolas, "SFMono-Regular", monospace;
}

.feedback-banner {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  max-width: 720px;
  margin: -8px auto 18px;
  padding: 12px 14px;
  border-radius: 14px;
  font-size: 13px;
  line-height: 1.55;
}

.feedback-banner span {
  display: inline-grid;
  place-items: center;
  flex: 0 0 auto;
  width: 22px;
  height: 22px;
  border-radius: 999px;
  font-weight: 900;
}

.feedback-banner p {
  margin: 0;
}

.feedback-error {
  color: #991b1b;
  border: 1px solid #fecaca;
  background: #fef2f2;
}

.feedback-error span {
  color: #fff;
  background: #dc2626;
}

.source-list {
  margin-top: 14px;
}

.chart {
  width: 100%;
  height: 320px;
  margin-top: 18px;
}

.situation-summary {
  padding: 16px;
  border: 1px solid rgba(196, 81, 0, 0.16);
  border-radius: 18px;
  background: #fff7ed;
}

.situation-summary span,
.prediction-units span,
.layered-units span {
  display: block;
  color: #6b7280;
  font-size: 12px;
  font-weight: 850;
}

.situation-summary strong {
  display: block;
  margin-top: 8px;
  color: #111827;
  font-size: 20px;
  line-height: 1.35;
}

.situation-summary p,
.prediction-units p {
  margin: 8px 0 0;
  color: #6b7280;
  font-size: 13px;
  line-height: 1.55;
}

.prediction-units,
.layered-units {
  display: grid;
  gap: 12px;
  margin-top: 14px;
}

.prediction-units {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.layered-units {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.prediction-units article,
.layered-units article {
  min-height: 118px;
  padding: 14px;
  border: 1px solid #e5e7eb;
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 2px 8px rgba(26, 39, 69, 0.05);
}

.prediction-units strong,
.layered-units strong {
  display: block;
  margin-top: 8px;
  color: #111827;
  font-size: 18px;
  line-height: 1.3;
  overflow-wrap: anywhere;
}

.layered-units article {
  min-height: 96px;
  background: #f8fbff;
}

.layered-units strong {
  font-size: 15px;
}

.visible-reasoning,
.package-details {
  margin-top: 16px;
  padding: 16px;
  border: 1px solid #e5e7eb;
  border-radius: 18px;
  background: #f9fafb;
}

.visible-reasoning h3 {
  margin: 0 0 8px;
  color: #111827;
  font-size: 16px;
}

.visible-reasoning p {
  margin: 0;
  color: #4b5563;
  line-height: 1.7;
}

.package-details summary {
  color: #9c3f00;
  font-weight: 900;
  cursor: pointer;
}

.package-details pre {
  max-height: 420px;
  overflow: auto;
  margin: 12px 0 0;
  padding: 14px;
  border-radius: 10px;
  color: #172033;
  background: #fff;
  white-space: pre-wrap;
  font: 13px/1.6 "Consolas", "Microsoft YaHei", monospace;
}

.prematch-summary {
  padding: 16px;
  border: 1px solid #dce4ee;
  border-radius: 14px;
  background: #f8fafc;
}

.prematch-summary.changed {
  border-color: #bbf7d0;
  background: #f0fdf4;
}

.prematch-summary strong {
  display: block;
  color: #172033;
  font-size: 18px;
}

.prematch-summary p {
  margin: 8px 0;
  color: #334155;
  line-height: 1.6;
}

.prematch-summary span {
  color: #6b7688;
  font-size: 12px;
  font-weight: 700;
}

.prematch-focus {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 14px 0;
}

.prematch-focus span {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 10px;
  border-radius: 999px;
  color: #2f6fec;
  background: #eef4ff;
  font-size: 12px;
  font-weight: 800;
}

.prematch-source-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.prematch-source-grid article {
  display: grid;
  gap: 8px;
  padding: 14px;
  border: 1px solid #dce4ee;
  border-radius: 14px;
  background: #fff;
}

.prematch-source-grid article.source-manual {
  background: #fff7ed;
}

.prematch-source-grid article.source-unavailable {
  background: #fff7f6;
}

.prematch-source-grid article.source-checked {
  background: #f8fbff;
}

.prematch-source-grid span {
  color: #6b7688;
  font-size: 12px;
  font-weight: 800;
}

.prematch-source-grid strong {
  display: block;
  margin-top: 4px;
  color: #172033;
  font-size: 14px;
}

.prematch-source-grid p {
  margin: 0;
  color: #6b7688;
  font-size: 13px;
  line-height: 1.5;
}

.prematch-source-grid a {
  color: #2f6fec;
  font-size: 13px;
  font-weight: 800;
  text-decoration: none;
}

@media (max-width: 860px) {
  .layout {
    grid-template-columns: 1fr;
  }

  .sidebar {
    border-right: 0;
    border-bottom: 1px solid #dce4ee;
  }

  .brand-block {
    display: none;
  }

  .side-nav {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }

  .side-nav {
    margin-bottom: 10px;
  }

  .side-nav a {
    justify-content: center;
  }

  .main-content {
    padding: 18px;
  }

  .button-row,
  .card-title {
    align-items: stretch;
    flex-direction: column;
  }

  .stepper,
  .prediction-units,
  .layered-units,
  .prematch-source-grid {
    grid-template-columns: 1fr;
  }
}
</style>
