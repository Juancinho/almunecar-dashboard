import { num, pct, sPct, tone } from "../metrics";
import { BenchChart, CalendarHeat, DrawdownChart, ExcessChart, MonthlyTable } from "../charts";
import { Card, Empty, NeedsData, Stat } from "../ui";
import type { ViewProps } from "./shared";
import { useState } from "react";

export default function Rendimiento({ m }: ViewProps) {
  const [bi, setBi] = useState(0);
  const b = m.benches[bi] ?? m.bench;
  return <div className="grid">
    <div className="periods span-12">
      {m.periods.map(p => <div key={p.k} className="glass period rise"><span>{p.k === "Hoy" ? "Última sesión" : p.k}</span><b className={tone(p.v)}>{sPct(p.v, 2)}</b></div>)}
      <div className="glass period rise" title="Rentabilidad anualizada; se muestra con 90 días de historia o más"><span>Anualizada</span><b className={tone(m.cagr)}>{m.cagr == null ? "—" : sPct(m.cagr, 1)}</b></div>
    </div>

    <Card title={b ? `Cartera frente a ${b.name}` : "Cartera frente a su índice"} icon="trend" sub="Ambas series en base 100 desde el primer dato común" className="span-8 rise"
      right={b ? <div className="lgd">
        {m.benches.length > 1 && <span className="seg">{m.benches.map((x, i) => <button key={x.name} className={i === bi ? "on" : ""} onClick={() => setBi(i)}>{x.name.split(" (")[0].replace("S&P 500 · ", "")}</button>)}</span>}
        <span><i className="ln" />Cartera</span><span><i className="ln b" />{b.name}</span></div> : undefined}>
      {b ? <>
        <BenchChart series={b.series} name={b.name} />
        <div className="lbl" style={{ marginTop: 6 }}>Diferencia acumulada (puntos porcentuales)</div>
        <ExcessChart series={b.series} />
      </> : <NeedsData field="bench: { name, curve: [{ t, eq }] }">Para medir alpha y beta el bot tiene que publicar un índice de referencia (p. ej. SPY o la mezcla que represente sus tesis) en los mismos instantes que la curva de equity.</NeedsData>}
    </Card>
    <Card title="Alpha y beta" icon="scale" sub={b ? `${b.n} sesiones comparadas` : "Frente al índice de referencia"} className="span-4 rise">
      {b ? <>
        <div className="alpha-hero">
          <div><span>Cartera</span><b className={tone(b.totalP)}>{sPct(b.totalP, 2)}</b></div>
          <div><span>{b.name}</span><b className={tone(b.totalB)}>{sPct(b.totalB, 2)}</b></div>
          <div><span>Exceso</span><b className={tone(b.totalP - b.totalB)}>{sPct(b.totalP - b.totalB, 2)}</b></div>
        </div>
        <dl className="stats">
          <Stat k="Alpha anual (Jensen)" v={b.alpha == null ? "—" : sPct(b.alpha, 1)} c={tone(b.alpha)} help="Rentabilidad anual no explicada por la exposición al índice (beta). Positiva = el bot aporta valor propio." />
          <Stat k="Beta" v={num(b.beta)} help="Sensibilidad al índice: 1 = se mueve igual; 0,5 = la mitad." />
          <Stat k="Correlación" v={num(b.corr)} help="De −1 a 1. Cerca de 0 = diversifica respecto al índice." />
          <Stat k="Tracking error" v={b.te == null ? "—" : pct(b.te)} help="Volatilidad anual de la diferencia con el índice." />
          <Stat k="Information ratio" v={num(b.ir)} help="Exceso anual / tracking error. Por encima de 0,5 es bueno." />
          <Stat k="Captura alcista / bajista" v={b.upCap == null || b.downCap == null ? "—" : `${pct(b.upCap, 0)} / ${pct(b.downCap, 0)}`} help="Qué parte de las subidas y de las bajadas del índice recoge la cartera. Ideal: alta / baja." />
        </dl>
        {b.n < 10 && <p className="foot">Alpha, beta y ratios necesitan 10 sesiones comunes o más.</p>}
      </> : <Empty icon="scale" title="Sin índice de referencia">Aquí aparecerán alpha de Jensen, beta, correlación, tracking error, information ratio y captura alcista/bajista.</Empty>}
    </Card>

    <Card title="Rentabilidad mensual" icon="calendar" sub="Cada mes frente al cierre del anterior · el primero frente al libro de partida" className="span-12 rise">
      {m.monthly.length ? <MonthlyTable rows={m.monthly} start={m.data.start} /> : <Empty icon="calendar" title="Sin meses cerrados todavía" />}
    </Card>

    <Card title="Calendario de rendimiento" icon="calendar" sub="Resultado de cada sesión" className="span-7 rise">
      <CalendarHeat daily={m.daily} start={m.data.start} />
    </Card>
    <Card title="Bajo el agua" icon="down" sub="Caída desde el máximo previo" className="span-5 rise">
      <DrawdownChart data={m.curve} />
      <dl className="stats three">
        <Stat k="Volatilidad anual." v={m.vol == null ? "—" : pct(m.vol)} help="Desviación típica de las sesiones × √252" />
        <Stat k="Sharpe" v={num(m.sharpe)} help={`Rentabilidad sobre volatilidad, anualizada${m.data.rf ? ` (rf ${pct(m.data.rf)} · ${m.data.rf_src ?? ""})` : " (sin tipo libre de riesgo)"}`} />
        <Stat k="Sortino" v={num(m.sortino)} help="Como Sharpe, pero solo penaliza la volatilidad a la baja" />
        <Stat k="Calmar" v={num(m.calmar)} help="Rentabilidad anualizada / drawdown máximo (con 90 días o más)" />
        <Stat k="Mejor sesión" v={m.bestDay ? sPct(m.bestDay.ret, 2) : "—"} c={tone(m.bestDay?.ret)} />
        <Stat k="Peor sesión" v={m.worstDay ? sPct(m.worstDay.ret, 2) : "—"} c={tone(m.worstDay?.ret)} />
        <Stat k="Sesiones positivas" v={m.daily.length ? `${m.greenDays}/${m.daily.length}` : "—"} />
        <Stat k="Drawdown máx." v={sPct(m.maxDD, 2)} c={m.maxDD < 0 ? "neg" : ""} />
        <Stat k="Historia" v={`${num(m.spanDays, 0)} d`} />
      </dl>
      {m.vol == null && <p className="foot">Volatilidad y ratios con 5 sesiones o más.</p>}
    </Card>
  </div>;
}
