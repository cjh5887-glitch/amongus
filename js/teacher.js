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
    renderPicker(Net.room);
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

  // ─────────────────────────────────────────────────────────────
  // (어몽어스) 교사가 방해꾼 직접 지정
  //  ▸ 고른 학생 명단은 이 교사 기기(sessionStorage)에만 저장 → 학생 기기로는 전달되지 않음
  //  ▸ 게임을 시작하는 순간에만 역할(roles)로 저장됩니다. (랜덤 배정과 같은 방식)
  // ─────────────────────────────────────────────────────────────
  const pickKey = () => "rs_sabpick_" + Net.code;
  function loadPicks() {
    try { return JSON.parse(sessionStorage.getItem(pickKey()) || "[]") || []; } catch (e) { return []; }
  }
  function savePicks(list) {
    try { sessionStorage.setItem(pickKey(), JSON.stringify(list)); } catch (e) { /* 무시 */ }
  }
  // 지금 대기방에 있는 학생 가운데 고른 학생 (나간 학생은 자동으로 빠짐)
  function getPicks(room) {
    const players = (room && room.players) || {};
    return loadPicks().filter((id) => players[id]);
  }
  function pickNeed(room) {
    const n = Object.keys((room && room.players) || {}).length;
    return Roles.saboteurCount(n, roomSettings(room).saboteurs);
  }
  // 고른 수가 방해꾼 수와 "정확히" 같아야 시작 가능 (missing: 더 골라야 할 수 · extra: 빼야 할 수)
  function pickStatus(room) {
    const need = pickNeed(room);
    const have = getPicks(room).length;
    return { need, have, missing: Math.max(0, need - have), extra: Math.max(0, have - need), ok: have === need };
  }
  function pickMessage(st) {
    if (st.missing > 0) return `방해꾼을 ${st.missing}명 더 선택해주세요. (${st.have}/${st.need})`;
    if (st.extra > 0) return `방해꾼 수(${st.need}명)보다 많이 골랐어요. ${st.extra}명을 빼 주세요. (${st.have}/${st.need})`;
    return `✓ 방해꾼 ${st.need}명을 모두 골랐어요.`;
  }
  function togglePick(id) {
    const room = Net.room;
    const need = pickNeed(room);
    let list = getPicks(room);
    if (list.includes(id)) list = list.filter((x) => x !== id);
    else if (list.length >= need) { toast(`방해꾼은 ${need}명까지 고를 수 있어요. 먼저 다른 학생을 빼 주세요.`); AudioManager.playSFX("wrong"); return; }
    else list.push(id);
    savePicks(list);
    renderPicker(room);
    UI.renderLobby(room, Net.myId, Net.isTeacher);
  }

  // 방해꾼 설정 바꾸기 (배정 방식 · 방해꾼 수) — 교사만, 대기방에서만
  function setSab(fields) {
    const room = Net.room;
    if (!Net.isTeacher || !room || room.meta.state !== "LOBBY") return;
    const next = { ...normalizeSettings(room.settings), ...fields };
    SafeStore.set("rs_defaults", next);
    Net.roomUpdate({ settings: next });
  }

  // 🕵️ 방해꾼 설정 묶음 (대기방 · 플레이어 관리 · 방해꾼 지정 창에서 같은 것을 씀)
  //   방해꾼 배정: [자동] [직접 선택]   방해꾼 수: [추천] [1명] [2명] [3명] (인원에 비해 너무 많은 수는 누를 수 없음)
  //   직접 선택이면 학생 목록 ☐/☑
  function renderSabControl(box, room) {
    if (!box || !room) return;
    const s = roomSettings(room);
    const players = room.players || {};
    const n = Object.keys(players).length;
    const max = Math.max(0, Math.ceil(n / 2) - 1);
    box.innerHTML = "";
    const row = (label, opts) => {
      const r = document.createElement("div");
      r.className = "set-row";
      r.innerHTML = `<div class="set-label">${label}</div>`;
      const o = document.createElement("div");
      o.className = "set-options";
      opts.forEach(([text, on, disabled, fn, val]) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "chip" + (on ? " on" : "");
        b.textContent = text;
        b.dataset.val = String(val);
        b.disabled = !!disabled;
        if (disabled) b.title = `지금 ${n}명이라 고를 수 없어요`;
        b.addEventListener("click", fn);
        o.appendChild(b);
      });
      r.appendChild(o);
      box.appendChild(r);
    };
    const teacherPick = s.saboteurPick === "teacher";
    row("방해꾼 배정", [
      ["🎲 자동", !teacherPick, false, () => setSab({ saboteurPick: "random" }), "random"],
      ["✋ 직접 선택", teacherPick, false, () => setSab({ saboteurPick: "teacher" }), "teacher"],
    ]);
    const rec = recommendSaboteurs(n);
    row("방해꾼 수", [
      [`추천 (${Roles.saboteurCount(n, "auto")}명)`, s.saboteurs === "auto", false, () => setSab({ saboteurs: "auto" }), "auto"],
      ...[1, 2, 3].map((v) => [`${v}명`, String(s.saboteurs) === String(v), n > 0 && v > max, () => setSab({ saboteurs: v }), v]),
    ]);
    const note = document.createElement("div");
    note.className = "set-note sab-note";
    note.textContent = teacherPick
      ? "고른 학생은 선생님 화면에만 보여요. 학생 기기로는 전달되지 않고, 게임이 시작될 때 그 학생에게만 방해꾼 역할이 주어져요."
      : `게임을 시작할 때 참가 학생 가운데 방해꾼 ${Roles.saboteurCount(n, s.saboteurs)}명을 무작위로 정해요.` + (n ? ` (지금 ${n}명 · 추천 ${rec}명)` : "");
    box.appendChild(note);
    if (!teacherPick) return;
    const st = pickStatus(room);
    const status = document.createElement("p");
    status.className = "sp-status" + (st.ok ? " ok" : "");
    status.textContent = pickMessage(st);
    box.appendChild(status);
    const list = document.createElement("div");
    list.className = "sp-list";
    const ids = Object.keys(players).sort((a, b) => players[a].joinedAt - players[b].joinedAt);
    const picks = getPicks(room);
    if (!ids.length) list.innerHTML = '<p class="muted">아직 들어온 학생이 없어요.</p>';
    ids.forEach((id) => {
      const p = players[id];
      const on = picks.includes(id);
      const b = document.createElement("button");
      b.type = "button";
      b.className = "sp-row" + (on ? " on" : "");
      b.dataset.pid = id;
      b.setAttribute("aria-pressed", on ? "true" : "false");
      b.appendChild(UI.characterIcon(colorOf(p.color).hex, 32));
      b.insertAdjacentHTML("beforeend", `<span class="sp-check">${on ? "☑" : "☐"}</span><span class="sp-name"><b>${MG.esc(p.nick)}</b> <small>${colorOf(p.color).name}${p.bot ? " · 🤖" : ""}</small></span>`);
      b.addEventListener("click", () => togglePick(id));
      list.appendChild(b);
    });
    box.appendChild(list);
  }

  // 열려 있는 곳을 모두 다시 그림 (대기방 칸 · 방해꾼 지정 창 · 플레이어 관리 창)
  function renderPicker(room) {
    const au = room && GameModeManager.isAU(room);
    const inline = $("#lobby-sabctl");
    if (inline) { inline.style.display = Net.isTeacher && au ? "" : "none"; if (Net.isTeacher && au) renderSabControl($("#lobby-sabctl-body"), room); }
    if ($("#modal-sabpick").classList.contains("open")) renderSabControl($("#sp-body"), room);
    const pm = $("#pm-sab");
    if (pm) { pm.style.display = au ? "" : "none"; if (au && $("#modal-players").classList.contains("open")) renderSabControl($("#pm-sab-body"), room); }
  }
  function openPicker() {
    UI.openModal("modal-sabpick");
    renderPicker(Net.room);
    AudioManager.playSFX("menuOpen");
  }

  // ─────────────────────────────────────────────────────────────
  // 초대 링크 · QR 코드
  //  주소: 지금 게임 주소 + ?room=방번호  → 학생이 열면 방 번호가 자동으로 들어감
  // ─────────────────────────────────────────────────────────────
  function inviteUrl(code = Net.code) {
    const base = location.origin && location.origin !== "null" ? location.origin + location.pathname : location.href.split(/[?#]/)[0];
    return `${base}?room=${encodeURIComponent(code)}`;
  }
  // 클립보드 복사 (지원하지 않는 브라우저는 예전 방식 → 그래도 안 되면 주소를 보여 주고 직접 복사)
  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; }
    } catch (e) { /* 아래 방법으로 */ }
    try {
      const ta = document.createElement("textarea");
      ta.value = text; ta.setAttribute("readonly", "");
      ta.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0";
      document.body.appendChild(ta);
      ta.select(); ta.setSelectionRange(0, text.length);
      const ok = document.execCommand && document.execCommand("copy");
      ta.remove();
      if (ok) return true;
    } catch (e) { /* 아래 방법으로 */ }
    return false;
  }
  async function copyInvite() {
    const url = inviteUrl();
    if (await copyText(url)) { toast("초대 링크를 복사했습니다!"); AudioManager.playSFX("correct"); }
    else { openQr(); toast("자동 복사가 안 되는 브라우저예요. 아래 주소를 길게 눌러 복사해 주세요.", 4000); }
  }
  async function copyCode() {
    if (!Net.code) return;
    if (await copyText(Net.code)) { toast("방 코드를 복사했습니다!"); AudioManager.playSFX("correct"); }
    else toast(`방 번호는 ${Net.code} 이에요. 자동 복사가 안 되는 브라우저예요.`, 4000);
  }
  function drawQr(canvas, size) {
    const url = inviteUrl();
    const ok = typeof QRGen !== "undefined" && QRGen.draw(canvas, url, size);
    canvas.style.display = ok ? "" : "none";
    return ok;
  }
  function openQr() {
    const ok = drawQr($("#qr-big"), Math.min(420, window.innerWidth - 80, window.innerHeight - 260));
    $("#qr-fail").style.display = ok ? "none" : "";
    $("#qr-code").textContent = Net.code;
    $("#qr-url").value = inviteUrl();
    UI.openModal("modal-qr");
    AudioManager.playSFX("menuOpen");
  }
  function renderInvite() {
    const thumb = $("#lobby-qr");
    if (!thumb) return;
    const key = inviteUrl();
    if (thumb.dataset.url === key) return;
    thumb.dataset.url = key;
    drawQr(thumb, 96);
  }

  function init() {
    $("#btn-copy-invite").addEventListener("click", copyInvite);
    $("#btn-copy-code").addEventListener("click", copyCode);
    $("#btn-show-qr").addEventListener("click", openQr);
    $("#lobby-qr").addEventListener("click", openQr);
    $("#qr-copy").addEventListener("click", copyInvite);
    $("#qr-url").addEventListener("focus", (e) => e.target.select());
    $("#btn-sabpick").addEventListener("click", openPicker);
    $("#teacher-pin-ok").addEventListener("click", checkPin);
    $("#teacher-pin").addEventListener("keydown", (e) => { if (e.key === "Enter") checkPin(); });
    $("#btn-teacher-create").addEventListener("click", createRoom);
  }

  return {
    init, openPanel, openRoomSettings, refreshRoomSettings, openPlayers, confirmClick, enterView, frame, view,
    getPicks, pickStatus, pickMessage, renderPicker, inviteUrl, copyText, copyCode, renderInvite, openQr,
  };
})();
