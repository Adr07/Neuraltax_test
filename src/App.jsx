import React, { useState, useEffect, useRef } from "react";
import { strings } from "./i18n";
import heroImg from "/assets/2025-08-12_195640.png";
import logo from "/assets/logo.svg";
import { initLipSync, mouthSprites } from "./lipSync";

// Avatar mouth viseme configuration:
const SPRITE_DIR = import.meta.env.BASE_URL + 'assets/Sprite/';
// Nuevo set de sprites en public/assets/Sprite
const SHAPES = {
  Neutral: 'Sprite_1_Neutral.png',
  A: 'Sprite_2_A.png',
  E: 'Sprite_3_E.png',
  I: 'Sprite_4_I.png',
  O: 'Sprite_5_O.png',
  U: 'Sprite_6_U.png',
  MBP: 'Sprite_7_MBP.png',
  FV: 'Sprite_8_FV.png',
  TDN: 'Sprite_9_TDN.png',
  SZ: 'Sprite_10_SZ.png',
  R: 'Sprite_11_R.png',
};
const MOUTH_SHAPES = [
  SHAPES.Neutral,
  SHAPES.A,
  SHAPES.E,
  SHAPES.I,
  SHAPES.O,
  SHAPES.U,
  SHAPES.MBP,
  SHAPES.FV,
  SHAPES.TDN,
  SHAPES.SZ,
  SHAPES.R,
];
// Índices derivados para evitar números mágicos
const INDEX = {
  NEUTRAL: MOUTH_SHAPES.indexOf(SHAPES.Neutral),
  A: MOUTH_SHAPES.indexOf(SHAPES.A),
  E: MOUTH_SHAPES.indexOf(SHAPES.E),
  I: MOUTH_SHAPES.indexOf(SHAPES.I),
  O: MOUTH_SHAPES.indexOf(SHAPES.O),
  U: MOUTH_SHAPES.indexOf(SHAPES.U),
  MBP: MOUTH_SHAPES.indexOf(SHAPES.MBP),
  FV: MOUTH_SHAPES.indexOf(SHAPES.FV),
  TDN: MOUTH_SHAPES.indexOf(SHAPES.TDN),
  SZ: MOUTH_SHAPES.indexOf(SHAPES.SZ),
  R: MOUTH_SHAPES.indexOf(SHAPES.R),
};

// Preload de sprites para evitar que falten al cambiar rápido
if (typeof window !== 'undefined') {
  MOUTH_SHAPES.forEach(name => {
    const img = new Image();
    img.src = SPRITE_DIR + encodeURIComponent(name);
  });
}
// Map lipSync names -> sprite filenames presentes
const NAME_TO_FILE = {
  closed: SHAPES.Neutral,
  small: SHAPES.E,     // boca pequeña
  medium: SHAPES.A,    // más abierta
  wide: SHAPES.O,      // redondeada O
};
const MOUTH_DISPLAY_WIDTH = 320;
const MOUTH_DISPLAY_HEIGHT = 320;

