/* =====================================================================
   minigames.js — 공통 미션 화면 + 장소별 미니게임 8개

   ▸ 공통 화면(MissionUI): 장소 | 제목 | 남은 시간 / 조작 화면 / 문제 / [미션 나가기] [확인]
     정답 판정은 이곳 한 곳에서만 합니다.
   ▸ 미니게임은 모두 같은 모양입니다.
       build(root, q, kit) → { getAnswer(), success(), debugFill(answer) }
       getAnswer() 가 { pending: "안내 문구" } 를 돌려주면 오답으로 세지 않고 안내만 합니다.

     power   컴퓨터실  숫자 입력(키패드)      liquid  과학실   +/− 버튼
     recipe  급식실    재료 추가 버튼         books   도서관   드래그 앤 드롭
     teams   체육관    인원 +/− 버튼          volume  방송실   슬라이더
     evacmap 교무실    지도 보고 숫자 입력    water   보건실   용량 슬라이더
   ===================================================================== */

// ─────────────────────────────────────────────────────────────
// 작은 도구
// ─────────────────────────────────────────────────────────────
const MG = (() => {
  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function decimals(step) {
    const s = String(step);
    return s.includes(".") ? s.split(".")[1].length : 0;
  }
  const roundTo = (v, step) => +(Math.round(v / step) * step).toFixed(decimals(step));

  function fmt(n) {
    if (typeof n !== "number" || isNaN(n)) return "?";
    const r = Math.round(n * 1000) / 1000;
    return r.toLocaleString("ko-KR", { maximumFractionDigits: 3 });
  }

  // 문자열 → 숫자 ("1,000", "5/2", "2 1/2" 모두 가능)
  function parseNumber(str) {
    if (typeof str === "number") return str;
    // 쉼표와 단위 글자는 지우고, 숫자 · 소수점 · 분수 기호 · 띄어쓰기만 남깁니다.
    const s = String(str || "").replace(/,/g, "").replace(/[^\d./\s-]/g, "").trim().replace(/\s+/g, " ");
    const mixed = s.match(/^(\d+)\s+(\d+)\/(\d+)$/);
    if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
    const frac = s.match(/^(-?\d*\.?\d+)\/(\d*\.?\d+)$/);
    if (frac) return Number(frac[2]) === 0 ? NaN : Number(frac[1]) / Number(frac[2]);
    if (!/^-?\d*\.?\d+$/.test(s)) return NaN;
    return Number(s);
  }

  // 보기 좋은 최대값 (눈금용)
  function niceMax(v, unit = 10) {
    const steps = [1, 2, 2.5, 5, 10];
    const mag = Math.pow(10, Math.floor(Math.log10(Math.max(v, 1e-9))));
    for (const s of steps) if (s * mag >= v) return Math.max(unit, s * mag);
    return Math.max(unit, 10 * mag);
  }

  // 누르고 있으면 계속 반복
  function holdRepeat(btn, fn, signal) {
    let t1 = null, t2 = null;
    const stop = () => { clearTimeout(t1); clearInterval(t2); t1 = t2 = null; };
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      if (btn.disabled) return;
      fn();
      stop();
      t1 = setTimeout(() => { t2 = setInterval(() => { if (!btn.disabled) fn(); else stop(); }, 90); }, 420);
    }, { signal });
    ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => btn.addEventListener(ev, stop, { signal }));
    if (signal) signal.addEventListener("abort", stop);
  }

  // 터치에서도 잘 되는 슬라이더 (기본 input range 대신 직접 만듦)
  function slider(parent, opt, signal) {
    const { min = 0, max = 100, step = 1, vertical = false, onChange = () => {} } = opt;
    let value = opt.value || 0;
    const wrap = el("div", "sl " + (vertical ? "sl-v" : "sl-h"));
    const track = el("div", "sl-track");
    const fill = el("div", "sl-fill");
    const thumb = el("div", "sl-thumb");
    track.append(fill, thumb);
    wrap.append(track);
    parent.appendChild(wrap);
    if (opt.locked) wrap.classList.add("locked");

    function render() {
      const p = (value - min) / (max - min);
      if (vertical) { fill.style.height = p * 100 + "%"; thumb.style.bottom = `calc(${p * 100}% - 18px)`; }
      else { fill.style.width = p * 100 + "%"; thumb.style.left = `calc(${p * 100}% - 18px)`; }
    }
    function set(v, fire = true) {
      value = clamp(roundTo(v, step), min, max);
      render();
      if (fire) onChange(value);
    }
    function fromEvent(e) {
      const r = track.getBoundingClientRect();
      const p = vertical ? 1 - (e.clientY - r.top) / r.height : (e.clientX - r.left) / r.width;
      set(min + clamp(p, 0, 1) * (max - min));
    }
    let dragging = false;
    if (!opt.locked) {
      wrap.addEventListener("pointerdown", (e) => {
        dragging = true; e.preventDefault();
        try { wrap.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
        fromEvent(e);
      }, { signal });
      wrap.addEventListener("pointermove", (e) => { if (dragging) { e.preventDefault(); fromEvent(e); } }, { signal });
      ["pointerup", "pointercancel", "lostpointercapture"].forEach((ev) => wrap.addEventListener(ev, () => { dragging = false; }, { signal }));
    }
    render();
    return { el: wrap, get: () => value, set };
  }

  // 숫자 키패드 (태블릿용 화면 버튼 + 컴퓨터 키보드)
  function keypad(parent, opt, signal) {
    const { unit = "", allowFrac = false, onChange = () => {}, onEnter = () => {} } = opt;
    let text = "";
    const box = el("div", "kp");
    const disp = el("div", "kp-display");
    const val = el("span", "kp-val", "");
    const un = el("span", "kp-unit", MG.esc(unit));
    disp.append(val, un);
    const keys = el("div", "kp-keys");
    const layout = ["7", "8", "9", "4", "5", "6", "1", "2", "3", ".", "0", "⌫"];
    if (allowFrac) layout.push("/");
    layout.push("C");
    layout.forEach((k) => {
      const b = el("button", "kp-key" + (k === "C" ? " kp-clear" : "") + (k === "⌫" ? " kp-back" : ""), k === "C" ? "지우기" : k);
      b.type = "button";
      b.addEventListener("pointerdown", (e) => { e.preventDefault(); press(k); }, { signal });
      keys.appendChild(b);
    });
    if (!allowFrac) keys.classList.add("no-frac");
    box.append(disp, keys);
    parent.appendChild(box);

    function press(k) {
      if (box.classList.contains("disabled")) return;
      if (k === "C") text = "";
      else if (k === "⌫") text = text.slice(0, -1);
      else if (text.length < 9) {
        if (k === "." && /\.\d*$/.test(text.split("/").pop())) return;
        if (k === "/" && (text.includes("/") || !text)) return;
        text += k;
      }
      render();
    }
    function render() {
      val.textContent = text || "";
      disp.classList.toggle("empty", !text);
      onChange(text);
    }
    window.addEventListener("keydown", (e) => {
      if (!GSM.is("MISSION")) return;
      if (/^[0-9]$/.test(e.key)) { press(e.key); e.preventDefault(); }
      else if (e.key === "." ) press(".");
      else if (e.key === "/" && allowFrac) press("/");
      else if (e.key === "Backspace") { press("⌫"); e.preventDefault(); }
      else if (e.key === "Delete") press("C");
    }, { signal });
    render();
    return { get: () => text, set: (t) => { text = String(t); render(); }, value: () => parseNumber(text), el: box };
  }

  // 이름 → 색
  function colorFor(label, i = 0) {
    const map = [["파란", "#3e7bfa"], ["파랑", "#3e7bfa"], ["노란", "#f5c400"], ["노랑", "#f5c400"], ["빨간", "#e5484d"], ["빨강", "#e5484d"],
      ["초록", "#30a46c"], ["식초", "#e6dc9a"], ["물", "#6cc8ff"], ["흰", "#e9eef5"], ["백", "#e9eef5"], ["검정", "#39404d"], ["청", "#3e7bfa"],
      ["공격", "#e5484d"], ["수비", "#3e7bfa"]];
    for (const [k, c] of map) if (String(label).includes(k)) return c;
    return ["#4cc9f0", "#f76b15", "#b388ff", "#39d98a"][i % 4];
  }

  function mixColor(a, b, wa = 0.5) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const ch = (p, s) => (p >> s) & 255;
    const m = (s) => Math.round(ch(pa, s) * wa + ch(pb, s) * (1 - wa));
    return "#" + ((1 << 24) + (m(16) << 16) + (m(8) << 8) + m(0)).toString(16).slice(1);
  }

  function gcd(a, b) { a = Math.abs(Math.round(a)); b = Math.abs(Math.round(b)); while (b) [a, b] = [b, a % b]; return a; }

  // 비례식에서 모르는 칸(□)과 아는 값 정리
  //   proportion [a,b,c,d] → a : b = c : d  (a,c 는 labels[0], b,d 는 labels[1])
  function propInfo(q) {
    const p = q.proportion;
    const idx = p.indexOf(null);
    const pairOf = (i) => (i < 2 ? 0 : 1);
    const knownPair = pairOf(idx) === 0 ? [p[2], p[3]] : [p[0], p[1]];
    const targetPair = pairOf(idx) === 0 ? [p[0], p[1]] : [p[2], p[3]];
    const unknownSide = idx % 2;           // 0 → labels[0] 쪽, 1 → labels[1] 쪽
    const knownSide = 1 - unknownSide;
    return { p, idx, knownPair, targetPair, unknownSide, knownSide, knownValue: targetPair[knownSide] };
  }

  function unitOf(label) {
    const m = String(label || "").match(/\(([^)]+)\)/);
    return m ? m[1] : "";
  }
  const nameOf = (label) => String(label || "").replace(/\s*\([^)]*\)/, "");

  return { el, esc, fmt, parseNumber, niceMax, holdRepeat, slider, keypad, colorFor, mixColor, gcd, propInfo, unitOf, nameOf, roundTo, decimals };
})();

