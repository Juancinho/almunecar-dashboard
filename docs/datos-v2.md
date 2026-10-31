# Datos v2 para el dashboard (para el script del box)

Todos los campos nuevos son **opcionales**. El panel ya funciona sin ellos y muestra una tarjeta "Pendiente de datos del bot" donde falten. No cambia nada de lo que ya se envía: solo se añaden claves al JSON que `dashboard.py` (`build_data`) cifra en `public/data.enc.json`.

Las fechas pueden ir en cualquiera de los formatos que ya se usan (`AAAA-MM-DD HH:MM`, `DD-MM-AAAA HH:MM`, `MM-DD HH:MM`, ISO), siempre en **hora de Madrid**.

## Prioridad alta

### `bench`: índice de referencia (activa alpha, beta y la comparativa)
```json
"bench": { "name": "SPY", "curve": [{ "t": "10-31 17:23", "eq": 571.32 }, …] }
```
- Una muestra por **cada** punto de `curve`, con el **mismo `t`**. El valor puede ser el precio de cierre o el último precio: el panel lo normaliza a base 100.
- Usad el índice que represente lo que el bot quiere batir. Para una cartera mixta de semis y Tesoro puede valer una mezcla (p. ej. 60 % SPY + 40 % IEF), calculada en el box.
- Con esto el panel calcula: alpha de Jensen anualizada, beta, correlación, tracking error, information ratio, captura alcista y bajista, y exceso acumulado.

### `fx_eurusd`: cambio EUR/USD
```json
"fx_eurusd": 1.0870
```
- Son USD por 1 EUR, el último cambio que use el bot.
- Sirve para pasar a euros el riesgo hasta el stop, la recompensa, el valor de las posiciones y los costes. Sin este campo, el panel deduce el cambio a partir de lo invertido, pero solo funciona si hay posiciones abiertas.

### `positions[].opened`: apertura de cada posición
```json
{ "symbol": "IDTP", …, "opened": "2026-10-14 16:05" }
```
- Muestra los días en cartera en la ficha de la posición.

### `orders`: órdenes vivas en IBKR
```json
"orders": [{ "symbol": "IDTP", "side": "SELL", "type": "TRAIL", "qty": 12, "price": 23.4, "status": "Submitted", "placed": "2026-10-14 16:05" }]
```
- Salen de `ib.openTrades()` / `reqAllOpenOrders()`. `price` es el `auxPrice` del stop o el `lmtPrice` (o `null` si es a mercado).
- El panel avisa si una posición abierta no tiene una orden de venta viva. Así se ve si el stop existe de verdad en el bróker y no solo en el ledger.

### `bot`: latido del proceso
```json
"bot": { "last_run": "2026-10-31 17:32", "next_run": "2026-10-31 17:37", "status": "Evaluando posiciones", "version": "1.4.2",
         "errors": [{ "t": "2026-10-31 16:02", "msg": "Timeout API IBKR (reintentado)" }] }
```
- `errors`: los últimos 5 a 10 errores o avisos que no detienen el trading.
- Con `next_run`, el panel muestra cuándo toca el siguiente ciclo. Si pasan más de 20 min sin datos con la NYSE abierta, ya avisa aunque no exista este campo.

## Prioridad media

### `rf`: tipo libre de riesgo anual
```json
"rf": 0.043
```
- Por ejemplo, la letra del Tesoro a 3 meses. Se usa en Sharpe, Sortino y alpha; sin él se toma 0.

## Ideas para más adelante (aún no se muestran)
- `trades[].mae_eur` / `mfe_eur`: la peor y la mejor excursión de cada operación mientras estuvo abierta. Sirven para saber si los stops están demasiado ajustados o si se deja dinero en la mesa.
- `trades[].signal`: la puntuación o confianza de la señal de entrada, para comparar la calidad de la señal con el resultado.
- `plan.candidates` con puntuación: `[{ "symbol": "IDTP", "score": 0.72 }]` en lugar de solo el texto.
