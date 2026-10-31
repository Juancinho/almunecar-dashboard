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

/* ---------- Fondo: malla de luz detrás del cristal ---------- */
export function Backdrop() {
  return <div className="backdrop" aria-hidden><i className="b1" /><i className="b2" /><i className="b3" /><i className="b4" /><div className="grain" /></div>;
}