// ─────────────────────────────────────────────────────────────
// 장소별 미니게임
// ─────────────────────────────────────────────────────────────
const MINIGAMES = {};

// ① 컴퓨터실 · 전력 회로 복구 (숫자 입력)
MINIGAMES.power = {
  build(root, q, kit) {
    const { el, fmt } = MG;
    const info = MG.propInfo(q);
    const isFrac = q.labels && q.labels[0] === "분자";
    const wrap = el("div", "mg-power");
    const left = el("div", "pw-left");
    const right = el("div", "pw-right");
    wrap.append(left, right);
    root.appendChild(wrap);

    // 식 표시 (□ 칸에 입력한 숫자가 들어감)
    const eq = el("div", "pw-eq" + (isFrac ? " frac-mode" : ""));
    const slot = () => '<span class="pw-slot">□</span>';
    const v = (i) => (q.proportion[i] === null ? slot() : `<b>${fmt(q.proportion[i])}</b>`);
    eq.innerHTML = isFrac
      ? `<span class="fr">${v(0)}<i></i>${v(1)}</span><span class="op">=</span><span class="fr">${v(2)}<i></i>${v(3)}</span>`
      : `${v(0)}<span class="op">:</span>${v(1)}<span class="op">=</span>${v(2)}<span class="op">:</span>${v(3)}`;
    left.appendChild(eq);

    // 회로 두 개 (막대 높이 = 전력량, 같은 눈금)
    const board = el("div", "pw-board");
    const modules = [info.idx < 2 ? 1 : 0, info.idx < 2 ? 0 : 1]; // [기준 회로 쌍, 복구할 회로 쌍]
    const pairVals = (pi) => [q.proportion[pi * 2], q.proportion[pi * 2 + 1]];
    const bars = [];
    modules.forEach((pi, mi) => {
      const mod = el("div", "pw-mod" + (mi === 1 ? " target" : ""));
      mod.appendChild(el("div", "pw-mod-title", mi === 0 ? "기준 회로 ✓" : "복구할 회로"));
      const row = el("div", "pw-bars");
      pairVals(pi).forEach((val, side) => {
        const col = el("div", "pw-col");
        const bar = el("div", "pw-bar" + (val === null ? " unknown" : ""));
        bar.style.setProperty("--c", side === 0 ? "#4cc9f0" : "#b388ff");
        const fill = el("div", "pw-fill");
        bar.appendChild(fill);
        const num = el("div", "pw-num", val === null ? "?" : fmt(val));
        col.append(num, bar, el("div", "pw-lab", MG.esc((q.labels || ["A", "B"])[side])));
        row.appendChild(col);
        bars.push({ fill, num, val });
      });
      mod.appendChild(row);
      board.appendChild(mod);
    });
    left.appendChild(board);
    const monitors = el("div", "pw-monitors", "<i></i><i></i><i></i><i></i><i></i>");
    left.appendChild(monitors);

    const known = q.proportion.filter((x) => x !== null);
    function draw(typed) {
      const all = known.concat(isNaN(typed) ? [] : [typed]);
      const max = Math.max(...all, 1);
      bars.forEach((b) => {
        const val = b.val === null ? typed : b.val;
        b.fill.style.height = (isNaN(val) ? 0 : clamp(val / max, 0, 1) * 100) + "%";
        if (b.val === null) b.num.textContent = isNaN(typed) ? "?" : fmt(typed);
      });
      const s = eq.querySelector(".pw-slot");
      s.textContent = isNaN(typed) ? "□" : fmt(typed);
      s.classList.toggle("filled", !isNaN(typed));
    }
    const pad = MG.keypad(right, { unit: q.unit, allowFrac: isFrac, onChange: (t) => draw(t ? MG.parseNumber(t) : NaN), onEnter: kit.submit }, kit.signal);
    draw(NaN);
    return {
      getAnswer() {
        if (!pad.get()) return { pending: "□에 들어갈 수를 입력해 주세요." };
        return pad.value();
      },
      success() { wrap.classList.add("ok"); },
      debugFill(a) { pad.set(String(a)); },
      lock(on) { pad.el.classList.toggle("disabled", on); },
    };
  },
};

