/* =====================================================================
   network.js — 방 만들기 · 참가 · 실시간 동기화

   두 가지 방식을 같은 함수로 사용합니다.
     ▸ 온라인 모드   : firebase-config.js 를 채우면 Firebase Realtime Database 사용
     ▸ 이 컴퓨터 안  : 설정이 비어 있으면 브라우저 저장소(localStorage) 사용
                       → 같은 브라우저의 여러 탭끼리 함께 테스트할 수 있어요.

   데이터 구조
     ratioSchool/rooms/{방번호}/
        meta     { hostId, teacherId, state, phaseEndsAt, createdAt, round }
        settings { 교사 설정 (gameMode 포함) }
        teachers/{id} { t }          (교사 접속 표시 · 교사는 플레이어가 아님)
        players/{id} { nick, color, joinedAt, bot? }   ← color 는 방장(교사)이 정해서 모두에게 같게 동기화
        kicked/{id}  true            (교사가 내보낸 학생)
        roles/{id}   "student" | "saboteur" | "tagger"
        ready/{id}   true            (스토리 화면 준비 완료)
        game     { startAt, endAt, winner, reason }
     ratioSchool/pos/{방번호}/{id}  { x, y, d, m, t }   ← 자주 바뀌는 위치는 따로 저장
   ===================================================================== */

// ─────────────────────────────────────────────────────────────
// 저장소 1) Firebase
// ─────────────────────────────────────────────────────────────
function createFirebaseStore(db) {
  let offset = 0;
  db.ref(".info/serverTimeOffset").on("value", (s) => { offset = s.val() || 0; });
  const clean = (v) => (v === undefined ? null : JSON.parse(JSON.stringify(v)));
  return {
    kind: "online",
    get: (p) => db.ref(p).once("value").then((s) => s.val()),
    set: (p, v) => db.ref(p).set(clean(v)),
    update: (p, obj) => db.ref(p).update(clean(obj)),
    remove: (p) => db.ref(p).remove(),
    on(p, cb) {
      const h = (s) => cb(s.val());
      db.ref(p).on("value", h);
      return () => db.ref(p).off("value", h);
    },
    onDisconnectRemove: (p) => db.ref(p).onDisconnect().remove(),
    cancelDisconnect: (p) => db.ref(p).onDisconnect().cancel(),
    // 인터넷이 끊겼다가 다시 연결되면 알려 줌 (태블릿 화면이 꺼졌다 켜질 때 등)
    onConnected(cb) { db.ref(".info/connected").on("value", (s) => cb(!!s.val())); },
    now: () => Date.now() + offset,
  };
}

