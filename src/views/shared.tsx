import type { Data } from "../types";
import type { Metrics, PosX } from "../metrics";
import { dur, eur, f2, hhmm, longDate, num, pct, sEur, sPct, tone, usd } from "../metrics";
import { Spark } from "../charts";
import { Stat } from "../ui";

export type TabId = "resumen" | "rendimiento" | "riesgo" | "operativa" | "plan";
export interface ViewProps { d: Data; m: Metrics; open: (symbol: string) => void; go: (t: TabId) => void }

export function Kpi({ l, v, s, c = "", spark, help }: { l: string; v: string; s?: string; c?: string; spark?: number[]; help?: string }) {
  return <div className="glass kpi rise" title={help}>
    <div className="lbl">{l}</div><div className={`kv ${c}`}>{v}</div>{s && <div className="ks">{s}</div>}
    {spark && spark.length > 2 && <Spark values={spark.slice(-60)} />}
  </div>;
}

/** Regla stop → entrada → último → objetivo */
export function Ladder({ p, big }: { p: PosX; big?: boolean }) {
  const span = p.target - p.stop || 1, at = (v: number) => `${Math.max(0, Math.min(100, ((v - p.stop) / span) * 100))}%`;
  const up = p.last >= p.entry;
  return <div className={`ladder ${big ? "big" : ""}`} aria-label={`Stop ${p.stop}, entrada ${p.entry}, último ${p.last}, objetivo ${p.target}`}>
    <div className="ladder-t">
      <i className={`ladder-f ${up ? "up" : "dn"}`} style={{ left: up ? at(p.entry) : at(p.last), right: `calc(100% - ${up ? at(p.last) : at(p.entry)})` }} />
      <i className="mk entry" style={{ left: at(p.entry) }} title={`Entrada ${f2(p.entry)}`} />
      <i className="mk last" style={{ left: at(p.last) }} title={`Último ${f2(p.last)}`} />
    </div>
    <div className="ladder-l">
      <span><small>Stop{p.stop_type ? ` · ${p.stop_type}` : ""}</small><b className="neg">{f2(p.stop)}</b><em>{sPct(p.toStop)}</em></span>
      {p.rr != null && <span className="rr"><small>R:R</small><b>{num(p.rr, 1)}</b></span>}
      <span className="r"><small>Objetivo</small><b className="pos">{f2(p.target)}</b><em>{sPct(p.toTarget)}</em></span>
    </div>
  </div>;
}

export function PosRow({ p, onOpen }: { p: PosX; onOpen: () => void }) {
  return <button className="prow" onClick={onOpen} aria-label={`Ver ficha de ${p.symbol}`}>
    <div className="pos-id">
      <span className="avatar">{p.symbol.slice(0, 4)}</span>
      <div><b>{p.symbol}</b><div className="pos-sub"><span className="code sm">{p.thesis}</span><span>{p.kind}</span><span>{p.qty} uds.</span></div></div>
    </div>
    <div className="pos-px"><b>{f2(p.last)}</b><span className={tone(p.chg)}>{sPct(p.chg, 2)} vs {f2(p.entry)}</span></div>
    <Ladder p={p} />
    <div className={`pos-pnl ${tone(p.pnl_eur)}`}><b>{sEur(p.pnl_eur)}</b><span>{pct(p.eqWeight)} del equity</span></div>
  </button>;
}

