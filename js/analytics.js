/* =====================================================================
   analytics.js — 나의 수학 기록 · 교사용 전체 학습 결과 · CSV 다운로드

   ▸ 문제 하나 = 미션 창에서 받은 문제 하나
       정답(한 번에)  : 처음 입력에 바로 맞힘
       다시 도전 해결 : 틀린 뒤 힌트 등을 보고 결국 맞힘
       해결 못 함     : 시간 초과
     정답률 = 한 번에 맞힌 문제 ÷ 전체 문제
   ▸ 점수로 학생을 평가하거나 다른 학생과 비교하지 않고, 학습 피드백만 보여 줍니다.
   ===================================================================== */

const Analytics = (() => {
  // 미션 종류 → 문제 유형 이름
  const TYPE_NAMES = {
    power: "비례식의 □ 구하기 (분수 포함)",
    liquid: "용액 비율 맞추기 (비례식)",
    recipe: "생활 속 비례식 (레시피·가격)",
    juice: "주스 비율 (비례식)",
    volume: "음량 비율 (비례식)",
    evacmap: "지도·거리·빠르기 (비례식 활용)",
    water: "소수가 있는 비례식",
    books: "비례배분 (책 나누기)",
    teams: "비례배분 (사람·거리·시간 나누기)",
    supplies: "비례배분 (준비물 나누기)",
  };
  const typeName = (t) => TYPE_NAMES[t] || t;

  function recordsOf(room, pid) {
    const r = (room && room.results && room.results[pid]) || {};
    return Object.values(r).sort((a, b) => a.t - b.t);
  }

  // ── 통계 계산 ──
  function stats(records) {
    const total = records.length;
    const first = records.filter((r) => r.correct && r.attempts <= 1).length;
    const retry = records.filter((r) => r.correct && r.attempts > 1).length;
    const unsolved = records.filter((r) => !r.correct).length;
    const solved = records.filter((r) => r.correct);
    const avgSec = solved.length ? solved.reduce((s, r) => s + (r.solveSec || 0), 0) / solved.length : 0;
    const byCat = {};
    ["비례식", "비례배분"].forEach((c) => {
      const rs = records.filter((r) => r.category === c);
      const f = rs.filter((r) => r.correct && r.attempts <= 1).length;
      byCat[c] = { n: rs.length, first: f, solved: rs.filter((r) => r.correct).length, rate: rs.length ? f / rs.length : null };
    });
    // 가장 어려웠던 유형: 한 번에 못 맞힌 비율이 가장 높은 유형 (같으면 틀린 횟수가 많은 쪽)
    const byType = {};
    records.forEach((r) => {
      const t = byType[r.type] || (byType[r.type] = { type: r.type, n: 0, miss: 0, wrong: 0 });
      t.n++;
      if (!(r.correct && r.attempts <= 1)) t.miss++;
      t.wrong += r.correct ? Math.max(0, r.attempts - 1) : Math.max(1, r.attempts);
    });
    const hard = Object.values(byType).filter((t) => t.miss > 0)
      .sort((a, b) => (b.miss / b.n - a.miss / a.n) || (b.wrong - a.wrong))[0] || null;
    const wrongList = records.filter((r) => !(r.correct && r.attempts <= 1));
    return { total, first, retry, unsolved, wrong: total - first, rate: total ? first / total : null, avgSec, byCat, hard, wrongList };
  }

  const pct = (x) => (x == null ? "-" : Math.round(x * 100) + "%");
  function stars(rate) {
    if (rate == null) return "";
    const n = clamp(Math.round(rate * 5), 1, 5);
    return "★".repeat(n) + "☆".repeat(5 - n);
  }

  // ── 학습 피드백 문구 (평가·비교 없이) ──
  const LIFE_TYPES = ["recipe", "evacmap", "water", "liquid", "volume", "books", "teams", "juice", "supplies"];
  function feedback(st, role, records = []) {
    const out = [];
    const L = st.byCat["비례식"], B = st.byCat["비례배분"];
    if (st.total === 0) {
      out.push("이번 판에는 문제를 풀지 않았어요. 다음 판에는 미션 장치를 찾아 도전해 봐요!");
      return out;
    }
    if (L.n && L.rate >= 0.8) out.push("비례식은 아주 잘 해결했어요!");
    else if (L.n && L.rate < 0.6) out.push("비례식 문제를 한 번 더 연습해보세요. 앞의 수가 몇 배가 되었는지 먼저 찾아보면 쉬워져요.");
    if (B.n && B.rate >= 0.8) out.push("비례배분을 정확하게 해냈어요!");
    else if (B.n && B.rate < 0.6) out.push("비례배분 문제를 한 번 더 연습해보세요. 전체를 비의 합만큼 나누는 것부터 시작해요.");
    // 생활 속 상황 문제를 한 번에 맞힌 적이 있으면
    if (records.some((r) => r.correct && r.attempts <= 1 && LIFE_TYPES.includes(r.type))) out.push("생활 속 비례 관계를 잘 찾아냈어요.");
    if (st.retry > 0) out.push(`힌트를 보고 끝까지 해결한 문제가 ${st.retry}개 있어요. 포기하지 않는 모습이 멋져요!`);
    if (st.hard) out.push(`「${typeName(st.hard.type)}」 유형을 다시 한번 살펴보면 좋겠어요.`);
    if (role === "saboteur" && st.first + st.retry > 0) out.push("방해꾼이면서도 가짜 미션에서 비례 문제를 해결했어요! 🎭");
    if (!out.length) out.push("미션을 해결하며 비례 관계를 잘 사용했어요.");
    return out;
  }

  // ─────────────────────────────────────────────────────────────
  // 나의 수학 기록 화면
  // ─────────────────────────────────────────────────────────────
  function renderMine(room, myId) {
    const recs = recordsOf(room, myId);
    const role = Roles.isSaboteur(room, myId) ? "saboteur" : "student";
    const st = stats(recs);
    const g = room.game || {};
    const win = g.winner === "student";
    $("#rs-winner").textContent = win ? "🎉 학생팀 승리 — 학교 복구 성공!" : "🌙 방해꾼 승리 — 학교 복구 실패";
    $("#rs-winner").className = "rs-winner " + (win ? "win" : "lose");

    const tiles = [
      ["총 문제", st.total, "개"],
      ["정답 (한 번에)", st.first, "개"],
      ["오답", st.wrong, "개"],
      ["정답률", st.rate == null ? "-" : Math.round(st.rate * 100), st.rate == null ? "" : "%"],
      ["평균 풀이 시간", st.avgSec ? Math.round(st.avgSec) : "-", st.avgSec ? "초" : ""],
    ];
    $("#rs-tiles").innerHTML = tiles.map(([k, v, u]) => `<div class="rs-tile"><div class="rs-k">${k}</div><div class="rs-v">${v}<small>${u}</small></div></div>`).join("");
    const sub = [];
    if (st.retry) sub.push(`다시 도전해서 해결 ${st.retry}개`);
    if (st.unsolved) sub.push(`시간 초과 ${st.unsolved}개`);
    $("#rs-sub").textContent = sub.length ? "오답 가운데 " + sub.join(" · ") : "";

    $("#rs-cats").innerHTML = ["비례식", "비례배분"].map((c) => {
      const x = st.byCat[c];
      return `<div class="rs-cat"><div class="rs-cat-name">${c}</div>` +
        (x.n ? `<div class="rs-stars">${stars(x.rate)}</div><div class="rs-cat-num">${pct(x.rate)} <small>(${x.first}/${x.n})</small></div>`
          : `<div class="rs-cat-none">이번 판에는 풀지 않았어요</div>`) + "</div>";
    }).join("");

    $("#rs-hard").textContent = st.hard ? typeName(st.hard.type) : (st.total ? "없어요! 모두 한 번에 맞혔어요 👏" : "-");
    $("#rs-feedback").innerHTML = feedback(st, role, recs).map((f) => `<li>${MG.esc(f)}</li>`).join("");

    // 틀린 문제 다시 보기 (정답과 풀이)
    const box = $("#rs-review");
    if (!st.wrongList.length) {
      box.innerHTML = '<p class="muted">다시 볼 문제가 없어요.</p>';
    } else {
      box.innerHTML = st.wrongList.map((r) => {
        const q = QUESTIONS.find((x) => x.id === r.qid);
        if (!q) return "";
        const ans = Array.isArray(q.answer) ? q.answer.map((a) => MG.fmt(a) + q.unit).join(" / ") : MG.fmt(q.answer) + q.unit;
        const state = r.correct ? `${r.attempts}번 만에 해결` : "시간 초과";
        return `<div class="rs-q"><div class="rs-q-head"><b>${MG.esc(typeName(q.missionType))}</b><span>${state}</span></div>
          <div class="rs-q-text">${MG.esc(q.question).replace(/\n/g, "<br>")}</div>
          <div class="rs-q-ans">정답: <b>${MG.esc(ans)}</b></div>
          <div class="rs-q-exp">💡 ${MG.esc(q.explanation)}</div></div>`;
      }).join("");
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 교사용 전체 학습 결과
  // ─────────────────────────────────────────────────────────────
  function people(room) {
    const ids = new Set(Object.keys(room.members || room.players || {}));
    Object.keys(room.results || {}).forEach((id) => ids.add(id));
    return Array.from(ids).map((id) => {
      const recs = recordsOf(room, id);
      const info = Roster.info(room, id) || {};
      const nick = info.nick || (recs[0] && recs[0].nick) || "(나간 학생)";
      const role = room.roles && room.roles[id] ? room.roles[id] : (recs[0] && recs[0].role) || "student";
      return { id, nick, role, bot: !!info.bot, recs, st: stats(recs) };
    }).filter((p) => !p.bot).sort((a, b) => a.nick.localeCompare(b.nick, "ko"));
  }

  function renderTeacher(room) {
    const list = people(room);
    const rows = list.map((p) => {
      const L = p.st.byCat["비례식"], B = p.st.byCat["비례배분"];
      return `<tr>
        <td class="nm">${MG.esc(p.nick)}${p.role === "saboteur" ? ' <span class="tag-sab">방해꾼</span>' : ""}</td>
        <td>${L.n ? `${L.first}/${L.n}` : "-"}</td>
        <td>${B.n ? `${B.first}/${B.n}` : "-"}</td>
        <td>${pct(p.st.rate)}</td>
        <td>${p.st.retry + p.st.first}/${p.st.total}</td>
        <td>${p.st.avgSec ? Math.round(p.st.avgSec) + "초" : "-"}</td>
        <td class="hard">${p.st.hard ? MG.esc(typeName(p.st.hard.type)) : "-"}</td>
      </tr>`;
    }).join("");
    // 반 전체 요약: 가장 많이 틀린 유형
    const all = list.flatMap((p) => p.recs);
    const cls = stats(all);
    $("#tr-summary").innerHTML = `반 전체 <b>${all.length}</b>문제 · 한 번에 정답률 <b>${pct(cls.rate)}</b> · 비례식 ${pct(cls.byCat["비례식"].rate)} · 비례배분 ${pct(cls.byCat["비례배분"].rate)}` +
      (cls.hard ? ` · 가장 어려워한 유형: <b>${MG.esc(typeName(cls.hard.type))}</b>` : "");
    $("#tr-body").innerHTML = rows || '<tr><td colspan="7" class="muted">아직 기록이 없어요.</td></tr>';
  }

  // ─────────────────────────────────────────────────────────────
  // CSV
  // ─────────────────────────────────────────────────────────────
  function csvCell(v) {
    let s = v == null ? "" : String(v);
    if (/^[=+\-@]/.test(s)) s = "'" + s;             // 엑셀 수식으로 해석되지 않게
    if (/[",\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  }
  function download(name, rows) {
    const text = "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n"); // 엑셀 한글 깨짐 방지(BOM)
    const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  function stamp() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
  }

  // 문제별 기록 (3차 설계 20번 항목 + 참고 항목)
  function recordRows(room) {
    const rows = [["player", "questionId", "category", "difficulty", "correct", "attempts", "solveTime",
      "firstTry", "timeout", "type", "role", "helped", "time"]];
    people(room).forEach((p) => {
      p.recs.forEach((r) => {
        rows.push([p.nick, r.qid, r.category, r.difficulty, r.correct ? "TRUE" : "FALSE", r.attempts, r.solveSec,
          r.correct && r.attempts <= 1 ? "TRUE" : "FALSE", r.timeout ? "TRUE" : "FALSE", typeName(r.type), r.role || p.role,
          r.helped ? "TRUE" : "FALSE", new Date(r.t).toLocaleString("ko-KR")]);
      });
    });
    return rows;
  }
  // 학생별 요약
  function summaryRows(room) {
    const rows = [["닉네임", "역할", "비례식(한 번에 정답/문제)", "비례배분(한 번에 정답/문제)", "한 번에 정답률", "해결한 문제/전체", "평균 풀이 시간(초)", "오답이 많았던 유형"]];
    people(room).forEach((p) => {
      const L = p.st.byCat["비례식"], B = p.st.byCat["비례배분"];
      rows.push([p.nick, p.role === "saboteur" ? "방해꾼" : "학생", `${L.first}/${L.n}`, `${B.first}/${B.n}`,
        p.st.rate == null ? "" : Math.round(p.st.rate * 100) + "%", `${p.st.first + p.st.retry}/${p.st.total}`,
        p.st.avgSec ? Math.round(p.st.avgSec) : "", p.st.hard ? typeName(p.st.hard.type) : ""]);
    });
    return rows;
  }

  function downloadRecords(room) { download(`멈춰버린학교_문제별기록_${stamp()}.csv`, recordRows(room)); }
  function downloadSummary(room) { download(`멈춰버린학교_학생별요약_${stamp()}.csv`, summaryRows(room)); }

  return { stats, feedback, renderMine, renderTeacher, recordRows, summaryRows, downloadRecords, downloadSummary, typeName, stars };
})();
