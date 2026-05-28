import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/services/db.server";

// ============================================================================
// ファイルインポート時のクラッシュを防ぐ「空のモック（Void Mock）」
// 実装ロジックはテストせず、読み込みエラーを回避するだけの役割を持つ。
// ============================================================================
vi.mock("@tanstack/react-start", () => {
  const dummyChain = {
    middleware: () => dummyChain,
    inputValidator: () => dummyChain,
    handler: () => dummyChain,
    server: () => dummyChain,
    client: () => dummyChain,
  };
  return {
    createServerFn: () => dummyChain,
    createMiddleware: () => dummyChain,
  };
});

// モック定義の後に、純粋なロジック関数をインポートする
import { changeFamilyLogic, createFamilyLogic } from "@/services/family.server";

const B64_VALID = "SGVsbG9Xb3JsZA==";

describe("2.1 家族管理とE2EE鍵ローテーションの統合テスト（ロジック分離版）", () => {
  // テストごとのDBクリーンアップ
  beforeEach(async () => {
    await db.accountCredential.deleteMany();
    await db.recordTag.deleteMany();
    await db.serviceRecord.deleteMany();
    await db.user.deleteMany();
    await db.family.deleteMany();
  });

  // 全テスト完了後に Prisma のコネクションを切断
  afterAll(async () => {
    await db.$disconnect();
  });

  describe("2.1.1 家族の作成と所属ユーザーの更新", () => {
    it("家族作成時にトランザクションが機能し、作成したユーザーのfamilyIdが紐づくこと", async () => {
      const testUser = await db.user.create({
        data: { id: "user_a", email: "a@example.com" },
      });

      const payload = {
        name: "田中家",
        masterKeyEncrypted: B64_VALID,
        masterKeyIv: B64_VALID,
        masterKeySalt: B64_VALID,
      };

      const newFamily = await createFamilyLogic(payload, testUser.id, null);

      expect(newFamily.id).toBeDefined();
      expect(newFamily.name).toBe("田中家");

      const updatedUser = await db.user.findUnique({
        where: { id: testUser.id },
      });
      expect(updatedUser?.familyId).toBe(newFamily.id);
    });
  });

  describe("2.1.2 家族グループ変更時のレコード再暗号化（IDOR対策の検証）", () => {
    it("自分が所有するレコードのみが更新され、他人のレコードIDを混入させてもスキップされること", async () => {
      const family1 = await db.family.create({
        data: {
          name: "F1",
          masterKeyEncrypted: B64_VALID,
          masterKeyIv: B64_VALID,
          masterKeySalt: B64_VALID,
        },
      });

      const userA = await db.user.create({
        data: { id: "ua", email: "a@a.com", familyId: family1.id },
      });
      const userB = await db.user.create({
        data: { id: "ub", email: "b@b.com", familyId: family1.id },
      });

      const recordA = await db.serviceRecord.create({
        data: { userId: userA.id, familyId: family1.id, title: "RA" },
      });
      const credA = await db.accountCredential.create({
        data: {
          recordId: recordA.id,
          passwordHint: B64_VALID,
          passwordHintIv: B64_VALID,
        },
      });

      const recordB = await db.serviceRecord.create({
        data: { userId: userB.id, familyId: family1.id, title: "RB" },
      });
      const credB = await db.accountCredential.create({
        data: {
          recordId: recordB.id,
          passwordHint: B64_VALID,
          passwordHintIv: B64_VALID,
        },
      });

      // 【悪意のあるペイロード】 他人(userB)のデータを含める
      const maliciousPayload = {
        action: "create" as const,
        name: "新しい家族2",
        masterKeyEncrypted: B64_VALID,
        masterKeyIv: B64_VALID,
        masterKeySalt: B64_VALID,
        credentials: [
          {
            id: credA.id,
            passwordHint: "TmV3SGludEE=",
            passwordHintIv: B64_VALID,
          },
          {
            id: credB.id,
            passwordHint: "TmV3SGludEI=",
            passwordHintIv: B64_VALID,
          },
        ],
      };

      const result = await changeFamilyLogic(
        maliciousPayload,
        userA.id,
        family1.id,
      );

      expect(result.success).toBe(true);

      const updatedUserA = await db.user.findUnique({
        where: { id: userA.id },
      });
      expect(updatedUserA?.familyId).toBe(result.familyId);

      // Aのクレデンシャルは新しいものに更新されていること
      const cA = await db.accountCredential.findUnique({
        where: { id: credA.id },
      });
      expect(cA?.passwordHint).toBe("TmV3SGludEE=");

      // Bのクレデンシャルは影響を受けず、古いまま(B64_VALID)であること
      const cB = await db.accountCredential.findUnique({
        where: { id: credB.id },
      });
      expect(cB?.passwordHint).toBe(B64_VALID);
    });
  });
});
