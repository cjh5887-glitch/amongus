/* =====================================================================
   state.js — GameStateManager (게임 상태를 한 곳에서만 바꿉니다)

   상태 목록
     TITLE        메인 화면 (닉네임, 방 만들기/참가)
     LOBBY        대기실 (방장 설정)
     ROLE_REVEAL  역할 공개 (3초)
     STORY        스토리
     COUNTDOWN    3초 카운트다운
     PLAYING      게임 중
     MISSION      미션 풀이 중        (다음 단계)
     MEETING      긴급회의·투표       (다음 단계)
     RESULT       나의 수학 기록      (다음 단계)
     GAMEOVER     게임 종료

   ▸ 화면마다 enter(data, signal) 에서 이벤트를 등록할 때
     addEventListener(..., { signal }) 을 쓰면,
     상태가 바뀔 때 자동으로 전부 해제됩니다. (이벤트 중복 방지)
   ===================================================================== */

const GameStateManager = (() => {
  const states = {};
  let current = null;
  let controller = null;
  const listeners = [];

  function register(name, def) {
    states[name] = def;
  }

  function set(name, data) {
    if (!states[name]) { console.warn("알 수 없는 상태:", name); return; }
    if (name === current) return;
    const prev = current;
    if (prev && states[prev].exit) states[prev].exit(name);
    if (controller) controller.abort();
    controller = new AbortController();
    current = name;
    document.body.dataset.state = name;
    states[name].enter && states[name].enter(data, controller.signal, prev);
    listeners.forEach((fn) => fn(name, prev));
  }

  // 방 정보가 바뀌었을 때 현재 화면만 새로 그리기
  function update(room) {
    if (current && states[current].update) states[current].update(room);
  }

  function is(...names) { return names.includes(current); }

  // 캐릭터가 움직일 수 있는 상태는 PLAYING 하나뿐입니다.
  // (미션·회의·카운트다운·게임 종료 중에는 이동 불가)
  function canMove() { return current === "PLAYING"; }

  // 맵을 그려야 하는 상태
  function inWorld() { return ["COUNTDOWN", "PLAYING", "MISSION", "MEETING"].includes(current); }

  return {
    register, set, update, is, canMove, inWorld,
    onChange: (fn) => listeners.push(fn),
    get current() { return current; },
  };
})();

const GSM = GameStateManager;
