# Dashboard de Almuñécar Capital

Es una app React (Vite + TypeScript + Recharts). **El repositorio es público y solo contiene código.** Los datos viven en `public/data.enc.json`, cifrados con AES-256-GCM. La clave sale de la contraseña con PBKDF2-SHA256 (600.000 iteraciones), y la página los descifra en el navegador con WebCrypto.

## Cómo llegan las actualizaciones
1. En el box, un script de Python sin IA genera los datos, los cifra y hace commit y push **solo** de `public/data.enc.json`.
2. GitHub Actions (`.github/workflows/pages.yml`) compila y despliega en Pages con cada push.

## Editar la interfaz en local
```bash
npm install
npm run mock         # genera public/mock.json con datos sintéticos (gitignored)
npm run dev          # http://localhost:5173 · contraseña "mock"
```
- `public/mock.json` está en .gitignore: **no lo subas nunca**. El atajo `mock` solo existe en modo `dev`.
- Estructura:
  - `src/App.tsx`: pantalla de acceso, descifrado y refresco automático cada 2 min (la contraseña solo vive en memoria).
  - `src/Dashboard.tsx`: secciones del panel. `src/charts.tsx`: gráficos (Recharts + SVG). `src/ui.tsx`: tarjetas, iconos, tema.
  - `src/metrics.ts`: métricas derivadas en el navegador (drawdown, Sharpe, acierto, profit factor…) y normalización de fechas.
  - `src/style.css`: tema *liquid glass* claro/oscuro. El color corporativo es el marino #1F3A5F; la paleta de series está validada para daltonismo.
  - `src/Logo.tsx` inyecta `public/logo.svg` en línea para que sus tintas sigan al tema; no edites el SVG.
- No cambies `src/crypto.ts` ni los nombres de campos de `src/types.ts`, porque los usa el script del box.
- No subas nunca datos en claro (`*.json` que no esté cifrado) ni identificadores de cuenta.
