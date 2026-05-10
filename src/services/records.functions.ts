import { createServerFn } from "@tanstack/react-start";
import type { z } from "zod";
import { type Prisma, Visibility } from "@/../generated/prisma/client"; // Prismaが生成したEnum
import { authMiddleware } from "@/services/auth.middleware";
import { db } from "@/services/db.server";
import { RecordInputSchema } from "@/utils/schemas";

/**
 * レコード一覧取得
 * 条件: 自分が作成したもの OR (共有設定 AND 同じ家族)
 */
export const getRecords = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .inputValidator(
    (data?: {
      tag?: string;
      q?: string;
      page?: number;
      limit?: number;
      sort?: string;
    }) => data,
  )
  .handler(async ({ data, context: { user } }) => {
    const { tag, q, page = 1, limit = 20, sort = "name-asc" } = data || {};

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

    const whereCondition: Prisma.ServiceRecordWhereInput = {
      AND: [
        {
          OR: [
            { userId: user.id },
            user.familyId
              ? {
                  visibility: Visibility.SHARED,
                  familyId: user.familyId,
                }
              : undefined,
          ].filter(Boolean) as Prisma.ServiceRecordWhereInput[],
        },
        searchFilter,
        tagFilter,
      ].filter(Boolean) as Prisma.ServiceRecordWhereInput[],
    };

    // ソート順の構築
    let orderBy:
      | Prisma.ServiceRecordOrderByWithRelationInput
      | Prisma.ServiceRecordOrderByWithRelationInput[] = { updatedAt: "desc" };
    if (sort === "name-asc") orderBy = { title: "asc" };
    if (sort === "name-desc") orderBy = { title: "desc" };
    if (sort === "url-asc") orderBy = { url: "asc" };
    if (sort === "url-desc") orderBy = { url: "desc" };

    const skip = (page - 1) * limit;

    const records = await db.serviceRecord.findMany({
      where: whereCondition,
      skip,
      take: limit + 1, // 次のページがあるか確認するために1件多く取得
      include: {
        tags: true,
        user: { select: { displayName: true } },
      },
      orderBy,
    });

    const hasNextPage = records.length > limit;
    const items = hasNextPage ? records.slice(0, limit) : records;

    return {
      items,
      hasNextPage,
    };
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

    if (!user.familyId) {
      throw new Error(
        "家族グループに所属していません。先に家族を作成または参加してください。",
      );
    }
    const familyId = user.familyId;

    // トランザクション実行
    return await db.$transaction(async (tx) => {
      return await tx.serviceRecord.create({
        data: {
          userId: user.id,
          familyId, // 作成時点の家族IDを記録
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
              passwordHintIv: cred.passwordHintIv,
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
              passwordHintIv: cred.passwordHintIv,
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

/**
 * 全レコードをエクスポート用の形式で取得
 */
export const exportRecordsCsv = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context: { user } }) => {
    const records = await db.serviceRecord.findMany({
      where: {
        OR: [
          { userId: user.id },
          {
            visibility: Visibility.SHARED,
            familyId: user.familyId || "no-family",
          },
        ],
      },
      include: {
        credentials: {
          orderBy: { createdAt: "asc" },
        },
        tags: {
          orderBy: { tagName: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // CSV用のフラットな構造に変換
    return records.map((r) => {
      const row: Record<string, string> = {
        Title: r.title,
        URL: r.url || "",
        Memo: r.memo || "",
        Visibility: r.visibility,
        Tags: r.tags.map((t) => t.tagName).join(","),
      };

      // 最大10個までの認証情報を列として展開
      for (let i = 0; i < 10; i++) {
        const cred = r.credentials[i];
        const idx = i + 1;
        row[`Label${idx}`] = cred?.label || "";
        row[`LoginID${idx}`] = cred?.loginId || "";
        row[`PasswordHint${idx}`] = cred?.passwordHint || "";
        row[`PasswordHintIv${idx}`] = cred?.passwordHintIv || "";
      }

      return row;
    });
  });

/**
 * CSVデータからレコードを一括登録
 */
export const importRecordsCsv = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((data: Record<string, unknown>[]) => data)
  .handler(async ({ data: rows, context: { user } }) => {
    if (!user.familyId) {
      throw new Error("家族グループに所属していません。");
    }
    const familyId = user.familyId;

    return await db.$transaction(
      async (tx) => {
        for (const row of rows) {
          // タグのパース
          const tags =
            typeof row.Tags === "string"
              ? row.Tags.split(",")
                  .map((t: string) => t.trim())
                  .filter(Boolean)
              : [];

          // 認証情報のパース (Label1, LoginID1, PasswordHint1, PasswordHintIv1...)
          const credentials = [];
          for (let i = 1; i <= 10; i++) {
            const label = row[`Label${i}`];
            const loginId = row[`LoginID${i}`];
            const passwordHint = row[`PasswordHint${i}`];
            const passwordHintIv = row[`PasswordHintIv${i}`];

            if (label || loginId || passwordHint) {
              credentials.push({
                label: String(label || ""),
                loginId: String(loginId || ""),
                passwordHint: String(passwordHint || ""),
                passwordHintIv: passwordHintIv
                  ? String(passwordHintIv)
                  : undefined,
              });
            }
          }

          // 最小限のバリデーション: タイトルがない場合はスキップ
          if (!row.Title) continue;

          await tx.serviceRecord.create({
            data: {
              userId: user.id,
              familyId,
              title: String(row.Title),
              url: row.URL ? String(row.URL) : null,
              memo: row.Memo ? String(row.Memo) : null,
              visibility: row.Visibility === "SHARED" ? "SHARED" : "PRIVATE",
              credentials: {
                create: credentials,
              },
              tags: {
                create: tags.map((tagName: string) => ({
                  tagName,
                })),
              },
            },
          });
        }
      },
      { timeout: 30000 },
    );
  });
