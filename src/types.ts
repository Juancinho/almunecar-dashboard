// Contrato de datos con dashboard.py (build_data). Si cambias un campo aquí, cámbialo también allí.
export interface Point { t: string; eq: number }
export interface Position {
  symbol: string; kind: string; thesis: string; qty: number; entry: number; last: number; stop: number; stop_type: string; target: number; pnl_eur: number;
  opened?: string;                  // v2: fecha/hora de apertura → días en cartera
}
export interface Trade { time: string; side: "BUY" | "SELL"; qty: number; symbol: string; price: number; thesis: string; reason: string; cost: number | null; pnl_eur: number | null }
export interface Order { symbol: string; side: "BUY" | "SELL"; type: string; qty: number; price: number | null; status: string; placed?: string }
export interface BotInfo { last_run?: string; next_run?: string; status?: string; version?: string; errors?: { t: string; msg: string }[] }
export interface Data {
  updated: string; base: number; equity: number; cash: number; fees_usd: number; halted: boolean; halt_reason: string | null;
  curve: Point[]; positions: Position[]; trades: Trade[];
  plan: { date: string; candidates: string[]; skipped: { symbol: string; why: string }[] } | null;
  last_eval?: Record<string, { t: string; why: string }>;
  friction: Record<string, number>; theses: Record<string, string>;
  // ---- v2, todos opcionales: el panel los usa si existen (ver docs/datos-v2.md) ----
  bench?: { name: string; curve: Point[]; secondary?: { name: string; curve: Point[] }[]; source?: string };  // principal (MSCI ACWI EUR) + secundarios  // índice de referencia en los mismos instantes que `curve` (precio o valor, se normaliza)
  fx_eurusd?: number;                         // USD por 1 EUR, para pasar riesgo y costes a euros
  rf?: number; rf_src?: string; fx_src?: string; start?: string;
  limits?: { max_pos_pct: number; halt_pct: number; max_positions: number; max_trades_week: number; trades_this_week: number; target_usd: number; cost_to_gain_max: number };
  intel?: Intel;
                                // tipo libre de riesgo anual (0.025 = 2,5 %) para Sharpe y alpha
  orders?: Order[];                           // órdenes vivas en IBKR (stops, límites…)
  bot?: BotInfo;                              // latido y estado del proceso
}
export interface Intel {
  generated_at: string | null; stale: boolean; warn: string | null;
  theses: Record<string, { stance: string; conviction: number; summary: string }>;
  instruments: Record<string, { thesis: string; stance: string; conviction: number; notes?: string | null }>;
  blackouts: { start: string; end: string; reason: string; verified: boolean; symbol?: string | null; active: boolean; source?: string | null }[];
  catalysts: { date: string | null; event: string; verified: boolean; symbol?: string | null; source?: string | null }[];
}
