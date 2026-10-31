import { useMemo, useState } from "react";
import type { Data } from "./types";
import Logo from "./Logo";
import { compute, eur, f2, longDate, num, pct, sEur, sPct, tone, usd, parseT, type PosX } from "./metrics";
import { AllocationDonut, CalendarHeat, DivergingBars, DrawdownChart, EquityChart, HaltGauge, HBars, Ring, Spark, TradePnlChart } from "./charts";
import { Backdrop, Card, Empty, Icon, Seg, useCountUp, useGlassSheen, useNyse, useTheme } from "./ui";

type Range = "1D" | "1S" | "1M" | "3M" | "ALL";
const RANGES: { v: Range; l: string }[] = [{ v: "1D", l: "1D" }, { v: "1S", l: "1S" }, { v: "1M", l: "1M" }, { v: "3M", l: "3M" }, { v: "ALL", l: "Todo" }];
const SPAN: Record<Range, number> = { "1D": 0, "1S": 7, "1M": 30, "3M": 91, ALL: Infinity };

interface Props { d: Data; onRefresh: () => void; refreshing: boolean; fetchedAt: Date | null; onLock: () => void }

export default function Dashboard({ d, onRefresh, refreshing, fetchedAt, onLock }: Props) {
  const m = useMemo(() => compute(d), [d]);
  const [theme, toggleTheme] = useTheme();
  const nyse = useNyse();
  useGlassSheen();
  const [range, setRange] = useState<Range>("ALL");
  const [side, setSide] = useState<"ALL" | "BUY" | "SELL">("ALL");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState(12);

  const view = useMemo(() => {
    const c = m.curve; if (range === "ALL" || c.length < 2) return c;
    const last = c[c.length - 1];
    const cut = range === "1D" ? c.filter(p => p.t.slice(0, 10) === last.t.slice(0, 10)) : c.filter(p => p.ts >= last.ts - SPAN[range] * 864e5);
    return cut.length >= 2 ? cut : c;
  }, [m.curve, range]);
  const vFirst = view[0]?.eq ?? d.base, vLast = view[view.length - 1]?.eq ?? d.equity;
  const vChg = vLast - vFirst, vRet = vFirst ? vChg / vFirst : 0;
  const shown = useCountUp(d.equity);

  const log = useMemo(() => [...m.trades].reverse().filter(t => (side === "ALL" || t.side === side) &&
    (!q || `${t.symbol} ${t.thesis} ${t.reason}`.toLowerCase().includes(q.toLowerCase()))), [m.trades, side, q]);
  const skipped = useMemo(() => {
    const g = new Map<string, string[]>(); for (const s of d.plan?.skipped ?? []) g.set(s.why, [...(g.get(s.why) ?? []), s.symbol]);
    return [...g.entries()];
  }, [d.plan]);
  const evals = Object.entries(d.last_eval ?? {});
  const thesisRows = useMemo(() => {
    const agg = new Map(m.byThesis.map(t => [t.thesis, t]));
    const keys = [...new Set([...Object.keys(d.theses), ...agg.keys()])];
    return keys.map(k => ({ k, desc: d.theses[k] ?? "", a: agg.get(k), open: m.positions.filter(p => p.thesis === k).length }));
  }, [m.byThesis, m.positions, d.theses]);
  const watch = (k: string) => /vigilancia/i.test(d.theses[k] ?? "");

  return <div className="app">
    <Backdrop />
    <nav className="nav glass">
      <a href="#resumen" className="nav-logo"><Logo /></a>
      <div className="nav-links">
        <a href="#resumen">Resumen</a><a href="#cartera">Cartera</a><a href="#operativa">Operativa</a><a href="#plan">Plan</a><a href="#registro">Registro</a>
      </div>
      <div className="nav-r">
        <span className={`status ${d.halted ? "halt" : "live"}`}><i />{d.halted ? "Detenido" : "Operativo"}</span>
        <span className={`status mkt ${nyse ? "live" : "off"}`} title="Horario regular NYSE (sin festivos)"><i />NYSE {nyse ? "abierta" : "cerrada"}</span>
        <button className="ibtn" onClick={onRefresh} title={fetchedAt ? `Descargado ${fetchedAt.toLocaleTimeString("es-ES")}` : "Actualizar"} aria-label="Actualizar datos">
          <span className={refreshing ? "spin" : ""}><Icon n="refresh" /></span></button>
        <button className="ibtn" onClick={toggleTheme} aria-label="Cambiar tema"><Icon n={theme === "dark" ? "sun" : "moon"} /></button>
        <button className="ibtn" onClick={onLock} aria-label="Bloquear"><Icon n="lock" /></button>
      </div>
    </nav>

    <main className="wrap">
      <div className="intro rise" id="resumen">
        <div>
          <p className="eyebrow">Bot de inversión · cuenta de simulación IBKR</p>
          <h1>Panel de control</h1>
        </div>
        <div className="intro-r">
          <span className="chip"><Icon n="book" s={15} />Libro virtual {eur(d.base)}</span>
          <span className="chip" title={d.updated}><Icon n="calendar" s={15} />{longDate(m.updated)}</span>
        </div>
      </div>

      {d.halted && <div className="glass halted rise"><span className="halted-i"><Icon n="alert" s={22} /></span>
        <div><b>Trading detenido</b><p>{d.halt_reason ?? "Se alcanzó el freno de pérdidas. Pendiente de check-in."}</p></div></div>}

      <div className="grid">
        {/* ---------- Héroe: equity ---------- */}
        <Card className="hero span-8 rise" >
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
          <Card title="Freno de pérdidas" icon="shield" sub={`Halt y check-in si el equity cae a ${eur(m.halt)}`} className="rise d1">
            <HaltGauge used={m.haltUsed} cushion={m.cushion} drop={Math.max(0, -m.ret)} />
          </Card>
          <Card title="Exposición" icon="layers" sub="Reparto del equity" className="rise d2">
            <div className="expo">
              <div className="expo-n"><b>{pct(m.exposure)}</b><span>invertido</span></div>
              <div className="meter"><i style={{ width: `${m.exposure * 100}%` }} /></div>
              <div className="expo-l"><div><i className="sw inv" />Invertido<b>{eur(m.invested)}</b></div><div><i className="sw cash" />Caja<b>{eur(d.cash)}</b></div></div>
            </div>
          </Card>
        </div>

        {/* ---------- KPIs ---------- */}
        <div className="kpis span-12">
          <Kpi l="Resultado total" v={sEur(m.pnl)} c={tone(m.pnl)} s={sPct(m.ret, 2)} spark={m.curve.map(c => c.eq)} i={0} />
          <Kpi l="No realizado" v={sEur(m.unrealized)} c={tone(m.unrealized)} s={`${m.positions.length} ${m.positions.length === 1 ? "posición abierta" : "posiciones abiertas"}`} i={1} />
          <Kpi l="Realizado" v={sEur(m.realized)} c={tone(m.realized)} s={`${m.closed.length} ${m.closed.length === 1 ? "operación cerrada" : "operaciones cerradas"}`} i={2} />
          <Kpi l="Drawdown máximo" v={sPct(m.maxDD, 2)} c={m.maxDD < 0 ? "neg" : ""} s={`Actual ${sPct(m.curDD, 2)}`} i={3} />
          <Kpi l="Tasa de acierto" v={m.winRate == null ? "—" : pct(m.winRate, 0)} s={m.closed.length ? `${m.wins} ganadoras · ${m.losses} perdedoras` : "Sin operaciones cerradas"} i={4} />
          <Kpi l="Costes pagados" v={usd(d.fees_usd)} s={m.costs ? `Est. en operaciones ${usd(m.costs)}` : "Comisiones IBKR"} i={5} />
        </div>

        {/* ---------- Cartera ---------- */}
        <Card title="Posiciones abiertas" icon="target" sub="Recorrido de cada posición entre su stop y su objetivo" className="span-8 rise" style={{ scrollMarginTop: 96 }}>
          <span id="cartera" className="anchor" />
          {m.positions.length ? <div className="pos-list">{m.positions.map(p => <PosRow key={p.symbol} p={p} />)}</div> :
            <Empty icon="layers" title="Sin posiciones abiertas">Todo el libro está en caja.{d.plan?.candidates.length ? <> Candidatos de hoy: <b>{d.plan.candidates.join(", ")}</b>.</> : null}</Empty>}
        </Card>
        <Card title="Asignación" icon="layers" sub="Peso sobre el equity" className="span-4 rise">
          <AllocationDonut allocation={m.allocation} />
        </Card>

        {/* ---------- Operativa ---------- */}
        <Card title="Resultado por operación" icon="pulse" sub="P&L realizado de cada cierre y su acumulado" className="span-8 rise"
          right={m.closed.length ? <div className="lgd"><span><i className="sw pos" />Ganancia</span><span><i className="sw neg" />Pérdida</span><span><i className="ln" />Acumulado</span></div> : undefined}>
          <span id="operativa" className="anchor" />
          {m.closed.length ? <TradePnlChart data={m.realizedSeries} /> :
            <Empty icon="pulse" title="Aún no hay operaciones cerradas">El gráfico se dibuja con el primer cierre del bot.</Empty>}
        </Card>
        <Card title="Calidad de la operativa" icon="target" className="span-4 rise">
          <div className="quality">
            <Ring value={m.winRate} label={m.winRate == null ? "—" : pct(m.winRate, 0)} sub="acierto" />
            <div className="q-side">
              <div><span>Profit factor</span><b>{num(m.profitFactor)}</b></div>
              <div><span>Esperanza / op.</span><b className={tone(m.expectancy)}>{m.expectancy == null ? "—" : sEur(m.expectancy)}</b></div>
            </div>
          </div>
          <dl className="stats">
            <div><dt>Ganancia media</dt><dd className="pos">{m.avgWin == null ? "—" : sEur(m.avgWin)}</dd></div>
            <div><dt>Pérdida media</dt><dd className="neg">{m.avgLoss == null ? "—" : sEur(m.avgLoss)}</dd></div>
            <div><dt>Mejor operación</dt><dd className={tone(m.best)}>{m.best == null ? "—" : sEur(m.best)}</dd></div>
            <div><dt>Peor operación</dt><dd className={tone(m.worst)}>{m.worst == null ? "—" : sEur(m.worst)}</dd></div>
            <div><dt>Racha actual</dt><dd className={tone(m.streak)}>{m.streak ? `${Math.abs(m.streak)} ${m.streak > 0 ? "ganadoras" : "perdedoras"}` : "—"}</dd></div>
            <div><dt>Operaciones</dt><dd>{m.trades.length}</dd></div>
          </dl>
        </Card>

        <Card title="Calendario de rendimiento" icon="calendar" sub="Resultado de cada sesión" className="span-7 rise">
          <CalendarHeat daily={m.daily} />
        </Card>
        <Card title="Bajo el agua" icon="down" sub="Caída desde el máximo previo" className="span-5 rise">
          <DrawdownChart data={view} />
          <dl className="stats three">
            <div><dt>Volatilidad anual.</dt><dd>{m.vol == null ? "—" : pct(m.vol)}</dd></div>
            <div><dt>Sharpe</dt><dd>{num(m.sharpe)}</dd></div>
            <div><dt>Sortino</dt><dd>{num(m.sortino)}</dd></div>
            <div><dt>Mejor sesión</dt><dd className={tone(m.bestDay?.ret)}>{m.bestDay ? sPct(m.bestDay.ret, 2) : "—"}</dd></div>
            <div><dt>Peor sesión</dt><dd className={tone(m.worstDay?.ret)}>{m.worstDay ? sPct(m.worstDay.ret, 2) : "—"}</dd></div>
            <div><dt>Sesiones +</dt><dd>{m.daily.length ? `${m.greenDays}/${m.daily.length}` : "—"}</dd></div>
          </dl>
          {m.vol == null && <p className="foot">Ratios con 5 sesiones o más.</p>}
        </Card>

        {/* ---------- Plan ---------- */}
        <Card title="Plan del día" icon="list" sub={d.plan ? longDate(d.plan.date) : undefined} className="span-7 rise">
          <span id="plan" className="anchor" />
          {d.plan ? <>
            <div className="lbl">Candidatos</div>
            <div className="cands">{d.plan.candidates.length ? d.plan.candidates.map(c => <span key={c} className="cand"><i />{c}</span>) : <span className="muted">Ninguno hoy</span>}</div>
            {skipped.length > 0 && <>
              <div className="lbl">Descartados</div>
              <div className="skips">{skipped.map(([why, syms]) => <div key={why} className="skip">
                <span className="skip-why">{why}<em>{syms.length}</em></span>
                <div className="skip-s">{syms.map(s => <span key={s}>{s}</span>)}</div>
              </div>)}</div>
            </>}
          </> : <Empty icon="list" title="Sin plan publicado" />}
        </Card>
        <Card title="Evaluación intradía" icon="eye" sub="Última revisión de cada valor" className="span-5 rise">
          {evals.length ? <ul className="evals">{evals.map(([s, e]) => <li key={s}><b>{s}</b><span>{e.why}</span><time>{(parseT(e.t) ? longDate(e.t).split(" · ")[1] : null) ?? e.t}</time></li>)}</ul> :
            <Empty icon="eye" title="Sin evaluaciones todavía">Aparecerán cuando el bot revise posiciones o candidatos durante la sesión.</Empty>}
        </Card>

        <Card title="Tesis de inversión" icon="book" sub="Resultado y posiciones por tesis" className="span-7 rise">
          {thesisRows.length ? <ul className="theses">{thesisRows.map(t => <li key={t.k}>
            <span className={`code ${watch(t.k) ? "watch" : ""}`}>{t.k}</span>
            <div className="th-b"><p>{t.desc || "—"}</p>
              <div className="th-m">{watch(t.k) && <span className="tag">Solo vigilancia</span>}
                <span>{t.open} abiertas</span><span>{t.a?.trades ?? 0} cerradas</span></div></div>
            <em className={tone(t.a?.total)}>{t.a ? sEur(t.a.total) : "—"}</em>
          </li>)}</ul> : <Empty icon="book" title="Sin tesis definidas" />}
          {m.byThesis.some(t => t.total !== 0) && <><div className="lbl" style={{ marginTop: 18 }}>Contribución al resultado</div>
            <DivergingBars rows={m.byThesis.map(t => ({ k: t.thesis, v: t.total, sub: `${eur(t.realized)} real. · ${eur(t.unrealized)} no real.` }))} /></>}
        </Card>
        <Card title="Fricción" icon="coins" sub="Costes de operar, en USD" className="span-5 rise">
          <HBars rows={m.friction.map(f => ({ k: f.k, v: f.v }))} fmt={usd} />
          {m.frictionTotals.length > 0 && <div className="totals">{m.frictionTotals.map(t => <div key={t.k}><span>{t.k}</span><b>{usd(t.v)}</b></div>)}</div>}
        </Card>

        {/* ---------- Registro ---------- */}
        <Card title="Registro de operaciones" icon="list" sub={`${m.trades.length} en total`} className="span-12 rise"
          right={m.trades.length ? <div className="log-ctl">
            <label className="search"><Icon n="search" s={15} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar valor, tesis o motivo" /></label>
            <Seg label="Lado" value={side} onChange={setSide} options={[{ v: "ALL", l: "Todas" }, { v: "BUY", l: "Compras" }, { v: "SELL", l: "Ventas" }]} />
          </div> : undefined}>
          <span id="registro" className="anchor" />
          {m.trades.length ? <div className="tw"><table>
            <thead><tr><th>Fecha</th><th>Operación</th><th className="n">Cant.</th><th className="n">Precio</th><th>Tesis</th><th>Motivo</th><th className="n">Coste est.</th><th className="n">P&L</th></tr></thead>
            <tbody>{log.slice(0, rows).map((t, i) => <tr key={i}>
              <td className="nowrap muted">{longDate(t.time)}</td>
              <td><span className={`side ${t.side === "BUY" ? "buy" : "sell"}`}>{t.side === "BUY" ? "Compra" : "Venta"}</span> <b>{t.symbol}</b></td>
              <td className="n">{t.qty}</td><td className="n">{f2(t.price)}</td>
              <td><span className="code sm">{t.thesis}</span></td>
              <td className="reason">{t.reason}</td>
              <td className="n muted">{t.cost != null ? usd(t.cost) : "—"}</td>
              <td className={`n ${tone(t.pnl_eur)}`}>{t.pnl_eur != null ? sEur(t.pnl_eur) : "—"}</td>
            </tr>)}
              {!log.length && <tr><td colSpan={8} className="muted center">Nada coincide con el filtro.</td></tr>}</tbody>
          </table>{log.length > rows && <button className="more" onClick={() => setRows(r => r + 24)}>Mostrar {Math.min(24, log.length - rows)} más · quedan {log.length - rows}</button>}</div> : <Empty icon="list" title="El registro está vacío">Cada compra y venta del bot quedará aquí con su tesis, motivo, coste y resultado.</Empty>}
        </Card>
      </div>

      <footer className="foot-main">
        <Logo variant="mark" className="foot-logo" />
        <p>Datos: ledger del bot y API de IBKR (cuenta de simulación). Cifrados de extremo a extremo y descifrados solo en este navegador.<br />No constituye recomendación de inversión.</p>
        <p className="muted">Actualizado {d.updated}</p>
      </footer>
    </main>
  </div>;
}

