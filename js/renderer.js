/* =====================================================================
   renderer.js — 게임 화면 그리기 (카메라 · 캐릭터 · 시야)
   requestAnimationFrame 으로 매 프레임 그리며, 매 프레임 새 DOM 은 만들지 않습니다.
   ===================================================================== */

const Renderer = (() => {
  let canvas, ctx, fog, fogCtx;
  let cssW = 0, cssH = 0, dpr = 1, scale = 1;
  const cam = { x: 0, y: 0 };
  const debug = { showCollision: false, noFog: false, showAllMissions: false };

  function init() {
    canvas = document.getElementById("game-canvas");
    ctx = canvas.getContext("2d");
    fog = document.createElement("canvas");
    fogCtx = fog.getContext("2d");
    window.addEventListener("resize", resize);
    window.addEventListener("orientationchange", () => setTimeout(resize, 200));
    resize();
  }

  function resize() {
    cssW = window.innerWidth; cssH = window.innerHeight;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr);
    canvas.style.width = cssW + "px"; canvas.style.height = cssH + "px";
    fog.width = canvas.width; fog.height = canvas.height;
    // 어떤 화면 크기에서도 비슷한 넓이의 학교가 보이도록 확대 비율 계산
    scale = clamp(Math.min(cssW / 1000, cssH / 600), 0.55, 1.6);
  }

  function worldToScreen(x, y) {
    return { x: (x - cam.x) * scale + cssW / 2, y: (y - cam.y) * scale + cssH / 2 };
  }

  function updateCamera(tx, ty) {
    const halfW = cssW / 2 / scale, halfH = cssH / 2 / scale;
    cam.x = GameMap.W > halfW * 2 ? clamp(tx, halfW, GameMap.W - halfW) : GameMap.W / 2;
    cam.y = GameMap.H > halfH * 2 ? clamp(ty, halfH, GameMap.H - halfH) : GameMap.H / 2;
  }

  // view: { me:{x,y,dir,moving,walk,color,nick}, others:[{x,y,...,visible alpha}], visionRadius }
  function draw(view) {
    const me = view.me;
    updateCamera(me.x, me.y);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#070b16";
    ctx.fillRect(0, 0, cssW, cssH);

    // ── 맵 (미리 그린 그림에서 보이는 부분만 잘라서) ──
    const halfW = cssW / 2 / scale, halfH = cssH / 2 / scale;
    const sx = cam.x - halfW, sy = cam.y - halfH, sw = halfW * 2, sh = halfH * 2;
    const src = GameMap.getCanvas();
    const cx0 = Math.max(0, sx), cy0 = Math.max(0, sy);
    const cx1 = Math.min(GameMap.W, sx + sw), cy1 = Math.min(GameMap.H, sy + sh);
    if (cx1 > cx0 && cy1 > cy0) {
      ctx.drawImage(src, cx0, cy0, cx1 - cx0, cy1 - cy0,
        (cx0 - sx) * scale, (cy0 - sy) * scale, (cx1 - cx0) * scale, (cy1 - cy0) * scale);
    }

    // ── 월드 좌표로 그리기 ──
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * (cssW / 2 - cam.x * scale), dpr * (cssH / 2 - cam.y * scale));

    // 잠긴 문 (다음 단계 「문 잠금」에서 사용)
    GameMap.DOORS.forEach((d) => {
      if (!d.locked) return;
      ctx.fillStyle = "rgba(229,72,77,0.85)";
      ctx.fillRect(d.x, d.y, d.w, d.h);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 18px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("🔒", d.x + d.w / 2, d.y + d.h / 2);
    });

    // 미션 장치 · 성공 빛 (2단계)
    if (view.devices) drawDevices(view.devices);
    if (view.effects) drawEffects(view.effects);

    // 캐릭터 (아래쪽에 있는 캐릭터를 나중에 그려서 겹침이 자연스럽게)
    const list = view.others.filter((o) => o.alpha > 0.01).map((o) => ({ ...o, isMe: false }));
    list.push({ ...me, alpha: 1, isMe: true });
    list.sort((a, b) => a.y - b.y);
    // 긴급회의 버튼 앞에 서 있으면 버튼이 빛남
    if (view.emergencyGlow) {
      const t = performance.now() / 1000;
      ctx.fillStyle = `rgba(255,90,106,${0.25 + 0.2 * Math.sin(t * 5)})`;
      ctx.beginPath(); ctx.arc(CONFIG.EMERGENCY.x, CONFIG.EMERGENCY.y - 4, 58, 0, Math.PI * 2); ctx.fill();
    }
    list.forEach((p) => Player.drawCharacter(ctx, p.x, p.y, p.color, { dir: p.dir, walk: p.walk, moving: p.moving, alpha: p.alpha, ghost: p.ghost, frozen: p.frozen }));

    if (debug.showCollision) drawCollisionDebug();

    // ── 시야 (주변만 밝게) ──
    if (!debug.noFog) {
      const p = worldToScreen(me.x, me.y);
      const r = view.visionRadius * scale;
      fogCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      fogCtx.globalCompositeOperation = "source-over";
      fogCtx.clearRect(0, 0, cssW, cssH);
      fogCtx.fillStyle = `rgba(3,6,18,${view.darkness || CONFIG.DARKNESS})`;
      fogCtx.fillRect(0, 0, cssW, cssH);
      fogCtx.globalCompositeOperation = "destination-out";
      const grad = fogCtx.createRadialGradient(p.x, p.y, r * 0.25, p.x, p.y, r);
      grad.addColorStop(0, "rgba(0,0,0,1)");
      grad.addColorStop(0.7, "rgba(0,0,0,0.9)");
      grad.addColorStop(1, "rgba(0,0,0,0)");
      fogCtx.fillStyle = grad;
      fogCtx.beginPath(); fogCtx.arc(p.x, p.y, r, 0, Math.PI * 2); fogCtx.fill();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(fog, 0, 0);
    }

    // ── 이름표 (시야 위에 또렷하게) ──
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * (cssW / 2 - cam.x * scale), dpr * (cssH / 2 - cam.y * scale));
    list.forEach((p) => {
      if (p.alpha < 0.2) return;
      Player.drawName(ctx, p.x, p.y - (p.ghost ? 4 : 0), p.nick, p.isMe);
    });
    // 내 미션 장치 표시는 어둠 위에도 살짝 보이게 (찾기 쉽도록)
    if (view.devices) view.devices.forEach((d) => { if (d.state === "mine") drawBadge(d, 0.55); });

    // 가까운 미션 방향 화살표 (화면 밖에 있을 때만)
    if (view.hint) drawHintArrow(view.hint);
  }

  // ── 미션 장치 ──
  function drawDevices(list) {
    const t = performance.now() / 1000;
    list.forEach((d) => {
      const x = d.x, y = d.y;
      ctx.save();
      // 받침
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.beginPath(); ctx.ellipse(x + 2, y + 12, 22, 7, 0, 0, Math.PI * 2); ctx.fill();
      const colors = {
        idle: ["#3a4458", "#586580"], mine: ["#5a4a10", "#ffd23f"], done: ["#10402a", "#39d98a"],
        cool: ["#4a2a10", "#f76b15"], debug: ["#3a1a50", "#b388ff"], help: ["#0a3a4a", "#4cc9f0"],
      }[d.state] || ["#3a4458", "#586580"];
      if (d.state === "mine") {
        const pulse = 0.5 + 0.5 * Math.sin(t * 4);
        ctx.fillStyle = `rgba(255,210,63,${0.18 + pulse * 0.22})`;
        ctx.beginPath(); ctx.arc(x, y, 34 + pulse * 6, 0, Math.PI * 2); ctx.fill();
      }
      if (d.state === "done") {
        ctx.fillStyle = "rgba(57,217,138,0.18)";
        ctx.beginPath(); ctx.arc(x, y, 34, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = colors[0];
      GameMap.roundRect(ctx, x - 20, y - 16, 40, 30, 7); ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = colors[1];
      GameMap.roundRect(ctx, x - 20, y - 16, 40, 30, 7); ctx.stroke();
      ctx.globalAlpha = d.state === "idle" ? 0.45 : 1;
      ctx.font = "18px 'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(d.icon, x, y - 1);
      ctx.globalAlpha = 1;
      // 고장 표시 (깜빡이는 빨간 불)
      if (d.state === "idle" || d.state === "mine") {
        ctx.fillStyle = Math.sin(t * 6 + x) > 0 ? "#ff5a6a" : "#5a1a20";
        ctx.beginPath(); ctx.arc(x + 15, y - 11, 3, 0, Math.PI * 2); ctx.fill();
      }
      if (d.label) {
        ctx.font = "bold 12px 'Noto Sans KR',sans-serif"; ctx.fillStyle = "#e3d4ff";
        ctx.fillText(d.label, x, y + 26);
      }
      ctx.restore();
    });
  }

  function drawBadge(d, alpha) {
    const t = performance.now() / 1000;
    const bob = Math.sin(t * 4) * 3;
    ctx.save();
    ctx.globalAlpha = alpha + 0.45;
    ctx.fillStyle = "#ffd23f";
    ctx.beginPath(); ctx.arc(d.x, d.y - 34 + bob, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#1a1400"; ctx.font = "bold 16px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("!", d.x, d.y - 33 + bob);
    ctx.restore();
  }

  function drawEffects(list) {
    const now = performance.now();
    list.forEach((e) => {
      const p = (now - e.t0) / 1200;
      ctx.save();
      ctx.strokeStyle = `rgba(57,217,138,${1 - p})`;
      ctx.lineWidth = 6 * (1 - p) + 1;
      ctx.beginPath(); ctx.arc(e.x, e.y, 20 + p * 160, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = `rgba(160,255,210,${0.35 * (1 - p)})`;
      ctx.beginPath(); ctx.arc(e.x, e.y, 20 + p * 90, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    });
  }

  function drawHintArrow(h) {
    const s = worldToScreen(h.x, h.y);
    const m = 70;
    if (s.x > m && s.x < cssW - m && s.y > m && s.y < cssH - m) return; // 화면 안이면 표시 안 함
    const c = { x: cssW / 2, y: cssH / 2 };
    const ang = Math.atan2(s.y - c.y, s.x - c.x);
    const hx = cssW / 2 - m, hy = cssH / 2 - m;
    const k = Math.min(hx / Math.abs(Math.cos(ang) || 1e-6), hy / Math.abs(Math.sin(ang) || 1e-6));
    const ax = c.x + Math.cos(ang) * k, ay = c.y + Math.sin(ang) * k;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(ang);
    ctx.globalAlpha = 0.75 + 0.25 * Math.sin(performance.now() / 200);
    ctx.fillStyle = "#ffd23f";
    ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-10, -12); ctx.lineTo(-4, 0); ctx.lineTo(-10, 12); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function drawCollisionDebug() {
    ctx.fillStyle = "rgba(255,0,80,0.25)";
    const halfW = cssW / 2 / scale, halfH = cssH / 2 / scale;
    const c0 = Math.max(0, Math.floor((cam.x - halfW) / GameMap.CELL)), c1 = Math.min(GameMap.W / GameMap.CELL, Math.ceil((cam.x + halfW) / GameMap.CELL));
    const r0 = Math.max(0, Math.floor((cam.y - halfH) / GameMap.CELL)), r1 = Math.min(GameMap.H / GameMap.CELL, Math.ceil((cam.y + halfH) / GameMap.CELL));
    for (let cy = r0; cy < r1; cy++)
      for (let cx = c0; cx < c1; cx++)
        if (!GameMap.isWalkCell(cx, cy)) ctx.fillRect(cx * GameMap.CELL, cy * GameMap.CELL, GameMap.CELL, GameMap.CELL);
    ctx.strokeStyle = "rgba(255,230,0,0.9)"; ctx.lineWidth = 2;
    GameMap.FURNITURE.forEach((f) => { if (f.solid) ctx.strokeRect(f.x, f.y, f.w, f.h); });
    ctx.strokeStyle = "rgba(0,255,160,0.9)";
    ctx.beginPath(); ctx.arc(Player.me.x, Player.me.y, CONFIG.PLAYER_RADIUS, 0, Math.PI * 2); ctx.stroke();
  }

  // ── 학교 지도 (M) : 현재 위치 · 교실 이름 · 내 미션 위치만 (다른 플레이어는 표시 안 함) ──
  function drawMinimap(mm, me, missions) {
    const maxW = Math.min(window.innerWidth - 40, 1000), maxH = window.innerHeight - 90;
    const k = Math.min(maxW / GameMap.W, maxH / GameMap.H);
    const w = Math.round(GameMap.W * k), h = Math.round(GameMap.H * k);
    const r = Math.min(2, window.devicePixelRatio || 1);
    if (mm.width !== Math.round(w * r)) { mm.width = Math.round(w * r); mm.height = Math.round(h * r); mm.style.width = w + "px"; mm.style.height = h + "px"; }
    const g = mm.getContext("2d");
    g.setTransform(r, 0, 0, r, 0, 0);
    g.globalAlpha = 1;
    g.drawImage(GameMap.getCanvas(), 0, 0, w, h);
    g.fillStyle = "rgba(5,10,24,0.35)"; g.fillRect(0, 0, w, h);
    g.textAlign = "center"; g.textBaseline = "middle";
    g.font = `bold ${Math.max(12, Math.round(34 * k))}px 'Noto Sans KR',sans-serif`;
    GameMap.ROOMS.forEach((rm) => {
      g.lineWidth = 4; g.strokeStyle = "rgba(0,0,0,0.8)";
      g.strokeText(rm.name, (rm.x + rm.w / 2) * k, (rm.y + rm.h / 2) * k);
      g.fillStyle = "#e9f8ff";
      g.fillText(rm.name, (rm.x + rm.w / 2) * k, (rm.y + rm.h / 2) * k);
    });
    missions.forEach((m) => {
      const x = m.x * k, y = m.y * k;
      g.fillStyle = m.done ? "#39d98a" : "#ffd23f";
      g.beginPath(); g.arc(x, y, 9, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#101010"; g.font = "bold 12px sans-serif";
      g.fillText(m.done ? "✓" : "!", x, y + 1);
    });
    const pulse = 6 + 3 * Math.sin(performance.now() / 180);
    g.fillStyle = "rgba(76,201,240,0.35)";
    g.beginPath(); g.arc(me.x * k, me.y * k, pulse + 6, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#4cc9f0"; g.strokeStyle = "#fff"; g.lineWidth = 2;
    g.beginPath(); g.arc(me.x * k, me.y * k, 7, 0, Math.PI * 2); g.fill(); g.stroke();
  }

  // ── 게임 종료 연출 ──
  //  학생 승리: 중앙 복도부터 교실까지 조명이 차례로 켜짐
  //  방해꾼 승리: 켜져 있던 조명이 차례로 꺼짐 (무섭지 않게 천천히)
  let endDark = null;
  function drawEnding(cv, elapsed, studentsWin) {
    const w = window.innerWidth, h = window.innerHeight, r = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(w * r) || cv.height !== Math.round(h * r)) { cv.width = Math.round(w * r); cv.height = Math.round(h * r); }
    const g = cv.getContext("2d");
    g.setTransform(r, 0, 0, r, 0, 0);
    g.fillStyle = "#05070f"; g.fillRect(0, 0, w, h);
    const k = Math.min(w / GameMap.W, h / GameMap.H) * 0.96;
    const ox = (w - GameMap.W * k) / 2, oy = (h - GameMap.H * k) / 2;
    g.drawImage(GameMap.getCanvas(), ox, oy, GameMap.W * k, GameMap.H * k);

    // 방 순서: 중앙 복도에서 가까운 곳부터
    const cx = CONFIG.EMERGENCY.x, cy = CONFIG.EMERGENCY.y;
    const areas = GameMap.CORRIDORS.concat(GameMap.ROOMS)
      .map((a) => ({ a, d: Math.hypot(a.x + a.w / 2 - cx, a.y + a.h / 2 - cy) }))
      .sort((p, q) => p.d - q.d).map((p) => p.a);
    const span = CONFIG.ENDING_MS * 0.8, each = span / areas.length;
    const prog = (i) => clamp((elapsed - i * each) / 350, 0, 1);

    if (!endDark) endDark = document.createElement("canvas");
    endDark.width = cv.width; endDark.height = cv.height;
    const d = endDark.getContext("2d");
    d.setTransform(r, 0, 0, r, 0, 0);
    if (studentsWin) {
      d.fillStyle = "rgba(3,6,18,0.86)"; d.fillRect(0, 0, w, h);
      d.globalCompositeOperation = "destination-out";
      areas.forEach((a, i) => { const p = prog(i); if (p > 0) { d.globalAlpha = p; d.fillRect(ox + a.x * k, oy + a.y * k, a.w * k, a.h * k); } });
      d.globalAlpha = 1; d.globalCompositeOperation = "source-over";
      g.drawImage(endDark, 0, 0, w, h);
      // 따뜻한 불빛
      areas.forEach((a, i) => {
        const p = prog(i);
        if (!p) return;
        g.fillStyle = `rgba(255,224,140,${0.16 * p})`;
        g.fillRect(ox + a.x * k, oy + a.y * k, a.w * k, a.h * k);
      });
    } else {
      areas.slice().reverse().forEach((a, i) => {
        const p = prog(i);
        if (!p) return;
        d.fillStyle = `rgba(3,6,18,${0.82 * p})`;
        d.fillRect(ox + a.x * k, oy + a.y * k, a.w * k, a.h * k);
      });
      g.drawImage(endDark, 0, 0, w, h);
      // 꺼지기 전 잠깐 깜빡이는 전등
      if (elapsed < 600 && Math.floor(elapsed / 90) % 2) { g.fillStyle = "rgba(3,6,18,0.35)"; g.fillRect(0, 0, w, h); }
    }
  }

  return { init, draw, resize, debug, drawMinimap, drawEnding, get scale() { return scale; } };
})();
