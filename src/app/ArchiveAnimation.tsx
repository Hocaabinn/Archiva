"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Animasi latar bertema arsip dokumen.
 * Intro (sekali): folder muncul -> kursor klik -> file keluar.
 * Lalu LOOPS kali: dokumen masuk dari antrean -> dipindai -> distempel
 * "TERVERIFIKASI" -> masuk ke kotak arsip -> penghitung bertambah.
 * Outro: jendela "Cari Arsip" — cari, unduh file aktif, hapus file inaktif,
 *   aktifkan file inaktif, simpan, lalu ulang dari intro.
 *
 * Pakai di dalam panel yang punya `position: relative` (mis. class `relative`).
 */

const CYCLE = 5.5; // detik per siklus loop
const INTRO = 4.5; // durasi intro (folder + kursor) sebelum loop dimulai
const LOOPS = 3; // jumlah file yang dimasukkan ke kotak arsip sebelum outro
const OUTRO = 13; // durasi outro (cari, unduh, hapus, aktifkan, simpan)
const START_COUNT = 1284;

// Slogan arsip — urutan = jalur fokus zigzag (kiri atas -> kanan bawah)
const SLOGANS = [
  { text: "Arsip Tertib, Instansi Hebat", top: "27%", side: "left", x: "3%" },
  { text: "Cari Dokumen dalam Hitungan Detik", top: "35%", side: "right", x: "3%" },
  { text: "Dari Kertas Menuju Digital", top: "48%", side: "left", x: "3%" },
  { text: "Aman, Terverifikasi, Terlacak", top: "56%", side: "right", x: "3%" },
  { text: "Arsip Rapi, Kerja Pasti", top: "67%", side: "left", x: "3%" },
  { text: "Jejak Dokumen Tak Pernah Hilang", top: "74%", side: "right", x: "3%" },
] as const;
const FOCUS_MS = 2600; // lama fokus di tiap slogan

const ITEMS = ["folder", "pdf", "folder", "doc", "folder", "xls", "xls", "folder", "pdf"] as const;
const TYPE_COLOR = { pdf: "#ef4444", doc: "#3b82f6", xls: "#22c55e" } as const;

function FolderIcon({ size = 28 }: { size?: number }) {
  return (
    <svg viewBox="0 0 44 36" width={size} height={size * 0.82}>
      <path d="M2 6a4 4 0 0 1 4-4h11l4 4h17a4 4 0 0 1 4 4v4H2z" fill="#3b82f6" />
      <rect x="5" y="8" width="34" height="8" rx="2" fill="#f1f6fd" />
      <rect x="2" y="11" width="40" height="23" rx="4" fill="url(#aa-folder-grad)" />
    </svg>
  );
}

function FileIcon({ type, size = 28 }: { type: "pdf" | "doc" | "xls"; size?: number }) {
  return (
    <svg viewBox="0 0 30 36" width={size * 0.72} height={size * 0.86}>
      <path d="M3 3a2 2 0 0 1 2-2h14l8 8v24a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="#e8f1fc" />
      <path d="M19 1v6a2 2 0 0 0 2 2h6" fill="#b8d3f2" />
      <rect x="3" y="22" width="18" height="8" rx="1.5" fill={TYPE_COLOR[type]} />
      <rect x="7" y="13" width="14" height="2" rx="1" fill="#b8d3f2" />
    </svg>
  );
}

function DocItems({ highlight = false }: { highlight?: boolean }) {
  return (
    <div className={highlight ? "aa-items aa-items--hl" : "aa-items"}>
      {ITEMS.map((it, i) => (
        <div key={i} className="aa-item">
          {it === "folder" ? <FolderIcon /> : <FileIcon type={it} />}
          <span />
        </div>
      ))}
    </div>
  );
}

