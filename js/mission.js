/* =====================================================================
   mission.js — 개인 미션 배정 · 미션 장치 · 학교 복구율 · 가짜 미션 · 학습 기록

   방 데이터 (network.js 의 rooms/{방번호} 아래)
     missions/{플레이어}/{m0,m1…} = { loc, spot }   게임 시작 때 방장이 배정
     done/{플레이어}/{m0…}        = 시각            학생(유령 포함)의 진짜 완료
     fakeDone/{플레이어}/{m0…}    = 시각            방해꾼의 가짜 완료 (복구율에 안 들어감)
     results/{플레이어}/{기록id}   = 학습 기록        (나의 수학 기록 · CSV 용)

   ▸ 완료 기록은 "그 미션 칸에 한 번 쓰기" 이므로 같은 미션을 여러 번 풀어도
     복구율은 한 번만 올라갑니다.
   ▸ 복구율은 더해 가는 값이 아니라 매번 처음부터 다시 셉니다.
   ===================================================================== */

// 핵심 미션 8개 (장소 id → 미션 정보)
const MISSION_DEFS = {
  computer:  { type: "power",   title: "전력 회로 복구",      short: "컴퓨터실 전력 복구", icon: "⚡", done: "전력 공급 정상" },
  science:   { type: "liquid",  title: "용액 배합 장치 복구", short: "과학실 용액 배합",   icon: "🧪", done: "실험 장비 작동" },
  cafeteria: { type: "recipe",  title: "급식 레시피 복구",    short: "급식실 레시피",      icon: "🍚", done: "조리 장비 정상" },
  library:   { type: "books",   title: "도서관 책 정리",      short: "도서관 책 정리",     icon: "📚", done: "도서관 조명 켜짐" },
  gym:       { type: "teams",   title: "체육대회 팀 편성",    short: "체육관 팀 편성",     icon: "🏀", done: "팀 편성 완료" },
  broadcast: { type: "volume",  title: "방송 음량 조절",      short: "방송실 음량 조절",   icon: "🔊", done: "방송 정상" },
  office:    { type: "evacmap", title: "비상 대피 지도",      short: "교무실 대피 지도",   icon: "🗺️", done: "대피 경로 표시 완료" },
  nurse:     { type: "water",   title: "보건실 물 공급",      short: "보건실 물 공급",     icon: "💧", done: "물 공급 완료" },
};
const CORE_LOCATIONS = Object.keys(MISSION_DEFS);

