import { execSync } from "node:child_process";
import { PrismaClient } from "@/app/generated/prisma";

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

function instantiatePrismaClient() {
  const instantiate = () =>
    new PrismaClient({
      log:
        process.env.NODE_ENV === "development"
          ? ["query", "error", "warn"]
          : ["error", "warn"],
    });

  try {
    return instantiate();
  } catch (error) {
    const message = error instanceof Error ? error.message : "";

    if (message.includes("did not initialize yet") && process.env.NODE_ENV !== "production") {
      try {
        execSync("npx prisma generate", { stdio: "inherit" });
      } catch (generateError) {
        console.error("Failed to auto-run prisma generate", generateError);
        throw error;
      }

      return instantiate();
    }

    throw error;
  }
}

export const prisma = globalForPrisma.prisma ?? instantiatePrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
