// LendSure proper backend — persisted borrowers, trust ledger, notes, bookings
// and market-aware analyze endpoint. All team-scoped via ownerId (Convex Auth).

import { v } from "convex/values";
import { query, mutation, action } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// ---- helpers to resolve owner scoping (guest/anonymous allowed, but persisted when signed in)
async function ownerId(ctx: any): Promise<any> {
  const uid = await getAuthUserId(ctx);
  return uid ?? undefined;
}

// Borrower field validator (51 cols)
const borrowerFields = {
  borrower_id: v.string(),
  age: v.number(),
  city: v.string(),
  employment_type: v.string(),
  employment_stability_months: v.number(),
  requested_amount_inr: v.number(),
  loan_purpose: v.string(),
  previous_loans: v.number(),
  loans_repaid: v.number(),
  late_payments: v.number(),
  average_delay_days: v.number(),
  income_m1_inr: v.number(), income_m2_inr: v.number(), income_m3_inr: v.number(), income_m4_inr: v.number(), income_m5_inr: v.number(), income_m6_inr: v.number(),
  expenses_m1_inr: v.number(), expenses_m2_inr: v.number(), expenses_m3_inr: v.number(), expenses_m4_inr: v.number(), expenses_m5_inr: v.number(), expenses_m6_inr: v.number(),
  debt_m1_inr: v.number(), debt_m2_inr: v.number(), debt_m3_inr: v.number(), debt_m4_inr: v.number(), debt_m5_inr: v.number(), debt_m6_inr: v.number(),
  transactions_m1: v.number(), transactions_m2: v.number(), transactions_m3: v.number(), transactions_m4: v.number(), transactions_m5: v.number(), transactions_m6: v.number(),
  bounced_payments_m1: v.number(), bounced_payments_m2: v.number(), bounced_payments_m3: v.number(), bounced_payments_m4: v.number(), bounced_payments_m5: v.number(), bounced_payments_m6: v.number(),
  identity_verified: v.boolean(), bank_statement_verified: v.boolean(), income_document_verified: v.boolean(),
  document_quality_score: v.number(), transaction_variance_score: v.number(), income_consistency_score: v.number(),
  trust_network_size: v.number(), trusted_references: v.number(), disputed_transactions: v.number(), account_age_months: v.number(),
};

// ── Borrowers

export const listBorrowers = query({
  args: {},
  handler: async (ctx) => {
    const oid = await ownerId(ctx);
    if (!oid) return [];
    const rows = await ctx.db.query("borrowers").withIndex("by_owner", (q) => q.eq("ownerId", oid)).collect();
    return rows;
  },
});

export const getBorrower = query({
  args: { borrowerId: v.string() },
  handler: async (ctx, { borrowerId }) => {
    const oid = await ownerId(ctx);
    if (!oid) return null;
    const rows = await ctx.db.query("borrowers").withIndex("by_borrower_id", (q) => q.eq("borrower_id", borrowerId)).collect();
    // prefer owner-scoped match, fall back to team-shared if owner undefined
    const mine = rows.find((r) => r.ownerId === oid);
    return mine ?? rows[0] ?? null;
  },
});

export const upsertBorrower = mutation({
  args: borrowerFields,
  handler: async (ctx, doc) => {
    const oid = await ownerId(ctx);
    if (!oid) throw new Error("Sign in to save borrowers");
    const existing = await ctx.db.query("borrowers").withIndex("by_borrower_id", (q) => q.eq("borrower_id", doc.borrower_id)).collect();
    const mine = existing.find((r) => r.ownerId === oid);
    if (mine) {
      await ctx.db.patch(mine._id, { ...doc, ownerId: oid } as any);
      return mine._id;
    }
    // guard duplicate global id
    if (existing.length && !mine) throw new Error(`Borrower ID ${doc.borrower_id} already exists`);
    const id = await ctx.db.insert("borrowers", { ...doc, ownerId: oid } as any);
    return id;
  },
});

