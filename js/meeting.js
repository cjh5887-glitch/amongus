/* =====================================================================
   meeting.js — 긴급회의 · 신고 · 투표 · 유령 학생

   흐름: 긴급회의 버튼(중앙 복도) 또는 신고(얼어 있는 학생 근처)
         → 방장이 확인 → 토론 25초 → 투표 15초 → 결과 약 3초
         → 가장 많은 표를 받은 1명 제외(유령) / 동점·건너뛰기가 많으면 아무도 제외 안 됨
         → 모두 중앙 복도로 모여 게임 계속

   ▸ 회의하는 동안 게임 제한 시간은 멈춥니다. (끝나면 회의한 시간만큼 뒤로 미룸)
   ▸ 긴급회의 버튼: 한 사람당 1회, 게임 전체 최대 회의 횟수(설정)까지. 신고는 따로.
   ▸ 유령: 회의·투표에 참여할 수 없고 화면만 볼 수 있어요.

   방 데이터
     requests/{플레이어}  { type: "emergency" | "report", target, t }   ← 회의 요청
     meeting  { type, by, target, phase, phaseEnd, startedAt, votes, result }
     meetingUsed/{플레이어}  긴급회의 버튼 사용 횟수
     meetingTotal           게임 전체 긴급회의 횟수
   ===================================================================== */

