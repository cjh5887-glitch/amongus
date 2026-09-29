/* =====================================================================
   sound.js — 예전 효과음 함수(Sound.play)를 AudioManager 로 연결하는 통로

   ▸ 소리는 이제 audio.js 의 AudioManager 가 한 곳에서 관리합니다.
   ▸ 예전 코드의 Sound.play("correct") 같은 호출은 그대로 동작합니다.
   ===================================================================== */

const Sound = {
  // 예전 기본 음량 0.7 을 1 로 맞춰서 전달
  play(name, volume = 0.7) { AudioManager.playSFX(name, clamp(volume / 0.7, 0, 1.5)); },
  setMuted(v) { AudioManager.setSFXEnabled(!v); },
  get muted() { return !AudioManager.settings.SFX_ON; },
};
