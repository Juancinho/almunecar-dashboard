# Dashboard de Almuñécar Capital

Es una app React (Vite + TypeScript + Recharts). **El repositorio es público y solo contiene código.** Los datos viven en `public/data.enc.json`, cifrados con AES-256-GCM. La clave sale de la contraseña con PBKDF2-SHA256 (600.000 iteraciones), y la página los descifra en el navegador con WebCrypto.

## Cómo llegan las actualizaciones
1. En el box, un script de Python sin IA genera los datos, los cifra y hace commit y push **solo** de `public/data.enc.json`.
2. GitHub Actions (`.github/workflows/pages.yml`) compila y despliega en Pages con cada push.

## Editar la interfaz en local
```bash
npm install
npm run dev          # http://localhost:5173
```
- Para trabajar con datos de prueba, crea `public/mock.json` con la forma de `src/types.ts`. Ese fichero está en .gitignore: **no lo subas nunca**. En modo `dev`, escribe la contraseña `mock` para cargarlo. En producción no existe ese atajo.
- Puedes cambiar libremente:
  - `src/Dashboard.tsx`, que es el diseño y las secciones;
  - `src/style.css`, que tiene la paleta de los briefings (marino #1F3A5F, oro #B07D3A);
  - `src/App.tsx`, que es la pantalla de acceso.
- No cambies `src/crypto.ts` ni los nombres de campos de `src/types.ts`, porque los usa el script del box.
- No subas nunca datos en claro (`*.json` que no esté cifrado) ni identificadores de cuenta.