const MissionSys = (() => {
  // ── 이 기기에서만 기억하는 값 (한 판마다 초기화) ──
  let sessions = {};     // 미션키 → { q, diff, startedAt, deadline, wrong, lockUntil }
  let cooldown = {};     // 미션키 → 다시 도전 가능 시각
  let drops = {};        // 미션키 → 시간 초과로 낮아진 난이도 단계
  let usedQ = new Set(); // 이번 판에 나에게 나온 문제 id
  let effects = [];      // 성공 효과 (맵 위 빛)
  let lastNearKey = null;

  function resetLocal() {
    sessions = {}; cooldown = {}; drops = {}; usedQ = new Set(); effects = []; lastNearKey = null;
  }

  // ─────────────────────────────────────────────────────────────
  // 배정 (방장이 게임 시작 때 한 번)
  // ─────────────────────────────────────────────────────────────
  function assign(ids, settings) {
    const count = clamp(Number(settings.missionCount) || 5, 1, CORE_LOCATIONS.length);
    const out = {};
    ids.forEach((id) => {
      const locs = shuffle(CORE_LOCATIONS).slice(0, count);
      const list = {};
      locs.forEach((loc, i) => {
        list["m" + i] = { loc, spot: Math.floor(Math.random() * GameMap.DEVICE_SPOTS[loc].length) };
      });
      out[id] = list;
    });
    return out;
  }

  // ─────────────────────────────────────────────────────────────
  // 조회
  // ─────────────────────────────────────────────────────────────
  function missionsOf(room, pid) {
    const raw = (room && room.missions && room.missions[pid]) || {};
    return Object.keys(raw).sort().map((key) => {
      const m = raw[key];
      const spot = (GameMap.DEVICE_SPOTS[m.loc] || [])[m.spot] || { x: 0, y: 0 };
      return { key, loc: m.loc, spot: m.spot, x: spot.x, y: spot.y, def: MISSION_DEFS[m.loc] };
    }).filter((m) => m.def);
  }

  function isFake(room, pid) { return Roles.isSaboteur(room, pid); }

  function isDone(room, pid, key) {
    const bucket = isFake(room, pid) ? room.fakeDone : room.done;
    return !!(bucket && bucket[pid] && bucket[pid][key]);
  }

  function mine(room) {
    return missionsOf(room, Net.myId).map((m) => ({ ...m, owner: Net.myId, done: isDone(room, Net.myId, m.key) }));
  }

  // 협동 모드: 내 미션을 다 끝낸 학생(유령 포함)은 다른 학생의 남은 미션을 도울 수 있음
  function helpTargets(room) {
    const s = roomSettings(room);
    if (!s.coop || isFake(room, Net.myId) || !room.roles || room.roles[Net.myId] !== "student") return [];
    const my = mine(room);
    if (!my.length || my.some((m) => !m.done)) return [];
    const out = [];
    Roster.ids(room).forEach((pid) => {
      if (pid === Net.myId || room.roles[pid] !== "student") return;
      missionsOf(room, pid).forEach((m) => {
        if (!isDone(room, pid, m.key)) out.push({ ...m, owner: pid, help: true, done: false });
      });
    });
    return out;
  }

  // 내가 지금 할 수 있는 미션 (내 미션 + 협동 모드 도움 미션)
  function targets(room) {
    return mine(room).concat(helpTargets(room));
  }
  const sKey = (m) => m.owner + ":" + m.key;

  // 학교 복구율 = 완료된 일반 미션 수 ÷ 전체 일반 미션 수
  //  ▸ 학생(유령 포함)만 셉니다. 방해꾼 미션은 전체 수에도, 완료 수에도 들어가지 않습니다.
  //  ▸ 게임 중 나간 학생의 미션은 전체 수에서 빠집니다.
  function progress(room) {
    let total = 0, done = 0;
    if (!room || !room.players || !room.roles) return { total: 0, done: 0, pct: 0 };
    Roster.ids(room).forEach((pid) => {   // 참가자 명단 기준 (잠깐 끊긴 학생도 포함)
      if (room.roles[pid] !== "student") return;
      const list = missionsOf(room, pid);
      total += list.length;
      const d = (room.done && room.done[pid]) || {};
      done += list.filter((m) => d[m.key]).length;
    });
    return { total, done, pct: total ? (done / total) * 100 : 0 };
  }

  // 가까이 있는 (아직 안 끝낸) 내 미션
  function nearMine(room, x, y) {
    let best = null, bestD = Infinity;
    targets(room).forEach((m) => {
      if (m.done) return;
      const d = Math.hypot(m.x - x, m.y - y);
      if (d < CONFIG.MISSION_RANGE && d < bestD) { best = m; bestD = d; }
    });
    return best;
  }

  // 화면 가장자리 안내용: 너무 멀지 않은 가장 가까운 미션 하나
  function nearestHint(room, x, y) {
    let best = null, bestD = Infinity;
    mine(room).forEach((m) => {
      if (m.done) return;
      const d = Math.hypot(m.x - x, m.y - y);
      if (d < bestD) { best = m; bestD = d; }
    });
    return best && bestD < CONFIG.MISSION_HINT_RANGE ? best : null;
  }

  // key: 미션키 또는 미션 객체
  function coolingLeft(key) {
    const k = typeof key === "object" ? sKey(key) : (String(key).includes(":") ? key : Net.myId + ":" + key);
    return Math.max(0, (cooldown[k] || 0) - Date.now());
  }

  // 회의하는 동안 멈춰 있던 시간만큼 미션 시간·대기 시간을 뒤로 미룸
  function shiftTime(ms) {
    if (!(ms > 0)) return;
    Object.values(sessions).forEach((s) => { s.deadline += ms; if (s.lockUntil) s.lockUntil += ms; s.startedAt += ms; });
    Object.keys(cooldown).forEach((k) => { if (cooldown[k] > Date.now() - ms) cooldown[k] += ms; });
  }

  // ─────────────────────────────────────────────────────────────
  // 문제 고르기 (같은 판에서 같은 문제가 다시 나오지 않게)
  // ─────────────────────────────────────────────────────────────
  function pickQuestion(type, diff) {
    const pool = QUESTIONS.filter((q) => q.missionType === type);
    const order = [diff, diff - 1, diff + 1, diff - 2, diff + 2].filter((d) => d >= 1 && d <= 3);
    for (const d of order) {
      const c = pool.filter((q) => q.difficulty === d && !usedQ.has(q.id));
      if (c.length) return c[Math.floor(Math.random() * c.length)];
    }
    // 모두 나왔다면 (아주 드묾) 다시 사용
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function timeLimit(settings, diff) {
    if (settings.quick || settings.mode === "quick") return CONFIG.MISSION_TIME_LIMIT.quick;
    return CONFIG.MISSION_TIME_LIMIT[diff] || 50;
  }

  // ─────────────────────────────────────────────────────────────
  // 미션 열기 → MISSION 상태로
  // ─────────────────────────────────────────────────────────────
  function tryOpen(room, x, y) {
    const m = nearMine(room, x, y);
    if (!m) return false;
    if (PlayerState.isFrozen(room, Net.myId)) { toast("🧊 얼어서 미션을 할 수 없어요! 친구가 [땡] 해 줄 때까지 기다려요."); return false; }
    const now = Date.now();
    const k = sKey(m);
    let s = sessions[k];

    // 창을 닫은 사이에 제한 시간이 지났다면 → 시간 초과 처리
    if (s && now > s.deadline) {
      record(room, m, s, false, true);
      delete sessions[k];
      cooldown[k] = s.deadline + CONFIG.MISSION_RETRY_SEC * 1000;
      drops[k] = (drops[k] || 0) + 1;
      s = null;
    }
    const left = coolingLeft(k);
    if (left > 0) { toast(`⏳ ${Math.ceil(left / 1000)}초 뒤에 다시 도전할 수 있어요.`); return false; }

    if (!s) {
      const settings = roomSettings(room);
      const diff = clamp((Number(settings.difficulty) || 2) - (drops[k] || 0), 1, 3);
      const q = pickQuestion(m.def.type, diff);
      usedQ.add(q.id);
      s = { q, diff, startedAt: now, deadline: now + timeLimit(settings, q.difficulty) * 1000, wrong: 0, lockUntil: 0 };
      sessions[k] = s;
    }
    if (m.help) toast(`🤝 ${colorNameOf(room, m.owner)} 친구의 미션을 도와줘요!`);
    GSM.set("MISSION", { m, session: s, fake: isFake(room, Net.myId) });
    return true;
  }

  // 오답: 1번째 문구만 → 2번째 힌트 → 3번째부터 식의 구조
  function onWrong(session) {
    session.wrong++;
    session.lockUntil = Date.now() + CONFIG.WRONG_LOCK_SEC * 1000;
    return feedbackFor(session);
  }

  function feedbackFor(session) {
    const q = session.q;
    if (session.wrong <= 0) return null;
    if (session.wrong === 1) return { level: 1, text: "다시 확인해보세요." };
    if (session.wrong === 2) return { level: 2, text: "💡 " + q.hint };
    return { level: 3, text: "💡 " + q.hint, steps: q.steps };
  }

  function onCorrect(m, session) {
    const room = Net.room;
    const fake = isFake(room, Net.myId);
    const owner = m.owner || Net.myId;   // 협동 모드에서는 도와준 친구의 미션이 완료됨
    const path = (fake ? "fakeDone/" : "done/") + owner + "/" + m.key;
    const upd = { [path]: Net.now() };
    Object.assign(upd, recordUpdate(m, session, true, false, fake));
    Net.roomUpdate(upd);
    delete sessions[sKey({ owner, key: m.key })];
    effects.push({ x: m.x, y: m.y, t0: performance.now() });
    setTimeout(() => AudioManager.playSFX("missionComplete"), 250);
  }

  function onTimeout(m, session) {
    record(Net.room, m, session, false, true);
    const k = sKey({ owner: m.owner || Net.myId, key: m.key });
    delete sessions[k];
    cooldown[k] = Date.now() + CONFIG.MISSION_RETRY_SEC * 1000;
    drops[k] = (drops[k] || 0) + 1;
  }

  // ── 학습 기록 ──
  function recordUpdate(m, s, correct, timeout, fake) {
    const id = Date.now().toString(36) + randomId(4);
    return {
      [`results/${Net.myId}/${id}`]: {
        // 이름·역할도 함께 저장 (게임 중 나간 학생도 교사용 결과에 남도록)
        nick: Roster.nick(Net.room, Net.myId), role: Roles.isSaboteur(Net.room, Net.myId) ? "saboteur" : "student",
        qid: s.q.id, loc: m.loc, type: s.q.missionType, category: s.q.category,
        difficulty: s.q.difficulty, correct, timeout, helped: !!m.help,
        attempts: s.wrong + (correct ? 1 : 0),
        solveSec: Math.round((Date.now() - s.startedAt) / 100) / 10,
        fake: !!fake, t: Net.now(),
      },
    };
  }
  function record(room, m, s, correct, timeout) {
    Net.roomUpdate(recordUpdate(m, s, correct, timeout, isFake(room, Net.myId)));
  }

  // 새로 가까워진 장치 (미션 발견 효과음용)
  function checkFound(room, x, y) {
    const m = nearMine(room, x, y);
    const key = m ? sKey(m) : null;
    if (key && key !== lastNearKey) Sound.play("found", 0.5);
    lastNearKey = key;
    return m;
  }

  function getEffects() {
    const now = performance.now();
    effects = effects.filter((e) => now - e.t0 < 1200);
    return effects;
  }

  // DEBUG: 내 미션 하나 바로 완료
  function debugCompleteOne(room) {
    const m = mine(room).find((x) => !x.done);
    if (!m) return toast("남은 미션이 없어요.");
    const q = pickQuestion(m.def.type, 2);
    onCorrect(m, { q, startedAt: Date.now(), wrong: 0 });
    toast(`(DEBUG) ${m.def.short} 완료`);
  }

  return {
    resetLocal, assign, missionsOf, mine, targets, helpTargets, progress, nearMine, nearestHint, coolingLeft, shiftTime,
    tryOpen, onWrong, onCorrect, onTimeout, feedbackFor, checkFound, getEffects, isFake,
    debugCompleteOne,
  };
})();
