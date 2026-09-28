/* =====================================================================
   ui.js — 화면(메인·대기실·역할·스토리·종료)과 HUD, 설정 창
   ===================================================================== */

const UI = (() => {
  const screens = ["title", "lobby", "role", "story", "game", "gameover", "result"];

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
  // 설정 창 (교사용 설정 · 방장 설정에서 같이 사용)
  // ─────────────────────────────────────────────────────────────
  const FIELDS = [
    { key: "mode", label: "게임 모드", options: [["normal", "일반 게임"], ["quick", "빠른 게임"]] },
    { key: "gameMinutes", label: "게임 시간", options: [[8, "8분"], [10, "10분"], [12, "12분"], [15, "15분"]] },
    { key: "saboteurs", label: "방해꾼 수", options: [["auto", "자동 추천"], [1, "1명"], [2, "2명"], [3, "3명"]] },
    { key: "speed", label: "이동 속도", options: [["slow", "느리게"], ["normal", "보통"], ["fast", "빠르게"]] },
    { key: "missionCount", label: "개인 미션 수", options: [[3, "3개"], [5, "5개"], [7, "7개"]] },
    { key: "difficulty", label: "문제 난이도", options: [[1, "쉬움"], [2, "보통"], [3, "어려움"]] },
    { key: "meetingLimit", label: "긴급회의 횟수", options: [[1, "1회"], [2, "2회"], [3, "3회"]] },
    { key: "abilities", label: "방해꾼 능력", toggles: [["blackout", "정전"], ["lockDoor", "문 잠금"], ["disguise", "위장"], ["freeze", "얼리기"]] },
    { key: "coop", label: "협동 모드", options: [[false, "끔"], [true, "켬"]], note: "자기 미션을 끝낸 학생이 친구 미션을 도울 수 있어요 (학생팀이 이기기 쉬워져요)" },
    { key: "revealRole", label: "제외된 사람 역할", options: [[true, "공개"], [false, "비공개"]], note: "투표로 제외된 사람이 방해꾼이었는지 알려 줄까요?" },
  ];

  function renderSettings(container, settings, editable, onChange, playerCount) {
    container.innerHTML = "";
    FIELDS.forEach((f) => {
      const row = document.createElement("div");
      row.className = "set-row";
      const lab = document.createElement("div");
      lab.className = "set-label";
      lab.textContent = f.label;
      if (f.key === "saboteurs" && playerCount) {
        const rec = document.createElement("small");
        rec.textContent = ` (지금 ${playerCount}명 → 추천 ${recommendSaboteurs(playerCount)}명)`;
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
          b.disabled = !editable;
          b.addEventListener("click", () => {
            const next = { ...settings, [f.key]: val };
            if (f.key === "mode") Object.assign(next, MODE_PRESETS[val]);
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
      container.appendChild(row);
    });
    const note = document.createElement("p");
    note.className = "set-foot";
    note.textContent = "※ 긴급회의 버튼은 한 사람당 1번씩, 게임 전체로는 위에서 고른 횟수까지 쓸 수 있어요. 얼어 있는 친구 신고는 따로 셉니다.";
    container.appendChild(note);
  }

  function openModal(id) { document.getElementById(id).classList.add("open"); }
  function closeModal(id) { document.getElementById(id).classList.remove("open"); }

  // ─────────────────────────────────────────────────────────────
  // 대기실
  // ─────────────────────────────────────────────────────────────
  function renderLobby(room, myId, isHost) {
    $("#lobby-code").textContent = Net.code;
    const players = room.players || {};
    const ids = Object.keys(players).sort((a, b) => players[a].joinedAt - players[b].joinedAt);
    $("#lobby-count").textContent = `${ids.length} / ${CONFIG.MAX_PLAYERS}명`;

    const list = $("#lobby-players");
    list.innerHTML = "";
    ids.forEach((id) => {
      const p = players[id];
      const card = document.createElement("div");
      card.className = "player-card" + (id === myId ? " me" : "");
      card.appendChild(characterIcon(colorOf(p.color).hex, 64));
      const name = document.createElement("div");
      name.className = "pc-name";
      name.textContent = p.nick;
      card.appendChild(name);
      const tag = document.createElement("div");
      tag.className = "pc-tag";
      tag.textContent = (room.meta.hostId === id ? "👑 방장 " : "") + (id === myId ? "(나)" : "") + (p.bot ? "🤖" : "");
      card.appendChild(tag);
      list.appendChild(card);
    });
    for (let i = ids.length; i < CONFIG.MAX_PLAYERS; i++) {
      const empty = document.createElement("div");
      empty.className = "player-card empty";
      empty.textContent = "빈 자리";
      list.appendChild(empty);
    }

    // 색 고르기
    const used = new Map(ids.map((id) => [players[id].color, id]));
    const colors = $("#lobby-colors");
    colors.innerHTML = "";
    PLAYER_COLORS.forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "swatch";
      b.style.setProperty("--c", c.hex);
      const owner = used.get(c.id);
      if (owner === myId) b.classList.add("mine");
      b.disabled = owner !== undefined && owner !== myId;
      b.title = c.name;
      b.innerHTML = `<span>${c.name}</span>`;
      b.addEventListener("click", () => { if (!b.disabled) Net.setMe({ color: c.id }); });
      colors.appendChild(b);
    });

    // 설정
    renderSettings($("#lobby-settings"), room.settings || DEFAULT_SETTINGS, isHost, (next) => {
      Net.roomUpdate({ settings: next });
    }, ids.length);
    $("#lobby-settings-title").textContent = isHost ? "방장 설정" : "게임 설정 (방장만 바꿀 수 있어요)";

    // 시작 버튼
    const start = $("#btn-start");
    const hint = $("#start-hint");
    const min = DEBUG_MODE ? 1 : CONFIG.MIN_PLAYERS;
    start.style.display = isHost ? "" : "none";
    const sabSetting = (room.settings || DEFAULT_SETTINGS).saboteurs;
    if (!isHost) {
      hint.textContent = "방장이 게임을 시작할 때까지 기다려 주세요.";
    } else if (ids.length < min) {
      start.disabled = true;
      hint.textContent = `${CONFIG.MIN_PLAYERS}명 이상 모이면 시작할 수 있어요. (지금 ${ids.length}명)`;
    } else if (Roles.tooMany(ids.length, sabSetting)) {
      start.disabled = true;
      hint.textContent = "방해꾼이 너무 많아요. 방해꾼 수를 줄이거나 '자동 추천'을 골라 주세요.";
    } else {
      start.disabled = false;
      const n = Roles.saboteurCount(ids.length, sabSetting);
      hint.textContent = `${ids.length}명 · 방해꾼 ${n}명으로 시작합니다.` + (ids.length < CONFIG.MIN_PLAYERS ? " (DEBUG: 인원 제한 없음)" : "");
    }

    $("#debug-lobby").style.display = DEBUG_MODE && isHost ? "" : "none";
    $("#btn-last-results").style.display = isHost && room.results ? "" : "none";
  }

  // ─────────────────────────────────────────────────────────────
  // 역할 공개
  // ─────────────────────────────────────────────────────────────
  function renderRole(room, myId) {
    const role = room.roles && room.roles[myId];
    const el = $("#screen-role");
    el.classList.toggle("saboteur", role === "saboteur");
    el.classList.toggle("student", role !== "saboteur");
    const me = room.players[myId];
    const icon = $("#role-icon");
    icon.innerHTML = "";
    icon.appendChild(characterIcon(colorOf(me ? me.color : 0).hex, 120));
    if (role === "saboteur") {
      $("#role-name").textContent = "방해꾼";
      $("#role-desc").innerHTML = "학생인 척 행동하세요.<br>학교 복구를 방해하세요.";
      const mates = Roles.saboteurs(room).filter((id) => id !== myId).map((id) => room.players[id] && room.players[id].nick).filter(Boolean);
      $("#role-mates").textContent = mates.length ? "함께하는 방해꾼: " + mates.join(", ") : "";
    } else {
      $("#role-name").textContent = "학생";
      $("#role-desc").innerHTML = "학교의 미션을 해결하세요.<br>방해꾼을 찾아내세요.";
      const n = Roles.saboteurs(room).length;
      $("#role-mates").textContent = `우리 가운데 방해꾼이 ${n}명 숨어 있어요.`;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 스토리
  // ─────────────────────────────────────────────────────────────
  function renderStory() {
    const box = $("#story-text");
    box.innerHTML = "";
    STORY_LINES.forEach((line, i) => {
      const p = document.createElement("p");
      p.textContent = line;
      p.style.animationDelay = (0.35 + i * 0.55) + "s";
      box.appendChild(p);
    });
    const btn = $("#btn-story-ready");
    btn.disabled = false;
    btn.textContent = "게임 시작";
    btn.style.animationDelay = (0.5 + STORY_LINES.length * 0.55) + "s";
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

  function renderRoleTag(room, myId) {
    const role = room.roles && room.roles[myId];
    const ghost = !!(room.ghosts && room.ghosts[myId]);
    const tag = $("#hud-role");
    tag.textContent = (ghost ? "👻 " : "") + (role === "saboteur" ? "방해꾼" : "학생") + (ghost ? " 유령" : "");
    tag.className = "role-tag " + (role === "saboteur" ? "sab" : "stu") + (ghost ? " ghost" : "");
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
    renderRoleTag(room, myId);
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
        li.textContent = "미션을 받는 중…";
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
    if (pct !== lastRepair) { lastRepair = pct; setRepair(pct); }
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
    }
    el.style.display = text ? "" : "none";
  }

  // ─────────────────────────────────────────────────────────────
  // 게임 종료
  // ─────────────────────────────────────────────────────────────
  function renderGameOver(room, myId, isHost) {
    const g = room.game || {};
    const studentsWin = g.winner === "student";
    const el = $("#screen-gameover");
    el.classList.toggle("win-student", studentsWin);
    el.classList.toggle("win-saboteur", !studentsWin);
    $("#go-sub").textContent = studentsWin ? "학교 복구 성공!" : "학교 복구 실패";
    $("#go-title").textContent = studentsWin ? "학생팀 승리" : "방해꾼 승리";
    const reasons = {
      time: "제한 시간 안에 학교를 모두 복구하지 못했어요.",
      missions: "모든 미션을 해결했어요!",
      voted: "방해꾼을 모두 찾아냈어요!",
      outnumbered: "남은 학생 수가 방해꾼 수보다 많지 않게 되었어요.",
      saboteurLeft: "방해꾼이 게임에서 나갔어요.",
      debug: "(DEBUG) 게임을 강제로 끝냈어요.",
    };
    $("#go-reason").textContent = reasons[g.reason] || "";
    const box = $("#go-saboteurs");
    box.innerHTML = "";
    Roles.saboteurs(room).forEach((id) => {
      const p = Roster.info(room, id);
      if (!p) return;
      const d = document.createElement("div");
      d.className = "go-sab";
      d.appendChild(characterIcon(colorOf(p.color).hex, 72));
      const n = document.createElement("div");
      n.textContent = p.nick;
      d.appendChild(n);
      box.appendChild(d);
    });
    const myRole = room.roles && room.roles[myId];
    const iWon = (myRole === "saboteur") !== studentsWin;
    $("#go-me").textContent = iWon ? "🎉 우리 팀이 이겼어요!" : "다음 판에는 꼭 이겨 봐요!";
    // (버튼들은 4단계부터 「나의 수학 기록」 화면 아래쪽에 있어요)
    $("#btn-go-lobby").style.display = isHost ? "" : "none";
    $("#go-wait").style.display = isHost ? "none" : "";
    $("#btn-teacher-results").style.display = isHost ? "" : "none";
  }

  return {
    show, characterIcon, renderSettings, openModal, closeModal,
    renderLobby, renderRole, renderStory, updateStoryReady,
    renderHud, setTimer, setPlace, setRepair, setCountdown, renderGameOver,
    renderMissions, setMissionButton, renderRoleTag, setReportButton, setBanner,
  };
})();