// ② 과학실 · 용액 배합 (+/− 버튼)
MINIGAMES.liquid = {
  build(root, q, kit) {
    const { el, fmt } = MG;
    const info = MG.propInfo(q);
    const step = q.step || 10;
    const cap = MG.niceMax(Math.max(info.knownValue, q.answer) * 1.35, 50);
    let value = 0;
    const wrap = el("div", "mg-liquid");
    root.appendChild(wrap);
    const beakers = [];
    const colors = (q.labels || []).map((l, i) => MG.colorFor(l, i));
    const row = el("div", "lq-row");
    wrap.appendChild(row);

    [0, 1].forEach((side) => {
      const isUnknown = side === info.unknownSide;
      const col = el("div", "lq-col" + (isUnknown ? " unknown" : ""));
      const beaker = el("div", "lq-beaker");
      const liquid = el("div", "lq-liquid");
      liquid.style.background = colors[side];
      beaker.appendChild(liquid);
      for (let i = 1; i <= 4; i++) {
        const tick = el("div", "lq-tick", `<span>${fmt((cap * i) / 5)}</span>`);
        tick.style.bottom = (i * 20) + "%";
        beaker.appendChild(tick);
      }
      const label = el("div", "lq-label", MG.esc(q.labels[side]));
      const amount = el("div", "lq-amount", "");
      col.append(amount, beaker, label);
      if (isUnknown) {
        const btns = el("div", "lq-btns");
        const steps = step === 10 ? [-10, 10] : [-10, -step, step, 10];
        steps.forEach((d) => {
          const b = el("button", "btn lq-btn" + (d > 0 ? " plus" : ""), (d > 0 ? "+" : "−") + Math.abs(d));
          b.type = "button";
          MG.holdRepeat(b, () => { value = clamp(value + d, 0, cap); draw(); }, kit.signal);
          btns.appendChild(b);
        });
        col.appendChild(btns);
      } else {
        col.appendChild(el("div", "lq-fixed", "🔒 정해진 양"));
      }
      row.appendChild(col);
      beakers.push({ liquid, amount, isUnknown, col });
    });
    const flask = el("div", "lq-flask", "<div class='lq-flask-liquid'></div>");
    wrap.appendChild(flask);

    function draw() {
      beakers.forEach((b) => {
        const v = b.isUnknown ? value : info.knownValue;
        b.liquid.style.height = (v / cap) * 100 + "%";
        b.amount.innerHTML = `<b>${fmt(v)}</b> ${MG.esc(q.unit)}`;
      });
    }
    draw();
    return {
      getAnswer() { return value === 0 ? { pending: "버튼을 눌러 용액을 넣어 주세요." } : value; },
      success() {
        const k = info.knownValue / (info.knownValue + value);
        flask.querySelector(".lq-flask-liquid").style.background = MG.mixColor(colors[info.knownSide], colors[info.unknownSide], k);
        wrap.classList.add("ok");
      },
      debugFill(a) { value = a; draw(); },
      lock(on) { wrap.classList.toggle("disabled", on); },
    };
  },
};

