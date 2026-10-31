// Métricas derivadas en el navegador a partir del contrato de datos (types.ts). Nada de esto viaja al box.
import type { Data, Position, Trade } from "./types";

// El box escribe varias formas de fecha: "31-10-2026 17:32 (hora de Madrid)", "10-31 17:23" (sin año), ISO…
// Todo se normaliza a "AAAA-MM-DD HH:MM". Para "MM-DD" el año sale de `updated`.
let REF = new Date();
const p2 = (n: number | string) => String(n).padStart(2, "0");
export function iso(s: string): string {
  const hm = (h?: string, m?: string) => (h ? ` ${p2(h)}:${m}` : "");
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (m) return `${m[1]}-${p2(m[2])}-${p2(m[3])}${hm(m[4], m[5])}`;
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (m) return `${m[3]}-${p2(m[2])}-${p2(m[1])}${hm(m[4], m[5])}`;
  m = s.match(/^(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (m) { const mo = +m[1], y = REF.getFullYear() - (mo > REF.getMonth() + 1 ? 1 : 0); return `${y}-${p2(mo)}-${p2(m[2])}${hm(m[3], m[4])}`; }
  return s;
}
export const parseT = (s: string) => { const t = iso(s); const d = new Date(t.length > 10 ? t.replace(" ", "T") : t + "T12:00"); return isNaN(+d) ? null : d; };
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
const mean = (a: number[]) => (a.length ? sum(a) / a.length : 0);
const std = (a: number[]) => { const m = mean(a); return Math.sqrt(mean(a.map(x => (x - m) ** 2))); };

export interface CurvePt { t: string; ts: number; eq: number; dd: number; peak: number }
export interface DayRet { day: string; eq: number; ret: number; pnl: number }
export interface PosX extends Position { value: number; weight: number; chg: number; toStop: number; toTarget: number; rr: number | null; progress: number }
export interface ThesisAgg { thesis: string; realized: number; unrealized: number; total: number; trades: number }

export function compute(src: Data) {
  REF = parseT(src.updated) ?? new Date();
  const updated = iso(src.updated);
  const d: Data = { ...src, curve: src.curve.map(p => ({ ...p, t: iso(p.t) })), trades: src.trades.map(t => ({ ...t, time: iso(t.time) })) };
  const raw = d.curve.length ? d.curve : [{ t: updated, eq: d.equity }];
  let peak = d.base;
  const curve: CurvePt[] = raw.map((p, i) => {
    peak = Math.max(peak, p.eq);
    return { t: p.t, ts: parseT(p.t)?.getTime() ?? i, eq: p.eq, dd: p.eq / peak - 1, peak };
  });
  const peakEq = Math.max(d.base, ...curve.map(c => c.eq));
  const troughEq = Math.min(d.base, ...curve.map(c => c.eq));
  const maxDD = Math.min(0, ...curve.map(c => c.dd));
  const curDD = d.equity / peakEq - 1;

  // Cierre diario = último punto de la curva de cada día
  const closes = new Map<string, number>();
  for (const p of raw) closes.set(p.t.slice(0, 10), p.eq);
  const daily: DayRet[] = []; let prev = d.base;
  for (const [day, eq] of closes) { daily.push({ day, eq, ret: eq / prev - 1, pnl: eq - prev }); prev = eq; }
  const rets = daily.map(x => x.ret);
  const enough = rets.length >= 5;
  const vol = enough ? std(rets) * Math.sqrt(252) : null;
  const sharpe = enough && std(rets) > 0 ? (mean(rets) / std(rets)) * Math.sqrt(252) : null;
  const downside = rets.filter(r => r < 0);
  const sortino = enough && downside.length > 1 && std(downside) > 0 ? (mean(rets) / Math.sqrt(mean(downside.map(r => r * r)))) * Math.sqrt(252) : null;
  const bestDay = daily.length ? daily.reduce((a, b) => (b.ret > a.ret ? b : a)) : null;
  const worstDay = daily.length ? daily.reduce((a, b) => (b.ret < a.ret ? b : a)) : null;
  const greenDays = daily.filter(x => x.ret > 0).length;

  // Operaciones: cronológicas para acumulados
  const trades = [...d.trades].sort((a, b) => (parseT(a.time)?.getTime() ?? 0) - (parseT(b.time)?.getTime() ?? 0));
  const closed = trades.filter((t): t is Trade & { pnl_eur: number } => t.pnl_eur != null);
  const wins = closed.filter(t => t.pnl_eur > 0), losses = closed.filter(t => t.pnl_eur < 0);
  const grossWin = sum(wins.map(t => t.pnl_eur)), grossLoss = -sum(losses.map(t => t.pnl_eur));
  let acc = 0;
  const realizedSeries = closed.map((t, i) => ({ i: i + 1, label: `${t.symbol} · ${t.time.slice(0, 10)}`, symbol: t.symbol, time: t.time, pnl: t.pnl_eur, cum: (acc += t.pnl_eur), thesis: t.thesis, reason: t.reason }));
  let streak = 0;
  for (let i = closed.length - 1; i >= 0; i--) {
    const s = Math.sign(closed[i].pnl_eur); if (!s) break;
    if (streak === 0 || Math.sign(streak) === s) streak += s; else break;
  }
  const costs = sum(trades.map(t => t.cost ?? 0));

  // Posiciones
  const value = (p: Position) => Math.abs(p.qty * p.last);
  const totalVal = sum(d.positions.map(value));
  const positions: PosX[] = d.positions.map(p => {
    const risk = p.last - p.stop, reward = p.target - p.last;
    const span = p.target - p.stop;
    return { ...p, value: value(p), weight: totalVal ? value(p) / totalVal : 0, chg: p.entry ? p.last / p.entry - 1 : 0,
      toStop: p.last ? p.stop / p.last - 1 : 0, toTarget: p.last ? p.target / p.last - 1 : 0,
      rr: risk > 0 ? reward / risk : null, progress: span ? Math.max(0, Math.min(1, (p.last - p.stop) / span)) : 0.5 };
  }).sort((a, b) => b.value - a.value);
  const unrealized = sum(d.positions.map(p => p.pnl_eur));

  // Por tesis
  const th = new Map<string, ThesisAgg>();
  const get = (k: string) => th.get(k) ?? th.set(k, { thesis: k, realized: 0, unrealized: 0, total: 0, trades: 0 }).get(k)!;
  for (const t of closed) { const a = get(t.thesis); a.realized += t.pnl_eur; a.trades++; }
  for (const p of d.positions) get(p.thesis).unrealized += p.pnl_eur;
  const byThesis = [...th.values()].map(a => ({ ...a, total: a.realized + a.unrealized })).sort((a, b) => b.total - a.total);

  const pnl = d.equity - d.base;
  const invested = Math.max(0, d.equity - d.cash);
  const halt = d.base * 0.7;
  return {
    pnl, ret: pnl / d.base, invested, exposure: d.equity > 0 ? invested / d.equity : 0, halt,
    cushion: d.equity - halt, haltUsed: Math.max(0, Math.min(1, (d.base - d.equity) / (d.base - halt))),
    curve, peakEq, troughEq, maxDD, curDD, daily, vol, sharpe, sortino, bestDay, worstDay, greenDays,
    trades, closed, wins: wins.length, losses: losses.length, winRate: closed.length ? wins.length / closed.length : null,
    avgWin: wins.length ? grossWin / wins.length : null, avgLoss: losses.length ? -grossLoss / losses.length : null,
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : null,
    expectancy: closed.length ? (grossWin - grossLoss) / closed.length : null,
    best: closed.length ? Math.max(...closed.map(t => t.pnl_eur)) : null, worst: closed.length ? Math.min(...closed.map(t => t.pnl_eur)) : null,
    realized: grossWin - grossLoss, realizedSeries, streak, costs, positions, unrealized, byThesis,
    // Las claves "Total …" son resúmenes que escribe el box, no componentes
    friction: Object.entries(d.friction).filter(([k]) => !/^total/i.test(k)).map(([k, v]) => ({ k, v })).sort((a, b) => b.v - a.v),
    frictionTotals: Object.entries(d.friction).filter(([k]) => /^total/i.test(k)).map(([k, v]) => ({ k, v })),
    // Reparto del equity en EUR: lo invertido se divide según el peso de mercado de cada posición
    allocation: [
      ...positions.map(p => ({ name: p.symbol, w: d.equity > 0 ? (invested / d.equity) * p.weight : 0, pnl: p.pnl_eur as number | null })),
      { name: "Caja", w: d.equity > 0 ? Math.max(0, d.cash) / d.equity : 1, pnl: null },
    ],
    updated, data: d,
  };
}
export type Metrics = ReturnType<typeof compute>;

// Formato es-ES
const nf = (min: number, max = min) => new Intl.NumberFormat("es-ES", { minimumFractionDigits: min, maximumFractionDigits: max });
const n2 = nf(2), n1 = nf(1), n0 = nf(0);
export const f2 = (v: number) => n2.format(v);
export const eur = (v: number) => `${n2.format(v)} €`;
export const eur0 = (v: number) => `${n0.format(v)} €`;
export const usd = (v: number) => `${n2.format(v)} $`;
export const sEur = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${n2.format(Math.abs(v))} €`;
export const pct = (v: number, d = 1) => `${(d === 1 ? n1 : nf(d)).format(v * 100)} %`;
export const sPct = (v: number, d = 1) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${pct(Math.abs(v), d)}`;
export const num = (v: number | null, d = 2) => (v == null ? "—" : !isFinite(v) ? "∞" : nf(d).format(v));
export const tone = (v: number | null | undefined) => (v == null || v === 0 ? "" : v > 0 ? "pos" : "neg");
const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
export const shortDate = (s: string) => { const d = parseT(s); return d ? `${d.getDate()} ${MES[d.getMonth()]}` : s; };
export const longDate = (s: string) => { const d = parseT(s); return d ? `${d.getDate()} ${MES[d.getMonth()]} ${d.getFullYear()}${s.length > 10 ? ` · ${s.slice(11, 16)}` : ""}` : s; };
