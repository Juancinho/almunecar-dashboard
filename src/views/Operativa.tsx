import { useMemo, useState } from "react";
import { dur, f2, longDate, num, pct, sEur, tone, usd } from "../metrics";
import { Histogram, Ring, TradePnlChart } from "../charts";
import { Card, Empty, Icon, Seg, Stat } from "../ui";
import type { ViewProps } from "./shared";

function downloadCsv(rows: (string | number | null)[][], name: string) {
  const esc = (v: string | number | null) => v == null ? "" : /[;"\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v);
  const blob = new Blob(["﻿" + rows.map(r => r.map(esc).join(";")).join("\n")], { type: "text/csv;charset=utf-8" });
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: name });
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export default function Operativa({ m, open }: ViewProps) {
  const [side, setSide] = useState<"ALL" | "BUY" | "SELL">("ALL");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState(15);
  const log = useMemo(() => [...m.trades].reverse().filter(t => (side === "ALL" || t.side === side) &&
    (!q || `${t.symbol} ${t.thesis} ${t.reason}`.toLowerCase().includes(q.toLowerCase()))), [m.trades, side, q]);
  const maxReason = Math.max(0.01, ...m.byReason.map(r => Math.abs(r.pnl)));
  const has = m.closed.length > 0;

  return <div className="grid">
    <Card title="Resultado por operación" icon="pulse" sub="P&L realizado de cada cierre y su acumulado" className="span-8 rise"
      right={has ? <div className="lgd"><span><i className="sw pos" />Ganancia</span><span><i className="sw neg" />Pérdida</span><span><i className="ln" />Acumulado</span></div> : undefined}>
      {has ? <TradePnlChart data={m.realizedSeries} height={360} /> : <Empty icon="pulse" title="Aún no hay operaciones cerradas">El gráfico se dibuja con el primer cierre del bot.</Empty>}
    </Card>
    <Card title="Calidad de la operativa" icon="target" className="span-4 rise">
      <div className="quality">
        <Ring value={m.winRate} label={m.winRate == null ? "—" : pct(m.winRate, 0)} sub="acierto" />
        <div className="q-side">
          <div title="Ganancias brutas / pérdidas brutas. Por encima de 1,5 es sólido."><span>Profit factor</span><b>{num(m.profitFactor)}</b></div>
          <div title="Resultado medio por operación cerrada"><span>Esperanza / op.</span><b className={tone(m.expectancy)}>{m.expectancy == null ? "—" : sEur(m.expectancy)}</b></div>
        </div>
      </div>
      <dl className="stats">
        <Stat k="Ganancia media" v={m.avgWin == null ? "—" : sEur(m.avgWin)} c="pos" />
        <Stat k="Pérdida media" v={m.avgLoss == null ? "—" : sEur(m.avgLoss)} c="neg" />
        <Stat k="Payoff" v={num(m.payoff)} help="Ganancia media / pérdida media. Con un acierto del 40 %, hace falta más de 1,5." />
        <Stat k="Acierto mínimo" v={m.payoff ? pct(1 / (1 + m.payoff), 0) : "—"} help="Tasa de acierto con la que, a este payoff, se queda en tablas." />
        <Stat k="Mejor / peor" v={m.best == null ? "—" : <><span className="pos">{sEur(m.best)}</span> <span className="neg">{sEur(m.worst!)}</span></>} />
        <Stat k="Rachas máx." v={has ? <><span className="pos">{m.maxWinStreak}G</span> · <span className="neg">{m.maxLossStreak}P</span></> : "—"} sub={m.streak ? `Actual: ${Math.abs(m.streak)} ${m.streak > 0 ? "ganadoras" : "perdedoras"}` : undefined} />
        <Stat k="Duración ganadoras" v={dur(m.holdWin)} help="Tiempo medio entre la compra y la venta (emparejado FIFO)" />
        <Stat k="Duración perdedoras" v={dur(m.holdLoss)} help="Si las perdedoras duran mucho más que las ganadoras, el bot deja correr pérdidas" />
        <Stat k="Costes / beneficio bruto" v={m.costRatio == null ? "—" : pct(m.costRatio)} help="Qué parte de las ganancias brutas se lleva la fricción (comisiones, spread…)" />
        <Stat k="Coste medio / orden" v={m.trades.length && m.costs ? usd(m.costs / m.trades.length) : "—"} />
      </dl>
    </Card>

    <Card title="Por motivo de cierre" icon="flag" sub="Cómo terminan las operaciones y cuánto deja cada salida" className="span-6 rise">
      {m.byReason.length ? <ul className="reasons">{m.byReason.map(r => <li key={r.k}>
        <div className="reasons-l"><b>{r.k}</b><span>{r.n} {r.n === 1 ? "cierre" : "cierres"} · {pct(r.wins / r.n, 0)} acierto</span></div>
        <div className="dbars-t"><i className={r.pnl >= 0 ? "up" : "dn"} style={{ width: `${(Math.abs(r.pnl) / maxReason) * 50}%` }} /></div>
        <em className={tone(r.pnl)}>{sEur(r.pnl)}</em>
      </li>)}</ul> : <Empty icon="flag" title="Sin cierres todavía" />}
    </Card>
    <Card title="Distribución de resultados" icon="hist" sub="Cuántas operaciones cerraron en cada tramo de euros" className="span-6 rise">
      {m.closed.length >= 3 ? <Histogram data={m.pnlBins} unit={b => `${f2(b.lo)} € a ${f2(b.hi)} €`} height={240} />
        : <Empty icon="hist" title="Hacen falta más cierres">El histograma aparece con 3 operaciones cerradas o más.</Empty>}
    </Card>

    <Card title="Por valor" icon="layers" sub="Rendimiento de cada símbolo operado · toca una fila para ver su ficha" className="span-12 rise">
      {m.bySymbol.length ? <div className="tw"><table>
        <thead><tr><th>Valor</th><th>Tesis</th><th className="n">Órdenes</th><th className="n">Cerradas</th><th className="n">Acierto</th><th className="n">Duración media</th><th className="n">Realizado</th><th className="n">Abierto</th></tr></thead>
        <tbody>{m.bySymbol.map(s => <tr key={s.symbol} className="click" onClick={() => open(s.symbol)}>
          <td><b>{s.symbol}</b>{s.open && <span className="dot-open" title="Posición abierta" />}</td>
          <td>{s.thesis && <span className="code sm">{s.thesis}</span>}</td>
          <td className="n">{s.n}</td><td className="n">{s.closed}</td>
          <td className="n">{s.closed ? pct(s.wins / s.closed, 0) : "—"}</td>
          <td className="n muted">{dur(s.hold)}</td>
          <td className={`n ${tone(s.pnl)}`}>{s.closed ? sEur(s.pnl) : "—"}</td>
          <td className={`n ${tone(s.open?.pnl_eur)}`}>{s.open ? sEur(s.open.pnl_eur) : "—"}</td>
        </tr>)}</tbody></table></div> : <Empty icon="layers" title="Aún no se ha operado ningún valor" />}
    </Card>

    <Card title="Registro de operaciones" icon="list" sub={`${m.trades.length} en total`} className="span-12 rise"
      right={m.trades.length ? <div className="log-ctl">
        <label className="search"><Icon n="search" s={15} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar valor, tesis o motivo" /></label>
        <Seg label="Lado" value={side} onChange={setSide} options={[{ v: "ALL", l: "Todas" }, { v: "BUY", l: "Compras" }, { v: "SELL", l: "Ventas" }]} />
        <button className="ibtn" title="Descargar CSV" aria-label="Descargar CSV" onClick={() => downloadCsv([["Fecha", "Lado", "Valor", "Cantidad", "Precio", "Tesis", "Motivo", "Coste USD", "P&L EUR"],
          ...log.map(t => [t.time, t.side, t.symbol, t.qty, t.price, t.thesis, t.reason, t.cost, t.pnl_eur])], "operaciones.csv")}><Icon n="download" /></button>
      </div> : undefined}>
      {m.trades.length ? <div className="tw"><table>
        <thead><tr><th>Fecha</th><th>Operación</th><th className="n">Cant.</th><th className="n">Precio</th><th>Tesis</th><th>Motivo</th><th className="n">Coste est.</th><th className="n">P&L</th></tr></thead>
        <tbody>{log.slice(0, rows).map((t, i) => <tr key={i} className="click" onClick={() => open(t.symbol)}>
          <td className="nowrap muted">{longDate(t.time)}</td>
          <td><span className={`side ${t.side === "BUY" ? "buy" : "sell"}`}>{t.side === "BUY" ? "Compra" : "Venta"}</span> <b>{t.symbol}</b></td>
          <td className="n">{t.qty}</td><td className="n">{f2(t.price)}</td>
          <td><span className="code sm">{t.thesis}</span></td>
          <td className="reason">{t.reason}</td>
          <td className="n muted">{t.cost != null ? usd(t.cost) : "—"}</td>
          <td className={`n ${tone(t.pnl_eur)}`}>{t.pnl_eur != null ? sEur(t.pnl_eur) : "—"}</td>
        </tr>)}
          {!log.length && <tr><td colSpan={8} className="muted center">Nada coincide con el filtro.</td></tr>}</tbody>
      </table>{log.length > rows && <button className="more" onClick={() => setRows(r => r + 30)}>Mostrar {Math.min(30, log.length - rows)} más · quedan {log.length - rows}</button>}</div>
        : <Empty icon="list" title="El registro está vacío">Cada compra y venta del bot quedará aquí con su tesis, motivo, coste y resultado.</Empty>}
    </Card>
  </div>;
}
