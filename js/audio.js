/* =====================================================================
   audio.js — AudioManager (효과음 · 배경음악을 한 곳에서 관리)

   AudioManager.playSFX(이름)     효과음
   AudioManager.playBGM(이름)     배경음악 (lobby · game · lastMinute · victory · defeat)
   AudioManager.stopBGM()
   AudioManager.setMasterVolume(0~100) / setBGMVolume(0~100) / setSFXVolume(0~100)
   AudioManager.setBGMEnabled(true/false) / setSFXEnabled(true/false)

   ▸ 소리 파일이 없어도 게임 안에서 만든 소리(합성음)로 재생됩니다.
   ▸ config.js 의 AUDIO_FILES 에 파일을 적으면 그 파일이 우선입니다.
     (배경음악은 "bgm_이름" 으로 적어요. 예: bgm_game: "assets/sounds/game.mp3")
   ▸ 파일을 못 읽거나 소리를 낼 수 없는 환경이어도 게임은 그대로 진행됩니다.
   ▸ 음량은 MASTER_VOLUME · BGM_VOLUME · SFX_VOLUME (0~100) 으로 이 기기에 저장됩니다.
   ▸ 미션(수학 문제)을 푸는 동안에는 배경음악을 작게 줄입니다.
   ===================================================================== */

