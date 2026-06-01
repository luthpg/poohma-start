import { v } from "convex/values";
import { query, mutation, action, internalMutation, internalQuery } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";

export const getFamilyMembers = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const userId = identity.subject;

    const user = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    if (!user || !user.familyId) return null;

    const family = await ctx.db.get(user.familyId);
    if (!family) return null;

    const usersInFamily = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("familyId"), family._id))
      .collect();

    return {
      ...family,
      users: usersInFamily.map((u) => ({
        id: u.userId,
        email: u.email,
        displayName: u.displayName,
      })),
      id: family._id,
    };
  },
});

export const createFamily = mutation({
  args: {
    name: v.string(),
    masterKeyEncrypted: v.optional(v.string()),
    masterKeyIv: v.optional(v.string()),
    masterKeySalt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const userId = identity.subject;

    const user = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    if (!user) throw new Error("User not found");
    if (user.familyId) throw new Error("Already in a family");

    const familyId = await ctx.db.insert("families", {
      name: args.name,
      masterKeyEncrypted: args.masterKeyEncrypted,
      masterKeyIv: args.masterKeyIv,
      masterKeySalt: args.masterKeySalt,
      updatedAt: Date.now(),
    });

    await ctx.db.patch(user._id, { familyId });
    return familyId;
  },
});

export const joinFamily = mutation({
  args: {
    inviteCode: v.id("families"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const userId = identity.subject;

    const user = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    if (!user) throw new Error("User not found");
    if (user.familyId) throw new Error("Already in a family");

    const family = await ctx.db.get(args.inviteCode);
    if (!family) throw new Error("Invalid invite code");

    await ctx.db.patch(user._id, { familyId: family._id });
    return family._id;
  },
});

export const getFamilyInfoByInviteCode = query({
  args: { inviteCode: v.id("families") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const family = await ctx.db.get(args.inviteCode);
    if (!family) throw new Error("Invalid invite code");

    return {
      id: family._id,
      name: family.name,
      masterKeyEncrypted: family.masterKeyEncrypted,
      masterKeyIv: family.masterKeyIv,
      masterKeySalt: family.masterKeySalt,
    };
  },
});

export const getRecordsForReEncryption = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const userId = identity.subject;

    const records = await ctx.db
      .query("serviceRecords")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    return records.map((record) => ({
      _id: record._id,
      id: record._id,
      credentials: record.credentials
        .filter((c) => c.passwordHint && c.passwordHintIv)
        .map((c) => ({
          id: c.id,
          passwordHint: c.passwordHint!,
          passwordHintIv: c.passwordHintIv!,
        })),
    })).filter(record => record.credentials.length > 0);
  },
});

export const initChangeFamily = internalMutation({
  args: {
    userId: v.string(),
    action: v.union(v.literal("create"), v.literal("join")),
    name: v.optional(v.string()),
    masterKeyEncrypted: v.optional(v.string()),
    masterKeyIv: v.optional(v.string()),
    masterKeySalt: v.optional(v.string()),
    inviteCode: v.optional(v.string()), // string as it comes from form, we'll validate
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();

    if (!user) throw new Error("User not found");

    let parsedTargetFamilyId: Id<"families">;

    if (args.action === "create") {
      if (!args.name || !args.masterKeyEncrypted || !args.masterKeyIv || !args.masterKeySalt) {
        throw new Error("Missing fields for create");
      }
      parsedTargetFamilyId = await ctx.db.insert("families", {
        name: args.name,
        masterKeyEncrypted: args.masterKeyEncrypted,
        masterKeyIv: args.masterKeyIv,
        masterKeySalt: args.masterKeySalt,
        updatedAt: Date.now(),
      });
    } else {
      if (!args.inviteCode) throw new Error("Missing invite code");
      const family = await ctx.db.get(args.inviteCode as Id<"families">);
      if (!family) throw new Error("Invalid invite code");
      parsedTargetFamilyId = family._id;
    }

    // Update user familyId
    await ctx.db.patch(user._id, { familyId: parsedTargetFamilyId });
    return parsedTargetFamilyId;
  },
});

export const getRecordIdsForUser = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const records = await ctx.db
      .query("serviceRecords")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();
    return records.map((r) => r._id);
  },
});

export const updateRecordsFamilyChunk = internalMutation({
  args: {
    recordIds: v.array(v.id("serviceRecords")),
    targetFamilyId: v.id("families"),
    credentials: v.array(
      v.object({
        id: v.string(),
        passwordHint: v.string(),
        passwordHintIv: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const credUpdates = new Map(args.credentials.map((c) => [c.id, c]));

    for (const recordId of args.recordIds) {
      const record = await ctx.db.get(recordId);
      if (!record) continue;

      let needsUpdate = false;
      const newCredentials = record.credentials.map((cred) => {
        const update = credUpdates.get(cred.id);
        if (update) {
          needsUpdate = true;
          return {
            ...cred,
            passwordHint: update.passwordHint,
            passwordHintIv: update.passwordHintIv,
          };
        }
        return cred;
      });

      if (record.familyId !== args.targetFamilyId || needsUpdate) {
        await ctx.db.patch(record._id, {
          familyId: args.targetFamilyId,
          credentials: newCredentials,
          updatedAt: Date.now(),
        });
      }
    }
  },
});

export const changeFamily = action({
  args: {
    action: v.union(v.literal("create"), v.literal("join")),
    name: v.optional(v.string()),
    masterKeyEncrypted: v.optional(v.string()),
    masterKeyIv: v.optional(v.string()),
    masterKeySalt: v.optional(v.string()),
    inviteCode: v.optional(v.string()), // string as it comes from form, we'll validate
    credentials: v.array(
      v.object({
        id: v.string(),
        passwordHint: v.string(),
        passwordHintIv: v.string(),
      })
    ),
  },
  handler: async (ctx, args): Promise<{ success: boolean; familyId: Id<"families"> }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const userId = identity.subject;

    // 1. Initial family creation/join
    const familyId = (await ctx.runMutation(internal.families.initChangeFamily, {
      userId,
      action: args.action,
      name: args.name,
      masterKeyEncrypted: args.masterKeyEncrypted,
      masterKeyIv: args.masterKeyIv,
      masterKeySalt: args.masterKeySalt,
      inviteCode: args.inviteCode,
    })) as Id<"families">;

    // 2. Fetch record IDs to update
    const recordIds = (await ctx.runQuery(internal.families.getRecordIdsForUser, { userId })) as Id<"serviceRecords">[];

    // 3. Loop to update records in chunks of 50
    const chunkSize = 50;
    for (let i = 0; i < recordIds.length; i += chunkSize) {
      const chunk = recordIds.slice(i, i + chunkSize);
      await ctx.runMutation(internal.families.updateRecordsFamilyChunk, {
        recordIds: chunk,
        targetFamilyId: familyId,
        credentials: args.credentials,
      });
    }

    return { success: true, familyId };
  },
});
