const factorLabels = window.FACTOR_META || {
  strength: "实力边界",
  coach: "教练策略",
  tactics: "战术对位",
  players: "球员状态",
  motivation: "动机赛程",
  market: "市场校验",
  uncertainty: "不确定性"
};

const inputLabels = {
  includeSourceSufficiencyCheck: "信息源充足性与真实性校验",
  includeCoachProfile: "主教练履历与执行风格",
  includeCoachAdjustmentHistory: "相似比赛调整记录",
  includeSquadAndPlayerPhysicals: "大名单、年龄、身体条件",
  includeClubLevel: "效力俱乐部与联赛等级",
  includeLikelyLineup: "预计首发",
  includeInjuriesAndSuspensions: "伤停与停赛",
  includeTacticalMatchup: "战术对位",
  includeMotivationSchedule: "小组形势与赛程动机",
  includeMarketCheck: "市场校验",
  includeSourceReliability: "来源可靠性与烟雾弹识别"
};

const defaultConfig = {
  model: { apiUrl: "", apiKey: "", model: "", temperature: 0.2 },
  profiles: [],
  weights: {
    strength: 1.25,
    coach: 1.35,
    tactics: 1.25,
    players: 1.1,
    motivation: 0.9,
    market: 0.45,
    uncertainty: -1.15
  },
  inputs: {},
  discipline: [],
  sourcePolicy: {}
};

let currentConfig = structuredClone(defaultConfig);

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function loadConfig() {
  if (!window.location.protocol.startsWith("http")) return defaultConfig;
  const response = await fetch("/api/model-config");
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function saveConfig(config) {
  const response = await fetch("/api/model-config", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(config)
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function testModel(config) {
  const response = await fetch("/api/test-model", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ config })
  });
  const payload = await response.json();
  if (!response.ok || !payload.ok) throw new Error(payload.error || `HTTP ${response.status}`);
  return payload;
}

function renderConfig() {
  document.getElementById("apiUrl").value = currentConfig.model?.apiUrl || "";
  document.getElementById("apiKey").value = currentConfig.model?.apiKey || "";
  document.getElementById("modelName").value = currentConfig.model?.model || "";
  document.getElementById("temperature").value = currentConfig.model?.temperature ?? 0.2;
  document.getElementById("profileName").value = currentConfig.model?.profileName || "";
  document.getElementById("disciplineText").value = (currentConfig.discipline || []).join("\n");

  const profiles = currentConfig.profiles || [];
  document.getElementById("profileSelect").innerHTML = profiles.length
    ? profiles.map((profile, index) => `<option value="${index}">${escapeHtml(profile.name || `配置 ${index + 1}`)} · ${escapeHtml(profile.model?.model || "未命名模型")}</option>`).join("")
    : `<option value="">暂无配置组</option>`;
  document.getElementById("applyProfile").disabled = !profiles.length;

  document.getElementById("configWeights").innerHTML = Object.entries(currentConfig.weights || {})
    .map(([key, value]) => `
      <label>
        <span>${escapeHtml(factorLabels[key] || key)}</span>
        <input type="number" step="0.05" data-weight="${escapeHtml(key)}" value="${Number(value).toFixed(2)}" />
      </label>
    `)
    .join("");

  document.getElementById("configInputs").innerHTML = Object.entries(inputLabels)
    .map(([key, label]) => `
      <label>
        <input type="checkbox" data-input="${escapeHtml(key)}" ${currentConfig.inputs?.[key] ? "checked" : ""} />
        <span>${escapeHtml(label)}</span>
      </label>
    `)
    .join("");

  const sourcePolicy = currentConfig.sourcePolicy || {};
  document.getElementById("sourcePolicy").innerHTML = `
    <p><strong>事实层：</strong>${escapeHtml((sourcePolicy.tier1 || []).join("、"))}</p>
    <p><strong>结构化数据层：</strong>${escapeHtml((sourcePolicy.tier2 || []).join("、"))}</p>
    <p><strong>舆情/中文辅助层：</strong>${escapeHtml((sourcePolicy.tier3 || []).join("、"))}</p>
    <p>${escapeHtml(sourcePolicy.rule || "")}</p>
  `;
}