export default function ArchiveAnimation({ theme = "auto" }: { theme?: "auto" | "dark" | "light" }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState(START_COUNT);
  const [focus, setFocus] = useState(0);
  const [detected, setDetected] = useState<"dark" | "light">("dark");

  // Deteksi otomatis: terang/gelap dari warna latar panel induk
  useEffect(() => {
    if (theme !== "auto") return;
    const el = rootRef.current;
    if (!el) return;
    const lum = (c: string) => {
      const m = c.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
      if (a < 0.1) return null;
      return 0.299 * r + 0.587 * g + 0.114 * b;
    };
    const detect = () => {
      let n = el.parentElement;
      while (n) {
        const cs = getComputedStyle(n);
        const l = lum(cs.backgroundColor) ?? (cs.backgroundImage !== "none" ? lum(cs.backgroundImage) : null);
        if (l !== null) return setDetected(l > 140 ? "light" : "dark");
        n = n.parentElement;
      }
      setDetected(matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    };
    detect();
    const mo = new MutationObserver(detect);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style", "data-theme"] });
    const mq = matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", detect);
    return () => {
      mo.disconnect();
      mq.removeEventListener("change", detect);
    };
  }, [theme]);
  const mode = theme === "auto" ? detected : theme;

  // Fokus berpindah zigzag antar slogan
  useEffect(() => {
    const id = setInterval(() => setFocus((f) => (f + 1) % SLOGANS.length), FOCUS_MS);
    return () => clearInterval(id);
  }, []);

  // Skala panggung mengikuti ukuran panel responsif
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      const s = Math.min(width / 480, height / 580);
      el.style.setProperty("--aa-scale", String(Math.max(0.48, Math.min(s, 1.4))));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Timeline: intro -> LOOPS x arsip -> outro -> ulang
  const [run, setRun] = useState(0);
  const [outro, setOutro] = useState(false);
  useEffect(() => {
    setOutro(false);
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 0; i < LOOPS; i++) {
      timers.push(setTimeout(() => setCount((c) => c + 1), (INTRO + CYCLE * (i + 0.82)) * 1000));
    }
    timers.push(setTimeout(() => setOutro(true), (INTRO + CYCLE * LOOPS) * 1000));
    timers.push(setTimeout(() => setRun((r) => r + 1), (INTRO + CYCLE * LOOPS + OUTRO) * 1000));
    return () => timers.forEach(clearTimeout);
  }, [run]);

  const docNo = String((count + 1) % 1000).padStart(3, "0");

  return (
    <div ref={rootRef} className={mode === "light" ? "aa-root aa-root--light" : "aa-root"} aria-hidden="true">
      <style>{CSS}</style>

      <svg width="0" height="0" style={{ position: "absolute" }}>
        <defs>
          <linearGradient id="aa-folder-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#62b6f7" />
            <stop offset="1" stopColor="#3a74e6" />
          </linearGradient>
        </defs>
      </svg>

      <div className="aa-grid" />
      <div className="aa-glow" />

      {/* Slogan arsip dengan efek fokus zigzag */}
      {SLOGANS.map((sl, i) => (
        <div
          key={sl.text}
          className={i === focus ? "aa-slogan is-focus" : "aa-slogan"}
          style={{ top: sl.top, [sl.side]: sl.x, textAlign: sl.side }}
        >
          <span className="aa-slogan-no">{String(i + 1).padStart(2, "0")}</span>
          {sl.text}
          <i className="aa-corner aa-c1" /><i className="aa-corner aa-c2" />
          <i className="aa-corner aa-c3" /><i className="aa-corner aa-c4" />
        </div>
      ))}

      <div key={run} className={outro ? "aa-stage aa-stage--outro" : "aa-stage"}>
        {/* ===== INTRO: folder muncul, kursor klik, file keluar ===== */}
        <div className="aa-intro">
          <svg className="aa-intro-back" viewBox="0 0 44 36" width="120" height="98">
            <path d="M2 6a4 4 0 0 1 4-4h11l4 4h17a4 4 0 0 1 4 4v24H2z" fill="#3b82f6" />
            <rect x="5" y="8" width="34" height="8" rx="2" fill="#f1f6fd" />
          </svg>
          <div className="aa-intro-file">
            <span className="aa-intro-file-band" />
          </div>
          <svg className="aa-intro-front" viewBox="0 0 44 36" width="120" height="98">
            <rect x="2" y="11" width="40" height="23" rx="4" fill="url(#aa-folder-grad)" />
          </svg>
          <span className="aa-ripple" />
        </div>
        <svg className="aa-cursor" viewBox="0 0 24 24" width="26" height="26">
          <path
            d="M4 2l15 11-6.5 1.2L16 21l-3 1.4-3.4-6.8L4 20z"
            fill="#fff"
            stroke="#0b1b33"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        </svg>

        {/* Antrean dokumen di belakang */}
        <div className="aa-sheet aa-sheet--2" />
        <div className="aa-sheet aa-sheet--1" />

        {/* Bagian belakang kotak arsip */}
        <div className="aa-box-back" />

        {/* Dokumen aktif */}
        <div className="aa-doc">
          <div className="aa-doc-head">
            <FolderIcon size={14} />
            <span className="aa-doc-title">File</span>
            <span className="aa-doc-no">No. {docNo}</span>
          </div>
          <div className="aa-doc-body">
            <DocItems />
            <DocItems highlight />
          </div>
          <div className="aa-doc-foot">
            <svg viewBox="0 0 60 16" width="44" height="12" fill="none">
              <path
                d="M2 12c4-8 7-9 8-5s-2 6 1 4 5-9 8-6-1 6 3 4 6-6 9-4 4 3 8 1 6-3 9-2"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            </svg>
            <span className="aa-qr" />
          </div>
          <div className="aa-scan" />
          <div className="aa-stamp">
            <svg viewBox="0 0 16 16" width="9" height="9" fill="none">
              <path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            TERVERIFIKASI
          </div>
        </div>

        {/* Bagian depan kotak arsip */}
        <div className="aa-box-front">
          <span className="aa-box-slot" />
          <span className="aa-box-label">ARSIP · 2026</span>
        </div>
        <div className="aa-plus">+1</div>

        {/* ===== OUTRO: cari, unduh (aktif), hapus / aktifkan (inaktif), simpan ===== */}
        {outro && (
          <div className="aa-outro">
            <div className="aa-win">
              <div className="aa-win-head">
                <i /><i /><i />
                <span>Cari Arsip</span>
              </div>
              <div className="aa-search">
                <svg viewBox="0 0 16 16" width="11" height="11" fill="none">
                  <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.6" />
                  <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
                <span className="aa-typed">File Penting</span>
                <span className="aa-caret" />
              </div>
              <div className="aa-rows">
                {/* File AKTIF -> bisa diunduh */}
                <div className="aa-row aa-row--1">
                  <FileIcon type="pdf" size={20} />
                  <span className="aa-row-name">File Penting No. 4</span>
                  <span className="aa-badge aa-badge--on">AKTIF</span>
                  <span className="aa-act aa-dl">
                    <svg viewBox="0 0 16 16" width="11" height="11" fill="none">
                      <path d="M8 2v8M4.5 6.8L8 10.3l3.5-3.5M3 13.5h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <span className="aa-progress" />
                </div>
                {/* File INAKTIF -> bisa dihapus */}
                <div className="aa-row aa-row--2">
                  <FileIcon type="doc" size={20} />
                  <span className="aa-row-name">File Penting No. 1</span>
                  <span className="aa-badge aa-badge--off">INAKTIF</span>
                  <span className="aa-act aa-trash">
                    <svg viewBox="0 0 16 16" width="11" height="11" fill="none">
                      <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.7 9h5.6l.7-9" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                    </svg>
                  </span>
                </div>
                {/* File INAKTIF -> diaktifkan */}
                <div className="aa-row aa-row--3">
                  <FolderIcon size={20} />
                  <span className="aa-row-name">File Penting No. 3</span>
                  <span className="aa-badge-swap">
                    <span className="aa-badge aa-badge--off aa-swap-off">INAKTIF</span>
                    <span className="aa-badge aa-badge--on aa-swap-on">AKTIF</span>
                  </span>
                  <span className="aa-act aa-toggle"><i /></span>
                </div>
              </div>
              <div className="aa-win-foot">
                <span className="aa-save">Simpan</span>
              </div>
            </div>
            <div className="aa-toast aa-toast--dl">↓ File aktif diunduh</div>
            <div className="aa-toast aa-toast--del">File inaktif dihapus</div>
            <div className="aa-toast aa-toast--on">● File diaktifkan</div>
            <div className="aa-toast aa-toast--save">✓ Perubahan tersimpan</div>
            <svg className="aa-cursor2" viewBox="0 0 24 24" width="24" height="24">
              <path d="M4 2l15 11-6.5 1.2L16 21l-3 1.4-3.4-6.8L4 20z" fill="#fff" stroke="#0b1b33" strokeWidth="1.4" strokeLinejoin="round" />
            </svg>
          </div>
        )}

        <div className="aa-counter">
          <span className="aa-dot" />
          {count.toLocaleString("id-ID")} dokumen terarsip
        </div>
      </div>
    </div>
  );
}