// ③ 급식실 · 레시피 복구 (재료 추가 버튼)
MINIGAMES.recipe = {
  build(root, q, kit) {
    const { el, fmt } = MG;
    const info = MG.propInfo(q);
    const what = q.labels[info.unknownSide];
    const icon = /쌀/.test(what) ? "🍚" : /밀가루/.test(what) ? "🌾" : /가격|원/.test(what + q.unit) ? "🪙" : /드레싱|L/.test(what + q.unit) ? "🥤" : "📦";
    const DEN = { g: [100, 10, 1], "원": [1000, 100, 10], L: [1, 0.1, 0.01] };
    const dens = DEN[q.unit] || [100, 10, 1];
    const counts = dens.map(() => 0);
    const history = [];
    const wrap = el("div", "mg-recipe");
    root.appendChild(wrap);

    const card = el("div", "rc-card");
    const [k0, k1] = info.knownPair;
    const t = info.targetPair;
    const L0 = MG.esc(q.labels[0]), L1 = MG.esc(q.labels[1]);
    card.innerHTML = `
      <div class="rc-title">📋 레시피 카드</div>
      <div class="rc-line"><span>${L0} <b>${fmt(k0)}</b></span><span class="arr">→</span><span>${L1} <b>${fmt(k1)}</b> ${MG.esc(q.unit)}</span></div>
      <div class="rc-line target"><span>${L0} <b>${fmt(t[0])}</b></span><span class="arr">→</span><span>${L1} <b class="rc-q">?</b> ${MG.esc(q.unit)}</span></div>`;
    const pot = el("div", "rc-pot");
    const tray = el("div", "rc-tray");
    const total = el("div", "rc-total");
    const stove = el("div", "rc-stove", "<i></i><i></i><i></i>");
    pot.append(tray, total, stove);
    const btns = el("div", "rc-btns");
    dens.forEach((d, i) => {
      const b = el("button", "btn rc-add", `${icon}<span>+${fmt(d)}${MG.esc(q.unit)}</span>`);
      b.type = "button";
      MG.holdRepeat(b, () => { if (sum() + d <= 99999) { counts[i]++; history.push(i); draw(); } }, kit.signal);
      btns.appendChild(b);
    });
    const undo = el("button", "btn small", "↶ 하나 빼기");
    undo.type = "button";
    undo.addEventListener("click", () => { const i = history.pop(); if (i != null) { counts[i]--; draw(); } }, { signal: kit.signal });
    const clear = el("button", "btn small", "비우기");
    clear.type = "button";
    clear.addEventListener("click", () => { counts.fill(0); history.length = 0; draw(); }, { signal: kit.signal });
    const tools = el("div", "rc-tools");
    tools.append(undo, clear);
    wrap.append(card, pot, btns, tools);

    function sum() { return +counts.reduce((s, c, i) => s + c * dens[i], 0).toFixed(3); }
    function draw() {
      tray.innerHTML = "";
      counts.forEach((c, i) => {
        if (!c) return;
        const g = el("div", "rc-group rc-size" + i);
        const shown = Math.min(c, 12);
        g.innerHTML = `<span class="rc-icons">${icon.repeat(shown)}</span><span class="rc-x">${fmt(dens[i])}${MG.esc(q.unit)} × ${c}</span>`;
        tray.appendChild(g);
      });
      if (!sum()) tray.innerHTML = '<div class="rc-empty">아래 버튼으로 재료를 넣어 보세요</div>';
      total.innerHTML = `넣은 양 <b>${fmt(sum())}</b> ${MG.esc(q.unit)}`;
    }
    draw();
    return {
      getAnswer() { return sum() === 0 ? { pending: "재료를 넣어 주세요." } : sum(); },
      success() { wrap.classList.add("ok"); },
      debugFill(a) {
        counts.fill(0); let r = a;
        dens.forEach((d, i) => { counts[i] = Math.floor(+(r / d).toFixed(6)); r = +(r - counts[i] * d).toFixed(6); });
        draw();
      },
      lock(on) { wrap.classList.toggle("disabled", on); },
    };
  },
};

