function getQuery(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function getMatch() {
  const matchId = getQuery("match");
  return window.WORLD_CUP_FIXTURES.find((match) => match.id === matchId) || window.WORLD_CUP_FIXTURES[0];
}

function profileFor(team) {
  return window.TEAM_PROFILES?.[team] || {
    coach: "待核验",
    summary: "该队还没有本地资料。下一步应从 FIFA、国家队官方、ESPN squad、FBref/Transfermarkt 补充主教练、球员年龄、身体条件、俱乐部和联赛等级。",
    sourceTier: "事实层优先，社交媒体只作辅助。",
    links: []
  };
}

function renderDetail() {
  const match = getMatch();
  const hero = document.getElementById("detailHero");
  const grid = document.getElementById("teamDetailGrid");
  hero.innerHTML = `
    <span class="tag">${match.date}</span>
    <span class="tag dark">${match.group}</span>
    <h1>${match.home} vs ${match.away}</h1>
    <p>${match.headline}</p>
  `;

  grid.innerHTML = [match.home, match.away].map((team) => {
    const profile = profileFor(team);
    const links = profile.links?.length
      ? profile.links.map((href, index) => `<a href="${href}" target="_blank" rel="noreferrer">资料源 ${index + 1}</a>`).join("")
      : "<span>暂无链接</span>";

    return `
      <article class="team-detail-card">
        <div class="team-detail-head">
          <div>
            <span class="muted-label">国家队</span>
            <h2>${team}</h2>
          </div>
          <span class="tag">${profile.coach}</span>
        </div>
        <p>${profile.summary}</p>
        <div class="info-block">
          <strong>后续需要抓取的字段</strong>
          <ul>
            <li>主教练：执教风格、常用阵型、类似比赛调整记录</li>
            <li>球员：年龄、身高体重、惯用脚、效力俱乐部、联赛等级</li>
            <li>阵容：预计首发、伤停、轮换、关键球员状态</li>
            <li>战术：压迫高度、低位质量、定位球、转换速度</li>
          </ul>
        </div>
        <div class="info-block">
          <strong>来源策略</strong>
          <p>${profile.sourceTier || "优先使用官方与结构化数据源。"}</p>
        </div>
        <div class="team-links">${links}</div>
      </article>
    `;
  }).join("");
}

renderDetail();
