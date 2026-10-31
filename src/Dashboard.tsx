import { ResponsiveContainer, ComposedChart, Line, Area, XAxis, YAxis, ReferenceLine, Tooltip, CartesianGrid } from "recharts";
import type { Data } from "./types";
const C = { navy: "#1F3A5F", gold: "#B07D3A", red: "#7A3E3E", green: "#3E6B5A", grey: "#9AA5B1", rule: "#E3E7EC" };
const f2 = (v: number) => v.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const eur = (v: number) => f2(v) + " €", usd = (v: number) => f2(v) + " $";
const sg = (v: number) => (v >= 0 ? "pos" : "neg");

export default function Dashboard({ d }: { d: Data }) {
  const pnl = d.equity - d.base, dd = Math.max(0, 1 - d.equity / d.base);
  const curve = d.curve.length ? d.curve : [{ t: d.updated.slice(0, 16), eq: d.equity }];
  const lo = Math.min(680, ...curve.map(c => c.eq)), hi = Math.max(1060, ...curve.map(c => c.eq));
  return (<>
    <header><img src="./logo.svg" alt="" /><div><h1>Dashboard de Almuñécar Capital</h1>
      <div className="sub">Bot de inversión · cuenta de simulación · libro virtual de {eur(d.base)}</div></div>
      <div className="upd">Actualizado<br /><b>{d.updated}</b></div></header>
    <main>
      {d.halted && <div className="halted">TRADING DETENIDO — {d.halt_reason}</div>}
      <section className="kpis">
        <Kpi l="Equity virtual" v={eur(d.equity)} /><Kpi l="Resultado" v={(pnl >= 0 ? "+" : "") + eur(pnl)} c={sg(pnl)} />
        <Kpi l="Caja" v={eur(d.cash)} /><Kpi l="Costes pagados" v={usd(d.fees_usd)} />
      </section>
      <h2>Equity virtual frente a {eur(d.base)}</h2>
      <div className="chart"><ResponsiveContainer width="100%" height={260}>
        <ComposedChart data={curve} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={C.rule} vertical={false} />
          <XAxis dataKey="t" tick={{ fontSize: 11, fill: "#6B7280" }} minTickGap={40} />
          <YAxis domain={[lo, hi]} tick={{ fontSize: 11, fill: "#6B7280" }} width={48} />
          <Tooltip formatter={(v: number) => eur(v)} />
          <ReferenceLine y={d.base} stroke={C.gold} strokeDasharray="4 4" label={{ value: "1.000 € de partida", position: "insideTopRight", fontSize: 11, fill: C.gold }} />
          <ReferenceLine y={d.base * 0.7} stroke={C.red} label={{ value: "700 € · freno", position: "insideBottomRight", fontSize: 11, fill: C.red }} />
          <Area dataKey="eq" stroke="none" fill={C.navy} fillOpacity={0.06} isAnimationActive={false} />
          <Line dataKey="eq" stroke={C.navy} strokeWidth={2.2} dot={curve.length < 3} isAnimationActive={false} />
        </ComposedChart></ResponsiveContainer></div>
      <h2>Distancia al freno del −30 %</h2>
      <div className="gauge"><div className="fill" style={{ width: `${Math.min(100, dd / 0.3 * 100)}%` }} /></div>
      <div className="gauge-l"><span>{eur(d.base)}</span><span>caída actual {(dd * 100).toFixed(1)} % de 30 %</span><span>700 € · halt y check-in</span></div>
      <h2>Posiciones abiertas</h2>
      <Table h={["Valor", "Tesis", "Cant.", "Entrada", "Último", "Stop", "Objetivo", "P&L"]} rows={d.positions.map(p => {
        const pc = (v: number) => Math.max(0, Math.min(100, (v - p.stop) / (p.target - p.stop) * 100));
        return [<><b>{p.symbol}</b> <span className="note">{p.kind}</span><div className="stopbar"><i style={{ left: pc(p.entry) + "%", background: C.grey }} /><i style={{ left: pc(p.last) + "%", background: C.navy }} /></div></>,
          <span className="tag">{p.thesis}</span>, p.qty, p.entry, p.last, <>{p.stop}<div className="note">{p.stop_type}</div></>, p.target,
          <span className={sg(p.pnl_eur)}>{eur(p.pnl_eur)}</span>];
      })} />
      <h2>Plan del día</h2>
      {d.plan ? <><p className="note">{d.plan.date} · candidatos: {d.plan.candidates.join(", ") || "ninguno"}</p>
        <Table h={["Valor", "Descartado porque"]} rows={d.plan.skipped.map(s => [s.symbol, s.why])} /></> : <p className="empty">Sin plan.</p>}
      {d.last_eval && Object.keys(d.last_eval).length > 0 && <><h2>Última evaluación intradía</h2>
        <Table h={["Valor", "Hora", "Motivo"]} rows={Object.entries(d.last_eval).map(([s, e]) => [s, e.t.slice(11, 16), e.why])} /></>}
      <h2>Registro de operaciones</h2>
      <Table h={["Fecha", "Operación", "Tesis", "Motivo", "Coste est.", "P&L"]} rows={d.trades.map(t => [t.time,
        `${t.side === "BUY" ? "Compra" : "Venta"} ${t.qty} ${t.symbol} @ ${t.price}`, <span className="tag">{t.thesis}</span>,
        <span className="note">{t.reason}</span>, t.cost != null ? usd(t.cost) : "", t.pnl_eur != null ? <span className={sg(t.pnl_eur)}>{eur(t.pnl_eur)}</span> : ""])} />
      <h2>Fricción</h2>
      <Table h={["Concepto", "USD"]} rows={Object.entries(d.friction).map(([k, v]) => [k, usd(v)])} />
      <footer>Datos: ledger del bot y API de IBKR (cuenta de simulación). Sin recomendación de inversión.<br />
        {Object.entries(d.theses).map(([k, v]) => <div key={k}><b>{k}</b>: {v}</div>)}</footer>
    </main></>);
}
function Kpi({ l, v, c }: { l: string; v: string; c?: string }) { return <div className="kpi"><div className="l">{l}</div><div className={"v " + (c ?? "")}>{v}</div></div>; }
function Table({ h, rows }: { h: string[]; rows: React.ReactNode[][] }) {
  if (!rows.length) return <p className="empty">Ninguna todavía.</p>;
  return <div className="tw"><table><thead><tr>{h.map(x => <th key={x}>{x}</th>)}</tr></thead>
    <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={typeof c === "number" ? "n" : ""}>{c}</td>)}</tr>)}</tbody></table></div>;
}
