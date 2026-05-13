import { createServerFn } from "@tanstack/react-start";
import type { z } from "zod";
import { authMiddleware } from "@/services/auth.middleware";
import { db } from "@/services/db.server";
import { adminAuth } from "@/services/firebase-admin.server";
import {
  ChangeFamilyInputSchema,
  CreateFamilyInputSchema,
} from "@/utils/schemas";

export const getFamilyMembersFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context: { user } }) => {
    if (!user?.familyId) return null;

    const family = await db.family.findUnique({
      where: { id: user.familyId },
      include: {
        users: { select: { id: true, displayName: true, email: true } },
      },
    });

    return family;
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
      const family = await db.$transaction(async (tx) => {
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

      // Firebase Custom Claims に family_id をセット
      await adminAuth().setCustomUserClaims(user.id, { family_id: family.id });

      return family;
    },
  );

export const joinFamilyFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((data: { inviteCode: string }) => data)
  .handler(async ({ data: { inviteCode }, context: { user } }) => {
    if (user.familyId) throw new Error("Already in a family");

    const family = await db.family.findUnique({ where: { id: inviteCode } });
    if (!family) throw new Error("Invalid invite code");

    await db.user.update({
      where: { id: user.id },
      data: { familyId: family.id },
    });

    // Firebase Custom Claims に family_id をセット
    await adminAuth().setCustomUserClaims(user.id, { family_id: family.id });

    return family;
  });

export const getRecordsForReEncryptionFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context: { user } }) => {
    // 自身が作成した全レコードの認証情報を取得（パスワードヒントが存在するもののみ）
    const records = await db.serviceRecord.findMany({
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

    return records;
  });

export const changeFamilyFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((data: z.infer<typeof ChangeFamilyInputSchema>) =>
    ChangeFamilyInputSchema.parse(data),
  )
  .handler(async ({ data, context: { user } }) => {
    return await db.$transaction(async (tx) => {
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

      // 再暗号化された認証情報を更新
      for (const cred of data.credentials) {
        await tx.accountCredential.update({
          where: { id: cred.id },
          data: {
            passwordHint: cred.passwordHint,
            passwordHintIv: cred.passwordHintIv,
          },
        });
      }

      // Firebase Custom Claims に新しい family_id をセット
      await adminAuth().setCustomUserClaims(user.id, {
        family_id: targetFamilyId,
      });

      return { success: true, familyId: targetFamilyId };
    });
  });

export const getFamilyInfoByInviteCodeFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((data: { inviteCode: string }) => data)
  .handler(async ({ data: { inviteCode } }) => {
    const family = await db.family.findUnique({
      where: { id: inviteCode },
      select: {
        id: true,
        name: true,
        masterKeyEncrypted: true,
        masterKeyIv: true,
        masterKeySalt: true,
      },
    });
    if (!family) throw new Error("Invalid invite code");
    return family;
  });
