/* =====================================================================
   utils.js — 여러 파일에서 함께 쓰는 작은 도구 함수
   ===================================================================== */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

function randomId(len = 10) {
  const chars = "abcdefghijkmnpqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function formatTime(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  return String(m).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
}

// 색을 어둡게/밝게 (amt: -1 ~ 1)
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const t = amt < 0 ? 0 : 255, p = Math.abs(amt);
  r = Math.round((t - r) * p + r);
  g = Math.round((t - g) * p + g);
  b = Math.round((t - b) * p + b);
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

// 색 번호 → 색 정보. 아직 색을 배정받지 못한 플레이어(null)는 회색으로 보입니다.
const NO_COLOR = { id: -1, name: "배정 중", hex: "#8a93a6" };
function colorOf(id) {
  if (id == null || id === "") return NO_COLOR;
  return PLAYER_COLORS[id] || NO_COLOR;
}

// 방 설정 (저장된 값 + 기본값). 예전 방식(mode: "quick")으로 저장된 값도 읽을 수 있게 합니다.
function normalizeSettings(raw) {
  raw = raw || {};
  const s = { ...DEFAULT_SETTINGS, ...raw };
  if (raw.mode === "quick" && raw.quick === undefined) s.quick = true;
  delete s.mode;
  if (!GAME_MODES[s.gameMode]) s.gameMode = DEFAULT_SETTINGS.gameMode;
  return s;
}
function roomSettings(room) { return normalizeSettings(room && room.settings); }

// 저장소가 막힌 환경(시크릿 창 등)에서도 오류 없이 동작하도록 감쌉니다.
const SafeStore = {
  get(key, fallback = null) {
    try {
      const v = localStorage.getItem(key);
      return v == null ? fallback : JSON.parse(v);
    } catch (e) { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* 무시 */ }
  },
};

// 화면 아래쪽 짧은 알림
let toastTimer = null;
function toast(msg, ms = 2600) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), ms);
}

const IS_TOUCH = (() => {
  try {
    return window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
  } catch (e) { return false; }
})();
