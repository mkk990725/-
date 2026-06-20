<template>
  <n-config-provider :theme="darkTheme">
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
            <button class="menu-item active" type="button">任务概览</button>
            <button class="menu-item" type="button" @click="scrollToLog">处理日志</button>
            <button class="menu-item" type="button" @click="loadHistory">历史记录</button>
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

            <n-card v-if="sourceNeedsVisible" class="glass-card result-card" :bordered="false">
              <template #header>信息源缺口诊断</template>
              <n-alert type="warning" :bordered="false">
                当前不是“系统找不到所有信息”，而是没有接入这些来源的结构化抓取。需要把下面来源接入为可验证数据层，模型才能降低不确定性。
              </n-alert>
              <n-list class="source-list">
                <n-list-item v-for="item in sourceNeeds" :key="item.title">
                  <n-thing :title="item.title" :description="item.description" />
                </n-list-item>
              </n-list>
            </n-card>

            <n-card v-if="prediction" class="glass-card result-card" :bordered="false">
              <template #header>预测结果</template>
              <n-grid :cols="24" :x-gap="14" :y-gap="14" responsive="screen">
                <n-grid-item :span="24" :m="8">
                  <n-statistic label="胜负倾向" :value="resultWinner" />
                </n-grid-item>
                <n-grid-item :span="24" :m="8">
                  <n-statistic label="信心程度" :value="resultConfidence" />
                </n-grid-item>
                <n-grid-item :span="24" :m="8">
                  <n-statistic label="可分析状态" :value="resultAnalyzable" />
                </n-grid-item>
              </n-grid>

              <div ref="chartEl" class="chart"></div>

              <div class="analysis-grid">
                <n-card embedded title="上半场可能走势">{{ valueText(prediction.first_half || prediction.firstHalf) }}</n-card>
                <n-card embedded title="全场可能走势">{{ valueText(prediction.full_time || prediction.fullTime) }}</n-card>
                <n-card embedded title="关键依据">{{ valueText(prediction.key_evidence || prediction.evidence) }}</n-card>
                <n-card embedded title="球队数据校验">{{ valueText(prediction.team_data_check, "模型未单独给出球队数据校验。") }}</n-card>
                <n-card embedded title="信息源缺口">{{ valueText(prediction.information_gaps || prediction.missing_sources, sourceGapFallback) }}</n-card>
                <n-card embedded title="娱乐参考前三项">
                  <div v-if="top3.length" class="top3">
                    <n-tag v-for="(item, index) in top3" :key="index" type="info">
                      {{ valueText(item.score || item.scoreline || item.result, "-") }} / {{ valueText(item.half_full || item.halfFull || item.ht_ft, "半全场未给出") }}
                    </n-tag>
                  </div>
                  <span v-else>模型没有给出娱乐比分前三项。</span>
                </n-card>
              </div>
            </n-card>
          </section>
        </div>
      </main>
    </n-message-provider>
  </n-config-provider>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref } from "vue";
import { createDiscreteApi, darkTheme } from "naive-ui";
import * as echarts from "echarts";

const { message } = createDiscreteApi(["message"], {
  configProviderProps: {
    theme: darkTheme
  }
});
const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000;
const steps = ["①连接知识库", "②检索信息", "③推理分析", "④生成回复"];
const sourceGapFallback = "需要补 Guardian 直播记录、The Analyst/Opta 文章、FIFA 技术统计和全场录像观察。";

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
const sourceNeedsVisible = ref(true);
const logPanel = ref(null);
const chartEl = ref(null);
let chart;

const sourceNeeds = ref([]);

const matchOptions = computed(() => matches.value.map((match) => ({
  label: `${match.kickoffTime} · ${match.home} vs ${match.away}`,
  value: match.key
})));

const selectedMatch = computed(() => matches.value.find((match) => match.key === selectedMatchKey.value));
const top3 = computed(() => Array.isArray(prediction.value?.entertainment_top3 || prediction.value?.entertainmentTop3)
  ? (prediction.value.entertainment_top3 || prediction.value.entertainmentTop3).slice(0, 3)
  : []);
