/* =====================================================================
   config.js — 게임 설정값 모음
   숫자만 바꾸면 게임 밸런스를 조절할 수 있습니다.
   ===================================================================== */

// 개발 중 테스트 기능 (역할 보기, 봇 추가, 시간 조절 등)
// 학생들과 실제로 할 때는 false 로 바꾸세요.
const DEBUG_MODE = true;

const CONFIG = {
  GAME_TITLE: "멈춰버린 학교",
  GAME_SUBTITLE: "비례식의 비밀",

  // ── 인원 ──
  MAX_PLAYERS: 10,
  MIN_PLAYERS: 4,            // DEBUG_MODE 에서는 1명도 시작 가능

  // ── 화면 진행 시간 (밀리초) ──
  ROLE_REVEAL_MS: 3500,      // 역할 공개
  STORY_TIMEOUT_MS: 40000,   // 스토리 화면 최대 대기 (모두 준비하면 바로 넘어감)
  COUNTDOWN_MS: 3000,        // 3초 카운트다운

  // ── 이동 ──
  SPEED_BASE: 170,           // 초당 이동 거리(px)
  SPEED_MULT: { slow: 0.85, normal: 1, fast: 1.15 },
  PLAYER_RADIUS: 14,         // 충돌 판정 반지름

  // ── 시야 ──
  VISION_RADIUS: 270,        // 학생 시야 반지름
  GHOST_VISION_RADIUS: 420,  // 유령 시야 (다음 단계)
  DARKNESS: 0.72,            // 시야 밖 어두운 정도 (0~1)

  // ── 네트워크 ──
  POS_SEND_HZ: 10,           // 위치 전송 횟수(초당)
  HEARTBEAT_MS: 3000,
  LOCAL_STALE_MS: 90000,     // (이 컴퓨터 안 모드) 이 시간 동안 소식이 없으면 나간 것으로 처리
  REJOIN_GRACE_SEC: 60,      // 게임 중 연결이 끊겨도 이 시간 안에 돌아오면 그대로 계속 (넘으면 미션·승패 계산에서 빠짐)

  // ── 게임 종료 (4단계) ──
  ENDING_MS: 2600,           // 조명이 차례로 켜지거나 꺼지는 연출
  RESULT_AFTER_MS: 5600,     // 게임 종료 후 「나의 수학 기록」으로 넘어가기까지 (연출 + 약 3초)

  // ── 미션 (2단계) ──
  MISSION_TIME_LIMIT: { 1: 60, 2: 50, 3: 45, quick: 40 }, // 난이도별 미션 제한 시간(초)
  WRONG_LOCK_SEC: 5,         // 오답 뒤 입력 잠금
  MISSION_RETRY_SEC: 10,     // 시간 초과 뒤 다시 도전까지
  MISSION_RANGE: 64,         // 장치에 이만큼 가까이 가면 [미션] 버튼이 켜짐
  MISSION_HINT_RANGE: 1000,  // 이 거리 안의 가장 가까운 미션만 화면 가장자리 화살표로 안내
  SUCCESS_SHOW_MS: 1300,     // 「미션 완료!」 표시 시간

  // ── 방해꾼 능력 (3단계 · 3차 설계 13~16번) ──
  ABILITIES: {
    blackout: { duration: 8, cooldown: 40, first: 15 },   // first: 게임 시작 후 처음 쓸 수 있을 때까지(초)
    freeze:   { duration: 3, cooldown: 30, first: 10, range: 100 },
    lockDoor: { duration: 7, cooldown: 45, first: 15 },
    disguise: { duration: 10, uses: 2 },
  },
  BLACKOUT_VISION: 0.35,     // 정전 때 학생 시야 (원래의 35%)
  BLACKOUT_DARKNESS: 0.85,   // 정전 때 어두운 정도
  REPORT_RANGE: 110,         // 얼어 있는 학생에게 이만큼 가까우면 [신고]
  REPORT_AFTER_MELT: 5,      // 얼음이 녹은 뒤에도 이 시간(초) 동안은 신고 가능
  AFTER_MEETING_COOLDOWN: 10,// 회의가 끝난 뒤 방해꾼 능력 대기(초)

  // ── 긴급회의 (3단계 · 3차 설계 18~21번) ──
  MEETING: { discuss: 25, vote: 15, result: 3.5 },
  MEETING_PER_PLAYER: 1,     // 플레이어당 긴급회의 버튼 사용 횟수 (신고는 따로)
  EMERGENCY: { x: 1160, y: 950, range: 95 },  // 중앙 복도 긴급회의 버튼 위치
};

// 방장이 바꿀 수 있는 기본 설정 (교사용 설정에서 기본값을 바꿀 수 있음)
const DEFAULT_SETTINGS = {
  mode: "normal",        // normal | quick
  gameMinutes: 12,       // 8 | 10 | 12 | 15
  saboteurs: "auto",     // auto | 1 | 2 | 3
  speed: "normal",       // slow | normal | fast
  missionCount: 5,       // 3 | 5 | 7
  difficulty: 2,         // 1 쉬움 | 2 보통 | 3 어려움
  meetingLimit: 3,       // 게임 전체 긴급회의 횟수
  blackout: true,
  lockDoor: true,
  disguise: true,
  freeze: true,
  coop: false,           // 협동 모드: 자기 미션을 끝낸 학생이 친구 미션을 도울 수 있음
  revealRole: true,      // 투표로 제외된 사람이 방해꾼이었는지 공개
};

const MODE_PRESETS = {
  normal: { gameMinutes: 12, missionCount: 5, meetingLimit: 3 },
  quick:  { gameMinutes: 8,  missionCount: 3, meetingLimit: 2 },
};

// 플레이어 색 (10명) — 색 이름을 함께 써서 색만으로 구별하지 않게 합니다.
const PLAYER_COLORS = [
  { id: 0, name: "빨강", hex: "#e5484d" },
  { id: 1, name: "파랑", hex: "#3e7bfa" },
  { id: 2, name: "초록", hex: "#30a46c" },
  { id: 3, name: "노랑", hex: "#f5c400" },
  { id: 4, name: "주황", hex: "#f76b15" },
  { id: 5, name: "보라", hex: "#8e4ec6" },
  { id: 6, name: "분홍", hex: "#e93d82" },
  { id: 7, name: "하늘", hex: "#38bdd8" },
  { id: 8, name: "라임", hex: "#8fcf1f" },
  { id: 9, name: "갈색", hex: "#a0785a" },
];

// 인원에 따른 방해꾼 추천 수 (4~7명: 1명, 8~10명: 2명)
function recommendSaboteurs(n) {
  return n >= 8 ? 2 : 1;
}

const STORY_LINES = [
  "밤이 된 학교에서 갑자기 모든 전기가 꺼졌다.",
  "교실의 컴퓨터도, 방송실도,",
  "과학실 장비도 모두 멈춰버렸다.",
  "학교 시스템을 다시 작동시키려면",
  "학교 곳곳에 숨겨진 비례식 문제를 해결해야 한다.",
  "하지만 우리 가운데 누군가가",
  "복구를 방해하고 있다.",
  "모든 미션을 해결하고 학교의 시간을 다시 움직여라!",
];
