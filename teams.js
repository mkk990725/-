const matchSelect = document.getElementById("teamMatchSelect");
let allMatches = [];
const MATCH_CACHE_KEY = "footballAgent.teams.matchesCache.v1";
const TEAM_DETAIL_CACHE_KEY = "footballAgent.teamDetails.v1";

function getQuery(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function todayIso() {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function defaultMatch() {
  const matchId = getQuery("match") || localStorage.getItem("selectedMatchId");
  const fromQuery = allMatches.find((match) => match.id === matchId);
  if (fromQuery) return fromQuery;
  const today = todayIso();
  return allMatches
    .filter((match) => match.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.kickoffTime || "").localeCompare(b.kickoffTime || ""))[0]
    || window.WORLD_CUP_FIXTURES[0];
}

function getMatch() {
  return allMatches.find((match) => match.id === matchSelect.value) || defaultMatch();
}

function renderMatchSelect(selectedId) {
  const matches = [...allMatches]
    .sort((a, b) => a.date.localeCompare(b.date) || (a.kickoffTime || "").localeCompare(b.kickoffTime || ""));
  matchSelect.innerHTML = matches
    .map((match) => `<option value="${escapeHtml(match.id)}">${escapeHtml(match.date)} · ${escapeHtml(match.home)} vs ${escapeHtml(match.away)}</option>`)
    .join("");
  matchSelect.value = selectedId;
}

function matchKey(match) {
  const teams = [match.home, match.away].map((team) => String(team || "").trim()).sort((a, b) => a.localeCompare(b, "zh-CN"));
  return `${match.date}|${teams[0]}|${teams[1]}`;
}

async function loadAllMatches() {
  const cached = readMatchCache();
  if (cached.length) allMatches = cached;
  if (!window.location.protocol.startsWith("http")) {
    if (!allMatches.length) allMatches = [...window.WORLD_CUP_FIXTURES];
    return;
  }
  try {
    const response = await fetch("/api/matches?start=2026-06-11&end=2026-06-27");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    const merged = new Map();
    [...(payload.matches || []), ...window.WORLD_CUP_FIXTURES].forEach((match) => {
      if (!match?.home || !match?.away) return;
      const key = matchKey(match);
      if (!merged.has(key) || String(match.id).startsWith("espn-")) merged.set(key, match);
    });
    allMatches = [...merged.values()];
    writeMatchCache(allMatches);
  } catch {
    if (!allMatches.length) allMatches = [...window.WORLD_CUP_FIXTURES];
  }
}

function readMatchCache() {
  try {
    const cache = JSON.parse(localStorage.getItem(MATCH_CACHE_KEY) || "{}");
    return Array.isArray(cache.matches) ? cache.matches : [];
  } catch {
    return [];
  }
}

function writeMatchCache(matches) {
  try {
    localStorage.setItem(MATCH_CACHE_KEY, JSON.stringify({
      updatedAt: new Date().toISOString(),
      matches
    }));
  } catch {}
}

function readTeamDetailCache(team) {
  try {
    const cache = JSON.parse(localStorage.getItem(TEAM_DETAIL_CACHE_KEY) || "{}");
    return cache[team] || null;
  } catch {
    return null;
  }
}

function writeTeamDetailCache(team, detail) {
  try {
    const cache = JSON.parse(localStorage.getItem(TEAM_DETAIL_CACHE_KEY) || "{}");
    cache[team] = { ...detail, cachedAt: new Date().toISOString() };
    localStorage.setItem(TEAM_DETAIL_CACHE_KEY, JSON.stringify(cache));
  } catch {}
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function localProfileFor(team) {
  return window.TEAM_PROFILES?.[team] || {
    coach: "待核验",
    summary: "本地还没有完整球队资料。启动服务并同步赛程后，会优先从白名单数据源补球队链接与球员名单。",
    sourceTier: "事实层优先，中文技战术参考只做辅助。",
    links: []
  };
}

async function fetchTeamDetail(team) {
  if (!window.location.protocol.startsWith("http")) {
    return {
      team,
      profile: null,
      players: [],
      warning: "当前是直接打开静态文件，无法调用本地抓取服务。请通过 node server.js 启动后访问。"
    };
  }

  const response = await fetch(`/api/team-detail?team=${encodeURIComponent(team)}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const detail = await response.json();
  writeTeamDetailCache(team, detail);
  return detail;
}

function linkList(localProfile, remoteProfile) {
  const urls = [
    ...(localProfile.links || []),
    remoteProfile?.squadLink,
    ...(remoteProfile?.officialLinks || []).map((item) => item.href)
  ].filter(Boolean);
  return [...new Set(urls)];
}

function renderPlayerRows(players) {
  if (!players.length) {
    return `<div class="empty-state">暂未抓取到球员名单。通常原因是还没同步到该球队的 ESPN squad 链接，或目标页面结构发生变化。</div>`;
  }

  return `
    <div class="player-table-wrap">
      <table class="player-table">
        <thead>
          <tr>
            <th>号码</th>
            <th>球员</th>
            <th>位置</th>
            <th>年龄</th>
            <th>身高</th>
            <th>体重</th>
            <th>俱乐部</th>
            <th>身价</th>
          </tr>
        </thead>
        <tbody>
          ${players.map((player) => `
            <tr>
              <td>${escapeHtml(player.jersey || "-")}</td>
              <td>
                ${player.href ? `<a href="${escapeHtml(player.href)}" target="_blank" rel="noreferrer">${escapeHtml(player.nameZh || player.name)}</a>` : escapeHtml(player.nameZh || player.name)}
                <span class="player-original">${escapeHtml(player.name)}</span>
              </td>
              <td>${escapeHtml(player.positionZh || player.position || "-")}</td>
              <td>${escapeHtml(player.age || "-")}</td>
              <td>${escapeHtml(player.heightCm || player.height || "-")}</td>
              <td>${escapeHtml(player.weightKg || player.weight || "-")}</td>
              <td>${escapeHtml(player.clubZh || player.club || "待接入")}</td>
              <td>${escapeHtml(player.marketValue || "待接入")}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderTeamCard(team, detail) {
  const localProfile = localProfileFor(team);
  const remoteProfile = detail.profile;
  const links = linkList(localProfile, remoteProfile);
  const players = detail.players || [];
  const coach = localProfile.coach || "待核验";
  const coachStyle = localProfile.coachStyle || localProfile.coachSummary || "需要结合赛前发布会、近赛首发和临场换人记录继续核验。";
  const tacticalStyle = localProfile.tacticalStyle || localProfile.summary || "需要补充球队近期进攻、防守和转换阶段的结构化样本。";
  const tacticalCheck = localProfile.tacticalCheck || "赛前重点看首发阵型、中锋人选、后腰保护、边后卫压上、核心轮休和热身伤退。";
  const sourceLinks = links.length
    ? links.map((href, index) => `<a href="${escapeHtml(href)}" target="_blank" rel="noreferrer">资料源 ${index + 1}</a>`).join("")
    : "<span>暂无外部链接</span>";

  return `
    <article class="team-detail-card">
      <div class="team-detail-head">
        <div>
          <span class="muted-label">国家队</span>
          <h2>${escapeHtml(team)}</h2>
        </div>
        <span class="tag">${escapeHtml(coach)}</span>
      </div>
      <p>${escapeHtml(localProfile.summary || "暂无摘要。")}</p>
      <div class="team-tactical-grid">
        <article>
          <span class="muted-label">主教练执行风格</span>
          <strong>${escapeHtml(coach)}</strong>
          <p>${escapeHtml(coachStyle)}</p>
        </article>
        <article>
          <span class="muted-label">球队技战术特点</span>
          <strong>战术画像</strong>
          <p>${escapeHtml(tacticalStyle)}</p>
        </article>
        <article>
          <span class="muted-label">赛前核验重点</span>
          <strong>临场变量</strong>
          <p>${escapeHtml(tacticalCheck)}</p>
        </article>
      </div>
      <div class="team-meta-grid">
        <div>
          <span class="muted-label">球员名单</span>
          <strong>${players.length ? `${players.length} 人` : "待抓取"}</strong>
        </div>
        <div>
          <span class="muted-label">服务端更新时间</span>
          <strong>${detail.fetchedAt ? new Date(detail.fetchedAt).toLocaleString("zh-CN") : "暂无"}</strong>
        </div>
      </div>
      ${detail.warning ? `<div class="info-warning">${escapeHtml(detail.warning)}</div>` : ""}
      <div class="info-block">
        <strong>球员信息</strong>
        ${renderPlayerRows(players)}
      </div>
      <div class="info-block">
        <strong>来源策略</strong>
        <p>${escapeHtml(localProfile.sourceTier || "优先使用官方与结构化数据源。")}</p>
        <div class="team-links">${sourceLinks}</div>
      </div>
    </article>
  `;
}

async function renderDetail() {
  const match = getMatch();
  localStorage.setItem("selectedMatchId", match.id);
  if (matchSelect.value !== match.id) matchSelect.value = match.id;
  const hero = document.getElementById("detailHero");
  const grid = document.getElementById("teamDetailGrid");
  hero.innerHTML = `
    <span class="tag">${escapeHtml(match.date)}</span>
    <span class="tag dark">${escapeHtml(match.group)}</span>
    <h1>${escapeHtml(match.home)} vs ${escapeHtml(match.away)}</h1>
    <p>${escapeHtml(match.headline)}</p>
  `;

  const teams = [match.home, match.away];
  const cachedDetails = teams.map(readTeamDetailCache);
  if (cachedDetails.every(Boolean)) {
    grid.innerHTML = teams.map((team, index) => renderTeamCard(team, cachedDetails[index])).join("");
  } else {
    grid.innerHTML = `<div class="empty-state detail-loading">正在读取球队资料缓存...</div>`;
  }

  const details = await Promise.all(teams.map(async (team) => {
    try {
      return await fetchTeamDetail(team);
    } catch (error) {
      return {
        team,
        profile: null,
        players: [],
        warning: `服务端球队资料读取失败：${error.message}`
      };
    }
  }));

  grid.innerHTML = teams.map((team, index) => renderTeamCard(team, details[index])).join("");
}

function renderInitialTeamPage() {
  const initial = defaultMatch();
  renderMatchSelect(initial.id);
  renderDetail();
}

matchSelect.addEventListener("change", renderDetail);
allMatches = readMatchCache();
if (!allMatches.length) allMatches = [...window.WORLD_CUP_FIXTURES];
renderInitialTeamPage();
loadAllMatches().then(() => {
  const current = getMatch();
  renderMatchSelect(current.id);
}).catch(() => {});
