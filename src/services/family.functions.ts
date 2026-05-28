import { createServerFn } from "@tanstack/react-start";
import type { z } from "zod";
import { authMiddleware } from "@/services/auth.middleware";
import {
  ChangeFamilyInputSchema,
  CreateFamilyInputSchema,
} from "@/utils/schemas";
import {
  changeFamilyLogic,
  createFamilyLogic,
  getFamilyInfoByInviteCodeLogic,
  getFamilyMembersLogic,
  getRecordsForReEncryptionLogic,
  joinFamilyLogic,
} from "./family.server";

// ============================================================================
// サーバー関数層（TanStack Start の RPC エンドポイント）
// ============================================================================

export const getFamilyMembersFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context: { user } }) => {
    return await getFamilyMembersLogic(user.id, user.familyId);
  });

export const createFamilyFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((data: z.infer<typeof CreateFamilyInputSchema>) =>
    CreateFamilyInputSchema.parse(data),
  )
  .handler(async ({ data, context: { user } }) => {
    return await createFamilyLogic(data, user.id, user.familyId);
  });

export const joinFamilyFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((data: { inviteCode: string }) => data)
  .handler(async ({ data, context: { user } }) => {
    return await joinFamilyLogic(data, user.id, user.familyId);
  });

export const getRecordsForReEncryptionFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context: { user } }) => {
    return await getRecordsForReEncryptionLogic(user.id, user.familyId);
  });

export const changeFamilyFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((data: z.infer<typeof ChangeFamilyInputSchema>) =>
    ChangeFamilyInputSchema.parse(data),
  )
  .handler(async ({ data, context: { user } }) => {
    return await changeFamilyLogic(data, user.id, user.familyId);
  });

export const getFamilyInfoByInviteCodeFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((data: { inviteCode: string }) => data)
  .handler(async ({ data, context: { user } }) => {
    return await getFamilyInfoByInviteCodeLogic(data, user.id, user.familyId);
  });