function collectConfig() {
  const weights = {};
  document.querySelectorAll("[data-weight]").forEach((input) => {
    weights[input.dataset.weight] = Number(input.value);
  });
  const inputs = {};
  document.querySelectorAll("[data-input]").forEach((input) => {
    inputs[input.dataset.input] = input.checked;
  });
  return {
    ...currentConfig,
    model: {
      ...(currentConfig.model || {}),
      apiUrl: document.getElementById("apiUrl").value.trim(),
      apiKey: document.getElementById("apiKey").value.trim(),
      model: document.getElementById("modelName").value.trim(),
      temperature: Number(document.getElementById("temperature").value)
    },
    weights,
    inputs,
    discipline: document.getElementById("disciplineText").value.split("\n").map((line) => line.trim()).filter(Boolean)
  };
}

function collectModelFromForm() {
  return {
    ...(currentConfig.model || {}),
    apiUrl: document.getElementById("apiUrl").value.trim(),
    apiKey: document.getElementById("apiKey").value.trim(),
    model: document.getElementById("modelName").value.trim(),
    temperature: Number(document.getElementById("temperature").value),
    profileName: document.getElementById("profileName").value.trim()
  };
}

function showConfigToast({ title, message, type = "success", duration = 3000 }) {
  document.querySelectorAll(".config-toast").forEach((item) => item.remove());
  const toast = document.createElement("div");
  toast.className = `config-toast ${type}`;
  toast.style.setProperty("--toast-duration", `${duration}ms`);
  toast.innerHTML = `
    <div class="config-toast-icon">${type === "error" ? "!" : "✓"}</div>
    <div class="config-toast-body">
      <strong>${escapeHtml(title)}</strong>
      <p>${escapeHtml(message)}</p>
      <span class="config-toast-progress"></span>
    </div>
  `;
  document.body.appendChild(toast);
  window.setTimeout(() => toast.classList.add("visible"), 20);
  window.setTimeout(() => {
    toast.classList.remove("visible");
    window.setTimeout(() => toast.remove(), 260);
  }, duration);
}

document.getElementById("saveConfig").addEventListener("click", async () => {
  const status = document.getElementById("configStatus");
  try {
    currentConfig = await saveConfig(collectConfig());
    status.textContent = "配置已保存。";
    renderConfig();
  } catch (error) {
    status.textContent = `保存失败：${error.message}`;
  }
});

document.getElementById("saveProfile").addEventListener("click", async () => {
  const status = document.getElementById("configStatus");
  try {
    const model = collectModelFromForm();
    const name = model.profileName || model.model || `配置 ${(currentConfig.profiles || []).length + 1}`;
    const profile = { name, model: { ...model, profileName: name }, savedAt: new Date().toISOString() };
    const profiles = [...(currentConfig.profiles || [])];
    const existingIndex = profiles.findIndex((item) => item.name === name);
    if (existingIndex >= 0) profiles[existingIndex] = profile;
    else profiles.push(profile);
    currentConfig = await saveConfig({ ...collectConfig(), model: { ...model, profileName: name }, profiles });
    status.textContent = `配置组已保存：${name}`;
    renderConfig();
  } catch (error) {
    status.textContent = `保存配置组失败：${error.message}`;
  }
});

document.getElementById("applyProfile").addEventListener("click", () => {
  const profiles = currentConfig.profiles || [];
  const profile = profiles[Number(document.getElementById("profileSelect").value)];
  if (!profile) return;
  currentConfig.model = { ...(profile.model || {}), profileName: profile.name };
  renderConfig();
  document.getElementById("configStatus").textContent = `已切换到配置组：${profile.name}`;
});

document.getElementById("testModel").addEventListener("click", async () => {
  const status = document.getElementById("configStatus");
  const button = document.getElementById("testModel");
  button.disabled = true;
  status.textContent = "正在测试模型联通...";
  try {
    const payload = await testModel({ ...currentConfig, model: collectModelFromForm() });
    status.textContent = `联通成功：${payload.model || "模型已响应"}，耗时 ${payload.elapsedMs} ms`;
    showConfigToast({
      title: "模型联通成功",
      message: `${payload.model || "模型已响应"}，耗时 ${payload.elapsedMs} ms`
    });
  } catch (error) {
    status.textContent = `联通失败：${error.message}`;
    showConfigToast({
      title: "模型联通失败",
      message: error.message,
      type: "error",
      duration: 5000
    });
  } finally {
    button.disabled = false;
  }
});

loadConfig()
  .then((config) => {
    currentConfig = { ...defaultConfig, ...config };
    renderConfig();
  })
  .catch((error) => {
    document.getElementById("configStatus").textContent = `配置读取失败：${error.message}`;
    renderConfig();
  });
