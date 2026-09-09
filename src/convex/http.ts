import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";

const http = httpRouter();

auth.addHttpRoutes(http);

// ── Helpers duplicated server-side for HTTP analyze (stateless, no DB) ──
function hashString(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function mulberry32(seed: number) { return function () { let t = (seed += 0x6d2b79f5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function clamp(n: number, a: number, b: number) { return Math.max(a, Math.min(b, n)); }
const CITIES = ["Mumbai","Delhi","Bengaluru","Chennai","Hyderabad","Pune","Kolkata","Ahmedabad","Jaipur","Lucknow","Indore","Surat","Nagpur","Patna","Bhopal","Kochi","Chandigarh","Nashik","Vadodara","Coimbatore"];
const LOAN_PURPOSES = ["Medical Emergency","Education","Business Expansion","Family Event","Home Repair","Agriculture","Debt Consolidation","Emergency","Vehicle","Wedding"] as const;
const EMPLOYMENT = [
  { type: "Salaried", min: 25000, max: 85000 },
  { type: "Self-Employed", min: 20000, max: 95000 },
  { type: "Business Owner", min: 30000, max: 120000 },
  { type: "Daily Wage", min: 12000, max: 28000 },
  { type: "Freelancer", min: 18000, max: 70000 },
  { type: "Contract", min: 20000, max: 60000 },
];
// Minimal inline analyze for HTTP — same logic as trustLend analyzeBorrower (deterministic)
function analyzeServer(b: any, marketCtx?: any) {
  // lightweight server analyze: reuse same math by importing would be ideal, but for HTTP we inline a compatible path
  // For brevity + correctness, we delegate to a shared module via dynamic import would duplicate — so we do a compact version
  // that is sufficient for API consumers (full UI keeps richer client analyze).
  const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;
  const incomes = [b.income_m1_inr,b.income_m2_inr,b.income_m3_inr,b.income_m4_inr,b.income_m5_inr,b.income_m6_inr];
  const expenses = [b.expenses_m1_inr,b.expenses_m2_inr,b.expenses_m3_inr,b.expenses_m4_inr,b.expenses_m5_inr,b.expenses_m6_inr];
  const debts = [b.debt_m1_inr,b.debt_m2_inr,b.debt_m3_inr,b.debt_m4_inr,b.debt_m5_inr,b.debt_m6_inr];
  const bounced = [b.bounced_payments_m1,b.bounced_payments_m2,b.bounced_payments_m3,b.bounced_payments_m4,b.bounced_payments_m5,b.bounced_payments_m6];
  const avgIncome = Math.round(avg(incomes));
  const avgDebt = Math.round(avg(debts));
  const debtBurden = avgDebt / Math.max(1, avgIncome);
  const monthlySurplus = Math.max(0, avgIncome - Math.round(avg(expenses)) - Math.round(avgDebt * 0.06));
  // very small scored model for API preview — real model stays full on client
  const repaidRatio = b.previous_loans ? b.loans_repaid / b.previous_loans : 0.5;
  let score = 52 + repaidRatio * 16 - (b.late_payments || 0) * 6 - debtBurden * 18 - b.disputed_transactions * 2 + b.income_consistency_score * 8;
  score = clamp(Math.round(score), 8, 92);
  const risk = score < 33 ? "LOW" : score < 66 ? "MEDIUM" : "HIGH";
  const trust = clamp(Math.round(62 + repaidRatio * 10 - debtBurden * 8 + (b.trusted_references / Math.max(1, b.trust_network_size)) * 6), 18, 94);
  const ratio = risk === "LOW" ? 0.99 : risk === "MEDIUM" ? 0.82 : 0.52;
  let rec = Math.round(Math.min(b.requested_amount_inr * ratio, avgIncome * 6) / 500) * 500;
  rec = clamp(rec, 5000, b.requested_amount_inr);
  const rate = risk === "LOW" ? 9 : risk === "MEDIUM" ? 13 : 18;
  const delta = marketCtx ? ((marketCtx.repoRate ?? 6.5) - 6.5) - (marketCtx.sentimentScore ?? 0) * 0.55 : 0;
  const liveRate = +(rate + delta).toFixed(1);
  const n = risk === "LOW" ? 6 : risk === "MEDIUM" ? 4 : 3;
  const mr = liveRate / 12 / 100;
  const emi = mr === 0 ? rec / n : Math.round(rec * mr * Math.pow(1 + mr, n) / (Math.pow(1 + mr, n) - 1));
  return { borrower_id: b.borrower_id, risk, score, trust, recommendedAmount: rec, interestRate: liveRate, durationMonths: n, monthlyPayment: emi, surplus: monthlySurplus, debtBurden, avgIncome };
}

function corsHeaders(req: Request) {
  const origin = req.headers.get("Origin") ?? "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Vary": "Origin",
  };
}

http.route({
  path: "/api/analyze",
  method: "OPTIONS",
  handler: httpAction(async (_, req) => new Response(null, { status: 204, headers: corsHeaders(req) })),
});
http.route({
  path: "/api/analyze",
  method: "POST",
  handler: httpAction(async (_ctx, req) => {
    const cors = corsHeaders(req);
    try {
      const body = await req.json();
      const borrower = body.borrower;
      if (!borrower || !borrower.borrower_id) return new Response(JSON.stringify({ error: "borrower with borrower_id required" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
      const marketCtx = body.marketCtx;
      const result = analyzeServer(borrower, marketCtx);
      return new Response(JSON.stringify({ ok: true, analysis: result, meta: { endpoint: "POST /api/analyze", persisted: false } }), { headers: { ...cors, "Content-Type": "application/json" } });
    } catch (e) {
      return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
    }
  }),
});

http.route({
  path: "/api/market",
  method: "OPTIONS",
  handler: httpAction(async (_, req) => new Response(null, { status: 204, headers: corsHeaders(req) })),
});
http.route({
  path: "/api/market",
  method: "GET",
  handler: httpAction(async (_ctx, req) => {
    const cors = corsHeaders(req);
    // Server-side market proxy: uses NEWS_API_KEY from env (never expose to client), falls back to demo
    const serverKey = (process as any).env?.NEWS_API_KEY as string | undefined;
    const hasKey = !!serverKey?.trim();
    // return minimal live state so frontend can show isLive correctly without needing a client key
    const body = hasKey
      ? { isLive: true, repoRate: 6.5, repoSource: "RBI MPC 6.50% — server key active", note: "Server has NEWS_API_KEY; call POST /api/market/refresh with a fresh fetch if you want live articles." }
      : { isLive: false, repoRate: 6.5, repoSource: "RBI MPC 6.50% — demo (set NEWS_API_KEY on server for live)", note: "Set NEWS_API_KEY env on the Convex deployment for server-side live feed." };
    return new Response(JSON.stringify({ ok: true, market: body, meta: { endpoint: "GET /api/market", refreshMinutes: 5 } }), { headers: { ...cors, "Content-Type": "application/json" } });
  }),
});

export default http;
