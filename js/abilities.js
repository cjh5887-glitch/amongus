/* =====================================================================
   abilities.js — (어몽어스) 방해꾼의 [방해] 기능 3가지 + 정전·위장·유령 상태 확인

   [방해] 버튼을 누르면 아래 버튼이 열립니다. (교사 설정에서 켜고 끌 수 있음)
     ⚡ 정전     8초 동안 학생 시야가 크게 줄어듦 · 쿨타임 40초 · 유령은 영향 없음
     🔒 문 잠금  고른 교실의 문을 7초 동안 잠금 · 쿨타임 45초 · 한 번에 한 교실만
     🎭 위장     10초 동안 다른 학생의 색으로 변함 · 게임당 2회
   ※ 학생을 탈락시키는 [얼리기]는 modes.js 의 AmongUsMode 에 있습니다.
     (예전의 「3초 동안 멈추는 얼리기」는 탈락 방식 얼리기로 바뀌었어요)

   방 데이터
     sabotage   { blackoutUntil, doors: { 문id: 잠금 끝나는 시각 } }
     disguise/{플레이어} { color, until }
     disguiseUses/{플레이어} 사용 횟수
     ghosts/{플레이어}   "frozen" | "voted"   (얼려짐 / 투표로 제외됨)
   ===================================================================== */

