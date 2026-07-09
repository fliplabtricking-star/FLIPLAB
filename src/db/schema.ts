import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const subscribers = sqliteTable('subscribers', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  fullName: text('full_name').notNull(),
  age: integer('age').notNull(),
  gender: text('gender').notNull(),
  guardianName: text('guardian_name'),
  whatsappNumber: text('whatsapp_number').notNull(),
  previousExperience: text('previous_experience'),
  classType: text('class_type').notNull(), // 'Parkour' | 'Tricking'
  packageType: text('package_type').notNull(), // 'Monthly' | 'Trial'
  receiptImageBase64: text('receipt_image_base64').notNull(),
  isVerified: integer('is_verified', { mode: 'boolean' }).default(false).notNull(),
  activeUntil: text('active_until'), // ISO Date string for expiration
  expiryNotificationSent: integer('expiry_notification_sent', { mode: 'boolean' }).default(false).notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const scanLogs = sqliteTable('scan_logs', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  subscriberId: text('subscriber_id').notNull().references(() => subscribers.id),
  scannedAt: text('scanned_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const pushSubscriptions = sqliteTable('push_subscriptions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  endpoint: text('endpoint').notNull(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const payments = sqliteTable('payments', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  subscriberId: text('subscriber_id').notNull().references(() => subscribers.id),
  amount: integer('amount').notNull(),
  type: text('type').notNull(), // 'Registration' | 'Renew 30 Days' | 'Renew 1 Session'
  date: text('date').default(sql`CURRENT_TIMESTAMP`).notNull(),
});
