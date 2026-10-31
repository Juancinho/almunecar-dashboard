// Contrato de datos con dashboard.py (build_data). Si cambias un campo aquí, cámbialo también allí.
export interface Point { t: string; eq: number }
export interface Position { symbol: string; kind: string; thesis: string; qty: number; entry: number; last: number; stop: number; stop_type: string; target: number; pnl_eur: number }
export interface Trade { time: string; side: "BUY" | "SELL"; qty: number; symbol: string; price: number; thesis: string; reason: string; cost: number | null; pnl_eur: number | null }
export interface Data {
  updated: string; base: number; equity: number; cash: number; fees_usd: number; halted: boolean; halt_reason: string | null;
  curve: Point[]; positions: Position[]; trades: Trade[];
  plan: { date: string; candidates: string[]; skipped: { symbol: string; why: string }[] } | null;
  last_eval?: Record<string, { t: string; why: string }>;
  friction: Record<string, number>; theses: Record<string, string>;
}
