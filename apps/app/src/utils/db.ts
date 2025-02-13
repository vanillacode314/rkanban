import { SQLocal } from 'sqlocal';

let db: null | SQLocal = null;

function useDb() {
	if (db !== null) return db;

	db = new SQLocal(':memory:');
	seedDb(db);
	return db;
}

async function seedDb(db: SQLocal) {
	await db.sql`
    CREATE TABLE IF NOT EXISTS nodes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      parentId TEXT REFERENCES nodes(id) ON DELETE CASCADE
    )
  `;
}

export { useDb };
