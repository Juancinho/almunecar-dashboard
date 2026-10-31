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
/** Instante real de una hora de pared de Madrid (el box escribe en hora de Madrid, el navegador puede estar en otra zona). */
export function madridEpoch(s: string): number | null {
  const m = iso(s).match(/^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}))?/); if (!m) return null;
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 12), +(m[5] ?? 0));
  const w = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })
    .formatToParts(new Date(guess)).map(x => [x.type, x.value]));
  const wall = Date.UTC(+w.year, +w.month - 1, +w.day, +w.hour % 24, +w.minute);
  return guess - (wall - guess);
}
const DAY = 864e5;
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
const mean = (a: number[]) => (a.length ? sum(a) / a.length : 0);
const std = (a: number[]) => { const m = mean(a); return Math.sqrt(mean(a.map(x => (x - m) ** 2))); };
const cov = (a: number[], b: number[]) => { const ma = mean(a), mb = mean(b); return mean(a.map((x, i) => (x - ma) * (b[i] - mb))); };
const ratioOrNull = (a: number, b: number) => (b ? a / b : null);

export interface CurvePt { t: string; ts: number; eq: number; dd: number; peak: number }
export interface DayRet { day: string; eq: number; ret: number; pnl: number }
export interface PosX extends Position { value: number; valueEur: number; weight: number; eqWeight: number; chg: number; toStop: number; toTarget: number; rr: number | null; progress: number; riskEur: number; rewardEur: number; holdDays: number | null }
export interface ThesisAgg { thesis: string; realized: number; unrealized: number; total: number; trades: number; exposure: number }
export interface Bin { lo: number; hi: number; n: number; label: string }
export type ClosedX = Trade & { pnl_eur: number; holdH: number | null; ts: number };

