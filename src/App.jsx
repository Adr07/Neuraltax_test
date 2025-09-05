import React, { useState, useEffect, useRef } from "react";
import { strings } from "./i18n";
import heroImg from "/assets/2025-08-12_195640.png";
import logo from "/assets/logo.svg";

export default function App(){
  const [lang, setLang] = useState("en");
  const t = strings[lang];

  // Modal / media state and refs
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [initialImage, setInitialImage] = useState(null);
  // set the default animation video to the local asset requested by the user
  const ASSET_VIDEO = '/assets/1756389535091.mp4';
  const [initialVideoSrc, setInitialVideoSrc] = useState(ASSET_VIDEO);
  const [responseVideoSrc, setResponseVideoSrc] = useState(null);
  const initialVideoRef = useRef(null);
  const responseVideoRef = useRef(null);
  const [message, setMessage] = useState("");
  const [loadingInitial, setLoadingInitial] = useState(false);
  const [loadingAvatar, setLoadingAvatar] = useState(false);
  const [messages, setMessages] = useState([]);

  // Play a response video with prefetch and smooth crossfade
  async function playResponseVideo(src){
    if (!src) return;

    // revoke previous response blob URL if any
    try{ if (responseVideoSrc && typeof responseVideoSrc === 'string' && responseVideoSrc.startsWith('blob:')) URL.revokeObjectURL(responseVideoSrc); }catch(e){}

    let useUrl = src;
    let createdBlobUrl = false;

    try{
      // If src is an external URL (not a blob and not the local asset), fetch it and create an object URL
      if (typeof src === 'string' && !src.startsWith('blob:') && !src.startsWith('/') ){
        try{
          const res = await fetch(src);
          if (res.ok){
            const blob = await res.blob();
            useUrl = URL.createObjectURL(blob);
            createdBlobUrl = true;
          } else {
            console.warn('playResponseVideo: failed to fetch remote video, status', res.status);
          }
        }catch(e){
          console.warn('playResponseVideo: fetch error', e);
        }
      }

      // If src is a path under our site (starts with /assets etc) we can use it directly.
      // Now wait for the response video element to be present and ready to play
      // Set the response src only when we are about to play to trigger a smooth crossfade
      setResponseVideoSrc(useUrl);

      // wait a tick for element to mount
      await new Promise(r => setTimeout(r, 50));
      const el = responseVideoRef.current;
      if (!el) {
        console.warn('playResponseVideo: response video element not found');
        if (createdBlobUrl) { try{ URL.revokeObjectURL(useUrl); }catch(e){} }
        setResponseVideoSrc(null);
        return;
      }

      // attach readiness handler
      let ready = false;
      const cleanupHandlers = () => {
        try{ el.removeEventListener('canplaythrough', onCan); }catch(e){}
        try{ el.removeEventListener('loadedmetadata', onLoaded); }catch(e){}
        try{ el.removeEventListener('error', onError); }catch(e){}
      };

      const onCan = () => { if (ready) return; ready = true; cleanupHandlers(); startPlay(); };
      const onLoaded = () => { if (ready) return; ready = true; cleanupHandlers(); startPlay(); };
      const onError = (e) => { console.warn('response video error', e); cleanupHandlers(); startPlay(); };

      function startPlay(){
        try{
          // ensure video element has the correct src
          el.pause();
          // small delay to allow browser to update rendering (improves smoothness)
          setTimeout(()=>{
            el.currentTime = 0;
            el.play().catch(()=>{});
          }, 60);
        }catch(e){ console.warn('startPlay error', e); }
      }

      el.addEventListener('canplaythrough', onCan);
      el.addEventListener('loadedmetadata', onLoaded);
      el.addEventListener('error', onError);

      // safety timeout: if neither event fires, start playing after 2s
      const safety = setTimeout(()=>{ if (!ready) { ready = true; cleanupHandlers(); startPlay(); } }, 2000);

      // when response ends, remove it and revoke blobs
      const onEnded = () => {
        try{ el.removeEventListener('ended', onEnded); }catch(e){}
        // allow the fade transition to complete before clearing
        setTimeout(()=>{
          try{ if (createdBlobUrl && useUrl && typeof useUrl === 'string' && useUrl.startsWith('blob:')) URL.revokeObjectURL(useUrl); }catch(e){}
          setResponseVideoSrc(null);
          // ensure initial resumes
          try{ if (initialVideoRef.current) initialVideoRef.current.play().catch(()=>{}); }catch(e){}
        }, 450);
      };

      el.addEventListener('ended', onEnded);

    }catch(e){
      console.error('playResponseVideo unexpected error', e);
      try{ if (createdBlobUrl && useUrl && typeof useUrl === 'string' && useUrl.startsWith('blob:')) URL.revokeObjectURL(useUrl); }catch(e){}
      setResponseVideoSrc(null);
    }
  }

  // cleanup response video on unmount to avoid dangling listeners and blobs
  useEffect(()=>{
    return ()=>{
      try{
        const el = responseVideoRef.current;
        if (el) {
          try{ el.pause(); el.src = ''; }catch(e){}
        }
        if (responseVideoSrc && typeof responseVideoSrc === 'string' && responseVideoSrc.startsWith('blob:')){
          try{ URL.revokeObjectURL(responseVideoSrc); }catch(e){}
        }
      }catch(e){}
    };
  }, []);

  // helper: safely parse response as JSON, returns null on empty/non-json and logs
  async function safeJsonParse(res){
    try{
      const text = await res.text();
      if (!text) return null;
      try { return JSON.parse(text); }
      catch(e){ console.warn('safeJsonParse: invalid JSON body', text); return null; }
    }catch(e){ console.warn('safeJsonParse: failed to read body', e); return null; }
  }

  // Cleanup created object URLs when modal closes
  useEffect(()=>{
    if (!isModalOpen) {
      [initialImage, initialVideoSrc].forEach(src=>{
        if (src && typeof src === 'string' && src.startsWith('blob:')) URL.revokeObjectURL(src);
      });
    }
  }, [isModalOpen]);

  async function fetchInitialMedia(){
    // Ensure the modal shows the local animation asset and do not attempt to override it from the webhook
    setLoadingInitial(true);
    try{
      setInitialVideoSrc(ASSET_VIDEO);
      setInitialImage(null);
      // optionally show any default agent message
      if (messages.length === 0) setMessages([]);
      // try to autoplay the asset video after a short delay
      setTimeout(()=>{
        try{
          if (initialVideoRef.current) {
            // reload src to ensure the element has the correct source
            initialVideoRef.current.src = ASSET_VIDEO;
            initialVideoRef.current.loop = true;
            initialVideoRef.current.muted = true;
            initialVideoRef.current.play().catch(()=>{});
          }
        }catch(e){ console.warn('fetchInitialMedia: failed to play asset video', e); }
      }, 100);
    }catch(e){
      console.error('fetchInitialMedia: unexpected error', e);
    }finally{
      setLoadingInitial(false);
    }
  }

  async function sendMessageToAvatar(){
    if (!message) return;
    // append user message immediately
    setMessages(prev=>[...prev, { sender: 'user', text: message }]);
    setLoadingAvatar(true);

    // do not pause the initial video to allow crossfade transition
    // try{ if (initialVideoRef.current) { initialVideoRef.current.pause(); } }catch(e){}

    try {
      const qs = '?input=' + encodeURIComponent(message || '');
      const url = '/n8n/webhook/fc90161a-f58a-44a6-b06c-a6e01acc5af6' + qs;
      const res = await fetch(url);
      if (!res) throw new Error('No response from webhook');

      const ct = res.headers.get('content-type') || '';
      let newVideoSrc = null;
      let agentOutput = null;

      if (ct.includes('application/json')){
        const text = await res.text().catch(()=>null);
        let data = null;
        if (text) {
          try { data = JSON.parse(text); } catch(e) { console.warn('sendMessageToAvatar: invalid JSON', e); }
        }
        if (data) {
          if (data.video) newVideoSrc = data.video;
          if (data.result_url) newVideoSrc = data.result_url;
          const candidate = Array.isArray(data) ? data[0] : data;
          const talkFromData = candidate && candidate.talks && candidate.talks[0] ? candidate.talks[0] : candidate;
          if (!newVideoSrc && talkFromData) {
            if (talkFromData.result_url) newVideoSrc = talkFromData.result_url;
            else if (talkFromData.driver_url) newVideoSrc = talkFromData.driver_url;
          }
          agentOutput = data.output || (Array.isArray(data) && data[0] && data[0].output) || (talkFromData && talkFromData.output) || null;
        } else if (text) {
          setMessages(prev=>[...prev, { sender: 'agent', text }]);
        }
      } else if (ct.includes('video')){
        const blob = await res.blob();
        newVideoSrc = URL.createObjectURL(blob);
      } else {
        const text = await res.text().catch(()=>null);
        if (text) setMessages(prev=>[...prev, { sender: 'agent', text }]);
      }

      if (newVideoSrc) {
        playResponseVideo(newVideoSrc);
      }

      if (agentOutput) {
        setMessages(prev=>[...prev, { sender: 'agent', text: agentOutput }]);
      }

      setMessage("");
    } catch(err){
      console.error('Failed to send message to avatar', err);
    } finally {
      setLoadingAvatar(false);
    }
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
            <button className="btn btn-secondary" onClick={()=>{ setIsModalOpen(true); fetchInitialMedia(); }}>{/* nuevo botón */}Open Avatar</button>
            <select
              className="ml-3 rounded-md bg-primary-800 border border-primary-700 px-2 py-1 text-sm"
              value={lang} onChange={e=>setLang(e.target.value)}>
              <option value="en">EN</option>
              <option value="es">ES</option>
            </select>
          </div>
        </div>
      </header>

      {/* Modal: avatar / media */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={()=>setIsModalOpen(false)}></div>
          <div className="relative bg-white rounded-lg inline-block p-4" style={{ maxWidth: 'min(90vw, calc(560px + 2rem))' }}>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-semibold">Avatar</h3>
              <div className="flex items-center gap-2">
                <button className="btn btn-ghost" onClick={()=>{ setIsModalOpen(false); }}>Close</button>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                {loadingInitial ? (
                  <div>Cargando...</div>
                ) : (
                  <>
                    <div className="relative" style={{minHeight: 192, display: 'flex', justifyContent: 'center'}}>
                      {/* Crossfade container */}
                      <div style={{position: 'relative', display: 'inline-block'}}>
                        {initialVideoSrc ? (
                          <video
                            ref={initialVideoRef}
                            src={initialVideoSrc}
                            className="block rounded object-contain max-w-[560px] max-h-[360px]"
                            playsInline
                            loop
                            muted
                            autoPlay
                            style={{transition: 'opacity 400ms ease', opacity: responseVideoSrc ? 0 : 1}}
                          />
                        ) : null}

                        {responseVideoSrc ? (
                          <video
                            ref={responseVideoRef}
                            src={responseVideoSrc}
                            className="absolute rounded object-contain max-w-[560px] max-h-[360px]"
                            playsInline
                            style={{transition: 'opacity 400ms ease', opacity: 1, left: 0, right: 0, top: 0, bottom: 0, margin: 'auto'}}
                          />
                        ) : null}

                        {!initialVideoSrc && !responseVideoSrc && initialImage ? (
                          <img src={initialImage} alt="Initial" className="w-full rounded" />
                        ) : null}

                        {!initialVideoSrc && !responseVideoSrc && !initialImage ? (
                          <div className="h-48 bg-gray-100 flex items-center justify-center">No media</div>
                        ) : null}
                      </div>
                    </div>

                    {/* audio removed */}
                  </>
                )}
              </div>

              <div>
                <div className="mb-3">
                  <label className="block text-sm mb-1">Conversation</label>
                  <div className="h-40 overflow-y-auto border rounded p-2 mb-2 bg-gray-50">
                    {messages.length===0 ? (
                      <div className="text-sm text-primary-600">No messages yet</div>
                    ) : (
                      messages.map((m, i)=> (
                        <div key={i} className={"mb-2 flex " + (m.sender==='user' ? 'justify-end' : 'justify-start')}>
                          <div className={"px-3 py-2 rounded-md text-sm " + (m.sender==='user' ? 'bg-primary-600 text-white' : 'bg-white border') }>{m.text}</div>
                        </div>
                      ))
                    )}
                  </div>

                  <label className="block text-sm mb-1">Message to avatar</label>
                  <div className="flex gap-2">
                    <input value={message} onChange={e=>setMessage(e.target.value)} placeholder="Say something" className="flex-1 border rounded-md px-3 py-2" />
                    <button className="btn btn-primary" onClick={sendMessageToAvatar} disabled={loadingAvatar}>{loadingAvatar? 'Sending...':'Send'}</button>
                  </div>
                </div>

                <div>
                  {/* Avatar media (played when avatar replies) */}
                  {/* avatar video removed - conversation only */}
                </div>

              </div>
            </div>

          </div>
        </div>
      )}

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