const Meeting = (() => {
  const settingsOf = (room) => ({ ...DEFAULT_SETTINGS, ...((room && room.settings) || {}) });

  // ─────────────────────────────────────────────────────────────
  // 회의 요청 (누구나)
  // ─────────────────────────────────────────────────────────────
  function nearEmergency(x, y) {
    return Math.hypot(x - CONFIG.EMERGENCY.x, y - CONFIG.EMERGENCY.y) < CONFIG.EMERGENCY.range;
  }

  function emergencyLeft(room, pid) {
    const s = settingsOf(room);
    const mine = CONFIG.MEETING_PER_PLAYER - ((room.meetingUsed && room.meetingUsed[pid]) || 0);
    const total = Number(s.meetingLimit) - (room.meetingTotal || 0);
    return Math.max(0, Math.min(mine, total));
  }

  // 지금 [신고] 버튼으로 할 수 있는 일 → { kind: "report"|"emergency", target? } 또는 null
  function availableAction(room) {
    if (!room || !GSM.is("PLAYING") || !Abilities.isAlive(room, Net.myId)) return null;
    const me = Player.me;
    const rep = Abilities.reportableNear(room, me.x, me.y, Net.myId);
    if (rep) return { kind: "report", target: rep };
    if (nearEmergency(me.x, me.y)) return { kind: "emergency", left: emergencyLeft(room, Net.myId) };
    return null;
  }

  function request() {
    const room = Net.room;
    const a = availableAction(room);
    if (!a) {
      if (room && Abilities.isGhost(room, Net.myId)) toast("유령은 회의를 열 수 없어요.");
      else toast("중앙 복도의 빨간 버튼 앞이나, 얼어 있는 친구 옆에서 누를 수 있어요.");
      return;
    }
    if (Abilities.frozenLeft(room, Net.myId) > 0) { toast("🧊 얼어서 누를 수 없어요!"); return; }
    if (a.kind === "emergency" && a.left <= 0) {
      const used = (room.meetingUsed && room.meetingUsed[Net.myId]) || 0;
      toast(used >= CONFIG.MEETING_PER_PLAYER ? "긴급회의는 한 사람당 1번만 열 수 있어요." : "이번 게임의 긴급회의를 모두 사용했어요.");
      return;
    }
    Net.roomUpdate({ [`requests/${Net.myId}`]: { type: a.kind, target: a.target || null, t: Net.now() } });
  }

  // ─────────────────────────────────────────────────────────────
  // 방장(심판) 처리
  // ─────────────────────────────────────────────────────────────
  function hostStart(room, by, type, target) {
    const now = Net.now();
    const upd = {
      "meta/state": "MEETING",
      meeting: { type, by, target: target || null, phase: "discuss", phaseEnd: now + CONFIG.MEETING.discuss * 1000, startedAt: now },
      "game/pausedAt": now,
      requests: null, sabotage: null, frozen: null, disguise: null,
    };
    if (type === "emergency") {
      upd[`meetingUsed/${by}`] = ((room.meetingUsed && room.meetingUsed[by]) || 0) + 1;
      upd.meetingTotal = (room.meetingTotal || 0) + 1;
    }
    Net.roomUpdate(upd);
  }

  // PLAYING 중: 들어온 회의 요청 확인
  function hostCheckRequests(room) {
    const reqs = room.requests || {};
    const ids = Object.keys(reqs).sort((a, b) => reqs[a].t - reqs[b].t);
    for (const pid of ids) {
      const r = reqs[pid];
      if (!Abilities.isAlive(room, pid)) continue;
      if (r.type === "emergency" && emergencyLeft(room, pid) <= 0) continue;
      if (r.type === "report" && !(r.target && Abilities.isAlive(room, r.target))) continue;
      hostStart(room, pid, r.type, r.target);
      return true;
    }
    if (ids.length) Net.roomUpdate({ requests: null }); // 무효한 요청 정리
    return false;
  }

  function aliveIds(room) {
    return Roster.ids(room).filter((pid) => Abilities.isAlive(room, pid));
  }

  // 투표 집계: 가장 많은 표가 1명이고, 건너뛰기보다 많을 때만 제외
  function tally(room) {
    const votes = (room.meeting && room.meeting.votes) || {};
    const alive = aliveIds(room);
    const counts = {};
    let skip = 0;
    alive.forEach((voter) => {
      const v = votes[voter];
      if (!v || v === voter) return;   // 자기 자신에게 한 표는 세지 않음
      if (v === "skip") skip++;
      else if (alive.includes(v)) counts[v] = (counts[v] || 0) + 1;
    });
    const max = Math.max(0, ...Object.values(counts));
    const tops = Object.keys(counts).filter((k) => counts[k] === max);
    const ejected = max > 0 && tops.length === 1 && max > skip ? tops[0] : null;
    return { counts, skip, ejected, wasSaboteur: ejected ? Roles.isSaboteur(room, ejected) : false };
  }

  let lastKey = "";
  function hostTick(room) {
    const m = room.meeting;
    if (!m) return;
    const now = Net.now();
    const once = (key, fn) => { if (lastKey !== key) { lastKey = key; fn(); } };
    const base = m.startedAt + ":";

    if (m.phase === "discuss" && now >= m.phaseEnd) {
      once(base + "vote", () => Net.roomUpdate({ "meeting/phase": "vote", "meeting/phaseEnd": now + CONFIG.MEETING.vote * 1000 }));
    }
    if (m.phase === "vote") {
      const alive = aliveIds(room);
      const votes = m.votes || {};
      const allVoted = alive.length > 0 && alive.every((pid) => votes[pid]);
      if (allVoted || now >= m.phaseEnd) {
        once(base + "result", () => Net.roomUpdate({ "meeting/phase": "result", "meeting/phaseEnd": now + CONFIG.MEETING.result * 1000, "meeting/result": tally(room) }));
      }
    }
    if (m.phase === "result" && now >= m.phaseEnd) {
      once(base + "end", () => hostFinish(room));
    }
  }

  function hostFinish(room) {
    const now = Net.now();
    const res = (room.meeting && room.meeting.result) || {};
    const ghosts = { ...(room.ghosts || {}) };
    if (res.ejected && Roster.has(room, res.ejected)) ghosts[res.ejected] = true;
    const after = { ...room, ghosts };
    const win = checkWin(after);
    if (win) {
      Net.roomUpdate({ ghosts, meeting: null, "meta/state": "GAMEOVER", "game/winner": win.winner, "game/reason": win.reason, "game/pausedAt": null });
      return;
    }
    const paused = (room.game && room.game.pausedAt) || now;
    Net.roomUpdate({
      ghosts,
      meeting: null,
      requests: null,
      "meta/state": "PLAYING",
      "game/endAt": ((room.game && room.game.endAt) || now) + (now - paused),   // 회의한 시간만큼 제한 시간 연장 (시간이 멈춘 효과)
      "game/pausedAt": null,
    });
  }

  // 승패 (투표·나가기 관련)
  //  학생 승리: 방해꾼이 모두 제외됨    방해꾼 승리: 남은 학생 수 ≤ 남은 방해꾼 수
  function checkWin(room) {
    const alive = aliveIds(room);
    const sab = alive.filter((pid) => Roles.isSaboteur(room, pid)).length;
    const stu = alive.length - sab;
    const totalSab = Roster.ids(room).filter((pid) => Roles.isSaboteur(room, pid)).length;
    if (sab === 0) return { winner: "student", reason: totalSab === 0 ? "saboteurLeft" : "voted" };
    if (stu <= sab) return { winner: "saboteur", reason: "outnumbered" };
    return null;
  }

  // ─────────────────────────────────────────────────────────────
  // 회의 화면 (모든 플레이어)
  // ─────────────────────────────────────────────────────────────
  let ctrl = null, timer = null, startedLocal = 0, lastRenderKey = "";

  function open(room) {
    close();
    ctrl = new AbortController();
    startedLocal = Date.now();
    lastRenderKey = "";
    $("#meeting-overlay").classList.add("open");
    Sound.play("meeting");
    $("#mt-skip").addEventListener("click", () => vote("skip"), { signal: ctrl.signal });
    timer = setInterval(() => tickTimer(), 200);
    render(room);
  }

  function close() {
    if (ctrl) ctrl.abort();
    ctrl = null;
    clearInterval(timer);
    timer = null;
    const ov = $("#meeting-overlay");
    if (ov) ov.classList.remove("open");
    return Date.now() - startedLocal;
  }

  function vote(target) {
    const room = Net.room;
    if (!room || !room.meeting || room.meeting.phase !== "vote") return;
    if (!Abilities.isAlive(room, Net.myId)) return;
    if (room.meeting.votes && room.meeting.votes[Net.myId]) return;
    if (target === Net.myId) return;
    Net.roomUpdate({ [`meeting/votes/${Net.myId}`]: target });
  }

  function tickTimer() {
    const room = Net.room;
    if (!room || !room.meeting) return;
    const m = room.meeting;
    const left = Math.max(0, m.phaseEnd - Net.now());
    const label = { discuss: "💬 토론 시간", vote: "🗳 투표 시간", result: "📋 결과" }[m.phase] || "";
    $("#mt-phase").textContent = label;
    $("#mt-timer").textContent = m.phase === "result" ? "" : formatTime(left);
    $("#mt-timer").classList.toggle("urgent", m.phase !== "result" && left <= 5000);
  }

  function render(room) {
    if (!room || !room.meeting) return;
    const m = room.meeting;
    const key = JSON.stringify([m.phase, m.votes, m.result, room.ghosts, Roster.ids(room), Object.keys(room.players || {})]);
    if (key === lastRenderKey) { tickTimer(); return; }
    lastRenderKey = key;

    const nick = (pid) => Roster.nick(room, pid);
    const title = m.type === "report"
      ? `📢 ${nick(m.by)} 님이 신고했어요! (${nick(m.target)} 님이 얼어 있었어요)`
      : `🚨 ${nick(m.by)} 님이 긴급회의를 열었어요!`;
    $("#mt-title").textContent = title;

    const iAlive = Abilities.isAlive(room, Net.myId);
    const votes = m.votes || {};
    const myVote = votes[Net.myId];
    const canVote = m.phase === "vote" && iAlive && !myVote;
    const res = m.phase === "result" ? m.result || {} : null;

    // 안내 문구
    let guide = "";
    if (!iAlive) guide = "👻 유령은 회의에 참여할 수 없어요. 조용히 지켜봐 주세요.";
    else if (m.phase === "discuss") guide = "누가 수상했나요? 본 것을 친구들에게 이야기해 보세요. 곧 투표가 시작돼요.";
    else if (m.phase === "vote") guide = myVote ? `투표했어요: ${myVote === "skip" ? "건너뛰기" : nick(myVote)}` : "방해꾼이라고 생각하는 친구에게 투표하세요. (자기 자신은 안 돼요)";
    $("#mt-guide").textContent = guide;

    // 카드
    const grid = $("#mt-cards");
    grid.innerHTML = "";
    const ids = Roster.ids(room).sort((a, b) => Roster.info(room, a).joinedAt - Roster.info(room, b).joinedAt);
    ids.forEach((pid) => {
      const p = Roster.info(room, pid);
      const ghost = Abilities.isGhost(room, pid);
      const card = document.createElement("div");
      card.className = "mt-card" + (ghost ? " ghost" : "") + (pid === Net.myId ? " me" : "") + (myVote === pid ? " chosen" : "");
      card.appendChild(UI.characterIcon(colorOf(p.color).hex, 58, { ghost }));
      const name = document.createElement("div");
      name.className = "mt-name";
      name.textContent = p.nick + (pid === Net.myId ? " (나)" : "");
      card.appendChild(name);
      const status = document.createElement("div");
      status.className = "mt-status";
      if (ghost) status.textContent = "👻 제외됨";
      else if (m.phase === "vote" && votes[pid]) { status.textContent = "✔ 투표 완료"; status.classList.add("voted"); }
      if (res) {
        const n = (res.counts && res.counts[pid]) || 0;
        status.innerHTML = n ? `<b class="mt-votes">${n}표</b>` : "";
        if (res.ejected === pid) card.classList.add("ejected");
      }
      card.appendChild(status);
      if (canVote && !ghost && pid !== Net.myId) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "btn small mt-vote";
        b.textContent = "투표";
        b.addEventListener("click", () => vote(pid));
        card.appendChild(b);
      }
      grid.appendChild(card);
    });

    const skip = $("#mt-skip");
    skip.style.display = m.phase === "vote" && iAlive ? "" : "none";
    skip.disabled = !canVote;
    skip.textContent = myVote === "skip" ? "✔ 건너뛰기 선택함" : "건너뛰기";

    // 결과
    const box = $("#mt-result");
    if (res) {
      const lines = [];
      ids.forEach((pid) => { const n = (res.counts && res.counts[pid]) || 0; if (n) lines.push(`${nick(pid)} ${n}표`); });
      if (res.skip) lines.push(`건너뛰기 ${res.skip}표`);
      let main;
      if (res.ejected) {
        main = `${nick(res.ejected)} 님이 게임에서 제외되었습니다.`;
        if (settingsOf(room).revealRole) main += res.wasSaboteur ? " 방해꾼이었어요! 🎯" : " 방해꾼이 아니었어요… 😢";
      } else main = "아무도 제외되지 않았습니다.";
      box.innerHTML = `<div class="mt-counts">${lines.map((l) => MG.esc(l)).join(" · ") || "투표한 사람이 없어요"}</div><div class="mt-main">${MG.esc(main)}</div>`;
      box.style.display = "";
    } else box.style.display = "none";
    tickTimer();
  }

  // DEBUG: 회의 강제 실행 (방장)
  function debugForce(room) {
    if (!Net.isHost || !room || room.meta.state !== "PLAYING") return;
    hostStart(room, Net.myId, "emergency", null);
  }

  return {
    request, availableAction, nearEmergency, emergencyLeft, hostCheckRequests, hostTick, checkWin, tally,
    open, close, render, vote, debugForce,
  };
})();
