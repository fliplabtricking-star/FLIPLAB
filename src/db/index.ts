import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema.ts';

const dbUrl = process.env.DATABASE_URL || 'file:local.db';

const client = createClient({
  url: dbUrl,
});

export const db = drizzle(client, { schema });