/** Ficha completa de una posición (o de un valor ya cerrado) */
export function PositionDetail({ symbol, d, m }: { symbol: string; d: Data; m: Metrics }) {
  const p = m.positions.find(x => x.symbol === symbol);
  const trades = m.trades.filter(t => t.symbol === symbol).slice().reverse();
  const stats = m.bySymbol.find(s => s.symbol === symbol);
  const ev = d.last_eval?.[symbol];
  const orders = (d.orders ?? []).filter(o => o.symbol === symbol);
  const thesis = p?.thesis ?? stats?.thesis ?? "";
  return <div className="detail">
    <header className="detail-h">
      <span className="avatar lg">{symbol.slice(0, 4)}</span>
      <div><h2>{symbol}</h2><div className="pos-sub">{thesis && <span className="code sm">{thesis}</span>}{p && <span>{p.kind}</span>}<span>{p ? "Posición abierta" : "Sin posición abierta"}</span></div></div>
      {p && <div className="detail-px"><b>{f2(p.last)}</b><span className={tone(p.chg)}>{sPct(p.chg, 2)} desde la entrada</span></div>}
    </header>
    {thesis && d.theses[thesis] && <p className="detail-th"><b>{thesis}</b> · {d.theses[thesis]}</p>}
    {p && <>
      <div className="detail-pnl"><span>Resultado no realizado</span><b className={tone(p.pnl_eur)}>{sEur(p.pnl_eur)}</b></div>
      <Ladder p={p} big />
      <dl className="stats four">
        <Stat k="Cantidad" v={`${p.qty} uds.`} />
        <Stat k="Valor" v={eur(p.valueEur)} help={m.fxSrc === "implícito" ? "Convertido con el cambio EUR/USD implícito en la caja" : undefined} />
        <Stat k="Peso en equity" v={pct(p.eqWeight)} />
        <Stat k="En cartera" v={p.holdDays == null ? "—" : `${num(p.holdDays, 1)} d`} help={p.opened ? `Abierta ${longDate(p.opened)}` : "Requiere el campo opened del bot"} />
        <Stat k="Entrada" v={f2(p.entry)} />
        <Stat k="Stop" v={f2(p.stop)} sub={p.stop_type} c="neg" />
        <Stat k="Objetivo" v={f2(p.target)} c="pos" />
        <Stat k="R:R actual" v={p.rr == null ? "—" : num(p.rr, 2)} />
        <Stat k="Riesgo hasta stop" v={sEur(-Math.max(0, p.riskEur))} c="neg" help="Pérdida desde el precio actual si salta el stop" />
        <Stat k="Recompensa" v={sEur(Math.max(0, p.rewardEur))} c="pos" help="Ganancia desde el precio actual si se alcanza el objetivo" />
        <Stat k="Distancia al stop" v={sPct(p.toStop)} />
        <Stat k="Distancia al objetivo" v={sPct(p.toTarget)} />
      </dl>
    </>}
    {ev && <div className="detail-sec"><div className="lbl">Última evaluación · {hhmm(ev.t)}</div><p className="detail-ev">{ev.why}</p></div>}
    {orders.length > 0 && <div className="detail-sec"><div className="lbl">Órdenes vivas</div>
      <ul className="mini">{orders.map((o, i) => <li key={i}><span className={`side ${o.side === "BUY" ? "buy" : "sell"}`}>{o.side === "BUY" ? "Compra" : "Venta"}</span><b>{o.type}</b><span>{o.qty} uds.{o.price != null ? ` @ ${f2(o.price)}` : ""}</span><em>{o.status}</em></li>)}</ul></div>}
    {stats && stats.closed > 0 && <dl className="stats three detail-sec">
      <Stat k="Cerradas" v={stats.closed} /><Stat k="Acierto" v={pct(stats.wins / stats.closed, 0)} /><Stat k="Realizado" v={sEur(stats.pnl)} c={tone(stats.pnl)} />
    </dl>}
    <div className="detail-sec"><div className="lbl">Operaciones en {symbol}</div>
      {trades.length ? <ul className="mini">{trades.map((t, i) => <li key={i}>
        <span className={`side ${t.side === "BUY" ? "buy" : "sell"}`}>{t.side === "BUY" ? "Compra" : "Venta"}</span>
        <b>{t.qty} @ {f2(t.price)}</b><span className="muted">{longDate(t.time)}{t.cost != null ? ` · ${usd(t.cost)}` : ""}</span>
        <em className={tone(t.pnl_eur)}>{t.pnl_eur != null ? sEur(t.pnl_eur) : ""}</em>
      </li>)}</ul> : <p className="muted">Sin operaciones registradas.</p>}
    </div>
    {stats?.hold != null && <p className="foot">Duración media de sus operaciones cerradas: {dur(stats.hold)}.</p>}
  </div>;
}
