import { useId, useMemo, useState } from "react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, ReferenceLine, Tooltip, CartesianGrid, ComposedChart, Bar, Line, Cell, PieChart, Pie } from "recharts";
import type { CurvePt, DayRet, Metrics } from "./metrics";
import { eur, eur0, f2, longDate, pct, sEur, sPct, shortDate, tone } from "./metrics";

const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const anim = { isAnimationActive: !reduce, animationDuration: 900, animationEasing: "ease-out" as const };
const axis = { tick: { fontSize: 11, fill: "var(--ink-3)" }, tickLine: false, axisLine: false };
const xFmt = (data: CurvePt[]) => data.length && data[0].t.slice(0, 10) === data[data.length - 1].t.slice(0, 10) ? (t: string) => t.slice(11, 16) : shortDate;
export const SERIES = ["var(--s1)", "var(--s2)", "var(--s3)", "var(--s4)", "var(--s5)", "var(--s6)"];

/* ---------- Tooltip de cristal ---------- */
function Tip({ title, rows }: { title: string; rows: { k: string; v: string; c?: string; dot?: string }[] }) {
  return <div className="tip"><div className="tip-t">{title}</div>
    {rows.map(r => <div className="tip-r" key={r.k}>{r.dot && <i style={{ background: r.dot }} />}<span>{r.k}</span><b className={r.c}>{r.v}</b></div>)}</div>;
}

/* Etiqueta de línea de referencia como pastilla, legible aunque la curva pase por encima */
function RefTag({ viewBox, text, color, below }: { viewBox?: { x: number; y: number }; text: string; color: string; below?: boolean }) {
  if (!viewBox) return null;
  const w = text.length * 6.1 + 16, y = viewBox.y + (below ? 6 : -24);
  return <g><rect x={viewBox.x + 8} y={y} width={w} height={18} rx={9} fill="var(--tip)" stroke={color} strokeOpacity={0.35} />
    <text x={viewBox.x + 16} y={y + 12.5} fontSize={11} fontWeight={600} fill={color}>{text}</text></g>;
}

