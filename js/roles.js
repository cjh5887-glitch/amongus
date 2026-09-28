/* =====================================================================
   roles.js — 역할 배정 (학생 / 방해꾼)
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

  // ids: 참가자 id 목록, forced: { id: "student"|"saboteur" } (DEBUG 용)
  function assign(ids, settingValue, forced = {}) {
    const n = ids.length;
    let count = saboteurCount(n, settingValue);
    const roles = {};
    const forcedSab = ids.filter((id) => forced[id] === "saboteur");
    const forcedStu = ids.filter((id) => forced[id] === "student");
    forcedSab.forEach((id) => { roles[id] = "saboteur"; });
    forcedStu.forEach((id) => { roles[id] = "student"; });
    count = Math.max(count, forcedSab.length);
    const rest = shuffle(ids.filter((id) => !roles[id]));
    let need = count - forcedSab.length;
    rest.forEach((id) => {
      if (need > 0) { roles[id] = "saboteur"; need--; }
      else roles[id] = "student";
    });
    return roles;
  }

  function isSaboteur(room, id) {
    return !!(room && room.roles && room.roles[id] === "saboteur");
  }

  function saboteurs(room) {
    if (!room || !room.roles) return [];
    return Object.keys(room.roles).filter((id) => room.roles[id] === "saboteur");
  }

  return { saboteurCount, tooMany, assign, isSaboteur, saboteurs };
})();
