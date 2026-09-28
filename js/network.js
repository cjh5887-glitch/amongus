/* =====================================================================
   network.js — 방 만들기 · 참가 · 실시간 동기화

   두 가지 방식을 같은 함수로 사용합니다.
     ▸ 온라인 모드   : firebase-config.js 를 채우면 Firebase Realtime Database 사용
     ▸ 이 컴퓨터 안  : 설정이 비어 있으면 브라우저 저장소(localStorage) 사용
                       → 같은 브라우저의 여러 탭끼리 함께 테스트할 수 있어요.

   데이터 구조
     ratioSchool/rooms/{방번호}/
        meta     { hostId, state, phaseEndsAt, createdAt, round }
        settings { 방장 설정 }
        players/{id} { nick, color, joinedAt, bot? }
        roles/{id}   "student" | "saboteur"
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
  function saveSession() {
    SafeStore.set("rs_last", { id: myId, code, nick: myNick, t: Date.now() });
  }
  function lastSession() {
    const s = SafeStore.get("rs_last", null);
    return s && s.code && Date.now() - s.t < 3 * 3600 * 1000 ? s : null;
  }

  // 방에서 내 정보가 사라졌을 때(연결 끊김) 명단에 있던 정보로 되살림
  let healing = 0;
  function heal() {
    if (!code || !room || Date.now() - healing < 2000) return false;
    const info = (room.members && room.members[myId]) || (room.players && room.players[myId]);
    if (!info) return false;
    healing = Date.now();
    const p = { nick: info.nick, color: info.color, joinedAt: info.joinedAt };
    store.update(roomPath(), { [`players/${myId}`]: p, [`gone/${myId}`]: null });
    store.onDisconnectRemove(`${roomPath()}/players/${myId}`);
    store.onDisconnectRemove(`${posPath()}/${myId}`);
    return true;
  }

  // 진행 중인 게임으로 다시 들어가기
  async function rejoinRoom(c, id) {
    const r = await store.get(roomPath(c));
    if (!r || !r.meta) throw new Error("그 방이 없어졌어요.");
    const info = (r.members && r.members[id]) || (r.players && r.players[id]);
    if (!info) throw new Error("이 방에 참가했던 기록이 없어요.");
    if (r.players && r.players[id] && id !== myId) throw new Error("이미 다른 화면에서 참가 중이에요.");
    myId = id;
    try { sessionStorage.setItem("rs_id", id); } catch (e) { /* 무시 */ }
    myNick = info.nick;
    await store.update(roomPath(c), { [`players/${id}`]: { nick: info.nick, color: info.color, joinedAt: info.joinedAt }, [`gone/${id}`]: null });
    attach(c);
  }

  const roomPath = (c = code) => `${ROOT}/rooms/${c}`;
  const posPath = (c = code) => `${ROOT}/pos/${c}`;

  function pickColor(players) {
    const used = new Set(Object.values(players || {}).map((p) => p.color));
    for (const c of PLAYER_COLORS) if (!used.has(c.id)) return c.id;
    return 0;
  }

  async function createRoom(nick, settings) {
    for (let tries = 0; tries < 15; tries++) {
      const c = String(1000 + Math.floor(Math.random() * 9000));
      const existing = await store.get(roomPath(c));
      const alive = existing && existing.players && Object.keys(existing.players).length > 0;
      const fresh = existing && existing.meta && store.now() - (existing.meta.createdAt || 0) < 6 * 3600 * 1000;
      if (alive && fresh) continue;
      const now = store.now();
      await store.remove(posPath(c));
      await store.set(roomPath(c), {
        meta: { hostId: myId, state: "LOBBY", createdAt: now, round: 0 },
        settings: settings,
        players: { [myId]: { nick, color: 0, joinedAt: now } },
      });
      myNick = nick;
      attach(c);
      return c;
    }
    throw new Error("방 번호를 만들지 못했어요. 다시 눌러 주세요.");
  }

  async function joinRoom(c, nick) {
    const r = await store.get(roomPath(c));
    if (!r || !r.meta || !r.players || Object.keys(r.players).length === 0) throw new Error("그 번호의 방이 없어요.");
    if (r.meta.state !== "LOBBY") throw new Error("이미 게임이 시작된 방이에요.");
    const list = Object.values(r.players);
    if (list.length >= CONFIG.MAX_PLAYERS) throw new Error(`방이 가득 찼어요. (최대 ${CONFIG.MAX_PLAYERS}명)`);
    if (list.some((p) => p.nick === nick)) throw new Error("같은 닉네임이 이미 있어요. 다른 닉네임을 써 주세요.");
    await store.set(`${roomPath(c)}/players/${myId}`, { nick, color: pickColor(r.players), joinedAt: store.now() });
    myNick = nick;
    attach(c);
  }

  function attach(c) {
    detach();
    code = c;
    saveSession();
    store.onDisconnectRemove(`${roomPath()}/players/${myId}`);
    store.onDisconnectRemove(`${posPath()}/${myId}`);
    store.onDisconnectRemove(`${roomPath()}/ready/${myId}`);
    unsubRoom = store.on(roomPath(), (v) => { room = v; roomHandler(v); });
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
    botIds.forEach((id) => {
      tasks.push(store.remove(`${roomPath(c)}/players/${id}`), store.remove(`${posPath(c)}/${id}`));
    });
    botIds.clear();
    store.cancelDisconnect(`${roomPath(c)}/players/${myId}`);
    store.cancelDisconnect(`${posPath(c)}/${myId}`);
    store.cancelDisconnect(`${roomPath(c)}/ready/${myId}`);
    code = null;
    room = null;
    try { await Promise.all(tasks); } catch (e) { /* 무시 */ }
  }

  // 방 전체 여러 곳을 한 번에 수정 (키에 "meta/state" 처럼 경로를 써도 됨)
  function roomUpdate(obj) {
    if (!code) return Promise.resolve();
    return store.update(roomPath(), obj);
  }

  function setMe(fields) {
    if (!code) return Promise.resolve();
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
    obj[`players/${id}`] = { nick: "봇" + (n + 1), color: pickColor(players), joinedAt: store.now(), bot: true };
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
    init, createRoom, joinRoom, rejoinRoom, leaveRoom, lastSession, heal, roomUpdate, setMe, sendPos, removePath,
    addBot, removeBots,
    onRoom: (fn) => { roomHandler = fn; },
    onPos: (fn) => { posHandler = fn; },
    now: () => (store ? store.now() : Date.now()),
    get mode() { return store ? store.kind : "local"; },
    get myId() { return myId; },
    get code() { return code; },
    get room() { return room; },
    get isHost() { return !!(room && room.meta && room.meta.hostId === myId); },
  };
})();
