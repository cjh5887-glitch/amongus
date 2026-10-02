/* =====================================================================
   questions.js — 문제은행 (비례식 30 + 비례배분 30 = 60문제)
   선생님이 문제를 추가·수정할 때는 이 파일만 고치면 됩니다.
   ---------------------------------------------------------------------
   [장소(location) · 미션(missionType)]
     computer  · power     전력 회로 복구        비례식
     science   · liquid    과학실 용액 배합       비례식
     cafeteria · recipe    급식실 레시피 복구     비례식
     cafeteria · juice     과일 주스 만들기       비례식
     broadcast · volume    방송실 음량 조절       비례식
     office    · evacmap   비상 대피 지도         비례식
     nurse     · water     보건실 물 공급         비례식(소수)
     library   · books     도서관 책 정리         비례배분
     gym       · teams     체육관 팀 편성         비례배분
     classroom · supplies  교실 준비물 나누기     비례배분
   ---------------------------------------------------------------------
   [공통 항목]
     difficulty  : 1 쉬움 · 2 보통 · 3 어려움
     question    : 문제 문장 (전체 문장)
     lines       : 미션 화면에 보여줄 짧은 문장 2~3줄 (5초 안에 이해되게)
     labels      : 미니게임 화면에 표시할 이름
     answer      : 정답
     unit        : 단위 (없으면 "")
     hint        : 두 번째 오답 때 보여줄 힌트
     steps       : 세 번째 오답 때 보여줄 식의 구조 (정답 숫자는 쓰지 않기!)
     explanation : 게임이 끝난 뒤 '틀린 문제 다시 보기'에서 보여줄 풀이

   [비례식 문제]
     proportion  : [a, b, c, d]  →  a : b = c : d   (모르는 칸은 null)
     answer      : 숫자 하나

   [비례배분 문제]
     total       : 나눌 전체 양 (전체를 구하는 문제는 null)
     parts       : 비  예) [2, 3]  또는  [2, 3, 5]
     ask         : "parts" = 각각의 몫 구하기 / "total" = 전체 구하기
     known       : ask가 "total"일 때 알려준 몫  예) [16, null]
     answer      : "parts" → [몫1, 몫2, …] / "total" → 숫자 하나

   [미니게임용 선택 항목]
     step        : 버튼·슬라이더 한 칸의 크기 (용액, 음량)
     tolerance   : 정답으로 인정하는 오차 (주스 따르기)
     snap        : 분할선이 움직이는 단위 (체육관 코스·시간)
   ===================================================================== */

