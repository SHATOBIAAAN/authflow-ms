import { pgTable, uuid, varchar, boolean, timestamp, text, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';

const uuidPrimaryKey = () => uuid('id').primaryKey().$defaultFn(() => uuidv7());

// 1. users
export const users = pgTable('users', {
  id: uuidPrimaryKey(),
  username: varchar('username', { length: 50 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  role: varchar('role', { length: 20 }).notNull().default('user'),
  isActive: boolean('is_active').notNull().default(true),
  lastLogin: timestamp('last_login', { withTimezone: true, mode: 'date' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => ({
  usernameActiveIdx: index('users_username_active_idx').on(table.username).where(sql`is_active = true`),
}));

// 2. sessions
export const sessions = pgTable('sessions', {
  id: uuidPrimaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
  isActive: boolean('is_active').notNull().default(true),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => ({
  activeUserSessionsIdx: index('sessions_user_expires_active_idx').on(table.userId, table.expiresAt).where(sql`is_active = true`),
}));

// 3. passwordResetTokens
export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: uuidPrimaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true, mode: 'date' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => ({
  unusedTokensIdx: index('pwd_reset_token_expires_unused_idx').on(table.tokenHash, table.expiresAt).where(sql`used_at IS NULL`),
}));

// 4. auditLog
export const auditLog = pgTable('audit_log', {
  id: uuidPrimaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  action: varchar('action', { length: 100 }).notNull(),
  success: boolean('success').notNull(),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  meta: text('meta'), // JSON string
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, (table) => ({
  userActionIdx: index('audit_user_action_created_idx').on(table.userId, table.action, table.createdAt),
  failedAttemptsIdx: index('audit_failed_attempts_idx').on(table.userId, table.createdAt).where(sql`success = false`),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type NewPasswordResetToken = typeof passwordResetTokens.$inferInsert;

export type AuditLog = typeof auditLog.$inferSelect;
export type NewAuditLog = typeof auditLog.$inferInsert;
