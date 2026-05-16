import { PrismaClient } from "@/../generated/prisma/client";
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

const connectionString = `${process.env.DATABASE_URL}`;
const adapter = new PrismaPg({ connectionString });
export const db = globalForPrisma.prisma || new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

/**
 * PostgreSQL RLS用のセッション変数を注入したトランザクションを実行するヘルパー
 * 全てのユーザーに紐づくDB操作は、この関数でラップして実行してください。
 */
export const withSession = async <T>(
  userId: string,
  familyId: string | null | undefined,
  callback: (
    tx: Omit<
      PrismaClient,
      "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
    >,
  ) => Promise<T>,
) => {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`
      SELECT 
        set_config('app.current_user_id', ${userId}, true),
        set_config('app.current_family_id', ${familyId ?? ""}, true)
    `;
    return callback(tx);
  });
};
