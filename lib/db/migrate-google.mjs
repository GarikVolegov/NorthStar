import pg from "pg";
const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id text;`);
await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url text;`);
// Add unique constraint only if not exists
await client.query(`
  DO $$ BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'users_google_id_unique'
    ) THEN
      ALTER TABLE users ADD CONSTRAINT users_google_id_unique UNIQUE (google_id);
    END IF;
  END $$;
`);
await client.end();
console.log("Migration done: google_id, avatar_url added to users.");
