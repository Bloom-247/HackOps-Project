import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

const schema = defineSchema(
  {
    ...authTables,

    users: defineTable({
      name: v.optional(v.string()),
      image: v.optional(v.string()),
      email: v.optional(v.string()),
      emailVerificationTime: v.optional(v.number()),
      isAnonymous: v.optional(v.boolean()),
      role: v.optional(roleValidator),
    }).index("email", ["email"]),

    // Custom borrowers (USER rows, team-scoped). 51 columns stored flat + owner branch.
    borrowers: defineTable({
      ownerId: v.optional(v.id("users")),
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
      identity_verified: v.boolean(),
      bank_statement_verified: v.boolean(),
      income_document_verified: v.boolean(),
      document_quality_score: v.number(),
      transaction_variance_score: v.number(),
      income_consistency_score: v.number(),
      trust_network_size: v.number(),
      trusted_references: v.number(),
      disputed_transactions: v.number(),
      account_age_months: v.number(),
    })
      .index("by_borrower_id", ["borrower_id"])
      .index("by_owner", ["ownerId"]),

    trustEvents: defineTable({
      ownerId: v.optional(v.id("users")),
      borrowerId: v.string(),
      kind: v.union(v.literal("APPROVED"), v.literal("REPAID_ON_TIME"), v.literal("REPAID_LATE"), v.literal("DEFAULTED"), v.literal("MANUAL_BOOST")),
      delta: v.number(),
      scoreBefore: v.number(),
      scoreAfter: v.number(),
      note: v.string(),
      at: v.number(),
    })
      .index("by_borrower", ["borrowerId"])
      .index("by_owner", ["ownerId"]),

    teamNotes: defineTable({
      ownerId: v.optional(v.id("users")),
      borrowerId: v.string(),
      author: v.string(),
      text: v.string(),
      createdAt: v.number(),
    })
      .index("by_borrower", ["borrowerId"])
      .index("by_owner", ["ownerId"]),

    bookings: defineTable({
      ownerId: v.optional(v.id("users")),
      borrowerId: v.string(),
      kind: v.string(),
      status: v.string(),
      scheduledAt: v.optional(v.number()),
      amount: v.optional(v.number()),
      note: v.optional(v.string()),
      createdAt: v.number(),
    })
      .index("by_owner", ["ownerId"])
      .index("by_borrower", ["borrowerId"]),
  },
  { schemaValidation: false },
);

export default schema;