const Abilities = (() => {
  // ── 방해꾼 본인만 기억 ──
  let ready = {};            // 능력 → 다시 쓸 수 있는 시각 (Date.now 기준)

  const now = () => Net.now();
  const settingsOf = (room) => roomSettings(room);

  // ─────────────────────────────────────────────────────────────
  // 상태 확인 (모든 플레이어가 함께 사용)
  // ─────────────────────────────────────────────────────────────
  const isGhost = (room, pid) => !!(room && room.ghosts && room.ghosts[pid]);
  const isAlive = (room, pid) => Roster.has(room, pid) && !isGhost(room, pid);

  function blackoutLeft(room) {
    const until = room && room.sabotage && room.sabotage.blackoutUntil;
    return until ? Math.max(0, until - now()) : 0;
  }

  function disguiseOf(room, pid) {
    const d = room && room.disguise && room.disguise[pid];
    return d && d.until > now() ? d : null;
  }

  // 잠긴 문을 맵에 반영 (매 프레임)
  function applyDoorLocks(room) {
    const doors = (room && room.sabotage && room.sabotage.doors) || {};
    const t = now();
    GameMap.DOORS.forEach((d) => { d.locked = !!(doors[d.id] && doors[d.id] > t); });
  }

  // ─────────────────────────────────────────────────────────────
  // 방해꾼 능력 사용
  // ─────────────────────────────────────────────────────────────
  function resetLocal() {
    const t = Date.now();
    const A = CONFIG.ABILITIES;
    ready = { blackout: t + A.blackout.first * 1000, lockDoor: t + A.lockDoor.first * 1000, disguise: t };
    closeDoorPicker();
  }

  // 회의가 끝나면 모든 능력을 잠깐 쉬게 (회의 직후 바로 방해하지 못하게)
  function afterMeeting() {
    const t = Date.now() + CONFIG.AFTER_MEETING_COOLDOWN * 1000;
    Object.keys(ready).forEach((k) => { if (k !== "disguise") ready[k] = Math.max(ready[k], t); });
    closeDoorPicker();
  }

  const cooldownLeft = (name) => Math.max(0, (ready[name] || 0) - Date.now());

  function canUse(room, name) {
    if (!room || !GameModeManager.isAU(room)) return false;
    if (!Roles.isSaboteur(room, Net.myId) || isGhost(room, Net.myId)) return false;
    if (!settingsOf(room)[name]) return false;
    if (!GSM.is("PLAYING")) return false;
    if (name === "disguise") return usesLeft(room) > 0 && !disguiseOf(room, Net.myId);
    return cooldownLeft(name) === 0;
  }

  function usesLeft(room) {
    const used = (room && room.disguiseUses && room.disguiseUses[Net.myId]) || 0;
    return Math.max(0, CONFIG.ABILITIES.disguise.uses - used);
  }

  function use(name) {
    const room = Net.room;
    if (!canUse(room, name)) {
      if (room && Roles.isSaboteur(room, Net.myId) && !isGhost(room, Net.myId)) {
        const left = cooldownLeft(name);
        if (name === "disguise" && disguiseOf(room, Net.myId)) toast("이미 위장 중이에요.");
        else if (name === "disguise" && usesLeft(room) === 0) toast("위장은 이번 게임에서 모두 사용했어요.");
        else if (left > 0) toast(`${Math.ceil(left / 1000)}초 뒤에 다시 쓸 수 있어요.`);
      }
      return;
    }
    const A = CONFIG.ABILITIES;
    const t = now();
    if (name === "blackout") {
      Net.roomUpdate({ "sabotage/blackoutUntil": t + A.blackout.duration * 1000 });
      ready.blackout = Date.now() + A.blackout.cooldown * 1000;
      toast("⚡ 정전을 일으켰어요!");
    }
    if (name === "disguise") {
      const others = Roster.ids(room).filter((pid) => pid !== Net.myId && isAlive(room, pid));
      if (!others.length) { toast("위장할 대상이 없어요."); return; }
      const pick = others[Math.floor(Math.random() * others.length)];
      const used = (room.disguiseUses && room.disguiseUses[Net.myId]) || 0;
      Net.roomUpdate({
        [`disguise/${Net.myId}`]: { color: Roster.info(room, pick).color, until: t + A.disguise.duration * 1000 },
        [`disguiseUses/${Net.myId}`]: used + 1,
      });
      AudioManager.playSFX("disguise");
      toast(`🎭 ${colorOf(Roster.info(room, pick).color).name}색으로 위장했어요! (${A.disguise.duration}초)`);
    }
    if (name === "lockDoor") openDoorPicker();
  }

  // ── 문 잠금: 교실 고르기 ──
  function openDoorPicker() {
    const box = $("#door-picker");
    const list = $("#door-picker-list");
    list.innerHTML = "";
    GameMap.ROOMS.forEach((r) => {
      const doors = GameMap.DOORS.filter((d) => d.room === r.id);
      if (!doors.length) return;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "btn small";
      b.textContent = `${r.name} (문 ${doors.length}개)`;
      b.addEventListener("click", () => lockRoom(r.id));
      list.appendChild(b);
    });
    box.classList.add("open");
  }
  function closeDoorPicker() { const b = $("#door-picker"); if (b) b.classList.remove("open"); }

  function lockRoom(roomId) {
    closeDoorPicker();
    const room = Net.room;
    if (!canUse(room, "lockDoor")) return;
    const A = CONFIG.ABILITIES.lockDoor;
    const until = now() + A.duration * 1000;
    // 한 번에 한 교실만: 이전 잠금은 모두 풀고 새로 잠금
    const doors = {};
    GameMap.DOORS.forEach((d) => { if (d.room === roomId) doors[d.id] = until; });
    Net.roomUpdate({ "sabotage/doors": doors });
    AudioManager.playSFX("lockDoor");
    ready.lockDoor = Date.now() + A.cooldown * 1000;
    const r = GameMap.ROOMS.find((x) => x.id === roomId);
    toast(`🔒 ${r ? r.name : ""} 문을 잠갔어요! (${A.duration}초)`);
  }

  // ─────────────────────────────────────────────────────────────
  // 능력 버튼 표시 (어몽어스 방해꾼이 [방해] 버튼을 눌러 열었을 때만, 켜진 능력만)
  // ─────────────────────────────────────────────────────────────
  const NAMES = ["blackout", "lockDoor", "disguise"];
  let lastUiKey = "";
  function updateButtons(room) {
    const sab = room && GameModeManager.isAU(room) && Roles.isSaboteur(room, Net.myId) && !isGhost(room, Net.myId) && GSM.inWorld() && AmongUsMode.sabotageOpen;
    const s = settingsOf(room);
    const bar = $("#ability-bar");
    const parts = [sab ? 1 : 0];
    NAMES.forEach((n) => {
      const on = sab && s[n];
      let text = "", ratio = 0, off = false;
      if (on) {
        if (n === "disguise") {
          const left = usesLeft(room);
          const active = disguiseOf(room, Net.myId);
          text = active ? "위장 중" : `${left}회`;
          off = left === 0 || !!active;
        } else {
          const left = cooldownLeft(n);
          const total = (n === "blackout" ? CONFIG.ABILITIES.blackout.cooldown : CONFIG.ABILITIES.lockDoor.cooldown) * 1000;
          ratio = clamp(left / total, 0, 1);
          text = left > 0 ? String(Math.ceil(left / 1000)) : "";
          off = left > 0;
        }
      }
      parts.push(on ? 1 : 0, text, Math.round(ratio * 40), off ? 1 : 0);
    });
    const key = parts.join("|");
    if (key === lastUiKey) return;
    lastUiKey = key;
    bar.style.display = sab ? "" : "none";
    NAMES.forEach((n, i) => {
      const btn = bar.querySelector(`[data-ability="${n}"]`);
      const on = parts[1 + i * 4] === 1;
      btn.style.display = on ? "" : "none";
      btn.querySelector(".cd").textContent = parts[2 + i * 4];
      btn.style.setProperty("--cd", parts[3 + i * 4] / 40);
      btn.classList.toggle("cooling", parts[4 + i * 4] === 1);
    });
  }

  function init() {
    $$("#ability-bar [data-ability]").forEach((b) => {
      b.addEventListener("pointerdown", (e) => { e.preventDefault(); use(b.dataset.ability); });
    });
    $("#door-picker-close").addEventListener("click", closeDoorPicker);
    // PC: 숫자키 1 정전 · 2 문 잠금 · 3 위장  ([방해] 버튼을 열지 않아도 바로 사용 가능)
    Input.onAction((name) => {
      const map = { ability1: "blackout", ability2: "lockDoor", ability3: "disguise" };
      if (map[name] && GSM.is("PLAYING")) use(map[name]);
    });
  }

  return {
    init, resetLocal, afterMeeting, use, updateButtons, closeDoorPicker,
    isGhost, isAlive, blackoutLeft, disguiseOf, applyDoorLocks, cooldownLeft,
  };
})();
