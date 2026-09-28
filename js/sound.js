/* =====================================================================
   sound.js — 효과음
   assets/sounds/ 폴더에 아래 이름의 mp3 파일을 넣으면 자동으로 연결됩니다.
   파일이 없어도 게임은 조용히 정상 실행됩니다.

     start.mp3     게임 시작          found.mp3    미션 발견
     correct.mp3   정답               wrong.mp3    오답
     blackout.mp3  정전               meeting.mp3  긴급회의
     win.mp3       승리               lose.mp3     패배
   ===================================================================== */

const Sound = (() => {
  const NAMES = ["start", "found", "correct", "wrong", "blackout", "meeting", "win", "lose"];
  const cache = {};
  const missing = new Set();
  let muted = SafeStore.get("rs_muted", false);

  function load(name) {
    if (cache[name] || missing.has(name)) return cache[name];
    try {
      const a = new Audio("assets/sounds/" + name + ".mp3");
      a.preload = "auto";
      a.addEventListener("error", () => { missing.add(name); delete cache[name]; });
      cache[name] = a;
      return a;
    } catch (e) { missing.add(name); return null; }
  }

  function play(name, volume = 0.7) {
    if (muted || missing.has(name)) return;
    const a = load(name);
    if (!a) return;
    try {
      const c = a.cloneNode();
      c.volume = volume;
      const p = c.play();
      if (p && p.catch) p.catch(() => {});
    } catch (e) { /* 무시 */ }
  }

  function setMuted(v) { muted = v; SafeStore.set("rs_muted", v); }

  NAMES.forEach(load);
  return { play, setMuted, get muted() { return muted; } };
})();
