import "dotenv/config";
import { createHash, randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { neonConfig, Pool as PoolNeon } from "@neondatabase/serverless";
import { Pool as PoolPg } from "pg";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

const DOSSIER_PAR_DEFAUT = join("prisma", "migrations");

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

type Requetable = {
  query: <T>(sql: string, valeurs?: unknown[]) => Promise<{ rows: T[] }>;
  release: () => void;
};

type Poolable = {
  connect: () => Promise<Requetable>;
  end: () => Promise<void>;
};

function dossierDesMigrations(): string {
  const demande = process.env["MIGRATIONS_DIR"];
  if (!demande) {
    return join(process.cwd(), DOSSIER_PAR_DEFAUT);
  }
  return isAbsolute(demande) ? demande : join(process.cwd(), demande);
}

function ouvrirPool(): { pool: Poolable; cible: string } {
  const urlLocale = process.env["LOCAL_DATABASE_URL"];
  if (urlLocale) {
    return {
      pool: new PoolPg({ connectionString: urlLocale }) as unknown as Poolable,
      cible: "Postgres local (LOCAL_DATABASE_URL)",
    };
  }

  const connectionString = process.env["DIRECT_URL"];
  if (!connectionString) {
    throw new Error("DIRECT_URL absente de .env");
  }
  return {
    pool: new PoolNeon({ connectionString }) as unknown as Poolable,
    cible: "Neon (DIRECT_URL)",
  };
}

function readMigrationNames(dossier: string): string[] {
  return readdirSync(dossier, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

async function main(): Promise<void> {
  const dossier = dossierDesMigrations();
  const { pool, cible } = ouvrirPool();
  const client = await pool.connect();

  console.log(`cible : ${cible}`);
  console.log(`migrations : ${dossier}`);

  try {
    await client.query(CREATE_BOOKKEEPING_TABLE);

    const alreadyApplied = new Set<string>(
      (
        await client.query<{ migration_name: string }>(
          `SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL`,
        )
      ).rows.map((row) => row.migration_name),
    );

    const pending = readMigrationNames(dossier).filter((name) => !alreadyApplied.has(name));

    if (pending.length === 0) {
      console.log("Aucune migration en attente.");
      return;
    }

    for (const name of pending) {
      const sql = readFileSync(join(dossier, name, "migration.sql"));
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