export const bulkUpsertBorrowers = mutation({
  args: { borrowers: v.array(v.object(borrowerFields)) },
  handler: async (ctx, { borrowers }) => {
    const oid = await ownerId(ctx);
    if (!oid) throw new Error("Sign in to save borrowers");
    const inserted: string[] = [];
    const errors: string[] = [];
    for (let i = 0; i < borrowers.length; i++) {
      const doc = borrowers[i];
      try {
        const existing = await ctx.db.query("borrowers").withIndex("by_borrower_id", (q) => q.eq("borrower_id", doc.borrower_id)).collect();
        const mine = existing.find((r) => r.ownerId === oid);
        if (existing.length && !mine) { errors.push(`Row ${i + 1}: Borrower ID ${doc.borrower_id} already exists`); continue; }
        if (mine) await ctx.db.patch(mine._id, { ...doc, ownerId: oid } as any);
        else await ctx.db.insert("borrowers", { ...doc, ownerId: oid } as any);
        inserted.push(doc.borrower_id);
      } catch (e) {
        errors.push(`Row ${i + 1}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    return { inserted, errors };
  },
});

export const deleteBorrower = mutation({
  args: { borrowerId: v.string() },
  handler: async (ctx, { borrowerId }) => {
    const oid = await ownerId(ctx);
    if (!oid) throw new Error("Sign in required");
    const rows = await ctx.db.query("borrowers").withIndex("by_borrower_id", (q) => q.eq("borrower_id", borrowerId)).collect();
    const mine = rows.find((r) => r.ownerId === oid);
    if (!mine) throw new Error("Not found");
    await ctx.db.delete(mine._id);
    return true;
  },
});

// ── Trust ledger

export const listTrustEvents = query({
  args: { borrowerId: v.string() },
  handler: async (ctx, { borrowerId }) => {
    const oid = await ownerId(ctx);
    if (!oid) return [];
    const rows = await ctx.db.query("trustEvents").withIndex("by_borrower", (q) => q.eq("borrowerId", borrowerId)).collect();
    return rows.filter((r) => !r.ownerId || r.ownerId === oid).sort((a, b) => a.at - b.at);
  },
});

export const addTrustEvent = mutation({
  args: {
    borrowerId: v.string(),
    kind: v.union(v.literal("APPROVED"), v.literal("REPAID_ON_TIME"), v.literal("REPAID_LATE"), v.literal("DEFAULTED"), v.literal("MANUAL_BOOST")),
    delta: v.number(),
    scoreBefore: v.number(),
    scoreAfter: v.number(),
    note: v.string(),
  },
  handler: async (ctx, { borrowerId, kind, delta, scoreBefore, scoreAfter, note }) => {
    const oid = await ownerId(ctx);
    if (!oid) throw new Error("Sign in to record trust");
    const id = await ctx.db.insert("trustEvents", { ownerId: oid, borrowerId, kind, delta, scoreBefore, scoreAfter, note, at: Date.now() } as any);
    return id;
  },
});

export const listAllTrustEvents = query({
  args: {},
  handler: async (ctx) => {
    const oid = await ownerId(ctx);
    if (!oid) return [];
    const rows = await ctx.db.query("trustEvents").withIndex("by_owner", (q) => q.eq("ownerId", oid)).collect();
    return rows.sort((a, b) => a.at - b.at);
  },
});

export const clearTrustEvents = mutation({
  args: { borrowerId: v.optional(v.string()) },
  handler: async (ctx, { borrowerId }) => {
    const oid = await ownerId(ctx);
    if (!oid) throw new Error("Sign in required");
    if (borrowerId) {
      const rows = await ctx.db.query("trustEvents").withIndex("by_borrower", (q) => q.eq("borrowerId", borrowerId)).collect();
      for (const r of rows) if (!r.ownerId || r.ownerId === oid) await ctx.db.delete(r._id);
    } else {
      const rows = await ctx.db.query("trustEvents").withIndex("by_owner", (q) => q.eq("ownerId", oid)).collect();
      for (const r of rows) await ctx.db.delete(r._id);
    }
    return true;
  },
});

// ── Team notes

export const listNotes = query({
  args: { borrowerId: v.string() },
  handler: async (ctx, { borrowerId }) => {
    const oid = await ownerId(ctx);
    if (!oid) return [];
    const rows = await ctx.db.query("teamNotes").withIndex("by_borrower", (q) => q.eq("borrowerId", borrowerId)).collect();
    return rows.filter((r) => !r.ownerId || r.ownerId === oid).sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const addNote = mutation({
  args: { borrowerId: v.string(), text: v.string() },
  handler: async (ctx, { borrowerId, text }) => {
    const oid = await ownerId(ctx);
    if (!oid) throw new Error("Sign in to comment");
    const uid = await getAuthUserId(ctx);
    const user = uid ? await ctx.db.get(uid as any) : null;
    const author = (user as any)?.email ?? (user as any)?.name ?? "Team";
    const id = await ctx.db.insert("teamNotes", { ownerId: oid, borrowerId, author: String(author), text: String(text).slice(0, 800), createdAt: Date.now() } as any);
    return id;
  },
});

// ── Bookings / checkout

export const listBookings = query({
  args: {},
  handler: async (ctx) => {
    const oid = await ownerId(ctx);
    if (!oid) return [];
    const rows = await ctx.db.query("bookings").withIndex("by_owner", (q) => q.eq("ownerId", oid)).collect();
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const createBooking = mutation({
  args: {
    borrowerId: v.string(),
    kind: v.string(),
    amount: v.optional(v.number()),
    note: v.optional(v.string()),
    scheduledAt: v.optional(v.number()),
  },
  handler: async (ctx, { borrowerId, kind, amount, note, scheduledAt }) => {
    const oid = await ownerId(ctx);
    if (!oid) throw new Error("Sign in to book");
    const id = await ctx.db.insert("bookings", { ownerId: oid, borrowerId, kind, status: "CONFIRMED", amount, note, scheduledAt, createdAt: Date.now() } as any);
    return id;
  },
});

// ── Market proxy action — hides the NewsAPI key on the server side
// Frontend calls: { apiKey?: string } but server prefers `process.env.NEWS_API_KEY` if set.
export const fetchMarketNewsAction = action({
  args: { clientApiKey: v.optional(v.string()) },
  handler: async (_ctx, { clientApiKey }) => {
    const serverKey = (process as any).env?.NEWS_API_KEY as string | undefined;
    const key = serverKey?.trim() || clientApiKey?.trim() || "";
    if (!key) {
      return { isLive: false as const, error: "No API key set. Add NEWS_API_KEY in server env or paste one in the UI. Showing demo feed." };
    }
    try {
      const url = `https://newsapi.org/v2/everything?q=RBI%20repo%20OR%20India%20inflation%20OR%20India%20interest%20rate&language=en&sortBy=publishedAt&pageSize=6&apiKey=${encodeURIComponent(key)}`;
      const res = await fetch(url);
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        if (res.status === 401) return { isLive: false as const, error: "Invalid API key — check NEWS_API_KEY. Showing demo feed.", status: 401 };
        if (res.status === 429 || res.status === 426) return { isLive: false as const, error: "NewsAPI limit reached (free tier / 426) — showing demo. Try later.", status: res.status };
        return { isLive: false as const, error: `Feed error ${res.status}: ${body.slice(0, 160)} — showing demo.`, status: res.status };
      }
      const json: any = await res.json();
      if (!Array.isArray(json.articles) || json.articles.length === 0) return { isLive: false as const, error: "No live articles right now — showing demo.", articles: [] };
      // return raw articles; client maps to MarketNews to keep sentiment logic in one place
      return { isLive: true as const, articles: json.articles.slice(0, 6) };
    } catch (e) {
      return { isLive: false as const, error: e instanceof Error ? e.message : String(e) };
    }
  },
});
