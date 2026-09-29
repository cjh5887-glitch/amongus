/* =====================================================================
   ui.js — 화면(메인·대기실·역할·스토리·종료)과 HUD, 설정 창
   ===================================================================== */

const UI = (() => {
  const screens = ["title", "lobby", "role", "story", "game", "gameover", "result", "teacher", "waiting"];

  function show(name) {
    screens.forEach((s) => {
      const el = document.getElementById("screen-" + s);
      if (el) el.classList.toggle("active", s === name);
    });
  }

  // 작은 캔버스에 캐릭터 그리기 (대기실·결과 화면용)
  function characterIcon(colorHex, size = 64, opts = {}) {
    const c = document.createElement("canvas");
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = size * dpr; c.height = size * dpr;
    c.style.width = size + "px"; c.style.height = size + "px";
    const g = c.getContext("2d");
    g.scale(dpr, dpr);
    Player.drawCharacter(g, size / 2, size * 0.66, colorHex, { scale: size / 60, dir: 1, ...opts });
    return c;
  }

  // ─────────────────────────────────────────────────────────────
  // 설정 창 (교사 방 만들기 · 대기방 [게임 설정]에서 같이 사용)
  //  항목은 모드에 따라 달라집니다 → modes.js 의 SETTING_FIELDS
  // ─────────────────────────────────────────────────────────────
  function settingRow(f, settings, editable, onChange, playerCount) {
    const row = document.createElement("div");
    row.className = "set-row";
    row.dataset.key = f.key;
    const lab = document.createElement("div");
    lab.className = "set-label";
    lab.textContent = f.label;
    if (f.recommend && playerCount) {
      const rec = document.createElement("small");
      const n = f.recommend === "tagger" ? recommendTaggers(playerCount) : recommendSaboteurs(playerCount);
      rec.textContent = ` (지금 ${playerCount}명 → 추천 ${n}명)`;
      lab.appendChild(rec);
    }
    row.appendChild(lab);
    const opts = document.createElement("div");
    opts.className = "set-options";
    if (f.options) {
      f.options.forEach(([val, text]) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "chip" + (String(settings[f.key]) === String(val) ? " on" : "");
        b.textContent = text;
        b.dataset.val = String(val);
        b.disabled = !editable;
        b.addEventListener("click", () => {
          const next = { ...settings, [f.key]: val };
          if (f.key === "quick") Object.assign(next, MODE_PRESETS[val ? "quick" : "normal"]);
          onChange(next);
        });
        opts.appendChild(b);
      });
    } else if (f.toggles) {
      f.toggles.forEach(([key, text]) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "chip" + (settings[key] ? " on" : "");
        b.textContent = (settings[key] ? "✓ " : "✕ ") + text;
        b.dataset.val = key;
        b.disabled = !editable;
        b.addEventListener("click", () => onChange({ ...settings, [key]: !settings[key] }));
        opts.appendChild(b);
      });
    }
    row.appendChild(opts);
    if (f.note) {
      const n = document.createElement("div");
      n.className = "set-note";
      n.textContent = f.note;
      row.appendChild(n);
    }
    return row;
  }

  function renderSettings(container, settings, editable, onChange, playerCount) {
    settings = normalizeSettings(settings);
    container.innerHTML = "";
    const groups = GameModeManager.fields(settings);
    const mode = GameModeManager.get(settings);
    const section = (title, cls) => {
      const h = document.createElement("div");
      h.className = "set-section " + (cls || "");
      h.textContent = title;
      container.appendChild(h);
    };
    section("공통 설정");
    groups.common.forEach((f) => {
      container.appendChild(settingRow(f, settings, editable, onChange, playerCount));
      if (f.key === "gameMode") {
        const d = document.createElement("div");
        d.className = "set-mode-desc " + mode.id;
        d.textContent = `${mode.icon} ${mode.desc}`;
        container.appendChild(d);
      }
    });
    section(`${mode.icon} ${mode.name} 설정`, "mode " + mode.id);
    groups.mode.forEach((f) => container.appendChild(settingRow(f, settings, editable, onChange, playerCount)));
    const det = document.createElement("details");
    det.className = "set-extra";
    if (openExtra.has(container.id)) det.open = true;
    det.addEventListener("toggle", () => { if (det.open) openExtra.add(container.id); else openExtra.delete(container.id); });
    const sum = document.createElement("summary");
    sum.textContent = "추가 설정 (빠른 게임 · 이동 속도 · 협동 모드" + (mode.id === GAME_MODES.AMONG_US ? " · 역할 공개" : "") + ")";
    det.appendChild(sum);
    groups.extra.forEach((f) => det.appendChild(settingRow(f, settings, editable, onChange, playerCount)));
    container.appendChild(det);
  }
  const openExtra = new Set();

  // 대기방에 보이는 이번 게임 설정 요약 (읽기 전용)
  function settingsSummary(settings) {
    const s = normalizeSettings(settings);
    const mode = GameModeManager.get(s);
    const diff = { 1: "쉬움", 2: "보통", 3: "어려움" }[s.difficulty] || "보통";
    const items = [
      ["게임 시간", s.gameMinutes + "분"], ["학생당 미션", s.missionCount + "개"], ["문제 난이도", diff],
    ];
    if (mode.id === GAME_MODES.FREEZE_TAG) {
      items.push(["술래 수", s.taggers === "auto" ? "자동" : s.taggers + "명"], ["잡기 쿨타임", s.tagCooldown + "초"],
        ["땡 시간", s.rescueHold + "초"], ["땡 후 보호", s.protectSec + "초"]);
    } else {
      const ab = [["blackout", "정전"], ["lockDoor", "문 잠금"], ["disguise", "위장"]].filter(([k]) => s[k]).map(([, t]) => t);
      items.push(["방해꾼 수", s.saboteurs === "auto" ? "자동" : s.saboteurs + "명"], ["얼리기 쿨타임", s.freezeCooldown + "초"],
        ["방해 기능", ab.join("·") || "없음"], ["긴급회의", s.meetingLimit + "회"]);
    }
    if (s.quick) items.push(["빠른 게임", "켬"]);
    if (s.coop) items.push(["협동 모드", "켬"]);
    return items;
  }

  function openModal(id) { document.getElementById(id).classList.add("open"); }
  function closeModal(id) { document.getElementById(id).classList.remove("open"); }

  // ─────────────────────────────────────────────────────────────
  // 대기방 (방 번호 · 게임 모드 · 참가 인원 · 캐릭터 · 닉네임)
  //  ▸ 캐릭터 색은 자동 배정 (학생이 고르지 않음)
  //  ▸ 게임 시작 · 게임 설정 · 플레이어 관리 버튼은 교사에게만
  // ─────────────────────────────────────────────────────────────
  function renderLobby(room, myId, isTeacher) {
    $("#lobby-code").textContent = Net.code;
    const players = room.players || {};
    const ids = Object.keys(players).sort((a, b) => players[a].joinedAt - players[b].joinedAt);
    $("#lobby-count").textContent = `${ids.length} / ${CONFIG.MAX_PLAYERS}명`;
    const settings = normalizeSettings(room.settings);
    const mode = GameModeManager.get(settings);
    const badge = $("#lobby-mode");
    badge.className = "lobby-mode " + mode.id;
    badge.innerHTML = `<b>${mode.icon} ${mode.name} 모드</b><span>${MG.esc(mode.desc)}</span>`;
    const teacherOn = !!(room.teachers && Object.keys(room.teachers).length);
    $("#lobby-teacher").textContent = isTeacher ? "🧑‍🏫 선생님 화면" : teacherOn ? "🧑‍🏫 선생님 접속 중" : "🧑‍🏫 선생님 연결 끊김";
    $("#lobby-teacher").classList.toggle("off", !teacherOn);

    const list = $("#lobby-players");
    list.innerHTML = "";
    ids.forEach((id) => {
      const p = players[id];
      const c = colorOf(p.color);
      const card = document.createElement("div");
      card.className = "player-card" + (id === myId ? " me" : "") + (p.color == null ? " no-color" : "");
      card.appendChild(characterIcon(c.hex, 64));
      const name = document.createElement("div");
      name.className = "pc-name";
      name.textContent = p.nick;
      card.appendChild(name);
      const tag = document.createElement("div");
      tag.className = "pc-tag";
      tag.textContent = c.name + (id === myId ? " · 나" : "") + (p.bot ? " 🤖" : "");
      card.appendChild(tag);
      list.appendChild(card);
    });
    for (let i = ids.length; i < CONFIG.MAX_PLAYERS; i++) {
      const empty = document.createElement("div");
      empty.className = "player-card empty";
      empty.textContent = "빈 자리";
      list.appendChild(empty);
    }

    // 내 색 안내 (학생)
    const mine = players[myId];
    $("#lobby-mycolor").innerHTML = isTeacher ? "" : mine && mine.color != null
      ? `내 캐릭터 색: <b style="color:${colorOf(mine.color).hex}">● ${colorOf(mine.color).name}</b> <small>(색은 자동으로 정해져요 · 게임 중에는 이름 대신 색으로 서로를 구별해요)</small>`
      : "캐릭터 색을 정하는 중…";

    // 이번 게임 설정 (모두 읽기만)
    const sum = $("#lobby-settings");
    sum.innerHTML = settingsSummary(settings).map(([k, v]) => `<div class="sum-row"><span>${MG.esc(k)}</span><b>${MG.esc(String(v))}</b></div>`).join("");
    $("#lobby-settings-title").textContent = "이번 게임 설정";

    // 교사 버튼 · 시작 조건
    $$(".teacher-only").forEach((el) => { el.style.display = isTeacher ? "" : "none"; });
    $$(".student-only").forEach((el) => { el.style.display = isTeacher ? "none" : ""; });
    const start = $("#btn-start");
    const hint = $("#start-hint");
    const min = DEBUG_MODE ? 1 : CONFIG.MIN_PLAYERS;
    if (!isTeacher) {
      hint.textContent = "선생님이 게임을 시작할 때까지 기다려 주세요.";
    } else if (ids.length < min) {
      start.disabled = true;
      hint.textContent = `${CONFIG.MIN_PLAYERS}명 이상 모이면 시작할 수 있어요. (지금 ${ids.length}명)`;
    } else if (mode.id === GAME_MODES.AMONG_US && settings.saboteurPick === "teacher" && Teacher.pickStatus(room).missing > 0) {
      // 교사 직접 지정: 필요한 인원을 다 고를 때까지 시작할 수 없음 (학생 이름은 여기 쓰지 않음 — TV 로 보여 줘도 안전)
      start.disabled = true;
      hint.textContent = `방해꾼을 ${Teacher.pickStatus(room).missing}명 더 선택해주세요. ([🕵️ 방해꾼 지정])`;
    } else if (mode.tooMany(ids.length, settings)) {
      start.disabled = true;
      hint.textContent = mode.id === GAME_MODES.FREEZE_TAG
        ? "술래가 너무 많아요. [게임 설정]에서 술래 수를 줄이거나 '자동 추천'을 골라 주세요."
        : "방해꾼이 너무 많아요. [게임 설정]에서 방해꾼 수를 줄이거나 '자동 추천'을 골라 주세요.";
    } else {
      start.disabled = false;
      const n = mode.roleCount(ids.length, settings);
      const how = mode.id === GAME_MODES.AMONG_US ? (settings.saboteurPick === "teacher" ? " (선생님 지정)" : " (랜덤)") : "";
      hint.textContent = `${mode.icon} ${mode.name} · ${ids.length}명 · ${mode.id === GAME_MODES.FREEZE_TAG ? "술래" : "방해꾼"} ${n}명${how}으로 시작합니다.` + (ids.length < CONFIG.MIN_PLAYERS ? " (DEBUG: 인원 제한 없음)" : "");
    }
    // 교사 직접 지정 버튼 (교사 화면에만)
    const pickBtn = $("#btn-sabpick");
    const picking = isTeacher && mode.id === GAME_MODES.AMONG_US && settings.saboteurPick === "teacher";
    pickBtn.style.display = picking ? "" : "none";
    if (picking) { const ps = Teacher.pickStatus(room); pickBtn.textContent = `🕵️ 방해꾼 지정 (${ps.have}/${ps.need})`; }
    if (isTeacher && $("#modal-sabpick").classList.contains("open")) Teacher.renderPicker(room);

    $("#debug-lobby").style.display = DEBUG_MODE && isTeacher ? "" : "none";
    $("#btn-last-results").style.display = isTeacher && room.results ? "" : "none";
    if ($("#modal-players").classList.contains("open")) renderPlayerManage(room);
  }

  // 교사: 플레이어 관리 (내보내기)
  function renderPlayerManage(room) {
    const box = $("#pm-list");
    const players = room.players || {};
    const ids = Object.keys(players).sort((a, b) => players[a].joinedAt - players[b].joinedAt);
    box.innerHTML = "";
    if (!ids.length) { box.innerHTML = '<p class="muted">아직 들어온 학생이 없어요.</p>'; return; }
    ids.forEach((id) => {
      const p = players[id];
      const row = document.createElement("div");
      row.className = "pm-row";
      row.appendChild(characterIcon(colorOf(p.color).hex, 40));
      const t = document.createElement("div");
      t.className = "pm-name";
      t.innerHTML = `<b>${MG.esc(p.nick)}</b> <small>${colorOf(p.color).name}${p.bot ? " · 🤖 봇" : ""}</small>`;
      row.appendChild(t);
      const b = document.createElement("button");
      b.type = "button";
      b.className = "btn small danger";
      b.textContent = "내보내기";
      b.addEventListener("click", () => {
        if (b.dataset.sure) { Net.kick(id); toast(`${p.nick} 님을 내보냈어요.`); }
        else { b.dataset.sure = "1"; b.textContent = "정말 내보낼까요?"; setTimeout(() => { if (b.isConnected) { delete b.dataset.sure; b.textContent = "내보내기"; } }, 3000); }
      });
      row.appendChild(b);
      box.appendChild(row);
    });
  }

  // ─────────────────────────────────────────────────────────────
  // 역할 공개
  // ─────────────────────────────────────────────────────────────
  function renderRole(room, myId) {
    const mode = GameModeManager.get(room);
    const info = mode.roleInfo(room, myId);
    const el = $("#screen-role");
    el.classList.remove("saboteur", "student", "tagger");
    el.classList.add(info.cls);
    const me = Roster.info(room, myId);
    const icon = $("#role-icon");
    icon.innerHTML = "";
    icon.appendChild(characterIcon(colorOf(me ? me.color : null).hex, 120));
    $("#role-mode").textContent = `${mode.icon} ${mode.name} 모드 · 내 색: ${colorOf(me ? me.color : null).name}`;
    $("#role-name").textContent = info.name;
    $("#role-desc").innerHTML = info.desc;
    $("#role-mates").textContent = info.mates || "";
  }

  // ─────────────────────────────────────────────────────────────
  // 스토리
  // ─────────────────────────────────────────────────────────────
  function renderStory(room) {
    const box = $("#story-text");
    box.innerHTML = "";
    const lines = GameModeManager.get(room).story();
    lines.forEach((line, i) => {
      const p = document.createElement("p");
      p.textContent = line;
      p.style.animationDelay = (0.35 + i * 0.55) + "s";
      box.appendChild(p);
    });
    const btn = $("#btn-story-ready");
    btn.disabled = false;
    btn.textContent = "게임 시작";
    btn.style.animationDelay = (0.5 + lines.length * 0.55) + "s";
  }

  function updateStoryReady(room) {
    const total = Object.keys(room.players || {}).length;
    const ready = Object.keys(room.ready || {}).filter((id) => room.players && room.players[id]).length;
    $("#story-wait").textContent = ready > 0 ? `준비 완료 ${ready} / ${total}명` : "";
  }

  // ─────────────────────────────────────────────────────────────
  // 게임 화면 HUD
  // ─────────────────────────────────────────────────────────────
  let lastTimerText = "";
  function setTimer(ms) {
    const t = formatTime(ms);
    if (t === lastTimerText) return; // 글자가 바뀔 때만 DOM 수정
    lastTimerText = t;
    const el = $("#hud-timer");
    el.textContent = t;
    el.classList.toggle("urgent", ms <= 60000);
  }
  function resetTimerCache() { lastTimerText = ""; }

  let lastPlace = "";
  function setPlace(name) {
    if (name === lastPlace) return;
    lastPlace = name;
    const el = $("#hud-place");
    el.textContent = name ? "📍 " + name : "";
  }

  function setRepair(pct) {
    $("#repair-fill").style.width = pct + "%";
    $("#repair-pct").textContent = Math.round(pct) + "%";
  }

  // 내 역할 (내 HUD 에만 보임) + 내 캐릭터 색
  function renderRoleTag(room, myId) {
    const role = room.roles && room.roles[myId];
    const ghost = !!(room.ghosts && room.ghosts[myId]);
    const tag = $("#hud-role");
    tag.textContent = (ghost ? "👻 " : "") + Roles.label(role) + (ghost ? " 유령" : "");
    tag.className = "role-tag " + (role === "saboteur" ? "sab" : role === "tagger" ? "tag" : "stu") + (ghost ? " ghost" : "");
    const me = Roster.info(room, myId);
    const dis = Abilities.disguiseOf(room, myId);
    const c = colorOf(me ? me.color : null);
    const el = $("#hud-me");
    const key = c.id + ":" + (dis ? dis.color : "");
    if (el.dataset.key !== key) {
      el.dataset.key = key;
      el.innerHTML = `나: <i style="background:${c.hex}"></i>${c.name}` + (dis ? ` <small>(위장: ${colorOf(dis.color).name})</small>` : "");
    }
  }

  // 모드·역할에 따라 오른쪽 아래 버튼 보이기/숨기기
  //  show: { mission, report, rescue, catch, sabotage, map }   state: modes.js buttons() 결과
  let lastHudKey = "";
  function setHudButtons(show, state = {}) {
    const primary = show.catch ? "catch" : "mission";
    const c = state.catch || {};
    const r = state.rescue || {};
    const key = JSON.stringify([show, primary, c.label, c.ready, c.cooling, c.icon, r.ready, Math.round((r.progress || 0) * 20), state.sabotage && state.sabotage.open]);
    if (key === lastHudKey) return;
    lastHudKey = key;
    const set = (id, on) => { const el = $(id); if (el) el.style.display = on ? "" : "none"; };
    set("#btn-map", show.map !== false);
    set("#btn-report", !!show.report);
    set("#btn-rescue", !!show.rescue);
    set("#btn-mission", !!show.mission);
    set("#btn-catch", !!show.catch);
    set("#btn-sabotage", !!show.sabotage);
    $("#btn-mission").classList.toggle("big", primary === "mission");
    $("#btn-catch").classList.toggle("big", primary === "catch");
    if (show.catch) {
      const b = $("#btn-catch");
      $("#catch-label").textContent = c.label || "";
      b.querySelector("b").textContent = c.icon || "✋";
      b.classList.toggle("disabled", !c.ready);
      b.classList.toggle("ready", !!c.ready);
      b.classList.toggle("cooling", !!c.cooling);
    }
    if (show.rescue) {
      const b = $("#btn-rescue");
      b.classList.toggle("disabled", !r.ready);
      b.classList.toggle("alert", !!r.ready);
      b.style.setProperty("--p", clamp(r.progress || 0, 0, 1));
    }
    if (show.sabotage) $("#btn-sabotage").classList.toggle("on", !!(state.sabotage && state.sabotage.open));
    $("#key-hint").textContent = keyHint(show);
  }
  function keyHint(show) {
    const parts = ["WASD/방향키 이동"];
    if (show.mission) parts.push("E 미션");
    if (show.report) parts.push("R 신고·회의");
    if (show.rescue) parts.push("R 누르고 있기 = 땡");
    if (show.catch) parts.push("Q/스페이스 " + (show.sabotage ? "얼리기" : "잡기"));
    if (show.sabotage) parts.push("F 방해 (1 정전 · 2 문 잠금 · 3 위장)");
    parts.push("M 지도", "ESC 설정");
    return parts.join(" · ");
  }

  // [신고] 버튼: 얼어 있는 친구 옆 → 「신고」, 긴급회의 버튼 앞 → 「긴급회의」
  let lastReport = "";
  function setReportButton(action) {
    const key = action ? action.kind + (action.left === 0 ? "0" : "") : "";
    if (key === lastReport) return;
    lastReport = key;
    const b = $("#btn-report");
    const usable = !!action && !(action.kind === "emergency" && action.left === 0);
    b.classList.toggle("disabled", !action);
    b.classList.toggle("alert", usable);
    $("#report-label").textContent = action && action.kind === "emergency" ? "긴급회의" : "신고";
    b.querySelector("b").textContent = action && action.kind === "emergency" ? "🚨" : "📢";
  }

  // 화면 가운데 상태 알림 (정전 · 얼음 · 유령 · 위장)
  let lastBanner = "";
  function setBanner(kind, text) {
    const key = kind + text;
    if (key === lastBanner) return;
    lastBanner = key;
    const el = $("#status-banner");
    el.className = "status-banner" + (kind ? " show " + kind : "");
    el.textContent = text || "";
    $("#frozen-screen").classList.toggle("show", kind === "frozen");
  }

  function renderHud(room, myId) {
    $("#hud-me").dataset.key = "";
    renderRoleTag(room, myId);
    lastHudKey = "";
    lastMissionKey = ""; lastRepair = -1;
    renderMissions(room);
    lastTimerText = ""; lastPlace = "";
    setMissionButton(false);
    lastReport = "-"; setReportButton(null);
    lastBanner = "-"; setBanner("", "");
    $("#key-hint").style.display = IS_TOUCH ? "none" : "";
    document.body.classList.toggle("touch", IS_TOUCH);
  }

  // 나의 미션 목록 + 학교 복구율 (바뀐 것이 있을 때만 다시 그림)
  let lastMissionKey = "", lastRepair = -1;
  function renderMissions(room) {
    const list = MissionSys.mine(room);
    const key = list.map((m) => m.key + (m.done ? "1" : "0")).join(",");
    if (key !== lastMissionKey) {
      lastMissionKey = key;
      const ul = $("#mission-list");
      ul.innerHTML = "";
      if (!list.length) {
        const li = document.createElement("li");
        li.className = "muted";
        li.textContent = Roles.isTagger(room, Net.myId) ? "술래는 미션이 없어요. 학생을 잡아 복구를 막으세요!" : "미션을 받는 중…";
        ul.appendChild(li);
      }
      list.forEach((m) => {
        const li = document.createElement("li");
        li.className = m.done ? "done" : "";
        li.textContent = (m.done ? "✓ " : "□ ") + m.def.short;
        ul.appendChild(li);
      });
      const doneN = list.filter((m) => m.done).length;
      $("#hud-mission-count").textContent = list.length ? `${doneN}/${list.length}` : "";
    }
    const pct = Math.round(MissionSys.progress(room).pct);
    if (pct !== lastRepair) {
      if (lastRepair >= 0 && pct > lastRepair && GSM.inWorld()) AudioManager.playSFX("repairUp", 0.8);
      lastRepair = pct; setRepair(pct);
    }
  }

  let missionBtnOn = null;
  function setMissionButton(on) {
    if (on === missionBtnOn) return;
    missionBtnOn = on;
    const b = $("#btn-mission");
    b.classList.toggle("disabled", !on);
    b.classList.toggle("ready", !!on);
  }

  function setCountdown(text) {
    const el = $("#countdown");
    if (el.textContent !== text) {
      el.textContent = text;
      el.classList.remove("pop"); void el.offsetWidth; el.classList.add("pop");
      if (text === "시작!") AudioManager.playSFX("countdownGo");
      else if (text) AudioManager.playSFX("countdown");
    }
    el.style.display = text ? "" : "none";
  }

  // ─────────────────────────────────────────────────────────────
  // 게임 종료
  // ─────────────────────────────────────────────────────────────
  function renderGameOver(room, myId, isTeacher) {
    const g = room.game || {};
    const studentsWin = g.winner === "student";
    const mode = GameModeManager.get(room);
    const w = GameModeManager.winnerInfo(g.winner);
    const el = $("#screen-gameover");
    el.classList.toggle("win-student", studentsWin);
    el.classList.toggle("win-saboteur", !studentsWin);
    el.classList.toggle("win-tagger", g.winner === "tagger");
    $("#go-sub").textContent = w.sub;
    $("#go-title").textContent = w.title;
    const reasons = {
      time: "제한 시간 안에 학교를 모두 복구하지 못했어요.",
      missions: "모든 미션을 해결했어요!",
      voted: "방해꾼을 모두 찾아냈어요!",
      outnumbered: "남은 학생 수가 방해꾼 수보다 많지 않게 되었어요.",
      saboteurLeft: "방해꾼이 게임에서 나갔어요.",
      allFrozen: "모든 학생이 동시에 얼어붙었어요!",
      taggerLeft: "술래가 모두 게임에서 나갔어요.",
      studentsLeft: "학생이 모두 게임에서 나갔어요.",
      teacher: "선생님이 게임을 끝냈어요.",
      debug: "(DEBUG) 게임을 강제로 끝냈어요.",
    };
    $("#go-reason").textContent = reasons[g.reason] || "";
    $("#go-label").textContent = mode.id === GAME_MODES.FREEZE_TAG ? "술래는…" : "방해꾼은…";
    const box = $("#go-saboteurs");
    box.innerHTML = "";
    Roles.specials(room).forEach((id) => {
      const p = Roster.info(room, id);
      if (!p) return;
      const d = document.createElement("div");
      d.className = "go-sab";
      d.appendChild(characterIcon(colorOf(p.color).hex, 72));
      const n = document.createElement("div");
      n.textContent = `${p.nick} (${colorOf(p.color).name})`;
      d.appendChild(n);
      box.appendChild(d);
    });
    const won = GameModeManager.myTeamWon(room, myId);
    $("#go-me").textContent = isTeacher ? "🧑‍🏫 학생들의 수학 기록을 확인해 보세요." : won == null ? "" : won ? "🎉 우리 팀이 이겼어요!" : "다음 판에는 꼭 이겨 봐요!";
    // (버튼들은 「나의 수학 기록」 화면 아래쪽에 있어요) — 다음 게임 준비 · 전체 결과는 교사만
    $("#btn-go-lobby").style.display = isTeacher ? "" : "none";
    $("#go-wait").style.display = isTeacher ? "none" : "";
    $("#btn-teacher-results").style.display = isTeacher ? "" : "none";
    $("#screen-result").classList.toggle("teacher", !!isTeacher);
  }

  return {
    show, characterIcon, renderSettings, settingsSummary, openModal, closeModal,
    renderLobby, renderPlayerManage, renderRole, renderStory, updateStoryReady,
    renderHud, setTimer, resetTimerCache, setPlace, setRepair, setCountdown, renderGameOver,
    renderMissions, setMissionButton, renderRoleTag, setReportButton, setBanner, setHudButtons,
  };
})();
