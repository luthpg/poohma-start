import type { z } from "zod";
import { withSession } from "@/services/db.server";
import type {
  ChangeFamilyInputSchema,
  CreateFamilyInputSchema,
} from "@/utils/schemas";

// ============================================================================
// ビジネスロジック層（テスト対象・フレームワーク非依存）
// ============================================================================

export async function getFamilyMembersLogic(
  userId: string,
  familyId: string | null,
) {
  if (!familyId) return null;
  return await withSession(userId, familyId, async (tx) => {
    return tx.family.findUnique({
      where: { id: familyId },
      include: {
        users: { select: { id: true, displayName: true, email: true } },
      },
    });
  });
}

export async function createFamilyLogic(
  data: z.infer<typeof CreateFamilyInputSchema>,
  userId: string,
  familyId: string | null,
) {
  if (familyId) throw new Error("Already in a family");

  return await withSession(userId, familyId, async (tx) => {
    const newFamily = await tx.family.create({
      data: {
        name: data.name,
        masterKeyEncrypted: data.masterKeyEncrypted,
        masterKeyIv: data.masterKeyIv,
        masterKeySalt: data.masterKeySalt,
      },
    });

    await tx.user.update({
      where: { id: userId },
      data: { familyId: newFamily.id },
    });

    return newFamily;
  });
}

export async function joinFamilyLogic(
  data: { inviteCode: string },
  userId: string,
  familyId: string | null,
) {
  if (familyId) throw new Error("Already in a family");

  return await withSession(userId, familyId, async (tx) => {
    const family = await tx.family.findUnique({
      where: { id: data.inviteCode },
    });
    if (!family) throw new Error("Invalid invite code");

    await tx.user.update({
      where: { id: userId },
      data: { familyId: family.id },
    });

    return family;
  });
}

export async function getRecordsForReEncryptionLogic(
  userId: string,
  familyId: string | null,
) {
  return await withSession(userId, familyId, async (tx) => {
    return tx.serviceRecord.findMany({
      where: { userId: userId },
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
}

export async function changeFamilyLogic(
  data: z.infer<typeof ChangeFamilyInputSchema>,
  userId: string,
  familyId: string | null,
) {
  return await withSession(userId, familyId, async (tx) => {
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
      where: { id: userId },
      data: { familyId: targetFamilyId },
    });

    // ユーザーが所有するすべてのレコードの familyId を一括更新
    await tx.serviceRecord.updateMany({
      where: { userId: userId },
      data: { familyId: targetFamilyId },
    });

    // 再暗号化された認証情報を更新 (IDOR対策の所有権チェック)
    for (const cred of data.credentials) {
      await tx.accountCredential.updateMany({
        where: {
          id: cred.id,
          record: {
            userId: userId, // 所有権チェック
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
}

export async function getFamilyInfoByInviteCodeLogic(
  data: { inviteCode: string },
  userId: string,
  familyId: string | null,
) {
  const family = await withSession(userId, familyId, async (tx) => {
    return tx.family.findUnique({
      where: { id: data.inviteCode },
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
}