/* ---------- Curva de equity ---------- */
export function EquityChart({ data, base, halt }: { data: CurvePt[]; base: number; halt: number }) {
  const id = useId().replace(/:/g, "");
  const lo = Math.min(...data.map(c => c.eq), base), hi = Math.max(...data.map(c => c.eq), base);
  const pad = Math.max((hi - lo) * 0.12, base * 0.004);
  const showHalt = lo - pad < halt * 1.04;
  const domain = [showHalt ? Math.min(lo - pad, halt - pad) : lo - pad, hi + pad];
  const one = data.length < 2;
  return <ResponsiveContainer width="100%" height={300}>
    <AreaChart data={data} margin={{ top: 12, right: 4, left: 0, bottom: 0 }}>
      <defs>
        <linearGradient id={`eq${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.32} />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
        </linearGradient>
      </defs>
      <CartesianGrid stroke="var(--grid)" vertical={false} />
      <XAxis dataKey="t" {...axis} tickFormatter={xFmt(data)} minTickGap={56} dy={6} />
      <YAxis {...axis} domain={domain} tickFormatter={v => eur0(v)} width={64} orientation="right" />
      <Tooltip cursor={{ stroke: "var(--accent)", strokeWidth: 1, strokeOpacity: 0.5 }} content={({ active, payload }) => {
        if (!active || !payload?.length) return null; const p = payload[0].payload as CurvePt;
        return <Tip title={longDate(p.t)} rows={[{ k: "Equity", v: eur(p.eq), dot: "var(--accent)" },
          { k: "vs partida", v: sEur(p.eq - base), c: tone(p.eq - base) }, { k: "Desde máximo", v: sPct(p.dd), c: p.dd < 0 ? "neg" : "" }]} />;
      }} />
      <ReferenceLine y={base} stroke="var(--ink-3)" strokeDasharray="3 5" strokeOpacity={0.7}
        label={<RefTag text={`Partida ${eur0(base)}`} color="var(--ink-2)" />} />
      {showHalt && <ReferenceLine y={halt} stroke="var(--neg)" strokeDasharray="3 5"
        label={<RefTag text={`Freno ${eur0(halt)}`} color="var(--neg)" below />} />}
      <Area type="monotone" dataKey="eq" stroke="var(--accent)" strokeWidth={2.25} fill={`url(#eq${id})`}
        dot={one ? { r: 4, fill: "var(--accent)", stroke: "var(--surface)", strokeWidth: 2 } : false}
        activeDot={{ r: 5, fill: "var(--accent)", stroke: "var(--surface)", strokeWidth: 2 }} {...anim} />
    </AreaChart>
  </ResponsiveContainer>;
}

/* ---------- Drawdown (bajo el agua) ---------- */
export function DrawdownChart({ data }: { data: CurvePt[] }) {
  const id = useId().replace(/:/g, "");
  const lo = Math.min(-0.01, ...data.map(c => c.dd));
  return <ResponsiveContainer width="100%" height={200}>
    <AreaChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
      <defs><linearGradient id={`dd${id}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="var(--neg)" stopOpacity={0.05} /><stop offset="100%" stopColor="var(--neg)" stopOpacity={0.35} />
      </linearGradient></defs>
      <CartesianGrid stroke="var(--grid)" vertical={false} />
      <XAxis dataKey="t" {...axis} tickFormatter={xFmt(data)} minTickGap={56} dy={6} />
      <YAxis {...axis} domain={[lo * 1.15, 0]} tickFormatter={v => pct(v, 0)} width={48} orientation="right" />
      <Tooltip cursor={{ stroke: "var(--neg)", strokeOpacity: 0.4 }} content={({ active, payload }) => {
        if (!active || !payload?.length) return null; const p = payload[0].payload as CurvePt;
        return <Tip title={longDate(p.t)} rows={[{ k: "Caída desde máximo", v: sPct(p.dd), c: p.dd < 0 ? "neg" : "", dot: "var(--neg)" }, { k: "Máximo previo", v: eur(p.peak) }]} />;
      }} />
      <Area type="monotone" dataKey="dd" stroke="var(--neg)" strokeWidth={1.75} fill={`url(#dd${id})`} baseValue={0} {...anim} />
    </AreaChart>
  </ResponsiveContainer>;
}

/* ---------- P&L realizado por operación + acumulado (mismo eje, mismas unidades) ---------- */
export function TradePnlChart({ data }: { data: Metrics["realizedSeries"] }) {
  return <ResponsiveContainer width="100%" height={260}>
    <ComposedChart data={data} margin={{ top: 12, right: 4, left: 0, bottom: 0 }} barCategoryGap="22%">
      <CartesianGrid stroke="var(--grid)" vertical={false} />
      <XAxis dataKey="i" {...axis} tickFormatter={v => `#${v}`} minTickGap={16} dy={6} />
      <YAxis {...axis} tickFormatter={v => eur0(v)} width={56} orientation="right" />
      <ReferenceLine y={0} stroke="var(--ink-3)" strokeOpacity={0.5} />
      <Tooltip cursor={{ fill: "var(--hover)" }} content={({ active, payload }) => {
        if (!active || !payload?.length) return null; const p = payload[0].payload as Metrics["realizedSeries"][number];
        return <Tip title={`#${p.i} · ${p.symbol} · ${longDate(p.time)}`} rows={[{ k: "Resultado", v: sEur(p.pnl), c: tone(p.pnl), dot: p.pnl >= 0 ? "var(--pos)" : "var(--neg)" },
          { k: "Acumulado", v: sEur(p.cum), c: tone(p.cum), dot: "var(--accent)" }, { k: "Tesis", v: p.thesis }]} />;
      }} />
      <Bar dataKey="pnl" maxBarSize={22} {...anim}>
        {data.map(d => <Cell key={d.i} fill={d.pnl >= 0 ? "var(--pos)" : "var(--neg)"} fillOpacity={0.85}
          // @ts-expect-error radius por celda está soportado en runtime
          radius={d.pnl >= 0 ? [4, 4, 0, 0] : [0, 0, 4, 4]} />)}
      </Bar>
      <Line type="monotone" dataKey="cum" stroke="var(--accent)" strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: "var(--surface)", strokeWidth: 2 }} {...anim} />
    </ComposedChart>
  </ResponsiveContainer>;
}

/* ---------- Asignación (donut ≤ 6 segmentos) ---------- */
export function AllocationDonut({ allocation }: { allocation: Metrics["allocation"] }) {
  const [hover, setHover] = useState<number | null>(null);
  const slices = useMemo(() => {
    const cash = allocation[allocation.length - 1], pos = allocation.slice(0, -1);
    const top: { name: string; w: number; pnl: number | null; color: string }[] = pos.slice(0, 4).map((p, i) => ({ ...p, color: SERIES[i] }));
    const rest = pos.slice(4);
    if (rest.length) top.push({ name: `Otros (${rest.length})`, w: rest.reduce((a, p) => a + p.w, 0), pnl: rest.reduce((a, p) => a + (p.pnl ?? 0), 0), color: SERIES[4] });
    top.push({ ...cash, color: "var(--cash)" });
    return top.filter(s => s.w > 0.0005);
  }, [allocation]);
  const h = hover != null ? slices[hover] : null;
  const npos = allocation.length - 1;
  return <div className="donut">
    <div className="donut-c">
      <ResponsiveContainer width="100%" height={210}>
        <PieChart>
          <Pie data={slices} dataKey="w" nameKey="name" innerRadius="70%" outerRadius="96%" paddingAngle={slices.length > 1 ? 2.5 : 0}
            cornerRadius={6} stroke="none" startAngle={90} endAngle={-270} onMouseLeave={() => setHover(null)}
            onMouseEnter={(_, i) => setHover(i)} {...anim}>
            {slices.map((s, i) => <Cell key={s.name} fill={s.color} opacity={hover == null || hover === i ? 1 : 0.35} />)}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="donut-mid">
        <b>{h ? pct(h.w) : npos}</b><span>{h ? h.name : npos === 1 ? "posición" : "posiciones"}</span>
      </div>
    </div>
    <ul className="legend">{slices.map((s, i) => <li key={s.name} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} className={hover === i ? "on" : ""}>
      <i style={{ background: s.color }} /><span>{s.name}</span><b>{pct(s.w)}</b><em className={tone(s.pnl)}>{s.pnl == null ? "" : sEur(s.pnl)}</em></li>)}</ul>
  </div>;
}

/* ---------- Medidor del freno −30 % (semicírculo) ---------- */
export function HaltGauge({ used, cushion, drop }: { used: number; cushion: number; drop: number }) {
  const id = useId().replace(/:/g, "");
  const r = 84, c = Math.PI * r, L = c * Math.max(0.002, used);
  const state = used >= 0.66 ? "neg" : used >= 0.33 ? "warn" : "pos";
  return <div className="gauge">
    <svg viewBox="0 0 200 116" aria-hidden>
      <defs><linearGradient id={`g${id}`} x1="0" x2="1">
        <stop offset="0" stopColor="var(--pos)" /><stop offset=".55" stopColor="var(--warn)" /><stop offset="1" stopColor="var(--neg)" />
      </linearGradient></defs>
      <path d="M16 100 A84 84 0 0 1 184 100" fill="none" stroke="var(--track)" strokeWidth="12" strokeLinecap="round" />
      <path d="M16 100 A84 84 0 0 1 184 100" fill="none" stroke={`url(#g${id})`} strokeWidth="12" strokeLinecap="round" opacity=".18" />
      <path className="gauge-fill" d="M16 100 A84 84 0 0 1 184 100" fill="none" stroke={`url(#g${id})`} strokeWidth="12" strokeLinecap="round"
        strokeDasharray={`${L} ${c}`} />
      {[0.25, 0.5, 0.75].map(t => { const a = Math.PI * (1 - t); return <line key={t} x1={100 + 70 * Math.cos(a)} y1={100 - 70 * Math.sin(a)} x2={100 + 64 * Math.cos(a)} y2={100 - 64 * Math.sin(a)} stroke="var(--ink-3)" strokeOpacity=".5" strokeWidth="1.5" strokeLinecap="round" />; })}
    </svg>
    <div className="gauge-mid">
      <b>{eur(cushion)}</b><span>de margen hasta el freno</span>
    </div>
    <div className="gauge-pill"><em className={`pill ${state}`}>{pct(drop)} de 30 % consumido</em></div>
  </div>;
}

/* ---------- Anillo simple ---------- */
export function Ring({ value, size = 92, label, sub }: { value: number | null; size?: number; label: string; sub?: string }) {
  const r = 40, c = 2 * Math.PI * r, v = value ?? 0;
  return <div className="ring" style={{ width: size, height: size }}>
    <svg viewBox="0 0 100 100" aria-hidden>
      <circle cx="50" cy="50" r={r} fill="none" stroke="var(--track)" strokeWidth="9" />
      <circle className="ring-fill" cx="50" cy="50" r={r} fill="none" stroke="var(--accent)" strokeWidth="9" strokeLinecap="round"
        strokeDasharray={`${c * v} ${c}`} transform="rotate(-90 50 50)" />
    </svg>
    <div><b>{label}</b>{sub && <span>{sub}</span>}</div>
  </div>;
}

/* ---------- Sparkline ---------- */
export function Spark({ values, w = 120, h = 36 }: { values: number[]; w?: number; h?: number }) {
  const id = useId().replace(/:/g, "");
  if (values.length < 2) return null;
  const lo = Math.min(...values), hi = Math.max(...values), k = hi - lo || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - 3 - ((v - lo) / k) * (h - 6)]);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join("");
  return <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden>
    <defs><linearGradient id={`sp${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--accent)" stopOpacity=".28" /><stop offset="1" stopColor="var(--accent)" stopOpacity="0" /></linearGradient></defs>
    <path d={`${d}L${w} ${h}L0 ${h}Z`} fill={`url(#sp${id})`} />
    <path d={d} fill="none" stroke="var(--accent)" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
  </svg>;
}

/* ---------- Calendario de rendimiento diario (divergente: rojo · gris · verde) ---------- */
const WD = ["L", "M", "X", "J", "V"];
export function CalendarHeat({ daily, weeks = 18 }: { daily: DayRet[]; weeks?: number }) {
  const [tip, setTip] = useState<{ x: number; y: number; d: DayRet } | null>(null);
  const grid = useMemo(() => {
    const map = new Map(daily.map(d => [d.day, d]));
    const last = daily.length ? new Date(daily[daily.length - 1].day + "T12:00") : new Date();
    const monday = new Date(last); monday.setDate(last.getDate() - ((last.getDay() + 6) % 7) - (weeks - 1) * 7);
    const maxAbs = Math.max(0.004, ...daily.map(d => Math.abs(d.ret)));
    const cols: { key: string; month: string | null; cells: ({ day: string; d?: DayRet; a: number } | null)[] }[] = [];
    let prevMonth = -1;
    for (let w = 0; w < weeks; w++) {
      const cells = []; let month: string | null = null;
      for (let i = 0; i < 5; i++) {
        const dt = new Date(monday); dt.setDate(monday.getDate() + w * 7 + i);
        if (dt > last) { cells.push(null); continue; }
        const day = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
        if (i === 0 && dt.getMonth() !== prevMonth) { month = shortDate(day).split(" ")[1]; prevMonth = dt.getMonth(); }
        const d = map.get(day); cells.push({ day, d, a: d ? Math.min(1, Math.abs(d.ret) / maxAbs) : 0 });
      }
      cols.push({ key: String(w), month, cells });
    }
    for (let i = 0; i < cols.length; i++) if (cols[i].month && cols.slice(i + 1, i + 3).some(c => c.month)) cols[i].month = null; // evita etiquetas pegadas
    return cols;
  }, [daily, weeks]);
  return <div className="cal" onMouseLeave={() => setTip(null)}>
    <div className="cal-wd">{WD.map(d => <span key={d}>{d}</span>)}</div>
    <div className="cal-g">
      {grid.map(col => <div className="cal-col" key={col.key}>
        <span className="cal-m">{col.month ?? ""}</span>
        {col.cells.map((c, i) => c == null ? <i key={i} className="cal-c void" /> :
          <i key={i} className={`cal-c ${c.d ? (c.d.ret > 0 ? "up" : c.d.ret < 0 ? "dn" : "flat") : "none"}`}
            style={{ ["--a" as string]: (0.35 + 0.65 * c.a).toFixed(2) }}
            onMouseEnter={e => { if (!c.d) return setTip(null); const r = (e.target as HTMLElement).getBoundingClientRect(), p = (e.currentTarget.closest(".cal") as HTMLElement).getBoundingClientRect(); setTip({ x: r.left - p.left + r.width / 2, y: r.top - p.top, d: c.d }); }} />)}
      </div>)}
    </div>
    <div className="cal-key"><span>Pérdida</span><i className="cal-c dn" style={{ ["--a" as string]: 1 }} /><i className="cal-c dn" style={{ ["--a" as string]: 0.45 }} /><i className="cal-c flat" /><i className="cal-c up" style={{ ["--a" as string]: 0.45 }} /><i className="cal-c up" style={{ ["--a" as string]: 1 }} /><span>Ganancia</span></div>
    {tip && <div className="tip cal-tip" style={{ left: tip.x, top: tip.y }}>
      <div className="tip-t">{longDate(tip.d.day)}</div>
      <div className="tip-r"><span>Día</span><b className={tone(tip.d.ret)}>{sPct(tip.d.ret, 2)}</b></div>
      <div className="tip-r"><span>Resultado</span><b className={tone(tip.d.pnl)}>{sEur(tip.d.pnl)}</b></div>
      <div className="tip-r"><span>Cierre</span><b>{eur(tip.d.eq)}</b></div>
    </div>}
  </div>;
}

/* ---------- Barras horizontales divergentes (HTML) ---------- */
export function DivergingBars({ rows }: { rows: { k: string; v: number; sub?: string }[] }) {
  const max = Math.max(0.01, ...rows.map(r => Math.abs(r.v)));
  return <ul className="dbars">{rows.map(r => <li key={r.k}>
    <div className="dbars-l"><b>{r.k}</b>{r.sub && <span>{r.sub}</span>}</div>
    <div className="dbars-t"><i className={r.v >= 0 ? "up" : "dn"} style={{ width: `${(Math.abs(r.v) / max) * 50}%` }} /></div>
    <em className={tone(r.v)}>{sEur(r.v)}</em>
  </li>)}</ul>;
}

export function HBars({ rows, fmt }: { rows: { k: string; v: number }[]; fmt: (v: number) => string }) {
  const max = Math.max(0.0001, ...rows.map(r => r.v)), total = rows.reduce((a, r) => a + r.v, 0);
  return <ul className="hbars">{rows.map(r => <li key={r.k}>
    <div className="hbars-l"><span>{r.k}</span><b>{fmt(r.v)}</b><em>{total ? pct(r.v / total, 0) : ""}</em></div>
    <div className="hbars-t"><i style={{ width: `${(r.v / max) * 100}%` }} /></div>
  </li>)}</ul>;
}

export { f2 };
