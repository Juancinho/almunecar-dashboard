import { useEffect, useState } from "react";

// El logo oficial (public/logo.svg) se inyecta en línea para que sus dos tintas sigan al tema:
// marino #1F3A5F → var(--logo-ink) y gris acero de la ola inferior → var(--logo-wave).
const NAVY = "rgb(12.199402%, 22.698975%, 37.298584%)";
const WAVE = "rgb(51.699829%, 57.499695%, 65.499878%)";
let cache: Promise<string> | null = null;
const load = () => (cache ??= fetch("./logo.svg").then(r => r.text()).then(s => s
  .replace(/<\?xml[^>]*\?>/, "")
  .replace(/ width="[^"]*" height="[^"]*"/, "")
  .split(`stroke="${NAVY}"`).join(`style="stroke:var(--logo-ink)"`)
  .split(`fill="${NAVY}"`).join(`style="fill:var(--logo-ink)"`)
  .split(`stroke="${WAVE}"`).join(`style="stroke:var(--logo-wave)"`)));

/** variant="full": símbolo + nombre · variant="mark": solo el sol y las olas */
export default function Logo({ variant = "full", className = "" }: { variant?: "full" | "mark"; className?: string }) {
  const [svg, setSvg] = useState("");
  useEffect(() => { let on = true; load().then(s => on && setSvg(s)).catch(() => {}); return () => { on = false; }; }, []);
  const html = svg.replace(/viewBox="[^"]*"/, variant === "mark" ? 'viewBox="6 6 64 58"' : 'viewBox="6 6 284 58"');
  return <span className={`logo logo-${variant} ${className}`} role="img" aria-label="Almuñécar Capital"
    dangerouslySetInnerHTML={{ __html: html }} />;
}