const resultWinner = computed(() => valueText(prediction.value?.winner || prediction.value?.win_tendency || prediction.value?.full_time?.winner || prediction.value?.full_time?.tendency, "未明确"));
const resultConfidence = computed(() => valueText(prediction.value?.confidence || prediction.value?.confidence_score || prediction.value?.source_reliability?.confidence, "未明确"));
const resultAnalyzable = computed(() => prediction.value?.is_analyzable === false ? "建议跳过" : "可分析 / 谨慎观察");

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

async function loadDataSources() {
  const response = await fetch("/api/data-sources");
  if (!response.ok) return;
  const payload = await response.json();
  sourceNeeds.value = (payload.stableEntrances || []).map((source) => ({
    title: source.name,
    description: `${source.tier} · ${source.url}${source.note ? ` · ${source.note}` : ""}`
  }));
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

function valueText(value, fallback = "待模型给出") {
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
      axisName: { color: "#cbd5e1" },
      splitLine: { lineStyle: { color: "rgba(148,163,184,.25)" } },
      splitArea: { areaStyle: { color: ["rgba(56,189,248,.06)", "rgba(15,23,42,.18)"] } },
      axisLine: { lineStyle: { color: "rgba(148,163,184,.25)" } }
    },
    series: [{
      type: "radar",
      data: [{ value: [confidenceNumber(), 62, 58, 55, 45], name: "预测依据强度" }],
      areaStyle: { color: "rgba(56,189,248,.22)" },
      lineStyle: { color: "#38bdf8" },
      itemStyle: { color: "#38bdf8" }
    }]
  });
}

async function runTask() {
  if (!selectedMatch.value) return;
  const taskMatchKey = selectedMatchKey.value;
  const taskMatch = { ...selectedMatch.value };
  running.value = true;
  buttonText.value = "处理中...";
  completedSteps.value = 0;
  logs.value = [];
  prediction.value = null;
  try {
    await sleep(1500);
    log("正在连接知识库...");
    completedSteps.value = 1;
    await sleep(1500);
    log("正在检索信息：ESPN 赛程、球队名单、已有预测库与信息源缺口...");
    await loadMatches();
    selectedMatchKey.value = taskMatchKey;
    completedSteps.value = 2;
    await sleep(1500);
    log("正在推理分析：检查真实表现质量、机会质量、阵容完整度与战术证据是否缺失...");
    completedSteps.value = 3;
    await sleep(1500);
    log("正在生成回复...");
    const response = await fetch("/api/predict", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ match: taskMatch })
    });
    if (!response.ok) throw new Error(`预测接口 HTTP ${response.status}`);
    prediction.value = parsePrediction(await response.json());
    completedSteps.value = 4;
    buttonText.value = "处理完成";
    await nextTick();
    renderChart();
    alert("所有任务执行完毕！");
  } catch (error) {
    log(`任务失败：${error.message}`);
    message.error(error.message);
    buttonText.value = "重新处理";
  } finally {
    running.value = false;
  }
}

async function runCodexPackage() {
  if (!selectedMatch.value) return;
  log("正在生成 Codex 分析包...");
  const response = await fetch("/api/codex-analysis-package", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ match: selectedMatch.value })
  });
  if (!response.ok) {
    message.error(`Codex 分析包生成失败：HTTP ${response.status}`);
    return;
  }
  const payload = await response.json();
  prediction.value = {
    is_analyzable: false,
    information_gaps: payload.missingSources,
    key_evidence: payload.prompt,
    team_data_check: "这是可交给当前 Codex 对话继续分析的输入包。浏览器不能直接调用这条 Codex 会话。"
  };
  sourceNeedsVisible.value = true;
  await nextTick();
  renderChart();
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

window.addEventListener("resize", () => chart?.resize());
onBeforeUnmount(() => chart?.dispose());

loadMatches().catch((error) => {
  log(`赛程同步失败：${error.message}`);
  message.error(error.message);
});
loadDataSources().catch(() => {});
</script>

<style scoped>
:global(body) {
  margin: 0;
  background: #0f172a;
  color: #e5eefb;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.page-shell {
  min-height: 100vh;
  background:
    radial-gradient(circle at 20% 10%, rgba(56, 189, 248, 0.22), transparent 28%),
    radial-gradient(circle at 80% 0%, rgba(14, 165, 233, 0.14), transparent 28%),
    #0f172a;
}

