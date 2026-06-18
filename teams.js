const matchSelect = document.getElementById("teamMatchSelect");

function getQuery(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function todayIso() {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function defaultMatch() {
  const matchId = getQuery("match") || localStorage.getItem("selectedMatchId");
  const fromQuery = window.WORLD_CUP_FIXTURES.find((match) => match.id === matchId);
  if (fromQuery) return fromQuery;
  const today = todayIso();
  return window.WORLD_CUP_FIXTURES
    .filter((match) => match.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.kickoffTime || "").localeCompare(b.kickoffTime || ""))[0]
    || window.WORLD_CUP_FIXTURES[0];
}

function getMatch() {
  return window.WORLD_CUP_FIXTURES.find((match) => match.id === matchSelect.value) || defaultMatch();
}

function renderMatchSelect(selectedId) {
  const matches = [...window.WORLD_CUP_FIXTURES]
    .sort((a, b) => a.date.localeCompare(b.date) || (a.kickoffTime || "").localeCompare(b.kickoffTime || ""));
  matchSelect.innerHTML = matches
    .map((match) => `<option value="${escapeHtml(match.id)}">${escapeHtml(match.date)} · ${escapeHtml(match.home)} vs ${escapeHtml(match.away)}</option>`)
    .join("");
  matchSelect.value = selectedId;
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
    sourceTier: "事实层优先，舆情层只做辅助。",
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
  return response.json();
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

  grid.innerHTML = `<div class="empty-state detail-loading">正在抓取双方球队与球员信息...</div>`;

  const teams = [match.home, match.away];
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

const initial = defaultMatch();
renderMatchSelect(initial.id);
matchSelect.addEventListener("change", renderDetail);
renderDetail();
