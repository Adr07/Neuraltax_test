// src/lipSync.js
// Lip Sync con Web Audio API basado en volumen (RMS) + suavizado y cuantización a múltiples sprites
// Permite trabajar con <audio> o micrófono y mapear a índices de sprites personalizados

// Compatibilidad anterior (4 nombres)
const mouthSprites = {
  closed: "/assets/mouths/G1 neutra.png",
  small: "/assets/mouths/G-AE.png",
  medium: "/assets/mouths/G-EE.png",
  wide: "/assets/mouths/G-Oh.png",
};

export async function initLipSync({
  audioElement,
  setMouthIndex,        // preferido: índice en tu arreglo de sprites
  setMouthByName,       // compat: 'closed' | 'small' | 'medium' | 'wide'
  useMic = false,
  fps = 12,
  smoothing = 0.2,      // 0..1, mayor = más suavizado
  hysteresis = 0.04,    // diferencia mínima para cambiar nivel (evitar parpadeo)
  mapVolumeToIndex,     // función (level0to1)=> índice de sprite
  indicesPalette = [    // paleta por defecto (orden con variedad visual)
    0, 1, 3, 8, 15, 5, 11, 2, 10, 12
  ],
}) {
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  let source;

  if (useMic) {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    source = audioCtx.createMediaStreamSource(stream);
  } else if (audioElement) {
    source = audioCtx.createMediaElementSource(audioElement);
  } else {
    throw new Error('initLipSync: requiere audioElement o useMic=true');
  }

  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 1024;
  source.connect(analyser);
  if (!useMic) analyser.connect(audioCtx.destination);

  const timeData = new Uint8Array(analyser.fftSize);

  // Estado para suavizado y ritmo
  let env = 0;                // envolvente suavizada 0..1
  let lastLevel = 0;          // último nivel
  let lastUpdate = 0;
  const frameMs = 1000 / Math.max(1, fps);

  function computeRMS() {
    analyser.getByteTimeDomainData(timeData);
    let sum = 0;
    for (let i = 0; i < timeData.length; i++) {
      const v = (timeData[i] - 128) / 128; // -1..1
      sum += v * v;
    }
    const rms = Math.sqrt(sum / timeData.length); // 0..1
    return rms;
  }

  function defaultMap(level) {
    // cuantiza el nivel a la paleta de índices
    const idx = Math.min(indicesPalette.length - 1, Math.floor(level * indicesPalette.length));
    return indicesPalette[idx];
  }

  function update(timestamp) {
    const rms = computeRMS();

    // Suavizado tipo ataque/decay simple
    const alpha = smoothing; // 0..1
    env = env + alpha * (rms - env);

    // Normaliza con un piso de ruido (aprox). 0.03 es silencioso típico.
    const noiseFloor = 0.03;
    let level = (env - noiseFloor) / (1 - noiseFloor);
    level = Math.max(0, Math.min(1, level));

    // Histeresis + límite de FPS
    const now = timestamp || performance.now();
    const canUpdate = (now - lastUpdate) >= frameMs && Math.abs(level - lastLevel) > hysteresis;

    if (canUpdate) {
      const targetIndex = mapVolumeToIndex ? mapVolumeToIndex(level) : (setMouthIndex ? defaultMap(level) : (level < 0.2 ? 'closed' : level < 0.4 ? 'small' : level < 0.65 ? 'medium' : 'wide'));

      if (setMouthIndex && typeof targetIndex === 'number') {
        setMouthIndex(targetIndex);
      } else if (setMouthByName && typeof targetIndex === 'string') {
        setMouthByName(targetIndex);
      }

      lastLevel = level;
      lastUpdate = now;
    }

    requestAnimationFrame(update);
  }

  requestAnimationFrame(update);
}
export { mouthSprites };