function Kpi({ l, v, s, c = "", spark, i }: { l: string; v: string; s?: string; c?: string; spark?: number[]; i: number }) {
  return <div className={`glass kpi rise d${i % 6}`}>
    <div className="lbl">{l}</div><div className={`kv ${c}`}>{v}</div>{s && <div className="ks">{s}</div>}
    {spark && spark.length > 2 && <Spark values={spark.slice(-60)} />}
  </div>;
}

function PosRow({ p }: { p: PosX }) {
  const span = p.target - p.stop || 1, at = (v: number) => `${Math.max(0, Math.min(100, ((v - p.stop) / span) * 100))}%`;
  const up = p.last >= p.entry;
  return <div className="prow">
    <div className="pos-id">
      <span className="avatar">{p.symbol.slice(0, 4)}</span>
      <div><b>{p.symbol}</b><div className="pos-sub"><span className="code sm">{p.thesis}</span><span>{p.kind}</span><span>{p.qty} uds.</span></div></div>
    </div>
    <div className="pos-px"><b>{f2(p.last)}</b><span className={tone(p.chg)}>{sPct(p.chg, 2)} vs {f2(p.entry)}</span></div>
    <div className="ladder" aria-label={`Stop ${p.stop}, entrada ${p.entry}, último ${p.last}, objetivo ${p.target}`}>
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
    </div>
    <div className={`pos-pnl ${tone(p.pnl_eur)}`}><b>{sEur(p.pnl_eur)}</b><span>{pct(p.weight)} de la cartera</span></div>
  </div>;
}
