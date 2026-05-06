import { createServerFn } from "@tanstack/react-start";
import type { z } from "zod";
import { Visibility } from "@/../generated/prisma/client"; // Prismaが生成したEnum
import { RecordInputSchema } from "@/utils/schemas";
import { authMiddleware } from "./auth.middleware";
import { db } from "./db.server";

/**
 * レコード一覧取得
 * 条件: 自分が作成したもの OR (共有設定 AND 同じ家族)
 */
export const getRecords = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .inputValidator((data?: { tag?: string; q?: string }) => data)
  .handler(async ({ data, context: { user } }) => {
    const { tag, q } = data || {};

    // 検索条件の構築
    const searchFilter = q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { memo: { contains: q, mode: "insensitive" } },
            {
              credentials: {
                some: { label: { contains: q, mode: "insensitive" } },
              },
            },
          ],
        }
      : {};

    const tagFilter = tag
      ? {
          tags: {
            some: { tagName: tag },
          },
        }
      : {};

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
        searchFilter,
        tagFilter,
      ],
    };

    const records = await db.serviceRecord.findMany({
      // biome-ignore lint/suspicious/noTsIgnore: Prismaの型の問題でエラーが出る場合がある
      // @ts-ignore Prismaの型の問題でエラーが出る場合がある
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
  .middleware([authMiddleware])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data: { id }, context: { user } }) => {
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
  .middleware([authMiddleware])
  .inputValidator((data: z.infer<typeof RecordInputSchema>) => data)
  .handler(async ({ data, context: { user } }) => {
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
  .middleware([authMiddleware])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data: { id }, context: { user } }) => {
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

/**
 * レコード更新
 */
export const updateRecord = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator(
    (data: { id: string; data: z.infer<typeof RecordInputSchema> }) => data,
  )
  .handler(async ({ data: { id, data: inputData }, context: { user } }) => {
    const record = await db.serviceRecord.findUnique({ where: { id } });
    if (!record) throw new Error("Not found");

    const isOwner = record.userId === user.id;
    const isFamilyShared =
      record.visibility === Visibility.SHARED &&
      record.familyId === user.familyId;
    if (!isOwner && !isFamilyShared) {
      throw new Error("Forbidden: Cannot update this record");
    }

    return await db.$transaction(async (tx) => {
      // 既存の関連データを削除
      await tx.accountCredential.deleteMany({ where: { recordId: id } });
      await tx.recordTag.deleteMany({ where: { recordId: id } });

      // レコード本体の更新と新しい関連データの作成
      return await tx.serviceRecord.update({
        where: { id },
        data: {
          title: inputData.title,
          url: inputData.url,
          ogpImage: inputData.ogpImage,
          ogpDescription: inputData.ogpDescription,
          memo: inputData.memo,
          visibility: inputData.visibility,
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
 * OGP情報取得
 * 指定されたURLからHTMLを取得し、タイトルやOGP画像を抽出します
 */
export const getOgpInfoFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .inputValidator((data: { url: string }) => data)
  .handler(async ({ data: { url } }) => {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "PoohMa-Bot/1.0" },
      });
      const html = await response.text();

      const titleMatch =
        html.match(
          /<meta\s+(?:property|name)=["']og:title["']\s+content=["']([^"']+)["']/i,
        ) || html.match(/<title>([^<]+)<\/title>/i);
      const imageMatch = html.match(
        /<meta\s+(?:property|name)=["']og:image["']\s+content=["']([^"']+)["']/i,
      );
      const descriptionMatch =
        html.match(
          /<meta\s+(?:property|name)=["']og:description["']\s+content=["']([^"']+)["']/i,
        ) ||
        html.match(
          /<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i,
        );

      return {
        title: titleMatch ? titleMatch[1] : "",
        image: imageMatch ? imageMatch[1] : "",
        description: descriptionMatch ? descriptionMatch[1] : "",
      };
    } catch (error) {
      console.error("OGP fetch failed:", error);
      return { title: "", image: "", description: "" };
    }
  });

/**
 * 利用可能な全タグ一覧の取得
 */
export const getAvailableTagsFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context: { user } }) => {
    const tags = await db.recordTag.findMany({
      where: {
        record: {
          OR: [
            { userId: user.id },
            {
              visibility: Visibility.SHARED,
              familyId: user.familyId || "no-family",
            },
          ],
        },
      },
      select: { tagName: true },
      distinct: ["tagName"],
      orderBy: { tagName: "asc" },
    });

    return tags.map((t) => t.tagName);
  });
