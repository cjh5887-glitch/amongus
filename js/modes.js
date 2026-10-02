/* =====================================================================
   modes.js — 게임 모드 관리 (하나의 게임 엔진 · 모드에 따라 규칙만 다름)

   GameModeManager   지금 방의 모드를 알려 주고, 모드별 규칙으로 연결
   FreezeTagMode     ❄️ 얼음땡   (학생 / 술래)
   AmongUsMode       🕵️ 어몽어스 (학생 / 방해꾼)

   두 모드가 함께 쓰는 것: 맵 · 캐릭터 · 충돌 · 수학 미션 · 문제은행 · 학교 복구율 ·
                          학습 기록 · 대기방 · 환경설정 · 소리

   모드마다 다른 것 (각 모드 객체가 가진 값·함수)
     special          특별 역할 이름 ("tagger" / "saboteur")
     assignRoles()    역할 배정
     missionRoles     미션을 받는 역할 (술래는 미션 없음, 방해꾼은 가짜 미션)
     meetingsEnabled  신고 · 긴급회의 · 투표 사용 여부
     checkWinCondition()  승패 판정 (한 곳에서, 정해진 순서대로 · 방장 화면만 결과를 저장)
     timeWinner       시간이 끝났을 때 이기는 팀
     hud()            보여 줄 버튼
     frame()          매 프레임 할 일 (잡기 · 땡 · 얼리기 버튼 상태 등)
   ===================================================================== */

// ─────────────────────────────────────────────────────────────
// 설정 항목 (교사 방 만들기 · 게임 설정 화면)
// ─────────────────────────────────────────────────────────────
const SETTING_FIELDS = {
  common: [
    { key: "gameMode", label: "게임 모드", options: [["FREEZE_TAG", "❄️ 얼음땡"], ["AMONG_US", "🕵️ 어몽어스"]] },
    { key: "gameMinutes", label: "게임 시간", options: [[8, "8분"], [10, "10분"], [12, "12분"], [15, "15분"]] },
    { key: "missionCount", label: "학생당 미션 수", options: [[3, "3개"], [5, "5개"], [7, "7개"]] },
    { key: "difficulty", label: "문제 난이도", options: [[1, "쉬움"], [2, "보통"], [3, "어려움"]] },
  ],
  FREEZE_TAG: [
    { key: "taggers", label: "술래 수", options: [["auto", "자동 추천"], [1, "1명"], [2, "2명"], [3, "3명"]], recommend: "tagger" },
    { key: "taggerSpeed", label: "술래 속도", options: [[1, "학생과 같게"], [1.1, "조금 빠르게"], [1.2, "빠르게"]] },
    { key: "tagCooldown", label: "잡기 쿨타임", options: [[5, "5초"], [7, "7초"], [10, "10초"]] },
    { key: "rescueHold", label: "땡 시간", options: [[1, "1초"], [1.5, "1.5초"], [2, "2초"]], note: "얼어 있는 친구 옆에서 [땡] 버튼을 이 시간만큼 누르고 있으면 풀려요." },
    { key: "protectSec", label: "땡 후 보호 시간", options: [[3, "3초"], [5, "5초"], [7, "7초"]], note: "땡으로 풀린 학생은 이 시간 동안 다시 잡히지 않아요." },
  ],
  AMONG_US: [
    { key: "saboteurPick", label: "방해꾼 배정", options: [["random", "🎲 자동"], ["teacher", "✋ 직접 선택"]], note: "직접 선택: 대기방의 「방해꾼 설정」 칸(또는 [🕵️ 방해꾼 지정])에서 학생을 골라요. 누구를 골랐는지는 선생님 화면에만 보이고 학생에게는 전달되지 않아요." },
    { key: "saboteurs", label: "방해꾼 수", options: [["auto", "추천"], [1, "1명"], [2, "2명"], [3, "3명"]], recommend: "saboteur" },
    { key: "freezeCooldown", label: "얼리기 쿨타임", options: [[20, "20초"], [25, "25초"], [30, "30초"], [35, "35초"]] },
    { key: "abilities", label: "방해 기능", toggles: [["blackout", "정전"], ["lockDoor", "문 잠금"], ["disguise", "위장"]] },
    { key: "meetingLimit", label: "긴급회의 횟수", options: [[1, "1회"], [2, "2회"], [3, "3회"]], note: "긴급회의 버튼은 한 사람당 1번씩, 게임 전체로는 이 횟수까지. 얼음 흔적 신고는 따로 셉니다." },
  ],
  extra: [
    { key: "quick", label: "빠른 게임", options: [[false, "끔"], [true, "켬"]], note: "켜면 게임 8분 · 미션 3개 · 긴급회의 2회 · 미션 제한 시간 40초로 바뀌어요." },
    { key: "speed", label: "이동 속도", options: [["slow", "느리게"], ["normal", "보통"], ["fast", "빠르게"]] },
    { key: "coop", label: "협동 모드", options: [[false, "끔"], [true, "켬"]], note: "자기 미션을 끝낸 학생이 친구 미션을 도울 수 있어요 (학생팀이 이기기 쉬워져요)" },
    { key: "revealRole", label: "제외된 사람 역할", options: [[true, "공개"], [false, "비공개"]], note: "투표로 제외된 사람이 방해꾼이었는지 알려 줄까요?", only: "AMONG_US" },
  ],
};