// ④ 도서관 · 책 정리 (드래그 앤 드롭)
MINIGAMES.books = {
  build(root, q, kit) {
    const { el, fmt } = MG;
    const n = q.parts.length;
    const totalMode = q.ask === "total";
    // 책 묶음 크기: 모든 답을 나누어떨어지게 하면서 묶음 수가 너무 많지 않게
    function chooseBundle(values, total) {
      const g = values.reduce((a, b) => MG.gcd(a, b));
      const divs = [];
      for (let d = 1; d <= g; d++) if (g % d === 0) divs.push(d);
      let best = divs[divs.length - 1], bestScore = Infinity;
      divs.forEach((d) => {
        const cnt = total / d;
        const score = cnt > 20 ? 100 + cnt : Math.abs(cnt - 14);
        if (score < bestScore) { best = d; bestScore = score; }
      });
      return best;
    }
    let bundle, pile, counts, lockedShelf = -1;
    if (totalMode) {
      const ki = q.known.findIndex((v) => v != null);
      const rest = q.answer - q.known[ki];
      const g = MG.gcd(q.known[ki], rest);
      bundle = g;
      for (let d = g; d >= 1; d--) if (g % d === 0 && q.known[ki] / d >= 3) { bundle = d; break; }
      counts = q.parts.map(() => 0);
      counts[ki] = q.known[ki] / bundle;
      lockedShelf = ki;
      pile = Infinity;
    } else {
      bundle = chooseBundle(q.answer, q.total);
      counts = q.parts.map(() => 0);
      pile = q.total / bundle;
    }
    let active = lockedShelf === 0 ? 1 : 0;

    const wrap = el("div", "mg-books" + (n === 3 ? " three" : ""));
    root.appendChild(wrap);
    const legend = el("div", "bk-legend", `<span class="bk-bundle mini"><i></i><i></i><i></i></span> 1묶음 = <b>${bundle}</b>권 · 책 묶음을 서가로 끌어다 놓으세요 (눌러도 돼요)`);
    const pileBox = el("div", "bk-pile");
    const shelvesBox = el("div", "bk-shelves");
    const sumLine = el("div", "bk-sum");
    wrap.append(legend, pileBox, shelvesBox, sumLine);

    function bundleEl(from) {
      const b = el("div", "bk-bundle", `<i></i><i></i><i></i><span>${bundle}</span>`);
      b.dataset.from = from;
      return b;
    }
    function draw() {
      pileBox.innerHTML = "";
      const title = el("div", "bk-title", totalMode ? "📦 책 더미 (얼마든지)" : `📦 새로 온 책 <b>${fmt(pile * bundle)}</b>권`);
      pileBox.appendChild(title);
      const area = el("div", "bk-area");
      const show = totalMode ? 6 : pile;
      for (let i = 0; i < show; i++) area.appendChild(bundleEl("pile"));
      pileBox.appendChild(area);
      shelvesBox.innerHTML = "";
      q.parts.forEach((part, si) => {
        const sh = el("div", "bk-shelf" + (si === active ? " active" : "") + (si === lockedShelf ? " locked" : ""));
        sh.dataset.shelf = si;
        const head = el("div", "bk-shelf-head", `${MG.esc(q.labels[si])}${si === lockedShelf ? " 🔒" : ""}<b>${fmt(counts[si] * bundle)}권</b>`);
        head.addEventListener("click", () => { if (si !== lockedShelf) { active = si; draw(); } });
        const area2 = el("div", "bk-area");
        for (let i = 0; i < counts[si]; i++) area2.appendChild(bundleEl(String(si)));
        sh.append(head, area2);
        shelvesBox.appendChild(sh);
      });
      const tot = counts.reduce((s, c) => s + c, 0) * bundle;
      sumLine.innerHTML = totalMode ? `두 코너에 꽂은 책 모두 <b>${fmt(tot)}</b>권` : "";
    }

    function move(from, to) {
      if (from === to) return;
      if (to !== "pile" && Number(to) === lockedShelf) return;
      if (from !== "pile" && Number(from) === lockedShelf) return;
      if (from === "pile") { if (pile <= 0) return; if (pile !== Infinity) pile--; }
      else counts[Number(from)]--;
      if (to === "pile") { if (pile !== Infinity) pile++; }
      else counts[Number(to)]++;
      draw();
    }

    // 끌어다 놓기 (마우스·터치 공통)
    let drag = null;
    wrap.addEventListener("pointerdown", (e) => {
      const b = e.target.closest(".bk-bundle");
      if (!b || !b.dataset.from || wrap.classList.contains("disabled")) return;
      e.preventDefault();
      const ghost = b.cloneNode(true);
      ghost.classList.add("bk-ghost");
      document.body.appendChild(ghost);
      drag = { from: b.dataset.from, sx: e.clientX, sy: e.clientY, ghost, moved: false, id: e.pointerId };
      ghost.style.left = e.clientX + "px"; ghost.style.top = e.clientY + "px";
      try { wrap.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
    }, { signal: kit.signal });
    wrap.addEventListener("pointermove", (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 8) drag.moved = true;
      drag.ghost.style.left = e.clientX + "px"; drag.ghost.style.top = e.clientY + "px";
      $$(".bk-shelf, .bk-pile", wrap).forEach((s) => s.classList.remove("hover"));
      const t = targetAt(e.clientX, e.clientY);
      if (t) t.el.classList.add("hover");
    }, { signal: kit.signal });
    const end = (e) => {
      if (!drag || (e.pointerId !== undefined && e.pointerId !== drag.id)) return;
      drag.ghost.remove();
      const d = drag; drag = null;
      $$(".bk-shelf, .bk-pile", wrap).forEach((s) => s.classList.remove("hover"));
      if (!d.moved) { move(d.from, d.from === "pile" ? String(active) : "pile"); return; } // 짧게 누르기
      const t = targetAt(e.clientX, e.clientY);
      if (t) move(d.from, t.id);
    };
    wrap.addEventListener("pointerup", end, { signal: kit.signal });
    wrap.addEventListener("pointercancel", (e) => { if (drag) { drag.ghost.remove(); drag = null; } }, { signal: kit.signal });
    kit.signal.addEventListener("abort", () => { if (drag) drag.ghost.remove(); });

    function targetAt(x, y) {
      const hit = document.elementsFromPoint(x, y).find((n) => n.classList && (n.classList.contains("bk-shelf") || n.classList.contains("bk-pile")) && wrap.contains(n));
      if (!hit) return null;
      return { el: hit, id: hit.classList.contains("bk-pile") ? "pile" : hit.dataset.shelf };
    }

    draw();
    return {
      getAnswer() {
        if (totalMode) {
          const other = counts.findIndex((c, i) => i !== lockedShelf && c > 0);
          if (other < 0) return { pending: "책 더미에서 다른 코너로 책을 옮겨 주세요." };
          return counts.reduce((s, c) => s + c, 0) * bundle;
        }
        if (pile > 0) return { pending: `아직 꽂지 않은 책이 ${fmt(pile * bundle)}권 남았어요.` };
        return counts.map((c) => c * bundle);
      },
      success() { wrap.classList.add("ok"); },
      debugFill(a) {
        if (totalMode) { const oi = lockedShelf === 0 ? 1 : 0; counts[oi] = (a - counts[lockedShelf] * bundle) / bundle; }
        else { a.forEach((v, i) => { counts[i] = v / bundle; }); pile = 0; }
        draw();
      },
      lock(on) { wrap.classList.toggle("disabled", on); },
    };
  },
};

