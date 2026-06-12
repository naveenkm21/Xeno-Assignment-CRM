import { sql } from 'drizzle-orm';
import {
  pgTable,
  uuid,
  text,
  integer,
  numeric,
  timestamp,
  boolean,
  jsonb,
  index,
  uniqueIndex,
  pgEnum,
} from 'drizzle-orm/pg-core';
import {
  channelKinds,
  lifecycleStates,
  campaignStatuses,
  type CampaignPlan,
} from '@xeno/types';

export const channelEnum = pgEnum('channel_kind', channelKinds);
export const lifecycleEnum = pgEnum('lifecycle_state', lifecycleStates);
export const campaignStatusEnum = pgEnum('campaign_status', campaignStatuses);

export const customers = pgTable(
  'customers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    email: text('email'),
    phone: text('phone'),
    city: text('city').notNull(),
    optInWhatsapp: boolean('opt_in_whatsapp').notNull().default(true),
    optInEmail: boolean('opt_in_email').notNull().default(true),
    optInSms: boolean('opt_in_sms').notNull().default(false),
    tags: jsonb('tags').$type<string[]>().notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    emailIdx: index('customers_email_idx').on(t.email),
    phoneIdx: index('customers_phone_idx').on(t.phone),
    cityIdx: index('customers_city_idx').on(t.city),
  }),
);

export const orders = pgTable(
  'orders',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    total: numeric('total', { precision: 12, scale: 2 }).notNull(),
    itemCount: integer('item_count').notNull(),
    channelOrigin: text('channel_origin').notNull(), // 'web' | 'pos' | 'app'
    placedAt: timestamp('placed_at', { withTimezone: true }).notNull(),
    // Set by the receipt ingester when an order is attributed to a campaign.
    attributedCampaignId: uuid('attributed_campaign_id'),
    attributedCommId: uuid('attributed_comm_id'),
  },
  (t) => ({
    customerPlacedIdx: index('orders_customer_placed_idx').on(t.customerId, t.placedAt),
    placedIdx: index('orders_placed_idx').on(t.placedAt),
  }),
);

export const audiences = pgTable('audiences', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  // AudienceFilter from @xeno/types
  filter: jsonb('filter').notNull(),
  // Snapshot count at creation time — recomputed on every send to avoid drift.
  snapshotSize: integer('snapshot_size').notNull().default(0),
  createdBy: text('created_by').notNull(), // Clerk user id
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const campaigns = pgTable(
  'campaigns',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    goal: text('goal').notNull(), // The marketer's original plain-English brief.
    plan: jsonb('plan').$type<CampaignPlan>().notNull(),
    audienceId: uuid('audience_id')
      .notNull()
      .references(() => audiences.id),
    status: campaignStatusEnum('status').notNull().default('draft'),
    createdBy: text('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => ({
    statusIdx: index('campaigns_status_idx').on(t.status),
    createdIdx: index('campaigns_created_idx').on(t.createdAt),
  }),
);

// One row per (campaign × customer × variant). The lifecycle state is updated
// in place; the append-only event log lives in `commEvents`.
export const communications = pgTable(
  'communications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => campaigns.id, { onDelete: 'cascade' }),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    channel: channelEnum('channel').notNull(),
    variantTag: text('variant_tag').notNull(),
    body: text('body').notNull(),
    subject: text('subject'),
    state: lifecycleEnum('state').notNull().default('queued'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    lastEventAt: timestamp('last_event_at', { withTimezone: true }),
    // Filled by the receipt ingester when an order arrives within attribution window.
    attributedOrderId: uuid('attributed_order_id'),
    failureReason: text('failure_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    campaignStateIdx: index('communications_campaign_state_idx').on(t.campaignId, t.state),
    customerIdx: index('communications_customer_idx').on(t.customerId),
  }),
);

// Append-only. The (commId, state, occurredAt) triple is unique — this gives
// us idempotency: a duplicate webhook delivery is silently dropped. The
// ingester reads the latest event per commId to compute the current state.
export const commEvents = pgTable(
  'comm_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    commId: uuid('comm_id')
      .notNull()
      .references(() => communications.id, { onDelete: 'cascade' }),
    state: lifecycleEnum('state').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    meta: jsonb('meta').$type<Record<string, string | number | boolean>>(),
    receivedAt: timestamp('received_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    idempotencyUq: uniqueIndex('comm_events_idempotency_uq').on(
      t.commId,
      t.state,
      t.occurredAt,
    ),
    commOccurredIdx: index('comm_events_comm_occurred_idx').on(t.commId, t.occurredAt),
  }),
);

// Persisted copilot conversations so refreshing the chat tab doesn't drop
// context. Messages append in order, role + content + optional tool calls.
export const conversations = pgTable('conversations', {
  id: uuid('id').defaultRandom().primaryKey(),
  createdBy: text('created_by').notNull(),
  title: text('title'),
  mode: text('mode').notNull().default('plan'), // 'plan' | 'autopilot'
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => sql`now()`),
});

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    role: text('role').notNull(), // 'user' | 'assistant' | 'tool'
    content: text('content').notNull(),
    toolName: text('tool_name'),
    toolCallId: text('tool_call_id'),
    toolArgs: jsonb('tool_args'),
    toolResult: jsonb('tool_result'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    convoCreatedIdx: index('messages_convo_created_idx').on(t.conversationId, t.createdAt),
  }),
);

export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
export type Order = typeof orders.$inferSelect;
export type Campaign = typeof campaigns.$inferSelect;
export type Communication = typeof communications.$inferSelect;
export type CommEvent = typeof commEvents.$inferSelect;
export type Audience = typeof audiences.$inferSelect;
