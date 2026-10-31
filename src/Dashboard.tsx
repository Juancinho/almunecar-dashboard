import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Data } from "./types";
import Logo from "./Logo";
import { ago, compute, eur, longDate, sEur } from "./metrics";
import { Backdrop, Icon, Sheet, Tabs, Toasts, useGlassSheen, useHashTab, useNow, useNyse, useTheme, type ToastMsg } from "./ui";
import { PositionDetail, type TabId } from "./views/shared";
import Resumen from "./views/Resumen";
import Rendimiento from "./views/Rendimiento";
import Riesgo from "./views/Riesgo";
import Operativa from "./views/Operativa";
import Plan from "./views/Plan";

const TABS: { v: TabId; l: string; i: string; h: string; sub: string }[] = [
  { v: "resumen", l: "Resumen", i: "home", h: "Panel de control", sub: "Bot de inversión · cuenta de simulación IBKR" },
  { v: "rendimiento", l: "Rendimiento", i: "trend", h: "Rendimiento", sub: "Rentabilidad, comparación con el índice y ratios" },
  { v: "riesgo", l: "Riesgo", i: "shield", h: "Riesgo", sub: "Qué puede perder la cartera y dónde está concentrada" },
  { v: "operativa", l: "Operativa", i: "pulse", h: "Operativa", sub: "Calidad de las entradas y salidas del bot" },
  { v: "plan", l: "Plan", i: "list", h: "Plan y tesis", sub: "Qué piensa hacer el bot y por qué" },
];
const IDS = TABS.map(t => t.v);

interface Props { d: Data; onRefresh: () => void; refreshing: boolean; fetchedAt: Date | null; onLock: () => void }

export default function Dashboard({ d, onRefresh, refreshing, fetchedAt, onLock }: Props) {
  const m = useMemo(() => compute(d), [d]);
  const [theme, toggleTheme] = useTheme();
  const nyse = useNyse();
  const now = useNow();
  useGlassSheen();
  const [tab, go] = useHashTab(IDS, "resumen");
  const [sel, setSel] = useState<string | null>(null);
  const close = useCallback(() => setSel(null), []);

  // Avisos cuando un refresco trae novedades
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const prev = useRef(m);
  useEffect(() => {
    const p = prev.current; prev.current = m; if (p === m) return;
    const add: ToastMsg[] = [];
    if (m.trades.length > p.trades.length) for (const t of m.trades.slice(p.trades.length).slice(-3))
      add.push({ id: Math.random(), icon: "bolt", title: `${t.side === "BUY" ? "Compra" : "Venta"} de ${t.qty} ${t.symbol}`, body: t.pnl_eur != null ? `Resultado ${sEur(t.pnl_eur)} · ${t.reason}` : t.reason, tone: t.pnl_eur == null ? "" : t.pnl_eur >= 0 ? "pos" : "neg" });
    if (m.data.halted && !p.data.halted) add.push({ id: Math.random(), icon: "alert", title: "Trading detenido", body: m.data.halt_reason ?? undefined, tone: "neg" });
    if (m.data.plan?.date && m.data.plan.date !== p.data.plan?.date) add.push({ id: Math.random(), icon: "list", title: "Nuevo plan del día", body: m.data.plan.candidates.join(", ") || "Sin candidatos" });
    if (add.length) setToasts(t => [...t, ...add]);
  }, [m]);
  const dropToast = useCallback((id: number) => setToasts(t => t.filter(x => x.id !== id)), []);

  // Frescura de los datos: el box sube un fichero por ciclo; con la bolsa abierta, más de 20 min sin datos es raro
  const age = m.updatedTs ? now - m.updatedTs : null;
  const fresh = age == null ? "off" : age < 20 * 6e4 ? "live" : nyse ? "warn" : "off";
  const meta = TABS.find(t => t.v === tab)!;
  const props = { d, m, open: setSel, go };

  return <div className="app">
    <Backdrop />
    <nav className="nav glass">
      <a href="#resumen" className="nav-logo" onClick={e => { e.preventDefault(); go("resumen"); }}><Logo /></a>
      <Tabs className="nav-tabs" tabs={TABS} value={tab} onChange={go} />
      <div className="nav-r">
        <span className={`status ${d.halted ? "halt" : "live"}`}><i />{d.halted ? "Detenido" : "Operativo"}</span>
        <span className={`status mkt ${nyse ? "live" : "off"}`} title="Horario regular NYSE (sin festivos)"><i />NYSE {nyse ? "abierta" : "cerrada"}</span>
        <button className="ibtn" onClick={onRefresh} title={fetchedAt ? `Descargado a las ${fetchedAt.toLocaleTimeString("es-ES")}` : "Actualizar"} aria-label="Actualizar datos">
          <span className={refreshing ? "spin" : ""}><Icon n="refresh" /></span></button>
        <button className="ibtn" onClick={toggleTheme} aria-label="Cambiar tema"><Icon n={theme === "dark" ? "sun" : "moon"} /></button>
        <button className="ibtn" onClick={onLock} aria-label="Bloquear"><Icon n="lock" /></button>
      </div>
    </nav>

    <main className="wrap">
      <div className="intro rise" key={`h-${tab}`}>
        <div><p className="eyebrow">{meta.sub}</p><h1>{meta.h}</h1></div>
        <div className="intro-r">
          <span className="chip"><Icon n="book" s={15} />Libro virtual {eur(d.base)}</span>
          <span className={`chip fresh ${fresh}`} title={`Datos del ${d.updated}`}><i />{age == null ? longDate(m.updated) : `Actualizado ${ago(age)}`}</span>
        </div>
      </div>

      {d.halted && <div className="glass halted rise"><span className="halted-i"><Icon n="alert" s={22} /></span>
        <div><b>Trading detenido</b><p>{d.halt_reason ?? "Se alcanzó el freno de pérdidas. Pendiente de check-in."}</p></div></div>}
      {fresh === "warn" && <div className="glass stale rise"><Icon n="alert" s={18} />
        <span>La bolsa está abierta y no llegan datos nuevos desde {ago(age!)}. Comprueba que el bot sigue en marcha.</span></div>}

      <div className="view" key={tab}>
        {tab === "resumen" && <Resumen {...props} />}
        {tab === "rendimiento" && <Rendimiento {...props} />}
        {tab === "riesgo" && <Riesgo {...props} />}
        {tab === "operativa" && <Operativa {...props} />}
        {tab === "plan" && <Plan {...props} />}
      </div>

      <footer className="foot-main">
        <Logo variant="mark" className="foot-logo" />
        <p>Datos: ledger del bot y API de IBKR (cuenta de simulación). Cifrados de extremo a extremo y descifrados solo en este navegador.<br />No constituye recomendación de inversión.</p>
        <p className="muted">Actualizado {d.updated}</p>
      </footer>
    </main>

    <Tabs className="glass bottom-tabs" tabs={TABS} value={tab} onChange={go} />
    <Sheet open={sel != null} onClose={close} title={sel ?? ""}>{sel && <PositionDetail symbol={sel} d={d} m={m} />}</Sheet>
    <Toasts items={toasts} onDone={dropToast} />
  </div>;
}