/** Histograma con un paso "redondo" para que las etiquetas se lean bien */
function bins(values: number[], steps: number[], fmt: (v: number) => string, target = 12): Bin[] {
  if (!values.length) return [];
  const lo = Math.min(...values), hi = Math.max(...values);
  const step = steps.find(s => (hi - lo) / s <= target) ?? steps[steps.length - 1];
  const start = Math.floor(lo / step) * step, n = Math.max(1, Math.ceil((hi - start) / step + 1e-9));
  const out: Bin[] = Array.from({ length: n }, (_, i) => ({ lo: start + i * step, hi: start + (i + 1) * step, n: 0, label: fmt(start + i * step) }));
  for (const v of values) out[Math.min(n - 1, Math.floor((v - start) / step + 1e-9))].n++;
  return out;
}

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
  const lastTs = curve[curve.length - 1].ts, firstTs = curve[0].ts;

  // ---------- Sesiones: cierre diario = último punto de la curva de cada día ----------
  const closes = new Map<string, number>();
  for (const p of raw) closes.set(p.t.slice(0, 10), p.eq);
  const daily: DayRet[] = []; let prev = d.base;
  for (const [day, eq] of closes) { daily.push({ day, eq, ret: eq / prev - 1, pnl: eq - prev }); prev = eq; }
  const rets = daily.map(x => x.ret);
  const rfD = (d.rf ?? 0) / 252;
  const enough = rets.length >= 5;
  const sd = std(rets);
  const vol = enough ? sd * Math.sqrt(252) : null;
  const sharpe = enough && sd > 0 ? ((mean(rets) - rfD) / sd) * Math.sqrt(252) : null;
  const downside = rets.filter(r => r < 0);
  const sortino = enough && downside.length > 1 ? ((mean(rets) - rfD) / Math.sqrt(mean(downside.map(r => r * r)))) * Math.sqrt(252) : null;
  const bestDay = daily.length ? daily.reduce((a, b) => (b.ret > a.ret ? b : a)) : null;
  const worstDay = daily.length ? daily.reduce((a, b) => (b.ret < a.ret ? b : a)) : null;
  const greenDays = daily.filter(x => x.ret > 0).length;

  // VaR / CVaR históricos al 95 % (1 sesión) y paramétrico
  const sorted = [...rets].sort((a, b) => a - b);
  const varOk = rets.length >= 20;
  const q = varOk ? sorted[Math.floor(0.05 * (sorted.length - 1))] : 0;
  const var95 = varOk ? Math.max(0, -q) : null;
  const cvar95 = varOk ? Math.max(0, -mean(sorted.filter(r => r <= q))) : null;
  const varParam = enough ? Math.max(0, 1.645 * sd - mean(rets)) : null;
  const retBins = bins(rets, [0.001, 0.0015, 0.002, 0.0025, 0.005, 0.01, 0.02, 0.05], v => `${(v * 100).toFixed(v === 0 ? 0 : 2).replace(".", ",")} %`, 14);

  // ---------- Rentabilidad por periodos ----------
  const eqAtDay = (pred: (day: string) => boolean) => { let v = d.base; for (const x of daily) if (pred(x.day)) v = x.eq; return v; };
  const eqAtTs = (ts: number) => { let v = d.base; for (const c of curve) { if (c.ts <= ts) v = c.eq; else break; } return v; };
  const lastDay = curve[curve.length - 1].t.slice(0, 10);
  const spanDays = (lastTs - firstTs) / DAY;
  const cagr = spanDays >= 90 ? Math.pow(d.equity / d.base, 365 / spanDays) - 1 : null;
  const periods = [
    { k: "Hoy", v: d.equity / eqAtDay(x => x < lastDay) - 1 },
    { k: "7 días", v: d.equity / eqAtTs(lastTs - 7 * DAY) - 1 },
    { k: "Mes", v: d.equity / eqAtDay(x => x < lastDay.slice(0, 7)) - 1 },
    { k: "30 días", v: d.equity / eqAtTs(lastTs - 30 * DAY) - 1 },
    { k: "90 días", v: d.equity / eqAtTs(lastTs - 91 * DAY) - 1 },
    { k: "Año", v: d.equity / eqAtDay(x => x < lastDay.slice(0, 4)) - 1 },
    { k: "Inicio", v: d.equity / d.base - 1 },
  ];
  const calmar = cagr != null && maxDD < 0 ? cagr / -maxDD : null;

  // Rentabilidad mensual (año × mes)
  const monthEnd = new Map<string, number>();
  for (const x of daily) monthEnd.set(x.day.slice(0, 7), x.eq);
  const years = new Map<string, { months: (number | null)[]; total: number }>();
  let pm = d.base, py = d.base, curY = "";
  for (const [ym, eq] of monthEnd) {
    const [y, mo] = ym.split("-");
    if (y !== curY) { if (curY) py = pm; curY = y; }
    const row = years.get(y) ?? years.set(y, { months: Array(12).fill(null), total: 0 }).get(y)!;
    row.months[+mo - 1] = eq / pm - 1; row.total = eq / py - 1; pm = eq;
  }
  const monthly = [...years.entries()].map(([year, r]) => ({ year, ...r })).reverse();

  // ---------- Operaciones ----------
  const trades = [...d.trades].map(t => ({ ...t, ts: parseT(t.time)?.getTime() ?? 0 })).sort((a, b) => a.ts - b.ts);
  // Emparejado FIFO compra→venta por valor para saber cuánto duró cada operación
  const lots = new Map<string, { qty: number; ts: number }[]>();
  const holdOf = new Map<number, number>();
  trades.forEach((t, i) => {
    const L = lots.get(t.symbol) ?? lots.set(t.symbol, []).get(t.symbol)!;
    if (t.side === "BUY") { L.push({ qty: Math.abs(t.qty), ts: t.ts }); return; }
    let left = Math.abs(t.qty), w = 0, acc = 0;
    while (left > 1e-9 && L.length) { const l = L[0], take = Math.min(left, l.qty); acc += take * l.ts; w += take; l.qty -= take; left -= take; if (l.qty <= 1e-9) L.shift(); }
    if (w > 0 && t.ts) holdOf.set(i, (t.ts - acc / w) / 36e5);
  });
  const closed: ClosedX[] = trades.flatMap((t, i) => (t.pnl_eur != null ? [{ ...t, pnl_eur: t.pnl_eur, holdH: holdOf.get(i) ?? null }] : []));
  const winsT = closed.filter(t => t.pnl_eur > 0), lossesT = closed.filter(t => t.pnl_eur < 0);
  const grossWin = sum(winsT.map(t => t.pnl_eur)), grossLoss = -sum(lossesT.map(t => t.pnl_eur));
  let acc = 0;
  const realizedSeries = closed.map((t, i) => ({ i: i + 1, symbol: t.symbol, time: t.time, pnl: t.pnl_eur, cum: (acc += t.pnl_eur), thesis: t.thesis, reason: t.reason }));
  let streak = 0;
  for (let i = closed.length - 1; i >= 0; i--) {
    const s = Math.sign(closed[i].pnl_eur); if (!s) break;
    if (streak === 0 || Math.sign(streak) === s) streak += s; else break;
  }
  let maxWinStreak = 0, maxLossStreak = 0, run = 0;
  for (const t of closed) { const s = Math.sign(t.pnl_eur); run = s && Math.sign(run) === s ? run + s : s; maxWinStreak = Math.max(maxWinStreak, run); maxLossStreak = Math.max(maxLossStreak, -run); }
  const holdAvg = (a: ClosedX[]) => { const h = a.map(t => t.holdH).filter((x): x is number => x != null); return h.length ? mean(h) : null; };
  const costs = sum(trades.map(t => t.cost ?? 0));
  const byReason = [...closed.reduce((m, t) => {
    const r = m.get(t.reason) ?? m.set(t.reason, { k: t.reason, n: 0, wins: 0, pnl: 0 }).get(t.reason)!; r.n++; r.pnl += t.pnl_eur; if (t.pnl_eur > 0) r.wins++; return m;
  }, new Map<string, { k: string; n: number; wins: number; pnl: number }>()).values()].sort((a, b) => b.n - a.n);
  const pnlBins = bins(closed.map(t => t.pnl_eur), [0.5, 1, 2, 2.5, 5, 10, 20, 25, 50, 100], v => `${Math.round(v * 10) / 10} €`, 12);

  // ---------- Posiciones y riesgo ----------
  const pnl = d.equity - d.base;
  const invested = Math.max(0, d.equity - d.cash);
  const valueOf = (p: Position) => Math.abs(p.qty * p.last);
  const totalVal = sum(d.positions.map(valueOf));
  // Precios en moneda del valor (USD); el equity en EUR. Sin fx_eurusd del bot se deduce de lo invertido.
  const fx = d.fx_eurusd ?? (invested > 1 && totalVal > 0 ? totalVal / invested : null);
  const fxSrc: "bot" | "implícito" | null = d.fx_eurusd ? "bot" : fx ? "implícito" : null;
  const toEur = (v: number) => (fx ? v / fx : v);
  const nowTs = madridEpoch(updated) ?? Date.now();
  const positions: PosX[] = d.positions.map(p => {
    const span = p.target - p.stop, risk = (p.last - p.stop) * p.qty, reward = (p.target - p.last) * p.qty;
    const op = p.opened ? madridEpoch(p.opened) : null;
    return { ...p, value: valueOf(p), valueEur: toEur(valueOf(p)), weight: totalVal ? valueOf(p) / totalVal : 0, eqWeight: d.equity > 0 ? toEur(valueOf(p)) / d.equity : 0,
      chg: p.entry ? p.last / p.entry - 1 : 0, toStop: p.last ? p.stop / p.last - 1 : 0, toTarget: p.last ? p.target / p.last - 1 : 0,
      rr: risk > 0 ? reward / risk : null, progress: span ? Math.max(0, Math.min(1, (p.last - p.stop) / span)) : 0.5,
      riskEur: toEur(risk), rewardEur: toEur(reward), holdDays: op ? Math.max(0, (nowTs - op) / DAY) : null };
  }).sort((a, b) => b.value - a.value);
  const unrealized = sum(d.positions.map(p => p.pnl_eur));
  const openRisk = sum(positions.map(p => Math.max(0, p.riskEur))), openReward = sum(positions.map(p => Math.max(0, p.rewardEur)));
  const halt = d.base * 0.7;
  const effN = positions.length ? 1 / sum(positions.map(p => p.weight ** 2)) : 0;

  // Por tesis
  const th = new Map<string, ThesisAgg>();
  const get = (k: string) => th.get(k) ?? th.set(k, { thesis: k, realized: 0, unrealized: 0, total: 0, trades: 0, exposure: 0 }).get(k)!;
  for (const t of closed) { const a = get(t.thesis); a.realized += t.pnl_eur; a.trades++; }
  for (const p of positions) { const a = get(p.thesis); a.unrealized += p.pnl_eur; a.exposure += p.eqWeight; }
  const byThesis = [...th.values()].map(a => ({ ...a, total: a.realized + a.unrealized })).sort((a, b) => b.total - a.total);

  // Por valor
  const bySymbol = [...new Set(trades.map(t => t.symbol).concat(positions.map(p => p.symbol)))].map(s => {
    const c = closed.filter(t => t.symbol === s);
    return { symbol: s, n: trades.filter(t => t.symbol === s).length, closed: c.length, wins: c.filter(t => t.pnl_eur > 0).length,
      pnl: sum(c.map(t => t.pnl_eur)), hold: holdAvg(c), open: positions.find(p => p.symbol === s) ?? null, thesis: c[0]?.thesis ?? positions.find(p => p.symbol === s)?.thesis ?? "" };
  }).sort((a, b) => b.pnl + (b.open?.pnl_eur ?? 0) - (a.pnl + (a.open?.pnl_eur ?? 0)));

  // ---------- Índice de referencia: alpha, beta… ----------
  // Índices de referencia: el principal (d.bench, MSCI ACWI en EUR) y los secundarios (d.bench.secondary)
  type BenchM = {
    name: string; series: { t: string; p: number; b: number; ex: number }[]; totalP: number; totalB: number; n: number;
    beta: number | null; alpha: number | null; corr: number | null; te: number | null; ir: number | null; upCap: number | null; downCap: number | null;
  };
  const benchOf = (src: { name: string; curve: { t: string; eq: number }[] }): BenchM | null => {
    if (src.curve.length < 2) return null;
    const bAt = new Map(src.curve.map(p => [iso(p.t), p.eq]));
    const both = curve.filter(c => bAt.has(c.t));
    if (both.length < 2) return null;
    const p0 = both[0].eq, b0 = bAt.get(both[0].t)!;
    const series = both.map(c => { const p = (c.eq / p0) * 100, b = (bAt.get(c.t)! / b0) * 100; return { t: c.t, p, b, ex: p - b }; });
    const bDay = new Map<string, number>(); for (const s of series) bDay.set(s.t.slice(0, 10), s.b);
    const pDay = new Map<string, number>(); for (const s of series) pDay.set(s.t.slice(0, 10), s.p);
    const days = [...pDay.keys()], rp: number[] = [], rb: number[] = [];
    for (let i = 1; i < days.length; i++) { rp.push(pDay.get(days[i])! / pDay.get(days[i - 1])! - 1); rb.push(bDay.get(days[i])! / bDay.get(days[i - 1])! - 1); }
    const ok = rp.length >= 10, vb = std(rb) ** 2;
    const beta = ok && vb > 0 ? cov(rp, rb) / vb : null;
    const ex = rp.map((r, i) => r - rb[i]), te = ok ? std(ex) * Math.sqrt(252) : null;
    const up = rb.map((r, i) => [r, rp[i]]).filter(x => x[0] > 0), dn = rb.map((r, i) => [r, rp[i]]).filter(x => x[0] < 0);
    const last = series[series.length - 1];
    return { name: src.name, series, totalP: last.p / 100 - 1, totalB: last.b / 100 - 1, n: rp.length, beta,
      alpha: beta != null ? (mean(rp) - rfD - beta * (mean(rb) - rfD)) * 252 : null,
      corr: ok && std(rp) > 0 && std(rb) > 0 ? cov(rp, rb) / (std(rp) * std(rb)) : null,
      te, ir: te ? (mean(ex) * 252) / te : null,
      upCap: ok && up.length ? ratioOrNull(mean(up.map(x => x[1])), mean(up.map(x => x[0]))) : null,
      downCap: ok && dn.length ? ratioOrNull(mean(dn.map(x => x[1])), mean(dn.map(x => x[0]))) : null };
  };
  const benches = d.bench ? [d.bench, ...(d.bench.secondary ?? [])].map(benchOf).filter((x): x is BenchM => x != null) : [];
  const bench = d.bench && benches[0]?.name === d.bench.name ? benches[0] : null;

  return {
    pnl, ret: pnl / d.base, invested, exposure: d.equity > 0 ? invested / d.equity : 0, halt,
    cushion: d.equity - halt, haltUsed: Math.max(0, Math.min(1, (d.base - d.equity) / (d.base - halt))),
    curve, peakEq, troughEq, maxDD, curDD, daily, vol, sharpe, sortino, calmar, cagr, bestDay, worstDay, greenDays,
    var95, cvar95, varParam, retBins, periods, monthly, spanDays,
    trades, closed, wins: winsT.length, losses: lossesT.length, winRate: closed.length ? winsT.length / closed.length : null,
    avgWin: winsT.length ? grossWin / winsT.length : null, avgLoss: lossesT.length ? -grossLoss / lossesT.length : null,
    payoff: winsT.length && lossesT.length ? (grossWin / winsT.length) / (grossLoss / lossesT.length) : null,
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : null,
    expectancy: closed.length ? (grossWin - grossLoss) / closed.length : null,
    best: closed.length ? Math.max(...closed.map(t => t.pnl_eur)) : null, worst: closed.length ? Math.min(...closed.map(t => t.pnl_eur)) : null,
    realized: grossWin - grossLoss, grossWin, realizedSeries, streak, maxWinStreak, maxLossStreak, costs,
    holdWin: holdAvg(winsT), holdLoss: holdAvg(lossesT), holdAll: holdAvg(closed),
    feesEur: fx ? d.fees_usd / fx : null, costRatio: fx && grossWin > 0 ? d.fees_usd / fx / grossWin : null,
    byReason, pnlBins, bySymbol,
    positions, unrealized, byThesis, fx, fxSrc, openRisk, openReward, stopEq: d.equity - openRisk, targetEq: d.equity + openReward, effN,
    maxWeight: positions.length ? Math.max(...positions.map(p => p.eqWeight)) : 0,
    bench, benches,
    // Las claves "Total …" son resúmenes que escribe el box, no componentes
    friction: Object.entries(d.friction).filter(([k]) => !/^total/i.test(k)).map(([k, v]) => ({ k, v })).sort((a, b) => b.v - a.v),
    frictionTotals: Object.entries(d.friction).filter(([k]) => /^total/i.test(k)).map(([k, v]) => ({ k, v })),
    // Reparto del equity en EUR: lo invertido se divide según el peso de mercado de cada posición
    allocation: [
      ...positions.map(p => ({ name: p.symbol, w: d.equity > 0 ? (invested / d.equity) * p.weight : 0, pnl: p.pnl_eur as number | null })),
      { name: "Caja", w: d.equity > 0 ? Math.max(0, d.cash) / d.equity : 1, pnl: null },
    ],
    updated, updatedTs: madridEpoch(updated), data: d,
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
export const dur = (h: number | null) => (h == null ? "—" : h < 1 ? `${Math.max(1, Math.round(h * 60))} min` : h < 48 ? `${n1.format(h)} h` : `${n1.format(h / 24)} d`);
export const ago = (ms: number) => { const m = Math.max(0, Math.round(ms / 6e4)); return m < 1 ? "ahora" : m < 60 ? `hace ${m} min` : m < 48 * 60 ? `hace ${Math.round(m / 60)} h` : `hace ${Math.round(m / 1440)} d`; };
const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
export const MONTHS = MES;
export const shortDate = (s: string) => { const d = parseT(s); return d ? `${d.getDate()} ${MES[d.getMonth()]}` : s; };
export const longDate = (s: string) => { const d = parseT(s); const t = iso(s); return d ? `${d.getDate()} ${MES[d.getMonth()]} ${d.getFullYear()}${t.length > 10 ? ` · ${t.slice(11, 16)}` : ""}` : s; };
export const hhmm = (s: string) => { const t = iso(s); return t.length > 10 ? t.slice(11, 16) : t; };