// ⑤ 체육관 · 팀 편성 (인원 +/− 버튼)
MINIGAMES.teams = {
  build(root, q, kit) {
    const { el, fmt } = MG;
    const step = q.snap || 1;
    const people = q.unit === "명";
    const values = q.parts.map(() => 0);
    const colors = q.labels.map((l, i) => MG.colorFor(l, i));
    const wrap = el("div", "mg-teams" + (q.parts.length === 3 ? " three" : ""));
    root.appendChild(wrap);
    const head = el("div", "tm-head");
    const bar = el("div", "tm-bar");
    const remain = el("div", "tm-remain");
    head.append(bar, remain);
    const panels = el("div", "tm-panels");
    wrap.append(head, panels);
    const refs = q.labels.map((label, i) => {
      const p = el("div", "tm-panel");
      p.style.setProperty("--c", colors[i]);
      const title = el("div", "tm-title", `<span class="flag"></span>${MG.esc(label)}`);
      const val = el("div", "tm-val");
      const icons = el("div", "tm-icons" + (people ? "" : " gauge"));
      const ctr = el("div", "tm-ctr");
      const minus = el("button", "btn tm-btn", "−"); minus.type = "button";
      const plus = el("button", "btn tm-btn plus", "+"); plus.type = "button";
      MG.holdRepeat(minus, () => change(i, -step), kit.signal);
      MG.holdRepeat(plus, () => change(i, step), kit.signal);
      ctr.append(minus, plus);
      p.append(title, val, icons, ctr);
      panels.appendChild(p);
      return { val, icons, minus, plus };
    });
    const used = () => +values.reduce((s, v) => s + v, 0).toFixed(3);
    function change(i, d) {
      const nv = +(values[i] + d).toFixed(3);
      if (nv < 0 || used() + d > q.total + 1e-9) return;
      values[i] = nv; draw();
    }
    function draw() {
      const left = +(q.total - used()).toFixed(3);
      remain.innerHTML = `${people ? "남은 학생" : "나누지 않은 부분"} <b>${fmt(left)}</b>${MG.esc(q.unit)} <small>/ 전체 ${fmt(q.total)}${MG.esc(q.unit)}</small>`;
      bar.innerHTML = "";
      values.forEach((v, i) => {
        const s = el("div", "tm-seg");
        s.style.width = (v / q.total) * 100 + "%"; s.style.background = colors[i];
        bar.appendChild(s);
      });
      refs.forEach((r, i) => {
        r.val.innerHTML = `<b>${fmt(values[i])}</b>${MG.esc(q.unit)}`;
        if (people) {
          r.icons.innerHTML = '<i class="pp"></i>'.repeat(Math.round(values[i]));
        } else {
          r.icons.innerHTML = `<div class="tm-gfill" style="width:${(values[i] / q.total) * 100}%"></div>`;
        }
        r.minus.disabled = values[i] <= 0;
        r.plus.disabled = left < step - 1e-9;
      });
    }
    draw();
    return {
      getAnswer() {
        const left = +(q.total - used()).toFixed(3);
        if (left > 1e-9) return { pending: `아직 ${fmt(left)}${q.unit}${people ? "이" : "가"} 남았어요. 모두 나눠 주세요.` };
        return values.slice();
      },
      success() { wrap.classList.add("ok"); },
      debugFill(a) { a.forEach((v, i) => { values[i] = v; }); draw(); },
      lock(on) { wrap.classList.toggle("disabled", on); },
    };
  },
};

// ⑥ 방송실 · 음량 조절 (슬라이더)
MINIGAMES.volume = {
  build(root, q, kit) {
    const { el, fmt } = MG;
    const info = MG.propInfo(q);
    const step = q.step || 1;
    const max = MG.niceMax(Math.max(info.knownValue, q.answer) * 1.4, 10);
    const wrap = el("div", "mg-volume");
    root.appendChild(wrap);
    const board = el("div", "vo-board");
    wrap.appendChild(board);
    let slider = null;
    const speakers = [];
    [0, 1].forEach((side) => {
      const ch = el("div", "vo-ch" + (side === info.unknownSide ? " unknown" : " fixed"));
      const spk = el("div", "vo-spk", "<i></i><i></i><i></i><span>🔊</span>");
      const val = el("div", "vo-val");
      const label = el("div", "vo-label", MG.esc(q.labels[side]) + (side === info.unknownSide ? "" : " 🔒"));
      ch.append(spk, val);
      const row2 = el("div", "vo-row");
      const faderBox = el("div", "vo-fader");
      row2.appendChild(faderBox);
      ch.appendChild(row2);
      ch.appendChild(label);
      board.appendChild(ch);
      const s = MG.slider(faderBox, {
        min: 0, max, step, vertical: true, value: side === info.unknownSide ? 0 : info.knownValue, locked: side !== info.unknownSide,
        onChange: () => draw(),
      }, kit.signal);
      if (side === info.unknownSide) {
        slider = s;
        const fine = el("div", "vo-fine");
        const up = el("button", "btn small", "▲"); up.type = "button";
        const dn = el("button", "btn small", "▼"); dn.type = "button";
        MG.holdRepeat(up, () => s.set(s.get() + step), kit.signal);
        MG.holdRepeat(dn, () => s.set(s.get() - step), kit.signal);
        fine.append(up, dn);
        row2.appendChild(fine);
      }
      speakers[side] = { spk, val, s };
    });
    const eqz = el("div", "vo-eq", "<i></i><i></i><i></i><i></i><i></i><i></i><i></i>");
    wrap.appendChild(eqz);
    function draw() {
      speakers.forEach((sp) => {
        if (!sp || !sp.s) return;
        const v = sp.s.get();
        sp.val.innerHTML = `<b>${fmt(v)}</b>`;
        sp.spk.style.setProperty("--v", v / max);
      });
    }
    draw();
    return {
      getAnswer() { return slider.get() === 0 ? { pending: "슬라이더를 움직여 음량을 맞춰 주세요." } : slider.get(); },
      success() { wrap.classList.add("ok"); },
      debugFill(a) { slider.set(a); },
      lock(on) { wrap.classList.toggle("disabled", on); },
    };
  },
};

// ⑦ 교무실 · 비상 대피 지도 (지도 보고 숫자 입력)
MINIGAMES.evacmap = {
  build(root, q, kit) {
    const { el, fmt } = MG;
    const info = MG.propInfo(q);
    const u = [MG.unitOf(q.labels[0]), MG.unitOf(q.labels[1])];
    const nm = [MG.nameOf(q.labels[0]), MG.nameOf(q.labels[1])];
    const wrap = el("div", "mg-evac");
    const left = el("div", "ev-left");
    const right = el("div", "ev-right");
    wrap.append(left, right);
    root.appendChild(wrap);
    const [k0, k1] = info.knownPair;
    const legend = el("div", "ev-legend", `<span class="ev-scale"></span> ${MG.esc(nm[0])} <b>${fmt(k0)}${u[0]}</b> = ${MG.esc(nm[1])} <b>${fmt(k1)}${u[1]}</b>`);
    const known = info.knownValue, ks = info.knownSide;
    const tag = `${MG.esc(nm[ks])} <b>${fmt(known)}${u[ks]}</b> · ${MG.esc(nm[info.unknownSide])} <b class="ev-q">?</b>${u[info.unknownSide]}`;
    left.innerHTML = `
      <svg class="ev-map" viewBox="0 0 320 200">
        <rect x="4" y="4" width="312" height="192" rx="10" class="ev-bg"/>
        <rect x="20" y="20" width="80" height="50" class="ev-room"/><text x="60" y="50">교실</text>
        <rect x="120" y="20" width="80" height="50" class="ev-room"/><text x="160" y="50">과학실</text>
        <rect x="220" y="20" width="80" height="110" class="ev-room"/><text x="260" y="80">체육관</text>
        <rect x="20" y="130" width="100" height="50" class="ev-room"/><text x="70" y="160">교무실</text>
        <rect x="140" y="130" width="60" height="50" class="ev-room"/><text x="170" y="160">보건실</text>
        <path d="M60 78 L60 105 L260 105 L260 132" class="ev-route"/>
        <path d="M60 78 L60 105 L260 105 L260 132" class="ev-route-ok"/>
        <circle cx="60" cy="78" r="8" class="ev-a"/><circle cx="260" cy="132" r="8" class="ev-b"/>
        <text x="60" y="82" class="ev-pt">A</text><text x="260" y="136" class="ev-pt">B</text>
      </svg>`;
    left.appendChild(el("div", "ev-tag", tag));
    left.prepend(legend);
    const pad = MG.keypad(right, { unit: u[info.unknownSide] || q.unit, onChange: () => {}, onEnter: kit.submit }, kit.signal);
    return {
      getAnswer() { return pad.get() ? pad.value() : { pending: "숫자를 입력해 주세요." }; },
      success() { wrap.classList.add("ok"); },
      debugFill(a) { pad.set(String(a)); },
      lock(on) { pad.el.classList.toggle("disabled", on); },
    };
  },
};

