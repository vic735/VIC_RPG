/* Named audio hooks can be replaced by recorded assets without changing gameplay. */
(function (root) {
  const defaults = { volume: .22, sound: true, reducedMotion: false, contrast: false, autoQuickBattle: true };
  let settings = { ...defaults }, context, lastHover = 0;
  try { const raw = JSON.parse(localStorage.getItem('afterlight.settings.v1') || 'null'); if (raw) { settings.volume = Number.isFinite(raw.volume) ? Math.min(1, Math.max(0, raw.volume)) : .22; for (const k of ['sound', 'reducedMotion', 'contrast', 'autoQuickBattle']) if (typeof raw[k] === 'boolean') settings[k] = raw[k]; } } catch (_) {}
  const subscribers = new Set();
  const tones = { buttonHover: [370, .035], buttonConfirm: [520, .065], skillSelect: [440, .05], skillCast: [680, .1], damage: [120, .04], critical: [920, .12], levelUp: [880, .3], growthTick: [1160, .035], itemGain: [760, .22], dungeonEnter: [210, .2], ultimateReady: [1050, .24], danger: [185, .17], interrupt: [250, .1] };
  function unlock() { if (!settings.sound) return; try { context ||= new (root.AudioContext || root.webkitAudioContext)(); if (context.state === 'suspended') context.resume().catch(() => {}); } catch (_) {} }
  function emit(name, payload = {}) {
    for (const listener of subscribers) listener(name, payload);
    if (!settings.sound || !context || context.state !== 'running') return;
    if (name === 'buttonHover') { const now = Date.now(); if (now - lastHover < 100) return; lastHover = now; }
    const [frequency, duration] = tones[name] || tones.buttonConfirm;
    try { const osc = context.createOscillator(), gain = context.createGain(), at = context.currentTime; osc.type = name === 'damage' ? 'triangle' : 'sine'; osc.frequency.setValueAtTime(frequency, at); osc.frequency.exponentialRampToValueAtTime(frequency * (name === 'levelUp' ? 1.5 : .85), at + duration); gain.gain.setValueAtTime(.0001, at); gain.gain.exponentialRampToValueAtTime(Math.max(.0001, settings.volume * (name==='growthTick'?.025:.1)), at + .008); gain.gain.exponentialRampToValueAtTime(.0001, at + duration); osc.connect(gain).connect(context.destination); osc.start(at); osc.stop(at + duration + .02); osc.onended = () => { osc.disconnect(); gain.disconnect(); }; } catch (_) {}
  }
  function update(key, value) { if (!(key in defaults)) return false; settings[key] = key === 'volume' ? Math.min(1, Math.max(0, Number(value) || 0)) : !!value; try { localStorage.setItem('afterlight.settings.v1', JSON.stringify(settings)); return true; } catch (_) { return false; } }
  root.GameAudio = { reset(){Object.assign(settings,defaults);}, settings, unlock, emit, update, subscribe(fn) { subscribers.add(fn); return () => subscribers.delete(fn); }, hooks: Object.keys(tones) };
})(globalThis);
