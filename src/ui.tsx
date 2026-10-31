import { useEffect, useRef, useState } from "react";

/* ---------- Tema claro / oscuro (preferencia por visitante) ---------- */
type Theme = "light" | "dark";
const sysTheme = (): Theme => (window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light");
export function useTheme(): [Theme, () => void] {
  const [t, setT] = useState<Theme>(() => { try { const s = localStorage.getItem("ac-theme"); if (s === "light" || s === "dark") return s; } catch { /* sin storage */ } return sysTheme(); });
  useEffect(() => { document.documentElement.dataset.theme = t; document.querySelector('meta[name="theme-color"]')?.setAttribute("content", t === "dark" ? "#070C16" : "#EEF2F8"); }, [t]);
  return [t, () => setT(x => { const n = x === "dark" ? "light" : "dark"; try { localStorage.setItem("ac-theme", n); } catch { /* sin storage */ } return n; })];
}

/* ---------- Número que cuenta hasta su valor ---------- */
export function useCountUp(target: number, ms = 1100) {
  const [v, setV] = useState(target); const from = useRef(target * 0.985); const first = useRef(true);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { setV(target); return; }
    const a = first.current ? from.current : v; first.current = false; let raf = 0; const t0 = performance.now();
    const step = (now: number) => { const k = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(2, -10 * k); setV(a + (target - a) * (k >= 1 ? 1 : e)); if (k < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step); return () => cancelAnimationFrame(raf);
  }, [target]); // eslint-disable-line react-hooks/exhaustive-deps
  return v;
}