// ⑧ 보건실 · 물 공급 (용량 슬라이더)
MINIGAMES.water = {
  build(root, q, kit) {
    const { el, fmt } = MG;
    const info = MG.propInfo(q);
    const step = 0.1;
    // 눈금은 "물의 양(L)" 끼리 비교해서 정합니다 (학생 수와 섞지 않기)
    const knownLitres = info.knownPair[info.unknownSide];
    const max = Math.max(2, Math.ceil(Math.max(knownLitres, q.answer) * 1.5));
    const wrap = el("div", "mg-water");
    root.appendChild(wrap);
    const cards = el("div", "wt-cards");
    const [k0, k1] = info.knownPair;
    const t = info.targetPair;
    cards.innerHTML = `
      <div class="wt-card"><div>${MG.esc(q.labels[0])} <b>${fmt(k0)}</b></div><div class="wt-drop">💧 <b>${fmt(k1)}</b> L</div></div>
      <div class="wt-arrow">→</div>
      <div class="wt-card target"><div>${MG.esc(q.labels[0])} <b>${fmt(t[0])}</b></div><div class="wt-drop">💧 <b class="wt-q">?</b> L</div></div>`;
    const stage = el("div", "wt-stage");
    const bottle = el("div", "wt-bottle", "<div class='wt-neck'></div><div class='wt-body'><div class='wt-water'></div><div class='wt-bubbles'><i></i><i></i><i></i><i></i></div></div>");
    const marks = bottle.querySelector(".wt-body");
    for (let i = 1; i < max * 2; i++) {
      const m = el("div", "wt-mark" + (i % 2 === 0 ? " major" : ""), i % 2 === 0 ? `<span>${i / 2}L</span>` : "");
      m.style.bottom = (i / (max * 2)) * 100 + "%";
      marks.appendChild(m);
    }
    const side = el("div", "wt-side");
    const val = el("div", "wt-val");
    side.appendChild(val);
    stage.append(bottle, side);
    wrap.append(cards, stage);
    const ctrl = el("div", "wt-ctrl");
    wrap.appendChild(ctrl);
    const dn = el("button", "btn small", "−0.1"); dn.type = "button";
    const up = el("button", "btn small", "+0.1"); up.type = "button";
    const sBox = el("div", "wt-slider");
    ctrl.append(dn, sBox, up);
    const s = MG.slider(sBox, { min: 0, max, step, value: 0, onChange: () => draw() }, kit.signal);
    MG.holdRepeat(dn, () => s.set(s.get() - step), kit.signal);
    MG.holdRepeat(up, () => s.set(s.get() + step), kit.signal);
    const water = bottle.querySelector(".wt-water");
    function draw() {
      const v = s.get();
      water.style.height = (v / max) * 100 + "%";
      val.innerHTML = `<b>${fmt(v)}</b> L`;
    }
    draw();
    return {
      getAnswer() { return s.get() === 0 ? { pending: "슬라이더로 물의 양을 정해 주세요." } : s.get(); },
      success() { water.style.height = "100%"; wrap.classList.add("ok"); },
      debugFill(a) { s.set(a); },
      lock(on) { wrap.classList.toggle("disabled", on); },
    };
  },
};

