import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "./auth.middleware";
import { db } from "./db.server";
import { adminAuth } from "./firebase-admin.server";

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
  .inputValidator((data: { name: string }) => data)
  .handler(async ({ data: { name }, context: { user } }) => {
    if (user.familyId) throw new Error("Already in a family");

    // トランザクションで家族作成とユーザー更新を同時に行う
    const family = await db.$transaction(async (tx) => {
      const newFamily = await tx.family.create({
        data: { name },
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
  });

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
