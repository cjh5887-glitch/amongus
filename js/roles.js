/* =====================================================================
   roles.js — 역할 배정
     얼음땡 모드:   학생(student) / 술래(tagger)
     어몽어스 모드: 학생(student) / 방해꾼(saboteur)
   ===================================================================== */

/* ─────────────────────────────────────────────────────────────
   Roster — "이번 게임에 참가한 사람" 명단 (4단계)
   ▸ 게임을 시작할 때 방장이 members 에 명단을 저장합니다.
   ▸ 연결이 잠깐 끊겨도(태블릿 화면 꺼짐, 새로고침) 명단에는 남아 있어서
     미션 수·승패가 갑자기 바뀌지 않습니다.
   ▸ 60초 넘게 돌아오지 않으면 방장이 gone 으로 표시 → 그때부터 계산에서 빠집니다.
   ▸ 대기실(members 없음)에서는 지금 접속한 사람(players)이 명단입니다.
   ───────────────────────────────────────────────────────────── */
const Roster = {
  ids(room) {
    if (!room) return [];
    if (room.members) return Object.keys(room.members).filter((id) => !(room.gone && room.gone[id]));
    return Object.keys(room.players || {});
  },
  has(room, id) { return Roster.ids(room).includes(id); },
  info(room, id) {
    return (room && room.players && room.players[id]) || (room && room.members && room.members[id]) || null;
  },
  nick(room, id) { const p = Roster.info(room, id); return p ? p.nick : "누군가"; },
  online(room, id) { return !!(room && room.players && room.players[id]); },
};

const Roles = (() => {
  const LABELS = { student: "학생", saboteur: "방해꾼", tagger: "술래" };
  const label = (role) => LABELS[role] || "학생";

  // 인원에 맞는 방해꾼 수 (학생이 방해꾼보다 항상 많도록 제한)
  function saboteurCount(n, setting) {
    const want = setting === "auto" || setting == null ? recommendSaboteurs(n) : Number(setting);
    const max = Math.max(0, Math.ceil(n / 2) - 1); // 4명→1, 6명→2, 10명→4
    return clamp(want, 0, max);
  }

  // 설정한 방해꾼 수가 인원에 비해 너무 많은지
  function tooMany(n, setting) {
    if (setting === "auto" || setting == null) return false;
    return Number(setting) * 2 >= n;
  }

  // 인원에 맞는 술래 수 (학생이 술래의 2배 이상 되도록 제한: 4명→1, 7명→2, 10명→3)
  function taggerCount(n, setting) {
    if (n < 2) return 0;   // (DEBUG) 혼자 테스트할 때는 술래 없음
    const want = setting === "auto" || setting == null ? recommendTaggers(n) : Number(setting);
    const max = Math.max(1, Math.floor((n - 1) / 3));
    return clamp(want, 1, max);
  }
  function tooManyTaggers(n, setting) {
    if (setting === "auto" || setting == null) return false;
    return Number(setting) > Math.max(1, Math.floor((n - 1) / 3));
  }

  // ids: 참가자 id 목록, count: 특별 역할 수, special: "saboteur" | "tagger"
  // forced: { id: "student" | "special" } (DEBUG 용)
  function assignSpecial(ids, count, special, forced = {}) {
    const roles = {};
    const isSpecial = (v) => v === "special" || v === special || v === "saboteur" || v === "tagger";
    const forcedSp = ids.filter((id) => isSpecial(forced[id]));
    const forcedStu = ids.filter((id) => forced[id] === "student");
    forcedSp.forEach((id) => { roles[id] = special; });
    forcedStu.forEach((id) => { roles[id] = "student"; });
    count = Math.max(count, forcedSp.length);
    const rest = shuffle(ids.filter((id) => !roles[id]));
    let need = count - forcedSp.length;
    rest.forEach((id) => {
      if (need > 0) { roles[id] = special; need--; }
      else roles[id] = "student";
    });
    return roles;
  }

  // (예전 방식 그대로) 어몽어스 방해꾼 배정
  function assign(ids, settingValue, forced = {}) {
    return assignSpecial(ids, saboteurCount(ids.length, settingValue), "saboteur", forced);
  }

  function isSaboteur(room, id) {
    return !!(room && room.roles && room.roles[id] === "saboteur");
  }
  function isTagger(room, id) {
    return !!(room && room.roles && room.roles[id] === "tagger");
  }

  function saboteurs(room) {
    if (!room || !room.roles) return [];
    return Object.keys(room.roles).filter((id) => room.roles[id] === "saboteur");
  }
  function taggers(room) {
    if (!room || !room.roles) return [];
    return Object.keys(room.roles).filter((id) => room.roles[id] === "tagger");
  }
  // 특별 역할 (술래 또는 방해꾼)
  function specials(room) {
    if (!room || !room.roles) return [];
    return Object.keys(room.roles).filter((id) => room.roles[id] !== "student");
  }

  return {
    saboteurCount, tooMany, taggerCount, tooManyTaggers, assign, assignSpecial,
    isSaboteur, isTagger, saboteurs, taggers, specials, label, LABELS,
  };
})();