/* ---------- Brillo especular que sigue al puntero sobre el cristal ---------- */
export function useGlassSheen() {
  useEffect(() => {
    const on = (e: PointerEvent) => {
      const el = (e.target as Element)?.closest?.(".glass") as HTMLElement | null; if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${e.clientX - r.left}px`); el.style.setProperty("--my", `${e.clientY - r.top}px`);
    };
    window.addEventListener("pointermove", on, { passive: true }); return () => window.removeEventListener("pointermove", on);
  }, []);
}

/* ---------- Estado del mercado de EE. UU. (horario regular, sin festivos) ---------- */
export function useNyse() {
  const calc = () => {
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false })
      .formatToParts(new Date()).map(x => [x.type, x.value]));
    const mins = (+p.hour % 24) * 60 + +p.minute, wk = !["Sat", "Sun"].includes(p.weekday);
    return wk && mins >= 570 && mins < 960;
  };
  const [open, setOpen] = useState(calc);
  useEffect(() => { const id = setInterval(() => setOpen(calc()), 30_000); return () => clearInterval(id); }, []);
  return open;
}

/* ---------- Iconos (trazo 1.75, 20×20) ---------- */
const P: Record<string, string> = {
  sun: "M10 3v1.5M10 15.5V17M3 10h1.5M15.5 10H17M5.05 5.05l1.06 1.06M13.89 13.89l1.06 1.06M5.05 14.95l1.06-1.06M13.89 6.11l1.06-1.06M13.25 10a3.25 3.25 0 1 1-6.5 0 3.25 3.25 0 0 1 6.5 0Z",
  moon: "M16.5 11.6A6.75 6.75 0 0 1 8.4 3.5a6.75 6.75 0 1 0 8.1 8.1Z",
  refresh: "M16.25 10a6.25 6.25 0 1 1-1.83-4.42M16.25 3.75v3.5h-3.5",
  lock: "M6 8.75V6.5a4 4 0 0 1 8 0v2.25M5.25 8.75h9.5c.55 0 1 .45 1 1v6c0 .55-.45 1-1 1h-9.5c-.55 0-1-.45-1-1v-6c0-.55.45-1 1-1Z",
  arrow: "M4.5 10h11M11 5.5 15.5 10 11 14.5",
  shield: "M10 2.75 4 5v4.6c0 3.7 2.55 6.6 6 7.65 3.45-1.05 6-3.95 6-7.65V5l-6-2.25Z",
  layers: "m10 3 7 3.75-7 3.75-7-3.75L10 3ZM3 10.25 10 14l7-3.75M3 13.75 10 17.5l7-3.75",
  pulse: "M2.75 10h3l2-5 4 10 2-5h3.5",
  list: "M7.5 5.5h9M7.5 10h9M7.5 14.5h9M3.75 5.5h.01M3.75 10h.01M3.75 14.5h.01",
  target: "M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM10 13.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM10 10h.01",
  coins: "M7.75 8.5c2.9 0 5.25-1.01 5.25-2.25S10.65 4 7.75 4 2.5 5.01 2.5 6.25 4.85 8.5 7.75 8.5ZM2.5 6.25v3.5c0 1.24 2.35 2.25 5.25 2.25M2.5 9.75v3.5c0 1.24 2.35 2.25 5.25 2.25M17.5 10.25c0 1.24-2.35 2.25-5.25 2.25S7 11.49 7 10.25 9.35 8 12.25 8s5.25 1.01 5.25 2.25ZM7 10.25v3.5c0 1.24 2.35 2.25 5.25 2.25s5.25-1.01 5.25-2.25v-3.5",
  calendar: "M5 4.5h10c.83 0 1.5.67 1.5 1.5v9c0 .83-.67 1.5-1.5 1.5H5c-.83 0-1.5-.67-1.5-1.5V6c0-.83.67-1.5 1.5-1.5ZM3.5 8.5h13M7 3v3M13 3v3",
  search: "M9 15.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13ZM17.5 17.5l-3.9-3.9",
  eye: "M2.5 10s2.75-5.5 7.5-5.5 7.5 5.5 7.5 5.5-2.75 5.5-7.5 5.5S2.5 10 2.5 10ZM10 12.25a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Z",
  book: "M4 4.75c0-.69.56-1.25 1.25-1.25H16v12H5.25C4.56 15.5 4 16.06 4 16.75M4 4.75v12M7 7h6",
  down: "M10 4v12M5.5 11.5 10 16l4.5-4.5",
  alert: "M10 7.25v3.5M10 13.5h.01M8.68 3.27 2.38 14.5c-.58 1.03.16 2.25 1.32 2.25h12.6c1.16 0 1.9-1.22 1.32-2.25L11.32 3.27a1.5 1.5 0 0 0-2.64 0Z",
  home: "M3.5 9 10 3.5 16.5 9v6.75c0 .41-.34.75-.75.75H12.5v-4.5h-5v4.5H4.25a.75.75 0 0 1-.75-.75V9Z",
  trend: "M3 14.5 7.5 10l3 3 6.5-6.5M12.5 6.5H17V11",
  scale: "M10 3.5v13M5.5 16.5h9M3.5 7.5h13M3.5 7.5 1.75 12a2 2 0 0 0 3.5 0L3.5 7.5ZM16.5 7.5 14.75 12a2 2 0 0 0 3.5 0L16.5 7.5Z",
  bolt: "M11 2.75 4.5 11.25h5l-1 6 6.5-8.5h-5l1-6Z",
  flag: "M4.5 17V3.5M4.5 4h9.25l-1.75 3.5 1.75 3.5H4.5",
  x: "M5 5l10 10M15 5 5 15",
  download: "M10 3.5v9M6 8.5l4 4 4-4M4 15.5h12",
  cpu: "M6.5 4.5h7a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2ZM8 8h4v4H8V8ZM8 2v2.5M12 2v2.5M8 15.5V18M12 15.5V18M2 8h2.5M2 12h2.5M15.5 8H18M15.5 12H18",
  info: "M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM10 9v4.5M10 6.5h.01",
  hist: "M3.5 16.5h13M5 16.5V11M8.5 16.5V6M12 16.5V8.5M15.5 16.5V12.5",
  ext: "M8.5 4.5h-3a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-3M11.5 4.5h4v4M15.5 4.5 9.5 10.5",
};
export function Icon({ n, s = 18 }: { n: keyof typeof P | string; s?: number }) {
  return <svg width={s} height={s} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={P[n]} /></svg>;
}

/* ---------- Tarjeta de cristal ---------- */
export function Card({ title, icon, sub, right, className = "", children, style }: { title?: string; icon?: string; sub?: React.ReactNode; right?: React.ReactNode; className?: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return <section className={`glass card ${className}`} style={style}>
    {title && <header className="card-h">
      <div className="card-t">{icon && <span className="card-i"><Icon n={icon} s={16} /></span>}<div><h3>{title}</h3>{sub && <p>{sub}</p>}</div></div>
      {right}
    </header>}
    {children}
  </section>;
}

export function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: { v: T; l: string }[]; onChange: (v: T) => void; label: string }) {
  return <div className="seg" role="tablist" aria-label={label}>
    {options.map(o => <button key={o.v} role="tab" aria-selected={o.v === value} className={o.v === value ? "on" : ""} onClick={() => onChange(o.v)}>{o.l}</button>)}
  </div>;
}

export function Empty({ icon, title, children }: { icon: string; title: string; children?: React.ReactNode }) {
  return <div className="empty"><span className="empty-i"><Icon n={icon} s={22} /></span><b>{title}</b>{children && <p>{children}</p>}</div>;
}

/* Aviso de que una tarjeta depende de un campo v2 que el bot aún no publica */
export function NeedsData({ field, children }: { field: string; children: React.ReactNode }) {
  return <div className="empty needs"><span className="empty-i"><Icon n="cpu" s={22} /></span><b>Pendiente de datos del bot</b>
    <p>{children}</p><code>{field}</code></div>;
}

/* ---------- Reloj compartido para tiempos relativos ---------- */
export function useNow(ms = 30_000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(id); }, [ms]);
  return now;
}

/* ---------- Pestañas sincronizadas con el hash (#rendimiento…) ---------- */
export function useHashTab<T extends string>(tabs: readonly T[], def: T): [T, (t: T) => void] {
  const read = () => { const h = location.hash.slice(1) as T; return tabs.includes(h) ? h : def; };
  const [tab, setTab] = useState<T>(read);
  useEffect(() => { const on = () => setTab(read()); window.addEventListener("hashchange", on); return () => window.removeEventListener("hashchange", on); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return [tab, (t: T) => { if (t !== tab) { history.pushState(null, "", `#${t}`); setTab(t); } window.scrollTo({ top: 0, behavior: "smooth" }); }];
}

/** Barra de pestañas con una píldora de cristal que se desliza a la activa */
export function Tabs<T extends string>({ tabs, value, onChange, className = "" }: { tabs: { v: T; l: string; i: string }[]; value: T; onChange: (t: T) => void; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<{ x: number; w: number } | null>(null);
  useEffect(() => {
    const place = () => { const el = ref.current?.querySelector<HTMLElement>(`[data-v="${value}"]`); if (el) setPill({ x: el.offsetLeft, w: el.offsetWidth }); };
    place(); const ro = new ResizeObserver(place); if (ref.current) ro.observe(ref.current); return () => ro.disconnect();
  }, [value]);
  return <div className={`tabs ${className}`} ref={ref} role="tablist">
    {pill && <span className="tabs-pill" style={{ transform: `translateX(${pill.x}px)`, width: pill.w }} />}
    {tabs.map(t => <button key={t.v} data-v={t.v} role="tab" aria-selected={t.v === value} className={t.v === value ? "on" : ""} onClick={() => onChange(t.v)}>
      <Icon n={t.i} s={17} /><span>{t.l}</span></button>)}
  </div>;
}

/* ---------- Hoja modal de cristal ---------- */
export function Sheet({ open, onClose, children, title }: { open: boolean; onClose: () => void; children: React.ReactNode; title: string }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose(); window.addEventListener("keydown", k);
    const o = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = o; };
  }, [open, onClose]);
  if (!open) return null;
  return <div className="sheet-wrap" onMouseDown={e => e.target === e.currentTarget && onClose()} role="dialog" aria-modal="true" aria-label={title}>
    <div className="glass sheet"><button className="ibtn sheet-x" onClick={onClose} aria-label="Cerrar"><Icon n="x" /></button>{children}</div>
  </div>;
}

/* ---------- Avisos efímeros ---------- */
export interface ToastMsg { id: number; icon: string; title: string; body?: string; tone?: "pos" | "neg" | "" }
export function Toasts({ items, onDone }: { items: ToastMsg[]; onDone: (id: number) => void }) {
  useEffect(() => { if (!items.length) return; const t = setTimeout(() => onDone(items[0].id), 6000); return () => clearTimeout(t); }, [items, onDone]);
  return <div className="toasts" aria-live="polite">{items.map(t => <div key={t.id} className={`glass toast ${t.tone ?? ""}`} onClick={() => onDone(t.id)}>
    <span className="toast-i"><Icon n={t.icon} s={18} /></span><div><b>{t.title}</b>{t.body && <p>{t.body}</p>}</div></div>)}</div>;
}

/** Celda de métrica con etiqueta, valor y ayuda opcional al pasar el ratón */
export function Stat({ k, v, c = "", help, sub }: { k: string; v: React.ReactNode; c?: string; help?: string; sub?: React.ReactNode }) {
  return <div className="stat" title={help}><dt>{k}{help && <Icon n="info" s={12} />}</dt><dd className={c}>{v}</dd>{sub && <small>{sub}</small>}</div>;
}

/* ---------- Fondo: malla de luz detrás del cristal ---------- */
export function Backdrop() {
  return <div className="backdrop" aria-hidden><i className="b1" /><i className="b2" /><i className="b3" /><i className="b4" /><div className="grain" /></div>;
}
