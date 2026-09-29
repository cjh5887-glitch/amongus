/* =====================================================================
   playerState.js — PlayerState (플레이어 상태를 한 곳에서 확인)

     NORMAL     보통 (움직이고 미션 가능)
     FROZEN     얼음 (얼음땡: 술래에게 잡힘 → 친구가 [땡] 하면 풀림)
     PROTECTED  보호 (얼음땡: 땡으로 풀린 뒤 잠깐 동안 다시 잡히지 않음)
     GHOST      유령 (어몽어스: 방해꾼에게 얼려졌거나 투표로 제외됨)

   방 데이터
     frozen/{플레이어}   { by, t }            얼음땡에서 얼어 있는 학생
     protect/{플레이어}  보호가 끝나는 시각
     ghosts/{플레이어}   "frozen" | "voted"   어몽어스 탈락 (얼리기 / 투표)
     traces/{플레이어}   { x, y, color, t, by } 어몽어스 얼음 흔적 (신고하면 회의)

   ▸ 새 게임을 시작할 때 방장이 위 기록을 모두 지웁니다. (모드를 바꿔도 이전 상태가 남지 않음)
   ===================================================================== */

const PlayerState = (() => {
  const NORMAL = "NORMAL", FROZEN = "FROZEN", PROTECTED = "PROTECTED", GHOST = "GHOST";
  const now = () => Net.now();

  function isGhost(room, pid) { return !!(room && room.ghosts && room.ghosts[pid]); }
  function isFrozen(room, pid) { return !!(room && room.frozen && room.frozen[pid]) && !isGhost(room, pid); }
  function protectLeft(room, pid) {
    const until = room && room.protect && room.protect[pid];
    return until ? Math.max(0, until - now()) : 0;
  }
  function isProtected(room, pid) { return protectLeft(room, pid) > 0; }

  function of(room, pid) {
    if (isGhost(room, pid)) return GHOST;
    if (isFrozen(room, pid)) return FROZEN;
    if (isProtected(room, pid)) return PROTECTED;
    return NORMAL;
  }

  // 유령이 된 이유 ("frozen" 얼리기 / "voted" 투표)
  function ghostReason(room, pid) {
    const g = room && room.ghosts && room.ghosts[pid];
    return g === "frozen" ? "frozen" : g ? "voted" : null;
  }

  const LABEL = { NORMAL: "정상", FROZEN: "🧊 얼음", PROTECTED: "🛡 보호", GHOST: "👻 유령" };

  return { NORMAL, FROZEN, PROTECTED, GHOST, of, isGhost, isFrozen, isProtected, protectLeft, ghostReason, LABEL };
})();
