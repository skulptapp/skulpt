import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';

export const DATABASE_NAME = 'skulpt.db';

const dbConnection = openDatabaseSync(DATABASE_NAME, { enableChangeListener: true });

dbConnection.execAsync('PRAGMA journal_mode = WAL');
dbConnection.execAsync('PRAGMA foreign_keys = OFF');

const db = drizzle(dbConnection);

export { db, dbConnection };
