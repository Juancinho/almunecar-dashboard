import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { decrypt, Enc } from "./crypto";
import type { Data } from "./types";
import Logo from "./Logo";
import { Icon } from "./ui";

const loadDashboard = () => import("./Dashboard");
const Dashboard = lazy(loadDashboard); // gráficos fuera del bundle del login
const REFRESH_MS = 120_000; // el box sube data.enc.json con cada ciclo del bot

export default function App() {
  const [data, setData] = useState<Data | null>(null);
  const [pw, setPw] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);
  const key = useRef<string | null>(null);  // solo en memoria; se pierde al recargar o bloquear

  const load = useCallback(async (password: string): Promise<Data> => {
    if (import.meta.env.DEV && password === "mock") return (await fetch("./mock.json", { cache: "no-store" })).json(); // solo en local: public/mock.json (gitignored)
    const enc: Enc = await (await fetch(`./data.enc.json?t=${Date.now()}`, { cache: "no-store" })).json();
    return decrypt<Data>(enc, password);
  }, []);

  async function unlock(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    try { const d = await load(pw); key.current = pw; setPw(""); setData(d); setFetchedAt(new Date()); }
    catch { setErr("Contraseña incorrecta o datos no disponibles"); } finally { setBusy(false); }
  }
  const refresh = useCallback(async () => {
    if (!key.current) return; setBusy(true);
    try { setData(await load(key.current)); setFetchedAt(new Date()); } catch { /* se mantiene lo último bueno */ } finally { setBusy(false); }
  }, [load]);
  useEffect(() => {
    if (!data) return;
    const id = setInterval(() => { if (document.visibilityState === "visible") refresh(); }, REFRESH_MS);
    return () => clearInterval(id);
  }, [!!data, refresh]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { loadDashboard(); }, []); // se precarga mientras se escribe la contraseña
  const lock = () => { key.current = null; setData(null); setFetchedAt(null); };

  if (data) return <Suspense fallback={<div className="lock" />}><Dashboard d={data} onRefresh={refresh} refreshing={busy} fetchedAt={fetchedAt} onLock={lock} /></Suspense>;
  return (
    <div className="lock">
      <LockBackdrop />
      <form onSubmit={unlock} className={`lock-card ${err ? "shake" : ""}`} key={err}>
        <Logo className="lock-logo" />
        <div className="lock-rule" />
        <h1>Panel de inversión</h1>
        <p>Acceso privado · datos cifrados de extremo a extremo</p>
        <label className="lock-field">
          <Icon n="lock" s={17} />
          <input type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="Contraseña" autoFocus autoComplete="current-password" aria-label="Contraseña" />
        </label>
        <button disabled={busy || !pw}>{busy ? <><span className="spin"><Icon n="refresh" s={17} /></span>Descifrando…</> : <>Entrar<Icon n="arrow" s={17} /></>}</button>
        <div className="err" role="alert">{err}</div>
      </form>
      <footer className="lock-foot">Almuñécar Capital · AES-256-GCM · PBKDF2 600.000 iteraciones</footer>
    </div>
  );
}

/* Fondo corporativo: marino profundo, sol en el horizonte y las olas del logo en movimiento lento */
function LockBackdrop() {
  const wave = (y: number, a: number) => {
    let d = `M-200 ${y}`;
    for (let x = -200; x < 1800; x += 200) d += ` C${x + 60} ${y - a} ${x + 140} ${y + a} ${x + 200} ${y}`;
    return d;
  };
  return <div className="lock-bg" aria-hidden>
    <div className="lock-glow" />
    <svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="lk-fade" x1="0" x2="1"><stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset=".5" stopColor="#fff" stopOpacity="1" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient>
        <mask id="lk-m"><rect width="1440" height="900" fill="url(#lk-fade)" /></mask>
      </defs>
      <g mask="url(#lk-m)" fill="none" strokeLinecap="round">
        <path d="M520 560 A200 200 0 0 1 920 560" stroke="#C9D6EA" strokeOpacity=".22" strokeWidth="2" />
        <path d="M300 560 H1140" stroke="#C9D6EA" strokeOpacity=".18" strokeWidth="1.5" />
        {Array.from({ length: 9 }, (_, i) => <path key={i} className={`lk-w w${i % 3}`} d={wave(620 + i * 34, 16 - i * 0.8)}
          stroke={i % 2 ? "#8493A7" : "#C9D6EA"} strokeOpacity={0.22 - i * 0.018} strokeWidth={1.6} />)}
      </g>
    </svg>
    <div className="grain" />
  </div>;
}
