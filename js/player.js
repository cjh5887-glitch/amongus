/* =====================================================================
   player.js — 캐릭터 그리기 · 내 캐릭터 이동 · 다른 플레이어 위치 보간

   캐릭터 디자인: 둥근 머리 + 얼굴 + 후드티 + 백팩 (독창적인 학생 캐릭터)
   ===================================================================== */

const Player = (() => {
  // ── 내 캐릭터 ──
  const me = { x: 0, y: 0, dir: 1, moving: false, walk: 0, passWalls: false, ghost: false };

  // ── 다른 플레이어 (id → 상태) ──
  const others = new Map();

  function speed(settings) {
    const mult = CONFIG.SPEED_MULT[(settings && settings.speed) || "normal"] || 1;
    return CONFIG.SPEED_BASE * mult;
  }

  // 내 캐릭터 이동 (입력 방향 벡터 v: 길이 0~1)
  function updateMe(dt, v, settings) {
    const len = Math.hypot(v.x, v.y);
    me.moving = len > 0.05;
    if (me.moving) {
      // 방향 벡터 길이는 최대 1 (대각선도 같은 속도)
      const k = len > 1 ? 1 / len : 1;
      const sp = speed(settings) * dt;
      // 유령은 벽을 통과합니다
      GameMap.moveWithCollision(me, v.x * k * sp, v.y * k * sp, CONFIG.PLAYER_RADIUS, me.passWalls || me.ghost);
      if (Math.abs(v.x) > 0.1) me.dir = v.x > 0 ? 1 : -1;
      me.walk += dt * 10;
    }
  }

  function placeMe(p) {
    me.x = p.x; me.y = p.y; me.moving = false;
  }

  // 서버에서 받은 위치 목록 반영
  function applyPositions(all, myId) {
    const seen = new Set();
    Object.keys(all).forEach((id) => {
      if (id === myId) return;
      const p = all[id];
      if (!p || typeof p.x !== "number") return;
      seen.add(id);
      let o = others.get(id);
      if (!o) { o = { x: p.x, y: p.y, tx: p.x, ty: p.y, dir: 1, moving: false, walk: 0 }; others.set(id, o); }
      // 너무 멀리 떨어지면(순간이동, 게임 재시작) 바로 이동
      if (Math.hypot(p.x - o.x, p.y - o.y) > 300) { o.x = p.x; o.y = p.y; }
      o.tx = p.x; o.ty = p.y; o.dir = p.d || o.dir; o.moving = !!p.m; o.t = p.t;
    });
    Array.from(others.keys()).forEach((id) => { if (!seen.has(id)) others.delete(id); });
  }

  // 다른 플레이어를 부드럽게 따라가기
  function updateOthers(dt) {
    const k = 1 - Math.exp(-dt * 12);
    others.forEach((o) => {
      o.x += (o.tx - o.x) * k;
      o.y += (o.ty - o.y) * k;
      if (o.moving) o.walk += dt * 10;
    });
  }

  // ─────────────────────────────────────────────────────────────
  // 캐릭터 그리기  (x, y = 발 아래 중심 근처)
  // ─────────────────────────────────────────────────────────────
  function drawCharacter(g, x, y, colorHex, opt = {}) {
    const dir = opt.dir || 1;
    const walk = opt.walk || 0;
    const moving = !!opt.moving;
    const s = opt.scale || 1;
    const alpha = opt.alpha == null ? 1 : opt.alpha;
    const bob = moving ? Math.sin(walk) * 1.6 : 0;
    const step = moving ? Math.sin(walk) * 3 : 0;
    const body = colorHex, dark = shade(colorHex, -0.3), light = shade(colorHex, 0.25);

    const ghost = !!opt.ghost;
    g.save();
    g.globalAlpha = alpha;
    g.translate(x, y);
    g.scale(s, s);

    if (ghost) {
      // 유령: 둥실둥실 떠 있고, 발 대신 물결 모양 꼬리
      const float = Math.sin((opt.time || performance.now()) / 400) * 3;
      g.translate(0, float - 4);
      g.fillStyle = "rgba(200,220,255,0.35)";
      g.beginPath();
      g.moveTo(-12, 4);
      for (let i = 0; i <= 6; i++) g.quadraticCurveTo(-12 + i * 4 + 2, 20 + (i % 2 ? 4 : -2), -12 + (i + 1) * 4, 14);
      g.lineTo(12, 4); g.closePath(); g.fill();
    } else {
      // 그림자
      g.fillStyle = "rgba(0,0,0,0.35)";
      g.beginPath(); g.ellipse(0, 16, 15, 5, 0, 0, Math.PI * 2); g.fill();

      // 발
      g.fillStyle = "#23283a";
      g.beginPath(); g.ellipse(-6, 14 + step * 0.5, 5, 3.5, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(6, 14 - step * 0.5, 5, 3.5, 0, 0, Math.PI * 2); g.fill();
    }

    g.translate(0, bob);

    // 백팩 (몸 뒤쪽)
    g.fillStyle = dark;
    GameMap.roundRect(g, -dir * 17 - 5, -8, 10, 18, 4); g.fill();
    g.fillStyle = shade(colorHex, -0.45);
    g.fillRect(-dir * 17 - 3, -2, 6, 2);

    // 몸 (후드티)
    g.fillStyle = body;
    GameMap.roundRect(g, -12, -9, 24, 23, 8); g.fill();
    g.fillStyle = light;
    g.fillRect(-1, -6, 2, 15);                  // 지퍼
    g.fillStyle = dark;
    GameMap.roundRect(g, -8, 5, 16, 6, 3); g.fill(); // 주머니
    // 팔
    g.fillStyle = body;
    g.beginPath(); g.ellipse(-12, 1 + step * 0.4, 4, 7, 0.2, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(12, 1 - step * 0.4, 4, 7, -0.2, 0, Math.PI * 2); g.fill();

    // 후드 (머리 뒤)
    g.fillStyle = dark;
    g.beginPath(); g.ellipse(0, -14, 15, 10, 0, 0, Math.PI * 2); g.fill();

    // 머리
    g.fillStyle = "#f3cda6";
    g.beginPath(); g.arc(0, -19, 12, 0, Math.PI * 2); g.fill();
    // 머리카락
    g.fillStyle = "#2c2433";
    g.beginPath(); g.arc(0, -21, 12.5, Math.PI * 1.02, Math.PI * 1.98); g.fill();
    g.beginPath(); g.ellipse(dir * 4, -27, 9, 5, dir * 0.3, 0, Math.PI * 2); g.fill();
    // 눈
    const ex = dir * 2.5;
    g.fillStyle = "#1d1b26";
    g.beginPath(); g.ellipse(ex - 4.5, -18, 1.8, 2.4, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(ex + 4.5, -18, 1.8, 2.4, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#fff";
    g.fillRect(ex - 5, -19.5, 1, 1); g.fillRect(ex + 4, -19.5, 1, 1);
    // 볼
    g.fillStyle = "rgba(240,120,130,0.45)";
    g.beginPath(); g.ellipse(ex - 7, -14, 2.6, 1.6, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(ex + 7, -14, 2.6, 1.6, 0, 0, Math.PI * 2); g.fill();
    // 입
    g.strokeStyle = "#7a3b3b"; g.lineWidth = 1.2;
    g.beginPath(); g.arc(ex, -14.5, 2.4, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
    // 후드 끈
    g.strokeStyle = light; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(-4, -8); g.lineTo(-4, -2); g.moveTo(4, -8); g.lineTo(4, -2); g.stroke();

    // 유령 후광
    if (ghost) {
      g.strokeStyle = "rgba(255,255,220,0.9)"; g.lineWidth = 2;
      g.beginPath(); g.ellipse(0, -34, 9, 3, 0, 0, Math.PI * 2); g.stroke();
    }

    // 얼음 (얼리기) — 무섭지 않게 반짝이는 얼음 상자
    if (opt.frozen) {
      g.fillStyle = "rgba(170,230,255,0.45)";
      g.strokeStyle = "rgba(230,250,255,0.95)"; g.lineWidth = 2;
      GameMap.roundRect(g, -18, -36, 36, 54, 6); g.fill(); g.stroke();
      g.strokeStyle = "rgba(255,255,255,0.8)"; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(-12, -28); g.lineTo(-4, -20); g.moveTo(8, 4); g.lineTo(13, 10); g.stroke();
      const tw = (performance.now() / 150) % 6;
      g.fillStyle = "#fff";
      [[-10, -30], [12, -14], [-6, 10]].forEach(([sx, sy], i) => {
        const r = 1.5 + ((tw + i * 2) % 6 < 3 ? 1.5 : 0);
        g.beginPath(); g.arc(sx, sy, r, 0, Math.PI * 2); g.fill();
      });
    }

    g.restore();
  }

  function drawName(g, x, y, text, isMe) {
    g.save();
    g.font = "bold 14px 'Noto Sans KR', sans-serif";
    g.textAlign = "center"; g.textBaseline = "bottom";
    g.lineWidth = 4; g.strokeStyle = "rgba(5,8,18,0.9)";
    g.strokeText(text, x, y - 34);
    g.fillStyle = isMe ? "#ffe066" : "#ffffff";
    g.fillText(text, x, y - 34);
    g.restore();
  }

  return { me, others, updateMe, placeMe, applyPositions, updateOthers, drawCharacter, drawName, speed };
})();
