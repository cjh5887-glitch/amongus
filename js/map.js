/* =====================================================================
   map.js — 학교 맵 데이터 · 충돌 판정 · 맵 그리기

   ▸ 맵은 "바닥 영역"(방·복도·문)을 사각형으로 적어 두면,
     나머지는 자동으로 벽이 됩니다. (20px 칸 단위 격자)
   ▸ 가구(FURNITURE)는 solid:true 이면 캐릭터가 통과할 수 없습니다.
   ▸ 문(DOORS)은 나중에 방해꾼의 「문 잠금」 능력에서 locked 가 되면 벽처럼 막힙니다.
   ▸ 나중에 직접 그린 학교 그림으로 바꾸고 싶으면
     assets/images/map.png (2800×1900) 를 넣으면 배경으로 사용됩니다.
   ===================================================================== */

const GameMap = (() => {
  const W = 2800, H = 1900, CELL = 20;
  const COLS = W / CELL, ROWS = H / CELL;
  const R = (x1, y1, x2, y2) => ({ x: x1, y: y1, w: x2 - x1, h: y2 - y1 });

  // ── 방 (id 는 questions.js 의 location 과 같게) ──
  const ROOMS = [
    { id: "science",   name: "과학실",     ...R(80, 80, 620, 540),     floor: "lab" },
    { id: "classroom", name: "6학년 교실", ...R(660, 80, 1260, 540),   floor: "wood" },
    { id: "computer",  name: "컴퓨터실",   ...R(1300, 80, 1860, 540),  floor: "carpetBlue" },
    { id: "gym",       name: "체육관",     ...R(1980, 80, 2720, 900),  floor: "court" },
    { id: "library",   name: "도서관",     ...R(80, 760, 800, 1180),   floor: "carpetWarm" },
    { id: "hall",      name: "중앙 복도",  ...R(840, 720, 1480, 1180), floor: "hallTile" },
    { id: "broadcast", name: "방송실",     ...R(1520, 760, 1940, 1180), floor: "studio" },
    { id: "nurse",     name: "보건실",     ...R(80, 1400, 560, 1820),  floor: "clean" },
    { id: "office",    name: "교무실",     ...R(600, 1400, 1220, 1820), floor: "wood2" },
    { id: "cafeteria", name: "급식실",     ...R(1260, 1400, 2720, 1820), floor: "kitchen" },
  ];

  const CORRIDORS = [
    { id: "corrN", name: "북쪽 복도", ...R(80, 580, 1940, 720),   floor: "corridor" },
    { id: "corrS", name: "남쪽 복도", ...R(80, 1220, 2720, 1360), floor: "corridor" },
    { id: "corrE", name: "연결 통로", ...R(2300, 940, 2440, 1220), floor: "corridor" },
    { id: "hallS", name: "중앙 복도", ...R(1000, 1180, 1320, 1220), floor: "hallTile" },
  ];

  // ── 문 (벽 틈을 이어 주는 바닥) ──
  const DOORS = [
    { id: "d_sci",   room: "science",   ...R(460, 540, 540, 580) },
    { id: "d_cls1",  room: "classroom", ...R(720, 540, 800, 580) },
    { id: "d_cls2",  room: "classroom", ...R(1160, 540, 1240, 580) },
    { id: "d_com",   room: "computer",  ...R(1360, 540, 1440, 580) },
    { id: "d_gymW",  room: "gym",       ...R(1940, 620, 1980, 700) },
    { id: "d_gymS",  room: "gym",       ...R(2320, 900, 2420, 940) },
    { id: "d_libN",  room: "library",   ...R(160, 720, 240, 760) },
    { id: "d_libE",  room: "library",   ...R(800, 960, 840, 1040) },
    { id: "d_libS",  room: "library",   ...R(300, 1180, 380, 1220) },
    { id: "d_bro",   room: "broadcast", ...R(1480, 940, 1520, 1020) },
    { id: "d_nur",   room: "nurse",     ...R(440, 1360, 520, 1400) },
    { id: "d_nurOff",room: "nurse",     ...R(560, 1600, 600, 1680) },
    { id: "d_off1",  room: "office",    ...R(680, 1360, 760, 1400) },
    { id: "d_off2",  room: "office",    ...R(1100, 1360, 1180, 1400) },
    { id: "d_caf1",  room: "cafeteria", ...R(1400, 1360, 1520, 1400) },
    { id: "d_caf2",  room: "cafeteria", ...R(2500, 1360, 2580, 1400) },
  ].map((d) => ({ ...d, locked: false, horizontal: d.w > d.h }));

  // ── 가구 · 오브젝트 ──  (solid:false 는 밟고 지나갈 수 있음)
  const FURNITURE = [];
  const F = (type, x1, y1, x2, y2, solid = true, extra = {}) =>
    FURNITURE.push({ type, ...R(x1, y1, x2, y2), solid, ...extra });

  // 6학년 교실
  F("blackboard", 780, 80, 1140, 96);
  F("teacherDesk", 900, 124, 1010, 164);
  F("lockers", 660, 200, 690, 480);
  [740, 870, 1000, 1130].forEach((x) => {
    [200, 280, 360, 440].forEach((y) => {
      F("desk", x, y, x + 70, y + 40);
      F("chair", x + 20, y + 44, x + 50, y + 62, false);
    });
  });
  // 과학실
  F("shelfLab", 120, 80, 360, 110);
  F("microscope", 460, 84, 580, 120);
  [[140, 180], [380, 180], [140, 330], [380, 330]].forEach(([x, y]) => F("labTable", x, y, x + 160, y + 60));
  F("sink", 84, 460, 124, 530);
  // 컴퓨터실
  [170, 290, 410].forEach((y) => F("pcDesk", 1360, y, 1800, y + 40));
  F("serverRack", 1804, 84, 1856, 150);
  // 체육관
  F("courtLines", 2060, 160, 2640, 820, false);
  F("hoop", 1984, 450, 2010, 530, true, { side: "left" });
  F("hoop", 2690, 450, 2716, 530, true, { side: "right" });
  F("vault", 2100, 140, 2180, 190);
  F("mat", 2560, 100, 2700, 220, false);
  F("ballCart", 2600, 760, 2680, 820);
  // 도서관
  [860, 940, 1020].forEach((y) => F("bookshelf", 120, y, 420, y + 24));
  F("bookshelfTall", 84, 1100, 260, 1130);
  F("readTable", 520, 860, 640, 920);
  F("readTable", 520, 1000, 640, 1060);
  F("librarianDesk", 660, 1100, 760, 1140);
  F("rug", 470, 820, 690, 1080, false);
  // 중앙 복도
  F("pillar", 880, 760, 920, 800);
  F("pillar", 1400, 760, 1440, 800);
  F("pillar", 880, 1100, 920, 1140);
  F("pillar", 1400, 1100, 1440, 1140);
  F("emergency", 1120, 910, 1200, 990);
  F("noticeBoard", 1000, 1150, 1100, 1178, false);
  // 방송실
  F("console", 1600, 820, 1860, 880);
  F("camera", 1640, 1000, 1680, 1040);
  F("speaker", 1880, 780, 1920, 830);
  F("speaker", 1880, 1120, 1920, 1170);
  F("sofa", 1560, 1120, 1720, 1160);
  // 보건실
  F("bed", 120, 1460, 260, 1540);
  F("bed", 120, 1600, 260, 1680);
  F("curtain", 270, 1440, 280, 1700, false);
  F("medCabinet", 520, 1720, 556, 1810);
  F("nurseDesk", 360, 1740, 460, 1790);
  // 교무실
  F("teacherDesks", 760, 1540, 1000, 1580);
  F("teacherDesks", 760, 1580, 1000, 1620);
  F("cabinet", 800, 1404, 1060, 1436);
  F("copier", 1140, 1700, 1210, 1790);
  F("purifier", 610, 1760, 650, 1810);
  F("mapBoard", 1180, 1460, 1216, 1600);
  // 급식실
  [1480, 1600, 1720].forEach((y) => {
    F("diningTable", 1340, y, 1640, y + 40);
    F("diningTable", 1720, y, 2020, y + 40);
  });
  F("servingCounter", 2160, 1440, 2200, 1720);
  F("stove", 2300, 1440, 2440, 1500);
  F("fridge", 2640, 1440, 2716, 1560);
  F("bigPot", 2300, 1680, 2400, 1760);
  F("sinkK", 2560, 1740, 2700, 1810);
  // 복도
  F("shoeLocker", 2000, 1224, 2200, 1256);
  F("fountain", 1900, 1224, 1940, 1252);
  F("window", 200, 1358, 400, 1362, false);

  // ── 미션 장치 위치 (장소마다 3곳 중 1곳이 플레이어마다 무작위로 정해짐) ──
  const DEVICE_SPOTS = {
    computer:  [{ x: 1330, y: 250 }, { x: 1830, y: 300 }, { x: 1580, y: 500 }],
    science:   [{ x: 600, y: 200 },  { x: 100, y: 300 },  { x: 350, y: 500 }],
    cafeteria: [{ x: 1290, y: 1560 }, { x: 2100, y: 1790 }, { x: 2520, y: 1600 }],
    library:   [{ x: 770, y: 800 },  { x: 100, y: 800 },  { x: 480, y: 1150 }],
    gym:       [{ x: 2010, y: 150 }, { x: 2700, y: 620 }, { x: 2150, y: 870 }],
    broadcast: [{ x: 1540, y: 800 }, { x: 1900, y: 980 }, { x: 1800, y: 1150 }],
    office:    [{ x: 620, y: 1440 }, { x: 1150, y: 1530 }, { x: 880, y: 1760 }],
    nurse:     [{ x: 320, y: 1440 }, { x: 520, y: 1500 }, { x: 200, y: 1780 }],
  };

  // 바깥 장식 (걸어갈 수 없는 곳)
  const COURTYARDS = [R(1980, 940, 2260, 1180), R(2480, 940, 2720, 1180)];

  // ── 격자 만들기 ──
  const walk = new Uint8Array(COLS * ROWS); // 1 = 걸을 수 있음
  // (좌표가 20의 배수가 아니어도 안전하게 칸으로 바꿉니다)
  const markWalk = (r) => {
    for (let cy = Math.floor(r.y / CELL); cy < Math.ceil((r.y + r.h) / CELL); cy++)
      for (let cx = Math.floor(r.x / CELL); cx < Math.ceil((r.x + r.w) / CELL); cx++) walk[cy * COLS + cx] = 1;
  };
  ROOMS.forEach(markWalk);
  CORRIDORS.forEach(markWalk);
  DOORS.forEach(markWalk);

  const isWalkCell = (cx, cy) => cx >= 0 && cy >= 0 && cx < COLS && cy < ROWS && walk[cy * COLS + cx] === 1;
  const SOLID_FURN = FURNITURE.filter((f) => f.solid);

  function circleRect(x, y, r, rx, ry, rw, rh) {
    const nx = clamp(x, rx, rx + rw), ny = clamp(y, ry, ry + rh);
    const dx = x - nx, dy = y - ny;
    return dx * dx + dy * dy < r * r;
  }

  // 원(캐릭터)이 벽·가구·잠긴 문과 겹치는지
  function collides(x, y, r, ignoreDoors = false) {
    if (x - r < 0 || y - r < 0 || x + r > W || y + r > H) return true;
    const c0 = Math.floor((x - r) / CELL), c1 = Math.floor((x + r) / CELL);
    const r0 = Math.floor((y - r) / CELL), r1 = Math.floor((y + r) / CELL);
    for (let cy = r0; cy <= r1; cy++)
      for (let cx = c0; cx <= c1; cx++)
        if (!isWalkCell(cx, cy) && circleRect(x, y, r, cx * CELL, cy * CELL, CELL, CELL)) return true;
    for (const f of SOLID_FURN) {
      if (x + r < f.x || x - r > f.x + f.w || y + r < f.y || y - r > f.y + f.h) continue;
      if (circleRect(x, y, r, f.x, f.y, f.w, f.h)) return true;
    }
    if (!ignoreDoors) {
      for (const d of DOORS) {
        if (d.locked && circleRect(x, y, r, d.x, d.y, d.w, d.h)) return true;
      }
    }
    return false;
  }

  // 벽을 따라 미끄러지도록 x, y 를 나눠서 조금씩 이동
  function moveWithCollision(ent, dx, dy, r, passWalls = false) {
    if (passWalls) {
      ent.x = clamp(ent.x + dx, r, W - r);
      ent.y = clamp(ent.y + dy, r, H - r);
      return;
    }
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 4));
    const sx = dx / steps, sy = dy / steps;
    // 문이 잠길 때 문턱에 서 있었다면, 빠져나갈 수 있도록 잠긴 문은 무시
    const inLockedDoor = collides(ent.x, ent.y, r) && !collides(ent.x, ent.y, r, true);
    for (let i = 0; i < steps; i++) {
      if (sx && !collides(ent.x + sx, ent.y, r, inLockedDoor)) ent.x += sx;
      if (sy && !collides(ent.x, ent.y + sy, r, inLockedDoor)) ent.y += sy;
    }
  }

  // 두 점 사이가 벽에 막혀 있는지 (다른 플레이어가 보이는지 판단)
  function lineOfSight(ax, ay, bx, by) {
    const d = Math.hypot(bx - ax, by - ay);
    const n = Math.ceil(d / 10);
    for (let i = 1; i < n; i++) {
      const x = ax + ((bx - ax) * i) / n, y = ay + ((by - ay) * i) / n;
      if (!isWalkCell(Math.floor(x / CELL), Math.floor(y / CELL))) return false;
    }
    return true;
  }

  function roomAt(x, y) {
    for (const r of ROOMS) if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return r;
    for (const c of CORRIDORS) if (x >= c.x && x < c.x + c.w && y >= c.y && y < c.y + c.h) return c;
    for (const d of DOORS) if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return ROOMS.find((r) => r.id === d.room);
    return null;
  }

  // 시작 위치: 중앙 복도 긴급회의 버튼 둘레에 원형으로
  function getSpawn(index, total) {
    const cx = 1160, cy = 950, rad = 125;
    const a = (index / Math.max(1, total)) * Math.PI * 2 - Math.PI / 2;
    const p = { x: cx + Math.cos(a) * rad, y: cy + Math.sin(a) * rad };
    const r = CONFIG.PLAYER_RADIUS;
    if (!collides(p.x, p.y, r)) return p;
    for (let k = 1; k < 20; k++) {
      for (let t = 0; t < 8; t++) {
        const q = { x: p.x + Math.cos(t) * k * 10, y: p.y + Math.sin(t) * k * 10 };
        if (!collides(q.x, q.y, r)) return q;
      }
    }
    return { x: cx, y: cy + 80 };
  }

  // ─────────────────────────────────────────────────────────────
  // 맵 미리 그리기 (한 번만 그려 두고 매 프레임 잘라서 사용 → 가볍게)
  // ─────────────────────────────────────────────────────────────
  let canvas = null;
  let customBg = null;

  const FLOOR_STYLE = {
    lab:        { base: "#4c6773", line: "#435c67", tile: 40 },
    wood:       { base: "#6d5541", line: "#5c4636", plank: 20 },
    wood2:      { base: "#6a5846", line: "#5a4a3a", plank: 24 },
    carpetBlue: { base: "#32507a", line: "#2d4870", dots: true },
    court:      { base: "#8c6a3f", line: "#7a5c36", plank: 16 },
    carpetWarm: { base: "#6b4a52", line: "#5f414a", dots: true },
    hallTile:   { base: "#475a78", line: "#3d4f6b", checker: "#4d6180", tile: 40 },
    studio:     { base: "#3d3a5a", line: "#35334f", tile: 40 },
    clean:      { base: "#6f8f99", line: "#64838c", tile: 40 },
    kitchen:    { base: "#66767a", line: "#5b6a6e", tile: 30 },
    corridor:   { base: "#3b4a61", line: "#344259", tile: 40 },
  };

  function paintFloor(g, r, style) {
    const s = FLOOR_STYLE[style] || FLOOR_STYLE.corridor;
    g.fillStyle = s.base;
    g.fillRect(r.x, r.y, r.w, r.h);
    g.save();
    g.beginPath(); g.rect(r.x, r.y, r.w, r.h); g.clip();
    g.strokeStyle = s.line; g.lineWidth = 2;
    if (s.checker) {
      g.fillStyle = s.checker;
      for (let y = r.y; y < r.y + r.h; y += s.tile)
        for (let x = r.x; x < r.x + r.w; x += s.tile)
          if (((x - r.x) / s.tile + (y - r.y) / s.tile) % 2 === 0) g.fillRect(x, y, s.tile, s.tile);
    }
    if (s.tile) {
      g.beginPath();
      for (let x = r.x; x <= r.x + r.w; x += s.tile) { g.moveTo(x, r.y); g.lineTo(x, r.y + r.h); }
      for (let y = r.y; y <= r.y + r.h; y += s.tile) { g.moveTo(r.x, y); g.lineTo(r.x + r.w, y); }
      g.stroke();
    }
    if (s.plank) {
      g.beginPath();
      let row = 0;
      for (let y = r.y; y <= r.y + r.h; y += s.plank, row++) {
        g.moveTo(r.x, y); g.lineTo(r.x + r.w, y);
        for (let x = r.x + (row % 2) * 60; x < r.x + r.w; x += 120) { g.moveTo(x, y); g.lineTo(x, y + s.plank); }
      }
      g.stroke();
    }
    if (s.dots) {
      g.fillStyle = s.line;
      for (let y = r.y + 10; y < r.y + r.h; y += 20)
        for (let x = r.x + 10 + ((y / 20) % 2) * 10; x < r.x + r.w; x += 20) g.fillRect(x, y, 3, 3);
    }
    g.restore();
  }

  function roundRect(g, x, y, w, h, rad) {
    g.beginPath();
    g.moveTo(x + rad, y);
    g.arcTo(x + w, y, x + w, y + h, rad);
    g.arcTo(x + w, y + h, x, y + h, rad);
    g.arcTo(x, y + h, x, y, rad);
    g.arcTo(x, y, x + w, y, rad);
    g.closePath();
  }

  function box(g, f, top, side, rad = 4) {
    g.fillStyle = "rgba(0,0,0,0.28)";
    roundRect(g, f.x + 3, f.y + 5, f.w, f.h, rad); g.fill();
    g.fillStyle = side;
    roundRect(g, f.x, f.y, f.w, f.h, rad); g.fill();
    g.fillStyle = top;
    roundRect(g, f.x, f.y, f.w, Math.max(4, f.h - 6), rad); g.fill();
  }

  function paintFurniture(g, f) {
    const { x, y, w, h } = f;
    switch (f.type) {
      case "desk":
        box(g, f, "#c79a63", "#8a6440");
        g.fillStyle = "#e9e4d8"; g.fillRect(x + 12, y + 8, 22, 16); // 공책
        g.fillStyle = "#3e7bfa"; g.fillRect(x + 42, y + 10, 16, 3);
        break;
      case "chair":
        g.fillStyle = "#5c7ea8"; roundRect(g, x, y, w, h, 4); g.fill();
        g.fillStyle = "#4a6890"; g.fillRect(x + 2, y + h - 5, w - 4, 4);
        break;
      case "teacherDesk":
        box(g, f, "#a9794a", "#71512f");
        g.fillStyle = "#f1f1f1"; g.fillRect(x + 14, y + 8, 30, 20);
        g.fillStyle = "#88c"; g.fillRect(x + 60, y + 10, 34, 6);
        break;
      case "blackboard":
        g.fillStyle = "#6b4f33"; g.fillRect(x - 6, y, w + 12, h + 4);
        g.fillStyle = "#1f4a3a"; g.fillRect(x, y + 2, w, h - 2);
        g.strokeStyle = "rgba(255,255,255,0.55)"; g.lineWidth = 2;
        g.beginPath(); g.moveTo(x + 30, y + 9); g.lineTo(x + 90, y + 9); g.moveTo(x + 150, y + 9); g.lineTo(x + 200, y + 9); g.stroke();
        break;
      case "lockers":
        box(g, f, "#7f93ad", "#5b6d86", 2);
        g.strokeStyle = "#4b5b72"; g.lineWidth = 2;
        for (let yy = y + 28; yy < y + h; yy += 28) { g.beginPath(); g.moveTo(x, yy); g.lineTo(x + w, yy); g.stroke(); }
        break;
      case "shelfLab":
        box(g, f, "#8e9aa6", "#5f6b77", 2);
        ["#5ad1c8", "#f5c400", "#e5484d", "#8e4ec6", "#30a46c"].forEach((c, i) => {
          g.fillStyle = c; g.fillRect(x + 16 + i * 44, y + 6, 12, 16);
        });
        break;
      case "microscope":
        box(g, f, "#d6dde4", "#98a4b0", 3);
        g.fillStyle = "#2a3140"; g.fillRect(x + 20, y + 8, 12, 20); g.fillRect(x + 70, y + 8, 12, 20);
        g.fillStyle = "#5ad1c8"; g.beginPath(); g.arc(x + 26, y + 10, 5, 0, 7); g.arc(x + 76, y + 10, 5, 0, 7); g.fill();
        break;
      case "labTable":
        box(g, f, "#dfe6ec", "#1e2733", 4);
        g.fillStyle = "#1e2733"; g.fillRect(x, y, w, 5);
        [[24, "#5ad1c8"], [60, "#f5c400"], [100, "#e5484d"], [134, "#8fcf1f"]].forEach(([dx, c]) => {
          g.fillStyle = "rgba(255,255,255,0.7)"; g.fillRect(x + dx - 7, y + 14, 14, 22);
          g.fillStyle = c; g.fillRect(x + dx - 6, y + 24, 12, 11);
        });
        break;
      case "sink": case "sinkK":
        box(g, f, "#b8c4cc", "#7c8a94", 4);
        g.fillStyle = "#5d6b75"; roundRect(g, x + 6, y + 8, w - 12, h - 20, 6); g.fill();
        break;
      case "pcDesk":
        box(g, f, "#9aa6b5", "#5d6878", 3);
        for (let xx = x + 14; xx < x + w - 30; xx += 56) {
          g.fillStyle = "#11151f"; g.fillRect(xx, y + 4, 34, 20);
          g.fillStyle = "#1c2a3e"; g.fillRect(xx + 3, y + 7, 28, 14);
          g.fillStyle = "#2a3140"; g.fillRect(xx + 6, y + 26, 22, 6);
        }
        break;
      case "serverRack":
        box(g, f, "#2a3142", "#1b2030", 3);
        for (let yy = y + 8; yy < y + h - 8; yy += 10) {
          g.fillStyle = "#39d98a"; g.fillRect(x + 8, yy, 4, 3);
          g.fillStyle = "#4cc9f0"; g.fillRect(x + 16, yy, 4, 3);
        }
        break;
      case "courtLines":
        g.strokeStyle = "rgba(245,240,220,0.55)"; g.lineWidth = 4;
        g.strokeRect(x, y, w, h);
        g.beginPath(); g.moveTo(x + w / 2, y); g.lineTo(x + w / 2, y + h); g.stroke();
        g.beginPath(); g.arc(x + w / 2, y + h / 2, 70, 0, Math.PI * 2); g.stroke();
        g.beginPath(); g.arc(x, y + h / 2, 120, -Math.PI / 2, Math.PI / 2); g.stroke();
        g.beginPath(); g.arc(x + w, y + h / 2, 120, Math.PI / 2, Math.PI * 1.5); g.stroke();
        break;
      case "hoop": {
        box(g, f, "#c9ced6", "#8a929e", 2);
        const cx = f.side === "left" ? x + w + 10 : x - 10;
        g.strokeStyle = "#f76b15"; g.lineWidth = 4;
        g.beginPath(); g.arc(cx, y + h / 2, 11, 0, Math.PI * 2); g.stroke();
        break;
      }
      case "vault":
        box(g, f, "#e7d8b4", "#a8925f", 4);
        g.strokeStyle = "#a8925f"; g.lineWidth = 2;
        for (let yy = y + 12; yy < y + h; yy += 12) { g.beginPath(); g.moveTo(x, yy); g.lineTo(x + w, yy); g.stroke(); }
        break;
      case "mat":
        g.fillStyle = "#3563b8"; roundRect(g, x, y, w, h, 6); g.fill();
        g.strokeStyle = "#2a4f94"; g.lineWidth = 2;
        g.beginPath(); g.moveTo(x + w / 2, y); g.lineTo(x + w / 2, y + h); g.stroke();
        break;
      case "ballCart":
        box(g, f, "#707b8a", "#4c5563", 3);
        [["#f76b15", 16, 14], ["#f5f5f5", 40, 18], ["#f76b15", 62, 12], ["#3e7bfa", 28, 34], ["#f5c400", 54, 36]].forEach(([c, dx, dy]) => {
          g.fillStyle = c; g.beginPath(); g.arc(x + dx, y + dy, 9, 0, 7); g.fill();
        });
        break;
      case "bookshelf": case "bookshelfTall": {
        box(g, f, "#7a5334", "#51361f", 2);
        const colors = ["#e5484d", "#3e7bfa", "#30a46c", "#f5c400", "#8e4ec6", "#f76b15", "#38bdd8"];
        let i = 0;
        for (let xx = x + 4; xx < x + w - 8; xx += 9, i++) {
          g.fillStyle = colors[(i * 3 + Math.floor(xx / 7)) % colors.length];
          g.fillRect(xx, y + 3, 7, h - 9);
        }
        break;
      }
      case "readTable":
        box(g, f, "#b88a5a", "#7a5836", 6);
        g.fillStyle = "#f1eee6"; g.fillRect(x + 16, y + 14, 26, 18); g.fillRect(x + 70, y + 20, 22, 16);
        break;
      case "librarianDesk":
        box(g, f, "#9c7048", "#6a4a2e", 4);
        g.fillStyle = "#11151f"; g.fillRect(x + 12, y + 6, 30, 20);
        g.fillStyle = "#1c2a3e"; g.fillRect(x + 15, y + 9, 24, 14);
        break;
      case "rug":
        g.fillStyle = "rgba(233,61,130,0.18)"; roundRect(g, x, y, w, h, 20); g.fill();
        g.strokeStyle = "rgba(245,196,0,0.25)"; g.lineWidth = 3; roundRect(g, x + 10, y + 10, w - 20, h - 20, 14); g.stroke();
        break;
      case "pillar":
        box(g, f, "#56688a", "#36445e", 3);
        break;
      case "emergency": {
        const cx = x + w / 2, cy = y + h / 2;
        g.fillStyle = "rgba(0,0,0,0.3)"; g.beginPath(); g.ellipse(cx + 3, cy + 6, 42, 40, 0, 0, 7); g.fill();
        g.fillStyle = "#39445c"; g.beginPath(); g.arc(cx, cy, 40, 0, 7); g.fill();
        g.fillStyle = "#56647f"; g.beginPath(); g.arc(cx, cy - 3, 38, 0, 7); g.fill();
        g.fillStyle = "#b8c2d6"; g.beginPath(); g.arc(cx, cy - 3, 20, 0, 7); g.fill();
        g.fillStyle = "#e5484d"; g.beginPath(); g.arc(cx, cy - 6, 14, 0, 7); g.fill();
        g.fillStyle = "#ff8a8e"; g.beginPath(); g.arc(cx - 4, cy - 10, 5, 0, 7); g.fill();
        break;
      }
      case "noticeBoard":
        g.fillStyle = "#8a6440"; g.fillRect(x, y, w, h);
        g.fillStyle = "#c9a26a"; g.fillRect(x + 3, y + 3, w - 6, h - 6);
        ["#f5f5f5", "#ffd6e7", "#d6f5ff"].forEach((c, i) => { g.fillStyle = c; g.fillRect(x + 10 + i * 30, y + 6, 20, 14); });
        break;
      case "console":
        box(g, f, "#394157", "#232a3b", 4);
        for (let xx = x + 16; xx < x + w - 16; xx += 22) {
          g.fillStyle = "#1a1f2c"; g.fillRect(xx, y + 10, 6, 34);
          g.fillStyle = "#4cc9f0"; g.fillRect(xx - 3, y + 16 + ((xx * 7) % 20), 12, 6);
        }
        break;
      case "camera":
        g.fillStyle = "rgba(0,0,0,0.3)"; g.beginPath(); g.ellipse(x + 22, y + 26, 22, 12, 0, 0, 7); g.fill();
        g.fillStyle = "#2a3140"; roundRect(g, x + 4, y + 4, 32, 24, 5); g.fill();
        g.fillStyle = "#11151f"; g.beginPath(); g.arc(x + 20, y + 16, 8, 0, 7); g.fill();
        g.fillStyle = "#4cc9f0"; g.beginPath(); g.arc(x + 20, y + 16, 3, 0, 7); g.fill();
        break;
      case "speaker":
        box(g, f, "#2a3142", "#1b2030", 4);
        g.fillStyle = "#11151f"; g.beginPath(); g.arc(x + w / 2, y + h / 2, 12, 0, 7); g.fill();
        g.fillStyle = "#4b5570"; g.beginPath(); g.arc(x + w / 2, y + h / 2, 5, 0, 7); g.fill();
        break;
      case "sofa":
        box(g, f, "#6c5ba8", "#4b3e7a", 10);
        break;
      case "bed":
        box(g, f, "#eef2f5", "#b8c2cc", 6);
        g.fillStyle = "#ffffff"; roundRect(g, x + 8, y + 10, 30, h - 26, 6); g.fill();
        g.fillStyle = "#7fb3e6"; roundRect(g, x + 46, y + 6, w - 54, h - 18, 6); g.fill();
        break;
      case "curtain":
        g.fillStyle = "rgba(160,220,210,0.55)"; g.fillRect(x, y, w, h);
        break;
      case "medCabinet":
        box(g, f, "#f2f5f7", "#b5c0c8", 3);
        g.fillStyle = "#30a46c"; g.fillRect(x + 14, y + 24, 8, 24); g.fillRect(x + 6, y + 32, 24, 8);
        break;
      case "nurseDesk":
        box(g, f, "#c6d3da", "#8c9ba4", 4);
        g.fillStyle = "#30a46c"; g.fillRect(x + 12, y + 10, 18, 14);
        break;
      case "teacherDesks":
        box(g, f, "#a47c52", "#6e5234", 3);
        for (let xx = x + 16; xx < x + w; xx += 60) {
          g.fillStyle = "#11151f"; g.fillRect(xx, y + 6, 26, 16);
          g.fillStyle = "#f1eee6"; g.fillRect(xx + 32, y + 10, 16, 12);
        }
        break;
      case "cabinet":
        box(g, f, "#8a96a6", "#5b6676", 2);
        g.strokeStyle = "#5b6676"; g.lineWidth = 2;
        for (let xx = x + 52; xx < x + w; xx += 52) { g.beginPath(); g.moveTo(xx, y); g.lineTo(xx, y + h); g.stroke(); }
        break;
      case "copier":
        box(g, f, "#d7dce2", "#98a0aa", 4);
        g.fillStyle = "#2a3140"; g.fillRect(x + 10, y + 12, w - 20, 10);
        g.fillStyle = "#39d98a"; g.fillRect(x + w - 16, y + 30, 6, 6);
        break;
      case "purifier": case "fountain":
        box(g, f, "#dfe8ee", "#9fb1bd", 6);
        g.fillStyle = "#4cc9f0"; g.fillRect(x + 10, y + 8, w - 20, 10);
        break;
      case "mapBoard":
        g.fillStyle = "#6b4f33"; g.fillRect(x, y, w, h);
        g.fillStyle = "#f1eee6"; g.fillRect(x + 4, y + 4, w - 8, h - 8);
        g.strokeStyle = "#3e7bfa"; g.lineWidth = 2; g.strokeRect(x + 9, y + 14, w - 18, 34);
        g.strokeStyle = "#e5484d"; g.beginPath(); g.moveTo(x + 12, y + 70); g.lineTo(x + w - 10, y + 110); g.stroke();
        break;
      case "diningTable":
        box(g, f, "#c9ced6", "#8a929e", 6);
        for (let xx = x + 22; xx < x + w - 10; xx += 46) {
          g.fillStyle = "#e7ebef"; roundRect(g, xx - 12, y + 7, 26, 20, 4); g.fill();
        }
        break;
      case "servingCounter":
        box(g, f, "#b5bec6", "#78838d", 3);
        for (let yy = y + 20; yy < y + h - 10; yy += 50) {
          g.fillStyle = "#e7ebef"; g.fillRect(x + 6, yy, w - 12, 30);
          g.fillStyle = "#f5c400"; g.fillRect(x + 10, yy + 6, w - 20, 8);
        }
        break;
      case "stove":
        box(g, f, "#56606c", "#39414b", 4);
        [30, 70, 110].forEach((dx) => { g.strokeStyle = "#11151f"; g.lineWidth = 4; g.beginPath(); g.arc(x + dx, y + 26, 13, 0, 7); g.stroke(); });
        break;
      case "fridge":
        box(g, f, "#e3e9ee", "#a8b3bc", 4);
        g.fillStyle = "#a8b3bc"; g.fillRect(x + 6, y + 50, w - 12, 3);
        break;
      case "bigPot":
        g.fillStyle = "rgba(0,0,0,0.3)"; g.beginPath(); g.ellipse(x + w / 2 + 3, y + h / 2 + 6, 44, 34, 0, 0, 7); g.fill();
        g.fillStyle = "#8a96a6"; g.beginPath(); g.ellipse(x + w / 2, y + h / 2, 46, 36, 0, 0, 7); g.fill();
        g.fillStyle = "#d9dee4"; g.beginPath(); g.ellipse(x + w / 2, y + h / 2 - 3, 38, 28, 0, 0, 7); g.fill();
        break;
      case "shoeLocker":
        box(g, f, "#8a6a4a", "#5e4630", 2);
        g.strokeStyle = "#5e4630"; g.lineWidth = 2;
        for (let xx = x + 25; xx < x + w; xx += 25) { g.beginPath(); g.moveTo(xx, y); g.lineTo(xx, y + h); g.stroke(); }
        break;
      case "window":
        break;
      default:
        box(g, f, "#8a96a6", "#5b6676");
    }
  }

  function paintTree(g, x, y, r) {
    g.fillStyle = "rgba(0,0,0,0.35)"; g.beginPath(); g.ellipse(x + 4, y + 8, r, r * 0.8, 0, 0, 7); g.fill();
    g.fillStyle = "#1f5a3a"; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    g.fillStyle = "#2c7a4f"; g.beginPath(); g.arc(x - r * 0.3, y - r * 0.3, r * 0.6, 0, 7); g.fill();
  }

  function build() {
    canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const g = canvas.getContext("2d");

    // 바깥 (밤하늘 같은 운동장 바닥)
    g.fillStyle = "#070b16"; g.fillRect(0, 0, W, H);
    g.fillStyle = "rgba(90,120,180,0.08)";
    for (let i = 0; i < 500; i++) g.fillRect((i * 733) % W, (i * 389) % H, 2, 2);

    // 중정 (화단)
    COURTYARDS.forEach((c) => {
      g.fillStyle = "#16301f"; g.fillRect(c.x, c.y, c.w, c.h);
      g.fillStyle = "#1c3b27";
      for (let yy = c.y; yy < c.y + c.h; yy += 12) for (let xx = c.x + ((yy / 12) % 2) * 6; xx < c.x + c.w; xx += 12) g.fillRect(xx, yy, 3, 3);
      paintTree(g, c.x + 60, c.y + 70, 34);
      paintTree(g, c.x + c.w - 70, c.y + c.h - 70, 30);
      paintTree(g, c.x + c.w / 2, c.y + c.h / 2 + 10, 22);
    });

    // 바닥
    CORRIDORS.forEach((c) => paintFloor(g, c, c.floor));
    ROOMS.forEach((r) => paintFloor(g, r, r.floor));
    DOORS.forEach((d) => paintFloor(g, d, "corridor"));

    // 벽 (바닥에서 2칸 이내의 막힌 칸)
    const near = (cx, cy) => {
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (isWalkCell(cx + dx, cy + dy)) return true;
      return false;
    };
    for (let cy = 0; cy < ROWS; cy++) {
      for (let cx = 0; cx < COLS; cx++) {
        if (isWalkCell(cx, cy) || !near(cx, cy)) continue;
        const x = cx * CELL, y = cy * CELL;
        g.fillStyle = "#1a2236"; g.fillRect(x, y, CELL, CELL);
        if (isWalkCell(cx, cy + 1)) { // 벽 앞면 (입체감)
          g.fillStyle = "#2b3857"; g.fillRect(x, y + 4, CELL, CELL - 4);
          g.fillStyle = "#34446a"; g.fillRect(x, y + 4, CELL, 3);
        }
      }
    }
    // 네온 테두리
    g.strokeStyle = "rgba(76,201,240,0.38)"; g.lineWidth = 2;
    g.beginPath();
    for (let cy = 0; cy < ROWS; cy++) {
      for (let cx = 0; cx < COLS; cx++) {
        if (!isWalkCell(cx, cy)) continue;
        const x = cx * CELL, y = cy * CELL;
        if (!isWalkCell(cx, cy - 1)) { g.moveTo(x, y); g.lineTo(x + CELL, y); }
        if (!isWalkCell(cx, cy + 1)) { g.moveTo(x, y + CELL); g.lineTo(x + CELL, y + CELL); }
        if (!isWalkCell(cx - 1, cy)) { g.moveTo(x, y); g.lineTo(x, y + CELL); }
        if (!isWalkCell(cx + 1, cy)) { g.moveTo(x + CELL, y); g.lineTo(x + CELL, y + CELL); }
      }
    }
    g.stroke();

    // 문틀
    DOORS.forEach((d) => {
      g.fillStyle = "#8aa0c8";
      if (d.horizontal) { g.fillRect(d.x - 4, d.y, 6, d.h); g.fillRect(d.x + d.w - 2, d.y, 6, d.h); }
      else { g.fillRect(d.x, d.y - 4, d.w, 6); g.fillRect(d.x, d.y + d.h - 2, d.w, 6); }
      g.fillStyle = "rgba(245,196,0,0.25)";
      if (d.horizontal) g.fillRect(d.x + 2, d.y + d.h / 2 - 2, d.w - 4, 4);
      else g.fillRect(d.x + d.w / 2 - 2, d.y + 2, 4, d.h - 4);
    });

    // 가구
    FURNITURE.filter((f) => !f.solid).forEach((f) => paintFurniture(g, f));
    FURNITURE.filter((f) => f.solid).forEach((f) => paintFurniture(g, f));

    // 방 이름 표지판
    g.textAlign = "center"; g.textBaseline = "middle";
    ROOMS.forEach((r) => {
      const label = r.name;
      g.font = "bold 22px 'Jua', 'Noto Sans KR', sans-serif";
      const tw = g.measureText(label).width + 28;
      const lx = r.x + r.w / 2, ly = r.id === "hall" ? r.y + r.h - 64 : r.y + r.h - 20;
      g.fillStyle = "rgba(8,12,26,0.62)"; roundRect(g, lx - tw / 2, ly - 16, tw, 32, 10); g.fill();
      g.strokeStyle = "rgba(76,201,240,0.55)"; g.lineWidth = 2; roundRect(g, lx - tw / 2, ly - 16, tw, 32, 10); g.stroke();
      g.fillStyle = "#cfefff"; g.fillText(label, lx, ly + 1);
    });

    // 직접 그린 배경 그림이 있으면 사용
    const img = new Image();
    img.onload = () => { customBg = img; };
    img.src = "assets/images/map.png";
  }

  function getCanvas() {
    if (!canvas) build();
    return customBg || canvas;
  }

  return {
    W, H, CELL, ROOMS, CORRIDORS, DOORS, FURNITURE, DEVICE_SPOTS,
    collides, moveWithCollision, lineOfSight, roomAt, getSpawn, getCanvas,
    isWalkCell, roundRect,
  };
})();
