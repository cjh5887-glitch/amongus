/* =====================================================================
   settingsMenu.js — ⚙ 환경설정 (게임 중 오른쪽 위 ⚙ 버튼 · PC 는 ESC 키)

     전체 음량 · 배경음악 음량 · 효과음 음량 (0~100, 이 기기에 저장)
     배경음악 켜기/끄기 · 효과음 켜기/끄기
     조작 방법 · 전체화면
     대기방으로 나가기 (확인창을 한 번 더 보여 줌) · 게임으로 돌아가기

   ESC 키 규칙
     ▸ 미션 화면이 열려 있으면 → 미션 나가기 (미션 화면이 처리)
     ▸ 확인창 · 환경설정 · 다른 창 · 지도 · 방해 버튼이 열려 있으면 → 그것을 닫기
     ▸ 아무것도 열려 있지 않으면 → 환경설정 열기
   ===================================================================== */

const SettingsMenu = (() => {
  let hooks = { onLeave: () => {}, closeMinimap: () => false };

  const isOpen = () => $("#modal-settings").classList.contains("open");
  const confirmOpen = () => $("#modal-confirm-leave").classList.contains("open");

  // 게임 중(나가기 버튼이 필요한) 상태
  const IN_GAME = ["ROLE_REVEAL", "STORY", "COUNTDOWN", "PLAYING", "MISSION", "MEETING"];

  function open() {
    if (isOpen()) return;
    Input.clear();
    render();
    UI.openModal("modal-settings");
    AudioManager.playSFX("menuOpen");
  }
  function close() {
    if (!isOpen()) return;
    UI.closeModal("modal-settings");
    closeConfirm();
    AudioManager.playSFX("menuClose");
  }
  function toggle() { if (isOpen()) close(); else open(); }

  function render() {
    const a = AudioManager.settings;
    [["master", a.MASTER_VOLUME], ["bgm", a.BGM_VOLUME], ["sfx", a.SFX_VOLUME]].forEach(([k, v]) => {
      $(`#vol-${k}`).value = v;
      $(`#vol-${k}-v`).textContent = v;
    });
    const tb = $("#tg-bgm"), ts = $("#tg-sfx");
    tb.classList.toggle("on", a.BGM_ON); tb.textContent = a.BGM_ON ? "🎵 배경음악 켜짐" : "🎵 배경음악 꺼짐";
    ts.classList.toggle("on", a.SFX_ON); ts.textContent = a.SFX_ON ? "🔊 효과음 켜짐" : "🔇 효과음 꺼짐";
    const inGame = GSM.is(...IN_GAME) && !Net.isTeacher && Net.code;
    $("#st-leave").style.display = inGame ? "" : "none";
    $("#st-back").textContent = GSM.is("PLAYING", "MISSION", "MEETING", "COUNTDOWN") ? "게임으로 돌아가기" : "닫기";
    $("#st-fullscreen").textContent = document.fullscreenElement ? "⛶ 전체화면 끝내기" : "⛶ 전체화면";
    $("#st-controls-body").innerHTML = controlsHtml();
  }

  function controlsHtml() {
    const room = Net.room;
    const mode = room ? GameModeManager.get(room) : null;
    const role = room && room.roles && room.roles[Net.myId];
    const rows = [["이동", "WASD · 방향키", "화면 왼쪽을 누르고 끌기 (조이스틱)"], ["지도", "M", "[지도] 버튼"]];
    if (!mode || role !== "tagger") rows.push(["미션", "반짝이는 내 장치 앞에서 E", "[미션] 버튼 (노랗게 반짝일 때)"]);
    if (!mode || mode.id === GAME_MODES.FREEZE_TAG) {
      if (role === "tagger") rows.push(["잡기 (술래)", "학생 옆에서 Q 또는 스페이스", "[잡기] 버튼"]);
      else rows.push(["땡 (얼음땡)", "얼어 있는 친구 옆에서 R 을 누르고 있기", "[땡] 버튼을 누르고 있기"]);
    }
    if (!mode || mode.id === GAME_MODES.AMONG_US) {
      if (role === "saboteur") {
        rows.push(["얼리기 (방해꾼)", "학생 옆에서 Q 또는 스페이스", "[얼리기] 버튼"]);
        rows.push(["방해 (방해꾼)", "F 로 열기 · 1 정전 · 2 문 잠금 · 3 위장", "[방해] 버튼 → 정전·문 잠금·위장"]);
      } else rows.push(["신고 · 긴급회의", "얼음 흔적 옆 / 중앙 복도 빨간 버튼 앞에서 R", "[신고] 버튼"]);
    }
    rows.push(["미션 안에서", "숫자키 · Enter(확인) · Esc(나가기)", "화면 버튼 · 슬라이더 · 끌어다 놓기"]);
    rows.push(["환경설정", "ESC", "오른쪽 위 ⚙"]);
    return `<table class="st-keys"><tr><th></th><th>컴퓨터</th><th>태블릿</th></tr>` +
      rows.map(([a, b, c]) => `<tr><th>${a}</th><td>${b}</td><td>${c}</td></tr>`).join("") + "</table>";
  }

  function toggleFullscreen() {
    const d = document.documentElement;
    try {
      if (!document.fullscreenElement) (d.requestFullscreen || d.webkitRequestFullscreen || (() => {})).call(d);
      else (document.exitFullscreen || document.webkitExitFullscreen || (() => {})).call(document);
    } catch (e) { /* 무시 */ }
    setTimeout(() => { if (isOpen()) render(); }, 300);
  }

  function openConfirm() { UI.openModal("modal-confirm-leave"); AudioManager.playSFX("menuOpen"); }
  function closeConfirm() { UI.closeModal("modal-confirm-leave"); }

  function onEscape(e) {
    if (e.key !== "Escape" && e.code !== "Escape") return;
    if (GSM.is("MISSION")) return;                       // 미션 화면이 알아서 닫음
    if (confirmOpen()) { closeConfirm(); return; }
    if (isOpen()) { close(); return; }
    const other = $$(".modal.open");
    if (other.length) { other.forEach((m) => m.classList.remove("open")); return; }
    if (hooks.closeMinimap()) return;
    const door = $("#door-picker");
    if (door && door.classList.contains("open")) { Abilities.closeDoorPicker(); return; }
    if (AmongUsMode.sabotageOpen) { AmongUsMode.setSabotageOpen(false); return; }
    if (GSM.is("TITLE")) return;
    open();
  }

  function init(h) {
    hooks = { ...hooks, ...h };
    $$(".btn-settings").forEach((b) => b.addEventListener("click", (e) => { e.preventDefault(); toggle(); }));
    const bind = (k, fn) => {
      const el = $(`#vol-${k}`);
      el.addEventListener("input", () => { fn(el.value); $(`#vol-${k}-v`).textContent = el.value; });
      el.addEventListener("change", () => AudioManager.playSFX("click"));
    };
    bind("master", AudioManager.setMasterVolume);
    bind("bgm", AudioManager.setBGMVolume);
    bind("sfx", AudioManager.setSFXVolume);
    $("#tg-bgm").addEventListener("click", () => { AudioManager.setBGMEnabled(!AudioManager.settings.BGM_ON); render(); });
    $("#tg-sfx").addEventListener("click", () => { AudioManager.setSFXEnabled(!AudioManager.settings.SFX_ON); render(); });
    $("#st-fullscreen").addEventListener("click", toggleFullscreen);
    $("#st-back").addEventListener("click", close);
    $("#st-leave").addEventListener("click", openConfirm);
    $("#cf-cancel").addEventListener("click", () => { closeConfirm(); AudioManager.playSFX("menuClose"); });
    $("#cf-leave").addEventListener("click", () => { closeConfirm(); UI.closeModal("modal-settings"); hooks.onLeave(); });
    window.addEventListener("keydown", onEscape);
  }

  return { init, open, close, toggle, toggleFullscreen, get isOpen() { return isOpen() || confirmOpen(); } };
})();
