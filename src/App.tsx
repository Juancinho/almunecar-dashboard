import { useState } from "react";
import { decrypt, Enc } from "./crypto";
import type { Data } from "./types";
import Dashboard from "./Dashboard";

export default function App() {
  const [data, setData] = useState<Data | null>(null);
  const [pw, setPw] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  async function unlock(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    try {
      if (import.meta.env.DEV && pw === "mock") {           // solo en local: public/mock.json (gitignored)
        setData(await (await fetch("./mock.json")).json()); return;
      }
      const enc: Enc = await (await fetch(`./data.enc.json?t=${Date.now()}`, { cache: "no-store" })).json();
      setData(await decrypt<Data>(enc, pw));
    } catch { setErr("Contraseña incorrecta o datos no disponibles"); } finally { setBusy(false); }
  }
  if (data) return <Dashboard d={data} />;
  return (
    <div className="lock"><form onSubmit={unlock}>
      <img src="./logo.svg" alt="Almuñécar Capital" />
      <h1>Dashboard de Almuñécar Capital</h1><p>Acceso privado</p>
      <input type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="Contraseña" autoFocus autoComplete="current-password" />
      <button disabled={busy}>{busy ? "Descifrando…" : "Entrar"}</button><div className="err">{err}</div>
    </form></div>
  );
}
