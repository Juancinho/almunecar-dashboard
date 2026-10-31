import { useMemo, useState } from "react";
import { eur, f2, longDate, pct, sEur, sPct, tone, usd } from "../metrics";
import { AllocationDonut, EquityChart, HaltGauge } from "../charts";
import { Card, Empty, Icon, Seg, useCountUp } from "../ui";
import { Kpi, PosRow, type ViewProps } from "./shared";

type Range = "1D" | "1S" | "1M" | "3M" | "ALL";
const RANGES: { v: Range; l: string }[] = [{ v: "1D", l: "1D" }, { v: "1S", l: "1S" }, { v: "1M", l: "1M" }, { v: "3M", l: "3M" }, { v: "ALL", l: "Todo" }];
const SPAN: Record<Range, number> = { "1D": 0, "1S": 7, "1M": 30, "3M": 91, ALL: Infinity };

export default function Resumen({ d, m, open, go }: ViewProps) {
  const [range, setRange] = useState<Range>("ALL");
  const view = useMemo(() => {
    const c = m.curve; if (range === "ALL" || c.length < 2) return c;
    const last = c[c.length - 1];
    const cut = range === "1D" ? c.filter(p => p.t.slice(0, 10) === last.t.slice(0, 10)) : c.filter(p => p.ts >= last.ts - SPAN[range] * 864e5);
    return cut.length >= 2 ? cut : c;
  }, [m.curve, range]);
  const vFirst = view[0]?.eq ?? d.base, vLast = view[view.length - 1]?.eq ?? d.equity;
  const vChg = vLast - vFirst, vRet = vFirst ? vChg / vFirst : 0;
  const shown = useCountUp(d.equity);
  const recent = m.trades.slice(-6).reverse();
  const session = m.periods[0].v, month = m.periods[2].v;

  return <div className="grid">
    <Card className="hero span-8 rise">
      <div className="hero-h">
        <div>
          <div className="lbl">Equity virtual</div>
          <div className="big">{f2(shown)}<span> €</span></div>
          <div className="hero-chg">
            <span className={`delta ${tone(m.pnl)}`}>{sEur(m.pnl)} · {sPct(m.ret, 2)}</span>
            <span className="muted">desde el inicio</span>
            {range !== "ALL" && <><span className="dot-sep" /><span className={tone(vChg)}>{sPct(vRet, 2)}</span><span className="muted">en {RANGES.find(r => r.v === range)!.l}</span></>}
          </div>
        </div>
        <Seg label="Periodo" value={range} options={RANGES} onChange={setRange} />
      </div>
      <EquityChart data={view} base={d.base} halt={m.halt} />
      <div className="hero-f">
        <div><span>Máximo</span><b>{eur(m.peakEq)}</b></div>
        <div><span>Mínimo</span><b>{eur(m.troughEq)}</b></div>
        <div><span>Caída desde máximo</span><b className={m.curDD < 0 ? "neg" : ""}>{sPct(m.curDD, 2)}</b></div>
        <div><span>Muestras</span><b>{m.curve.length}</b></div>
      </div>
    </Card>

    <div className="span-4 stack">
      <Card title="Freno de pérdidas" icon="shield" sub={`Halt y check-in si el equity cae a ${eur(m.halt)}`} className="rise">
        <HaltGauge used={m.haltUsed} cushion={m.cushion} drop={Math.max(0, -m.ret)} />
      </Card>
      <Card title="Exposición" icon="layers" sub="Reparto del equity" className="rise">
        <div className="expo">
          <div className="expo-n"><b>{pct(m.exposure)}</b><span>invertido</span></div>
          <div className="meter"><i style={{ width: `${m.exposure * 100}%` }} /></div>
          <div className="expo-l"><div><i className="sw inv" />Invertido<b>{eur(m.invested)}</b></div><div><i className="sw cash" />Caja<b>{eur(d.cash)}</b></div></div>
        </div>
      </Card>
    </div>

    <div className="kpis span-12">
      <Kpi l="Resultado total" v={sEur(m.pnl)} c={tone(m.pnl)} s={sPct(m.ret, 2)} spark={m.curve.map(c => c.eq)} />
      <Kpi l="Última sesión" v={sPct(session, 2)} c={tone(session)} s={`Mes ${sPct(month, 2)}`} />
      <Kpi l="No realizado" v={sEur(m.unrealized)} c={tone(m.unrealized)} s={`${m.positions.length} ${m.positions.length === 1 ? "posición abierta" : "posiciones abiertas"}`} />
      <Kpi l="Realizado" v={sEur(m.realized)} c={tone(m.realized)} s={`${m.closed.length} ${m.closed.length === 1 ? "operación cerrada" : "operaciones cerradas"}`} />
      <Kpi l="Drawdown máximo" v={sPct(m.maxDD, 2)} c={m.maxDD < 0 ? "neg" : ""} s={`Actual ${sPct(m.curDD, 2)}`} />
      <Kpi l={m.bench ? `Alpha vs ${m.bench.name}` : "Tasa de acierto"} v={m.bench ? sPct(m.bench.totalP - m.bench.totalB, 2) : m.winRate == null ? "—" : pct(m.winRate, 0)}
        c={m.bench ? tone(m.bench.totalP - m.bench.totalB) : ""} s={m.bench ? "Exceso acumulado" : m.closed.length ? `${m.wins} ganadoras · ${m.losses} perdedoras` : "Sin operaciones cerradas"} />
    </div>

    <Card title="Posiciones abiertas" icon="target" sub="Toca una posición para ver su ficha completa" className="span-8 rise">
      {m.positions.length ? <div className="pos-list">{m.positions.map(p => <PosRow key={p.symbol} p={p} onOpen={() => open(p.symbol)} />)}</div> :
        <Empty icon="layers" title="Sin posiciones abiertas">Todo el libro está en caja.{d.plan?.candidates.length ? <> Candidatos de hoy: <b>{d.plan.candidates.join(", ")}</b>.</> : null}</Empty>}
    </Card>
    <Card title="Asignación" icon="layers" sub="Peso sobre el equity" className="span-4 rise">
      <AllocationDonut allocation={m.allocation} />
    </Card>

    <Card title="Últimas operaciones" icon="bolt" sub={`${m.trades.length} en total`} className="span-7 rise"
      right={m.trades.length ? <button className="link" onClick={() => go("operativa")}>Ver operativa<Icon n="arrow" s={15} /></button> : undefined}>
      {recent.length ? <ul className="feed">{recent.map((t, i) => <li key={i} onClick={() => open(t.symbol)}>
        <span className={`feed-i ${t.side === "BUY" ? "buy" : "sell"}`}><Icon n={t.side === "BUY" ? "arrow" : "flag"} s={15} /></span>
        <div><b>{t.side === "BUY" ? "Compra" : "Venta"} {t.qty} {t.symbol}</b> <span className="muted">@ {f2(t.price)}</span><p>{t.reason}</p></div>
        <div className="feed-r"><em className={tone(t.pnl_eur)}>{t.pnl_eur != null ? sEur(t.pnl_eur) : t.cost != null ? usd(t.cost) : ""}</em><time>{longDate(t.time)}</time></div>
      </li>)}</ul> : <Empty icon="bolt" title="Todavía no hay operaciones">Cada orden ejecutada por el bot aparecerá aquí al momento.</Empty>}
    </Card>
    <Card title="Hoy" icon="calendar" sub={d.plan ? `Plan del ${longDate(d.plan.date)}` : "Sin plan publicado"} className="span-5 rise"
      right={<button className="link" onClick={() => go("plan")}>Ver plan<Icon n="arrow" s={15} /></button>}>
      <div className="lbl">Candidatos</div>
      <div className="cands sm">{d.plan?.candidates.length ? d.plan.candidates.map(c => <button key={c} className="cand" onClick={() => open(c)}><i />{c}</button>) : <span className="muted">Ninguno</span>}</div>
      <dl className="stats">
        <div><dt>Descartados</dt><dd>{d.plan?.skipped.length ?? 0}</dd></div>
        <div><dt>Evaluaciones intradía</dt><dd>{Object.keys(d.last_eval ?? {}).length}</dd></div>
        <div><dt>Riesgo abierto</dt><dd className={m.openRisk ? "neg" : ""}>{m.openRisk ? sEur(-m.openRisk) : "—"}</dd></div>
        <div><dt>Margen al freno</dt><dd>{eur(m.cushion)}</dd></div>
      </dl>
    </Card>
  </div>;
}
