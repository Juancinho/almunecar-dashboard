// Genera public/mock.json (gitignored) con datos sintéticos y el mismo formato que escribe el box.
// Incluye los campos opcionales v2 (bench, fx_eurusd, rf, orders, bot, positions[].opened) para ver todo el panel.
// Uso: npm run mock  →  npm run dev  →  contraseña "mock"
import { writeFileSync } from "fs";

let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const p2 = n => String(n).padStart(2, "0");
const md = d => `${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const FX = 1.087;

const base = 1000, curve = [], bench = [], trades = [];
const end = new Date(2026, 9, 30); let day = new Date(2026, 6, 6), eq = base, idx = 100;
const syms = [["TIPX", "D2", "ETF", 24.1], ["SHYX", "D3", "ETF", 19.6], ["AAAA", "D1", "STK", 182], ["BBBB", "D1", "STK", 158], ["CCCC", "D1", "STK", 241], ["DDDD", "D1", "STK", 118]];
const reasons = ["Señal de entrada confirmada", "Stop dinámico alcanzado", "Objetivo alcanzado", "Tesis invalidada por datos de IPC", "Rotación hacia duración corta"];
while (day <= end) {
  if (day.getDay() % 6) {
    for (const hm of ["15:35", "18:00", "21:55"]) {
      const mkt = (rnd() - 0.485) * 0.009;                      // índice
      eq *= 1 + 0.45 * mkt + (rnd() - 0.47) * 0.004;            // cartera: beta ~0,45 + algo propio
      idx *= 1 + mkt;
      curve.push({ t: `${md(day)} ${hm}`, eq: +eq.toFixed(2) }); bench.push({ t: `${md(day)} ${hm}`, eq: +idx.toFixed(3) });
    }
    if (rnd() < 0.28) {
      const [s, th, , px] = syms[Math.floor(rnd() * syms.length)], price = +(px * (0.9 + rnd() * 0.2)).toFixed(2), qty = Math.max(1, Math.round(120 / price));
      const t = `${md(day)} ${p2(16 + Math.floor(rnd() * 5))}:${p2(Math.floor(rnd() * 60))}`;
      trades.push({ time: t, side: "BUY", qty, symbol: s, price, thesis: th, reason: reasons[0], cost: +(0.35 + rnd() * 0.6).toFixed(2), pnl_eur: null });
      const move = (rnd() - 0.42) * 0.09, exit = +(price * (1 + move)).toFixed(2);
      const out = new Date(day.getTime() + Math.floor(rnd() * (move < 0 ? 6 : 3)) * 864e5);  // las perdedoras tardan algo más
      trades.push({ time: `${md(out)} 21:4${Math.floor(rnd() * 9)}`, side: "SELL", qty, symbol: s, price: exit, thesis: th, reason: reasons[1 + Math.floor(rnd() * 4)], cost: +(0.35 + rnd() * 0.6).toFixed(2), pnl_eur: +((exit - price) * qty / FX).toFixed(2) });
    }
  }
  day = new Date(day.getTime() + 864e5);
}
const equity = curve.at(-1).eq;
const positions = [
  { symbol: "TIPX", kind: "ETF", thesis: "D2", qty: 12, entry: 24.12, last: 24.61, stop: 23.4, stop_type: "trailing", target: 26.2, pnl_eur: 5.43, opened: "2026-10-14 16:05" },
  { symbol: "SHYX", kind: "ETF", thesis: "D3", qty: 9, entry: 19.84, last: 19.71, stop: 19.2, stop_type: "fijo", target: 20.9, pnl_eur: -1.08, opened: "2026-10-23 15:52" },
  { symbol: "CCCC", kind: "STK", thesis: "D1", qty: 1, entry: 236.4, last: 244.9, stop: 224, stop_type: "trailing", target: 268, pnl_eur: 7.82, opened: "2026-10-02 17:31" },
];
const invested = positions.reduce((a, p) => a + p.qty * p.last / FX, 0);
writeFileSync(new URL("../public/mock.json", import.meta.url), JSON.stringify({
  updated: "30-10-2026 21:58 (hora de Madrid)", base, equity, cash: +(equity - invested).toFixed(2), fees_usd: +trades.reduce((a, t) => a + t.cost, 0).toFixed(2),
  halted: false, halt_reason: null, curve, positions, trades,
  plan: { date: "2026-10-30", candidates: ["TIPX", "SHYX"], skipped: [{ symbol: "AAAA", why: "sin señal" }, { symbol: "EEEE", why: "sin señal" }, { symbol: "FFFF", why: "sin señal" }, { symbol: "BBBB", why: "volatilidad excesiva" }, { symbol: "DDDD", why: "earnings en 48 h" }] },
  last_eval: { TIPX: { t: "2026-10-30T21:40:00", why: "Mantener: sin cambios" }, CCCC: { t: "2026-10-30T21:42:00", why: "Subir stop a 224" }, SHYX: { t: "2026-10-30T21:44:00", why: "Mantener" } },
  friction: { "Comisiones": 6.4, "Spread": 2.1, "Deslizamiento": 1.3, "Conversión EUR/USD": 0.9, "Total estimado (ida y vuelta)": 10.7, "Total cargado al libro": 10.7 },
  theses: { D1: "Ejemplo: renta variable cíclica de gran capitalización", D2: "Ejemplo: bonos ligados a la inflación", D3: "Ejemplo: duración corta del Tesoro", E1: "Ejemplo: mercado europeo — solo vigilancia" },
  // ---- v2 ----
  bench: { name: "IDX", curve: bench },
  fx_eurusd: FX, rf: 0.025,
  orders: [
    { symbol: "TIPX", side: "SELL", type: "TRAIL", qty: 12, price: 23.4, status: "Submitted", placed: "2026-10-14 16:05" },
    { symbol: "SHYX", side: "SELL", type: "STP", qty: 9, price: 19.2, status: "Submitted", placed: "2026-10-23 15:52" },
    { symbol: "CCCC", side: "SELL", type: "TRAIL", qty: 1, price: 224, status: "Submitted", placed: "2026-10-30 21:42" },
  ],
  bot: { last_run: "2026-10-30 21:55", next_run: "2026-10-31 15:35", status: "Mercado cerrado · esperando la apertura de NYSE", version: "1.4.2",
    errors: [{ t: "2026-10-29 16:02", msg: "Timeout de la API de IBKR (reintentado con éxito)" }] },
}, null, 1));
console.log(`mock.json: ${curve.length} puntos, ${trades.length} operaciones, equity ${equity}`);
