import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";
import ws from "ws";
import { PrismaClient } from "./generated/prisma/client";

neonConfig.webSocketConstructor = ws;

function createPrismaClient(): PrismaClient {
  const connectionString = process.env["LOCAL_DATABASE_URL"];
  if (connectionString) {
    return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  }

  const urlNeon = process.env["DATABASE_URL"];
  if (!urlNeon) {
    throw new Error("DATABASE_URL absente de l'environnement");
  }
  return new PrismaClient({ adapter: new PrismaNeon({ connectionString: urlNeon }) });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
