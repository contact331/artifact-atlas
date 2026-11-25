(() => {
  const inspector = document.getElementById('inspector');
  const soundToggle = document.getElementById('atlasSidebarSound');
  if (!inspector || !soundToggle) return;

  const soundLabel = soundToggle.querySelector('span');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const buttonSelector = '.artifact-directory-entry, #quickpadSocket';
  let clickEffect;

  soundToggle.hidden = !(window.AudioContext || window.webkitAudioContext);

  let audioContext;
  let soundBus;
  let cues;
  let soundEnabled = false;
  let enablingSound = false;
  let lastHover = -Infinity;

  function makeCue(duration, layers) {
    const rate = audioContext.sampleRate;
    const buffer = audioContext.createBuffer(1, Math.round(duration * rate), rate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) {
      const time = i / rate;
      const envelope = Math.min(time / .002, 1, (duration - time) / .007);
      for (const {start, end, level, decay} of layers) {
        const cycles = start * time + (end - start) * time * time / (2 * duration);
        samples[i] += Math.sin(2 * Math.PI * cycles) * level * envelope * Math.exp(-time / decay);
      }
    }
    return buffer;
  }

  function initializeSound() {
    const Context = window.AudioContext || window.webkitAudioContext;
    audioContext = new Context();
    soundBus = audioContext.createGain();
    soundBus.gain.value = 0;
    soundBus.connect(audioContext.destination);
    cues = {
      hover: makeCue(.05, [
        {start:1050, end:730, level:.052, decay:.013},
        {start:1650, end:1220, level:.018, decay:.008}
      ]),
      click: makeCue(.115, [
        {start:440, end:180, level:.13, decay:.025},
        {start:780, end:980, level:.052, decay:.039}
      ])
    };
  }

  function playCue(kind) {
    if (!soundEnabled || audioContext?.state !== 'running') return;
    if (kind === 'hover') {
      const now = audioContext.currentTime;
      if (now - lastHover < .065) return;
      lastHover = now;
    }
    const source = audioContext.createBufferSource();
    source.buffer = cues[kind];
    source.connect(soundBus);
    source.onended = () => source.disconnect();
    source.start();
  }

  function showSound(enabled) {
    soundEnabled = enabled;
    soundBus.gain.setValueAtTime(enabled ? 1 : 0, audioContext.currentTime);
    soundToggle.setAttribute('aria-pressed', String(enabled));
    soundLabel.textContent = enabled ? 'On' : 'Off';
  }

  soundToggle.addEventListener('click', async () => {
    if (enablingSound) return;
    if (soundEnabled) {
      showSound(false);
      return;
    }
    enablingSound = true;
    try {
      if (!audioContext) initializeSound();
      await audioContext.resume();
      showSound(audioContext.state === 'running');
    } catch {
      soundLabel.textContent = 'unavailable';
      soundToggle.disabled = true;
    } finally {
      enablingSound = false;
    }
  });

  function showPulse(button, event) {
    if (reducedMotion.matches) return;

    const bounds = button.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;

    clickEffect?.remove();
    const effect = document.createElement('span');
    const computed = getComputedStyle(button);
    effect.className = 'atlas-sidebar-click-effect';
    effect.setAttribute('aria-hidden', 'true');
    Object.assign(effect.style, {
      left: bounds.left + 'px',
      top: bounds.top + 'px',
      width: bounds.width + 'px',
      height: bounds.height + 'px',
      borderRadius: computed.borderRadius
    });
    effect.style.setProperty('--sidebar-vfx-color', computed.getPropertyValue('--sidebar-vfx-color'));
    effect.style.setProperty('--pulse-x', (event.detail ? event.clientX - bounds.left : bounds.width / 2) + 'px');
    effect.style.setProperty('--pulse-y', (event.detail ? event.clientY - bounds.top : bounds.height / 2) + 'px');
    const clear = () => {
      effect.remove();
      if (clickEffect === effect) clickEffect = null;
    };
    effect.addEventListener('animationend', clear, { once: true });
    effect.addEventListener('animationcancel', clear, { once: true });
    clickEffect = effect;
    // The directory row disappears synchronously when its record opens.
    // Render the pulse separately so selection and Quickpad opening stay immediate.
    if (button.id === 'quickpadSocket') {
      requestAnimationFrame(() => {
        if (clickEffect !== effect) return;
        const dialog = document.querySelector('.qp-dialog[open]');
        (dialog || document.body).append(effect);
      });
    } else {
      document.body.append(effect);
    }
  }

  inspector.addEventListener('pointerover', event => {
    if (event.pointerType === 'touch') return;
    const button = event.target.closest(buttonSelector);
    if (!button || button.contains(event.relatedTarget)) return;
    playCue('hover');
  });

  inspector.addEventListener('click', event => {
    const button = event.target.closest(buttonSelector);
    if (!button) return;
    playCue('click');
    showPulse(button, event);
  }, { capture: true });
})();