// ─────────────────────────────────────────────────────────────
// 공통 미션 화면
// ─────────────────────────────────────────────────────────────
const MissionUI = (() => {
  let ctrl = null, timer = null, game = null, cur = null, finished = false;

  // 정답 판정 (이 함수 한 곳에서만!)
  function isCorrect(q, ans) {
    const near = (a, b, tol) => Math.abs(a - b) <= Math.max(1e-6, tol || 0);
    if (Array.isArray(q.answer)) {
      if (!Array.isArray(ans) || ans.length !== q.answer.length) return false;
      return q.answer.every((v, i) => typeof ans[i] === "number" && near(ans[i], v));
    }
    const n = typeof ans === "number" ? ans : MG.parseNumber(ans);
    if (typeof n !== "number" || isNaN(n)) return false;
    return near(n, q.answer, q.tolerance);
  }

  // 문제 문장: 숫자와 □ 는 크게
  function questionHtml(q) {
    const lines = q.lines && q.lines.length ? q.lines : [q.question];
    return lines.map((l) => "<p>" + MG.esc(l).replace(/(\d[\d,]*(?:\.\d+)?(?:\/\d+)?|□)/g, '<b class="num">$1</b>') + "</p>").join("");
  }

  function showFeedback(fb, shake) {
    const box = $("#m-feedback");
    if (!fb) { box.innerHTML = ""; box.className = "m-feedback"; return; }
    let html = `<div class="fb-text">${MG.esc(fb.text)}</div>`;
    if (fb.steps) html += `<div class="fb-steps">${fb.steps.map((s) => `<div>${MG.esc(s)}</div>`).join("")}</div>`;
    box.innerHTML = html;
    box.className = "m-feedback level" + fb.level + (shake ? " shake" : "");
  }

  function open({ m, session, fake }, cb) {
    close();
    ctrl = new AbortController();
    const signal = ctrl.signal;
    cur = { m, session, fake, cb };
    finished = false;
    const q = session.q;
    const place = GameMap.ROOMS.find((r) => r.id === m.loc);
    $("#m-place").textContent = "📍 " + (place ? place.name : "");
    $("#m-title").textContent = m.def.icon + " " + m.def.title;
    $("#m-question").innerHTML = questionHtml(q);
    $("#m-success").className = "m-success";
    const card = $("#mission-card");
    card.className = "mission-card type-" + m.def.type;
    const gameRoot = $("#m-game");
    gameRoot.innerHTML = "";
    const kit = { signal, submit };
    game = MINIGAMES[m.def.type].build(gameRoot, q, kit);
    showFeedback(MissionSys.feedbackFor(session), false);
    $("#mission-overlay").classList.add("open");

    // 화면 크기에 맞게 미니게임 크기 자동 조절 (내용이 바뀌거나 화면이 돌아가도 다시 맞춤)
    fit();
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(() => requestAnimationFrame(fit));
      ro.observe(gameRoot);
      if (gameRoot.firstElementChild) ro.observe(gameRoot.firstElementChild);
      signal.addEventListener("abort", () => ro.disconnect());
    }
    window.addEventListener("resize", () => requestAnimationFrame(fit), { signal });

    $("#m-ok").addEventListener("click", submit, { signal });
    $("#m-exit").addEventListener("click", exit, { signal });
    $("#m-debug").style.display = DEBUG_MODE ? "" : "none";
    $("#m-debug").addEventListener("click", () => game.debugFill(q.answer), { signal });
    window.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); submit(); }
      if (e.key === "Escape") exit();
    }, { signal });

    timer = setInterval(tick, 200);
    tick();
  }

  // 공간이 모자라면 미니게임을 작게 (최소 55%), 남는 가로 공간은 넓게 씁니다.
  let fitting = false;
  function fit() {
    if (fitting) return;
    const box = $("#m-game");
    const inner = box && box.firstElementChild;
    if (!inner || !box.clientWidth) return;
    fitting = true;
    const W = box.clientWidth, H = box.clientHeight;
    inner.style.width = W + "px";
    let s = Math.min(1, H / inner.offsetHeight);
    if (s < 1) {
      s = Math.max(0.55, s);
      inner.style.width = W / s + "px";
      s = Math.max(0.55, Math.min(1, s, H / inner.offsetHeight));
      inner.style.width = W / s + "px";
    }
    inner.style.setProperty("--fit", s.toFixed(3));
    fitting = false;
  }

  function tick() {
    if (!cur || finished) return;
    const s = cur.session;
    const now = Date.now();
    const left = s.deadline - now;
    const t = $("#m-timer");
    t.textContent = "⏱ " + formatTime(left);
    t.classList.toggle("urgent", left <= 10000);
    // 오답 뒤 입력 잠금
    const lock = s.lockUntil - now;
    const ok = $("#m-ok");
    if (lock > 0) {
      ok.disabled = true;
      ok.textContent = `${Math.ceil(lock / 1000)}초 뒤에 다시`;
      $("#m-lock").classList.add("on");
      if (game.lock) game.lock(true);
    } else if (ok.disabled) {
      ok.disabled = false;
      ok.textContent = "확인";
      $("#m-lock").classList.remove("on");
      if (game.lock) game.lock(false);
    }
    if (left <= 0) timeout();
  }

  function submit() {
    if (!cur || finished) return;
    const s = cur.session;
    if (Date.now() < s.lockUntil) return;
    const ans = game.getAnswer();
    if (ans && ans.pending) { showFeedback({ level: 0, text: ans.pending }, true); return; }
    if (isCorrect(s.q, ans)) {
      finished = true;
      if (game.lock) game.lock(true);
      $("#m-ok").disabled = true;
      $("#m-exit").disabled = true;
      Sound.play("correct");
      showFeedback(null);
      game.success();
      const box = $("#m-success");
      box.querySelector(".m-success-text").textContent = cur.fake ? "가짜 미션 완료" : "미션 완료!";
      box.querySelector(".m-success-sub").textContent = cur.fake ? "(학교 복구율은 오르지 않아요 · 나만 보여요)" : cur.m.def.done;
      box.className = "m-success show" + (cur.fake ? " fake" : "");
      const { m, cb } = cur;
      cb.onCorrect(m, s);
      setTimeout(() => { if (cur && cur.m === m) cb.onClose(); }, CONFIG.SUCCESS_SHOW_MS);
    } else {
      Sound.play("wrong");
      const fb = cur.cb.onWrong(s);
      showFeedback(fb, true);
      tick();
    }
  }

  function timeout() {
    if (finished) return;
    finished = true;
    if (game.lock) game.lock(true);
    $("#m-ok").disabled = true;
    showFeedback({ level: 0, text: `⏰ 시간 초과! ${CONFIG.MISSION_RETRY_SEC}초 뒤에 다시 도전할 수 있어요.` }, true);
    const { m, session, cb } = cur;
    cb.onTimeout(m, session);
    setTimeout(() => { if (cur && cur.m === m) cb.onClose(); }, 1600);
  }

  function exit() {
    if (!cur || finished) return;
    cur.cb.onClose();
  }

  function close() {
    if (ctrl) ctrl.abort();
    ctrl = null;
    clearInterval(timer);
    timer = null;
    game = null; cur = null; finished = false;
    const ov = $("#mission-overlay");
    if (ov) ov.classList.remove("open");
    const ok = $("#m-ok");
    if (ok) { ok.disabled = false; ok.textContent = "확인"; }
    const ex = $("#m-exit");
    if (ex) ex.disabled = false;
    const lock = $("#m-lock");
    if (lock) lock.classList.remove("on");
  }

  return { open, close, isCorrect };
})();