// 색 이름으로 부르기 (게임 중에는 닉네임 대신 색으로만 구별)
function colorNameOf(room, pid) {
  const p = Roster.info(room, pid);
  return p ? colorOf(p.color).name : "누군가";
}

// ═════════════════════════════════════════════════════════════
// ❄️ 얼음땡 모드
// ═════════════════════════════════════════════════════════════
const FreezeTagMode = (() => {
  const C = () => CONFIG.FREEZE_TAG;
  let lastCatchNet = 0;          // 내가 마지막으로 잡은 시각 (방 시계)
  let rescue = null;             // { target, t0 }  땡 누르는 중
  let rescueNearKey = "";
  let frozenAt = 0;              // 내가 얼었던 시각 (미션 시간 멈춤용)
  let prevFrozen = {}, prevProtect = {};
  let myPrevState = "NORMAL";
  let fx = [];                   // 맵 위 효과 (얼음 · 깨짐)

  function resetLocal() {
    lastCatchNet = 0; rescue = null; rescueNearKey = ""; frozenAt = 0;
    prevFrozen = {}; prevProtect = {}; myPrevState = "NORMAL"; fx = [];
  }

  const settings = (room) => roomSettings(room);

  // 술래가 다음에 잡을 수 있는 시각 (게임 시작 후 잠깐은 못 잡음 → 학생이 흩어질 시간)
  function catchReadyAt(room) {
    const g = (room && room.game) || {};
    const first = (g.startAt || 0) + C().FIRST_TAG_SEC * 1000;
    const cd = lastCatchNet ? lastCatchNet + settings(room).tagCooldown * 1000 : 0;
    let t = Math.max(first, cd);
    // 게임 시간이 멈춘 동안(없음)을 대비해 여유
    return t;
  }
  const catchLeft = (room) => Math.max(0, catchReadyAt(room) - Net.now());

  const isStudent = (room, pid) => room.roles && room.roles[pid] === "student";

  // 내 주변의 잡을 수 있는 학생 (얼지 않았고, 보호 중이 아닌)
  function catchTarget(room) {
    let best = null, bestD = Infinity;
    Player.others.forEach((o, pid) => {
      if (!Roster.has(room, pid) || !isStudent(room, pid)) return;
      if (PlayerState.of(room, pid) !== PlayerState.NORMAL) return;
      const d = Math.hypot(o.x - Player.me.x, o.y - Player.me.y);
      if (d < C().TAG_RANGE && d < bestD) { best = pid; bestD = d; }
    });
    return best;
  }

  // 내 주변의 얼어 있는 친구
  function rescueTarget(room) {
    let best = null, bestD = Infinity;
    Player.others.forEach((o, pid) => {
      if (!Roster.has(room, pid) || !PlayerState.isFrozen(room, pid)) return;
      const d = Math.hypot(o.x - Player.me.x, o.y - Player.me.y);
      if (d < C().RESCUE_RANGE && d < bestD) { best = pid; bestD = d; }
    });
    return best;
  }

  // ── [잡기] (술래) ──
  function tryCatch(room) {
    if (!room || !Roles.isTagger(room, Net.myId) || !GSM.is("PLAYING")) return;
    const left = catchLeft(room);
    if (left > 0) { toast(`⏳ ${Math.ceil(left / 1000)}초 뒤에 잡을 수 있어요.`); return; }
    const t = catchTarget(room);
    if (!t) { toast("가까이에 잡을 수 있는 학생이 없어요."); return; }
    lastCatchNet = Net.now();
    Net.roomUpdate({ [`frozen/${t}`]: { by: Net.myId, t: Net.now() }, [`protect/${t}`]: null, [`rescuing/${t}`]: null });
    AudioManager.playSFX("tag");
    toast(`❄️ ${colorNameOf(room, t)} 학생을 잡았어요!`);
  }

  // ── [땡] (학생, 누르고 있기) ──
  function updateRescue(room, holding) {
    const me = Net.myId;
    const can = isStudent(room, me) && !PlayerState.isFrozen(room, me) && GSM.is("PLAYING");
    const target = can ? rescueTarget(room) : null;
    if (!holding || !target) {
      if (rescue) {
        Net.roomUpdate({ [`rescuing/${rescue.target}`]: null });
        rescue = null;
      }
      return { target, progress: 0 };
    }
    const hold = Number(settings(room).rescueHold || 1) * 1000;
    if (!rescue || rescue.target !== target) {
      if (rescue) Net.roomUpdate({ [`rescuing/${rescue.target}`]: null });
      rescue = { target, t0: Date.now() };
      Net.roomUpdate({ [`rescuing/${target}`]: { by: me, t: Net.now() } });
      AudioManager.playSFX("rescueStart");
    }
    const progress = clamp((Date.now() - rescue.t0) / hold, 0, 1);
    if (progress >= 1) {
      Net.roomUpdate({
        [`frozen/${target}`]: null,
        [`rescuing/${target}`]: null,
        [`protect/${target}`]: Net.now() + Number(settings(room).protectSec || 5) * 1000,
        [`rescues/${me}`]: ((room.rescues && room.rescues[me]) || 0) + 1,
      });
      AudioManager.playSFX("rescueDone");
      toast(`🔔 땡! ${colorNameOf(room, target)} 친구를 구했어요!`);
      rescue = null;
      Input.release("rescue");
      Input.release("report");
      return { target: null, progress: 0 };
    }
    return { target, progress };
  }

  let rescueView = { target: null, progress: 0 };

  // 매 프레임
  function frame(dt, room) {
    const me = Net.myId;
    const state = PlayerState.of(room, me);
    // 내가 얼었을 때: 미션 닫기 + 미션 시간 멈춤
    if (state === PlayerState.FROZEN) {
      if (!frozenAt) {
        frozenAt = Date.now();
        if (GSM.is("MISSION")) GSM.set("PLAYING");
      }
    } else if (frozenAt) {
      MissionSys.shiftTime(Date.now() - frozenAt);
      frozenAt = 0;
    }
    // 내 상태가 바뀔 때 소리
    if (state !== myPrevState) {
      if (state === PlayerState.FROZEN) { AudioManager.playSFX("iceStart"); setTimeout(() => AudioManager.playSFX("iceDone"), 350); }
      if (myPrevState === PlayerState.FROZEN && state !== PlayerState.GHOST) {
        AudioManager.playSFX("iceBreak");
        if (state === PlayerState.PROTECTED) setTimeout(() => AudioManager.playSFX("protect"), 300);
        toast("🔔 땡! 다시 움직일 수 있어요. 잠깐 동안 보호받아요 🛡");
      }
      myPrevState = state;
    }
    const holding = Input.isHeld("rescue") || Input.isHeld("report");
    rescueView = updateRescue(room, holding);
  }

  // 방 정보가 바뀔 때: 누가 얼었는지/풀렸는지 → 맵 위 효과
  function onRoom(room) {
    const frozen = room.frozen || {};
    const now = performance.now();
    const posOf = (pid) => (pid === Net.myId ? Player.me : Player.others.get(pid));
    Object.keys(frozen).forEach((pid) => {
      if (!prevFrozen[pid]) { const p = posOf(pid); if (p) fx.push({ x: p.x, y: p.y, t0: now, kind: "ice" }); }
    });
    Object.keys(prevFrozen).forEach((pid) => {
      if (!frozen[pid]) { const p = posOf(pid); if (p) fx.push({ x: p.x, y: p.y, t0: now, kind: "break" }); }
    });
    prevFrozen = { ...frozen };
  }

  function hud(room, pid) {
    if (Roles.isTagger(room, pid)) return { catch: true, map: true };
    return { mission: true, rescue: true, map: true };
  }

  // 버튼 상태 (잡기 · 땡)
  function buttons(room) {
    const me = Net.myId;
    if (Roles.isTagger(room, me)) {
      const left = catchLeft(room);
      const target = GSM.is("PLAYING") ? catchTarget(room) : null;
      return { catch: { label: left > 0 ? `잡기 ${Math.ceil(left / 1000)}초` : "잡기", icon: "✋", ready: left === 0 && !!target, cooling: left > 0 } };
    }
    const frozen = PlayerState.isFrozen(room, me);
    return { rescue: { ready: !frozen && !!rescueView.target, progress: rescueView.progress } };
  }

  function banner(room) {
    const me = Net.myId;
    const st = PlayerState.of(room, me);
    if (st === PlayerState.FROZEN) {
      const r = room.rescuing && room.rescuing[me];
      return ["frozen", r ? "🔔 친구가 땡 하는 중…!" : "🧊 얼음! 친구가 와서 [땡] 해 주면 풀려요"];
    }
    if (st === PlayerState.PROTECTED) return ["protect", `🛡 보호 중 ${Math.ceil(PlayerState.protectLeft(room, me) / 1000)}초`];
    const g = room.game || {};
    const startLeft = (g.startAt || 0) + C().FIRST_TAG_SEC * 1000 - Net.now();
    if (startLeft > 0 && GSM.is("PLAYING")) {
      return ["tagger", Roles.isTagger(room, me) ? `✋ ${Math.ceil(startLeft / 1000)}초 뒤부터 잡을 수 있어요` : `❄️ 술래가 ${Math.ceil(startLeft / 1000)}초 뒤에 출발해요! 흩어지세요!`];
    }
    return null;
  }

  // 그리기 정보 추가 (술래 표시 · 보호막 · 땡 진행)
  function decorate(room, list) {
    const hold = Number(settings(room).rescueHold || 1) * 1000;
    list.forEach((p) => {
      if (!p.pid) return;
      p.tagger = Roles.isTagger(room, p.pid);                 // 술래는 모두에게 공개
      p.frozen = PlayerState.isFrozen(room, p.pid);
      p.shield = PlayerState.isProtected(room, p.pid);
      const r = room.rescuing && room.rescuing[p.pid];
      if (p.frozen && r) p.rescue = rescueView.target === p.pid ? rescueView.progress : clamp((Net.now() - r.t) / hold, 0, 1);
    });
  }

  function getFx() {
    const now = performance.now();
    fx = fx.filter((e) => now - e.t0 < 900);
    return fx;
  }

  function speedMult(room, pid) {
    return Roles.isTagger(room, pid) ? Number(settings(room).taggerSpeed || 1) : 1;
  }

  function onAction(name, room) {
    if (name === "catch") tryCatch(room);
  }

  // 승패 (미션 100% · 시간 종료는 game.js 에서 공통으로 처리)
  function checkWin(room) {
    const ids = Roster.ids(room);
    const students = ids.filter((pid) => isStudent(room, pid));
    const taggers = ids.filter((pid) => Roles.isTagger(room, pid));
    if (Roles.taggers(room).length > 0 && taggers.length === 0) return { winner: "student", reason: "taggerLeft" };
    if (!students.length) return Roles.taggers(room).length ? { winner: "tagger", reason: "studentsLeft" } : null;
    if (students.every((pid) => PlayerState.isFrozen(room, pid))) return { winner: "tagger", reason: "allFrozen" };
    return null;
  }

  // 얼음땡 승패 판정 (한 곳에서, 순서대로)
  //  1. 학교 복구율 100% → 학생 승리   2. 술래가 모두 나감 → 학생 승리
  //  3. 모든 학생이 동시에 얼음 → 술래 승리   4. 제한 시간 종료 → 술래 승리
  function checkWinCondition(room, now = Net.now()) {
    if (!room || !room.roles) return null;
    const pr = MissionSys.progress(room);
    if (pr.total > 0 && pr.done >= pr.total) return { winner: "student", reason: "missions" };
    const w = checkWin(room);
    if (w) return w;
    const g = room.game || {};
    if (g.endAt && !g.pausedAt && now >= g.endAt) return { winner: "tagger", reason: "time" };
    return null;
  }

  function roleInfo(room, myId) {
    const role = room.roles && room.roles[myId];
    const taggers = Roles.taggers(room);
    const list = taggers.filter((id) => id !== myId).map((id) => `${colorNameOf(room, id)}(${Roster.nick(room, id)})`);
    if (role === "tagger") {
      return {
        cls: "tagger", name: "술래",
        desc: "학생에게 가까이 가서 <b>[잡기]</b>로 얼리세요.<br>모든 학생을 동시에 얼리거나, 시간이 끝날 때까지 복구를 막으면 승리!",
        mates: list.length ? "함께하는 술래: " + list.join(", ") : "",
      };
    }
    return {
      cls: "student", name: "학생",
      desc: "미션을 해결해 학교를 복구하세요.<br>술래에게 잡히면 얼음! 친구가 <b>[땡]</b>으로 풀어 줄 수 있어요.",
      mates: taggers.length ? `술래는 ${taggers.map((id) => `${colorNameOf(room, id)}(${Roster.nick(room, id)})`).join(", ")} — 머리 위 「술래」 표시를 보고 피하세요!` : "",
    };
  }

  return {
    id: GAME_MODES.FREEZE_TAG, name: "얼음땡", icon: "❄️", special: "tagger", meetingsEnabled: false,
    desc: "술래를 피해 다니며 미션을 해결해요. 잡히면 얼음! 친구가 [땡] 해 주면 다시 움직여요.",
    missionRoles: ["student"], timeWinner: "tagger",
    story: () => STORY_LINES_FT,
    roleCount: (n, s) => Roles.taggerCount(n, s.taggers),
    tooMany: (n, s) => Roles.tooManyTaggers(n, s.taggers),
    assignRoles: (ids, s, forced) => Roles.assignSpecial(ids, Roles.taggerCount(ids.length, s.taggers), "tagger", forced),
    resetLocal, frame, onRoom, hud, buttons, banner, decorate, getFx, speedMult, onAction, checkWin, checkWinCondition, roleInfo,
    catchTarget, rescueTarget, catchLeft,
  };
})();

