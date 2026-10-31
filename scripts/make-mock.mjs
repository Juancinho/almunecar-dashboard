// Genera public/mock.json (gitignored) con datos sintéticos y el mismo formato que escribe el box.
// Uso: npm run mock  →  npm run dev  →  contraseña "mock"
import { writeFileSync } from "fs";

let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const p2 = n => String(n).padStart(2, "0");
const md = d => `${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

const base = 1000, curve = [], trades = [];
const end = new Date(2026, 9, 30); let day = new Date(2026, 6, 6), eq = base;
const syms = [["TIPX", "D2", "ETF", 24.1], ["SHYX", "D3", "ETF", 19.6], ["AAAA", "D1", "STK", 182], ["BBBB", "D1", "STK", 158], ["CCCC", "D1", "STK", 241], ["DDDD", "D1", "STK", 118]];
const reasons = ["Señal de entrada confirmada", "Stop dinámico alcanzado", "Objetivo alcanzado", "Tesis invalidada por datos de IPC", "Rotación hacia duración corta"];
while (day <= end) {
  if (day.getDay() % 6) {
    for (const hm of ["15:35", "18:00", "21:55"]) { eq *= 1 + (rnd() - 0.47) * 0.008; curve.push({ t: `${md(day)} ${hm}`, eq: +eq.toFixed(2) }); }
    if (rnd() < 0.28) {
      const [s, th, , px] = syms[Math.floor(rnd() * syms.length)], price = +(px * (0.9 + rnd() * 0.2)).toFixed(2), qty = Math.max(1, Math.round(120 / price));
      const t = `${md(day)} ${p2(16 + Math.floor(rnd() * 5))}:${p2(Math.floor(rnd() * 60))}`;
      trades.push({ time: t, side: "BUY", qty, symbol: s, price, thesis: th, reason: reasons[0], cost: +(0.35 + rnd() * 0.6).toFixed(2), pnl_eur: null });
      const exit = +(price * (1 + (rnd() - 0.42) * 0.09)).toFixed(2);
      trades.push({ time: t.replace(/\d\d:\d\d$/, "21:4" + Math.floor(rnd() * 9)), side: "SELL", qty, symbol: s, price: exit, thesis: th, reason: reasons[1 + Math.floor(rnd() * 4)], cost: +(0.35 + rnd() * 0.6).toFixed(2), pnl_eur: +((exit - price) * qty * 0.92).toFixed(2) });
    }
  }
  day = new Date(day.getTime() + 864e5);
}
const equity = curve.at(-1).eq;
const positions = [
  { symbol: "TIPX", kind: "ETF", thesis: "D2", qty: 12, entry: 24.12, last: 24.61, stop: 23.4, stop_type: "trailing", target: 26.2, pnl_eur: 5.43 },
  { symbol: "SHYX", kind: "ETF", thesis: "D3", qty: 9, entry: 19.84, last: 19.71, stop: 19.2, stop_type: "fijo", target: 20.9, pnl_eur: -1.08 },
  { symbol: "CCCC", kind: "STK", thesis: "D1", qty: 1, entry: 236.4, last: 244.9, stop: 224, stop_type: "trailing", target: 268, pnl_eur: 7.82 },
];
const invested = positions.reduce((a, p) => a + p.qty * p.last * 0.92, 0);
writeFileSync(new URL("../public/mock.json", import.meta.url), JSON.stringify({
  updated: "30-10-2026 21:58 (hora de Madrid)", base, equity, cash: +(equity - invested).toFixed(2), fees_usd: +trades.reduce((a, t) => a + t.cost, 0).toFixed(2),
  halted: false, halt_reason: null, curve, positions, trades,
  plan: { date: "2026-10-30", candidates: ["TIPX", "SHYX"], skipped: [{ symbol: "AAAA", why: "sin señal" }, { symbol: "EEEE", why: "sin señal" }, { symbol: "FFFF", why: "sin señal" }, { symbol: "BBBB", why: "volatilidad excesiva" }, { symbol: "DDDD", why: "earnings en 48 h" }] },
  last_eval: { TIPX: { t: "2026-10-30T21:40:00", why: "Mantener: sin cambios" }, CCCC: { t: "2026-10-30T21:42:00", why: "Subir stop a 224" }, SHYX: { t: "2026-10-30T21:44:00", why: "Mantener" } },
  friction: { "Comisiones": 6.4, "Spread": 2.1, "Deslizamiento": 1.3, "Conversión EUR/USD": 0.9, "Total estimado (ida y vuelta)": 10.7, "Total cargado al libro": 10.7 },
  theses: { D1: "Ejemplo: renta variable cíclica de gran capitalización", D2: "Ejemplo: bonos ligados a la inflación", D3: "Ejemplo: duración corta del Tesoro", E1: "Ejemplo: mercado europeo — solo vigilancia" },
}, null, 1));
console.log(`mock.json: ${curve.length} puntos, ${trades.length} operaciones, equity ${equity}`);
