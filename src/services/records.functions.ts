import { createServerFn } from "@tanstack/react-start";
import type { z } from "zod";
import { Visibility } from "@/../generated/prisma/client"; // Prismaが生成したEnum
import { RecordInputSchema } from "@/utils/schemas";
import { getAuthUser } from "./auth.functions";
import { db } from "./db.server";

/**
 * レコード一覧取得
 * 条件: 自分が作成したもの OR (共有設定 AND 同じ家族)
 */
export const getRecords = createServerFn({ method: "GET" })
  .inputValidator((data?: { tag?: string }) => data)
  .handler(async ({ data }) => {
    const user = await getAuthUser();
    if (!user) throw new Error("Unauthorized");
    const { tag } = data || {};

    // 検索条件の構築
    const whereCondition = {
      AND: [
        {
          OR: [
            { userId: user.id }, // 自分の
            {
              visibility: Visibility.SHARED, // 共有設定で
              familyId: user.familyId, // 同じ家族の
            },
          ],
        },
        // タグフィルタがある場合
        tag
          ? {
              tags: {
                some: { tagName: tag },
              },
            }
          : {},
      ],
    };

    const records = await db.serviceRecord.findMany({
      where: whereCondition,
      include: {
        tags: true,
        user: { select: { displayName: true } }, // 誰が作ったか表示するため
      },
      orderBy: { updatedAt: "desc" },
    });

    return records;
  });

/**
 * レコード詳細取得
 */
export const getRecordDetail = createServerFn({ method: "GET" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data: { id } }) => {
    const user = await getAuthUser();
    if (!user) throw new Error("Unauthorized");

    const record = await db.serviceRecord.findUnique({
      where: { id },
      include: {
        credentials: true,
        tags: true,
      },
    });

    if (!record) throw new Error("Record not found");

    // 権限チェック
    const isOwner = record.userId === user.id;
    const isFamilyShared =
      record.visibility === Visibility.SHARED &&
      record.familyId === user.familyId;

    if (!isOwner && !isFamilyShared) {
      throw new Error("Forbidden: You cannot view this record");
    }

    return { ...record, isEditable: isOwner || isFamilyShared };
  });

/**
 * レコード作成
 * トランザクションを使用して、レコード本体・認証情報・タグを一括保存
 */
export const createRecord = createServerFn({ method: "POST" })
  .inputValidator((data: z.infer<typeof RecordInputSchema>) => data)
  .handler(async ({ data }) => {
    const user = await getAuthUser();
    if (!user) throw new Error("Unauthorized");
    const inputData = RecordInputSchema.parse(data);

    // トランザクション実行
    return await db.$transaction(async (tx) => {
      return await tx.serviceRecord.create({
        data: {
          userId: user.id,
          familyId: user.familyId, // 作成時点の家族IDを記録
          title: inputData.title,
          url: inputData.url,
          ogpImage: inputData.ogpImage,
          ogpDescription: inputData.ogpDescription,
          memo: inputData.memo,
          visibility: inputData.visibility,
          // 関連テーブルの作成
          credentials: {
            create: inputData.credentials.map((cred) => ({
              label: cred.label,
              loginId: cred.loginId,
              passwordHint: cred.passwordHint,
            })),
          },
          tags: {
            create: inputData.tags.map((tag) => ({
              tagName: tag,
            })),
          },
        },
      });
    });
  });

/**
 * レコード削除
 * 権限チェック付き
 */
export const deleteRecord = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data: { id } }) => {
    const user = await getAuthUser();
    if (!user) throw new Error("Unauthorized");

    // 削除前の権限確認
    const record = await db.serviceRecord.findUnique({
      where: { id },
    });

    if (!record) throw new Error("Not found");

    const isOwner = record.userId === user.id;
    const isFamilyShared =
      record.visibility === Visibility.SHARED &&
      record.familyId === user.familyId;

    if (!isOwner && !isFamilyShared) {
      throw new Error("Forbidden: Cannot delete this record");
    }

    // 削除実行 (Cascade設定により、credentialsやtagsも自動で消える)
    return await db.serviceRecord.delete({
      where: { id },
    });
  });
