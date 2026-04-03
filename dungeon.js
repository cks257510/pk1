(function () {
  'use strict';

  const POKEBATTLE = window.POKEBATTLE || (window.POKEBATTLE = {});

  const DUNGEONS = {
    route201: {
      id: 'route201',
      name: '201번도로',
      difficulty: '하',
      theme: 'route',
      battleBand: [0, 1],
      levelOffset: -5,
      boss: '다크라이',
      legendChance: 0.05,
      itemChance: 0.6,
      description: '리그 배틀 누적 0~1회일 때 도전 가능.'
    },
    galaxy: {
      id: 'galaxy',
      name: '갤럭시단 빌딩',
      difficulty: '중',
      theme: 'galaxy',
      battleBand: [2, 3],
      levelOffset: -2,
      boss: '포푸니라',
      legendChance: 0.05,
      itemChance: 0.8,
      description: '리그 배틀 누적 2~3회일 때 도전 가능.'
    },
    distortion: {
      id: 'distortion',
      name: '깨어진 세계',
      difficulty: '상',
      theme: 'distortion',
      battleBand: [4, Infinity],
      levelOffset: -2,
      boss: '기라티나',
      legendChance: 0.30,
      itemChance: 0.9,
      description: '리그 배틀 누적 4회 이상일 때 도전 가능'
    }
  };

  const LEGENDARY_NAMES = new Set(['뮤츠','뮤','루기아','칠색조','라이코','앤테이','스이쿤','세레비','레지락','레지아이스','레지스틸','라티아스','라티오스','가이오가','그란돈','레쿠쟈','지라치','테오키스','유크시','엠라이트','아그놈','디아루가','펄기아','히드런','레지기가스','기라티나','크레세리아','피오네','마나피','다크라이','쉐이미','아르세우스','코바르온','테라키온','비리디온','토네로스','볼트로스','레시라무','제크로무','랜드로스','큐레무','케르디오','메로엣타','게노세크트']);
  const DISTORTION_ACCESS_NAMES = new Set(['라프라스','전룡','메리프','보송송','핫삼','헤라크로스','라이츄','구구','피죤','피죤투']);

  const state = {
    selectedId: 'route201',
    run: null
  };

  function core() { return POKEBATTLE.core; }
  function currentLanguage() { return POKEBATTLE.core?.state?.settings?.language === 'en' ? 'en' : 'ko'; }
  function tr(ko, en) { return currentLanguage() === 'en' ? en : ko; }
  function normalizeName(name) { return String(name || '').trim(); }

  function getProgress(playerId) {
    return core()?.getDungeonProgress?.(playerId) || core()?.state?.dungeonProgress || { leagueBattlesCompleted: 0, usedAtBattleCount: null, attemptedAtBattleCount: null };
  }

  function currentBattleCount(playerId) {
    return Number(getProgress(playerId).leagueBattlesCompleted || 0);
  }

  function isLegendaryLike(basePokemon) {
    return LEGENDARY_NAMES.has(normalizeName(basePokemon?.nameKo)) || core()?.shouldExcludeLegend?.(basePokemon);
  }

  function bst(basePokemon) {
    const stats = basePokemon?.speciesStats || basePokemon?.stats || {};
    return ['hp','attack','defense','spAttack','spDefense','speed'].reduce((sum, key) => sum + Number(stats[key] || 0), 0);
  }

  function getTier(basePokemon) {
    const total = bst(basePokemon);
    if (total >= 530) return 'high';
    if (total >= 420) return 'mid';
    return 'low';
  }

  function weightedPickByTier(list) {
    const buckets = { high: [], mid: [], low: [] };
    list.forEach((pokemon) => buckets[getTier(pokemon)].push(pokemon));
    const ticketPool = [];
    buckets.high.forEach((p) => { for (let i = 0; i < 40; i += 1) ticketPool.push(p); });
    buckets.mid.forEach((p) => { for (let i = 0; i < 50; i += 1) ticketPool.push(p); });
    buckets.low.forEach((p) => { for (let i = 0; i < 60; i += 1) ticketPool.push(p); });
    if (!ticketPool.length) return list[Math.floor(Math.random() * list.length)] || null;
    return ticketPool[Math.floor(Math.random() * ticketPool.length)] || null;
  }

  function pickUniform(list) {
    if (!Array.isArray(list) || !list.length) return null;
    return list[Math.floor(Math.random() * list.length)] || null;
  }

  function pickRandomEncounter() {
    const all = core().state.allPokemon || [];
    const pool = all.filter((pokemon) => !isLegendaryLike(pokemon));
    return weightedPickByTier(pool) || pool[0] || null;
  }

  function isTrueUnevolved(basePokemon) {
    if (!basePokemon) return false;
    const all = core().state.allPokemon || [];
    const hasPreviousEvolution = all.some((candidate) => Number(candidate?.evolution?.nextEvoId) === Number(basePokemon.id));
    const canEvolveFurther = Boolean(basePokemon.evolution?.nextEvoId);
    return !hasPreviousEvolution && canEvolveFurther;
  }

  function getNormalUnevolvedRewardPool() {
    const all = core().state.allPokemon || [];
    return all.filter((pokemon) => {
      if (!pokemon || pokemon.isMegaEvolution) return false;
      if (isLegendaryLike(pokemon)) return false;
      return isTrueUnevolved(pokemon);
    });
  }

  function getGeneralNormalRewardPool() {
    const all = core().state.allPokemon || [];
    return all.filter((pokemon) => {
      if (!pokemon || pokemon.isMegaEvolution) return false;
      return !isLegendaryLike(pokemon);
    });
  }

  function getNormalEvolvedRewardPool() {
    return getGeneralNormalRewardPool().filter((pokemon) => !isTrueUnevolved(pokemon));
  }

  function getDistortionNormalRewardPool() {
    const evolvedIds = new Set(getNormalEvolvedRewardPool().map((pokemon) => Number(pokemon?.id)));
    const all = core().state.allPokemon || [];
    const seen = new Set();
    return all.filter((pokemon) => {
      if (!pokemon || pokemon.isMegaEvolution) return false;
      if (isLegendaryLike(pokemon)) return false;
      const name = normalizeName(pokemon.nameKo);
      const ok = evolvedIds.has(Number(pokemon.id)) || DISTORTION_ACCESS_NAMES.has(name);
      if (!ok) return false;
      if (seen.has(Number(pokemon.id))) return false;
      seen.add(Number(pokemon.id));
      return true;
    });
  }

  function getLegendaryRewardPool() {
    const all = core().state.allPokemon || [];
    return all.filter((pokemon) => pokemon && !pokemon.isMegaEvolution && isLegendaryLike(pokemon));
  }

  function pickFirstRewardBase(config) {
    const pool = config?.id === 'distortion' ? getDistortionNormalRewardPool() : getNormalUnevolvedRewardPool();
    return pickUniform(pool) || pool[0] || null;
  }

  function pickSecondRewardBase(config, excludedId = null) {
    const legendaryPool = getLegendaryRewardPool().filter((pokemon) => Number(pokemon?.id) !== Number(excludedId));
    const normalPool = (config?.id === 'distortion' ? getDistortionNormalRewardPool() : getNormalUnevolvedRewardPool())
      .filter((pokemon) => Number(pokemon?.id) !== Number(excludedId));
    const legendChance = Math.max(0, Math.min(1, Number(config?.legendChance || 0)));
    const shouldLegend = legendaryPool.length > 0 && Math.random() < legendChance;
    if (shouldLegend) return pickUniform(legendaryPool) || legendaryPool[0] || null;
    return pickUniform(normalPool) || normalPool[0] || null;
  }

  function getPlayerReferenceLevel(playerId) {
    const player = core().getPlayer(playerId);
    const levels = (player?.squad || []).map((pokemon) => Number(pokemon.baseLevel || pokemon.level || 5));
    if (!levels.length) return 5;
    return Math.max(5, ...levels);
  }

  function runtimeWithAutoEvolution(basePokemon, level) {
    const runtime = core().createRuntimePokemon(basePokemon, level);
    let evolved = core().maybeEvolve(runtime);
    while (evolved) evolved = core().maybeEvolve(runtime);
    runtime.currentHp = runtime.maxHp;
    return runtime;
  }

  function chooseDungeonConfig() {
    return DUNGEONS[state.selectedId] || DUNGEONS.route201;
  }

  function availabilityFor(config, playerId) {
    const count = currentBattleCount(playerId);
    const usedAt = getProgress(playerId).usedAtBattleCount;
    const inBand = count >= config.battleBand[0] && count <= config.battleBand[1];
    if (!inBand) return { open: false, reason: `현재 누적 리그 배틀 ${count}회에서는 도전할 수 없습니다.` };
    if (usedAt === count) return { open: false, reason: '현재 MATCH 구간에서는 이미 던전 승리를 완료했습니다. 다음 리그 배틀 후 다시 도전할 수 있습니다.' };
    return { open: true, reason: `현재 누적 리그 배틀 ${count}회 기준으로 도전 가능합니다.` };
  }

  function makeEnemyTeam(config, playerId) {
    const referenceLevel = getPlayerReferenceLevel(playerId);
    const enemyLevel = Math.max(1, referenceLevel + Number(config.levelOffset || 0));
    const bossLevel = config?.id === 'route201' ? Math.max(1, referenceLevel) : enemyLevel;
    const encounterBase = pickRandomEncounter();
    const bossBase = core().state.allPokemon.find((pokemon) => pokemon.nameKo === config.boss);
    return [runtimeWithAutoEvolution(encounterBase, enemyLevel), runtimeWithAutoEvolution(bossBase, bossLevel)];
  }

  function rewardCardHtml(basePokemon, runtimePokemon) {
    const color = basePokemon?.colors?.primary || basePokemon?.primaryColor || '#7ecfff';
    return `<span style="color:${color};font-weight:800;">${runtimePokemon.currentName} Lv.${runtimePokemon.level} 획득!</span>`;
  }

  function createRewardRuntime(basePokemon, level) {
    const runtime = core().createRuntimePokemon(basePokemon, level);
    let safety = 8;
    while (safety > 0) {
      const evolved = core().maybeEvolve?.(runtime);
      if (!evolved) break;
      safety -= 1;
    }
    runtime.currentHp = runtime.maxHp;
    return runtime;
  }

  function grantDungeonRewards(playerId, config) {
    const rewardLevel = Math.min(200, getPlayerReferenceLevel(playerId));
    const lines = [];
    const firstBase = pickFirstRewardBase(config);
    const secondBase = pickSecondRewardBase(config, firstBase?.id || null);
    [firstBase, secondBase].filter(Boolean).forEach((basePokemon) => {
      const runtime = createRewardRuntime(basePokemon, rewardLevel);
      core().addPokemonToReserve(playerId, runtime);
      lines.push({ html: rewardCardHtml(basePokemon, runtime) });
    });
    core().addConsumable(playerId, 'rare_candy', 1);
    lines.push('이상한사탕 1개를 획득했다.');
    return lines;
  }

  function handleBattleComplete(payload) {
    const config = state.run?.config;
    const playerId = state.run?.playerId || core().state.activePlayerId;
    if (!config) return false;
    core().healPlayerTeam(playerId);
    state.run = null;
    if (payload.winnerId === playerId) {
      const progress = getProgress(playerId);
      progress.usedAtBattleCount = currentBattleCount(playerId);
      const lines = grantDungeonRewards(playerId, config);
      window.setTimeout(() => {
        core().returnToLobby();
        POKEBATTLE.ui.renderAll();
        POKEBATTLE.ui.openRewardModal({ title: `${config.name} 클리어 보상`, lines });
      }, 700);
    } else {
      window.setTimeout(() => {
        core().returnToLobby();
        POKEBATTLE.ui.renderAll();
        POKEBATTLE.ui.showToast('던전에서 패배했다. 승리할 때까지 계속 다시 도전할 수 있다.');
      }, 700);
    }
    return true;
  }

  function startSelectedDungeon() {
    const config = chooseDungeonConfig();
    const activePlayerId = core().state.activePlayerId || 'p1';
    const availability = availabilityFor(config, activePlayerId);
    if (!availability.open) {
      POKEBATTLE.ui.showToast(availability.reason);
      return false;
    }
    const progress = getProgress(activePlayerId);
    progress.attemptedAtBattleCount = currentBattleCount(activePlayerId);
    const player = core().getPlayer(activePlayerId);
    const enemyTeam = makeEnemyTeam(config, activePlayerId);
    if (!player?.squad?.length || enemyTeam.some((pokemon) => !pokemon)) {
      POKEBATTLE.ui.showToast('던전 입장 준비에 실패했습니다.');
      return false;
    }
    core().healPlayerTeam(player);
    state.run = { config, playerId: activePlayerId };
    return POKEBATTLE.battleEngine.startBattle({
      playerId: activePlayerId,
      opponentId: `${config.id}_boss`,
      opponentName: config.name,
      playerName: player.name,
      playerTeam: player.squad,
      opponentTeam: enemyTeam,
      mode: 'dungeon',
      theme: config.theme,
      specialBgm: config.id === 'route201' ? 'enter_darkrai.mp3' : null,
      skipLevelReward: true,
      onComplete: handleBattleComplete
    });
  }

  function renderHelper() { return ''; }

  function renderCard(config, playerId) {
    const selected = state.selectedId === config.id;
    const availability = availabilityFor(config, playerId);
    const bossLine = config.id === 'route201'
      ? `보스: <span style="color:#ff9c43;font-weight:800;">${config.boss}</span>`
      : `보스: <span style="color:#ff9c43;font-weight:800;">${config.boss}</span> · 적 레벨: 플레이어의 이상한사탕 적용 전 레벨보다 ${Math.abs(config.levelOffset)} 낮음`;
    return `<button type="button" class="placeholder-card dungeon-card ${selected ? 'selected' : ''}" data-dungeon-select="${config.id}">
      <div class="item-title-row"><h3>${config.name}</h3><span class="mini-badge">난이도 ${config.difficulty}</span></div>
      <p>${bossLine}</p>
      <p style="color:${availability.open ? '#8df0b8' : '#ffb4aa'};">${config.description}</p>
    </button>`;
  }

  function renderCategory() {
    const activePlayerId = core().state.activePlayerId || 'p1';
    const config = chooseDungeonConfig();
    const availability = availabilityFor(config, activePlayerId);
    return `
      <section class="panel-card">
        <div class="section-title-row">
          <div>
            <h1 class="section-title" style="font-size:1.22em;">🌋 ${tr('던전','Dungeon')}</h1>
            <p class="section-caption" style="font-size:1.08em;">${tr('던전은 리그 배틀과 같은 화면과 배틀 시스템을 사용합니다. 각 던전에서는 랜덤 적 1마리와 보스 1마리가 차례로 등장합니다.','Dungeons use the same battle screen and battle system as league battles. Each dungeon has 1 random enemy and 1 boss appearing in sequence.')}</p>
          </div>
          <button type="button" class="chip-btn" data-dungeon-start="1">${tr('던전 입장','Enter Dungeon')}</button>
        </div>
        <div class="summary-grid">
          <div class="summary-card"><div class="summary-label">${tr('현재 누적 리그 배틀','League Battles')}</div><div class="summary-value">${currentBattleCount(activePlayerId)}회</div></div>
          <div class="summary-card"><div class="summary-label">${tr('현재 선택','Selected')}</div><div class="summary-value">${config.name} · ${availability.open ? tr('도전 가능','Open') : tr('잠김','Locked')}</div></div>
        </div>
        <div class="subsection"><div class="subheading"><h3>${tr('던전 목록','Dungeon List')}</h3><span>${tr('각 던전의 조건과 보스를 확인하세요.','Check the boss and conditions for each dungeon.')}</span></div><div class="placeholder-stack">${Object.values(DUNGEONS).map((entry) => renderCard(entry, activePlayerId)).join('')}</div></div>
        <div class="subsection"><div class="subheading"><h3>${tr('도전 조건 / 초기화','Conditions / Reset')}</h3><span>${tr('시즌 초기화와 보상 정보','Season reset and reward info')}</span></div><div class="placeholder-stack">
                    <div class="placeholder-card"><p>${tr('챔피언 리그가 끝나고 새 시즌이 시작되면 던전 해금에 쓰이는 누적 리그 배틀 횟수는 초기화됩니다.','When a new season begins after the Champion League, the league battle count used for dungeon unlocks resets.')}</p></div>
          <div class="placeholder-card"><p style="color:#ffffff;font-weight:700;">승리 보상: <span style="color:#ff9c43;font-weight:900;">|</span> 랜덤 포켓몬 2마리, 이상한사탕 1개. <span style="color:#ff9c43;font-weight:900;">|</span> 포켓몬1 = 201번도로와 갤럭시단 빌딩에서는 전설 계열을 제외한 미진화체 포켓몬 지급, 깨어진 세계에서는 진화체 포켓몬으로 지급. <span style="color:#ff9c43;font-weight:900;">|</span> 포켓몬2 = 201번도로 5%, 갤럭시단 빌딩 5%, 깨어진 세계 30% 확률로 전설 계열 지급, 깨어진 세계에는 진화체 포켓몬으로, 그외에는 미진화체로 지급 <span style="color:#ff9c43;font-weight:900;">|</span></p></div>
        </div></div>
        ${renderHelper(activePlayerId)}
      </section>`;
  }

  function bindCategory(root) {
    root.querySelectorAll('[data-dungeon-select]').forEach((button) => {
      button.addEventListener('click', () => {
        state.selectedId = button.dataset.dungeonSelect;
        POKEBATTLE.ui.renderAll();
      });
    });
    root.querySelectorAll('[data-dungeon-start]').forEach((button) => {
      button.addEventListener('click', () => { POKEBATTLE.ui?.playUiSound?.('dungeonbutton'); startSelectedDungeon(); });
    });
    root.querySelectorAll('[data-dismiss-helper]').forEach((button) => {
      button.addEventListener('click', () => {
        core().markHelperSeen(button.dataset.dismissHelper);
        POKEBATTLE.ui.renderAll();
      });
    });
  }

  POKEBATTLE.dungeon = {
    version: 'stage-2-dungeon',
    ready: true,
    state,
    DUNGEONS,
    renderCategory,
    bindCategory,
    startSelectedDungeon,
    availabilityFor
  };
})();
