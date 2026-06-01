import { v } from "convex/values";
import { action, internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";

/**
 * ユーザー同期（ログイン時に呼ばれる）
 * - Firebase UID でユーザーを検索し、存在すればプロフィール更新
 * - 同じメールで別UIDのユーザーが存在する場合、データを移行
 * - 完全に新規の場合はユーザーを作成
 */
export const syncUser = mutation({
  args: {
    uid: v.string(),
    email: v.string(),
    displayName: v.optional(v.string()),
    photoURL: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { uid, email, displayName, photoURL } = args;

    // Firebase UID で検索
    const existingByUid = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", uid))
      .unique();

    if (existingByUid) {
      // UIDが一致 → プロフィール情報を更新
      await ctx.db.patch(existingByUid._id, {
        email,
        displayName,
        photoURL,
        updatedAt: Date.now(),
      });
      return existingByUid.userId;
    }

    // UIDが一致しない → 同じemailの古いレコードがないか確認
    const existingByEmail = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();

    if (existingByEmail) {
      // 同じemailで別UIDのレコードが存在
      // → Firebase Auth側でアカウント再作成されたケース
      // 旧ユーザーのServiceRecordを新UIDに移行
      const records = await ctx.db
        .query("serviceRecords")
        .withIndex("by_userId", (q) => q.eq("userId", existingByEmail.userId))
        .collect();

      for (const record of records) {
        await ctx.db.patch(record._id, { userId: uid });
      }

      // 旧ユーザーを更新（UIDとプロフィールを新しいものに差し替え）
      await ctx.db.patch(existingByEmail._id, {
        userId: uid,
        email,
        displayName,
        photoURL,
        updatedAt: Date.now(),
      });

      return uid;
    }

    // 完全に新規のユーザー
    await ctx.db.insert("users", {
      userId: uid,
      email,
      displayName,
      photoURL,
      updatedAt: Date.now(),
    });

    return uid;
  },
});

export const updateProfile = mutation({
  args: {
    displayName: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }
    const userId = identity.subject;

    const user = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    if (!user) {
      throw new Error("User not found");
    }

    await ctx.db.patch(user._id, {
      displayName: args.displayName.trim(),
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

export const deleteRecordsChunk = internalMutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const records = await ctx.db
      .query("serviceRecords")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .take(50); // limit to avoid transaction size limits

    for (const record of records) {
      await ctx.db.delete(record._id);
    }
    return records.length === 50;
  },
});

export const finalizeAccountDeletion = internalMutation({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();

    if (!user) return;

    if (user.familyId) {
      const familyId = user.familyId;
      const familyMembers = await ctx.db
        .query("users")
        .filter((q) => q.eq(q.field("familyId"), familyId))
        .collect();
      
      const otherMembers = familyMembers.filter((u) => u.userId !== args.userId);

      if (otherMembers.length === 0) {
        await ctx.db.delete(familyId);
      }
    }

    await ctx.db.delete(user._id);
  },
});

export const deleteAccount = action({
  args: {},
  handler: async (ctx): Promise<{ success: boolean }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }
    const userId = identity.subject;

    let hasMoreRecords = true;
    while (hasMoreRecords) {
      hasMoreRecords = (await ctx.runMutation(internal.users.deleteRecordsChunk, { userId })) as boolean;
    }

    await ctx.runMutation(internal.users.finalizeAccountDeletion, { userId });
    return { success: true };
  },
});

export const getUserByFirebaseUid = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();

    if (!user) return null;

    let family = null;
    if (user.familyId) {
      const familyDoc = await ctx.db.get(user.familyId);
      if (familyDoc) {
        family = {
          id: familyDoc._id,
          name: familyDoc.name,
          masterKeyEncrypted: familyDoc.masterKeyEncrypted,
          masterKeyIv: familyDoc.masterKeyIv,
          masterKeySalt: familyDoc.masterKeySalt,
        };
      }
    }

    return {
      id: user.userId,
      userId: user.userId,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      familyId: user.familyId,
      family,
    };
  },
});