// ═════════════════════════════════════════════════════════════
// 🧊 FrozenMarker — (어몽어스) 신고할 수 있는 얼음 흔적
//   탈락한 학생(유령)과는 별개의 객체입니다. 유령은 계속 움직이지만 흔적은 얼려진 자리에 남아요.
//   방 데이터 frozenMarkers/{playerId} = { playerId, x, y, color, reported, createdAt, by }
//   ▸ 신고되어 회의가 시작되면 그때 맵에 있던 흔적은 모두 reported = true (맵에서 사라지고 다시 신고 불가)
// ═════════════════════════════════════════════════════════════
const FrozenMarker = {
  make(playerId, x, y, color) {
    return { playerId, x: Math.round(x), y: Math.round(y), color: color == null ? 0 : color, reported: false, createdAt: Net.now(), by: Net.myId };
  },
  list(room) {
    const all = (room && room.frozenMarkers) || {};
    return Object.keys(all).map((id) => ({ playerId: id, ...all[id] })).filter((m) => typeof m.x === "number");
  },
  of(room, playerId) { return FrozenMarker.list(room).find((m) => m.playerId === playerId) || null; },
  // 신고 거리 안의 가장 가까운 (아직 신고되지 않은) 흔적
  near(room, x, y, range = CONFIG.AMONG_US.REPORT_DISTANCE || CONFIG.REPORT_RANGE) {
    let best = null, bestD = Infinity;
    FrozenMarker.list(room).forEach((m) => {
      if (m.reported) return;
      const d = Math.hypot(m.x - x, m.y - y);
      if (d < range && d < bestD) { best = m; bestD = d; }
    });
    return best;
  },
  reportable(room, playerId) { const m = FrozenMarker.of(room, playerId); return !!(m && !m.reported); },
  // 회의 시작 때: 지금 맵에 있는 흔적을 모두 "신고됨"으로
  markAllReportedUpdate(room) {
    const upd = {};
    FrozenMarker.list(room).forEach((m) => { if (!m.reported) upd[`frozenMarkers/${m.playerId}/reported`] = true; });
    return upd;
  },
};

