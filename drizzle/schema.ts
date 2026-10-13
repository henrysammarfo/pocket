import {
  bigint,
  boolean,
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const households = pgTable("households", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().default("My household"),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const members = pgTable(
  "members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id").references(() => households.id, { onDelete: "set null" }),
    privyUserId: text("privy_user_id").notNull(),
    walletAddress: text("wallet_address"),
    displayName: text("display_name"),
    email: text("email"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("members_privy_user_id_uidx").on(t.privyUserId)],
);

export const householdMembers = pgTable(
  "household_members",
  {
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.householdId, t.memberId] })],
);

export const threads = pgTable(
  "threads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("New money plan"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("threads_member_idx").on(t.memberId, t.updatedAt)],
);

export const threadMessages = pgTable(
  "thread_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => threads.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    messageId: text("message_id").notNull(),
    role: text("role").notNull(),
    parts: jsonb("parts").notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("thread_messages_thread_message_uidx").on(t.threadId, t.messageId),
    index("thread_messages_thread_idx").on(t.threadId, t.createdAt),
  ],
);

export const moneyPlans = pgTable(
  "money_plans",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    threadId: uuid("thread_id").references(() => threads.id, { onDelete: "set null" }),
    title: text("title").notNull().default("Money plan"),
    status: text("status").notNull().default("draft"),
    currency: text("currency").notNull().default("USD"),
    reserveFloorCents: bigint("reserve_floor_cents", { mode: "number" }).notNull().default(20_000),
    spendingCapCents: bigint("spending_cap_cents", { mode: "number" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    planJson: jsonb("plan_json").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("money_plans_member_idx").on(t.memberId, t.status)],
);

export const planRules = pgTable(
  "plan_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => moneyPlans.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    label: text("label").notNull(),
    config: jsonb("config").notNull().default({}),
    pinned: boolean("pinned").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("plan_rules_plan_idx").on(t.planId)],
);

export const intents = pgTable(
  "intents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => moneyPlans.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    source: text("source").notNull().default("typed"),
    rawText: text("raw_text").notNull(),
    parsed: jsonb("parsed").notNull().default({}),
    status: text("status").notNull().default("proposed"),
    denyReason: text("deny_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("intents_plan_idx").on(t.planId, t.createdAt)],
);

export const settlements = pgTable(
  "settlements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    intentId: uuid("intent_id")
      .notNull()
      .references(() => intents.id, { onDelete: "cascade" }),
    planId: uuid("plan_id")
      .notNull()
      .references(() => moneyPlans.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    rail: text("rail").notNull().default("agora"),
    status: text("status").notNull(),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull().default(0),
    asset: text("asset").notNull().default("AUSD"),
    txHash: text("tx_hash"),
    explorerUrl: text("explorer_url"),
    receiptJson: jsonb("receipt_json").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("settlements_member_idx").on(t.memberId, t.createdAt)],
);

export const receipts = pgTable(
  "receipts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    settlementId: uuid("settlement_id").references(() => settlements.id, { onDelete: "cascade" }),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    plainEnglish: text("plain_english").notNull(),
    kind: text("kind").notNull(),
    envioEntityId: text("envio_entity_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("receipts_household_idx").on(t.householdId, t.createdAt)],
);