export default function App(){
  const [lang, setLang] = useState("en");
  const t = strings[lang];

  // Avatar modal and speech state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [avatarText, setAvatarText] = useState('Hola, ¿en qué puedo ayudarte?');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [mouthIndex, setMouthIndex] = useState(INDEX.NEUTRAL);
  const [mouthFade, setMouthFade] = useState(1); // 1 = visible, 0 = invisible
  const [mouthName, setMouthName] = useState("closed");
  const [debug, setDebug] = useState(false);
  const animRef = useRef(null);
  const utterRef = useRef(null);
  const audioRef = useRef(null);
  const fadeDuration = 120; // ms para el crossfade
  const lastChangeRef = useRef(0); // para limitar FPS del cambio de boca
  const driverRef = useRef(null);  // intervalo que recorre el texto si no hay buenos boundary
  const driverPosRef = useRef(0);
  const driverHoldRef = useRef(0); // retención de visema por ticks para suavizar

  // Mapeo aproximado de grafemas/dígrafos -> índice de sprite
  function getVisemeIndexFromText(text, i){
    if (!text || i == null) return INDEX.NEUTRAL;
    // Normalizar tildes para español (á→a, é→e, etc.)
    const tail = text.slice(i);
    const rest = tail.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const digraph = rest.startsWith('th') ? 'th'
      : rest.startsWith('ch') ? 'ch'
      : rest.startsWith('sh') ? 'sh'
      : rest.startsWith('ng') ? 'ng'
      : rest.startsWith('ee') ? 'ee'
      : rest.startsWith('oo') ? 'oo'
      : rest.startsWith('ai') ? 'ai'
      : rest.startsWith('ou') ? 'ou'
      : rest.startsWith('er') ? 'er'
      : rest.startsWith('ar') ? 'ar'
      : null;
    const ch = rest[0] || '';

    const map = {
      // Cierres
      'm': INDEX.MBP, 'b': INDEX.MBP, 'p': INDEX.MBP,
      // Dientes labio
      'f': INDEX.FV, 'v': INDEX.FV,
      // Silbantes / sibilantes
      's': INDEX.SZ, 'z': INDEX.SZ, 'x': INDEX.SZ, 'sh': INDEX.SZ, 'ch': INDEX.SZ, 'j': INDEX.SZ,
      // Alveolares / dentales
      't': INDEX.TDN, 'd': INDEX.TDN, 'l': INDEX.TDN, 'n': INDEX.TDN, 'th': INDEX.TDN,
      // Guturales aproximadas → TDN como aproximación
      'k': INDEX.TDN, 'g': INDEX.TDN, 'h': INDEX.TDN, 'ng': INDEX.TDN,
      'c': INDEX.TDN, 'q': INDEX.TDN,
      // Vocales
      'a': INDEX.A, 'ai': INDEX.A,
      'e': INDEX.E, 'ee': INDEX.E,
      'i': INDEX.I, 'y': INDEX.I,
      'o': INDEX.O, 'ou': INDEX.O,
      'u': INDEX.U, 'w': INDEX.U, 'oo': INDEX.U,
      // Erres vocalizadas
      'er': INDEX.R, 'ar': INDEX.R,
      // R
      'r': INDEX.R,
      // Por defecto
      'default': INDEX.NEUTRAL
    };

    const key = digraph || ch;
    const idx = map[key] ?? map['default'];
    return typeof idx === 'number' ? idx : INDEX.NEUTRAL;
  }

  // Cambia la boca según el nombre
  function setMouthByName(name) {
    const file = NAME_TO_FILE[name] || NAME_TO_FILE.closed;
    const idx = MOUTH_SHAPES.indexOf(file);
    setMouthIndex(idx >= 0 ? idx : INDEX.NEUTRAL);
    setMouthName(name);
  }

  // Animate mouth during speech (random for demo, real would use Web Speech API events)
  function startMouthAnimation(){
    if (animRef.current) return;
    const interval = 1000 / 12; // 12 FPS for mouth
    animRef.current = setInterval(()=>{
      setMouthIndex(prev => (typeof prev === 'number' ? (prev + 1) % MOUTH_SHAPES.length : INDEX.NEUTRAL));
    }, interval);
  }
  function stopMouthAnimation(){
    if (animRef.current) { clearInterval(animRef.current); animRef.current = null; }
    setMouthIndex(INDEX.NEUTRAL);
  }

  // Iniciar lip sync cuando el audio se reproduce (desactivado para evitar conflicto con TTS)
  // useEffect(() => {
  //   if (audioRef.current) {
  //     initLipSync({
  //       audioElement: audioRef.current,
  //       setMouthByName,
  //       useMic: false,
  //     });
  //   }
  // }, []);

  // Detecta pausas largas y cierra la boca
  function speakText(text){
    if (!text) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)){
      alert('Speech Synthesis API not supported in this browser.');
      return;
    }
    try{ window.speechSynthesis.cancel(); }catch(e){}
    if (utterRef.current){ utterRef.current = null; }
    if (driverRef.current){ clearInterval(driverRef.current); driverRef.current = null; }
    driverPosRef.current = 0;
    let lastCharTime = Date.now();
    let pauseTimeout = null;
    const PAUSE_MS = 260; // cerrar boca si hay pausa > 260ms (más natural)
    const MIN_CHANGE_MS = 30; // permitir cambios casi inmediatos desde boundary
    const TICK_MS = 95; // fallback un poco más rápido

    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = lang === 'es' ? 'es-ES' : 'en-US';
    utter.rate = 1.0; // velocidad por defecto para alinear visemas con audio

    utter.onstart = ()=>{
      setIsSpeaking(true);
      setMouthIndex(0);
      driverRef.current = setInterval(()=>{
        // Retener visema actual para suavizar
        if (driverHoldRef.current > 0) {
          driverHoldRef.current -= 1;
          return;
        }
        const i = driverPosRef.current;
        if (i >= text.length) return;
        const rest = text.slice(i);
        const ch = rest[0] || '';
        // si espacio/puntuación → cerrar y avanzar
        if (/^[\s.,;:!?¡¿\-]/.test(ch)) {
          setMouthIndex(0);
          driverPosRef.current = i + 1;
          return;
        }
        const idx = getVisemeIndexFromText(text, i);
        setMouthIndex(idx);
        // vocales retienen 1 tick extra, consonantes 0
        const isVowel = /^(a|e|i|o|u|y|ai|ee|oo|ou|er|ar)/i.test(rest);
        driverHoldRef.current = isVowel ? 1 : 0;
        // avanzar 2 si dígrafo, sino 1
        const isDigraph = /^(th|ch|sh|ng|ee|oo|ai|ou|er|ar)/i.test(rest);
        driverPosRef.current = i + (isDigraph ? 2 : 1);
        lastCharTime = Date.now();
      }, TICK_MS);

      // Cierre en pausas
      pauseTimeout = setInterval(()=>{
        if (Date.now() - lastCharTime > PAUSE_MS) setMouthIndex(0);
      }, 60);
    };
    utter.onend = ()=>{
      setIsSpeaking(false);
      setMouthIndex(0);
      if (pauseTimeout) clearInterval(pauseTimeout);
      if (driverRef.current){ clearInterval(driverRef.current); driverRef.current = null; }
      driverHoldRef.current = 0;
      utterRef.current = null;
    };
    utter.onerror = ()=>{
      setIsSpeaking(false);
      setMouthIndex(0);
      if (pauseTimeout) clearInterval(pauseTimeout);
      if (driverRef.current){ clearInterval(driverRef.current); driverRef.current = null; }
      driverHoldRef.current = 0;
      utterRef.current = null;
    };
    utter.onboundary = (event) => {
      const now = Date.now();
      if (now - lastChangeRef.current < MIN_CHANGE_MS) return; // limita sincronización excesiva

      const charIdx = typeof event.charIndex === 'number' ? event.charIndex : 0;
      // Saltar espacios y puntuación (incluye signos invertidos ¿ ¡) para no quedarnos cerrados
      let j = charIdx;
      while (j < text.length && /[\s.,;:!?¡¿\-]/.test(text[j])) j++;

      const idx = getVisemeIndexFromText(text, j);
      const isPunctHere = /[\s.,;:!?¡¿\-]/.test((text[charIdx] || ''));

      if (!isPunctHere) {
        setMouthIndex(idx);
      } else {
        // Cierra brevemente en la puntuación, pero adelanta el driver al siguiente grafema
        setMouthIndex(INDEX.NEUTRAL);
        driverPosRef.current = Math.max(driverPosRef.current, j);
      }

      // Anula retención y sincroniza el driver solo hacia adelante
      driverHoldRef.current = 0;
      if (j > driverPosRef.current) {
        driverPosRef.current = j;
      }
      lastCharTime = now;
      lastChangeRef.current = now;
    };
    utterRef.current = utter;
    window.speechSynthesis.cancel();
    setTimeout(() => {
      window.speechSynthesis.speak(utter);
    }, 50);
  }

  function handleOpenAvatar(){
    setIsModalOpen(true);
  }
  function handleCloseAvatar(){
    setIsModalOpen(false);
    try{ window.speechSynthesis.cancel(); }catch(e){}
    stopMouthAnimation();
  }

  return (
    <div className="font-sans">
      {/* Top bar */}
      <header className="bg-primary-900 text-white">

        {/* Hero */}
        <section className="relative">
          <img src={heroImg} alt="Hero mockup" className="w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-primary-900/20 to-primary-900/5 pointer-events-none"></div>
        </section>

        <div className="container-nx flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Neuraltax" className="h-8" />
            <span className="hidden sm:inline text-sm opacity-80">AI Expert</span>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn btn-ghost">{t.register}</button>
            <button className="btn btn-ghost">{t.login}</button>
            <button className="btn btn-primary">{t.ctaFree}</button>
            <button className="btn btn-secondary" onClick={handleOpenAvatar}>Open Avatar</button>
            <select
              className="ml-3 rounded-md bg-primary-800 border border-primary-700 px-2 py-1 text-sm"
              value={lang} onChange={e=>setLang(e.target.value)}>
              <option value="en">EN</option>
              <option value="es">ES</option>
            </select>
          </div>
        </div>
      </header>

      {/* Avatar modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={handleCloseAvatar}></div>
          <div className="relative bg-white rounded-lg p-4 w-full max-w-lg">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-semibold">Avatar</h3>
              <div className="flex items-center gap-2">
                <label className="text-sm flex items-center gap-1"><input type="checkbox" checked={debug} onChange={e=>setDebug(e.target.checked)} /> Debug</label>
                <button className="btn btn-ghost" onClick={handleCloseAvatar}>Close</button>
              </div>
            </div>
            <div className="flex flex-col items-center gap-4">
              <div style={{width: '100%', maxWidth: 400, aspectRatio: '1/1', position: 'relative', margin: '0 auto'}} className="rounded overflow-hidden bg-gray-100 flex items-center justify-center">
                {/* Overlay mouth PNG (lip sync) */}
                <img
                  src={SPRITE_DIR + encodeURIComponent(MOUTH_SHAPES[mouthIndex])}
                  alt={MOUTH_SHAPES[mouthIndex]}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    zIndex: 2,
                    pointerEvents: 'auto',
                    display: 'block',
                    margin: 0,
                    transition: 'opacity 0.12s linear'
                  }}
                  onError={e => { e.target.style.background = '#ff0'; e.target.src = SPRITE_DIR + encodeURIComponent(SHAPES.Neutral); console.error('No se encontró la imagen:', e.target.src); }}
                />
                {debug && (
                  <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                    {mouthIndex} · {MOUTH_SHAPES[mouthIndex]}
                  </div>
                )}
              </div>
              {/* Audio element para lip sync desactivado */}
              {/* <audio ref={audioRef} src="/assets/voice.mp3" autoPlay hidden /> */}
              <div className="w-full">
                <label className="block text-sm mb-1">Text for avatar</label>
                <textarea value={avatarText} onChange={e=>setAvatarText(e.target.value)} rows={3} className="w-full border rounded-md px-3 py-2 mb-2" />
                <div className="flex gap-2 justify-end">
                  <button className="btn btn-ghost" onClick={()=>{ try{ window.speechSynthesis.cancel(); }catch(e){}; setIsSpeaking(false); stopMouthAnimation(); }}>Stop</button>
                  <button className="btn btn-secondary" onClick={()=>{ startMouthAnimation(); }}>Test Sprites</button>
                  <button className="btn btn-primary" onClick={()=>speakText(avatarText)}>{isSpeaking? 'Speaking...' : 'Speak'}</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}

      {/* Why / Smart */}
      <section className="container-nx py-12 grid md:grid-cols-2 gap-10">
        <div>
          <h2 className="text-2xl font-semibold mb-3">{t.whyTitle}</h2>
          <p className="text-primary-600 leading-relaxed">
            Neuraltax is your automated tax expert. Designed to simplify tax management, our
            intelligent system analyzes, calculates, and optimizes your returns.
          </p>
        </div>
        <div>
          <h2 className="text-2xl font-semibold mb-3">{t.smartTitle}</h2>
          <ul className="space-y-2 text-primary-600 leading-relaxed list-disc pl-5">
            <li>Fast processes, no human errors.</li>
            <li>Save time and money with AI-powered workflows.</li>
            <li>Guaranteed compliance and up-to-date IRS rules.</li>
          </ul>
        </div>
      </section>

      {/* Plans */}
      <section className="py-12 bg-surface">
        <div className="container-nx">
          <h2 className="text-2xl font-semibold mb-6">{t.plansTitle}</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {["Free","Silver","Gold"].map((tier, i)=>(
              <div key={i} className="card">
                <div className="badge mb-3">{i===1 ? "Most Popular" : "Plan"}</div>
                <h3 className="text-xl font-semibold mb-2">{tier}</h3>
                <p className="text-primary-600 mb-4">Feature bullets go here. Match the design as needed.</p>
                <button className={"btn w-full " + (i===1 ? "btn-primary" : "btn-ghost")}>
                  {i===1 ? (lang==="en"?"Register Now":"Regístrate ahora") : (lang==="en"?"Learn more":"Saber más")}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features icons row (placeholders) */}
      <section className="container-nx py-12">
        <h2 className="text-2xl font-semibold mb-6">{t.featuresTitle}</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {[1,2,3].map(i=>(
            <div key={i} className="card">
              <div className="h-10 w-10 rounded-lg bg-surface-300 mb-3"></div>
              <h3 className="font-semibold mb-1">Feature {i}</h3>
              <p className="text-primary-600 text-sm">Short description matching the visual layout.</p>
            </div>
          ))}
        </div>
      </section>

      {/* Contact */}
      <section className="py-12 bg-surface">
        <div className="container-nx grid md:grid-cols-2 gap-6">
          <div className="card">
            <h3 className="text-xl font-semibold mb-4">{t.contactTitle}</h3>
            <ul className="space-y-2 text-primary-600">
              <li>Email: neuraltaxai@gmail.com</li>
              <li>Business Hours: Mon–Fri 8:00–18:00</li>
            </ul>
          </div>
          <form className="card">
            <div className="grid grid-cols-2 gap-3">
              <input placeholder={lang==="en"?"Full name":"Nombre completo"} className="border rounded-md px-3 py-2" />
              <input placeholder={lang==="en"?"Email address":"Correo electrónico"} className="border rounded-md px-3 py-2" />
            </div>
            <input placeholder={lang==="en"?"Subject":"Asunto"} className="border rounded-md px-3 py-2 mt-3" />
            <textarea placeholder={lang==="en"?"Tell us how we can help...":"Cuéntanos cómo podemos ayudarte..."} rows="4" className="border rounded-md px-3 py-2 mt-3"></textarea>
            <button className="btn btn-primary mt-4">{lang==="en"?"Send Message":"Enviar mensaje"}</button>
          </form>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-primary-900 text-white">
        <div className="container-nx py-10 grid md:grid-cols-3 gap-6">
          <div className="space-y-3">
            <img src={logo} alt="Neuraltax" className="h-8" />
            <p className="text-sm opacity-80">© 2025 Neuraltax. All rights reserved.</p>
          </div>
          <div className="text-sm opacity-90">
            <p>Privacy Policy · Terms</p>
          </div>
          <div className="text-sm opacity-90">
            <p>Contact: neuraltaxai@gmail.com</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