// ═════════════════════════════════════════════════════════════
// 🕵️ 어몽어스 모드
// ═════════════════════════════════════════════════════════════
const AmongUsMode = (() => {
  const C = () => CONFIG.AMONG_US;
  let freezeReady = 0;           // 얼리기 가능한 시각 (Date.now 기준)
  let myFreezeAt = 0;            // 내가 얼려진 순간 (연출용)
  let knownGhost;               // undefined = 아직 모름 (처음 방 정보를 받기 전)
  let sabotageOpen = false;

  function resetLocal() {
    freezeReady = Date.now() + C().FIRST_FREEZE_SEC * 1000;
    myFreezeAt = 0; knownGhost = undefined;
    setSabotageOpen(false);
  }

  function afterMeeting(room) {
    const cd = Number(roomSettings(room).freezeCooldown || 25) * 1000;
    freezeReady = Math.max(freezeReady, Date.now() + Math.min(cd, C().AFTER_MEETING_FREEZE_SEC * 1000));
    setSabotageOpen(false);
  }

  const freezeLeft = () => Math.max(0, freezeReady - Date.now());

  // 얼릴 수 있는 가장 가까운 일반 학생
  function freezeTarget(room) {
    let best = null, bestD = Infinity;
    Player.others.forEach((o, pid) => {
      if (!Roster.has(room, pid) || !Abilities.isAlive(room, pid) || room.roles[pid] !== "student") return;
      const d = Math.hypot(o.x - Player.me.x, o.y - Player.me.y);
      if (d < C().FREEZE_RANGE && d < bestD) { best = pid; bestD = d; }
    });
    return best;
  }

  // ── [얼리기] (방해꾼) → 학생 탈락 → 유령 + 얼음 흔적 ──
  function tryFreeze(room) {
    if (!room || !Roles.isSaboteur(room, Net.myId) || !Abilities.isAlive(room, Net.myId) || !GSM.is("PLAYING")) return;
    const left = freezeLeft();
    if (left > 0) { toast(`⏳ ${Math.ceil(left / 1000)}초 뒤에 얼릴 수 있어요.`); return; }
    const t = freezeTarget(room);
    if (!t) { toast("가까이에 얼릴 수 있는 학생이 없어요."); return; }
    const o = Player.others.get(t);
    const info = Roster.info(room, t) || {};
    // 탈락(유령)과 신고용 얼음 흔적(FrozenMarker)을 한 번에 저장 → 유령이 되기 전에 위치가 사라지는 일이 없음
    Net.roomUpdate({
      [`ghosts/${t}`]: "frozen",
      [`frozenMarkers/${t}`]: FrozenMarker.make(t, o.tx != null ? o.tx : o.x, o.ty != null ? o.ty : o.y, info.color),
    });
    freezeReady = Date.now() + Number(roomSettings(room).freezeCooldown || 25) * 1000;
    AudioManager.playSFX("iceStart");
    setTimeout(() => AudioManager.playSFX("iceDone"), 400);
    toast(`🧊 ${colorNameOf(room, t)} 학생을 얼렸어요!`);
  }

  // [방해] 버튼: 정전 · 문 잠금 · 위장 버튼 열고 닫기
  function setSabotageOpen(on) {
    sabotageOpen = !!on;
    document.body.classList.toggle("sabotage-open", sabotageOpen);
    if (!on) Abilities.closeDoorPicker();
  }

  function onAction(name, room) {
    if (name === "catch") tryFreeze(room);
    if (name === "sabotage" && Roles.isSaboteur(room, Net.myId) && Abilities.isAlive(room, Net.myId)) {
      setSabotageOpen(!sabotageOpen);
      AudioManager.playSFX(sabotageOpen ? "menuOpen" : "menuClose");
    }
  }

  // 방 정보가 바뀔 때: 내가 얼려졌는지 확인 → 얼음 연출 후 유령
  function onRoom(room) {
    const reason = PlayerState.ghostReason(room, Net.myId);
    if (knownGhost === undefined) { knownGhost = reason; return; }   // 처음(다시 들어온 경우 포함)에는 연출 없이
    if (reason === "frozen" && knownGhost !== "frozen") {
      myFreezeAt = Date.now();
      const tr = FrozenMarker.of(room, Net.myId);
      if (tr) Player.placeMe({ x: tr.x, y: tr.y });
      if (GSM.is("MISSION")) GSM.set("PLAYING");
      AudioManager.playSFX("iceStart");
      setTimeout(() => AudioManager.playSFX("iceDone"), 400);
      setTimeout(() => toast("👻 방해꾼에게 얼려졌어요. 이제 유령이 되어 미션을 계속할 수 있어요!", 5000), C().FREEZE_ANIM_MS);
    }
    knownGhost = reason;
  }

  // 얼음에 갇히는 연출 중인지 (이 동안은 움직이지 않음)
  const freezingNow = () => myFreezeAt && Date.now() - myFreezeAt < C().FREEZE_ANIM_MS + 400;

  function frame() {
    if (!Roles.isSaboteur(Net.room, Net.myId) || !Abilities.isAlive(Net.room, Net.myId)) {
      if (sabotageOpen) setSabotageOpen(false);
    }
  }

  function hud(room, pid) {
    const ghost = Abilities.isGhost(room, pid);
    if (Roles.isSaboteur(room, pid)) {
      if (ghost) return { mission: true, map: true };
      return { catch: true, sabotage: true, report: true, mission: true, map: true };   // 방해꾼도 신고 가능
    }
    if (ghost) return { mission: true, map: true };
    return { mission: true, report: true, map: true };
  }

  function buttons(room) {
    if (!Roles.isSaboteur(room, Net.myId) || !Abilities.isAlive(room, Net.myId)) return {};
    const left = freezeLeft();
    const target = GSM.is("PLAYING") ? freezeTarget(room) : null;
    return {
      catch: { label: left > 0 ? `얼리기 ${Math.ceil(left / 1000)}초` : "얼리기", icon: "🧊", ready: left === 0 && !!target, cooling: left > 0 },
      sabotage: { open: sabotageOpen },
    };
  }

  function banner(room) {
    if (freezingNow()) return ["frozen", "🧊 얼음에 갇혔어요!"];
    return null;
  }

  // 맵에 남아 있는(아직 신고되지 않은) 얼음 흔적 목록 (그리기용)
  function traces(room) {
    return FrozenMarker.list(room).filter((m) => !m.reported).map((m) => ({ ...m, pid: m.playerId, t: m.createdAt }));
  }

  // 신고할 수 있는 가까운 얼음 흔적 → 그 흔적의 playerId
  function traceNear(room, x, y) {
    const m = FrozenMarker.near(room, x, y);
    return m ? m.playerId : null;
  }

  // 신고할 수 있는 사람인지 (PC R 키 · 태블릿 [신고] 버튼이 모두 이 판정을 사용)
  //  canReport = 살아 있음(유령 아님) && 이번 게임 참가자 && (학생 || 방해꾼)
  function canReport(room, pid) {
    if (!room || !room.roles || !GameModeManager.isAU(room)) return false;
    if (!Roster.has(room, pid)) return false;
    if (PlayerState.of(room, pid) !== PlayerState.NORMAL) return false;
    const role = room.roles[pid];
    return role === "student" || role === "saboteur";
  }

  // 긴급회의 버튼을 누를 수 있는 사람인지 — 신고와는 따로 판정
  //  canCallEmergency = 살아 있음 && 이번 게임 참가자 && 일반 학생   (방해꾼 · 유령은 불가)
  function canCallEmergency(room, pid) {
    if (!room || !room.roles || !GameModeManager.isAU(room)) return false;
    if (!Roster.has(room, pid)) return false;
    if (PlayerState.of(room, pid) !== PlayerState.NORMAL) return false;
    return room.roles[pid] === "student";
  }

  // ─────────────────────────────────────────────────────────────
  // 승패 판정 (어몽어스) — 한 곳에서, 정해진 순서대로
  //   1. 살아 있는 방해꾼 0명            → 학생팀 승리
  //   2. 학교 복구율 100%                → 학생팀 승리
  //   3. 살아 있는 학생 ≤ 살아 있는 방해꾼 → 방해꾼 승리 (1대1, 2대2 …)
  //   4. 제한 시간 종료                  → 방해꾼 승리
  //  ▸ 살아 있는 사람: 이번 게임 명단에 있고(완전히 나간 사람 제외) 유령이 아닌 사람
  //  ▸ 방장 화면이 방 정보가 바뀔 때마다 부르고, 결과(GAMEOVER·winner)를 모두에게 저장
  // ─────────────────────────────────────────────────────────────
  function checkAmongUsWinCondition(room, now = Net.now()) {
    if (!room || !room.roles) return null;
    const assigned = Roles.saboteurs(room).length;       // 처음에 정해진 방해꾼 수
    const alive = Roster.ids(room).filter((pid) => !PlayerState.isGhost(room, pid));
    const aliveImpostors = alive.filter((pid) => room.roles[pid] === "saboteur").length;
    const aliveCrew = alive.filter((pid) => room.roles[pid] === "student").length;
    // (DEBUG 혼자 테스트처럼 방해꾼이 처음부터 없는 게임은 인원 승패를 보지 않음)
    if (assigned > 0 && aliveImpostors === 0) {
      const allLeft = Roles.saboteurs(room).every((pid) => !Roster.has(room, pid));
      return { winner: "student", reason: allLeft ? "saboteurLeft" : "voted" };
    }
    const pr = MissionSys.progress(room);
    if (pr.total > 0 && pr.done >= pr.total) return { winner: "student", reason: "missions" };
    if (assigned > 0 && aliveCrew <= aliveImpostors) return { winner: "saboteur", reason: "outnumbered" };
    const g = room.game || {};
    if (g.endAt && !g.pausedAt && now >= g.endAt) return { winner: "saboteur", reason: "time" };
    return null;
  }

  function decorate(room, list) {
    list.forEach((p) => {
      if (p.isMe && freezingNow()) { p.ghost = false; p.frozen = true; p.iceProgress = clamp((Date.now() - myFreezeAt) / C().FREEZE_ANIM_MS, 0, 1); }
    });
  }

  function checkWin(room) { return Meeting.checkWin(room); }
  const checkWinCondition = checkAmongUsWinCondition;

  function roleInfo(room, myId) {
    const role = room.roles && room.roles[myId];
    if (role === "saboteur") {
      const mates = Roles.saboteurs(room).filter((id) => id !== myId).map((id) => `${colorNameOf(room, id)}(${Roster.nick(room, id)})`);
      return {
        cls: "saboteur", name: "방해꾼",
        desc: "학생인 척 행동하세요.<br>학생 가까이에서 <b>[얼리기]</b>, <b>[방해]</b>로 학교 복구를 막으세요.",
        mates: mates.length ? "함께하는 방해꾼: " + mates.join(", ") : "",
      };
    }
    const n = Roles.saboteurs(room).length;
    return {
      cls: "student", name: "학생",
      desc: "학교의 미션을 해결하세요.<br>얼어붙은 친구를 발견하면 <b>[신고]</b>, 방해꾼을 찾아 투표하세요.",
      mates: `우리 가운데 방해꾼이 ${n}명 숨어 있어요.`,
    };
  }

  return {
    id: GAME_MODES.AMONG_US, name: "어몽어스", icon: "🕵️", special: "saboteur", meetingsEnabled: true,
    desc: "학생인 척하는 방해꾼을 찾아요. 방해꾼에게 얼려지면 유령이 되고, 얼음 흔적을 신고하면 긴급회의가 열려요.",
    missionRoles: ["student", "saboteur"], timeWinner: "saboteur",
    story: () => STORY_LINES,
    roleCount: (n, s) => Roles.saboteurCount(n, s.saboteurs),
    tooMany: (n, s) => Roles.tooMany(n, s.saboteurs),
    assignRoles: (ids, s, forced) => Roles.assignSpecial(ids, Roles.saboteurCount(ids.length, s.saboteurs), "saboteur", forced),
    resetLocal, afterMeeting, frame, onRoom, hud, buttons, banner, decorate, onAction, checkWin, checkWinCondition, checkAmongUsWinCondition, roleInfo,
    traces, traceNear, canReport, canCallEmergency, freezeTarget, freezeLeft, freezingNow,
    speedMult: () => 1,
    getFx: () => [],
    get sabotageOpen() { return sabotageOpen; },
    setSabotageOpen,
  };
})();