// ─────────────────────────────────────────────────────────────
// 저장소 2) 이 컴퓨터 안 (localStorage)
//   ▸ 방 하나 = 저장 칸 하나, 플레이어 위치 = 사람마다 저장 칸 하나
//     (여러 탭이 동시에 써도 서로 덮어쓰지 않게 나눠 저장)
// ─────────────────────────────────────────────────────────────
function createLocalStore() {
  const PREFIX = "rsdb|";
  let memory = null; // localStorage 를 쓸 수 없을 때 쓰는 임시 저장소
  try {
    localStorage.setItem("rsdb_test", "1");
    localStorage.removeItem("rsdb_test");
  } catch (e) { memory = {}; }

  const raw = {
    get(k) { if (memory) return memory[k] ?? null; return localStorage.getItem(k); },
    set(k, v) { if (memory) memory[k] = v; else localStorage.setItem(k, v); },
    del(k) { if (memory) delete memory[k]; else localStorage.removeItem(k); },
    keys() { if (memory) return Object.keys(memory); const out = []; for (let i = 0; i < localStorage.length; i++) out.push(localStorage.key(i)); return out; },
  };

  const segs = (p) => p.split("/").filter(Boolean);
  // 저장 칸 경로 길이: pos 는 4단계(ratioSchool/pos/방/id), 나머지는 3단계
  const shardDepth = (s) => (s[1] === "pos" ? 4 : 3);

  function readShard(shardSegs) {
    const v = raw.get(PREFIX + shardSegs.join("/"));
    return v == null ? null : JSON.parse(v);
  }
  function writeShard(shardSegs, value) {
    const k = PREFIX + shardSegs.join("/");
    if (value === null || value === undefined) raw.del(k);
    else raw.set(k, JSON.stringify(value));
  }

  function getIn(obj, path) {
    let o = obj;
    for (const k of path) { if (o == null || typeof o !== "object") return null; o = o[k]; }
    return o === undefined ? null : o;
  }
  function setIn(obj, path, value) {
    if (path.length === 0) return value;
    const root = obj && typeof obj === "object" ? obj : {};
    let o = root;
    for (let i = 0; i < path.length - 1; i++) {
      if (o[path[i]] == null || typeof o[path[i]] !== "object") o[path[i]] = {};
      o = o[path[i]];
    }
    const last = path[path.length - 1];
    if (value === null || value === undefined) delete o[last];
    else o[last] = value;
    return Object.keys(root).length ? root : null;
  }

  // 경로의 값을 읽기 (저장 칸 여러 개를 합쳐서)
  function read(p) {
    const s = segs(p);
    const depth = shardDepth(s);
    if (s.length >= depth) return getIn(readShard(s.slice(0, depth)), s.slice(depth));
    // 저장 칸보다 위쪽 경로 → 해당하는 칸을 모두 모아서 합치기
    const prefix = PREFIX + s.join("/") + "/";
    let result = null;
    raw.keys().forEach((k) => {
      if (!k.startsWith(prefix)) return;
      const rest = segs(k.slice(PREFIX.length)).slice(s.length);
      const v = raw.get(k);
      if (v != null) result = setIn(result, rest, JSON.parse(v));
    });
    return result;
  }

  function write(p, value) {
    const s = segs(p);
    const depth = shardDepth(s);
    if (s.length >= depth) {
      const shard = s.slice(0, depth);
      writeShard(shard, setIn(JSON.parse(JSON.stringify(readShard(shard))), s.slice(depth), value));
      return;
    }
    // 위쪽 경로에 쓰기 → 기존 칸 지우고 새로 나눠 쓰기
    const prefix = PREFIX + s.join("/") + "/";
    raw.keys().forEach((k) => { if (k.startsWith(prefix)) raw.del(k); });
    if (value && typeof value === "object") {
      Object.keys(value).forEach((k) => write(p + "/" + k, value[k]));
    }
  }

  // ── 구독 ──
  const subs = new Set();
  function notifyAll() {
    subs.forEach((sub) => {
      const v = read(sub.path);
      const str = JSON.stringify(v);
      if (str !== sub.last) { sub.last = str; try { sub.cb(v); } catch (e) { console.error(e); } }
    });
  }
  let notifyQueued = false;
  function queueNotify() {
    if (notifyQueued) return;
    notifyQueued = true;
    setTimeout(() => { notifyQueued = false; notifyAll(); }, 0);
  }
  window.addEventListener("storage", (e) => { if (!e.key || e.key.startsWith(PREFIX)) queueNotify(); });

  const clean = (v) => (v === undefined ? null : JSON.parse(JSON.stringify(v)));

  return {
    kind: "local",
    get: (p) => Promise.resolve(read(p)),
    set: (p, v) => { write(p, clean(v)); queueNotify(); return Promise.resolve(); },
    update: (p, obj) => {
      Object.keys(obj).forEach((k) => write(p + "/" + k, clean(obj[k])));
      queueNotify();
      return Promise.resolve();
    },
    remove: (p) => { write(p, null); queueNotify(); return Promise.resolve(); },
    on(p, cb) {
      const sub = { path: p, cb, last: undefined };
      subs.add(sub);
      setTimeout(() => { if (subs.has(sub)) { const v = read(p); sub.last = JSON.stringify(v); cb(v); } }, 0);
      return () => subs.delete(sub);
    },
    onDisconnectRemove: () => {},
    cancelDisconnect: () => {},
    onConnected: () => {},
    now: () => Date.now(),
  };
}