const QUESTIONS = [

  /* ───────────── 비례식 30문제 ───────────── */

  /* ① 컴퓨터실 · 전력 회로 복구 (8) — 기본·분수·소수 비례식 */
  {
    id: "COM_01", location: "computer", missionType: "power", category: "비례식", difficulty: 1,
    question: "두 회로의 전력이 같은 비율이 되도록 □를 구하세요.\n3 : 5 = 12 : □",
    lines: ["전력 비율을 똑같이 맞추세요.", "3 : 5 = 12 : □"],
    proportion: [3, 5, 12, null], labels: ["A 회로", "B 회로"],
    answer: 20, unit: "",
    hint: "3이 12가 되려면 몇 배가 되었을까요?",
    steps: ["3 × 4 = 12", "5에도 똑같이 4를 곱해요.", "5 × 4 = □"],
    explanation: "3에서 12가 되려면 4배이므로 5도 4배하면 20입니다."
  },
  {
    id: "COM_02", location: "computer", missionType: "power", category: "비례식", difficulty: 1,
    question: "두 회로의 전력이 같은 비율이 되도록 □를 구하세요.\n2 : 3 = 8 : □",
    lines: ["전력 비율을 똑같이 맞추세요.", "2 : 3 = 8 : □"],
    proportion: [2, 3, 8, null], labels: ["A 회로", "B 회로"],
    answer: 12, unit: "",
    hint: "2가 8이 되려면 몇 배가 되었을까요?",
    steps: ["2 × 4 = 8", "3에도 똑같이 4를 곱해요.", "3 × 4 = □"],
    explanation: "2에서 8이 되려면 4배이므로 3도 4배하면 12입니다."
  },
  {
    id: "COM_03", location: "computer", missionType: "power", category: "비례식", difficulty: 1,
    question: "두 회로의 전력이 같은 비율이 되도록 □를 구하세요.\n4 : 7 = 12 : □",
    lines: ["전력 비율을 똑같이 맞추세요.", "4 : 7 = 12 : □"],
    proportion: [4, 7, 12, null], labels: ["A 회로", "B 회로"],
    answer: 21, unit: "",
    hint: "4가 12가 되려면 몇 배가 되었을까요?",
    steps: ["4 × 3 = 12", "7에도 똑같이 3을 곱해요.", "7 × 3 = □"],
    explanation: "4에서 12가 되려면 3배이므로 7도 3배하면 21입니다."
  },
  {
    id: "COM_04", location: "computer", missionType: "power", category: "비례식", difficulty: 2,
    question: "두 회로의 전력이 같은 비율이 되도록 □를 구하세요.\n5 : 8 = □ : 24",
    lines: ["전력 비율을 똑같이 맞추세요.", "5 : 8 = □ : 24"],
    proportion: [5, 8, null, 24], labels: ["A 회로", "B 회로"],
    answer: 15, unit: "",
    hint: "이번에는 뒤쪽을 보세요. 8이 24가 되려면 몇 배일까요?",
    steps: ["8 × 3 = 24", "5에도 똑같이 3을 곱해요.", "5 × 3 = □"],
    explanation: "8에서 24가 되려면 3배이므로 5도 3배하면 15입니다."
  },
  {
    id: "COM_05", location: "computer", missionType: "power", category: "비례식", difficulty: 2,
    question: "크기가 같은 분수가 되도록 □를 구하세요.\n2/3 = □/12",
    lines: ["크기가 같은 분수를 만드세요.", "2/3 = □/12"],
    proportion: [2, 3, null, 12], labels: ["분자", "분모"],
    answer: 8, unit: "",
    hint: "분모 3이 12가 되려면 몇 배일까요? 분자에도 똑같이 곱해요.",
    steps: ["3 × 4 = 12", "2 × 4 = □"],
    explanation: "분모 3에 4를 곱하면 12이므로 분자 2에도 4를 곱하면 8입니다."
  },
  {
    id: "COM_06", location: "computer", missionType: "power", category: "비례식", difficulty: 2,
    question: "크기가 같은 분수가 되도록 □를 구하세요.\n3/5 = 9/□",
    lines: ["크기가 같은 분수를 만드세요.", "3/5 = 9/□"],
    proportion: [3, 5, 9, null], labels: ["분자", "분모"],
    answer: 15, unit: "",
    hint: "분자 3이 9가 되려면 몇 배일까요? 분모에도 똑같이 곱해요.",
    steps: ["3 × 3 = 9", "5 × 3 = □"],
    explanation: "분자 3에 3을 곱하면 9이므로 분모 5에도 3을 곱하면 15입니다."
  },
  {
    id: "COM_07", location: "computer", missionType: "power", category: "비례식", difficulty: 3,
    question: "두 회로의 전력이 같은 비율이 되도록 □를 구하세요.\n□ : 6 = 10 : 15",
    lines: ["전력 비율을 똑같이 맞추세요.", "□ : 6 = 10 : 15"],
    proportion: [null, 6, 10, 15], labels: ["A 회로", "B 회로"],
    answer: 4, unit: "",
    hint: "외항의 곱과 내항의 곱은 같아요. 바깥쪽 두 수와 안쪽 두 수를 찾아보세요.",
    steps: ["외항: □와 15, 내항: 6과 10", "□ × 15 = 6 × 10 = 60", "□ = 60 ÷ 15"],
    explanation: "외항의 곱 □ × 15는 내항의 곱 6 × 10 = 60과 같으므로 □ = 60 ÷ 15 = 4입니다."
  },
  {
    id: "COM_08", location: "computer", missionType: "power", category: "비례식", difficulty: 3,
    question: "두 회로의 전력이 같은 비율이 되도록 □를 구하세요.\n1.5 : 3 = □ : 12",
    lines: ["전력 비율을 똑같이 맞추세요.", "1.5 : 3 = □ : 12"],
    proportion: [1.5, 3, null, 12], labels: ["A 회로", "B 회로"],
    answer: 6, unit: "",
    hint: "3이 12가 되려면 몇 배일까요? 1.5에도 똑같이 곱해요.",
    steps: ["3 × 4 = 12", "1.5 × 4 = □"],
    explanation: "3에서 12가 되려면 4배이므로 1.5도 4배하면 6입니다."
  },

  /* ② 과학실 · 용액 배합 (4) */
  {
    id: "SCI_01", location: "science", missionType: "liquid", category: "비례식", difficulty: 1,
    question: "파란 용액과 노란 용액을 2 : 3으로 섞어야 합니다. 파란 용액이 40mL라면 노란 용액은 몇 mL가 필요할까요?",
    lines: ["파란 : 노란 = 2 : 3", "파란 용액 40mL", "노란 용액은 몇 mL?"],
    proportion: [2, 3, 40, null], labels: ["파란 용액", "노란 용액"],
    answer: 60, unit: "mL", step: 10,
    hint: "2가 40이 되려면 몇 배가 되었을까요?",
    steps: ["2 : 3 = 40 : □", "2 × 20 = 40", "3 × 20 = □"],
    explanation: "2에서 40은 20배이므로 3도 20배하면 60mL입니다."
  },
  {
    id: "SCI_02", location: "science", missionType: "liquid", category: "비례식", difficulty: 1,
    question: "빨간 용액과 초록 용액을 1 : 3으로 섞어야 합니다. 빨간 용액이 30mL라면 초록 용액은 몇 mL가 필요할까요?",
    lines: ["빨간 : 초록 = 1 : 3", "빨간 용액 30mL", "초록 용액은 몇 mL?"],
    proportion: [1, 3, 30, null], labels: ["빨간 용액", "초록 용액"],
    answer: 90, unit: "mL", step: 10,
    hint: "1이 30이 되려면 몇 배가 되었을까요?",
    steps: ["1 : 3 = 30 : □", "1 × 30 = 30", "3 × 30 = □"],
    explanation: "1에서 30은 30배이므로 3도 30배하면 90mL입니다."
  },
  {
    id: "SCI_03", location: "science", missionType: "liquid", category: "비례식", difficulty: 2,
    question: "실험 설명서에 파란 용액 20mL와 노란 용액 50mL를 섞으라고 적혀 있습니다. 같은 비율로 파란 용액을 60mL 쓰면 노란 용액은 몇 mL가 필요할까요?",
    lines: ["설명서: 파란 20mL + 노란 50mL", "파란 용액 60mL", "노란 용액은 몇 mL?"],
    proportion: [20, 50, 60, null], labels: ["파란 용액", "노란 용액"],
    answer: 150, unit: "mL", step: 10,
    hint: "먼저 비례식을 세워 보세요. 파란 용액 : 노란 용액 = 20 : 50",
    steps: ["20 : 50 = 60 : □", "20 × 3 = 60", "50 × 3 = □"],
    explanation: "20 : 50 = 60 : □에서 20의 3배가 60이므로 50의 3배인 150mL입니다."
  },
  {
    id: "SCI_04", location: "science", missionType: "liquid", category: "비례식", difficulty: 3,
    question: "식초와 물을 2 : 5로 섞어 실험 용액을 만듭니다. 물을 75mL 넣었다면 식초는 몇 mL 넣어야 할까요?",
    lines: ["식초 : 물 = 2 : 5", "물 75mL", "식초는 몇 mL?"],
    proportion: [2, 5, null, 75], labels: ["식초", "물"],
    answer: 30, unit: "mL", step: 5,
    hint: "□가 앞쪽에 있어요. 5가 75가 되려면 몇 배일까요?",
    steps: ["2 : 5 = □ : 75", "5 × 15 = 75", "2 × 15 = □"],
    explanation: "5에서 75는 15배이므로 2도 15배하면 30mL입니다."
  },

  /* ③ 급식실 · 레시피 복구 (4) */
  {
    id: "KIT_01", location: "cafeteria", missionType: "recipe", category: "비례식", difficulty: 1,
    question: "학생 4명의 밥을 짓는 데 쌀 300g이 필요합니다. 학생 12명의 밥을 지으려면 쌀은 몇 g 필요할까요?",
    lines: ["학생 4명 → 쌀 300g", "학생 12명 → 쌀 □g"],
    proportion: [4, 300, 12, null], labels: ["학생 수", "쌀"],
    answer: 900, unit: "g",
    hint: "4명이 12명이 되려면 몇 배가 되었을까요?",
    steps: ["4 : 300 = 12 : □", "4 × 3 = 12", "300 × 3 = □"],
    explanation: "학생 수가 4명에서 12명으로 3배가 되었으므로 쌀도 300g의 3배인 900g입니다."
  },
  {
    id: "KIT_02", location: "cafeteria", missionType: "recipe", category: "비례식", difficulty: 2,
    question: "급식용 사과 3개의 가격이 2,400원입니다. 같은 사과 9개의 가격은 얼마일까요?",
    lines: ["사과 3개 → 2,400원", "사과 9개 → □원"],
    proportion: [3, 2400, 9, null], labels: ["사과 수", "가격"],
    answer: 7200, unit: "원",
    hint: "사과 개수가 몇 배가 되었나요? 가격도 같은 배만큼 늘어나요.",
    steps: ["3 : 2400 = 9 : □", "3 × 3 = 9", "2400 × 3 = □"],
    explanation: "사과가 3개에서 9개로 3배가 되었으므로 가격도 2,400원의 3배인 7,200원입니다."
  },
  {
    id: "KIT_03", location: "cafeteria", missionType: "recipe", category: "비례식", difficulty: 2,
    question: "쿠키 4개를 만들 때 밀가루 120g이 필요합니다. 쿠키 10개를 만들려면 밀가루는 몇 g 필요할까요?",
    lines: ["쿠키 4개 → 밀가루 120g", "쿠키 10개 → 밀가루 □g"],
    proportion: [4, 120, 10, null], labels: ["쿠키 수", "밀가루"],
    answer: 300, unit: "g",
    hint: "쿠키 1개에 밀가루가 몇 g 필요한지 먼저 구해 보세요.",
    steps: ["4 : 120 = 10 : □", "쿠키 1개에 120 ÷ 4 = 30g", "쿠키 10개에 30 × 10 = □"],
    explanation: "쿠키 1개에 30g이 필요하므로 쿠키 10개에는 30 × 10 = 300g이 필요합니다."
  },
  {
    id: "KIT_04", location: "cafeteria", missionType: "recipe", category: "비례식", difficulty: 3,
    question: "샐러드 6인분에 드레싱 0.3L가 필요합니다. 샐러드 15인분에는 드레싱이 몇 L 필요할까요?",
    lines: ["샐러드 6인분 → 드레싱 0.3L", "샐러드 15인분 → 드레싱 □L"],
    proportion: [6, 0.3, 15, null], labels: ["샐러드", "드레싱"],
    answer: 0.75, unit: "L",
    hint: "6인분이 15인분이 되려면 몇 배일까요? 소수로 나와도 괜찮아요.",
    steps: ["6 : 0.3 = 15 : □", "6 × 2.5 = 15", "0.3 × 2.5 = □"],
    explanation: "6인분에서 15인분은 2.5배이므로 드레싱도 0.3L의 2.5배인 0.75L입니다."
  },

  /* ④ 급식실 · 과일 주스 만들기 (3) */
  {
    id: "JUI_01", location: "cafeteria", missionType: "juice", category: "비례식", difficulty: 1,
    question: "주스 원액과 물을 1 : 4로 섞습니다. 원액 200mL를 사용하면 물은 몇 mL 넣어야 할까요?",
    lines: ["원액 : 물 = 1 : 4", "원액 200mL", "물은 몇 mL?"],
    proportion: [1, 4, 200, null], labels: ["원액", "물"],
    answer: 800, unit: "mL", tolerance: 20,
    hint: "1이 200이 되려면 몇 배가 되었을까요?",
    steps: ["1 : 4 = 200 : □", "1 × 200 = 200", "4 × 200 = □"],
    explanation: "1에서 200은 200배이므로 4도 200배하면 800mL입니다."
  },
  {
    id: "JUI_02", location: "cafeteria", missionType: "juice", category: "비례식", difficulty: 2,
    question: "주스 원액 150mL에 물 450mL를 섞었더니 맛있는 주스가 되었습니다. 같은 맛으로 원액 100mL를 쓰면 물은 몇 mL 넣어야 할까요?",
    lines: ["원액 150mL + 물 450mL", "원액 100mL", "물은 몇 mL?"],
    proportion: [150, 450, 100, null], labels: ["원액", "물"],
    answer: 300, unit: "mL", tolerance: 10,
    hint: "150 : 450을 간단한 자연수의 비로 나타내 보세요.",
    steps: ["150 : 450 = 1 : 3", "1 : 3 = 100 : □", "3 × 100 = □"],
    explanation: "150 : 450은 1 : 3과 같으므로 원액 100mL에는 물 300mL를 넣습니다."
  },
  {
    id: "JUI_03", location: "cafeteria", missionType: "juice", category: "비례식", difficulty: 3,
    question: "레몬 원액과 물을 0.5 : 2로 섞습니다. 물을 600mL 넣었다면 원액은 몇 mL 넣어야 할까요?",
    lines: ["원액 : 물 = 0.5 : 2", "물 600mL", "원액은 몇 mL?"],
    proportion: [0.5, 2, null, 600], labels: ["원액", "물"],
    answer: 150, unit: "mL", tolerance: 10,
    hint: "2가 600이 되려면 몇 배일까요? 0.5에도 똑같이 곱해요.",
    steps: ["0.5 : 2 = □ : 600", "2 × 300 = 600", "0.5 × 300 = □"],
    explanation: "2에서 600은 300배이므로 0.5도 300배하면 150mL입니다."
  },

  /* ⑦ 방송실 · 음량 조절 (3) */
  {
    id: "BRO_01", location: "broadcast", missionType: "volume", category: "비례식", difficulty: 1,
    question: "방송실 스피커의 왼쪽 : 오른쪽 음량이 4 : 5가 되어야 합니다. 왼쪽 스피커가 32라면 오른쪽 스피커는 얼마로 맞춰야 할까요?",
    lines: ["왼쪽 : 오른쪽 = 4 : 5", "왼쪽 32", "오른쪽은 얼마?"],
    proportion: [4, 5, 32, null], labels: ["왼쪽", "오른쪽"],
    answer: 40, unit: "", step: 1,
    hint: "4가 32가 되려면 몇 배가 되었을까요?",
    steps: ["4 : 5 = 32 : □", "4 × 8 = 32", "5 × 8 = □"],
    explanation: "4에서 32는 8배이므로 5도 8배하면 40입니다."
  },
  {
    id: "BRO_02", location: "broadcast", missionType: "volume", category: "비례식", difficulty: 2,
    question: "배경음악과 목소리의 음량 비가 3 : 8이어야 방송이 잘 들립니다. 목소리 음량이 64라면 배경음악 음량은 얼마로 맞춰야 할까요?",
    lines: ["배경음악 : 목소리 = 3 : 8", "목소리 64", "배경음악은 얼마?"],
    proportion: [3, 8, null, 64], labels: ["배경음악", "목소리"],
    answer: 24, unit: "", step: 1,
    hint: "□가 앞쪽에 있어요. 8이 64가 되려면 몇 배일까요?",
    steps: ["3 : 8 = □ : 64", "8 × 8 = 64", "3 × 8 = □"],
    explanation: "8에서 64는 8배이므로 3도 8배하면 24입니다."
  },
  {
    id: "BRO_03", location: "broadcast", missionType: "volume", category: "비례식", difficulty: 3,
    question: "왼쪽 : 오른쪽 음량이 1.5 : 2가 되어야 합니다. 오른쪽 스피커가 60이라면 왼쪽 스피커는 얼마로 맞춰야 할까요?",
    lines: ["왼쪽 : 오른쪽 = 1.5 : 2", "오른쪽 60", "왼쪽은 얼마?"],
    proportion: [1.5, 2, null, 60], labels: ["왼쪽", "오른쪽"],
    answer: 45, unit: "", step: 1,
    hint: "2가 60이 되려면 몇 배일까요? 1.5에도 똑같이 곱해요.",
    steps: ["1.5 : 2 = □ : 60", "2 × 30 = 60", "1.5 × 30 = □"],
    explanation: "2에서 60은 30배이므로 1.5도 30배하면 45입니다."
  },

  /* ⑧ 교무실 · 비상 대피 지도 (4) */
  {
    id: "OFF_01", location: "office", missionType: "evacmap", category: "비례식", difficulty: 1,
    question: "대피 지도에서 2cm는 실제 거리 6m입니다. 지도에서 교실과 체육관 사이가 7cm라면 실제 거리는 몇 m일까요?",
    lines: ["지도 2cm = 실제 6m", "지도에서 7cm", "실제 거리는 몇 m?"],
    proportion: [2, 6, 7, null], labels: ["지도 거리(cm)", "실제 거리(m)"],
    answer: 21, unit: "m",
    hint: "지도의 1cm는 실제로 몇 m일까요?",
    steps: ["2 : 6 = 7 : □", "지도 1cm는 6 ÷ 2 = 3m", "지도 7cm는 3 × 7 = □"],
    explanation: "지도 1cm가 실제 3m이므로 7cm는 3 × 7 = 21m입니다."
  },
  {
    id: "OFF_02", location: "office", missionType: "evacmap", category: "비례식", difficulty: 2,
    question: "현장체험학습 지도에서 3cm가 실제 12km를 나타냅니다. 지도에서 학교와 박물관 사이가 8cm라면 실제 거리는 몇 km일까요?",
    lines: ["지도 3cm = 실제 12km", "지도에서 8cm", "실제 거리는 몇 km?"],
    proportion: [3, 12, 8, null], labels: ["지도 거리(cm)", "실제 거리(km)"],
    answer: 32, unit: "km",
    hint: "지도의 1cm는 실제로 몇 km일까요?",
    steps: ["3 : 12 = 8 : □", "지도 1cm는 12 ÷ 3 = 4km", "지도 8cm는 4 × 8 = □"],
    explanation: "지도 1cm가 실제 4km이므로 8cm는 4 × 8 = 32km입니다."
  },
  {
    id: "OFF_03", location: "office", missionType: "evacmap", category: "비례식", difficulty: 2,
    question: "대피 훈련에서 3분 동안 240m를 걸었습니다. 같은 빠르기로 5분 동안 걸으면 몇 m를 갈 수 있을까요?",
    lines: ["3분 동안 240m", "같은 빠르기로 5분", "몇 m를 갈까요?"],
    proportion: [3, 240, 5, null], labels: ["걸은 시간(분)", "간 거리(m)"],
    answer: 400, unit: "m",
    hint: "1분 동안 몇 m를 걸었는지 먼저 구해 보세요.",
    steps: ["3 : 240 = 5 : □", "1분에 240 ÷ 3 = 80m", "5분에 80 × 5 = □"],
    explanation: "1분에 80m를 걸으므로 5분 동안에는 80 × 5 = 400m를 갑니다."
  },
  {
    id: "OFF_04", location: "office", missionType: "evacmap", category: "비례식", difficulty: 3,
    question: "대피 지도에서 4cm는 실제 50m입니다. 실제로 175m 떨어진 비상구는 지도에서 몇 cm 떨어진 곳에 그려야 할까요?",
    lines: ["지도 4cm = 실제 50m", "실제로 175m", "지도에는 몇 cm?"],
    proportion: [4, 50, null, 175], labels: ["지도 거리(cm)", "실제 거리(m)"],
    answer: 14, unit: "cm",
    hint: "이번에는 반대 방향이에요. 50m가 175m가 되려면 몇 배일까요?",
    steps: ["4 : 50 = □ : 175", "50 × 3.5 = 175", "4 × 3.5 = □"],
    explanation: "50m에서 175m는 3.5배이므로 지도 거리도 4cm의 3.5배인 14cm입니다."
  },

  /* ⑩ 보건실 · 물 공급 (4) — 소수 */
  {
    id: "NUR_01", location: "nurse", missionType: "water", category: "비례식", difficulty: 1,
    question: "학생 2명에게 물 1L가 필요합니다. 학생 6명에게는 물이 몇 L 필요할까요?",
    lines: ["학생 2명 → 물 1L", "학생 6명 → 물 □L"],
    proportion: [2, 1, 6, null], labels: ["학생 수", "물(L)"],
    answer: 3, unit: "L",
    hint: "2명이 6명이 되려면 몇 배가 되었을까요?",
    steps: ["2 : 1 = 6 : □", "2명에서 6명은 몇 배인지 구해요.", "물 1L에도 같은 수를 곱해요."],
    explanation: "2명에서 6명은 3배이므로 물도 1L의 3배인 3L입니다."
  },
  {
    id: "NUR_02", location: "nurse", missionType: "water", category: "비례식", difficulty: 2,
    question: "체육 시간 뒤 학생 4명이 물 1L를 마십니다. 같은 비율이라면 학생 10명에게는 물이 몇 L 필요할까요?",
    lines: ["학생 4명 → 물 1L", "학생 10명 → 물 □L"],
    proportion: [4, 1, 10, null], labels: ["학생 수", "물(L)"],
    answer: 2.5, unit: "L",
    hint: "학생 2명에게는 물이 몇 L 필요할까요?",
    steps: ["4 : 1 = 10 : □", "2명에게 1 ÷ 2 = 0.5L", "10명은 2명의 5배이므로 0.5 × 5 = □"],
    explanation: "2명에게 0.5L가 필요하고 10명은 2명의 5배이므로 0.5 × 5 = 2.5L입니다."
  },
  {
    id: "NUR_03", location: "nurse", missionType: "water", category: "비례식", difficulty: 3,
    question: "학생 6명에게 물 1.5L가 필요합니다. 학생 10명에게는 물이 몇 L 필요할까요?",
    lines: ["학생 6명 → 물 1.5L", "학생 10명 → 물 □L"],
    proportion: [6, 1.5, 10, null], labels: ["학생 수", "물(L)"],
    answer: 2.5, unit: "L",
    hint: "학생 1명에게 물이 몇 L 필요한지 먼저 구해 보세요.",
    steps: ["6 : 1.5 = 10 : □", "1명에게 1.5 ÷ 6 = 0.25L", "10명에게 0.25 × 10 = □"],
    explanation: "1명에게 0.25L가 필요하므로 10명에게는 0.25 × 10 = 2.5L가 필요합니다."
  },
  {
    id: "NUR_04", location: "nurse", missionType: "water", category: "비례식", difficulty: 3,
    question: "보리차 티백 2개로 물 1.2L를 끓입니다. 같은 진하기로 티백 5개를 쓰면 물은 몇 L 필요할까요?",
    lines: ["티백 2개 → 물 1.2L", "티백 5개 → 물 □L"],
    proportion: [2, 1.2, 5, null], labels: ["티백 수", "물(L)"],
    answer: 3, unit: "L",
    hint: "티백 1개에 물이 몇 L인지 먼저 구해 보세요.",
    steps: ["2 : 1.2 = 5 : □", "티백 1개에 1.2 ÷ 2 = 0.6L", "티백 5개에 0.6 × 5 = □"],
    explanation: "티백 1개에 물 0.6L이므로 티백 5개에는 0.6 × 5 = 3L가 필요합니다."
  },

  /* ───────────── 비례배분 30문제 ───────────── */

  /* ⑤ 도서관 · 책 정리 (9) — 묶음 반복 */
  {
    id: "LIB_01", location: "library", missionType: "books", category: "비례배분", difficulty: 1,
    question: "새 책 45권을 과학책 코너와 문학책 코너에 2 : 3으로 나누어 꽂으려고 합니다. 각 코너에 몇 권씩 꽂아야 할까요?",
    lines: ["책 45권", "과학 : 문학 = 2 : 3", "각 코너에 몇 권?"],
    total: 45, parts: [2, 3], ask: "parts", labels: ["과학책 코너", "문학책 코너"],
    answer: [18, 27], unit: "권",
    hint: "과학책 2권과 문학책 3권을 한 묶음으로 생각하면 몇 묶음이 나올까요?",
    steps: ["한 묶음 = 2 + 3 = 5권", "45 ÷ 5 = 9묶음", "과학책 = 2 × 9, 문학책 = 3 × 9"],
    explanation: "5권씩 9묶음이므로 과학책은 2 × 9 = 18권, 문학책은 3 × 9 = 27권입니다."
  },
  {
    id: "LIB_02", location: "library", missionType: "books", category: "비례배분", difficulty: 1,
    question: "책 30권을 1층 서가와 2층 서가에 2 : 3으로 나누어 꽂으려고 합니다. 각 서가에 몇 권씩 꽂아야 할까요?",
    lines: ["책 30권", "1층 : 2층 = 2 : 3", "각 서가에 몇 권?"],
    total: 30, parts: [2, 3], ask: "parts", labels: ["1층 서가", "2층 서가"],
    answer: [12, 18], unit: "권",
    hint: "2권과 3권을 한 묶음으로 생각하면 몇 묶음이 나올까요?",
    steps: ["한 묶음 = 2 + 3 = 5권", "30 ÷ 5 = 6묶음", "1층 = 2 × 6, 2층 = 3 × 6"],
    explanation: "5권씩 6묶음이므로 1층은 2 × 6 = 12권, 2층은 3 × 6 = 18권입니다."
  },
  {
    id: "LIB_03", location: "library", missionType: "books", category: "비례배분", difficulty: 1,
    question: "책 42권을 동화 코너와 과학 코너에 3 : 4로 나누어 꽂으려고 합니다. 각 코너에 몇 권씩 꽂아야 할까요?",
    lines: ["책 42권", "동화 : 과학 = 3 : 4", "각 코너에 몇 권?"],
    total: 42, parts: [3, 4], ask: "parts", labels: ["동화 코너", "과학 코너"],
    answer: [18, 24], unit: "권",
    hint: "3권과 4권을 한 묶음으로 생각하면 몇 묶음이 나올까요?",
    steps: ["한 묶음 = 3 + 4 = 7권", "42 ÷ 7 = 6묶음", "동화 = 3 × 6, 과학 = 4 × 6"],
    explanation: "7권씩 6묶음이므로 동화는 3 × 6 = 18권, 과학은 4 × 6 = 24권입니다."
  },
  {
    id: "LIB_04", location: "library", missionType: "books", category: "비례배분", difficulty: 2,
    question: "도서관에 새 책 56권이 들어왔습니다. 동화책 코너와 위인전 코너에 3 : 5가 되도록 나누어 꽂으려면 각 코너에 몇 권씩 꽂아야 할까요?",
    lines: ["책 56권", "동화책 : 위인전 = 3 : 5", "각 코너에 몇 권?"],
    total: 56, parts: [3, 5], ask: "parts", labels: ["동화책 코너", "위인전 코너"],
    answer: [21, 35], unit: "권",
    hint: "전체를 몇 부분으로 나누는지 먼저 생각해 보세요. (3 + 5)",
    steps: ["한 묶음 = 3 + 5 = 8권", "56 ÷ 8 = 7묶음", "동화책 = 3 × 7, 위인전 = 5 × 7"],
    explanation: "8권씩 7묶음이므로 동화책은 21권, 위인전은 35권입니다."
  },
  {
    id: "LIB_05", location: "library", missionType: "books", category: "비례배분", difficulty: 2,
    question: "잡지 36권이 새로 왔습니다. 1층과 2층 잡지 코너의 크기 비가 5 : 4여서 같은 비로 나누어 꽂으려고 합니다. 각 층에 몇 권씩 꽂아야 할까요?",
    lines: ["잡지 36권", "1층 : 2층 = 5 : 4", "각 층에 몇 권?"],
    total: 36, parts: [5, 4], ask: "parts", labels: ["1층 잡지 코너", "2층 잡지 코너"],
    answer: [20, 16], unit: "권",
    hint: "5권과 4권을 한 묶음으로 생각해 보세요.",
    steps: ["한 묶음 = 5 + 4 = 9권", "36 ÷ 9 = 4묶음", "1층 = 5 × 4, 2층 = 4 × 4"],
    explanation: "9권씩 4묶음이므로 1층은 5 × 4 = 20권, 2층은 4 × 4 = 16권입니다."
  },
  {
    id: "LIB_06", location: "library", missionType: "books", category: "비례배분", difficulty: 2,
    question: "만화책 64권을 학습만화 코너와 동화만화 코너에 5 : 3으로 나누려고 합니다. 각 코너에 몇 권씩 꽂아야 할까요?",
    lines: ["만화책 64권", "학습만화 : 동화만화 = 5 : 3", "각 코너에 몇 권?"],
    total: 64, parts: [5, 3], ask: "parts", labels: ["학습만화 코너", "동화만화 코너"],
    answer: [40, 24], unit: "권",
    hint: "5권과 3권을 한 묶음으로 생각하면 몇 묶음이 나올까요?",
    steps: ["한 묶음 = 5 + 3 = 8권", "64 ÷ 8 = 8묶음", "학습만화 = 5 × 8, 동화만화 = 3 × 8"],
    explanation: "8권씩 8묶음이므로 학습만화는 40권, 동화만화는 24권입니다."
  },
  {
    id: "LIB_07", location: "library", missionType: "books", category: "비례배분", difficulty: 3,
    question: "책 60권을 과학, 역사, 문학 코너에 2 : 3 : 5로 나누어 꽂으려고 합니다. 각 코너에 몇 권씩 꽂아야 할까요?",
    lines: ["책 60권", "과학 : 역사 : 문학 = 2 : 3 : 5", "각 코너에 몇 권?"],
    total: 60, parts: [2, 3, 5], ask: "parts", labels: ["과학 코너", "역사 코너", "문학 코너"],
    answer: [12, 18, 30], unit: "권",
    hint: "세 코너의 비를 모두 더하면 한 묶음이 몇 권인지 알 수 있어요.",
    steps: ["한 묶음 = 2 + 3 + 5 = 10권", "60 ÷ 10 = 6묶음", "과학 = 2 × 6, 역사 = 3 × 6, 문학 = 5 × 6"],
    explanation: "10권씩 6묶음이므로 과학 12권, 역사 18권, 문학 30권입니다."
  },
  {
    id: "LIB_08", location: "library", missionType: "books", category: "비례배분", difficulty: 3,
    question: "과학책과 문학책을 2 : 3으로 나누어 꽂았더니 과학책 코너에 16권이 꽂혔습니다. 두 코너에 꽂은 책은 모두 몇 권일까요?",
    lines: ["과학 : 문학 = 2 : 3", "과학 코너에 16권", "책은 모두 몇 권?"],
    total: null, parts: [2, 3], ask: "total", known: [16, null], labels: ["과학책 코너", "문학책 코너"],
    answer: 40, unit: "권",
    hint: "한 묶음에 과학책은 2권 들어가요. 과학책 16권이면 몇 묶음일까요?",
    steps: ["16 ÷ 2 = 8묶음", "한 묶음 = 2 + 3 = 5권", "전체 = 5 × 8"],
    explanation: "과학책 16권은 8묶음이고 한 묶음은 5권이므로 전체는 5 × 8 = 40권입니다."
  },
  {
    id: "LIB_09", location: "library", missionType: "books", category: "비례배분", difficulty: 3,
    question: "책 54권을 4학년, 5학년, 6학년 학급문고에 2 : 3 : 4로 나누어 보내려고 합니다. 각 학년에 몇 권씩 보내야 할까요?",
    lines: ["책 54권", "4학년 : 5학년 : 6학년 = 2 : 3 : 4", "각 학년에 몇 권?"],
    total: 54, parts: [2, 3, 4], ask: "parts", labels: ["4학년", "5학년", "6학년"],
    answer: [12, 18, 24], unit: "권",
    hint: "세 학년의 비를 모두 더해 보세요.",
    steps: ["한 묶음 = 2 + 3 + 4 = 9권", "54 ÷ 9 = 6묶음", "4학년 = 2 × 6, 5학년 = 3 × 6, 6학년 = 4 × 6"],
    explanation: "9권씩 6묶음이므로 4학년 12권, 5학년 18권, 6학년 24권입니다."
  },

  /* ⑥ 체육관 · 팀 편성 (9) — 분할선 나누기 */
  {
    id: "GYM_01", location: "gym", missionType: "teams", category: "비례배분", difficulty: 1,
    question: "학생 35명을 빨강팀과 파랑팀으로 3 : 4가 되게 나누려고 합니다. 각 팀은 몇 명일까요?",
    lines: ["학생 35명", "빨강팀 : 파랑팀 = 3 : 4", "각 팀은 몇 명?"],
    total: 35, parts: [3, 4], ask: "parts", labels: ["빨강팀", "파랑팀"],
    answer: [15, 20], unit: "명",
    hint: "전체를 3 + 4 = 7부분으로 나누면 한 부분은 몇 명일까요?",
    steps: ["3 + 4 = 7", "35 ÷ 7 = 5", "빨강팀 = 3 × 5, 파랑팀 = 4 × 5"],
    explanation: "한 부분이 5명이므로 빨강팀은 3 × 5 = 15명, 파랑팀은 4 × 5 = 20명입니다."
  },
  {
    id: "GYM_02", location: "gym", missionType: "teams", category: "비례배분", difficulty: 1,
    question: "학생 24명을 노랑팀과 초록팀으로 3 : 5가 되게 나누려고 합니다. 각 팀은 몇 명일까요?",
    lines: ["학생 24명", "노랑팀 : 초록팀 = 3 : 5", "각 팀은 몇 명?"],
    total: 24, parts: [3, 5], ask: "parts", labels: ["노랑팀", "초록팀"],
    answer: [9, 15], unit: "명",
    hint: "전체를 3 + 5 = 8부분으로 나누면 한 부분은 몇 명일까요?",
    steps: ["3 + 5 = 8", "24 ÷ 8 = 3", "노랑팀 = 3 × 3, 초록팀 = 5 × 3"],
    explanation: "한 부분이 3명이므로 노랑팀은 9명, 초록팀은 15명입니다."
  },
  {
    id: "GYM_03", location: "gym", missionType: "teams", category: "비례배분", difficulty: 1,
    question: "학생 27명을 흰팀과 검정팀으로 4 : 5가 되게 나누려고 합니다. 각 팀은 몇 명일까요?",
    lines: ["학생 27명", "흰팀 : 검정팀 = 4 : 5", "각 팀은 몇 명?"],
    total: 27, parts: [4, 5], ask: "parts", labels: ["흰팀", "검정팀"],
    answer: [12, 15], unit: "명",
    hint: "전체를 4 + 5 = 9부분으로 나누면 한 부분은 몇 명일까요?",
    steps: ["4 + 5 = 9", "27 ÷ 9 = 3", "흰팀 = 4 × 3, 검정팀 = 5 × 3"],
    explanation: "한 부분이 3명이므로 흰팀은 12명, 검정팀은 15명입니다."
  },
  {
    id: "GYM_04", location: "gym", missionType: "teams", category: "비례배분", difficulty: 2,
    question: "피구 경기에 참가한 학생 32명을 공격팀과 수비팀으로 3 : 5가 되게 나누려고 합니다. 각 팀은 몇 명일까요?",
    lines: ["학생 32명", "공격팀 : 수비팀 = 3 : 5", "각 팀은 몇 명?"],
    total: 32, parts: [3, 5], ask: "parts", labels: ["공격팀", "수비팀"],
    answer: [12, 20], unit: "명",
    hint: "전체를 몇 부분으로 나누어야 할까요? (3 + 5)",
    steps: ["3 + 5 = 8", "32 ÷ 8 = 4", "공격팀 = 3 × 4, 수비팀 = 5 × 4"],
    explanation: "한 부분이 4명이므로 공격팀은 12명, 수비팀은 20명입니다."
  },
  {
    id: "GYM_05", location: "gym", missionType: "teams", category: "비례배분", difficulty: 2,
    question: "달리기 코스 450m를 걷기 구간과 달리기 구간이 2 : 3이 되도록 나누려고 합니다. 각 구간은 몇 m일까요?",
    lines: ["코스 450m", "걷기 : 달리기 = 2 : 3", "각 구간은 몇 m?"],
    total: 450, parts: [2, 3], ask: "parts", labels: ["걷기 구간", "달리기 구간"],
    answer: [180, 270], unit: "m", snap: 10,
    hint: "코스 전체를 2 + 3 = 5부분으로 나누면 한 부분은 몇 m일까요?",
    steps: ["2 + 3 = 5", "450 ÷ 5 = 90", "걷기 = 2 × 90, 달리기 = 3 × 90"],
    explanation: "한 부분이 90m이므로 걷기 구간은 180m, 달리기 구간은 270m입니다."
  },
  {
    id: "GYM_06", location: "gym", missionType: "teams", category: "비례배분", difficulty: 2,
    question: "60분 체육 시간을 준비운동과 경기 시간이 1 : 4가 되도록 나누려고 합니다. 각각 몇 분일까요?",
    lines: ["체육 시간 60분", "준비운동 : 경기 = 1 : 4", "각각 몇 분?"],
    total: 60, parts: [1, 4], ask: "parts", labels: ["준비운동", "경기"],
    answer: [12, 48], unit: "분", snap: 1,
    hint: "전체 60분 중에서 준비운동은 몇 분의 몇일까요?",
    steps: ["1 + 4 = 5", "준비운동 = 60 × 1/5", "경기 = 60 × 4/5"],
    explanation: "준비운동은 60 × 1/5 = 12분, 경기는 60 × 4/5 = 48분입니다."
  },
  {
    id: "GYM_07", location: "gym", missionType: "teams", category: "비례배분", difficulty: 3,
    question: "줄다리기에 참가한 학생 45명을 세 팀으로 2 : 3 : 4가 되게 나누려고 합니다. 각 팀은 몇 명일까요?",
    lines: ["학생 45명", "1팀 : 2팀 : 3팀 = 2 : 3 : 4", "각 팀은 몇 명?"],
    total: 45, parts: [2, 3, 4], ask: "parts", labels: ["1팀", "2팀", "3팀"],
    answer: [10, 15, 20], unit: "명",
    hint: "세 팀의 비를 모두 더하면 전체가 몇 부분인지 알 수 있어요.",
    steps: ["2 + 3 + 4 = 9", "45 ÷ 9 = 5", "1팀 = 2 × 5, 2팀 = 3 × 5, 3팀 = 4 × 5"],
    explanation: "한 부분이 5명이므로 1팀 10명, 2팀 15명, 3팀 20명입니다."
  },
  {
    id: "GYM_08", location: "gym", missionType: "teams", category: "비례배분", difficulty: 3,
    question: "학교 둘레길 걷기 대회 코스 7.5km를 1구간과 2구간이 2 : 3이 되도록 나누려고 합니다. 각 구간은 몇 km일까요?",
    lines: ["코스 7.5km", "1구간 : 2구간 = 2 : 3", "각 구간은 몇 km?"],
    total: 7.5, parts: [2, 3], ask: "parts", labels: ["1구간", "2구간"],
    answer: [3, 4.5], unit: "km", snap: 0.5,
    hint: "7.5km를 5부분으로 나누면 한 부분은 몇 km일까요?",
    steps: ["2 + 3 = 5", "7.5 ÷ 5 = 1.5", "1구간 = 2 × 1.5, 2구간 = 3 × 1.5"],
    explanation: "한 부분이 1.5km이므로 1구간은 3km, 2구간은 4.5km입니다."
  },
  {
    id: "GYM_09", location: "gym", missionType: "teams", category: "비례배분", difficulty: 3,
    question: "학생 40명을 청팀과 백팀으로 0.6 : 0.4가 되게 나누려고 합니다. 각 팀은 몇 명일까요?",
    lines: ["학생 40명", "청팀 : 백팀 = 0.6 : 0.4", "각 팀은 몇 명?"],
    total: 40, parts: [0.6, 0.4], ask: "parts", labels: ["청팀", "백팀"],
    answer: [24, 16], unit: "명",
    hint: "0.6 : 0.4를 간단한 자연수의 비로 바꿔 보세요.",
    steps: ["0.6 : 0.4 = 6 : 4 = 3 : 2", "3 + 2 = 5", "40 ÷ 5 = 8", "청팀 = 3 × 8, 백팀 = 2 × 8"],
    explanation: "0.6 : 0.4는 3 : 2와 같습니다. 한 부분이 8명이므로 청팀 24명, 백팀 16명입니다."
  },

  /* ⑨ 6학년 교실 · 준비물 나누기 (12) — 띠 모델 */
  {
    id: "CLS_01", location: "classroom", missionType: "supplies", category: "비례배분", difficulty: 1,
    question: "색종이 72장을 1모둠과 2모둠에 5 : 4로 나누어 주려고 합니다. 각 모둠에 몇 장씩 주어야 할까요?",
    lines: ["색종이 72장", "1모둠 : 2모둠 = 5 : 4", "각 모둠에 몇 장?"],
    total: 72, parts: [5, 4], ask: "parts", labels: ["1모둠", "2모둠"],
    answer: [40, 32], unit: "장",
    hint: "띠를 5 + 4 = 9칸으로 나누면 한 칸은 몇 장일까요?",
    steps: ["5 + 4 = 9칸", "한 칸 = 72 ÷ 9 = 8장", "1모둠 = 5 × 8, 2모둠 = 4 × 8"],
    explanation: "한 칸이 8장이므로 1모둠은 40장, 2모둠은 32장입니다."
  },
  {
    id: "CLS_02", location: "classroom", missionType: "supplies", category: "비례배분", difficulty: 1,
    question: "학급 파티 사탕 48개를 1모둠과 2모둠의 인원 비 5 : 3으로 나누려고 합니다. 각 모둠은 몇 개씩 받아야 할까요?",
    lines: ["사탕 48개", "1모둠 : 2모둠 = 5 : 3", "각 모둠에 몇 개?"],
    total: 48, parts: [5, 3], ask: "parts", labels: ["1모둠", "2모둠"],
    answer: [30, 18], unit: "개",
    hint: "띠를 5 + 3 = 8칸으로 나누면 한 칸은 몇 개일까요?",
    steps: ["5 + 3 = 8칸", "한 칸 = 48 ÷ 8 = 6개", "1모둠 = 5 × 6, 2모둠 = 3 × 6"],
    explanation: "한 칸이 6개이므로 1모둠은 30개, 2모둠은 18개입니다."
  },
  {
    id: "CLS_03", location: "classroom", missionType: "supplies", category: "비례배분", difficulty: 1,
    question: "연필 20자루를 두 모둠에 2 : 3으로 나누어 주려고 합니다. 각 모둠에 몇 자루씩 주어야 할까요?",
    lines: ["연필 20자루", "1모둠 : 2모둠 = 2 : 3", "각 모둠에 몇 자루?"],
    total: 20, parts: [2, 3], ask: "parts", labels: ["1모둠", "2모둠"],
    answer: [8, 12], unit: "자루",
    hint: "띠를 2 + 3 = 5칸으로 나누면 한 칸은 몇 자루일까요?",
    steps: ["2 + 3 = 5칸", "한 칸 = 20 ÷ 5 = 4자루", "1모둠 = 2 × 4, 2모둠 = 3 × 4"],
    explanation: "한 칸이 4자루이므로 1모둠은 8자루, 2모둠은 12자루입니다."
  },
  {
    id: "CLS_04", location: "classroom", missionType: "supplies", category: "비례배분", difficulty: 2,
    question: "학급 텃밭 60㎡를 꽃밭과 채소밭의 넓이가 2 : 3이 되도록 나누려고 합니다. 꽃밭과 채소밭은 각각 몇 ㎡일까요?",
    lines: ["텃밭 60㎡", "꽃밭 : 채소밭 = 2 : 3", "각각 몇 ㎡?"],
    total: 60, parts: [2, 3], ask: "parts", labels: ["꽃밭", "채소밭"],
    answer: [24, 36], unit: "㎡",
    hint: "전체 텃밭 중 꽃밭은 몇 분의 몇일까요?",
    steps: ["2 + 3 = 5", "꽃밭 = 60 × 2/5", "채소밭 = 60 × 3/5"],
    explanation: "꽃밭은 60 × 2/5 = 24㎡, 채소밭은 60 × 3/5 = 36㎡입니다."
  },
  {
    id: "CLS_05", location: "classroom", missionType: "supplies", category: "비례배분", difficulty: 2,
    question: "학급 바자회 수익 54,000원을 두 봉사 단체에 4 : 5로 나누어 기부하려고 합니다. 각 단체에 얼마씩 기부해야 할까요?",
    lines: ["수익 54,000원", "첫째 : 둘째 = 4 : 5", "각 단체에 얼마?"],
    total: 54000, parts: [4, 5], ask: "parts", labels: ["첫째 단체", "둘째 단체"],
    answer: [24000, 30000], unit: "원",
    hint: "띠를 4 + 5 = 9칸으로 나누면 한 칸은 얼마일까요?",
    steps: ["4 + 5 = 9칸", "한 칸 = 54000 ÷ 9 = 6000원", "첫째 = 4 × 6000, 둘째 = 5 × 6000"],
    explanation: "한 칸이 6,000원이므로 첫째 단체는 24,000원, 둘째 단체는 30,000원입니다."
  },
  {
    id: "CLS_06", location: "classroom", missionType: "supplies", category: "비례배분", difficulty: 2,
    question: "학급 대회 상금 84,000원을 1팀과 2팀이 3 : 4의 비율로 나누려고 합니다. 각 팀은 얼마씩 받아야 할까요?",
    lines: ["상금 84,000원", "1팀 : 2팀 = 3 : 4", "각 팀에 얼마?"],
    total: 84000, parts: [3, 4], ask: "parts", labels: ["1팀", "2팀"],
    answer: [36000, 48000], unit: "원",
    hint: "전체 상금 중 1팀의 몫은 몇 분의 몇일까요?",
    steps: ["3 + 4 = 7", "1팀 = 84000 × 3/7", "2팀 = 84000 × 4/7"],
    explanation: "1팀은 84,000 × 3/7 = 36,000원, 2팀은 84,000 × 4/7 = 48,000원입니다."
  },
  {
    id: "CLS_07", location: "classroom", missionType: "supplies", category: "비례배분", difficulty: 2,
    question: "모둠 활동 40분을 토의 시간과 발표 시간이 3 : 1이 되도록 나누려고 합니다. 각각 몇 분일까요?",
    lines: ["모둠 활동 40분", "토의 : 발표 = 3 : 1", "각각 몇 분?"],
    total: 40, parts: [3, 1], ask: "parts", labels: ["토의", "발표"],
    answer: [30, 10], unit: "분",
    hint: "전체 40분 중 토의 시간은 몇 분의 몇일까요?",
    steps: ["3 + 1 = 4", "토의 = 40 × 3/4", "발표 = 40 × 1/4"],
    explanation: "토의는 40 × 3/4 = 30분, 발표는 40 × 1/4 = 10분입니다."
  },
  {
    id: "CLS_08", location: "classroom", missionType: "supplies", category: "비례배분", difficulty: 3,
    question: "우리 반이 모은 재활용품 75kg을 종이류와 플라스틱류가 2 : 3이 되도록 나누어 담았습니다. 각각 몇 kg일까요?",
    lines: ["재활용품 75kg", "종이 : 플라스틱 = 2 : 3", "각각 몇 kg?"],
    total: 75, parts: [2, 3], ask: "parts", labels: ["종이류", "플라스틱류"],
    answer: [30, 45], unit: "kg",
    hint: "띠를 2 + 3 = 5칸으로 나누면 한 칸은 몇 kg일까요?",
    steps: ["2 + 3 = 5칸", "한 칸 = 75 ÷ 5 = 15kg", "종이류 = 2 × 15, 플라스틱류 = 3 × 15"],
    explanation: "한 칸이 15kg이므로 종이류는 30kg, 플라스틱류는 45kg입니다."
  },
  {
    id: "CLS_09", location: "classroom", missionType: "supplies", category: "비례배분", difficulty: 3,
    question: "학급 파티 음료 4.5L를 1모둠과 2모둠에 2 : 1로 나누려고 합니다. 각 모둠에 몇 L씩 주어야 할까요?",
    lines: ["음료 4.5L", "1모둠 : 2모둠 = 2 : 1", "각 모둠에 몇 L?"],
    total: 4.5, parts: [2, 1], ask: "parts", labels: ["1모둠", "2모둠"],
    answer: [3, 1.5], unit: "L",
    hint: "전체 음료 중 1모둠의 몫은 몇 분의 몇일까요?",
    steps: ["2 + 1 = 3", "1모둠 = 4.5 × 2/3", "2모둠 = 4.5 × 1/3"],
    explanation: "1모둠은 4.5 × 2/3 = 3L, 2모둠은 4.5 × 1/3 = 1.5L입니다."
  },
  {
    id: "CLS_10", location: "classroom", missionType: "supplies", category: "비례배분", difficulty: 3,
    question: "색종이를 1모둠과 2모둠이 5 : 3으로 나누었더니 1모둠이 40장을 받았습니다. 처음에 있던 색종이는 모두 몇 장일까요?",
    lines: ["1모둠 : 2모둠 = 5 : 3", "1모둠이 40장", "색종이는 모두 몇 장?"],
    total: null, parts: [5, 3], ask: "total", known: [40, null], labels: ["1모둠", "2모둠"],
    answer: 64, unit: "장",
    hint: "1모둠 40장이 띠 5칸이에요. 한 칸은 몇 장일까요?",
    steps: ["한 칸 = 40 ÷ 5 = 8장", "전체 칸 수 = 5 + 3 = 8칸", "전체 = 8칸 × (한 칸의 장수)"],
    explanation: "한 칸이 8장이고 전체는 8칸이므로 8 × 8 = 64장입니다."
  },
  {
    id: "CLS_11", location: "classroom", missionType: "supplies", category: "비례배분", difficulty: 3,
    question: "학급 문고 구입비 90,000원을 세 모둠의 인원 비 2 : 3 : 4에 맞게 나누려고 합니다. 각 모둠은 얼마씩 받아야 할까요?",
    lines: ["구입비 90,000원", "1모둠 : 2모둠 : 3모둠 = 2 : 3 : 4", "각 모둠에 얼마?"],
    total: 90000, parts: [2, 3, 4], ask: "parts", labels: ["1모둠", "2모둠", "3모둠"],
    answer: [20000, 30000, 40000], unit: "원",
    hint: "띠를 2 + 3 + 4 = 9칸으로 나누면 한 칸은 얼마일까요?",
    steps: ["2 + 3 + 4 = 9칸", "한 칸 = 90000 ÷ 9 = 10000원", "1모둠 = 2 × 10000, 2모둠 = 3 × 10000, 3모둠 = 4 × 10000"],
    explanation: "한 칸이 10,000원이므로 1모둠 20,000원, 2모둠 30,000원, 3모둠 40,000원입니다."
  },
  {
    id: "CLS_12", location: "classroom", missionType: "supplies", category: "비례배분", difficulty: 2,
    question: "현장체험학습 버스가 가는 길 45km를 고속도로와 일반도로가 2 : 3이 되도록 나누었습니다. 각각 몇 km일까요?",
    lines: ["길 45km", "고속도로 : 일반도로 = 2 : 3", "각각 몇 km?"],
    total: 45, parts: [2, 3], ask: "parts", labels: ["고속도로", "일반도로"],
    answer: [18, 27], unit: "km",
    hint: "전체 길 중 고속도로는 몇 분의 몇일까요?",
    steps: ["2 + 3 = 5", "고속도로 = 45 × 2/5", "일반도로 = 45 × 3/5"],
    explanation: "고속도로는 45 × 2/5 = 18km, 일반도로는 45 × 3/5 = 27km입니다."
  }
];
