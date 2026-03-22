import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '../lib/env';
import * as schema from './schema';

export const queryClient = postgres(env.DATABASE_URL);
export const db = drizzle(queryClient, { schema });

export type DrizzleDB = PostgresJsDatabase<typeof schema>;
