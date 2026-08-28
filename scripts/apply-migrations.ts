import "dotenv/config";
import { createHash, randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { neonConfig, Pool } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

const MIGRATIONS_DIR = join(process.cwd(), "prisma", "migrations");

const CREATE_BOOKKEEPING_TABLE = `
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
  "id" VARCHAR(36) PRIMARY KEY NOT NULL,
  "checksum" VARCHAR(64) NOT NULL,
  "finished_at" TIMESTAMPTZ,
  "migration_name" VARCHAR(255) NOT NULL,
  "logs" TEXT,
  "rolled_back_at" TIMESTAMPTZ,
  "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "applied_steps_count" INTEGER NOT NULL DEFAULT 0
)`;

function readMigrationNames(): string[] {
  return readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

async function main(): Promise<void> {
  const connectionString = process.env["DIRECT_URL"];
  if (!connectionString) {
    throw new Error("DIRECT_URL absente de .env");
  }

  const pool = new Pool({ connectionString });
  const client = await pool.connect();

  try {
    await client.query(CREATE_BOOKKEEPING_TABLE);

    const alreadyApplied = new Set<string>(
      (
        await client.query<{ migration_name: string }>(
          `SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL`,
        )
      ).rows.map((row) => row.migration_name),
    );

    const pending = readMigrationNames().filter((name) => !alreadyApplied.has(name));

    if (pending.length === 0) {
      console.log("Aucune migration en attente.");
      return;
    }

    for (const name of pending) {
      const sql = readFileSync(join(MIGRATIONS_DIR, name, "migration.sql"));
      const checksum = createHash("sha256").update(sql).digest("hex");

      await client.query("BEGIN");
      try {
        await client.query(sql.toString("utf8"));
        await client.query(
          `INSERT INTO "_prisma_migrations"
             (id, checksum, migration_name, started_at, finished_at, applied_steps_count)
           VALUES ($1, $2, $3, now(), now(), 1)`,
          [randomUUID(), checksum, name],
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }

      console.log(`Appliquee : ${name}`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