// ─────────────────────────────────────────────────────────────
// 방 관리
// ─────────────────────────────────────────────────────────────
const Net = (() => {
  const ROOT = "ratioSchool";
  let store = null;
  // 내 id: 같은 탭에서 새로고침해도 그대로 (다시 들어오기용)
  let myId = (() => {
    try { const s = sessionStorage.getItem("rs_id"); if (s) return s; } catch (e) { /* 무시 */ }
    const id = randomId(10);
    try { sessionStorage.setItem("rs_id", id); } catch (e) { /* 무시 */ }
    return id;
  })();
  let code = null;
  let myNick = "";
  let asTeacher = false;
  let room = null;
  let unsubRoom = null, unsubPos = null;
  let roomHandler = () => {}, posHandler = () => {};
  const botIds = new Set();

  function init() {
    const cfg = typeof FIREBASE_CONFIG !== "undefined" ? FIREBASE_CONFIG : {};
    if (cfg.apiKey && cfg.databaseURL && typeof firebase !== "undefined") {
      try {
        if (!firebase.apps.length) firebase.initializeApp(cfg);
        store = createFirebaseStore(firebase.database());
      } catch (e) {
        console.error("Firebase 연결 실패 → 이 컴퓨터 안 모드로 실행", e);
        store = null;
      }
    }
    if (!store) store = createLocalStore();
    // 다시 연결되었는데 내 정보가 방에서 지워져 있으면 되살리기
    let wasConnected = true;
    store.onConnected((connected) => {
      if (connected && !wasConnected && code) heal();
      wasConnected = connected;
    });
  }

  // 마지막으로 들어간 방 기억 (다시 들어오기용)
  let myColor = null;
  function saveSession() {
    SafeStore.set("rs_last", { id: myId, code, nick: myNick, teacher: asTeacher, color: myColor, t: Date.now() });
  }
  function lastSession() {
    const s = SafeStore.get("rs_last", null);
    return s && s.code && Date.now() - s.t < 3 * 3600 * 1000 ? s : null;
  }

  // 방에서 내 정보가 사라졌을 때(연결 끊김) 명단에 있던 정보로 되살림
  //  ▸ 스스로 「대기방으로 나가기」를 한 학생(gone = "left")은 게임으로 되돌리지 않음
  let healing = 0;
  function heal() {
    if (!code || !room || Date.now() - healing < 2000) return false;
    if (asTeacher) {
      healing = Date.now();
      store.update(roomPath(), { [`teachers/${myId}`]: { t: store.now() } });
      store.onDisconnectRemove(`${roomPath()}/teachers/${myId}`);
      return true;
    }
    const info = (room.members && room.members[myId]) || (room.players && room.players[myId]);
    if (!info) return false;
    healing = Date.now();
    const p = { nick: info.nick, color: info.color == null ? null : info.color, joinedAt: info.joinedAt };
    const upd = { [`players/${myId}`]: p };
    if (!(room.gone && room.gone[myId] === "left")) upd[`gone/${myId}`] = null;
    store.update(roomPath(), upd);
    store.onDisconnectRemove(`${roomPath()}/players/${myId}`);
    store.onDisconnectRemove(`${posPath()}/${myId}`);
    return true;
  }

  // 진행 중인 게임으로 다시 들어가기 (학생: 같은 색 그대로 · 교사: 교사로 다시)
  async function rejoinRoom(c, id) {
    const r = await store.get(roomPath(c));
    if (!r || !r.meta || r.meta.closed) throw new Error("그 방이 없어졌어요.");
    if (r.meta.teacherId === id) {
      myId = id;
      try { sessionStorage.setItem("rs_id", id); } catch (e) { /* 무시 */ }
      myNick = "선생님";
      asTeacher = true;
      await store.update(roomPath(c), { [`teachers/${id}`]: { t: store.now() } });
      attach(c);
      return;
    }
    let info = (r.members && r.members[id]) || (r.players && r.players[id]);
    if (r.kicked && r.kicked[id]) throw new Error("선생님이 방에서 내보냈어요.");
    // 대기방에서 새로고침한 경우: 같은 닉네임으로 다시 참가 (전에 쓰던 색이 비어 있으면 그 색 그대로)
    const last = lastSession();
    if (!info && r.meta.state === "LOBBY" && last && last.id === id && last.code === c && last.nick) {
      const list = Object.values(r.players || {});
      if (list.length >= CONFIG.MAX_PLAYERS) throw new Error(`방이 가득 찼어요. (최대 ${CONFIG.MAX_PLAYERS}명)`);
      if (list.some((p) => p.nick === last.nick)) throw new Error("같은 닉네임이 이미 있어요.");
      const free = last.color != null && !list.some((p) => p.color === last.color);
      info = { nick: last.nick, color: free ? last.color : null, joinedAt: store.now() };
    }
    if (!info) throw new Error("이 방에 참가했던 기록이 없어요.");
    if (r.players && r.players[id] && id !== myId) throw new Error("이미 다른 화면에서 참가 중이에요.");
    myId = id;
    try { sessionStorage.setItem("rs_id", id); } catch (e) { /* 무시 */ }
    myNick = info.nick;
    asTeacher = false;
    const upd = { [`players/${id}`]: { nick: info.nick, color: info.color == null ? null : info.color, joinedAt: info.joinedAt } };
    if (!(r.gone && r.gone[id] === "left")) upd[`gone/${id}`] = null;
    await store.update(roomPath(c), upd);
    attach(c);
  }

  const roomPath = (c = code) => `${ROOT}/rooms/${c}`;
  const posPath = (c = code) => `${ROOT}/pos/${c}`;

  // ─────────────────────────────────────────────────────────────
  // 캐릭터 색 자동 배정 (방장 = 교사 화면이 정해서 모두에게 같은 값으로 동기화)
  //  ▸ 지금 방에서 쓰고 있는 색을 빼고 남은 색 가운데 무작위
  //  ▸ 나간 학생의 색은 다시 쓸 수 있음 · 다시 들어온 학생은 원래 색 그대로
  // ─────────────────────────────────────────────────────────────
  function usedColors(r, exceptId) {
    const used = new Set();
    const add = (list) => Object.keys(list || {}).forEach((id) => {
      if (id === exceptId) return;
      if (r.gone && r.gone[id] && !(r.players && r.players[id])) return;   // 완전히 나간 학생의 색은 다시 사용 가능
      const c = list[id] && list[id].color;
      if (c != null && c >= 0) used.add(Number(c));
    });
    add(r.players);
    add(r.members);   // 게임 중 잠깐 끊긴 학생의 색도 지켜 줌
    return used;
  }
  function randomFreeColor(used) {
    const free = PLAYER_COLORS.map((c) => c.id).filter((id) => !used.has(id));
    if (!free.length) return null;
    return free[Math.floor(Math.random() * free.length)];
  }
  // 색이 없는(또는 겹친) 플레이어에게 색 정하기 → roomUpdate 용 객체
  //  먼저 들어온 사람의 색을 지키고, 색이 없거나 겹친 사람만 새로 배정
  function colorUpdates(r) {
    const upd = {};
    if (!r || !r.players) return upd;
    const ids = Object.keys(r.players).sort((a, b) => (r.players[a].joinedAt || 0) - (r.players[b].joinedAt || 0));
    const seen = new Set();
    // 게임 중 잠깐 끊긴 학생(명단에는 있고 접속은 끊김)의 색도 지켜 줌
    Object.keys(r.members || {}).forEach((id) => {
      if (r.players[id] || (r.gone && r.gone[id])) return;
      const c = r.members[id].color;
      if (c != null && c >= 0) seen.add(Number(c));
    });
    const need = [];
    ids.forEach((id) => {
      const c = r.players[id].color;
      if (c != null && PLAYER_COLORS[c] && !seen.has(Number(c))) seen.add(Number(c));
      else need.push(id);
    });
    need.forEach((id) => {
      const pick = randomFreeColor(seen);
      if (pick == null) return;
      seen.add(pick);
      upd[`players/${id}/color`] = pick;
    });
    return upd;
  }

  // ─────────────────────────────────────────────────────────────
  // 방 만들기 (교사만) · 참가 (학생)
  // ─────────────────────────────────────────────────────────────
  async function createRoom(settings) {
    for (let tries = 0; tries < 15; tries++) {
      const c = String(1000 + Math.floor(Math.random() * 9000));
      const existing = await store.get(roomPath(c));
      const alive = existing && existing.meta && !existing.meta.closed &&
        ((existing.players && Object.keys(existing.players).length > 0) || (existing.teachers && Object.keys(existing.teachers).length > 0));
      const fresh = existing && existing.meta && store.now() - (existing.meta.createdAt || 0) < 6 * 3600 * 1000;
      if (alive && fresh) continue;
      const now = store.now();
      await store.remove(posPath(c));
      await store.set(roomPath(c), {
        meta: { hostId: myId, teacherId: myId, state: "LOBBY", createdAt: now, round: 0 },
        settings: settings,
        teachers: { [myId]: { t: now } },
      });
      myNick = "선생님";
      asTeacher = true;
      attach(c);
      return c;
    }
    throw new Error("방 번호를 만들지 못했어요. 다시 눌러 주세요.");
  }

  function roomAlive(r) {
    if (!r || !r.meta || r.meta.closed) return false;
    if (r.meta.teacherId) return true;
    return !!(r.players && Object.keys(r.players).length > 0);
  }

  async function joinRoom(c, nick) {
    const r = await store.get(roomPath(c));
    if (!roomAlive(r)) throw new Error("그 번호의 방이 없어요.");
    if (r.meta.state !== "LOBBY") throw new Error("이미 게임이 시작된 방이에요.");
    const list = Object.values(r.players || {});
    if (list.length >= CONFIG.MAX_PLAYERS) throw new Error(`방이 가득 찼어요. (최대 ${CONFIG.MAX_PLAYERS}명)`);
    if (list.some((p) => p.nick === nick)) throw new Error("같은 닉네임이 이미 있어요. 다른 닉네임을 써 주세요.");
    // 색은 비워 두고 들어감 → 방장(교사) 화면이 남은 색 가운데 하나를 정해 줌
    const me = { nick, color: null, joinedAt: store.now() };
    if (DEBUG_MODE) { const dr = SafeStore.get("rs_debug_role", "auto"); if (dr && dr !== "auto") me.debugRole = dr; }
    await store.update(roomPath(c), { [`players/${myId}`]: me, [`kicked/${myId}`]: null, [`gone/${myId}`]: null });
    myNick = nick;
    asTeacher = false;
    attach(c);
  }

  function attach(c) {
    detach();
    if (code !== c) myColor = null;
    code = c;
    saveSession();
    if (asTeacher) {
      store.onDisconnectRemove(`${roomPath()}/teachers/${myId}`);
    } else {
      store.onDisconnectRemove(`${roomPath()}/players/${myId}`);
      store.onDisconnectRemove(`${posPath()}/${myId}`);
      store.onDisconnectRemove(`${roomPath()}/ready/${myId}`);
    }
    unsubRoom = store.on(roomPath(), (v) => {
      room = v;
      // 내 색을 기억 (새로고침해도 같은 색으로 돌아오도록)
      const c = v && v.players && v.players[myId] && v.players[myId].color;
      if (c != null && c !== myColor) { myColor = c; saveSession(); }
      roomHandler(v);
    });
    unsubPos = store.on(posPath(), (v) => posHandler(v || {}));
  }

  function detach() {
    if (unsubRoom) unsubRoom();
    if (unsubPos) unsubPos();
    unsubRoom = unsubPos = null;
  }

  // keepSession: 새로고침·탭 닫힘처럼 "다시 들어올 수 있는" 나가기
  async function leaveRoom(keepSession = false) {
    if (!code) return;
    const c = code;
    detach();
    if (!keepSession) SafeStore.set("rs_last", null);
    const tasks = [
      store.remove(`${roomPath(c)}/players/${myId}`),
      store.remove(`${posPath(c)}/${myId}`),
      store.remove(`${roomPath(c)}/ready/${myId}`),
    ];
    if (asTeacher) tasks.push(store.remove(`${roomPath(c)}/teachers/${myId}`));
    // 스스로 나가기(게임 중): 60초 기다리지 않고 바로 계산에서 빼기
    if (!keepSession && !asTeacher && room && room.members && room.members[myId] && room.meta && room.meta.state !== "LOBBY") {
      tasks.push(store.update(roomPath(c), { [`gone/${myId}`]: "left" }));
    }
    botIds.forEach((id) => {
      tasks.push(store.remove(`${roomPath(c)}/players/${id}`), store.remove(`${posPath(c)}/${id}`));
    });
    botIds.clear();
    store.cancelDisconnect(`${roomPath(c)}/players/${myId}`);
    store.cancelDisconnect(`${posPath(c)}/${myId}`);
    store.cancelDisconnect(`${roomPath(c)}/ready/${myId}`);
    store.cancelDisconnect(`${roomPath(c)}/teachers/${myId}`);
    code = null;
    room = null;
    asTeacher = false;
    try { await Promise.all(tasks); } catch (e) { /* 무시 */ }
  }

  // 게임 중 「대기방으로 나가기」: 이번 판에서만 빠지고, 방에는 남아 다음 게임을 기다림
  function leaveRound() {
    if (!code || asTeacher) return Promise.resolve();
    store.remove(`${posPath()}/${myId}`);
    return roomUpdate({ [`gone/${myId}`]: "left", [`ready/${myId}`]: null });
  }

  // 교사: 학생 내보내기
  function kick(id) {
    if (!code || !asTeacher) return Promise.resolve();
    store.remove(`${posPath()}/${id}`);
    const upd = { [`players/${id}`]: null, [`ready/${id}`]: null, [`kicked/${id}`]: true };
    if (room && room.members && room.members[id]) upd[`gone/${id}`] = "left";
    botIds.delete(id);
    return roomUpdate(upd);
  }

  // 교사: 방 닫기 (모든 학생이 메인 화면으로)
  async function closeRoom() {
    if (!code || !asTeacher) return;
    const c = code;
    detach();
    SafeStore.set("rs_last", null);
    store.cancelDisconnect(`${roomPath(c)}/teachers/${myId}`);
    botIds.clear();
    code = null; room = null; asTeacher = false;
    try { await store.remove(posPath(c)); await store.remove(roomPath(c)); } catch (e) { /* 무시 */ }
  }

  // 방 전체 여러 곳을 한 번에 수정 (키에 "meta/state" 처럼 경로를 써도 됨)
  function roomUpdate(obj) {
    if (!code) return Promise.resolve();
    return store.update(roomPath(), obj);
  }

  function setMe(fields) {
    if (!code || asTeacher) return Promise.resolve();
    const obj = {};
    Object.keys(fields).forEach((k) => { obj[`players/${myId}/${k}`] = fields[k]; });
    return roomUpdate(obj);
  }

  function sendPos(id, p) {
    if (!code) return;
    store.set(`${posPath()}/${id}`, p);
  }

  function removePath(sub) { if (code) return store.remove(`${roomPath()}/${sub}`); }

  // ── 봇 (DEBUG_MODE 테스트용) ──
  function addBot(players) {
    if (!code) return;
    const id = "bot_" + randomId(5);
    const n = Object.keys(players || {}).length;
    const obj = {};
    obj[`players/${id}`] = { nick: "봇" + (n + 1), color: randomFreeColor(usedColors(room || { players })), joinedAt: store.now(), bot: true };
    botIds.add(id);
    store.onDisconnectRemove(`${roomPath()}/players/${id}`);
    store.onDisconnectRemove(`${posPath()}/${id}`);
    return roomUpdate(obj);
  }

  function removeBots(players) {
    const obj = {};
    Object.keys(players || {}).forEach((id) => {
      if (players[id].bot) { obj[`players/${id}`] = null; store.remove(`${posPath()}/${id}`); }
    });
    botIds.clear();
    return roomUpdate(obj);
  }

  return {
    init, createRoom, joinRoom, rejoinRoom, leaveRoom, leaveRound, kick, closeRoom, lastSession, heal, roomUpdate, setMe, sendPos, removePath,
    addBot, removeBots, colorUpdates,
    onRoom: (fn) => { roomHandler = fn; },
    onPos: (fn) => { posHandler = fn; },
    now: () => (store ? store.now() : Date.now()),
    get mode() { return store ? store.kind : "local"; },
    get myId() { return myId; },
    get code() { return code; },
    get room() { return room; },
    get isHost() { return !!(room && room.meta && room.meta.hostId === myId); },
    get isTeacher() { return asTeacher && !!(room && room.meta && room.meta.teacherId === myId); },
    get asTeacher() { return asTeacher; },
  };
})();
