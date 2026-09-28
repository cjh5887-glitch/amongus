/* =====================================================================
   game.js — 게임 전체 흐름 (시작점)

   흐름: 메인 → 방 만들기/참가 → 대기실(방장 설정) → 역할 공개(3초)
        → 스토리 → 3초 카운트다운 → 게임 → (시간 종료) 게임 종료 → 대기실

   ▸ 방장 화면이 "심판" 역할을 합니다. (화면 전환 시각, 타이머, 승패 판정)
   ▸ 다른 플레이어는 방 정보가 바뀌면 그 상태에 맞는 화면으로 따라갑니다.
   ===================================================================== */

const Game = (() => {
  let lastTs = 0;
  let lastPosSent = 0, lastPosKey = "";
  let latestPos = {};
  let startFlashUntil = 0;
  let lastBlackout = 0;
  const bots = new Map();

  const settingsOf = (room) => ({ ...DEFAULT_SETTINGS, ...((room && room.settings) || {}) });
  const sortedIds = (room) => {
    const ps = (room && room.players) || {};
    return Object.keys(ps).sort((a, b) => (ps[a].joinedAt - ps[b].joinedAt) || (a < b ? -1 : 1));
  };
  const teacherDefaults = () => ({ ...DEFAULT_SETTINGS, ...SafeStore.get("rs_defaults", {}) });

  // ─────────────────────────────────────────────────────────────
  // 화면(상태) 등록
  // ─────────────────────────────────────────────────────────────
  GSM.register("TITLE", {
    enter(msg, signal) {
      UI.show("title");
      const nick = $("#input-nick"), code = $("#input-code");
      nick.value = SafeStore.get("rs_nick", "");
      code.value = "";
      $("#title-error").textContent = msg || "";
      $("#mode-badge").textContent = Net.mode === "online"
        ? "🌐 온라인 모드 — 여러 태블릿이 함께 플레이할 수 있어요"
        : "🖥 이 컴퓨터 안 모드 — 같은 브라우저의 여러 탭끼리 테스트할 수 있어요 (Firebase 연결 전)";
      $("#mode-badge").className = "mode-badge " + Net.mode;

      const getNick = () => {
        const v = nick.value.trim();
        if (!v) { $("#title-error").textContent = "닉네임을 입력해 주세요."; nick.focus(); return null; }
        if (v.length > 8) { $("#title-error").textContent = "닉네임은 8글자까지 쓸 수 있어요."; return null; }
        SafeStore.set("rs_nick", v);
        return v;
      };
      const busy = (b) => { $$("#screen-title button").forEach((x) => { x.disabled = b; }); };

      $("#btn-create").addEventListener("click", async () => {
        const n = getNick(); if (!n) return;
        busy(true); $("#title-error").textContent = "방을 만드는 중…";
        try { await Net.createRoom(n, teacherDefaults()); }
        catch (e) { $("#title-error").textContent = e.message || "방을 만들지 못했어요."; busy(false); }
      }, { signal });

      $("#btn-join").addEventListener("click", async () => {
        const n = getNick(); if (!n) return;
        const c = code.value.trim();
        if (!/^\d{4}$/.test(c)) { $("#title-error").textContent = "방 번호 4자리를 입력해 주세요."; code.focus(); return; }
        busy(true); $("#title-error").textContent = "방에 들어가는 중…";
        try { await Net.joinRoom(c, n); }
        catch (e) { $("#title-error").textContent = e.message || "방에 들어가지 못했어요."; busy(false); }
      }, { signal });

      code.addEventListener("keydown", (e) => { if (e.key === "Enter") $("#btn-join").click(); }, { signal });
      $("#btn-howto").addEventListener("click", () => UI.openModal("modal-howto"), { signal });
      $("#btn-teacher").addEventListener("click", () => {
        const draw = (s) => UI.renderSettings($("#teacher-settings"), s, true, (next) => { SafeStore.set("rs_defaults", next); draw(next); });
        draw(teacherDefaults());
        UI.openModal("modal-teacher");
      }, { signal });
      busy(false);
      showRejoinButton();
    },
  });

  GSM.register("LOBBY", {
    enter(_, signal) {
      UI.show("lobby");
      Player.others.clear();
      bots.clear();
      $("#btn-leave").addEventListener("click", () => leaveToTitle(), { signal });
      $("#btn-start").addEventListener("click", () => hostStartGame(), { signal });
      $("#btn-add-bot").addEventListener("click", () => {
        const r = Net.room;
        if (r && Object.keys(r.players).length < CONFIG.MAX_PLAYERS) Net.addBot(r.players);
      }, { signal });
      $("#btn-remove-bots").addEventListener("click", () => Net.room && Net.removeBots(Net.room.players), { signal });
      $("#btn-last-results").addEventListener("click", () => { Analytics.renderTeacher(Net.room); UI.openModal("modal-results"); }, { signal });
      $("#lobby-code").addEventListener("click", () => {
        try { navigator.clipboard.writeText(Net.code); toast("방 번호를 복사했어요."); } catch (e) { /* 무시 */ }
      }, { signal });
    },
    update(room) {
      UI.renderLobby({ ...room, settings: settingsOf(room) }, Net.myId, Net.isHost);
    },
  });

  GSM.register("ROLE_REVEAL", {
    enter() {
      UI.show("role");
      Input.clear();
      UI.renderRole(Net.room, Net.myId);
    },
  });

  GSM.register("STORY", {
    enter(_, signal) {
      UI.show("story");
      UI.renderStory();
      UI.updateStoryReady(Net.room);
      const btn = $("#btn-story-ready");
      btn.addEventListener("click", () => {
        btn.disabled = true;
        btn.textContent = "친구들을 기다리는 중…";
        Net.roomUpdate({ [`ready/${Net.myId}`]: true });
      }, { signal });
    },
    update(room) { UI.updateStoryReady(room); },
  });

  GSM.register("COUNTDOWN", {
    enter() {
      enterWorld();
    },
  });

  GSM.register("PLAYING", {
    enter(_, signal, prev) {
      // 미션·회의에서 돌아올 때는 제자리 그대로 (시작 위치로 보내지 않음)
      if (prev === "MISSION" || prev === "MEETING") { Input.clear(); return; }
      if (prev !== "COUNTDOWN") enterWorld();
      startFlashUntil = performance.now() + 900;
      Sound.play("start");
    },
  });

  // 미션 풀이 중 (게임 세계는 계속 움직이고, 내 캐릭터만 멈춤)
  GSM.register("MISSION", {
    enter(data) {
      UI.show("game");
      Input.clear();
      closeMinimap();
      MissionUI.open(data, {
        onWrong: (s) => MissionSys.onWrong(s),
        onCorrect: (m, s) => MissionSys.onCorrect(m, s),
        onTimeout: (m, s) => MissionSys.onTimeout(m, s),
        onClose: () => { if (GSM.is("MISSION")) GSM.set("PLAYING"); },
      });
    },
    exit() { MissionUI.close(); },
  });
  // 긴급회의 · 투표 (모두 이동 멈춤, 게임 시간도 멈춤)
  GSM.register("MEETING", {
    enter(_, signal, prev) {
      // 회의 중에 다시 들어온 경우: 게임 화면부터 준비
      if (!["PLAYING", "MISSION", "COUNTDOWN"].includes(prev)) enterWorld();
      UI.show("game");
      Input.clear();
      closeMinimap();
      Abilities.closeDoorPicker();
      Player.me.moving = false;
      Meeting.open(Net.room);
    },
    update(room) { Meeting.render(room); },
    exit(next) {
      const paused = Meeting.close();
      if (next === "PLAYING") {
        // 회의가 끝나면 모두 중앙 복도로 모여서 다시 시작
        const room = Net.room;
        const ids = sortedIds(room);
        Player.placeMe(GameMap.getSpawn(Math.max(0, ids.indexOf(Net.myId)), ids.length));
        sendMyPos(true);
        MissionSys.shiftTime(paused);   // 회의하는 동안 미션 시간도 멈춤
        Abilities.afterMeeting();
      }
    },
  });
  // 나의 수학 기록 (게임 종료 약 3초 뒤)
  GSM.register("RESULT", {
    enter(_, signal) {
      UI.show("result");
      const room = Net.room;
      UI.renderGameOver(room, Net.myId, Net.isHost);
      Analytics.renderMine(room, Net.myId);
      $("#btn-go-lobby").addEventListener("click", () => hostBackToLobby(), { signal });
      $("#btn-go-leave").addEventListener("click", () => leaveToTitle(), { signal });
      $("#btn-teacher-results").addEventListener("click", () => { Analytics.renderTeacher(Net.room); UI.openModal("modal-results"); }, { signal });
    },
    update(room) {
      UI.renderGameOver(room, Net.myId, Net.isHost);
      Analytics.renderMine(room, Net.myId);
      if ($("#modal-results").classList.contains("open")) Analytics.renderTeacher(room);
    },
    exit() { UI.closeModal("modal-results"); },
  });

  // 게임 종료: 조명 연출 → 승리 카드 → (약 3초 뒤) 나의 수학 기록
  let endingRaf = 0;
  GSM.register("GAMEOVER", {
    enter(_, signal) {
      Input.clear();
      Player.me.moving = false;
      closeMinimap();
      UI.show("gameover");
      UI.renderGameOver(Net.room, Net.myId, Net.isHost);
      const room = Net.room;
      const myRole = room.roles && room.roles[Net.myId];
      const studentsWin = room.game && room.game.winner === "student";
      Sound.play((myRole === "saboteur") !== studentsWin ? "win" : "lose");

      const t0 = performance.now();
      const cv = $("#ending-canvas");
      const loop = () => {
        const el = performance.now() - t0;
        Renderer.drawEnding(cv, Math.min(el, CONFIG.ENDING_MS), studentsWin);
        const left = Math.ceil((CONFIG.RESULT_AFTER_MS - el) / 1000);
        $("#go-auto").textContent = left > 0 ? `(${left})` : "";
        if (el >= CONFIG.RESULT_AFTER_MS) { if (GSM.is("GAMEOVER")) GSM.set("RESULT"); return; }
        endingRaf = requestAnimationFrame(loop);
      };
      endingRaf = requestAnimationFrame(loop);
      $("#btn-go-result").addEventListener("click", () => GSM.set("RESULT"), { signal });
    },
    update(room) { UI.renderGameOver(room, Net.myId, Net.isHost); },
    exit() { cancelAnimationFrame(endingRaf); },
  });

  // 게임 맵에 들어가기 (시작 위치 배치)
  function enterWorld() {
    const room = Net.room;
    UI.show("game");
    Renderer.resize();
    Input.clear();
    const ids = sortedIds(room);
    const idx = Math.max(0, ids.indexOf(Net.myId));
    Player.placeMe(GameMap.getSpawn(idx, ids.length));
    Player.me.passWalls = false;
    Player.me.ghost = false;
    MissionSys.resetLocal();
    Abilities.resetLocal();
    closeMinimap();
    sendMyPos(true);
    UI.renderHud(room, Net.myId);
    UI.setCountdown("");
  }

  // ─────────────────────────────────────────────────────────────
  // 방 정보가 바뀔 때마다
  // ─────────────────────────────────────────────────────────────
  function onRoom(room) {
    if (!Net.code) return;
    if (!room || !room.meta) {
      leaveToTitle("방이 없어졌어요.");
      return;
    }
    if (!room.players || !room.players[Net.myId]) {
      // 게임 중에 잠깐 끊겨서 내 정보가 지워졌다면 → 스스로 다시 들어감
      if (room.members && room.members[Net.myId] && room.meta.state !== "LOBBY") { Net.heal(); return; }
      leaveToTitle("방과 연결이 끊어졌어요. 다시 들어와 주세요.");
      return;
    }
    electHost(room);
    const st = room.meta.state;
    if (st === "PLAYING" && GSM.is("MISSION")) { /* 미션 중에는 미션 화면 유지 */ }
    else if (st === "GAMEOVER" && GSM.is("RESULT")) { /* 게임 종료 뒤 나의 수학 기록 화면 유지 */ }
    else if (st && !GSM.is(st)) GSM.set(st);
    GSM.update(room);
    if (GSM.inWorld() && room.missions) UI.renderMissions(room);
    if (GSM.inWorld() && room.roles) {
      // 유령이 되었는지 확인
      const ghost = Abilities.isGhost(room, Net.myId);
      if (ghost && !Player.me.ghost) toast("👻 유령이 되었어요. 벽을 통과할 수 있고, 미션은 계속 할 수 있어요.", 4500);
      Player.me.ghost = ghost;
      UI.renderRoleTag(room, Net.myId);
    }
    // 정전 소리 (새 정전이 시작될 때 한 번)
    const bo = room.sabotage && room.sabotage.blackoutUntil;
    if (bo && bo !== lastBlackout) { lastBlackout = bo; if (GSM.inWorld()) Sound.play("blackout"); }
  }

  // 방장이 나가면 가장 먼저 들어온 사람이 방장이 됩니다.
  function electHost(room) {
    const ids = sortedIds(room).filter((id) => !room.players[id].bot);
    if (!ids.length) return;
    if (room.players[room.meta.hostId] && !room.players[room.meta.hostId].bot) return;
    if (ids[0] === Net.myId) {
      Net.roomUpdate({ "meta/hostId": Net.myId });
      toast("이제 내가 방장이에요 👑");
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 방장(심판) 기능
  // ─────────────────────────────────────────────────────────────
  function hostStartGame() {
    const room = Net.room;
    if (!Net.isHost || !room) return;
    const ids = sortedIds(room);
    const s = settingsOf(room);
    const min = DEBUG_MODE ? 1 : CONFIG.MIN_PLAYERS;
    if (ids.length < min) return toast(`${CONFIG.MIN_PLAYERS}명 이상 모여야 해요.`);
    if (Roles.tooMany(ids.length, s.saboteurs)) return toast("방해꾼 수를 줄여 주세요.");
    const forced = {};
    if (DEBUG_MODE && Debug.forcedRole() !== "auto") forced[Net.myId] = Debug.forcedRole();
    const roles = Roles.assign(ids, s.saboteurs, forced);
    // 이번 게임 참가자 명단 (연결이 잠깐 끊겨도 명단은 유지)
    const members = {};
    ids.forEach((id) => {
      const p = room.players[id];
      members[id] = { nick: p.nick, color: p.color, joinedAt: p.joinedAt, ...(p.bot ? { bot: true } : {}) };
    });
    Net.roomUpdate({
      roles,
      ...CLEAR_ROUND,
      members,
      missions: MissionSys.assign(ids, s),   // 개인 미션 (방해꾼은 가짜 미션)
      done: null,
      fakeDone: null,
      results: null,
      ready: null,
      game: { round: (room.meta.round || 0) + 1 },
      "meta/state": "ROLE_REVEAL",
      "meta/phaseEndsAt": Net.now() + CONFIG.ROLE_REVEAL_MS,
      "meta/round": (room.meta.round || 0) + 1,
    });
  }

  function hostBackToLobby() {
    if (!Net.isHost) return;
    Net.roomUpdate({ "meta/state": "LOBBY", "meta/phaseEndsAt": null, roles: null, ready: null, game: null, missions: null, done: null, fakeDone: null, ...CLEAR_ROUND });
  }

  // 한 판이 끝나면 지워야 하는 방해·회의·유령 기록
  const CLEAR_ROUND = {
    sabotage: null, frozen: null, disguise: null, disguiseUses: null, ghosts: null,
    meeting: null, meetingUsed: null, meetingTotal: null, requests: null,
    members: null, gone: null,
  };

  let lastHostAction = "";
  const missingSince = new Map();
  function hostTick() {
    const room = Net.room;
    if (!room || !Net.isHost || !room.meta) return;
    const now = Net.now();
    const st = room.meta.state;
    const once = (key, fn) => { if (lastHostAction !== key) { lastHostAction = key; fn(); } };

    if (st === "ROLE_REVEAL" && now >= room.meta.phaseEndsAt) {
      once("story" + room.meta.round, () => Net.roomUpdate({ "meta/state": "STORY", "meta/phaseEndsAt": now + CONFIG.STORY_TIMEOUT_MS }));
    }
    if (st === "STORY") {
      const ids = Object.keys(room.players);
      const humans = ids.filter((id) => !room.players[id].bot);
      const allReady = humans.every((id) => room.ready && room.ready[id]);
      if (allReady || now >= room.meta.phaseEndsAt) {
        once("countdown" + room.meta.round, () => Net.roomUpdate({ "meta/state": "COUNTDOWN", "meta/phaseEndsAt": now + CONFIG.COUNTDOWN_MS }));
      }
    }
    if (st === "COUNTDOWN" && now >= room.meta.phaseEndsAt) {
      const s = settingsOf(room);
      once("playing" + room.meta.round, () => Net.roomUpdate({
        "meta/state": "PLAYING",
        "meta/phaseEndsAt": null,
        "game/startAt": now,
        "game/endAt": now + s.gameMinutes * 60000,
      }));
    }
    // 학생팀 승리 조건 ①: 모든 일반 미션 완료 (시간 종료와 겹치면 미션 완료가 먼저)
    if (st === "PLAYING") {
      const pr = MissionSys.progress(room);
      if (pr.total > 0 && pr.done >= pr.total) {
        once("over" + room.meta.round, () => Net.roomUpdate({ "meta/state": "GAMEOVER", "game/winner": "student", "game/reason": "missions" }));
        return;
      }
      // 게임 중 누가 나가서 승패가 정해진 경우 (방해꾼이 모두 나감 / 학생 수 ≤ 방해꾼 수)
      const w = room.roles ? Meeting.checkWin(room) : null;
      if (w && !DEBUG_SOLO(room)) {
        once("over" + room.meta.round, () => Net.roomUpdate({ "meta/state": "GAMEOVER", "game/winner": w.winner, "game/reason": w.reason }));
        return;
      }
      // 긴급회의 · 신고 요청 처리
      if (room.requests && Meeting.hostCheckRequests(room)) return;
    }
    if (st === "MEETING") {
      Meeting.hostTick(room);
      botsVote(room);
    }
    if (st === "PLAYING" && room.game && room.game.endAt && now >= room.game.endAt) {
      // 방해꾼 승리 조건 ①: 제한 시간 종료 (다른 승패 조건은 다음 단계에서 추가)
      once("over" + room.meta.round, () => Net.roomUpdate({ "meta/state": "GAMEOVER", "game/winner": "saboteur", "game/reason": "time" }));
    }

    // 게임 중 연결이 끊긴 사람: 60초 안에 돌아오면 그대로, 넘으면 계산에서 빼기
    if (room.members && st !== "LOBBY" && st !== "GAMEOVER") {
      Object.keys(room.members).forEach((id) => {
        if (room.players[id]) { missingSince.delete(id); return; }
        if (room.gone && room.gone[id]) return;
        if (!missingSince.has(id)) missingSince.set(id, now);
        if (now - missingSince.get(id) > CONFIG.REJOIN_GRACE_SEC * 1000) {
          once("gone" + id + room.meta.round, () => Net.roomUpdate({ [`gone/${id}`]: true }));
        }
      });
    } else missingSince.clear();

    // 이 컴퓨터 안 모드: 닫힌 탭 정리
    if (Net.mode === "local") {
      Object.keys(room.players).forEach((id) => {
        const p = room.players[id];
        if (p.bot || id === Net.myId) return;
        const pos = latestPos[id];
        const last = Math.max(p.joinedAt || 0, (pos && pos.t) || 0);
        if (now - last > CONFIG.LOCAL_STALE_MS) Net.roomUpdate({ [`players/${id}`]: null, [`ready/${id}`]: null });
      });
    }
  }

  // DEBUG 에서 혼자(또는 방해꾼 없이) 테스트할 때는 인원 승패 판정을 하지 않음
  function DEBUG_SOLO(room) {
    if (!DEBUG_MODE) return false;
    const n = Roster.ids(room).length;
    return n < CONFIG.MIN_PLAYERS || Roles.saboteurs(room).length === 0;
  }

  // ── 봇 투표 (DEBUG): 투표 시간이 되면 봇이 무작위로 투표 ──
  const botVoteAt = new Map();
  function botsVote(room) {
    const m = room.meeting;
    if (!m || m.phase !== "vote") { botVoteAt.clear(); return; }
    Roster.ids(room).forEach((pid) => {
      const info = Roster.info(room, pid);
      if (!info || !info.bot || !Abilities.isAlive(room, pid)) return;
      if (m.votes && m.votes[pid]) return;
      if (!botVoteAt.has(pid)) botVoteAt.set(pid, Date.now() + 1500 + Math.random() * 5000);
      if (Date.now() < botVoteAt.get(pid)) return;
      botVoteAt.set(pid, Infinity);
      const choices = Roster.ids(room).filter((x) => x !== pid && Abilities.isAlive(room, x));
      const pick = Math.random() < 0.3 || !choices.length ? "skip" : choices[Math.floor(Math.random() * choices.length)];
      Net.roomUpdate({ [`meeting/votes/${pid}`]: pick });
    });
  }

  // ── 봇 (DEBUG) : 방장 화면이 대신 움직여 줍니다 ──
  function simulateBots(dt, room) {
    const ids = sortedIds(room);
    ids.forEach((id, idx) => {
      const p = room.players[id];
      if (!p.bot) return;
      let b = bots.get(id);
      if (!b) {
        const sp = GameMap.getSpawn(idx, ids.length);
        b = { x: sp.x, y: sp.y, vx: 0, vy: 0, dir: 1, next: 0, sent: 0, moving: false };
        bots.set(id, b);
      }
      const now = performance.now();
      if (GSM.canMove()) {
        if (now > b.next) {
          const a = Math.random() * Math.PI * 2;
          const go = Math.random() < 0.75;
          b.vx = go ? Math.cos(a) : 0; b.vy = go ? Math.sin(a) : 0;
          b.next = now + 800 + Math.random() * 2200;
        }
        const ox = b.x, oy = b.y;
        GameMap.moveWithCollision(b, b.vx * 140 * dt, b.vy * 140 * dt, CONFIG.PLAYER_RADIUS);
        b.moving = Math.hypot(b.x - ox, b.y - oy) > 0.1;
        if (!b.moving) b.next = 0;
        if (b.vx) b.dir = b.vx > 0 ? 1 : -1;
      } else b.moving = false;
      if (now - b.sent > 1000 / CONFIG.POS_SEND_HZ) {
        b.sent = now;
        Net.sendPos(id, { x: Math.round(b.x), y: Math.round(b.y), d: b.dir, m: b.moving, t: Net.now() });
      }
    });
  }

  // ─────────────────────────────────────────────────────────────
  // 위치 보내기 (초당 10번, 움직이지 않으면 1초에 한 번)
  // ─────────────────────────────────────────────────────────────
  function sendMyPos(force) {
    const m = Player.me;
    const key = `${Math.round(m.x)},${Math.round(m.y)},${m.dir},${m.moving}`;
    const now = performance.now();
    if (!force) {
      if (now - lastPosSent < 1000 / CONFIG.POS_SEND_HZ) return;
      if (key === lastPosKey && now - lastPosSent < 1000) return;
    }
    lastPosSent = now; lastPosKey = key;
    Net.sendPos(Net.myId, { x: Math.round(m.x), y: Math.round(m.y), d: m.dir, m: m.moving, t: Net.now() });
  }

  // ─────────────────────────────────────────────────────────────
  // 매 프레임
  // ─────────────────────────────────────────────────────────────
  function buildView(room) {
    const me = Player.me;
    const myP = Roster.info(room, Net.myId) || { color: 0, nick: "" };
    const iGhost = Abilities.isGhost(room, Net.myId);
    const iSab = Roles.isSaboteur(room, Net.myId);
    // 시야: 유령은 넓게, 정전 중인 (살아 있는) 학생은 좁게
    const blackout = Abilities.blackoutLeft(room) > 0 && !iGhost && !iSab;
    const R = iGhost ? CONFIG.GHOST_VISION_RADIUS : CONFIG.VISION_RADIUS * (blackout ? CONFIG.BLACKOUT_VISION : 1);
    const others = [];
    Player.others.forEach((o, id) => {
      const p = Roster.info(room, id);
      if (!p) return;
      const ghost = Abilities.isGhost(room, id);
      let alpha = 1;
      if (!Renderer.debug.noFog) {
        const d = Math.hypot(o.x - me.x, o.y - me.y);
        alpha = d < R * 0.8 ? 1 : d < R ? (R - d) / (R * 0.2) : 0;
        // 유령은 벽 너머도 보임, 살아 있는 사람은 벽에 가려짐
        if (alpha > 0 && !iGhost && !GameMap.lineOfSight(me.x, me.y, o.x, o.y)) alpha = 0;
      }
      // 유령은 살아 있는 학생에게 보이지 않음 · 방해꾼에게는 희미하게 · 유령끼리는 반투명
      if (ghost) alpha *= iGhost ? 0.55 : iSab ? 0.22 : 0;
      // 위장: 다른 학생의 색 + 이름은 「???」
      const dis = Abilities.disguiseOf(room, id);
      others.push({
        x: o.x, y: o.y, dir: o.dir, walk: o.walk, moving: o.moving,
        color: colorOf(dis ? dis.color : p.color).hex, nick: dis ? "???" : p.nick,
        alpha, ghost, frozen: !ghost && Abilities.frozenLeft(room, id) > 0,
      });
    });
    const myDis = Abilities.disguiseOf(room, Net.myId);
    return {
      me: {
        x: me.x, y: me.y, dir: me.dir, walk: me.walk, moving: me.moving,
        color: colorOf(myDis ? myDis.color : myP.color).hex, nick: myP.nick + (myDis ? " (위장)" : ""),
        ghost: iGhost, frozen: Abilities.frozenLeft(room, Net.myId) > 0,
      },
      others,
      visionRadius: R,
      darkness: blackout ? CONFIG.BLACKOUT_DARKNESS : CONFIG.DARKNESS,
      devices: buildDevices(room),
      effects: MissionSys.getEffects(),
      hint: GSM.is("PLAYING") ? MissionSys.nearestHint(room, me.x, me.y) : null,
      emergencyGlow: GSM.is("PLAYING") && !iGhost && Meeting.nearEmergency(me.x, me.y),
    };
  }

  // 맵 위 미션 장치: 모든 장치 자리는 "고장 난 장치"로 보이고, 내 미션만 반짝입니다.
  function buildDevices(room) {
    const mineList = room.missions ? MissionSys.mine(room) : [];
    const mineAt = new Map(mineList.map((m) => [m.loc + ":" + m.spot, m]));
    // 협동 모드: 도와줄 수 있는 친구 미션 (하늘색)
    const helpAt = new Map((room.missions ? MissionSys.helpTargets(room) : []).map((m) => [m.loc + ":" + m.spot, m]));
    const debugOwners = new Map();
    if (Renderer.debug.showAllMissions && room.missions) {
      Object.keys(room.missions).forEach((pid) => {
        MissionSys.missionsOf(room, pid).forEach((m) => {
          const k = m.loc + ":" + m.spot;
          const nick = Roster.nick(room, pid);
          debugOwners.set(k, (debugOwners.get(k) ? debugOwners.get(k) + "," : "") + nick);
        });
      });
    }
    const out = [];
    Object.keys(GameMap.DEVICE_SPOTS).forEach((loc) => {
      GameMap.DEVICE_SPOTS[loc].forEach((p, i) => {
        const k = loc + ":" + i;
        const m = mineAt.get(k);
        let state = "idle";
        if (m) state = m.done ? "done" : MissionSys.coolingLeft(m.key) > 0 ? "cool" : "mine";
        else if (helpAt.has(k)) state = "help";
        else if (debugOwners.has(k)) state = "debug";
        out.push({ x: p.x, y: p.y, icon: MISSION_DEFS[loc].icon, state, label: debugOwners.get(k) || "" });
      });
    });
    return out;
  }

  // 화면 가운데 상태 알림 (중요한 것 하나만)
  function updateBanner(room, frozen) {
    if (!GSM.is("PLAYING", "MISSION")) return UI.setBanner("", "");
    const iGhost = Abilities.isGhost(room, Net.myId);
    const iSab = Roles.isSaboteur(room, Net.myId);
    const bo = Abilities.blackoutLeft(room);
    const dis = Abilities.disguiseOf(room, Net.myId);
    if (frozen) return UI.setBanner("frozen", `🧊 얼었어요! ${Math.ceil(Abilities.frozenLeft(room, Net.myId) / 1000)}`);
    if (bo > 0 && !iGhost) return UI.setBanner("blackout", iSab ? `⚡ 정전 중 (${Math.ceil(bo / 1000)})` : `⚡ 정전! 앞이 잘 안 보여요 (${Math.ceil(bo / 1000)})`);
    if (dis) return UI.setBanner("disguise", `🎭 위장 중 ${Math.ceil((dis.until - Net.now()) / 1000)}초`);
    if (iGhost && GSM.is("PLAYING")) return UI.setBanner("ghost", "👻 유령 — 벽을 통과할 수 있어요 · 미션은 계속 할 수 있어요");
    UI.setBanner("", "");
  }

  // ── 학교 지도 (M) ──
  let minimapOpen = false;
  function toggleMinimap() {
    minimapOpen = !minimapOpen;
    $("#minimap-overlay").classList.toggle("open", minimapOpen);
  }
  function closeMinimap() { minimapOpen = false; $("#minimap-overlay").classList.remove("open"); }

  function frame(ts) {
    const dt = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 0;
    lastTs = ts;
    if (DEBUG_MODE) Debug.tick();
    const room = Net.room;
    if (GSM.inWorld() && room && room.players) {
      Abilities.applyDoorLocks(room);
      const frozen = Abilities.frozenLeft(room, Net.myId) > 0;
      if (GSM.canMove() && !frozen) Player.updateMe(dt, Input.vector(), settingsOf(room));
      else Player.me.moving = false;
      Player.updateOthers(dt);
      if (Net.isHost) simulateBots(dt, room);
      sendMyPos(false);

      const now = Net.now();
      if (GSM.is("COUNTDOWN")) {
        UI.setCountdown(String(Math.max(1, Math.ceil((room.meta.phaseEndsAt - now) / 1000))));
        UI.setTimer(settingsOf(room).gameMinutes * 60000);
      } else {
        UI.setCountdown(ts < startFlashUntil ? "시작!" : "");
        // 회의 중에는 시간이 멈춘 것처럼 표시
        if (room.game && room.game.endAt) UI.setTimer(room.game.endAt - (room.game.pausedAt || now));
      }
      const place = GameMap.roomAt(Player.me.x, Player.me.y);
      UI.setPlace(place ? place.name : "");

      // 가까운 내 미션 장치가 있으면 [미션] 버튼 켜기
      if (GSM.is("PLAYING") && room.missions) {
        const near = MissionSys.checkFound(room, Player.me.x, Player.me.y);
        UI.setMissionButton(!!near && MissionSys.coolingLeft(near) === 0 && !frozen);
      } else UI.setMissionButton(false);

      // [신고]/[긴급회의] 버튼 · 방해꾼 능력 버튼 · 상태 알림
      UI.setReportButton(Meeting.availableAction(room));
      Abilities.updateButtons(room);
      updateBanner(room, frozen);

      Renderer.draw(buildView(room));
      if (minimapOpen) Renderer.drawMinimap($("#minimap-canvas"), Player.me, room.missions ? MissionSys.mine(room) : []);
    }
    requestAnimationFrame(frame);
  }

  // ─────────────────────────────────────────────────────────────
  // 나가기
  // ─────────────────────────────────────────────────────────────
  async function leaveToTitle(msg) {
    const wasIn = !!Net.code;
    await Net.leaveRoom();
    Player.others.clear();
    bots.clear();
    GSM.set("TITLE", msg || (wasIn ? "" : ""));
    if (GSM.is("TITLE")) $("#title-error").textContent = msg || "";
  }

  // ─────────────────────────────────────────────────────────────
  // 시작
  // ─────────────────────────────────────────────────────────────
  function start() {
    Net.init();
    Input.init();
    Renderer.init();
    Debug.init();

    Net.onRoom(onRoom);
    Net.onPos((all) => { latestPos = all; Player.applyPositions(all, Net.myId); });

    // 모달 닫기
    $$("[data-close]").forEach((b) => b.addEventListener("click", () => UI.closeModal(b.dataset.close)));
    $$(".modal").forEach((m) => m.addEventListener("click", (e) => { if (e.target === m) m.classList.remove("open"); }));

    // 교사용 결과 CSV (게임 종료 화면 · 대기실 어디서 열어도 동작)
    $("#btn-csv-summary").addEventListener("click", () => Net.room && Analytics.downloadSummary(Net.room));
    $("#btn-csv-records").addEventListener("click", () => Net.room && Analytics.downloadRecords(Net.room));

    // 전체 화면 (태블릿)
    $("#btn-fullscreen").addEventListener("click", () => {
      const d = document.documentElement;
      if (!document.fullscreenElement) (d.requestFullscreen || d.webkitRequestFullscreen || (() => {})).call(d);
      else (document.exitFullscreen || document.webkitExitFullscreen || (() => {})).call(document);
    });

    // 오른쪽 버튼 · 키 입력 (방해꾼 능력은 abilities.js 에서 연결)
    Abilities.init();
    Input.onAction((name) => {
      if (!GSM.is("PLAYING")) return;
      if (name === "map") toggleMinimap();
      if (name === "report") Meeting.request();
      if (name === "mission" && Net.room) {
        if (!MissionSys.tryOpen(Net.room, Player.me.x, Player.me.y) && !MissionSys.nearMine(Net.room, Player.me.x, Player.me.y)) {
          toast("반짝이는 내 미션 장치 가까이 가면 미션을 할 수 있어요.");
        }
      }
    });
    $("#minimap-overlay").addEventListener("pointerdown", (e) => { e.preventDefault(); closeMinimap(); });

    // 살아 있다는 신호 (이 컴퓨터 안 모드에서 닫힌 탭 정리용)
    // 탭이 뒤에 숨겨지면 화면 그리기가 멈추므로, 타이머로 따로 보냅니다.
    setInterval(() => { if (Net.code) sendMyPos(true); }, CONFIG.HEARTBEAT_MS);
    setInterval(hostTick, 250);

    // 탭을 닫거나 새로고침하면 방에서 나가기 (단, 다시 들어올 수 있게 기록은 남김)
    window.addEventListener("pagehide", () => { if (Net.code) Net.leaveRoom(true); });

    GSM.set("TITLE");
    requestAnimationFrame(frame);

    // 같은 탭에서 새로고침했다면 → 하던 게임으로 자동으로 다시 들어가기
    const last = Net.lastSession();
    if (last && last.id === Net.myId) {
      $("#title-error").textContent = `방 ${last.code}에 다시 들어가는 중…`;
      Net.rejoinRoom(last.code, last.id)
        .then(() => toast("🔄 게임으로 다시 들어왔어요!"))
        .catch(() => { $("#title-error").textContent = ""; showRejoinButton(); });
    } else showRejoinButton();
  }

  // 다른 탭(또는 앱을 다시 켠 경우)에서 하던 게임으로 돌아가기 버튼
  function showRejoinButton() {
    const last = Net.lastSession();
    const btn = $("#btn-rejoin");
    if (!last) { btn.style.display = "none"; return; }
    btn.style.display = "";
    btn.textContent = `🔄 방 ${last.code} 게임으로 돌아가기 (${last.nick})`;
    btn.onclick = async () => {
      btn.disabled = true;
      try { await Net.rejoinRoom(last.code, last.id); toast("🔄 게임으로 다시 들어왔어요!"); }
      catch (e) { $("#title-error").textContent = e.message; btn.style.display = "none"; }
      btn.disabled = false;
    };
  }

  // (테스트용) 지금 화면에 그려질 정보 확인
  return { start, leaveToTitle, debugView: () => Net.room && buildView(Net.room) };
})();

window.addEventListener("DOMContentLoaded", Game.start);