.navbar {
  height: 68px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 28px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.24);
  background: rgba(15, 23, 42, 0.82);
  backdrop-filter: blur(18px);
}

.brand,
.home-link {
  color: #e5eefb;
  text-decoration: none;
  font-weight: 900;
}

.nav-right {
  display: inline-flex;
  align-items: center;
  gap: 14px;
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #22c55e;
  box-shadow: 0 0 18px rgba(34, 197, 94, 0.9);
}

.status-text {
  color: #bbf7d0;
  font-weight: 800;
}

.layout {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  min-height: calc(100vh - 68px);
}

.sidebar {
  padding: 22px 14px;
  border-right: 1px solid rgba(148, 163, 184, 0.24);
  background: rgba(15, 23, 42, 0.62);
  backdrop-filter: blur(18px);
}

.menu-item {
  width: 100%;
  padding: 12px 14px;
  margin-bottom: 8px;
  border: 0;
  border-radius: 12px;
  color: #94a3b8;
  background: transparent;
  text-align: left;
  font-weight: 900;
  cursor: pointer;
}

.menu-item.active,
.menu-item:hover {
  color: #e5eefb;
  background: rgba(56, 189, 248, 0.16);
}

.main-content {
  padding: 34px;
}

.glass-card {
  border: 1px solid rgba(148, 163, 184, 0.24);
  border-radius: 12px;
  background: rgba(15, 23, 42, 0.72);
  backdrop-filter: blur(18px);
  box-shadow: 0 24px 60px rgba(2, 6, 23, 0.34);
}

.control-card,
.result-card {
  max-width: 1120px;
  margin: 0 auto 18px;
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
  min-height: 38px;
  border: 1px solid rgba(148, 163, 184, 0.34);
  border-radius: 8px;
  color: #e5eefb;
  background: rgba(15, 23, 42, 0.82);
  padding: 0 12px;
  font: inherit;
  outline: none;
}

.native-control:hover,
.native-control:focus {
  border-color: rgba(56, 189, 248, 0.82);
  box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.14);
}

.match-select {
  width: 100%;
}

.match-select option {
  color: #0f172a;
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
  transition: transform 0.16s ease, border-color 0.16s ease, background 0.16s ease, opacity 0.16s ease;
}

.primary-run-button {
  min-width: 168px;
  min-height: 46px;
  padding: 0 26px;
  color: #06111f;
  border-color: rgba(125, 211, 252, 0.92);
  background: linear-gradient(135deg, #38bdf8, #67e8f9);
  box-shadow: 0 12px 30px rgba(56, 189, 248, 0.28);
}

.codex-mini-button {
  min-height: 34px;
  padding: 0 12px;
  color: #bae6fd;
  border-color: rgba(56, 189, 248, 0.34);
  background: rgba(15, 23, 42, 0.68);
  font-size: 12px;
}

.primary-run-button:hover:not(:disabled),
.codex-mini-button:hover:not(:disabled) {
  transform: translateY(-1px);
  border-color: rgba(125, 211, 252, 0.96);
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
  border: 1px solid rgba(148, 163, 184, 0.24);
  border-radius: 12px;
  color: #64748b;
  background: rgba(15, 23, 42, 0.56);
  text-align: center;
  font-weight: 900;
}

.step.completed {
  color: #e0f2fe;
  border-color: rgba(56, 189, 248, 0.76);
  background: rgba(56, 189, 248, 0.18);
}

.log-area {
  height: 200px;
  overflow-y: auto;
  padding: 14px;
  border: 1px solid rgba(56, 189, 248, 0.22);
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.42);
  color: #dbeafe;
  font: 13px/1.7 Consolas, "SFMono-Regular", monospace;
}

.source-list {
  margin-top: 14px;
}

.chart {
  width: 100%;
  height: 320px;
  margin-top: 18px;
}

.analysis-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin-top: 16px;
}

.top3 {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

@media (max-width: 860px) {
  .layout {
    grid-template-columns: 1fr;
  }

  .sidebar {
    border-right: 0;
    border-bottom: 1px solid rgba(148, 163, 184, 0.24);
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
  .analysis-grid {
    grid-template-columns: 1fr;
  }
}
</style>
