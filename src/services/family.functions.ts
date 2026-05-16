import { createServerFn } from "@tanstack/react-start";
import type { z } from "zod";
import { authMiddleware } from "@/services/auth.middleware";
import { withSession } from "@/services/db.server";
import {
  ChangeFamilyInputSchema,
  CreateFamilyInputSchema,
} from "@/utils/schemas";

export const getFamilyMembersFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context: { user } }) => {
    if (!user?.familyId) return null;

    return await withSession(user.id, user.familyId, async (tx) => {
      return tx.family.findUnique({
        where: { id: user.familyId as string },
        include: {
          users: { select: { id: true, displayName: true, email: true } },
        },
      });
    });
  });

export const createFamilyFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((data: z.infer<typeof CreateFamilyInputSchema>) =>
    CreateFamilyInputSchema.parse(data),
  )
  .handler(
    async ({
      data: { name, masterKeyEncrypted, masterKeyIv, masterKeySalt },
      context: { user },
    }) => {
      if (user.familyId) throw new Error("Already in a family");

      // トランザクションで家族作成とユーザー更新を同時に行う
      const family = await withSession(user.id, user.familyId, async (tx) => {
        const newFamily = await tx.family.create({
          data: {
            name,
            masterKeyEncrypted,
            masterKeyIv,
            masterKeySalt,
          },
        });

        await tx.user.update({
          where: { id: user.id },
          data: { familyId: newFamily.id },
        });

        return newFamily;
      });

      return family;
    },
  );

export const joinFamilyFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((data: { inviteCode: string }) => data)
  .handler(async ({ data: { inviteCode }, context: { user } }) => {
    if (user.familyId) throw new Error("Already in a family");

    return await withSession(user.id, user.familyId, async (tx) => {
      const family = await tx.family.findUnique({ where: { id: inviteCode } });
      if (!family) throw new Error("Invalid invite code");

      await tx.user.update({
        where: { id: user.id },
        data: { familyId: family.id },
      });

      return family;
    });
  });

export const getRecordsForReEncryptionFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context: { user } }) => {
    // 自身が作成した全レコードの認証情報を取得（パスワードヒントが存在するもののみ）
    return await withSession(user.id, user.familyId, async (tx) => {
      return tx.serviceRecord.findMany({
        where: { userId: user.id },
        select: {
          id: true,
          credentials: {
            where: {
              passwordHint: { not: "" },
              passwordHintIv: { not: null },
            },
            select: {
              id: true,
              passwordHint: true,
              passwordHintIv: true,
            },
          },
        },
      });
    });
  });

export const changeFamilyFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((data: z.infer<typeof ChangeFamilyInputSchema>) =>
    ChangeFamilyInputSchema.parse(data),
  )
  .handler(async ({ data, context: { user } }) => {
    return await withSession(user.id, user.familyId, async (tx) => {
      let targetFamilyId: string;

      if (data.action === "create") {
        if (
          !data.name ||
          !data.masterKeyEncrypted ||
          !data.masterKeyIv ||
          !data.masterKeySalt
        ) {
          throw new Error("Missing required fields for creating a family");
        }
        const newFamily = await tx.family.create({
          data: {
            name: data.name,
            masterKeyEncrypted: data.masterKeyEncrypted,
            masterKeyIv: data.masterKeyIv,
            masterKeySalt: data.masterKeySalt,
          },
        });
        targetFamilyId = newFamily.id;
      } else {
        if (!data.inviteCode) {
          throw new Error("Missing invite code for joining a family");
        }
        const existingFamily = await tx.family.findUnique({
          where: { id: data.inviteCode },
        });
        if (!existingFamily) throw new Error("Invalid invite code");
        targetFamilyId = existingFamily.id;
      }

      // ユーザーの familyId を更新
      await tx.user.update({
        where: { id: user.id },
        data: { familyId: targetFamilyId },
      });

      // ユーザーが所有するすべてのレコードの familyId を一括更新
      await tx.serviceRecord.updateMany({
        where: { userId: user.id },
        data: { familyId: targetFamilyId },
      });

      // 再暗号化された認証情報を更新 (IDOR対策として所有権チェックを追加)
      for (const cred of data.credentials) {
        await tx.accountCredential.updateMany({
          where: {
            id: cred.id,
            record: {
              userId: user.id, // 自分が所有するレコードの認証情報のみ更新可能
            },
          },
          data: {
            passwordHint: cred.passwordHint,
            passwordHintIv: cred.passwordHintIv,
          },
        });
      }

      return { success: true, familyId: targetFamilyId };
    });
  });

export const getFamilyInfoByInviteCodeFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((data: { inviteCode: string }) => data)
  .handler(async ({ data: { inviteCode }, context: { user } }) => {
    const family = await withSession(user.id, user.familyId, async (tx) => {
      return tx.family.findUnique({
        where: { id: inviteCode },
        select: {
          id: true,
          name: true,
          masterKeyEncrypted: true,
          masterKeyIv: true,
          masterKeySalt: true,
        },
      });
    });
    if (!family) throw new Error("Invalid invite code");
    return family;
  });