const CSS = `
.aa-root{
  --aa-cycle:${CYCLE}s;
  --aa-intro:${INTRO}s;
  --aa-loops:${LOOPS};
  --aa-outro:${OUTRO}s;
  --aa-scale:1;
  --aa-blue:#5eb3f6;
  --aa-blue-soft:rgba(94,179,246,.18);
  --aa-line:rgba(148,190,240,.22);
  --aa-slogan:rgba(190,215,245,.9);
  --aa-slogan-active:#ffffff;
  --aa-grid:rgba(120,170,230,.06);
  --aa-glow:rgba(70,150,240,.18);
  --aa-muted:rgba(170,205,245,.75);
  position:absolute; inset:0; overflow:hidden; pointer-events:none;
  font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
}
.aa-grid{
  position:absolute; inset:0;
  background-image:
    linear-gradient(var(--aa-grid) 1px,transparent 1px),
    linear-gradient(90deg,var(--aa-grid) 1px,transparent 1px);
  background-size:36px 36px;
  -webkit-mask-image:radial-gradient(ellipse 60% 50% at 50% 58%,#000 20%,transparent 75%);
          mask-image:radial-gradient(ellipse 60% 50% at 50% 58%,#000 20%,transparent 75%);
  animation:aa-grid 18s linear infinite;
}
@keyframes aa-grid{to{background-position:0 36px,0 0}}
.aa-glow{
  position:absolute; left:50%; top:62%; width:420px; height:420px;
  transform:translate(-50%,-50%) scale(var(--aa-scale));
  background:radial-gradient(circle,var(--aa-glow),transparent 65%);
  filter:blur(10px);
}

/* Slogan + efek fokus */
.aa-slogan{
  position:absolute; z-index:1; max-width:calc(104px * var(--aa-scale));
  font-family:var(--aa-slogan-font,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif); font-size:calc(12px * var(--aa-scale)); font-weight:600; line-height:1.3;
  color:var(--aa-slogan); padding:8px 10px;
  opacity:.4; filter:blur(1.4px); transform:scale(.95);
  transition:opacity .9s ease, filter .9s ease, transform .9s cubic-bezier(.4,0,.2,1), color .9s ease;
}
.aa-slogan-no{
  display:block; margin-bottom:3px;
  font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:.7em; font-weight:500; letter-spacing:.15em;
  color:var(--aa-blue); opacity:.7;
}
.aa-root--light .aa-slogan{opacity:.5}
.aa-root--light .aa-slogan.is-focus{opacity:1}
.aa-slogan.is-focus{z-index:8; opacity:1; filter:none; transform:scale(1.05); color:var(--aa-slogan-active)}
.aa-corner{
  position:absolute; width:9px; height:9px; border:0 solid var(--aa-blue);
  opacity:0; transition:opacity .6s ease, transform .9s cubic-bezier(.4,0,.2,1);
}
.aa-c1{top:0; left:0; border-top-width:2px; border-left-width:2px; transform:translate(-8px,-8px)}
.aa-c2{top:0; right:0; border-top-width:2px; border-right-width:2px; transform:translate(8px,-8px)}
.aa-c3{bottom:0; left:0; border-bottom-width:2px; border-left-width:2px; transform:translate(-8px,8px)}
.aa-c4{bottom:0; right:0; border-bottom-width:2px; border-right-width:2px; transform:translate(8px,8px)}
.is-focus .aa-corner{opacity:1; transform:none; animation:aa-focus-pulse 1.3s ease-in-out .9s infinite alternate}
@keyframes aa-focus-pulse{to{opacity:.45}}

/* Tema terang */
.aa-root--light{
  --aa-slogan:#334155;
  --aa-slogan-active:#0f2a4d;
  --aa-grid:rgba(30,64,120,.07);
  --aa-glow:rgba(80,140,240,.16);
  --aa-muted:#475569;
}

/* Panggung */
.aa-stage{
  position:absolute; left:50%; top:56%;
  width:300px; height:380px;
  transform:translate(-50%,-50%) scale(var(--aa-scale));
}

.aa-sheet,.aa-doc{
  position:absolute; left:75px; top:0; width:150px; height:196px;
  border-radius:8px;
}
.aa-sheet{
  animation:aa-fadein 1s ease calc(var(--aa-intro) * .78) backwards;
  background:rgba(40,80,130,.18);
  border:1px solid rgba(120,175,240,.16);
}
.aa-sheet--1{transform:translate(10px,-10px) rotate(4deg); opacity:.8}
.aa-sheet--2{transform:translate(20px,-20px) rotate(8deg); opacity:.5}

.aa-doc{
  z-index:2; overflow:hidden;
  background:linear-gradient(160deg,rgba(28,58,100,.95),rgba(14,32,62,.95));
  border:1px solid rgba(130,185,245,.38);
  box-shadow:0 18px 40px -12px rgba(0,0,0,.6),0 0 0 1px rgba(255,255,255,.02) inset;
  padding:14px 14px 12px;
  display:flex; flex-direction:column;
  animation:aa-doc var(--aa-cycle) cubic-bezier(.55,.05,.35,1) var(--aa-intro) var(--aa-loops) both;
}
@keyframes aa-doc{
  0%  {transform:translate(0,-6px) scale(.98); opacity:0}
  9%  {transform:translate(0,0) rotate(0); opacity:1}
  62% {transform:translate(0,0) rotate(0) scale(1); opacity:1}
  70% {transform:translate(0,-12px) rotate(0) scale(.96); opacity:1}
  80% {transform:translate(0,178px) scale(.62); opacity:1}
  86% {transform:translate(0,196px) scale(.6); opacity:0}
  100%{transform:translate(0,196px) scale(.6); opacity:0}
}

.aa-doc-head{display:flex; align-items:center; gap:6px; padding-bottom:9px; border-bottom:1px solid var(--aa-line)}
.aa-doc-title{font-size:10px; letter-spacing:.08em; color:#cfe3fb; font-weight:600}
.aa-doc-no{margin-left:auto; font-size:7px; color:rgba(170,205,245,.7)}

.aa-doc-body{position:relative; margin-top:10px; flex:1}
.aa-items{display:grid; grid-template-columns:repeat(3,1fr); gap:6px 4px; justify-items:center}
.aa-item{display:flex; flex-direction:column; align-items:center; gap:3px; height:34px; justify-content:flex-end}
.aa-item span{width:22px; height:3px; border-radius:2px; background:var(--aa-line)}
.aa-items:not(.aa-items--hl) .aa-item svg{filter:grayscale(1) brightness(.55); opacity:.45}
.aa-items--hl{
  position:absolute; inset:0;
  clip-path:inset(0 0 100% 0);
  animation:aa-reveal var(--aa-cycle) linear var(--aa-intro) var(--aa-loops) both;
}
.aa-items--hl .aa-item svg{filter:drop-shadow(0 0 5px rgba(94,179,246,.55))}
.aa-items--hl .aa-item span{background:var(--aa-blue)}
@keyframes aa-reveal{
  0%,12%{clip-path:inset(0 0 100% 0)}
  44%,100%{clip-path:inset(0 0 0 0)}
}

.aa-doc-foot{display:flex; align-items:flex-end; justify-content:space-between; color:rgba(170,205,245,.6)}
.aa-qr{
  width:18px; height:18px; border-radius:2px; opacity:.55;
  background:
    conic-gradient(from 90deg at 3px 3px,transparent 25%,#9cc8f5 0) 0 0/6px 6px;
}

/* Garis pemindai */
.aa-scan{
  position:absolute; left:0; right:0; top:0; height:34px;
  background:linear-gradient(180deg,transparent,rgba(94,179,246,.22) 70%,rgba(160,215,255,.95) 96%,transparent);
  opacity:0;
  animation:aa-scan var(--aa-cycle) linear var(--aa-intro) var(--aa-loops) both;
}
@keyframes aa-scan{
  0%,10%{transform:translateY(-34px); opacity:0}
  13%{opacity:1}
  44%{transform:translateY(196px); opacity:1}
  46%,100%{transform:translateY(196px); opacity:0}
}

/* Stempel */
.aa-stamp{
  position:absolute; right:10px; bottom:30px;
  display:flex; align-items:center; gap:4px;
  padding:4px 7px; border-radius:4px;
  font-size:8px; font-weight:700; letter-spacing:.1em;
  color:#7cc4ff; border:1.5px solid #7cc4ff;
  background:rgba(10,30,60,.75);
  box-shadow:0 0 14px rgba(94,179,246,.35);
  opacity:0;
  animation:aa-stamp var(--aa-cycle) cubic-bezier(.2,1.6,.4,1) var(--aa-intro) var(--aa-loops) both;
}
@keyframes aa-stamp{
  0%,46%{transform:rotate(-12deg) scale(1.9); opacity:0}
  52%{transform:rotate(-12deg) scale(1); opacity:1}
  100%{transform:rotate(-12deg) scale(1); opacity:1}
}

/* Kotak arsip */
.aa-box-back{
  animation:aa-fadein 1s ease calc(var(--aa-intro) * .75) backwards;
  position:absolute; z-index:1; left:48px; top:244px; width:204px; height:26px;
  border-radius:6px 6px 0 0;
  background:rgba(12,28,54,.9);
  border:1px solid rgba(120,175,240,.22);
}
.aa-box-front{
  position:absolute; z-index:3; left:38px; top:262px; width:224px; height:78px;
  border-radius:4px 4px 10px 10px;
  background:linear-gradient(180deg,#183a66,#0f2647);
  border:1px solid rgba(130,185,245,.4);
  box-shadow:0 20px 40px -14px rgba(0,0,0,.7);
  display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px;
  animation:aa-box var(--aa-cycle) ease-out var(--aa-intro) var(--aa-loops), aa-fadein 1s ease calc(var(--aa-intro) * .75) backwards;
}
@keyframes aa-box{
  0%,78%{box-shadow:0 20px 40px -14px rgba(0,0,0,.7); border-color:rgba(130,185,245,.4)}
  82%{box-shadow:0 0 34px rgba(94,179,246,.55),0 20px 40px -14px rgba(0,0,0,.7); border-color:#7cc4ff; transform:translateY(3px)}
  92%,100%{box-shadow:0 20px 40px -14px rgba(0,0,0,.7); border-color:rgba(130,185,245,.4); transform:none}
}
.aa-box-slot{width:44px; height:7px; border-radius:4px; background:rgba(5,15,32,.85); box-shadow:inset 0 1px 2px rgba(0,0,0,.6)}
.aa-box-label{font-size:9px; letter-spacing:.2em; color:rgba(180,212,248,.8)}

.aa-plus{
  position:absolute; z-index:4; left:50%; top:250px;
  font-size:13px; font-weight:700; color:#7cc4ff;
  opacity:0; transform:translateX(-50%);
  animation:aa-plus var(--aa-cycle) ease-out var(--aa-intro) var(--aa-loops) both;
}
@keyframes aa-plus{
  0%,80%{opacity:0; transform:translate(-50%,0)}
  84%{opacity:1}
  100%{opacity:0; transform:translate(-50%,-40px)}
}

.aa-counter{
  animation:aa-fadein 1s ease calc(var(--aa-intro) * .82) backwards;
  position:absolute; left:50%; top:356px; transform:translateX(-50%);
  display:flex; align-items:center; gap:8px; white-space:nowrap;
  font-size:10px; letter-spacing:.08em; color:var(--aa-muted);
}
.aa-dot{width:6px; height:6px; border-radius:50%; background:#4ade80; box-shadow:0 0 8px #4ade80; animation:aa-blink 2s ease-in-out infinite}
@keyframes aa-blink{50%{opacity:.35}}


/* ===== INTRO ===== */
@keyframes aa-fadein{from{opacity:0}}
.aa-intro{
  position:absolute; z-index:5; left:90px; top:50px; width:120px; height:98px;
  animation:aa-intro-folder var(--aa-intro) cubic-bezier(.4,0,.2,1) forwards;
}
@keyframes aa-intro-folder{
  0%{transform:scale(.6) translateY(10px); opacity:0}
  16%{transform:scale(1.02); opacity:1}
  24%{transform:scale(1)}
  47%{transform:scale(1)}
  50%{transform:scale(.94)}
  54%{transform:scale(1)}
  78%{transform:scale(1); opacity:1}
  100%{transform:scale(1)}
}
@keyframes aa-intro-hide{0%,78%{opacity:1; transform:none}95%,100%{opacity:0; transform:translateY(24px) scale(.85)}}
.aa-intro svg{position:absolute; inset:0; overflow:visible}
.aa-intro-back{z-index:1; transform-origin:50% 100%; animation:aa-intro-hide var(--aa-intro) cubic-bezier(.4,0,.2,1) forwards}
.aa-intro-front{
  z-index:3; transform-origin:50% 100%;
  filter:drop-shadow(0 -2px 6px rgba(0,0,0,.25));
  animation:aa-intro-flap var(--aa-intro) cubic-bezier(.4,0,.2,1) forwards, aa-intro-hide var(--aa-intro) cubic-bezier(.4,0,.2,1) forwards;
}
@keyframes aa-intro-flap{
  0%,52%{transform:none}
  62%,78%{transform:perspective(300px) rotateX(38deg)}
  100%{transform:perspective(300px) rotateX(38deg)}
}
.aa-intro-file{
  position:absolute; z-index:2; left:33px; top:22px; width:54px; height:70px;
  border-radius:5px; background:#eaf2fc;
  box-shadow:0 6px 18px rgba(0,0,0,.35);
  opacity:0;
  animation:aa-intro-file var(--aa-intro) cubic-bezier(.4,0,.2,1) forwards;
}
.aa-intro-file-band{position:absolute; left:8px; right:8px; top:12px; height:5px; border-radius:3px; background:#3b82f6;
  box-shadow:0 10px 0 #b8d3f2,0 20px 0 #b8d3f2,0 30px 0 #b8d3f2}
@keyframes aa-intro-file{
  0%,54%{transform:translateY(10px); opacity:0}
  58%{opacity:1}
  72%{transform:translateY(-58px) scale(1.1); opacity:1; z-index:2}
  73%{z-index:4}
  92%{transform:translateY(-20px) scale(2.6); opacity:1}
  100%{transform:translateY(-20px) scale(2.75); opacity:0; z-index:4}
}
.aa-ripple{
  position:absolute; z-index:4; left:72px; top:56px; width:16px; height:16px; margin:-8px;
  border-radius:50%; border:2px solid #9fd2ff; opacity:0;
  animation:aa-ripple var(--aa-intro) cubic-bezier(.2,.6,.3,1) forwards;
}
@keyframes aa-ripple{
  0%,46%{transform:scale(.3); opacity:0}
  48%{opacity:1}
  62%,100%{transform:scale(3.4); opacity:0}
}
.aa-cursor{
  position:absolute; z-index:6; left:162px; top:106px;
  filter:drop-shadow(0 3px 5px rgba(0,0,0,.5));
  opacity:0;
  animation:aa-cursor var(--aa-intro) cubic-bezier(.65,0,.35,1) forwards;
}
@keyframes aa-cursor{
  0%,12%{transform:translate(110px,210px); opacity:0}
  18%{opacity:1}
  42%{transform:translate(0,0) scale(1)}
  47%{transform:translate(0,0) scale(.8)}
  52%{transform:translate(0,0) scale(1); opacity:1}
  70%{transform:translate(70px,120px); opacity:0}
  100%{transform:translate(70px,120px); opacity:0}
}

/* ===== OUTRO ===== */
.aa-sheet{transition:opacity .5s}
.aa-stage--outro .aa-sheet{opacity:0 !important}
.aa-outro{position:absolute; z-index:6; left:25px; top:0; width:250px; height:220px}
.aa-win{
  position:absolute; inset:0; border-radius:10px; overflow:hidden;
  background:linear-gradient(160deg,rgba(28,58,100,.97),rgba(12,28,56,.97));
  border:1px solid rgba(130,185,245,.38);
  box-shadow:0 20px 50px -14px rgba(0,0,0,.7);
  animation:aa-win var(--aa-outro) ease both;
}
@keyframes aa-win{0%{opacity:0; transform:translateY(14px) scale(.96)}5%,94%{opacity:1; transform:none}100%{opacity:0; transform:translateY(-10px) scale(.97)}}
.aa-win-head{display:flex; align-items:center; gap:5px; height:26px; padding:0 10px; border-bottom:1px solid var(--aa-line); font-size:9px; letter-spacing:.08em; color:#cfe3fb}
.aa-win-head i{width:6px; height:6px; border-radius:50%; background:rgba(148,190,240,.3)}
.aa-win-head span{margin-left:6px}
.aa-search{
  margin:10px 10px 8px; height:28px; padding:0 9px; border-radius:6px;
  display:flex; align-items:center; gap:7px; color:rgba(170,205,245,.8);
  background:rgba(5,15,32,.6); border:1px solid rgba(120,175,240,.2);
  font-size:10px; letter-spacing:.06em;
  animation:aa-search-focus var(--aa-outro) ease both;
}
@keyframes aa-search-focus{0%,11%{border-color:rgba(120,175,240,.2)}12%,26%{border-color:#7cc4ff; box-shadow:0 0 0 3px rgba(94,179,246,.15)}30%,100%{border-color:rgba(120,175,240,.2)}}
.aa-typed{display:inline-block; overflow:hidden; white-space:nowrap; width:0; color:#e6f1fd; animation:aa-type var(--aa-outro) steps(12) both}
@keyframes aa-type{0%,13%{width:0}24%,100%{width:13.8ch}}
.aa-caret{width:1px; height:12px; margin-left:-5px; background:#7cc4ff; opacity:0; animation:aa-caret var(--aa-outro) linear both}
@keyframes aa-caret{0%,11%{opacity:0}12%,15%,18%,21%,24%{opacity:1}13.5%,16.5%,19.5%,22.5%{opacity:.3}27%,100%{opacity:0}}

.aa-rows{padding:0 10px; display:flex; flex-direction:column; gap:5px}
.aa-row{
  position:relative; height:30px; flex-shrink:0; display:flex; align-items:center; gap:7px; padding:0 8px; border-radius:6px; overflow:hidden;
  font-size:9px; letter-spacing:.04em; color:rgba(200,222,248,.85);
  background:rgba(40,80,130,.2); border:1px solid transparent; opacity:0;
}
.aa-row-name{flex:1; white-space:nowrap}
.aa-badge{font-size:6.5px; font-weight:700; letter-spacing:.08em; padding:2px 5px; border-radius:3px}
.aa-badge--on{color:#86efac; background:rgba(34,197,94,.14); border:1px solid rgba(74,222,128,.5)}
.aa-badge--off{color:#cbd5e1; background:rgba(148,163,184,.12); border:1px solid rgba(148,163,184,.4)}
.aa-badge-swap{position:relative; display:inline-grid}
.aa-badge-swap > *{grid-area:1/1; text-align:center}
.aa-swap-on{opacity:0; animation:aa-swap-on var(--aa-outro) ease both}
.aa-swap-off{animation:aa-swap-off var(--aa-outro) ease both}
@keyframes aa-swap-on{0%,72%{opacity:0; transform:scale(.6)}75%,100%{opacity:1; transform:none}}
@keyframes aa-swap-off{0%,72%{opacity:1}74%,100%{opacity:0}}
.aa-act{width:18px; display:flex; justify-content:center; color:rgba(170,205,245,.75)}
.aa-dl{animation:aa-dl var(--aa-outro) ease both}
@keyframes aa-dl{0%,39%{color:rgba(170,205,245,.75)}40%,51%{color:#7cc4ff}52%,100%{color:#86efac}}
.aa-progress{position:absolute; left:0; bottom:0; height:2px; width:0; background:linear-gradient(90deg,#5eb3f6,#86efac); animation:aa-progress var(--aa-outro) linear both}
@keyframes aa-progress{0%,40%{width:0; opacity:1}50%{width:100%; opacity:1}54%,100%{width:100%; opacity:0}}
.aa-toggle{width:18px; height:10px; border-radius:6px; background:rgba(148,163,184,.35); position:relative; animation:aa-toggle var(--aa-outro) ease both}
.aa-toggle i{position:absolute; left:1px; top:1px; width:8px; height:8px; border-radius:50%; background:#e2e8f0; animation:aa-knob var(--aa-outro) ease both}
@keyframes aa-toggle{0%,72%{background:rgba(148,163,184,.35)}74%,100%{background:#22c55e}}
@keyframes aa-knob{0%,72%{transform:none}74%,100%{transform:translateX(8px)}}

.aa-row--1{animation:aa-row1 var(--aa-outro) ease both}
.aa-row--2{animation:aa-row2 var(--aa-outro) ease both}
.aa-row--3{animation:aa-row3 var(--aa-outro) ease both}
@keyframes aa-row1{0%,25%{opacity:0; transform:translateY(6px)}28%,31%{opacity:1; transform:none; background:rgba(40,80,130,.2); border-color:transparent}33%,100%{opacity:1; background:rgba(94,179,246,.14); border-color:rgba(124,196,255,.45)}}
@keyframes aa-row2{
  0%,27%{opacity:0; transform:translateY(6px); height:30px}
  30%,57%{opacity:1; transform:none; height:30px; background:rgba(40,80,130,.2); border-color:transparent; color:rgba(200,222,248,.85)}
  59%,61%{opacity:1; height:30px; background:rgba(239,68,68,.22); border-color:rgba(239,68,68,.6); color:#fecaca}
  66%,100%{opacity:0; height:0; margin-top:-5px; transform:translateX(30px); background:rgba(239,68,68,.22)}
}
@keyframes aa-row3{0%,29%{opacity:0; transform:translateY(6px)}32%,71%{opacity:1; transform:none; background:rgba(40,80,130,.2); border-color:transparent}74%,100%{opacity:1; background:rgba(34,197,94,.1); border-color:rgba(74,222,128,.4)}}

.aa-win-foot{position:absolute; right:10px; bottom:10px}
.aa-save{display:inline-block; padding:6px 14px; border-radius:6px; font-size:9px; font-weight:700; letter-spacing:.08em; color:#06213f; background:#7cc4ff; animation:aa-save var(--aa-outro) ease both}
@keyframes aa-save{0%,85%{transform:none; box-shadow:none}87%{transform:scale(.92)}89%,95%{transform:none; box-shadow:0 0 16px rgba(124,196,255,.7)}100%{box-shadow:none}}

.aa-toast{position:absolute; left:50%; top:230px; white-space:nowrap; padding:6px 12px; border-radius:20px; font-size:9px; letter-spacing:.06em; opacity:0; transform:translate(-50%,8px)}
.aa-toast--dl{color:#dbeafe; background:rgba(30,64,120,.9); border:1px solid rgba(124,196,255,.6); animation:aa-t-dl var(--aa-outro) ease both}
.aa-toast--del{color:#fecaca; background:rgba(127,29,29,.85); border:1px solid rgba(239,68,68,.6); animation:aa-t-del var(--aa-outro) ease both}
.aa-toast--on{color:#bbf7d0; background:rgba(20,83,45,.88); border:1px solid rgba(74,222,128,.6); animation:aa-t-on var(--aa-outro) ease both}
.aa-toast--save{color:#d1fae5; background:rgba(6,78,59,.85); border:1px solid rgba(74,222,128,.6); animation:aa-t-save var(--aa-outro) ease both}
@keyframes aa-t-dl  {0%,49%{opacity:0; transform:translate(-50%,8px)}51%,56%{opacity:1; transform:translate(-50%,0)}58%,100%{opacity:0; transform:translate(-50%,-6px)}}
@keyframes aa-t-del {0%,60%{opacity:0; transform:translate(-50%,8px)}62%,69%{opacity:1; transform:translate(-50%,0)}71%,100%{opacity:0; transform:translate(-50%,-6px)}}
@keyframes aa-t-on  {0%,73%{opacity:0; transform:translate(-50%,8px)}75%,81%{opacity:1; transform:translate(-50%,0)}83%,100%{opacity:0; transform:translate(-50%,-6px)}}
@keyframes aa-t-save{0%,87%{opacity:0; transform:translate(-50%,8px)}89%,95%{opacity:1; transform:translate(-50%,0)}97%,100%{opacity:0; transform:translate(-50%,-6px)}}

.aa-cursor2{position:absolute; left:0; top:0; z-index:7; filter:drop-shadow(0 3px 5px rgba(0,0,0,.5)); animation:aa-cursor2 var(--aa-outro) cubic-bezier(.45,0,.25,1) both}
@keyframes aa-cursor2{
  0%,4%{transform:translate(250px,250px); opacity:0}
  6%{opacity:1}
  11%{transform:translate(60px,44px) scale(1)}
  12%{transform:translate(60px,44px) scale(.8)}
  13%,30%{transform:translate(60px,44px) scale(1)}
  38%{transform:translate(222px,84px) scale(1)}
  40%{transform:translate(222px,84px) scale(.8)}
  41%,50%{transform:translate(222px,84px) scale(1)}
  56%{transform:translate(222px,119px) scale(1)}
  58%{transform:translate(222px,119px) scale(.8)}
  59%,64%{transform:translate(222px,119px) scale(1)}
  70%{transform:translate(220px,119px) scale(1)}
  72%{transform:translate(220px,119px) scale(.8)}
  73%,78%{transform:translate(220px,119px) scale(1)}
  84%{transform:translate(214px,198px) scale(1)}
  86%{transform:translate(214px,198px) scale(.8)}
  87%,93%{transform:translate(214px,198px) scale(1); opacity:1}
  99%,100%{transform:translate(240px,240px); opacity:0}
}

@media (max-width: 640px){
  .aa-slogan{display:none !important}
}
@media (min-width: 641px) and (max-width: 1024px){
  .aa-slogan{
    font-size:calc(10px * var(--aa-scale));
    max-width:calc(85px * var(--aa-scale));
    padding:4px 6px;
  }
}

@media (prefers-reduced-motion: reduce){
  .aa-root *{animation:none !important}
  .aa-doc{opacity:1}
  .aa-items--hl{clip-path:inset(0 0 0 0)}
  .aa-intro,.aa-cursor,.aa-outro{display:none}
  .aa-stamp{opacity:1; transform:rotate(-12deg)}
  .aa-slogan{filter:none !important; opacity:.85; transition:none}
}
`;
