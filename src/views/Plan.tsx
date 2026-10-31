import { useMemo } from "react";
import { ago, hhmm, longDate, madridEpoch, pct, sEur, tone, usd } from "../metrics";
import { DivergingBars, HBars } from "../charts";
import { Card, Empty, useNow } from "../ui";
import type { ViewProps } from "./shared";

export default function Plan({ d, m, open }: ViewProps) {
  const now = useNow();
  const skipped = useMemo(() => {
    const g = new Map<string, string[]>(); for (const s of d.plan?.skipped ?? []) g.set(s.why, [...(g.get(s.why) ?? []), s.symbol]);
    return [...g.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [d.plan]);
  const evals = Object.entries(d.last_eval ?? {}).sort((a, b) => b[1].t.localeCompare(a[1].t));
  const thesisRows = useMemo(() => {
    const agg = new Map(m.byThesis.map(t => [t.thesis, t]));
    return [...new Set([...Object.keys(d.theses), ...agg.keys()])].map(k => ({ k, desc: d.theses[k] ?? "", a: agg.get(k), open: m.positions.filter(p => p.thesis === k) }));
  }, [m.byThesis, m.positions, d.theses]);
  const watch = (k: string) => /vigilancia/i.test(d.theses[k] ?? "");
  const rel = (s?: string) => { const t = s ? madridEpoch(s) : null; return t ? ago(now - t) : "—"; };
  const until = (s?: string) => { const t = s ? madridEpoch(s) : null; if (!t) return "—"; const mins = Math.round((t - now) / 6e4); return mins < -5 ? `con retraso (${ago(now - t)})` : mins <= 0 ? "ahora" : mins < 60 ? `en ${mins} min` : `en ${Math.round(mins / 60)} h`; };

  return <div className="grid">
    <Card title="Plan del día" icon="list" sub={d.plan ? longDate(d.plan.date) : undefined} className="span-7 rise">
      {d.plan ? <>
        <div className="lbl">Candidatos</div>
        <div className="cands">{d.plan.candidates.length ? d.plan.candidates.map(c => <button key={c} className="cand" onClick={() => open(c)}><i />{c}</button>) : <span className="muted">Ninguno hoy</span>}</div>
        {skipped.length > 0 && <>
          <div className="lbl">Descartados · {d.plan.skipped.length}</div>
          <div className="skips">{skipped.map(([why, syms]) => <div key={why} className="skip">
            <span className="skip-why">{why}<em>{syms.length}</em></span>
            <div className="skip-s">{syms.map(s => <span key={s}>{s}</span>)}</div>
          </div>)}</div>
        </>}
      </> : <Empty icon="list" title="Sin plan publicado" />}
    </Card>
    <Card title="Evaluación intradía" icon="eye" sub="Última revisión de cada valor" className="span-5 rise">
      {evals.length ? <ul className="evals">{evals.map(([s, e]) => <li key={s} onClick={() => open(s)}><b>{s}</b><span>{e.why}</span><time>{hhmm(e.t)}</time></li>)}</ul> :
        <Empty icon="eye" title="Sin evaluaciones todavía">Aparecerán cuando el bot revise posiciones o candidatos durante la sesión.</Empty>}
    </Card>

    <Card title="Intel del briefing" icon="book" sub={d.intel?.generated_at ? `intel.json · ${longDate(d.intel.generated_at)}` : "intel.json"} className="span-12 rise">
      {!d.intel ? <Empty icon="book" title="Sin intel publicado" /> : <>
        {d.intel.stale && <p className="warn-line">⚠ {d.intel.warn}. Todas las entradas quedan bloqueadas hasta el próximo briefing.</p>}
        <div className="tw"><table>
          <thead><tr><th>Valor</th><th>Tesis</th><th>Postura</th><th className="n">Convicción</th><th>¿Puede entrar?</th><th>Nota</th></tr></thead>
          <tbody>{Object.entries(d.intel.instruments).map(([s, x]) => {
            const bl = d.intel!.blackouts.find(b => b.active && (!b.symbol || b.symbol === s));
            const ok = x.stance === "long" && !bl && !d.intel!.stale;
            return <tr key={s} onClick={() => open(s)} className="click"><td><b>{s}</b>{d.plan?.candidates.includes(s) && <span className="muted"> · candidato</span>}</td>
              <td><span className="tag">{x.thesis}</span></td><td><span className={`tag ${x.stance === "long" ? "pos" : x.stance === "avoid" ? "neg" : ""}`}>{({ long: "Largo", neutral: "Neutral", avoid: "Evitar" } as Record<string, string>)[x.stance] ?? x.stance}</span></td>
              <td className="n">{x.conviction != null ? pct(x.conviction, 0) : "—"}</td>
              <td className={ok ? "pos" : "muted"}>{ok ? "Sí, si hay señal e intradía favorable" : bl ? "No · blackout" : x.stance === "long" ? "No" : `No · postura ${x.stance}`}</td>
              <td className="muted">{x.notes ?? ""}</td></tr>;
          })}</tbody></table></div>
        <div className="lbl" style={{ marginTop: 16 }}>Blackouts por eventos</div>
        {d.intel.blackouts.length ? <ul className="evals">{d.intel.blackouts.map((b, i) => <li key={i}>
          <b>{b.active ? "ACTIVO" : longDate(b.start)}</b><span>{b.symbol ? `${b.symbol}: ` : ""}{b.reason}{b.verified || /verificad/i.test(b.reason) ? "" : " (no verificado)"}</span><time>{hhmm(b.start)}–{hhmm(b.end)}</time></li>)}</ul>
          : <p className="muted">Sin blackouts próximos.</p>}
        <div className="lbl" style={{ marginTop: 16 }}>Próximos catalizadores</div>
        {d.intel.catalysts.length ? <ul className="evals">{d.intel.catalysts.map((c, i) => <li key={i}>
          <b>{c.date ? longDate(c.date) : "sin fecha"}</b><span>{c.symbol ? `${c.symbol}: ` : ""}{c.event}{c.verified || /verificad/i.test(c.event) ? "" : " (no verificado)"}</span>
          <time>{c.source ? <a href={c.source} target="_blank" rel="noreferrer">fuente</a> : ""}</time></li>)}</ul> : <p className="muted">Sin catalizadores.</p>}
      </>}
    </Card>
    <Card title="Tesis de inversión" icon="book" sub="Resultado, exposición y posiciones de cada tesis" className="span-7 rise">
      {thesisRows.length ? <ul className="theses">{thesisRows.map(t => <li key={t.k}>
        <span className={`code ${watch(t.k) ? "watch" : ""}`}>{t.k}</span>
        <div className="th-b"><p>{t.desc || "—"}</p>
          <div className="th-m">{watch(t.k) && <span className="tag">Solo vigilancia</span>}
            {t.open.length > 0 ? t.open.map(p => <button key={p.symbol} className="mini-chip" onClick={() => open(p.symbol)}>{p.symbol}</button>) : <span>Sin posiciones</span>}
            {t.a && t.a.exposure > 0 && <span>{pct(t.a.exposure)} del equity</span>}
            <span>{t.a?.trades ?? 0} cerradas</span></div></div>
        <em className={tone(t.a?.total)}>{t.a ? sEur(t.a.total) : "—"}</em>
      </li>)}</ul> : <Empty icon="book" title="Sin tesis definidas" />}
      {m.byThesis.some(t => t.total !== 0) && <><div className="lbl" style={{ marginTop: 18 }}>Contribución al resultado</div>
        <DivergingBars rows={m.byThesis.map(t => ({ k: t.thesis, v: t.total, sub: `${sEur(t.realized)} real. · ${sEur(t.unrealized)} no real.` }))} /></>}
    </Card>

    <div className="span-5 stack">
      <Card title="Estado del bot" icon="cpu" sub={d.bot?.version ? `Versión ${d.bot.version}` : "Latido del proceso en el box"} className="rise">
        <dl className="stats">
          <div><dt>Trading</dt><dd className={d.halted ? "neg" : "pos"}>{d.halted ? "Detenido" : "Activo"}</dd></div>
          <div><dt>Último dato</dt><dd>{m.updatedTs ? ago(now - m.updatedTs) : d.updated}</dd></div>
          <div><dt>Último ciclo</dt><dd>{d.bot?.last_run ? rel(d.bot.last_run) : "—"}</dd></div>
          <div><dt>Próximo ciclo</dt><dd>{d.bot?.next_run ? until(d.bot.next_run) : "—"}</dd></div>
        </dl>
        {d.bot?.status && <p className="bot-status">{d.bot.status}</p>}
        {d.bot?.errors?.length ? <><div className="lbl" style={{ marginTop: 14 }}>Errores recientes</div>
          <ul className="errs">{d.bot.errors.slice(-5).reverse().map((e, i) => <li key={i}><time>{longDate(e.t)}</time><span>{e.msg}</span></li>)}</ul></>
          : d.bot ? <p className="ok-line">Sin errores recientes.</p>
          : <p className="foot">Con el campo <code>bot</code> (last_run, next_run, status, errors) aquí verás el latido real del proceso y sus errores.</p>}
      </Card>
      <Card title="Fricción" icon="coins" sub="Costes de operar, en USD" className="rise">
        <HBars rows={m.friction.map(f => ({ k: f.k, v: f.v }))} fmt={usd} />
        {m.frictionTotals.length > 0 && <div className="totals">{m.frictionTotals.map(t => <div key={t.k}><span>{t.k}</span><b>{usd(t.v)}</b></div>)}</div>}
      </Card>
    </div>
  </div>;
}
