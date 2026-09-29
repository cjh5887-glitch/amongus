/* =====================================================================
   game.js — 게임 전체 흐름 (시작점)

   흐름: 메인 → (교사) PIN → 방 만들기 / (학생) 방 참가
        → 대기방 → 역할 공개(3초) → 스토리 → 3초 카운트다운 → 게임 → 게임 종료
        → 나의 수학 기록 → 대기방

   ▸ 방장(보통 교사 화면)이 "심판" 역할을 합니다. (화면 전환 시각, 타이머, 승패 판정, 색 배정)
     교사가 잠깐 끊기면 가장 먼저 들어온 학생 화면이 대신 심판을 맡아요.
   ▸ 다른 플레이어는 방 정보가 바뀌면 그 상태에 맞는 화면으로 따라갑니다.
   ▸ 모드(얼음땡 / 어몽어스)마다 다른 규칙은 modes.js 의 GameModeManager 가 알려 줍니다.
   ===================================================================== */

const Game = (() => {
  let lastTs = 0;
  let lastPosSent = 0, lastPosKey = "";
  let latestPos = {};
  let startFlashUntil = 0;
  let lastBlackout = 0;
  const bots = new Map();

  const settingsOf = (room) => roomSettings(room);
  const sortedIds = (room) => {
    const ps = (room && room.players) || {};
    return Object.keys(ps).sort((a, b) => (ps[a].joinedAt - ps[b].joinedAt) || (a < b ? -1 : 1));
  };

  // 배경음악: 화면(상태)과 남은 시간에 맞게
  function updateBGM() {
    const room = Net.room;
    const st = GSM.current;
    if (["TITLE", "LOBBY", "WAITING", "ROLE_REVEAL", "STORY"].includes(st)) return AudioManager.playBGM("lobby");
    if (["COUNTDOWN", "PLAYING", "MISSION", "MEETING", "TEACHER_VIEW"].includes(st)) {
      const g = room && room.game;
      const left = g && g.endAt ? g.endAt - (g.pausedAt || Net.now()) : Infinity;
      return AudioManager.playBGM(left <= 60000 ? "lastMinute" : "game");
    }
    if (["GAMEOVER", "RESULT"].includes(st) && room) {
      const won = GameModeManager.myTeamWon(room, Net.myId);
      return AudioManager.playBGM(won === false ? "defeat" : "victory");
    }
  }

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
      // 초대 링크 · QR 로 들어온 경우 (?room=1234) → 방 번호 자동 입력 → 닉네임만 쓰면 바로 참가
      const invited = roomFromUrl();
      const hint = $("#title-invite");
      hint.textContent = "";
      if (invited) {
        code.value = invited;
        hint.textContent = `🔗 초대 링크로 들어왔어요. 방 번호 ${invited} 가 입력되었어요. 닉네임을 쓰고 [방 참가하기]를 눌러 주세요.`;
        if (!msg) setTimeout(() => { try { (nick.value ? $("#btn-join") : nick).focus(); } catch (e) { /* 무시 */ } }, 50);
      }
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

      $("#btn-join").addEventListener("click", async () => {
        const n = getNick(); if (!n) return;
        const c = code.value.trim();
        if (!/^\d{4}$/.test(c)) { $("#title-error").textContent = "방 번호 4자리를 입력해 주세요."; code.focus(); return; }
        busy(true); $("#title-error").textContent = "방에 들어가는 중…";
        try { await Net.joinRoom(c, n); AudioManager.playSFX("join"); clearRoomFromUrl(); }
        catch (e) { $("#title-error").textContent = e.message || "방에 들어가지 못했어요."; busy(false); }
      }, { signal });

      code.addEventListener("keydown", (e) => { if (e.key === "Enter") $("#btn-join").click(); }, { signal });
      nick.addEventListener("keydown", (e) => { if (e.key === "Enter" && /^\d{4}$/.test(code.value.trim())) $("#btn-join").click(); }, { signal });
      $("#btn-howto").addEventListener("click", () => UI.openModal("modal-howto"), { signal });
      // 교사용: PIN → 방 만들기 (학생 화면에는 방 만들기 기능이 없음)
      $("#btn-teacher").addEventListener("click", () => Teacher.openPanel(), { signal });
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
      $("#btn-room-settings").addEventListener("click", () => Teacher.openRoomSettings(), { signal });
      $("#btn-players").addEventListener("click", () => Teacher.openPlayers(), { signal });
      const closeBtn = $("#btn-close-room");
      closeBtn.textContent = "방 닫기";
      delete closeBtn.dataset.sure;
      closeBtn.addEventListener("click", () => Teacher.confirmClick(closeBtn, "방 닫기", "정말 닫을까요? 한 번 더 누르기", async () => {
        await Net.closeRoom();
        Player.others.clear();
        GSM.set("TITLE", "방을 닫았어요.");
      }), { signal });
      $("#btn-add-bot").addEventListener("click", () => {
        const r = Net.room;
        if (r && Object.keys(r.players || {}).length < CONFIG.MAX_PLAYERS) Net.addBot(r.players || {});
      }, { signal });
      $("#btn-remove-bots").addEventListener("click", () => Net.room && Net.removeBots(Net.room.players), { signal });
      $("#btn-last-results").addEventListener("click", () => { Analytics.renderTeacher(Net.room); UI.openModal("modal-results"); }, { signal });
      $("#lobby-code").addEventListener("click", () => {
        try { navigator.clipboard.writeText(Net.code); toast("방 번호를 복사했어요."); } catch (e) { /* 무시 */ }
      }, { signal });
    },
    update(room) {
      UI.renderLobby(room, Net.myId, Net.isTeacher);
      if (Net.isTeacher) Teacher.renderInvite();
      Teacher.refreshRoomSettings();
    },
    exit() { ["modal-room-settings", "modal-players", "modal-sabpick", "modal-qr"].forEach((id) => UI.closeModal(id)); },
  });

  GSM.register("ROLE_REVEAL", {
    enter() {
      UI.show("role");
      Input.clear();
      UI.renderRole(Net.room, Net.myId);
    },
    update(room) { UI.renderRole(room, Net.myId); },   // 역할 정보가 조금 늦게 도착해도 바르게 표시
  });

  GSM.register("STORY", {
    enter(_, signal) {
      UI.show("story");
      UI.renderStory(Net.room);
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
      AudioManager.playSFX("start");
    },
  });

  // 미션 풀이 중 (게임 세계는 계속 움직이고, 내 캐릭터만 멈춤)
  GSM.register("MISSION", {
    enter(data) {
      UI.show("game");
      Input.clear();
      closeMinimap();
      AudioManager.playSFX("missionOpen");
      AudioManager.duck(true);   // 수학 문제를 푸는 동안 배경음악을 작게
      MissionUI.open(data, {
        onWrong: (s) => MissionSys.onWrong(s),
        onCorrect: (m, s) => MissionSys.onCorrect(m, s),
        onTimeout: (m, s) => MissionSys.onTimeout(m, s),
        onClose: () => { if (GSM.is("MISSION")) GSM.set("PLAYING"); },
      });
    },
    exit() { MissionUI.close(); AudioManager.duck(false); },
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
        AmongUsMode.afterMeeting(room);
      }
    },
  });
  // 나의 수학 기록 (게임 종료 약 3초 뒤)
  GSM.register("RESULT", {
    enter(_, signal) {
      UI.show("result");
      const room = Net.room;
      UI.renderGameOver(room, Net.myId, Net.isTeacher);
      Analytics.renderMine(room, Net.myId);
      // 교사: 전체 학습 결과를 바로 보여 줌
      if (Net.isTeacher) { Analytics.renderTeacher(room); UI.openModal("modal-results"); }
      $("#btn-go-lobby").addEventListener("click", () => hostBackToLobby(), { signal });
      $("#btn-go-leave").addEventListener("click", () => leaveToTitle(), { signal });
      $("#btn-teacher-results").addEventListener("click", () => { Analytics.renderTeacher(Net.room); UI.openModal("modal-results"); }, { signal });
      // 교사: 결과 창 안에서도 바로 다음 게임 준비
      const trLobby = $("#btn-tr-lobby");
      trLobby.style.display = Net.isTeacher ? "" : "none";
      trLobby.addEventListener("click", () => { UI.closeModal("modal-results"); hostBackToLobby(); }, { signal });
    },
    update(room) {
      UI.renderGameOver(room, Net.myId, Net.isTeacher);
      Analytics.renderMine(room, Net.myId);
      if ($("#modal-results").classList.contains("open")) Analytics.renderTeacher(room);
    },
    exit() { UI.closeModal("modal-results"); $("#btn-tr-lobby").style.display = "none"; },
  });

  // 승리 효과음 · 배경음악 (승패 정보가 도착했을 때 한 번)
  //  학생팀 승리 · 술래 승리 · 방해꾼 승리 효과음 → 우리 팀 결과에 맞는 배경음악
  let endSoundKey = "";
  function playEndSound(room) {
    const g = room && room.game;
    if (!g || !("winner" in g) && !g.reason) return;
    const key = (room.meta && room.meta.round) + ":" + g.winner + ":" + g.reason;
    if (key === endSoundKey) return;
    endSoundKey = key;
    const w = g.winner;
    AudioManager.playSFX(w === "student" ? "winStudent" : w === "tagger" ? "winTagger" : w === "saboteur" ? "winSaboteur" : "menuClose");
    updateBGM();
  }

  // 게임 종료: 조명 연출 → 승리 카드 → (약 3초 뒤) 나의 수학 기록
  let endingRaf = 0;
  GSM.register("GAMEOVER", {
    enter(_, signal) {
      Input.clear();
      Player.me.moving = false;
      closeMinimap();
      UI.show("gameover");
      UI.renderGameOver(Net.room, Net.myId, Net.isTeacher);
      const room = Net.room;
      endSoundKey = "";
      playEndSound(room);
      const studentsWin = () => { const r = Net.room; return !!(r && r.game && r.game.winner === "student"); };

      const t0 = performance.now();
      const cv = $("#ending-canvas");
      const loop = () => {
        const el = performance.now() - t0;
        Renderer.drawEnding(cv, Math.min(el, CONFIG.ENDING_MS), studentsWin());
        const left = Math.ceil((CONFIG.RESULT_AFTER_MS - el) / 1000);
        $("#go-auto").textContent = left > 0 ? `(${left})` : "";
        if (el >= CONFIG.RESULT_AFTER_MS) { if (GSM.is("GAMEOVER")) GSM.set("RESULT"); return; }
        endingRaf = requestAnimationFrame(loop);
      };
      endingRaf = requestAnimationFrame(loop);
      $("#btn-go-result").addEventListener("click", () => GSM.set("RESULT"), { signal });
    },
    update(room) { UI.renderGameOver(room, Net.myId, Net.isTeacher); playEndSound(room); },
    exit() { cancelAnimationFrame(endingRaf); },
  });

  // 「대기방으로 나가기」를 한 학생: 이번 판이 끝날 때까지 기다리는 화면
  //  → 선생님이 다음 게임을 준비(대기방)하면 자동으로 대기방으로, 다음 게임에 자동 참가
  GSM.register("WAITING", {
    enter(_, signal) {
      UI.show("waiting");
      Input.clear();
      closeMinimap();
      Player.me.moving = false;
      $("#btn-wait-leave").addEventListener("click", () => leaveToTitle(), { signal });
      this.update(Net.room);
    },
    update(room) {
      const st = room && room.meta && room.meta.state;
      $("#wait-status").textContent = st === "GAMEOVER" ? "이번 게임이 끝났어요. 선생님이 대기방을 열면 바로 돌아가요." : "친구들이 게임을 하고 있어요.";
    },
  });

  // 교사 관전 화면 (게임 중)
  GSM.register("TEACHER_VIEW", {
    enter(_, signal) {
      Input.clear();
      closeMinimap();
      Teacher.enterView(signal, () => teacherEndGame());
    },
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
    GameModeManager.resetLocal();   // 얼음·보호·유령 연출, 쿨타임, 버튼 상태 초기화 (모드를 바꿔도 이전 상태가 남지 않게)
    timeCue = { m1: false, s10: false, lastTick: -1 };
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
      leaveToTitle(Net.asTeacher ? "방이 없어졌어요." : "방이 닫혔어요.");
      return;
    }
    if (Net.asTeacher) return onRoomTeacher(room);
    if (room.kicked && room.kicked[Net.myId]) {
      leaveToTitle("선생님이 방에서 내보냈어요.");
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
    const leftRound = room.gone && room.gone[Net.myId] === "left";
    if (leftRound && st !== "LOBBY") { if (!GSM.is("WAITING")) GSM.set("WAITING"); }
    else if (st === "PLAYING" && GSM.is("MISSION")) { /* 미션 중에는 미션 화면 유지 */ }
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
    // 모드별 변화 (얼음땡: 얼음·땡 효과 / 어몽어스: 내가 얼려졌는지)
    if (GSM.inWorld() && room.roles) {
      if (GameModeManager.isFT(room)) FreezeTagMode.onRoom(room);
      else AmongUsMode.onRoom(room);
    }
    // 정전 소리 (새 정전이 시작될 때 한 번)
    const bo = room.sabotage && room.sabotage.blackoutUntil;
    if (bo && bo !== lastBlackout) { lastBlackout = bo; if (GSM.inWorld()) AudioManager.playSFX("blackout"); }
    // 방장: 얼리기·투표·나가기·미션 완료 등 방 정보가 바뀐 즉시 승패·신고 확인
    if (Net.isHost) hostTick();
  }

  // 교사 화면: 대기방 / 게임 중 관전 / 게임 종료 뒤 결과
  function onRoomTeacher(room) {
    if (!room.teachers || !room.teachers[Net.myId]) Net.heal();
    electHost(room);
    const st = room.meta.state;
    let target = "TEACHER_VIEW";
    if (st === "LOBBY") target = "LOBBY";
    else if (st === "GAMEOVER") target = GSM.is("RESULT") ? "RESULT" : "GAMEOVER";
    if (!GSM.is(target)) GSM.set(target);
    GSM.update(room);
    if (Net.isHost) hostTick();   // 방 정보가 바뀐 즉시 승패·신고 확인
  }

  // 방장(심판): 교사가 접속해 있으면 교사, 아니면 가장 먼저 들어온 학생
  function teacherOnline(room) {
    const t = room.meta.teacherId;
    if (!t || !room.teachers || !room.teachers[t]) return false;
    if (Net.mode === "local" && t !== Net.myId) {
      const age = beatAge(t);
      if (age != null && age > CONFIG.LOCAL_STALE_MS) return false;   // 닫힌 교사 탭
    }
    return true;
  }
  //  ▸ 화면이 숨겨졌거나(다른 탭·화면 꺼짐) 신호가 끊긴 방장은 심판을 넘겨줍니다.
  //    브라우저는 숨겨진 탭의 타이머를 크게 늦추기 때문에(몇 분 뒤엔 1분에 1번),
  //    그대로 두면 신고·회의 진행·승패 판정이 멈춘 것처럼 보입니다.
  const beatSeen = new Map();   // id → { t: 보낸 시각, at: 이 기기가 받은 시각 }
  const beatAge = (id) => { const b = beatSeen.get(id); return b ? Date.now() - b.at : null; };
  function hostUsable(room, id) {
    if (!id) return false;
    if (id === Net.myId) return !document.hidden;
    const p = latestPos[id];
    const age = beatAge(id);
    if (!p || age == null) return true;                          // 아직 신호를 못 받은 경우는 믿어 줌
    if (age > CONFIG.HOST_STALE_MS) return false;                // 신호가 끊김
    return p.v !== 0;                                            // 화면이 숨겨짐
  }
  function electHost(room) {
    if (!room || !room.meta) return;
    const tId = room.meta.teacherId;
    const cur = room.meta.hostId;
    const isHuman = (id) => room.players && room.players[id] && !room.players[id].bot;
    let best = null;
    if (teacherOnline(room) && hostUsable(room, tId)) best = tId;                   // 1순위: 교사
    else if (cur && cur !== tId && isHuman(cur) && hostUsable(room, cur)) best = cur;  // 지금 방장이 괜찮으면 그대로
    else best = sortedIds(room).find((id) => isHuman(id) && hostUsable(room, id)) || null;  // 가장 먼저 들어온 학생
    if (!best || best === cur) return;
    if (best === Net.myId) Net.roomUpdate({ "meta/hostId": Net.myId });   // 교사가 돌아오면 다시 교사가 맡아요 (학생 화면에는 교사 버튼이 생기지 않음)
  }

  // ─────────────────────────────────────────────────────────────
  // 방장(심판) 기능
  // ─────────────────────────────────────────────────────────────
  function hostStartGame() {
    const room = Net.room;
    if (!Net.isTeacher || !room) return;
    const ids = sortedIds(room);
    const s = settingsOf(room);
    const mode = GameModeManager.get(room);
    const min = DEBUG_MODE ? 1 : CONFIG.MIN_PLAYERS;
    if (ids.length < min) return toast(`${CONFIG.MIN_PLAYERS}명 이상 모여야 해요.`);
    if (mode.tooMany(ids.length, s)) return toast(mode.id === GAME_MODES.FREEZE_TAG ? "술래 수를 줄여 주세요." : "방해꾼 수를 줄여 주세요.");
    // DEBUG: 학생이 자기 🐞 창에서 고른 역할
    const forced = {};
    if (DEBUG_MODE) ids.forEach((id) => { const d = room.players[id].debugRole; if (d && d !== "auto") forced[id] = d; });
    // 어몽어스 · 교사 직접 지정: 고른 학생만 방해꾼, 나머지는 모두 학생 (교사 기기에만 있던 명단을 이때 역할로 저장)
    if (mode.id === GAME_MODES.AMONG_US && s.saboteurPick === "teacher") {
      const ps = Teacher.pickStatus(room);
      if (ps.missing > 0) return toast(`방해꾼을 ${ps.missing}명 더 선택해주세요.`);
      const picks = Teacher.getPicks(room);
      Object.keys(forced).forEach((k) => delete forced[k]);
      ids.forEach((id) => { forced[id] = picks.includes(id) ? "special" : "student"; });
    }
    const roles = mode.assignRoles(ids, s, forced);
    // 아직 색이 없는 학생이 있으면 지금 정함
    const colorFix = Net.colorUpdates(room);
    const colorNow = (id) => (colorFix[`players/${id}/color`] != null ? colorFix[`players/${id}/color`] : room.players[id].color);
    // 이번 게임 참가자 명단 (연결이 잠깐 끊겨도 명단은 유지)
    const members = {};
    ids.forEach((id) => {
      const p = room.players[id];
      members[id] = { nick: p.nick, color: colorNow(id), joinedAt: p.joinedAt, ...(p.bot ? { bot: true } : {}) };
    });
    // 미션을 받는 역할만 (얼음땡 술래는 미션 없음 · 어몽어스 방해꾼은 가짜 미션)
    const missionIds = ids.filter((id) => mode.missionRoles.includes(roles[id]));
    AudioManager.playSFX("start");
    Net.roomUpdate({
      ...colorFix,
      roles,
      ...CLEAR_ROUND,
      members,
      missions: MissionSys.assign(missionIds, s),
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
    if (!Net.isTeacher) return;
    Net.roomUpdate({ "meta/state": "LOBBY", "meta/phaseEndsAt": null, roles: null, ready: null, game: null, missions: null, done: null, fakeDone: null, ...CLEAR_ROUND });
  }

  // 한 판이 끝나면 지워야 하는 방해·회의·유령 기록
  //  (얼음땡 얼음·보호·땡 기록, 어몽어스 유령·얼음 흔적까지 모두 → 모드를 바꿔도 이전 상태가 남지 않음)
  const CLEAR_ROUND = {
    sabotage: null, frozen: null, disguise: null, disguiseUses: null, ghosts: null,
    meeting: null, meetingUsed: null, meetingTotal: null, requests: null,
    members: null, gone: null,
    protect: null, rescuing: null, rescues: null, traces: null, frozenMarkers: null,
  };

  // 교사: 게임 강제 종료
  function teacherEndGame() {
    const room = Net.room;
    if (!Net.isTeacher || !room || !room.meta) return;
    if (!["ROLE_REVEAL", "STORY", "COUNTDOWN", "PLAYING", "MEETING"].includes(room.meta.state)) return;
    Net.roomUpdate({ "meta/state": "GAMEOVER", "game/winner": null, "game/reason": "teacher", "game/pausedAt": null, meeting: null, requests: null });
  }

  let lastHostAction = "";
  const hostDone = new Set();
  let hostDoneRound = null;
  let lastColorFix = "";
  const missingSince = new Map();
  // (방 정보 변경 알림 안에서 다시 불려도 겹쳐 실행되지 않게)
  let inHostTick = false, hostTickAgain = false;
  function hostTick() {
    if (inHostTick) { hostTickAgain = true; return; }
    inHostTick = true;
    try { hostTickBody(); } finally { inHostTick = false; }
    if (hostTickAgain) { hostTickAgain = false; setTimeout(hostTick, 0); }
  }
  function hostTickBody() {
    const raw = Net.room;
    if (!raw || !Net.isHost || !raw.meta) return;
    const room = raw.players ? raw : { ...raw, players: {} };   // 교사만 있는 방 (학생이 아직 없음)
    const now = Net.now();
    const st = room.meta.state;
    // 같은 일을 두 번 하지 않도록 (판마다 한 번) — 게임 종료가 여러 번 저장되는 일 방지
    if (hostDoneRound !== room.meta.round) { hostDoneRound = room.meta.round; hostDone.clear(); }
    const once = (key, fn) => { if (!hostDone.has(key)) { hostDone.add(key); lastHostAction = key; fn(); } };

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
    // 색 자동 배정 (색이 없거나 겹친 학생) — 방장 한 곳에서만 정하고 모두에게 같은 값으로 동기화
    if (room.players) {
      const fix = Net.colorUpdates(room);
      const k = JSON.stringify(fix);
      if (k !== "{}" && k !== lastColorFix) { lastColorFix = k; Net.roomUpdate(fix); }
      if (k === "{}") lastColorFix = "";
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
    const mode = GameModeManager.get(room);
    if (st === "PLAYING") {
      // 승패 판정 — 모드마다 한 곳(checkWinCondition)에서 순서대로
      //  얼음땡: 복구율 100% → 술래 모두 나감 → 모든 학생 얼음 → 시간 종료
      //  어몽어스: 방해꾼 0명 → 복구율 100% → 학생 ≤ 방해꾼 → 시간 종료
      //  방장 화면만 결과를 저장하고(GAMEOVER · winner) 모두가 그 값을 따라갑니다.
      const w = room.roles ? mode.checkWinCondition(room, now) : null;
      if (w) { endGame(room, w); return; }
      // 긴급회의 · 신고 요청 처리 (어몽어스만)
      if (mode.meetingsEnabled && room.requests && Meeting.hostCheckRequests(room)) return;
      if (!mode.meetingsEnabled && room.requests) Net.roomUpdate({ requests: null });
    }
    if (st === "MEETING") {
      Meeting.hostTick(room);
      botsVote(room);
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
        if (Net.isTeacher && id === Net.myId) return;
        const pos = latestPos[id];
        const last = Math.max(p.joinedAt || 0, (pos && pos.t) || 0);
        if (now - last > CONFIG.LOCAL_STALE_MS) Net.roomUpdate({ [`players/${id}`]: null, [`ready/${id}`]: null });
      });
    }
  }

  // 게임 종료 저장 (한 판에 한 번만) — 이미 GAMEOVER 면 아무것도 하지 않음
  function endGame(room, w) {
    if (!room.meta || room.meta.state === "GAMEOVER") return;
    if (endedRound === room.meta.round) return;
    endedRound = room.meta.round;
    Net.roomUpdate({ "meta/state": "GAMEOVER", "game/winner": w.winner, "game/reason": w.reason, "game/pausedAt": null, requests: null });
  }
  let endedRound = null;

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
  //  ▸ 얼어 있는 봇은 움직이지 않음 · 유령 봇은 벽 통과
  //  ▸ 얼음땡: 술래 봇은 가까운 학생을 잡고, 학생 봇은 얼어 있는 친구 옆에 머물면 땡
  function simulateBots(dt, room) {
    const ids = sortedIds(room);
    const playing = room.meta && room.meta.state === "PLAYING";
    const ft = GameModeManager.isFT(room);
    const s = settingsOf(room);
    const posOf = (pid) => {
      if (bots.has(pid)) return bots.get(pid);
      if (pid === Net.myId && !Net.asTeacher) return Player.me;
      const p = latestPos[pid];
      return p && typeof p.x === "number" ? p : null;
    };
    ids.forEach((id, idx) => {
      const p = room.players[id];
      if (!p.bot) return;
      let b = bots.get(id);
      if (!b) {
        // 방장이 바뀌어 봇을 이어받은 경우: 마지막 위치에서 계속
        const lp = latestPos[id];
        const sp = lp && typeof lp.x === "number" && room.meta.state !== "LOBBY" ? { x: lp.x, y: lp.y } : GameMap.getSpawn(idx, ids.length);
        b = { x: sp.x, y: sp.y, vx: 0, vy: 0, dir: 1, next: 0, sent: 0, moving: false, catchAt: 0, rescue: null };
        bots.set(id, b);
      }
      const now = performance.now();
      const frozen = PlayerState.isFrozen(room, id);
      if (playing && !frozen) {
        if (now > b.next) {
          const a = Math.random() * Math.PI * 2;
          const go = Math.random() < 0.75;
          b.vx = go ? Math.cos(a) : 0; b.vy = go ? Math.sin(a) : 0;
          b.next = now + 800 + Math.random() * 2200;
        }
        const ox = b.x, oy = b.y;
        const sp = 140 * (ft ? FreezeTagMode.speedMult(room, id) : 1);
        GameMap.moveWithCollision(b, b.vx * sp * dt, b.vy * sp * dt, CONFIG.PLAYER_RADIUS, PlayerState.isGhost(room, id));
        b.moving = Math.hypot(b.x - ox, b.y - oy) > 0.1;
        if (!b.moving) b.next = 0;
        if (b.vx) b.dir = b.vx > 0 ? 1 : -1;
      } else b.moving = false;

      // 얼음땡 봇 행동
      if (playing && ft && room.game && room.game.startAt) {
        const nowNet = Net.now();
        if (Roles.isTagger(room, id) && nowNet > room.game.startAt + CONFIG.FREEZE_TAG.FIRST_TAG_SEC * 1000 && nowNet > b.catchAt) {
          const target = Roster.ids(room).find((pid) => {
            if (room.roles[pid] !== "student" || PlayerState.of(room, pid) !== PlayerState.NORMAL) return false;
            const q = posOf(pid);
            return q && Math.hypot(q.x - b.x, q.y - b.y) < CONFIG.FREEZE_TAG.TAG_RANGE;
          });
          if (target) {
            b.catchAt = nowNet + Number(s.tagCooldown || 7) * 1000;
            Net.roomUpdate({ [`frozen/${target}`]: { by: id, t: nowNet }, [`protect/${target}`]: null });
          }
        }
        if (room.roles[id] === "student" && !frozen) {
          const target = Roster.ids(room).find((pid) => {
            if (!PlayerState.isFrozen(room, pid)) return false;
            const q = posOf(pid);
            return q && Math.hypot(q.x - b.x, q.y - b.y) < CONFIG.FREEZE_TAG.RESCUE_RANGE;
          });
          if (target) {
            if (!b.rescue || b.rescue.target !== target) b.rescue = { target, t0: nowNet };
            else if (nowNet - b.rescue.t0 > Number(s.rescueHold || 1) * 1000) {
              Net.roomUpdate({ [`frozen/${target}`]: null, [`protect/${target}`]: nowNet + Number(s.protectSec || 5) * 1000 });
              b.rescue = null;
            }
          } else b.rescue = null;
        }
      }

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
    // 교사는 캐릭터가 없음 → 접속 확인 신호만
    const v = document.hidden ? 0 : 1;   // 화면이 보이는지 (방장 넘겨주기 판단용)
    if (Net.asTeacher) { Net.sendPos(Net.myId, { tch: 1, v, t: Net.now() }); return; }
    // 이번 판에서 빠진 학생: 위치 없이 접속 확인 신호만 (맵에 그려지지 않음)
    if (GSM.is("WAITING")) { Net.sendPos(Net.myId, { w: 1, v, t: Net.now() }); return; }
    const m = Player.me;
    const key = `${Math.round(m.x)},${Math.round(m.y)},${m.dir},${m.moving}`;
    const now = performance.now();
    if (!force) {
      if (now - lastPosSent < 1000 / CONFIG.POS_SEND_HZ) return;
      if (key === lastPosKey && now - lastPosSent < 1000) return;
    }
    lastPosSent = now; lastPosKey = key;
    Net.sendPos(Net.myId, { x: Math.round(m.x), y: Math.round(m.y), d: m.dir, m: m.moving, v: document.hidden ? 0 : 1, t: Net.now() });
  }

  // ─────────────────────────────────────────────────────────────
  // 매 프레임
  // ─────────────────────────────────────────────────────────────
  function buildView(room) {
    const me = Player.me;
    const myP = Roster.info(room, Net.myId) || { color: 0 };
    const iGhost = Abilities.isGhost(room, Net.myId);
    const iSab = Roles.isSaboteur(room, Net.myId);
    const mode = GameModeManager.get(room);
    // 시야: 유령은 넓게, 정전 중인 (살아 있는) 학생은 좁게
    const blackout = Abilities.blackoutLeft(room) > 0 && !iGhost && !iSab;
    const R = iGhost ? CONFIG.GHOST_VISION_RADIUS : CONFIG.VISION_RADIUS * (blackout ? CONFIG.BLACKOUT_VISION : 1);
    const visibility = (x, y) => {
      if (Renderer.debug.noFog) return 1;
      const d = Math.hypot(x - me.x, y - me.y);
      let alpha = d < R * 0.8 ? 1 : d < R ? (R - d) / (R * 0.2) : 0;
      // 유령은 벽 너머도 보임, 살아 있는 사람은 벽에 가려짐
      if (alpha > 0 && !iGhost && !GameMap.lineOfSight(me.x, me.y, x, y)) alpha = 0;
      return alpha;
    };
    const others = [];
    Player.others.forEach((o, id) => {
      if (!Roster.has(room, id)) return;    // 이번 판에 없는 사람(대기 중·나감)은 그리지 않음
      const p = Roster.info(room, id);
      if (!p) return;
      const ghost = Abilities.isGhost(room, id);
      let alpha = visibility(o.x, o.y);
      // 유령은 살아 있는 학생에게 보이지 않음 · 방해꾼에게는 희미하게 · 유령끼리는 반투명
      if (ghost) alpha *= iGhost ? 0.55 : iSab ? 0.22 : 0;
      // 위장: 다른 학생의 색으로 보임  (게임 중에는 닉네임을 그리지 않음)
      const dis = Abilities.disguiseOf(room, id);
      others.push({
        pid: id, x: o.x, y: o.y, dir: o.dir, walk: o.walk, moving: o.moving,
        color: colorOf(dis ? dis.color : p.color).hex,
        alpha, ghost, frozen: !ghost && PlayerState.isFrozen(room, id),
      });
    });
    // 어몽어스: 얼음 흔적 (얼음에 갇힌 캐릭터 모양)
    const traces = mode.id === GAME_MODES.AMONG_US ? AmongUsMode.traces(room).map((t) => ({
      pid: t.pid, x: t.x, y: t.y, color: colorOf(t.color).hex, alpha: visibility(t.x, t.y),
      iceProgress: clamp((Net.now() - t.t) / CONFIG.AMONG_US.FREEZE_ANIM_MS, 0, 1),
    })) : [];
    const myDis = Abilities.disguiseOf(room, Net.myId);
    const meView = {
      pid: Net.myId, isMe: true,
      x: me.x, y: me.y, dir: me.dir, walk: me.walk, moving: me.moving,
      color: colorOf(myDis ? myDis.color : myP.color).hex,
      ghost: iGhost, frozen: PlayerState.isFrozen(room, Net.myId),
    };
    // 모드별 표시 (술래 표시 · 보호막 · 땡 진행 · 얼음 연출)
    mode.decorate(room, others.concat([meView]));
    return {
      me: meView,
      others,
      traces,
      fx: mode.getFx(),
      visionRadius: R,
      darkness: blackout ? CONFIG.BLACKOUT_DARKNESS : CONFIG.DARKNESS,
      devices: buildDevices(room),
      effects: MissionSys.getEffects(),
      hint: GSM.is("PLAYING") ? MissionSys.nearestHint(room, me.x, me.y) : null,
      emergencyGlow: GSM.is("PLAYING") && mode.meetingsEnabled && !!Meeting.availableAction(room) && Meeting.nearEmergency(me.x, me.y),
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
  function updateBanner(room) {
    if (!GSM.is("PLAYING", "MISSION")) return UI.setBanner("", "");
    const iGhost = Abilities.isGhost(room, Net.myId);
    const iSab = Roles.isSaboteur(room, Net.myId);
    const bo = Abilities.blackoutLeft(room);
    const dis = Abilities.disguiseOf(room, Net.myId);
    const mb = GameModeManager.get(room).banner(room);   // 얼음 · 보호 · 술래 출발 · 얼음에 갇힘
    if (mb) return UI.setBanner(mb[0], mb[1]);
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
    AudioManager.playSFX(minimapOpen ? "menuOpen" : "menuClose");
  }
  function closeMinimap() {
    const was = minimapOpen;
    minimapOpen = false; $("#minimap-overlay").classList.remove("open");
    return was;
  }

  // 남은 시간 알림 (1분 · 10초) — 한 판에 한 번씩
  let timeCue = { m1: false, s10: false, lastTick: -1 };
  function timeCues(left) {
    if (left > 61000) { timeCue.m1 = false; timeCue.s10 = false; }
    if (left <= 60000 && left > 0 && !timeCue.m1) { timeCue.m1 = true; AudioManager.playSFX("oneMinute"); toast("⏰ 1분 남았어요!"); updateBGM(); }
    if (left <= 10000 && left > 0 && !timeCue.s10) { timeCue.s10 = true; AudioManager.playSFX("tenSeconds"); }
    const sec = Math.ceil(left / 1000);
    if (left < 10000 && left > 0 && sec !== timeCue.lastTick) { timeCue.lastTick = sec; if (sec < 10) AudioManager.playSFX("tick"); }
  }

  function frame(ts) {
    const dt = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 0;
    lastTs = ts;
    if (DEBUG_MODE) Debug.tick();
    const room = Net.room;

    // 교사 관전 화면
    if (GSM.is("TEACHER_VIEW") && room && room.meta) {
      Abilities.applyDoorLocks(room);
      Player.updateOthers(dt);
      if (Net.isHost) simulateBots(dt, room);
      Teacher.frame(room);
      const g = room.game;
      if (g && g.endAt && room.meta.state === "PLAYING") timeCues(g.endAt - Net.now());
    } else if (!GSM.inWorld() && Net.isHost && room && room.players && room.meta && room.meta.state === "PLAYING") {
      simulateBots(dt, room);   // 방장이 대기 화면에 있어도 봇은 계속
    }

    if (GSM.inWorld() && room && room.players) {
      const mode = GameModeManager.get(room);
      Abilities.applyDoorLocks(room);
      mode.frame(dt, room);
      // 움직일 수 없는 때: 얼음(얼음땡) · 얼음에 갇히는 연출(어몽어스) · 환경설정 창
      const frozen = PlayerState.isFrozen(room, Net.myId) || (mode.id === GAME_MODES.AMONG_US && AmongUsMode.freezingNow());
      if (GSM.canMove() && !frozen && !SettingsMenu.isOpen) Player.updateMe(dt, Input.vector(), settingsOf(room), mode.speedMult(room, Net.myId));
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
        if (room.game && room.game.endAt) {
          const left = room.game.endAt - (room.game.pausedAt || now);
          UI.setTimer(left);
          if (GSM.is("PLAYING", "MISSION")) timeCues(left);
        }
      }
      const place = GameMap.roomAt(Player.me.x, Player.me.y);
      UI.setPlace(place ? place.name : "");

      // 모드·역할별 버튼 (필요 없는 버튼은 숨김)
      const show = mode.hud(room, Net.myId);
      UI.setHudButtons(show, mode.buttons(room));

      // 가까운 내 미션 장치가 있으면 [미션] 버튼 켜기
      if (show.mission && GSM.is("PLAYING") && room.missions) {
        const near = MissionSys.checkFound(room, Player.me.x, Player.me.y);
        UI.setMissionButton(!!near && MissionSys.coolingLeft(near) === 0 && !frozen);
      } else UI.setMissionButton(false);

      // [신고]/[긴급회의] 버튼 (어몽어스) · 방해 버튼 · 상태 알림
      UI.setReportButton(show.report ? Meeting.availableAction(room) : null);
      Abilities.updateButtons(room);
      updateBanner(room);

      Renderer.draw(buildView(room));
      if (minimapOpen) {
        // 얼음땡: 얼어 있는 친구 위치도 지도에 (땡 하러 가기 쉽게)
        const extra = mode.id === GAME_MODES.FREEZE_TAG && !Roles.isTagger(room, Net.myId)
          ? Roster.ids(room).filter((pid) => pid !== Net.myId && PlayerState.isFrozen(room, pid)).map((pid) => Player.others.get(pid)).filter(Boolean).map((o) => ({ x: o.x, y: o.y, kind: "frozen" }))
          : [];
        Renderer.drawMinimap($("#minimap-canvas"), Player.me, room.missions ? MissionSys.mine(room) : [], extra);
      }
    }
    requestAnimationFrame(frame);
  }

  // ─────────────────────────────────────────────────────────────
  // 나가기
  // ─────────────────────────────────────────────────────────────
  async function leaveToTitle(msg) {
    const wasIn = !!Net.code;
    await Net.leaveRoom();
    AudioManager.duck(false);
    Player.others.clear();
    bots.clear();
    GSM.set("TITLE", msg || (wasIn ? "" : ""));
    if (GSM.is("TITLE")) $("#title-error").textContent = msg || "";
  }

  // 환경설정 → 「대기방으로 나가기」: 이번 판에서만 빠지고 방에는 남음
  async function leaveRound() {
    if (!Net.code || Net.isTeacher) return;
    await Net.leaveRound();
    AudioManager.playSFX("menuClose");
    GSM.set("WAITING");
    toast("게임에서 나왔어요. 다음 게임에 자동으로 참가해요.");
  }

  // ─────────────────────────────────────────────────────────────
  // 시작
  // ─────────────────────────────────────────────────────────────
  function start() {
    Net.init();
    Input.init();
    Renderer.init();
    Debug.init();
    Teacher.init();
    SettingsMenu.init({ onLeave: () => leaveRound(), closeMinimap: () => closeMinimap() });
    GSM.onChange(() => updateBGM());
    // 버튼 누르는 소리 (모든 화면 공통)
    document.addEventListener("click", (e) => {
      const b = e.target.closest && e.target.closest("button.btn, button.chip, .room-code");
      if (b && !b.disabled) AudioManager.playSFX("click");
    });

    Net.onRoom(onRoom);
    Net.onPos((all) => {
      latestPos = all;
      // 누가 언제 마지막으로 신호를 보냈는지 "이 기기 시계"로 기록 (기기마다 시계가 달라도 정확하게)
      const at = Date.now();
      Object.keys(all).forEach((id) => { const p = all[id]; const b = beatSeen.get(id); if (p && (!b || b.t !== p.t)) beatSeen.set(id, { t: p.t, at }); });
      Player.applyPositions(all, Net.myId);
    });

    // 모달 닫기
    $$("[data-close]").forEach((b) => b.addEventListener("click", () => UI.closeModal(b.dataset.close)));
    $$(".modal").forEach((m) => m.addEventListener("click", (e) => { if (e.target === m) m.classList.remove("open"); }));

    // 교사용 결과 CSV (게임 종료 화면 · 대기실 어디서 열어도 동작)
    $("#btn-csv-summary").addEventListener("click", () => Net.room && Analytics.downloadSummary(Net.room));
    $("#btn-csv-records").addEventListener("click", () => Net.room && Analytics.downloadRecords(Net.room));

    // 전체 화면 (태블릿)
    $("#btn-fullscreen").addEventListener("click", () => SettingsMenu.toggleFullscreen());

    // 오른쪽 버튼 · 키 입력 (방해꾼 능력은 abilities.js 에서 연결)
    Abilities.init();
    Input.onAction((name) => {
      if (!GSM.is("PLAYING") || SettingsMenu.isOpen) return;
      const room = Net.room;
      if (!room) return;
      const mode = GameModeManager.get(room);
      const show = mode.hud(room, Net.myId);
      if (name === "map") toggleMinimap();
      if (name === "report" && show.report) Meeting.request();          // (얼음땡에서 R 은 [땡] — 누르고 있기로 처리)
      if ((name === "catch" && show.catch) || (name === "sabotage" && show.sabotage)) mode.onAction(name, room);
      if (name === "mission" && show.mission) {
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
    // 방장 확인 (숨겨진 방장 → 다른 화면이 이어받기) · 화면이 숨겨지거나 다시 보이면 바로 알림
    setInterval(() => { if (Net.code && Net.room) electHost(Net.room); }, 1000);
    document.addEventListener("visibilitychange", () => { if (Net.code) { sendMyPos(true); if (Net.room) electHost(Net.room); } });

    // 탭을 닫거나 새로고침하면 방에서 나가기 (단, 다시 들어올 수 있게 기록은 남김)
    window.addEventListener("pagehide", () => { if (Net.code) Net.leaveRoom(true); });

    GSM.set("TITLE");
    requestAnimationFrame(frame);

    // 같은 탭에서 새로고침했다면 → 하던 게임으로 자동으로 다시 들어가기
    const last = Net.lastSession();
    if (last && last.id === Net.myId) {
      $("#title-error").textContent = `방 ${last.code}에 ${last.teacher ? "교사로 " : ""}다시 들어가는 중…`;
      Net.rejoinRoom(last.code, last.id)
        .then(() => toast("🔄 게임으로 다시 들어왔어요!"))
        .catch(() => { $("#title-error").textContent = ""; showRejoinButton(); });
    } else showRejoinButton();
  }

  // 주소의 ?room=1234 읽기 / 참가한 뒤에는 주소에서 지우기 (새로고침해도 다시 입력되지 않게)
  function roomFromUrl() {
    try {
      const v = new URLSearchParams(location.search).get("room");
      return v && /^\d{4}$/.test(v.trim()) ? v.trim() : "";
    } catch (e) { return ""; }
  }
  function clearRoomFromUrl() {
    try {
      if (!roomFromUrl() || !history.replaceState) return;
      const u = new URL(location.href);
      u.searchParams.delete("room");
      history.replaceState(null, "", u.pathname + (u.search || "") + u.hash);
    } catch (e) { /* 무시 */ }
  }

  // 다른 탭(또는 앱을 다시 켠 경우)에서 하던 게임으로 돌아가기 버튼
  function showRejoinButton() {
    const last = Net.lastSession();
    const btn = $("#btn-rejoin");
    if (!last) { btn.style.display = "none"; return; }
    btn.style.display = "";
    btn.textContent = last.teacher ? `🔄 방 ${last.code} 교사 화면으로 돌아가기` : `🔄 방 ${last.code} 게임으로 돌아가기 (${last.nick})`;
    btn.onclick = async () => {
      btn.disabled = true;
      try { await Net.rejoinRoom(last.code, last.id); toast("🔄 게임으로 다시 들어왔어요!"); }
      catch (e) { $("#title-error").textContent = e.message; btn.style.display = "none"; }
      btn.disabled = false;
    };
  }

  // (테스트용) 지금 화면에 그려질 정보 확인
  return {
    start, leaveToTitle, leaveRound, debugView: () => Net.room && buildView(Net.room),
    // (테스트용) 방장 판단 근거
    debugHost: () => { const r = Net.room; if (!r || !r.meta) return null; const t = r.meta.teacherId; const p = latestPos[t];
      return { teacherOnline: teacherOnline(r), teacherUsable: hostUsable(r, t), teacherBeatAge: beatAge(t), teacherV: p ? p.v : null }; },
  };
})();

window.addEventListener("DOMContentLoaded", Game.start);
