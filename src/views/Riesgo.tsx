import { eur, f2, longDate, num, pct, sEur } from "../metrics";
import { HaltGauge, Histogram, RiskReward, ScenarioTrack, SERIES, StackMeter } from "../charts";
import { Card, Empty, NeedsData, Stat } from "../ui";
import type { ViewProps } from "./shared";

export default function Riesgo({ d, m, open }: ViewProps) {
  const hasPos = m.positions.length > 0;
  const toHalt = m.stopEq - m.halt;
  const thesisParts = m.byThesis.filter(t => t.exposure > 0).map((t, i) => ({ k: t.thesis, w: t.exposure, color: SERIES[i % SERIES.length], v: sEur(t.unrealized) }));
  return <div className="grid">
    <Card title="Escenarios de la cartera" icon="target" sub="Qué pasa con el equity si todas las posiciones llegan a la vez a su stop o a su objetivo" className="span-8 rise">
      <div className="scn-h">
        <div><span>Riesgo abierto</span><b className={m.openRisk ? "neg" : ""}>{m.openRisk ? sEur(-m.openRisk) : "0,00 €"}</b><em>{pct(d.equity ? m.openRisk / d.equity : 0, 2)} del equity</em></div>
        <div><span>Recompensa abierta</span><b className={m.openReward ? "pos" : ""}>{sEur(m.openReward)}</b><em>{pct(d.equity ? m.openReward / d.equity : 0, 2)} del equity</em></div>
        <div><span>R:R de la cartera</span><b>{m.openRisk > 0 ? num(m.openReward / m.openRisk, 2) : "—"}</b><em>recompensa / riesgo</em></div>
      </div>
      <ScenarioTrack halt={m.halt} base={d.base} stopEq={m.stopEq} eq={d.equity} targetEq={m.targetEq} />
      <p className="scn-s">{hasPos
        ? <>Si saltaran todos los stops, el equity quedaría en <b>{eur(m.stopEq)}</b>, a <b className={toHalt < 50 ? "neg" : ""}>{eur(toHalt)}</b> del freno.</>
        : <>Sin posiciones abiertas no hay riesgo de mercado: el equity solo puede moverse por costes.</>}
        {m.fxSrc === "implícito" && <span className="muted"> Importes convertidos a euros con el cambio implícito en la caja ({num(m.fx, 4)} $/€).</span>}</p>
    </Card>
    <Card title="Freno de pérdidas" icon="shield" sub={`Halt y check-in si el equity cae a ${eur(m.halt)}`} className="span-4 rise">
      <HaltGauge used={m.haltUsed} cushion={m.cushion} drop={Math.max(0, -m.ret)} />
    </Card>

    <Card title="Riesgo y recompensa por posición" icon="scale" sub="Euros hasta el stop (izquierda) y hasta el objetivo (derecha) desde el precio actual" className="span-7 rise">
      {hasPos ? <RiskReward positions={m.positions} onOpen={open} /> : <Empty icon="scale" title="Sin posiciones abiertas" />}
    </Card>
    <Card title="Concentración" icon="layers" sub="Dónde está el dinero" className="span-5 rise">
      <dl className="stats three">
        <Stat k="Exposición" v={pct(m.exposure)} />
        <Stat k="Mayor posición" v={pct(m.maxWeight)} help="Peso de la posición más grande sobre el equity" />
        <Stat k="Posiciones efectivas" v={hasPos ? num(m.effN, 1) : "—"} help="1 / Σ peso². Indica a cuántas posiciones iguales equivale la cartera: cuanto más baja, más concentrada." />
      </dl>
      <div className="lbl" style={{ marginTop: 16 }}>Exposición por tesis</div>
      {thesisParts.length ? <StackMeter parts={[...thesisParts, { k: "Caja", w: Math.max(0, d.cash) / (d.equity || 1), color: "var(--cash)" }]} /> : <p className="muted">Todo en caja.</p>}
    </Card>

    <Card title="Valor en riesgo" icon="alert" sub="Pérdida en una sesión que solo se supera 1 de cada 20 días" className="span-5 rise">
      <div className="var-hero">
        <div><span>VaR 95 % histórico</span><b className="neg">{m.var95 == null ? "—" : sEur(-m.var95 * d.equity)}</b><em>{m.var95 == null ? "con 20 sesiones" : pct(m.var95, 2)}</em></div>
        <div><span>CVaR 95 %</span><b className="neg">{m.cvar95 == null ? "—" : sEur(-m.cvar95 * d.equity)}</b><em>{m.cvar95 == null ? "con 20 sesiones" : `${pct(m.cvar95, 2)} · media de la cola`}</em></div>
      </div>
      <dl className="stats">
        <Stat k="VaR paramétrico" v={m.varParam == null ? "—" : sEur(-m.varParam * d.equity)} help="Suponiendo rendimientos normales: 1,645 × volatilidad diaria − media" />
        <Stat k="Volatilidad anual." v={m.vol == null ? "—" : pct(m.vol)} />
        <Stat k="Peor sesión" v={m.worstDay ? sEur(m.worstDay.pnl) : "—"} c="neg" />
        <Stat k="Sesiones para el freno" v={m.var95 ? num(m.cushion / (m.var95 * d.equity), 0) : "—"} help="Cuántas sesiones seguidas al nivel del VaR harían falta para tocar el freno" />
      </dl>
    </Card>
    <Card title="Distribución de sesiones" icon="hist" sub="Cuántas sesiones cayeron en cada tramo de rentabilidad · en oscuro, la cola más allá del VaR" className="span-7 rise">
      {m.daily.length >= 5 ? <Histogram data={m.retBins} tail={m.var95} unit={b => `${(b.lo * 100).toFixed(2).replace(".", ",")} % a ${(b.hi * 100).toFixed(2).replace(".", ",")} %`} />
        : <Empty icon="hist" title="Hacen falta más sesiones">El histograma aparece con 5 sesiones o más.</Empty>}
    </Card>

    <Card title="Órdenes vivas en IBKR" icon="list" sub="Stops y límites que el bot tiene puestos en el bróker" className="span-12 rise">
      {d.orders == null ? <NeedsData field="orders: [{ symbol, side, type, qty, price, status, placed }]">Con esta lista puedes comprobar que cada posición tiene su stop realmente colocado en el bróker y no solo en el ledger del bot.</NeedsData>
        : d.orders.length ? <div className="tw"><table>
          <thead><tr><th>Valor</th><th>Lado</th><th>Tipo</th><th className="n">Cant.</th><th className="n">Precio</th><th>Estado</th><th>Colocada</th></tr></thead>
          <tbody>{d.orders.map((o, i) => <tr key={i} onClick={() => open(o.symbol)} className="click">
            <td><b>{o.symbol}</b></td><td><span className={`side ${o.side === "BUY" ? "buy" : "sell"}`}>{o.side === "BUY" ? "Compra" : "Venta"}</span></td>
            <td>{o.type}</td><td className="n">{o.qty}</td><td className="n">{o.price != null ? f2(o.price) : "mercado"}</td><td><span className="tag">{o.status}</span></td>
            <td className="muted">{o.placed ? longDate(o.placed) : "—"}</td></tr>)}</tbody></table></div>
          : <Empty icon="list" title="Ninguna orden viva" />}
      {d.orders && hasPos && m.positions.some(p => !d.orders!.some(o => o.symbol === p.symbol && o.side !== "BUY")) &&
        <p className="warn-line">⚠ Hay posiciones sin orden de venta viva: {m.positions.filter(p => !d.orders!.some(o => o.symbol === p.symbol && o.side !== "BUY")).map(p => p.symbol).join(", ")}.</p>}
    </Card>
  </div>;
}
