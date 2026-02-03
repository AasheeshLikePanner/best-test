import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://localhost:5432/scheduler',
});

export const postgresCheckpointer = new PostgresSaver(pool);

export async function initializeDatabase() {
    // Setup the database tables required for checkpointing
    await postgresCheckpointer.setup();
}
