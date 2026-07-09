import { db } from './src/db/index.ts';
import { sql } from 'drizzle-orm';

async function main() {
  await db.run(sql`CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    subscriber_id TEXT NOT NULL,
    amount INTEGER NOT NULL,
    type TEXT NOT NULL,
    date TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
  )`);
  console.log('Payments table created successfully.');
}
main();
