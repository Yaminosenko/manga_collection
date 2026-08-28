import "dotenv/config";
import { defineConfig } from "prisma/config";

const localUrl = process.env["LOCAL_DATABASE_URL"];

if (!localUrl) {
  throw new Error(
    "LOCAL_DATABASE_URL absente. Lancer `npx prisma dev -d -n manga` et reprendre l'URL affichee.",
  );
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: localUrl,
  },
});
