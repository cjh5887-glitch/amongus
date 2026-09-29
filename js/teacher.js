/* =====================================================================
   teacher.js — 교사 화면

   ▸ [교사용] → PIN 입력 → 방 만들기 (게임 모드 · 시간 · 미션 · 난이도 · 모드별 설정)
   ▸ 교사는 플레이어가 아니라 "진행자"입니다. (캐릭터 없음 · 역할 없음)
   ▸ 대기방: [게임 시작] [게임 설정] [플레이어 관리] [지난 결과] [방 닫기]
   ▸ 게임 중: 학교 전체 지도 · 남은 시간 · 학교 복구율 · 학생 상태(얼음/보호/유령)
             [위치 보기] [역할 보기] 는 눌렀을 때만 (TV 로 보여 줄 때 정체가 드러나지 않게)
             [게임 강제 종료]
   ▸ 게임이 끝나면 전체 학습 결과(CSV)를 바로 볼 수 있어요.

   ※ PIN(TEACHER_PIN)은 config.js 한 곳에서만 관리합니다.
   ===================================================================== */

const Teacher = (() => {
  const OK_KEY = "rs_teacher_ok";
  const pinOk = () => { try { return sessionStorage.getItem(OK_KEY) === "1"; } catch (e) { return false; } };
  const defaults = () => normalizeSettings(SafeStore.get("rs_defaults", {}));

  // ─────────────────────────────────────────────────────────────
  // 메인 화면: [교사용] → PIN → 방 만들기
  // ─────────────────────────────────────────────────────────────
  function openPanel() {
    $("#teacher-error").textContent = "";
    $("#teacher-pin").value = "";
    showStep(pinOk() ? "create" : "pin");
    UI.openModal("modal-teacher");
    AudioManager.playSFX("menuOpen");
    if (!pinOk()) setTimeout(() => $("#teacher-pin").focus(), 50);
  }

  function showStep(step) {
    $("#teacher-pin-step").style.display = step === "pin" ? "" : "none";
    $("#teacher-create-step").style.display = step === "create" ? "" : "none";
    if (step === "create") drawCreate(defaults());
  }

  function drawCreate(s) {
    UI.renderSettings($("#teacher-settings"), s, true, (next) => { SafeStore.set("rs_defaults", next); drawCreate(next); });
  }

  function checkPin() {
    const v = $("#teacher-pin").value.trim();
    if (v && v === String(TEACHER_PIN)) {
      try { sessionStorage.setItem(OK_KEY, "1"); } catch (e) { /* 무시 */ }
      AudioManager.playSFX("correct");
      showStep("create");
    } else {
      AudioManager.playSFX("wrong");
      $("#teacher-error").textContent = "PIN 이 맞지 않아요.";
      $("#teacher-pin").select();
    }
  }

  async function createRoom() {
    const btn = $("#btn-teacher-create");
    btn.disabled = true;
    $("#teacher-create-error").textContent = "방을 만드는 중…";
    try {
      await Net.createRoom(defaults());
      AudioManager.playSFX("create");
      UI.closeModal("modal-teacher");
      $("#teacher-create-error").textContent = "";
    } catch (e) {
      $("#teacher-create-error").textContent = e.message || "방을 만들지 못했어요.";
    }
    btn.disabled = false;
  }

  // ─────────────────────────────────────────────────────────────
  // 대기방: 게임 설정 · 플레이어 관리 · 방 닫기
  // ─────────────────────────────────────────────────────────────
  function openRoomSettings() {
    const draw = () => {
      const room = Net.room;
      if (!room) return;
      UI.renderSettings($("#room-settings"), room.settings, Net.isTeacher && room.meta.state === "LOBBY", (next) => {
        SafeStore.set("rs_defaults", next);   // 다음 방의 기본값으로도 기억
        Net.roomUpdate({ settings: next });
      }, Object.keys(room.players || {}).length);
    };
    roomSettingsDraw = draw;
    draw();
    UI.openModal("modal-room-settings");
    AudioManager.playSFX("menuOpen");
  }
  let roomSettingsDraw = null;
  function refreshRoomSettings() {
    if (roomSettingsDraw && $("#modal-room-settings").classList.contains("open")) roomSettingsDraw();
  }

  function openPlayers() {
    UI.renderPlayerManage(Net.room || {});
    UI.openModal("modal-players");
    AudioManager.playSFX("menuOpen");
  }

  // 두 번 눌러야 실행되는 버튼 (실수 방지)
  function confirmClick(btn, label, sureLabel, fn) {
    if (btn.dataset.sure) { delete btn.dataset.sure; btn.textContent = label; fn(); return; }
    btn.dataset.sure = "1";
    btn.textContent = sureLabel;
    setTimeout(() => { if (btn.dataset.sure) { delete btn.dataset.sure; btn.textContent = label; } }, 3000);
  }

  // ─────────────────────────────────────────────────────────────
  // 게임 중 관전 화면
  // ─────────────────────────────────────────────────────────────
  const view = { showPos: false, showRoles: false };

  function enterView(signal, onEnd) {
    UI.show("teacher");
    view.showPos = false; view.showRoles = false;
    $("#tv-pos").addEventListener("click", () => { view.showPos = !view.showPos; syncButtons(); lastListKey = ""; }, { signal });
    $("#tv-roles").addEventListener("click", () => { view.showRoles = !view.showRoles; syncButtons(); lastListKey = ""; }, { signal });
    const endBtn = $("#tv-end");
    endBtn.textContent = "⏹ 게임 강제 종료";
    delete endBtn.dataset.sure;
    endBtn.addEventListener("click", () => confirmClick(endBtn, "⏹ 게임 강제 종료", "정말 끝낼까요? 한 번 더 누르기", onEnd), { signal });
    syncButtons();
    lastListKey = "";
  }
  function syncButtons() {
    $("#tv-pos").classList.toggle("on", view.showPos);
    $("#tv-pos").textContent = view.showPos ? "👁 위치 숨기기" : "👁 위치 보기";
    $("#tv-roles").classList.toggle("on", view.showRoles);
    $("#tv-roles").textContent = view.showRoles ? "🎭 역할 숨기기" : "🎭 역할 보기";
    $("#tv-note").textContent = view.showPos ? "" : "학생 위치는 숨겨져 있어요. (TV 로 보여 줄 때 정체가 드러나지 않도록) [👁 위치 보기]를 누르면 보여요.";
  }

  const PHASE = { ROLE_REVEAL: "🎭 역할 공개 중", STORY: "📖 스토리", COUNTDOWN: "⏳ 곧 시작해요", PLAYING: "🎮 게임 중", MEETING: "🚨 긴급회의" };
  let lastListKey = "";

  function frame(room) {
    if (!room || !room.meta) return;
    const mode = GameModeManager.get(room);
    const st = room.meta.state;
    $("#tv-code").textContent = Net.code;
    $("#tv-mode").textContent = `${mode.icon} ${mode.name}`;
    let phase = PHASE[st] || st;
    if (st === "MEETING" && room.meeting) {
      const m = room.meeting;
      const left = Math.max(0, Math.ceil((m.phaseEnd - Net.now()) / 1000));
      phase += ` · ${{ discuss: "토론", vote: "투표", result: "결과" }[m.phase] || ""}${m.phase !== "result" ? " " + left + "초" : ""}`;
      if (m.phase === "vote") phase += ` (투표 ${Object.keys(m.votes || {}).length}명)`;
    }
    if (st === "COUNTDOWN" && room.meta.phaseEndsAt) phase += ` ${Math.max(1, Math.ceil((room.meta.phaseEndsAt - Net.now()) / 1000))}`;
    if (st === "STORY") phase += ` (준비 ${Object.keys(room.ready || {}).length}/${Object.keys(room.players || {}).length})`;
    if (Abilities.blackoutLeft(room) > 0) phase += " · ⚡정전";
    $("#tv-phase").textContent = phase;
    const s = roomSettings(room);
    const g = room.game || {};
    const left = g.endAt ? g.endAt - (g.pausedAt || Net.now()) : s.gameMinutes * 60000;
    $("#tv-timer").textContent = formatTime(left);
    $("#tv-timer").classList.toggle("urgent", !!g.endAt && left <= 60000);
    const pr = MissionSys.progress(room);
    $("#tv-repair-fill").style.width = pr.pct + "%";
    $("#tv-repair-pct").textContent = `${Math.round(pr.pct)}% (${pr.done}/${pr.total})`;

    // 지도
    const players = Roster.ids(room).map((pid) => {
      const o = Player.others.get(pid);
      const info = Roster.info(room, pid) || {};
      const state = PlayerState.of(room, pid);
      const dis = Abilities.disguiseOf(room, pid);
      return {
        pid, x: o ? o.x : -999, y: o ? o.y : -999, dir: o ? o.dir : 1, walk: o ? o.walk : 0, moving: o ? o.moving : false,
        color: colorOf(dis ? dis.color : info.color).hex, ghost: state === "GHOST", frozen: state === "FROZEN", shield: state === "PROTECTED",
        tagger: Roles.isTagger(room, pid), sab: Roles.isSaboteur(room, pid), online: Roster.online(room, pid) && !!o,
      };
    }).filter((p) => p.x > -999);
    const traces = mode.id === GAME_MODES.AMONG_US ? AmongUsMode.traces(room).map((t) => ({ ...t, color: colorOf(t.color).hex })) : [];
    Renderer.drawTeacherMap($("#tv-map"), { players, traces, showPos: view.showPos, showRoles: view.showRoles, blackout: Abilities.blackoutLeft(room) > 0 });

    // 학생 상태 목록 (바뀔 때만 다시 그림)
    const ids = Roster.ids(room).concat(Object.keys(room.members || {}).filter((id) => room.gone && room.gone[id]));
    const rows = ids.map((pid) => {
      const info = Roster.info(room, pid) || {};
      const role = room.roles && room.roles[pid];
      const state = PlayerState.of(room, pid);
      const mine = MissionSys.missionsOf(room, pid);
      const bucket = role === "saboteur" ? room.fakeDone : room.done;
      const done = mine.filter((m) => bucket && bucket[pid] && bucket[pid][m.key]).length;
      const gone = room.gone && room.gone[pid];
      return { pid, nick: info.nick || "?", color: info.color, role, state, done, total: mine.length, online: Roster.online(room, pid), gone, bot: !!info.bot };
    });
    const key = JSON.stringify([rows, view.showRoles, mode.id]);
    if (key === lastListKey) return;
    lastListKey = key;
    const box = $("#tv-players");
    box.innerHTML = "";
    rows.forEach((r) => {
      const d = document.createElement("div");
      d.className = "tv-row" + (r.gone ? " gone" : "") + (!r.online && !r.gone ? " offline" : "");
      d.appendChild(UI.characterIcon(colorOf(r.color).hex, 36, { ghost: r.state === "GHOST" }));
      const publicRole = r.role === "tagger";     // 얼음땡 술래는 모두에게 공개된 역할
      const roleText = r.role && (view.showRoles || publicRole) ? `<span class="tv-role ${r.role}">${Roles.label(r.role)}</span>` : "";
      let st = PlayerState.LABEL[r.state];
      if (r.state === "GHOST") st = PlayerState.ghostReason(room, r.pid) === "frozen" ? "🧊 얼려짐(유령)" : "👻 투표 제외(유령)";
      if (r.gone) st = r.gone === "left" ? "🚪 나감" : "📴 연결 끊김";
      else if (!r.online) st += " · 📴 연결 확인 중";
      const miss = r.role === "tagger" ? "미션 없음" : r.total ? `미션 ${r.done}/${r.total}${r.role === "saboteur" && view.showRoles ? " (가짜)" : ""}` : "";
      d.insertAdjacentHTML("beforeend", `<div class="tv-info"><div><b>${MG.esc(r.nick)}</b> <small>${colorOf(r.color).name}${r.bot ? " 🤖" : ""}</small> ${roleText}</div><div class="tv-st">${st} <small>${miss}</small></div></div>`);
      box.appendChild(d);
    });
  }

  function init() {
    $("#teacher-pin-ok").addEventListener("click", checkPin);
    $("#teacher-pin").addEventListener("keydown", (e) => { if (e.key === "Enter") checkPin(); });
    $("#btn-teacher-create").addEventListener("click", createRoom);
  }

  return { init, openPanel, openRoomSettings, refreshRoomSettings, openPlayers, confirmClick, enterView, frame, view };
})();
