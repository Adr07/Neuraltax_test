import React, { useState } from "react";
import { strings } from "./i18n";
import heroImg from "/assets/2025-08-12_195640.png";
import logo from "/assets/logo.svg";

export default function App(){
  const [lang, setLang] = useState("en");
  const t = strings[lang];

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
            <select
              className="ml-3 rounded-md bg-primary-800 border border-primary-700 px-2 py-1 text-sm"
              value={lang} onChange={e=>setLang(e.target.value)}>
              <option value="en">EN</option>
              <option value="es">ES</option>
            </select>
          </div>
        </div>
      </header>

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
            { ["Free","Silver","Gold"].map((tier, i)=>(
              <div key={i} className="card">
                <div className="badge mb-3">{i===1 ? "Most Popular" : "Plan"}</div>
                <h3 className="text-xl font-semibold mb-2">{tier}</h3>
                <p className="text-primary-600 mb-4">Feature bullets go here. Match the design as needed.</p>
                <button className={"btn w-full " + (i===1 ? "btn-primary" : "btn-ghost")}>
                  {i===1 ? (lang==="en"?"Register Now":"Regístrate ahora") : (lang==="en"?"Learn more":"Saber más")}
                </button>
              </div>
            )) }
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
