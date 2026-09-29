/* =====================================================================
   input.js — 키보드(WASD·방향키) + 태블릿 가상 조이스틱

   ▸ Input.vector()      → 이동 방향 {x, y} (길이 0~1)
   ▸ Input.onAction(fn)  → "mission" | "report" | "rescue" | "catch" | "sabotage" | "map" | "ability1~3" 버튼/키 입력
   ▸ Input.isHeld(name)  → 그 버튼/키를 지금 누르고 있는지 (얼음땡 [땡] 은 누르고 있어야 해요)
   ===================================================================== */

const Input = (() => {
  const keys = new Set();
  const joy = { active: false, id: null, sx: 0, sy: 0, x: 0, y: 0 };
  const actionHandlers = [];
  const held = new Map();      // 누르고 있는 동작 → 누른 방법 수 (키 · 손가락)
  const JOY_RADIUS = 56;

  // E 미션 · R 신고/땡 · Q(또는 스페이스) 잡기/얼리기 · F 방해 · M 지도 · 1~3 방해 기능
  const KEY_ACTIONS = { KeyE: "mission", KeyR: "report", KeyQ: "catch", Space: "catch", KeyF: "sabotage", KeyM: "map", Digit1: "ability1", Digit2: "ability2", Digit3: "ability3" };
  const MOVE_KEYS = ["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];

  function isTyping(e) {
    const t = e.target;
    return t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
  }

  function emit(name) { actionHandlers.forEach((fn) => fn(name)); }
  function hold(name, src) { const m = held.get(name) || new Set(); m.add(src); held.set(name, m); }
  function unhold(name, src) { const m = held.get(name); if (m) { m.delete(src); if (!m.size) held.delete(name); } }

  function init() {
    window.addEventListener("keydown", (e) => {
      if (isTyping(e)) return;
      if (MOVE_KEYS.includes(e.code)) { keys.add(e.code); if (GSM.inWorld()) e.preventDefault(); }
      if (KEY_ACTIONS[e.code]) {
        if (e.code === "Space" && GSM.inWorld()) e.preventDefault();
        hold(KEY_ACTIONS[e.code], "key:" + e.code);
        if (!e.repeat) emit(KEY_ACTIONS[e.code]);
      }
    });
    window.addEventListener("keyup", (e) => { keys.delete(e.code); if (KEY_ACTIONS[e.code]) unhold(KEY_ACTIONS[e.code], "key:" + e.code); });
    // 창을 벗어나면 키가 눌린 채로 남지 않게
    window.addEventListener("blur", () => { keys.clear(); held.clear(); resetJoy(); });
    document.addEventListener("visibilitychange", () => { if (document.hidden) { keys.clear(); held.clear(); resetJoy(); } });

    // ── 조이스틱 ──
    const zone = document.getElementById("joystick-zone");
    const base = document.getElementById("joystick-base");
    const knob = document.getElementById("joystick-knob");

    zone.addEventListener("pointerdown", (e) => {
      if (joy.active) return;
      joy.active = true; joy.id = e.pointerId;
      joy.sx = e.clientX; joy.sy = e.clientY; joy.x = 0; joy.y = 0;
      try { zone.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
      base.style.left = e.clientX + "px"; base.style.top = e.clientY + "px";
      base.classList.add("active");
      knob.style.transform = "translate(-50%, -50%)";
      e.preventDefault();
    });
    zone.addEventListener("pointermove", (e) => {
      if (!joy.active || e.pointerId !== joy.id) return;
      let dx = e.clientX - joy.sx, dy = e.clientY - joy.sy;
      const d = Math.hypot(dx, dy);
      if (d > JOY_RADIUS) { dx = (dx / d) * JOY_RADIUS; dy = (dy / d) * JOY_RADIUS; }
      joy.x = dx / JOY_RADIUS; joy.y = dy / JOY_RADIUS;
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      e.preventDefault();
    });
    const end = (e) => { if (e.pointerId === joy.id) resetJoy(); };
    zone.addEventListener("pointerup", end);
    zone.addEventListener("pointercancel", end);
    zone.addEventListener("lostpointercapture", end);

    // ── 오른쪽 버튼들 ──
    document.querySelectorAll("[data-action]").forEach((btn) => {
      const name = btn.dataset.action;
      btn.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        // 누르고 있어야 하는 버튼([땡])은 흐리게 보여도 누르고 있는 상태를 기억 (친구에게 다가가는 중일 수 있음)
        if (btn.hasAttribute("data-hold")) {
          hold(name, "ptr:" + e.pointerId);
          try { btn.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
        }
        if (btn.disabled || btn.classList.contains("disabled")) return;
        emit(name);
      });
      if (btn.hasAttribute("data-hold")) {
        const up = (e) => unhold(name, "ptr:" + e.pointerId);
        btn.addEventListener("pointerup", up);
        btn.addEventListener("pointercancel", up);
        btn.addEventListener("lostpointercapture", up);
      }
    });
  }

  function resetJoy() {
    joy.active = false; joy.id = null; joy.x = 0; joy.y = 0;
    const base = document.getElementById("joystick-base");
    const knob = document.getElementById("joystick-knob");
    if (base) { base.classList.remove("active"); base.style.left = ""; base.style.top = ""; }
    if (knob) knob.style.transform = "translate(-50%, -50%)";
  }

  function vector() {
    let x = 0, y = 0;
    if (keys.has("KeyA") || keys.has("ArrowLeft")) x -= 1;
    if (keys.has("KeyD") || keys.has("ArrowRight")) x += 1;
    if (keys.has("KeyW") || keys.has("ArrowUp")) y -= 1;
    if (keys.has("KeyS") || keys.has("ArrowDown")) y += 1;
    if (x || y) { const l = Math.hypot(x, y); return { x: x / l, y: y / l }; }
    if (joy.active) {
      const l = Math.hypot(joy.x, joy.y);
      if (l < 0.15) return { x: 0, y: 0 }; // 살짝 닿은 것은 무시
      return { x: joy.x, y: joy.y };
    }
    return { x: 0, y: 0 };
  }

  function clear() { keys.clear(); held.clear(); resetJoy(); }

  return {
    init, vector, clear, onAction: (fn) => actionHandlers.push(fn),
    isHeld: (name) => held.has(name),
    release: (name) => held.delete(name),
  };
})();
