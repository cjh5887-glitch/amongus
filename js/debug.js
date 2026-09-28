/* =====================================================================
   debug.js — 개발용 테스트 도구 (config.js 의 DEBUG_MODE = true 일 때만)
   ` (숫자 1 왼쪽 키) 또는 화면의 🐞 버튼으로 열고 닫습니다.
   ===================================================================== */

const Debug = (() => {
  let panel, body;
  let fps = 0, frames = 0, lastFpsAt = 0;
  const forcedRole = { value: SafeStore.get("rs_debug_role", "auto") };

  function init() {
    if (!DEBUG_MODE) return;
    const btn = document.createElement("button");
    btn.id = "debug-toggle";
    btn.textContent = "🐞";
    btn.title = "디버그 도구";
    document.body.appendChild(btn);

    panel = document.createElement("div");
    panel.id = "debug-panel";
    panel.innerHTML = `
      <div class="dbg-head">DEBUG <button class="dbg-x">✕</button></div>
      <div class="dbg-body"></div>
      <div class="dbg-row">
        <label>내 역할 강제 (방장일 때 적용)
          <select id="dbg-role">
            <option value="auto">자동</option><option value="student">학생</option><option value="saboteur">방해꾼</option>
          </select>
        </label>
      </div>
      <div class="dbg-row">
        <button data-dbg="collision">충돌 영역 보기</button>
        <button data-dbg="fog">시야 끄기/켜기</button>
        <button data-dbg="walls">벽 통과</button>
      </div>
      <div class="dbg-row">
        <button data-dbg="complete">내 미션 1개 즉시 완료</button>
        <button data-dbg="allmissions">모든 미션 위치 보기</button>
      </div>
      <div class="dbg-row host-only">
        <button data-dbg="blackout">정전 테스트 (8초)</button>
        <button data-dbg="meeting">회의 강제 실행</button>
        <button data-dbg="ghost">나를 유령으로</button>
      </div>
      <div class="dbg-row host-only">
        <button data-dbg="time-60">남은 시간 −1분</button>
        <button data-dbg="time+60">+1분</button>
        <button data-dbg="time30">30초로</button>
        <button data-dbg="end">게임 종료</button>
      </div>
      <p class="dbg-note">미션 화면의 「🐞 정답 넣기」로 정답을 자동 입력할 수 있어요. 방해꾼 능력을 시험하려면 게임 시작 전에 「내 역할 강제 → 방해꾼」을 고르세요.</p>`;
    document.body.appendChild(panel);
    body = panel.querySelector(".dbg-body");

    const toggle = () => panel.classList.toggle("open");
    btn.addEventListener("click", toggle);
    panel.querySelector(".dbg-x").addEventListener("click", toggle);
    window.addEventListener("keydown", (e) => { if (e.code === "Backquote") toggle(); });

    const sel = panel.querySelector("#dbg-role");
    sel.value = forcedRole.value;
    sel.addEventListener("change", () => { forcedRole.value = sel.value; SafeStore.set("rs_debug_role", sel.value); });

    panel.querySelectorAll("[data-dbg]").forEach((b) => b.addEventListener("click", () => action(b.dataset.dbg)));
    setInterval(refresh, 500);
  }

  function action(name) {
    const room = Net.room;
    if (name === "collision") Renderer.debug.showCollision = !Renderer.debug.showCollision;
    if (name === "fog") Renderer.debug.noFog = !Renderer.debug.noFog;
    if (name === "walls") { Player.me.passWalls = !Player.me.passWalls; toast(Player.me.passWalls ? "벽 통과 켬 (DEBUG)" : "벽 통과 끔"); }
    if (name === "allmissions") Renderer.debug.showAllMissions = !Renderer.debug.showAllMissions;
    if (name === "complete" && room && room.missions && GSM.is("PLAYING")) MissionSys.debugCompleteOne(room);
    if (!Net.isHost || !room || !room.game) return;
    if (name === "blackout" && room.meta.state === "PLAYING") Net.roomUpdate({ "sabotage/blackoutUntil": Net.now() + CONFIG.ABILITIES.blackout.duration * 1000 });
    if (name === "meeting") Meeting.debugForce(room);
    if (name === "ghost" && room.meta.state === "PLAYING") Net.roomUpdate({ [`ghosts/${Net.myId}`]: true });
    if (name.startsWith("time") && room.meta.state === "PLAYING") {
      const now = Net.now();
      let endAt = room.game.endAt;
      if (name === "time-60") endAt -= 60000;
      if (name === "time+60") endAt += 60000;
      if (name === "time30") endAt = now + 30000;
      Net.roomUpdate({ "game/endAt": Math.max(now + 1000, endAt) });
    }
    if (name === "end" && room.meta.state === "PLAYING") {
      Net.roomUpdate({ "meta/state": "GAMEOVER", "game/winner": "saboteur", "game/reason": "debug" });
    }
  }

  function tick() {
    frames++;
    const now = performance.now();
    if (now - lastFpsAt > 1000) { fps = frames; frames = 0; lastFpsAt = now; }
  }

  function refresh() {
    if (!panel || !panel.classList.contains("open")) return;
    const room = Net.room;
    const lines = [];
    lines.push(`모드: ${Net.mode === "online" ? "온라인(Firebase)" : "이 컴퓨터 안"} · 상태: ${GSM.current} · FPS ${fps}`);
    lines.push(`내 위치: ${Math.round(Player.me.x)}, ${Math.round(Player.me.y)} · ${(GameMap.roomAt(Player.me.x, Player.me.y) || {}).name || "-"}`);
    if (room && room.players) {
      Object.keys(room.players).forEach((id) => {
        const p = room.players[id];
        const role = room.roles ? (room.roles[id] === "saboteur" ? "🟣방해꾼" : "🔵학생") : "";
        lines.push(`${p.nick}${id === Net.myId ? "(나)" : ""} ${role}${room.meta.hostId === id ? " 👑" : ""}`);
      });
    }
    body.textContent = "";
    lines.forEach((l) => { const d = document.createElement("div"); d.textContent = l; body.appendChild(d); });
    panel.querySelector(".host-only").style.display = Net.isHost ? "" : "none";
  }

  return { init, tick, forcedRole: () => forcedRole.value };
})();