// ═════════════════════════════════════════════════════════════
// GameModeManager
// ═════════════════════════════════════════════════════════════
const GameModeManager = (() => {
  const MODES = { [GAME_MODES.FREEZE_TAG]: FreezeTagMode, [GAME_MODES.AMONG_US]: AmongUsMode };

  // room 또는 settings 로 모드 찾기
  function idOf(roomOrSettings) {
    if (!roomOrSettings) return DEFAULT_SETTINGS.gameMode;
    const s = roomOrSettings.settings || roomOrSettings.meta ? roomSettings(roomOrSettings) : normalizeSettings(roomOrSettings);
    return s.gameMode;
  }
  const get = (r) => MODES[idOf(r)] || FreezeTagMode;
  const isFT = (r) => idOf(r) === GAME_MODES.FREEZE_TAG;
  const isAU = (r) => idOf(r) === GAME_MODES.AMONG_US;

  // 새 게임을 시작할 때 이 기기의 모드 상태를 모두 초기화 (두 모드 모두)
  function resetLocal() { FreezeTagMode.resetLocal(); AmongUsMode.resetLocal(); }

  // 설정 화면에 보일 항목 (모드에 따라 다름)
  function fields(settings) {
    const id = normalizeSettings(settings).gameMode;
    return {
      common: SETTING_FIELDS.common,
      mode: SETTING_FIELDS[id],
      extra: SETTING_FIELDS.extra.filter((f) => !f.only || f.only === id),
    };
  }

  // 승리 팀 표시
  const WINNERS = {
    student: { title: "학생팀 승리", sub: "학교 복구 성공!", icon: "🎉" },
    tagger: { title: "술래 승리", sub: "학교 복구 실패", icon: "❄️" },
    saboteur: { title: "방해꾼 승리", sub: "학교 복구 실패", icon: "🌙" },
    none: { title: "게임 종료", sub: "선생님이 게임을 끝냈어요", icon: "⏹" },
  };
  const winnerInfo = (w) => WINNERS[w] || WINNERS.none;

  // 우리 팀이 이겼는지 (학생팀: 학생 역할 · 술래팀 · 방해꾼팀)
  function myTeamWon(room, pid) {
    const w = room && room.game && room.game.winner;
    const role = room && room.roles && room.roles[pid];
    if (!w || !role) return null;
    return (role === "student") === (w === "student");
  }

  return { MODES, idOf, get, isFT, isAU, resetLocal, fields, winnerInfo, myTeamWon };
})();
