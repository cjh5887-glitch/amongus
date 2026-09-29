/* =====================================================================
   config.js — 게임 설정값 모음
   숫자만 바꾸면 게임 밸런스를 조절할 수 있습니다.
   ===================================================================== */

// 개발 중 테스트 기능 (역할 보기, 봇 추가, 시간 조절 등)
// 학생들과 실제로 할 때는 false 로 바꾸세요.
const DEBUG_MODE = true;

// ★ 교사 PIN — [교사용] 버튼을 누르고 이 번호를 넣어야 방을 만들 수 있어요.
//   (GitHub Pages 에 올리면 누구나 이 파일을 볼 수 있으므로 강한 보안이 아니라
//    "학생이 실수로 방을 만들지 않게 하는 수업용 잠금"입니다. 숫자만 바꿔서 쓰세요.)
const TEACHER_PIN = "1234";

// 게임 모드 (하나의 게임 엔진 · 규칙만 다름)
const GAME_MODES = { FREEZE_TAG: "FREEZE_TAG", AMONG_US: "AMONG_US" };

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
  HOST_STALE_MS: 9000,       // 방장(심판) 화면의 신호가 이만큼 끊기면 다른 화면이 심판을 이어받음
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
    lockDoor: { duration: 7, cooldown: 45, first: 15 },
    disguise: { duration: 10, uses: 2 },
  },
  BLACKOUT_VISION: 0.35,     // 정전 때 학생 시야 (원래의 35%)
  BLACKOUT_DARKNESS: 0.85,   // 정전 때 어두운 정도
  REPORT_RANGE: 110,         // (어몽어스) 얼음 흔적에 이만큼 가까우면 [신고]
  AFTER_MEETING_COOLDOWN: 10,// 회의가 끝난 뒤 방해꾼 능력 대기(초)

  // ── 긴급회의 (3단계 · 3차 설계 18~21번) ──
  MEETING: { discuss: 25, vote: 15, result: 3.5 },
  MEETING_PER_PLAYER: 1,     // 플레이어당 긴급회의 버튼 사용 횟수 (신고는 따로)
  EMERGENCY: { x: 1160, y: 950, range: 95 },  // 중앙 복도 긴급회의 버튼 위치

  // ── 얼음땡 모드 ──
  FREEZE_TAG: {
    TAG_RANGE: 70,           // 술래가 학생에게 이만큼 가까우면 [잡기]
    RESCUE_RANGE: 80,        // 얼어 있는 친구에게 이만큼 가까우면 [땡]
    FIRST_TAG_SEC: 8,        // 게임 시작 후 술래가 처음 잡을 수 있을 때까지 (학생이 흩어질 시간)
  },

  // ── 어몽어스 모드 ──
  AMONG_US: {
    FREEZE_RANGE: 100,       // 방해꾼이 학생에게 이만큼 가까우면 [얼리기]
    FIRST_FREEZE_SEC: 15,    // 게임 시작 후 처음 얼리기까지
    AFTER_MEETING_FREEZE_SEC: 15, // 회의가 끝난 뒤 얼리기 대기
    FREEZE_ANIM_MS: 1200,    // 얼음에 갇히는 연출 시간
  },
};

// 교사가 방을 만들 때 고르는 설정 (교사용 화면에서 고른 값이 다음 방의 기본값이 됨)
const DEFAULT_SETTINGS = {
  // ── 공통 ──
  gameMode: "FREEZE_TAG",// FREEZE_TAG(얼음땡) | AMONG_US(어몽어스)
  gameMinutes: 12,       // 8 | 10 | 12 | 15
  missionCount: 5,       // 3 | 5 | 7
  difficulty: 2,         // 1 쉬움 | 2 보통 | 3 어려움
  // ── 얼음땡 ──
  taggers: "auto",       // auto | 1 | 2 | 3   술래 수
  taggerSpeed: 1.1,      // 1 | 1.1 | 1.2      술래 속도 (학생 속도의 몇 배)
  tagCooldown: 7,        // 5 | 7 | 10         잡기 쿨타임(초)
  rescueHold: 1,         // 1 | 1.5 | 2        땡 시간(초, 누르고 있기)
  protectSec: 5,         // 3 | 5 | 7          땡 후 보호 시간(초)
  // ── 어몽어스 ──
  saboteurs: "auto",     // auto | 1 | 2 | 3
  saboteurPick: "random",// random(랜덤 배정) | teacher(교사 직접 지정 — 고른 학생은 교사 화면에만 저장)
  freezeCooldown: 25,    // 20 | 25 | 30 | 35  얼리기 쿨타임(초)
  blackout: true,
  lockDoor: true,
  disguise: true,
  meetingLimit: 3,       // 게임 전체 긴급회의 횟수
  revealRole: true,      // 투표로 제외된 사람이 방해꾼이었는지 공개
  // ── 추가 설정 (두 모드 공통) ──
  quick: false,          // 빠른 게임 (시간·미션·회의 수를 줄이고 미션 제한 시간 40초)
  speed: "normal",       // slow | normal | fast   전체 이동 속도
  coop: false,           // 협동 모드: 자기 미션을 끝낸 학생이 친구 미션을 도울 수 있음
};

// 빠른 게임 켬/끔에 따라 함께 바뀌는 값
const MODE_PRESETS = {
  normal: { gameMinutes: 12, missionCount: 5, meetingLimit: 3 },
  quick:  { gameMinutes: 8,  missionCount: 3, meetingLimit: 2 },
};

// 소리 파일 (선택) — assets/sounds/ 에 mp3 를 넣고 아래에 이름을 적으면 그 파일로 재생합니다.
// 적지 않은 소리는 게임 안에서 만든 소리(합성음)로 재생되므로 파일이 없어도 괜찮아요.
// 예) correct: "assets/sounds/correct.mp3",   bgm_game: "assets/sounds/game.mp3"
const AUDIO_FILES = {
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
  { id: 8, name: "연두", hex: "#8fcf1f" },
  { id: 9, name: "갈색", hex: "#a0785a" },
];

// 인원에 따른 방해꾼 추천 수 (4~7명: 1명, 8~10명: 2명)
function recommendSaboteurs(n) {
  return n >= 8 ? 2 : 1;
}

// 인원에 따른 술래 추천 수 (4~6명: 1명, 7~10명: 2명)
function recommendTaggers(n) {
  return n >= 7 ? 2 : 1;
}

// 어몽어스 모드 스토리
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

// 얼음땡 모드 스토리
const STORY_LINES_FT = [
  "밤이 된 학교에서 갑자기 모든 전기가 꺼졌다.",
  "교실의 컴퓨터도, 방송실도,",
  "과학실 장비도 모두 멈춰버렸다.",
  "학교 시스템을 다시 작동시키려면",
  "학교 곳곳에 숨겨진 비례식 문제를 해결해야 한다.",
  "그런데 어둠 속에서 「얼음 술래」가 돌아다닌다!",
  "잡히면 얼음! 친구가 「땡」 해 주면 다시 움직일 수 있다.",
  "모든 미션을 해결하고 학교의 시간을 다시 움직여라!",
];