const AudioManager = (() => {
  const KEY = "rs_audio";
  const num = (v, d) => (typeof v === "number" && isFinite(v) ? clamp(Math.round(v), 0, 100) : d);
  const saved = SafeStore.get(KEY, {}) || {};
  const settings = {
    MASTER_VOLUME: num(saved.MASTER_VOLUME, 80),
    BGM_VOLUME: num(saved.BGM_VOLUME, 35),
    SFX_VOLUME: num(saved.SFX_VOLUME, 80),
    BGM_ON: saved.BGM_ON !== false,
    SFX_ON: saved.SFX_ON !== false,
  };
  const FILES = typeof AUDIO_FILES !== "undefined" ? AUDIO_FILES : {};
  const BGM_LEVEL = 0.45;    // 배경음악은 효과음보다 작게
  const DUCK_LEVEL = 0.35;   // 미션 중 배경음악 크기

  let ctx = null, master = null, sfxBus = null, bgmBus = null, duckGain = null, noiseBuf = null;
  let unlocked = false;
  let bgmName = null, bgmPlayer = null, ducked = false;
  const fileMissing = new Set();
  const fileAudio = {};
  const log = [];            // 최근 효과음 (테스트 확인용)

  function save() { SafeStore.set(KEY, settings); }

  // ─────────────────────────────────────────────────────────────
  // 소리 장치 준비 (브라우저는 화면을 한 번 누른 뒤에만 소리를 낼 수 있어요)
  // ─────────────────────────────────────────────────────────────
  function ensureCtx() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
      master = ctx.createGain(); master.connect(ctx.destination);
      sfxBus = ctx.createGain(); sfxBus.connect(master);
      bgmBus = ctx.createGain();
      duckGain = ctx.createGain(); bgmBus.connect(duckGain); duckGain.connect(master);
      const len = ctx.sampleRate;
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      applyVolumes();
    } catch (e) { ctx = null; }
    return ctx;
  }

  function unlock() {
    if (!ensureCtx()) return;
    unlocked = true;
    if (ctx.state === "suspended" && !document.hidden) ctx.resume().catch(() => {});
    if (bgmName && !bgmPlayer) startBGM(bgmName);
    if (bgmPlayer && bgmPlayer.file) bgmPlayer.play();
  }
  ["pointerdown", "keydown", "touchstart"].forEach((ev) => window.addEventListener(ev, unlock, { capture: true, passive: true }));
  document.addEventListener("visibilitychange", () => {
    if (!ctx) return;
    if (document.hidden) { ctx.suspend().catch(() => {}); if (bgmPlayer && bgmPlayer.file) bgmPlayer.pause(); }
    else if (unlocked) { ctx.resume().catch(() => {}); if (bgmPlayer && bgmPlayer.file) bgmPlayer.play(); }
  });

  const v01 = (x) => clamp(x, 0, 100) / 100;
  function sfxLevel() { return settings.SFX_ON ? v01(settings.MASTER_VOLUME) * v01(settings.SFX_VOLUME) : 0; }
  function bgmLevel() { return settings.BGM_ON ? v01(settings.MASTER_VOLUME) * v01(settings.BGM_VOLUME) * BGM_LEVEL * (ducked ? DUCK_LEVEL : 1) : 0; }

  function applyVolumes() {
    if (ctx) {
      const t = ctx.currentTime;
      master.gain.setTargetAtTime(v01(settings.MASTER_VOLUME), t, 0.03);
      sfxBus.gain.setTargetAtTime(settings.SFX_ON ? v01(settings.SFX_VOLUME) : 0, t, 0.03);
      bgmBus.gain.setTargetAtTime(settings.BGM_ON ? v01(settings.BGM_VOLUME) * BGM_LEVEL : 0, t, 0.03);
      duckGain.gain.setTargetAtTime(ducked ? DUCK_LEVEL : 1, t, 0.15);
    }
    if (bgmPlayer && bgmPlayer.file) bgmPlayer.setVolume(bgmLevel());
  }

  // ─────────────────────────────────────────────────────────────
  // 합성음 도구
  // ─────────────────────────────────────────────────────────────
  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

  function tone(freq, at, dur, o = {}) {
    const out = o.bus || sfxBus;
    const t = ctx.currentTime + (o.abs ? 0 : 0) + at;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = o.type || "sine";
    osc.frequency.setValueAtTime(freq, t);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.slide), t + dur);
    if (o.detune) osc.detune.setValueAtTime(o.detune, t);
    const vol = o.vol == null ? 0.3 : o.vol;
    const a = o.attack == null ? 0.005 : o.attack;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = osc;
    if (o.lowpass) {
      const f = ctx.createBiquadFilter();
      f.type = "lowpass"; f.frequency.value = o.lowpass;
      osc.connect(f); node = f;
    }
    node.connect(g); g.connect(out);
    osc.start(t); osc.stop(t + dur + 0.05);
  }

  function noise(at, dur, o = {}) {
    const out = o.bus || sfxBus;
    const t = ctx.currentTime + at;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = o.filter || "bandpass";
    f.frequency.setValueAtTime(o.freq || 1500, t);
    if (o.slide) f.frequency.exponentialRampToValueAtTime(o.slide, t + dur);
    f.Q.value = o.q || 1;
    const g = ctx.createGain();
    const vol = o.vol == null ? 0.2 : o.vol;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + (o.attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(out);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
  }

  const arp = (notes, gap, dur, o) => notes.forEach((n, i) => tone(midi(n), i * gap, dur, o));

  // ─────────────────────────────────────────────────────────────
  // 효과음 목록 (합성음)
  // ─────────────────────────────────────────────────────────────
  const SFX = {
    click:        () => tone(1100, 0, 0.05, { type: "square", vol: 0.06 }),
    menuOpen:     () => { tone(520, 0, 0.12, { type: "triangle", vol: 0.18, slide: 820 }); tone(1040, 0.05, 0.1, { vol: 0.06 }); },
    menuClose:    () => tone(780, 0, 0.12, { type: "triangle", vol: 0.16, slide: 480 }),
    join:         () => arp([72, 76, 79], 0.08, 0.22, { type: "triangle", vol: 0.2 }),
    create:       () => arp([72, 76, 79, 84], 0.08, 0.3, { type: "triangle", vol: 0.2 }),
    start:        () => { arp([67, 72, 76], 0.1, 0.2, { type: "square", vol: 0.1, lowpass: 2500 }); tone(midi(79), 0.3, 0.7, { type: "square", vol: 0.12, lowpass: 2500 }); tone(midi(67), 0.3, 0.7, { type: "triangle", vol: 0.15 }); },
    countdown:    () => tone(660, 0, 0.16, { vol: 0.28 }),
    countdownGo:  () => { tone(990, 0, 0.45, { vol: 0.3 }); tone(1320, 0, 0.45, { vol: 0.12 }); },
    found:        () => { tone(1320, 0, 0.12, { vol: 0.14 }); tone(1760, 0.07, 0.16, { vol: 0.12 }); },
    missionOpen:  () => { tone(300, 0, 0.18, { type: "triangle", vol: 0.2, slide: 640 }); noise(0, 0.12, { freq: 3000, vol: 0.05 }); },
    correct:      () => { tone(midi(84), 0, 0.14, { type: "triangle", vol: 0.25 }); tone(midi(88), 0.09, 0.3, { type: "triangle", vol: 0.25 }); },
    wrong:        () => { tone(233, 0, 0.18, { type: "sawtooth", vol: 0.1, lowpass: 900 }); tone(196, 0.14, 0.28, { type: "sawtooth", vol: 0.1, lowpass: 900 }); },
    missionComplete: () => { arp([72, 76, 79, 84], 0.07, 0.25, { type: "triangle", vol: 0.2 }); [2093, 2637, 3136].forEach((f, i) => tone(f, 0.3 + i * 0.05, 0.5, { vol: 0.05 })); },
    repairUp:     () => tone(420, 0, 0.35, { type: "triangle", vol: 0.12, slide: 880 }),
    iceStart:     () => { noise(0, 0.35, { filter: "highpass", freq: 2500, vol: 0.12 }); tone(1200, 0, 0.35, { vol: 0.08, slide: 2600 }); },
    iceDone:      () => [2093, 2637, 3136, 4186].forEach((f, i) => tone(f, i * 0.04, 0.7, { vol: 0.07 })),
    tag:          () => { noise(0, 0.22, { freq: 500, slide: 2400, q: 2, vol: 0.2 }); tone(880, 0.05, 0.2, { type: "triangle", vol: 0.1, slide: 1760 }); },
    rescueStart:  () => tone(587, 0, 0.14, { type: "triangle", vol: 0.16, slide: 700 }),
    rescueDone:   () => { tone(880, 0, 0.9, { vol: 0.25 }); tone(1320, 0, 0.8, { vol: 0.12 }); tone(1760, 0, 0.5, { vol: 0.06 }); noise(0, 0.08, { freq: 4000, vol: 0.08 }); },
    iceBreak:     () => { noise(0, 0.3, { freq: 3500, slide: 900, q: 3, vol: 0.2 }); [3136, 2637, 2349].forEach((f, i) => tone(f, 0.05 + i * 0.06, 0.2, { vol: 0.06 })); },
    protect:      () => { for (let i = 0; i < 5; i++) tone(i % 2 ? 1318 : 1046, i * 0.07, 0.12, { vol: 0.07 }); },
    report:       () => { for (let i = 0; i < 4; i++) tone(i % 2 ? 660 : 880, i * 0.18, 0.17, { type: "square", vol: 0.1, lowpass: 2200 }); },
    meeting:      () => [0, 0.45, 0.9].forEach((t) => { tone(523, t, 0.6, { vol: 0.22 }); tone(415, t, 0.6, { vol: 0.12 }); }),
    vote:         () => tone(700, 0, 0.08, { type: "triangle", vol: 0.2, slide: 1000 }),
    blackout:     () => { tone(400, 0, 0.8, { type: "sawtooth", vol: 0.12, slide: 55, lowpass: 1200 }); noise(0, 0.25, { filter: "lowpass", freq: 300, vol: 0.25 }); },
    lockDoor:     () => { noise(0, 0.12, { filter: "lowpass", freq: 600, vol: 0.3 }); tone(140, 0.02, 0.15, { type: "square", vol: 0.12, lowpass: 600 }); },
    disguise:     () => { noise(0, 0.4, { freq: 800, slide: 3000, q: 1.5, vol: 0.1 }); tone(600, 0, 0.4, { type: "triangle", vol: 0.1, slide: 900 }); },
    oneMinute:    () => [0, 0.3].forEach((t) => { tone(988, t, 0.25, { vol: 0.2 }); tone(740, t + 0.12, 0.3, { vol: 0.2 }); }),
    tenSeconds:   () => { tone(1200, 0, 0.12, { type: "square", vol: 0.08, lowpass: 3000 }); tone(1200, 0.18, 0.12, { type: "square", vol: 0.08, lowpass: 3000 }); },
    tick:         () => tone(1500, 0, 0.04, { type: "square", vol: 0.04, lowpass: 3000 }),
    winStudent:   () => { arp([60, 64, 67, 72], 0.12, 0.3, { type: "triangle", vol: 0.22 }); [72, 76, 79].forEach((n) => tone(midi(n), 0.5, 1.2, { type: "triangle", vol: 0.14 })); },
    winTagger:    () => { arp([69, 72, 76, 81], 0.1, 0.18, { type: "square", vol: 0.1, lowpass: 2500 }); [2093, 2637, 3136].forEach((f, i) => tone(f, 0.45 + i * 0.06, 0.8, { vol: 0.07 })); },
    winSaboteur:  () => { arp([64, 62, 60, 59], 0.18, 0.4, { type: "triangle", vol: 0.2 }); tone(midi(45), 0.7, 1.4, { type: "sawtooth", vol: 0.08, lowpass: 500 }); },
    lose:         () => arp([67, 64, 60, 55], 0.2, 0.45, { type: "triangle", vol: 0.18 }),
  };
  const ALIAS = { win: "winStudent" };

  // ─────────────────────────────────────────────────────────────
  // 효과음 재생
  // ─────────────────────────────────────────────────────────────
  function playSFX(name, volume = 1) {
    name = ALIAS[name] || name;
    log.push(name); if (log.length > 60) log.shift();
    if (!settings.SFX_ON || settings.SFX_VOLUME === 0 || settings.MASTER_VOLUME === 0) return;
    if (FILES[name] && !fileMissing.has(name)) {
      try {
        const a = new Audio(FILES[name]);
        a.volume = clamp(sfxLevel() * volume, 0, 1);
        a.addEventListener("error", () => { fileMissing.add(name); playSynth(name, volume); });
        const p = a.play();
        if (p && p.catch) p.catch(() => {});
        return;
      } catch (e) { fileMissing.add(name); }
    }
    playSynth(name, volume);
  }

  function playSynth(name, volume) {
    const fn = SFX[name];
    if (!fn || !ensureCtx()) return;
    if (!unlocked || document.hidden) return;   // 누르기 전이거나 숨겨진 탭이면 조용히
    try {
      if (volume !== 1) {
        // 한 번만 크기를 바꿔 재생 (임시 통로)
        const tmp = ctx.createGain(); tmp.gain.value = volume; tmp.connect(sfxBus);
        const keep = sfxBus; sfxBus = tmp; try { fn(); } finally { sfxBus = keep; }
        setTimeout(() => { try { tmp.disconnect(); } catch (e) { /* 무시 */ } }, 4000);
      } else fn();
    } catch (e) { /* 소리 오류는 무시 */ }
  }

  // ─────────────────────────────────────────────────────────────
  // 배경음악 (합성음: 8분음표 단위로 조금씩 미리 예약해서 재생)
  // ─────────────────────────────────────────────────────────────
  // 코드 진행 (MIDI 음 번호) — 4마디 반복
  const SONGS = {
    lobby:      { bpm: 92,  chords: [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]], style: "calm" },
    game:       { bpm: 100, chords: [[57, 60, 64], [53, 57, 60], [50, 53, 57], [52, 56, 59]], style: "mystery" },
    lastMinute: { bpm: 138, chords: [[57, 60, 64], [53, 57, 60], [50, 53, 57], [52, 56, 59]], style: "tense" },
    victory:    { bpm: 120, chords: [[60, 64, 67], [65, 69, 72], [67, 71, 74], [60, 64, 67]], style: "bright" },
    defeat:     { bpm: 70,  chords: [[57, 60, 64], [50, 53, 57], [52, 56, 59], [57, 60, 64]], style: "sad" },
  };

  function synthBGM(name) {
    const song = SONGS[name];
    if (!song || !ensureCtx()) return null;
    const out = ctx.createGain();
    out.gain.value = 0.0001;
    out.connect(bgmBus);
    out.gain.setTargetAtTime(1, ctx.currentTime, 0.4);
    const stepDur = 60 / song.bpm / 2;
    let step = 0, next = ctx.currentTime + 0.1;
    const o = (extra) => ({ bus: out, ...extra });

    function playStep(i, t0) {
      const at = t0 - ctx.currentTime;
      const bar = Math.floor(i / 8) % song.chords.length;
      const ch = song.chords[bar];
      const s = i % 8;
      switch (song.style) {
        case "calm":
          if (s === 0) ch.forEach((n) => tone(midi(n), at, stepDur * 8, o({ type: "triangle", vol: 0.05, attack: 0.3 })));
          tone(midi(ch[[0, 1, 2, 1][s % 4]] + 12), at, stepDur * 1.6, o({ vol: 0.06 }));
          if (s % 4 === 0) tone(midi(ch[0] - 12), at, stepDur * 3, o({ type: "triangle", vol: 0.1 }));
          break;
        case "mystery":
          tone(midi(ch[0] - 12), at, stepDur * 0.9, o({ type: "square", vol: 0.035, lowpass: 500 }));
          if (s === 0) ch.forEach((n) => tone(midi(n), at, stepDur * 8, o({ type: "triangle", vol: 0.035, attack: 0.5 })));
          if (s === 3 || s === 6) tone(midi(ch[(s + bar) % 3] + 12), at, stepDur * 3, o({ vol: 0.05 }));
          break;
        case "tense":
          tone(midi(ch[0] - 12), at, stepDur * 0.8, o({ type: "square", vol: 0.045, lowpass: 700 }));
          noise(at, 0.04, { bus: out, filter: "highpass", freq: 6000, vol: 0.03 });
          if (s % 2 === 0) tone(midi(ch[(s / 2) % 3] + 12), at, stepDur * 1.5, o({ type: "triangle", vol: 0.05 }));
          break;
        case "bright":
          if (s === 0) ch.forEach((n) => tone(midi(n), at, stepDur * 8, o({ type: "triangle", vol: 0.05, attack: 0.1 })));
          tone(midi(ch[[0, 1, 2, 1, 2, 1, 0, 2][s]] + 12), at, stepDur * 1.2, o({ type: "triangle", vol: 0.06 }));
          if (s % 2 === 0) tone(midi(ch[0] - 12), at, stepDur * 1.5, o({ type: "triangle", vol: 0.08 }));
          break;
        case "sad":
          if (s === 0) ch.forEach((n) => tone(midi(n), at, stepDur * 8, o({ type: "sine", vol: 0.06, attack: 0.6 })));
          if (s === 0 || s === 4) tone(midi(ch[2] + 12 - (s ? 2 : 0)), at, stepDur * 4, o({ type: "triangle", vol: 0.04, attack: 0.2 }));
          break;
      }
    }

    const timer = setInterval(() => {
      if (ctx.state !== "running") { next = ctx.currentTime + 0.1; return; }
      if (next < ctx.currentTime - 0.3) next = ctx.currentTime + 0.05;   // 탭이 쉬었다가 돌아온 경우
      while (next < ctx.currentTime + 0.3) { try { playStep(step, next); } catch (e) { /* 무시 */ } step++; next += stepDur; }
    }, 80);
    return {
      stop() {
        clearInterval(timer);
        try { out.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.15); } catch (e) { /* 무시 */ }
        setTimeout(() => { try { out.disconnect(); } catch (e) { /* 무시 */ } }, 1200);
      },
    };
  }

  function fileBGM(name) {
    const src = FILES["bgm_" + name];
    if (!src || fileMissing.has("bgm_" + name)) return null;
    try {
      const a = fileAudio[name] || new Audio(src);
      fileAudio[name] = a;
      a.loop = true;
      a.currentTime = 0;
      a.volume = clamp(bgmLevel(), 0, 1);
      const player = {
        file: true,
        play() { const p = a.play(); if (p && p.catch) p.catch(() => {}); },
        pause() { a.pause(); },
        stop() { a.pause(); },
        setVolume(v) { a.volume = clamp(v, 0, 1); },
      };
      a.onerror = () => {
        fileMissing.add("bgm_" + name);
        if (bgmPlayer === player) { bgmPlayer = null; if (bgmName === name) startBGM(name); }
      };
      if (unlocked) player.play();
      return player;
    } catch (e) { fileMissing.add("bgm_" + name); return null; }
  }

  function startBGM(name) {
    if (!unlocked) return;          // 첫 터치 후 자동으로 시작됩니다
    bgmPlayer = fileBGM(name) || synthBGM(name);
  }

  function playBGM(name) {
    if (!name) return stopBGM();
    if (name === bgmName && bgmPlayer) return;
    if (bgmPlayer) { bgmPlayer.stop(); bgmPlayer = null; }
    bgmName = name;
    startBGM(name);
  }

  function stopBGM() {
    if (bgmPlayer) bgmPlayer.stop();
    bgmPlayer = null;
    bgmName = null;
  }

  // 미션 중에는 배경음악을 작게
  function duck(on) {
    if (ducked === !!on) return;
    ducked = !!on;
    applyVolumes();
  }

  // ─────────────────────────────────────────────────────────────
  // 음량 설정 (0~100, 이 기기에 저장)
  // ─────────────────────────────────────────────────────────────
  function set(key, v) { settings[key] = typeof v === "boolean" ? v : num(Number(v), settings[key]); save(); applyVolumes(); }
  const setMasterVolume = (v) => set("MASTER_VOLUME", v);
  const setBGMVolume = (v) => set("BGM_VOLUME", v);
  const setSFXVolume = (v) => set("SFX_VOLUME", v);
  const setBGMEnabled = (on) => set("BGM_ON", !!on);
  const setSFXEnabled = (on) => set("SFX_ON", !!on);

  return {
    playSFX, playBGM, stopBGM, duck,
    setMasterVolume, setBGMVolume, setSFXVolume, setBGMEnabled, setSFXEnabled,
    get settings() { return { ...settings }; },
    get bgm() { return bgmName; },
    get unlocked() { return unlocked; },
    log,
    SFX_NAMES: Object.keys(SFX),
  };
})();
