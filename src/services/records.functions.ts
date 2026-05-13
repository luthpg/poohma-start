import { createServerFn } from "@tanstack/react-start";
import type { z } from "zod";
import { type Prisma, Visibility } from "@/../generated/prisma/client"; // Prismaが生成したEnum
import { authMiddleware } from "@/services/auth.middleware";
import { db } from "@/services/db.server";
import { RecordInputSchema } from "@/utils/schemas";
import { validateUrlSafety } from "@/utils/url-safety";

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
        credentials: {
          select: { loginId: true },
          orderBy: { createdAt: "asc" },
        },
        tags: true,
        user: { select: { displayName: true } },
      },
      orderBy,
    });

    const hasNextPage = records.length > limit;
    const rawItems = hasNextPage ? records.slice(0, limit) : records;

    // オーナーシップ情報を付与
    const items = rawItems.map((r) => ({
      ...r,
      isOwner: r.userId === user.id,
    }));

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
        user: { select: { displayName: true, email: true } },
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

    return { ...record, isOwner, isEditable: isOwner || isFamilyShared };
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
      // SSRF対策: URLスキームとIPアドレスのバリデーション
      await validateUrlSafety(url);

      // タイムアウト設定 (5秒)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url, {
        headers: { "User-Agent": "PoohMa-Bot/1.0" },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

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
 * レコードのリストをCSV用のフラットな構造に変換する内部ヘルパー
 */
const mapRecordsToCsvRows = (
  records: Prisma.ServiceRecordGetPayload<{
    include: { credentials: true; tags: true };
  }>[],
) => {
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
};

/**
 * 全レコード（自分＋共有）をエクスポート用の形式で取得
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

    return mapRecordsToCsvRows(records);
  });

/**
 * 自身がオーナーのレコードのみをエクスポート用の形式で取得
 */
export const exportOwnedRecordsCsv = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context: { user } }) => {
    const records = await db.serviceRecord.findMany({
      where: { userId: user.id },
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

    return mapRecordsToCsvRows(records);
  });

/**
 * CSVデータからレコードを一括登録（部分的成功を許容）
 */
export const importRecordsCsv = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((data: Record<string, unknown>[]) => data)
  .handler(async ({ data: rows, context: { user } }) => {
    if (!user.familyId) {
      throw new Error("家族グループに所属していません。");
    }
    const familyId = user.familyId;

    const failures: { row: number; reason: string }[] = [];
    const validRecords: (z.infer<typeof RecordInputSchema> & {
      originalRow: number;
    })[] = [];

    // 1. 全行のパースとバリデーション
    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      const rowNum = index + 1; // 1-indexed for user display

      try {
        // 最小限のチェック: タイトルがない場合はエラー
        if (!row.Title) {
          failures.push({ row: rowNum, reason: "タイトルが空です" });
          continue;
        }

        // タグのパース
        const tags =
          typeof row.Tags === "string"
            ? row.Tags.split(",")
                .map((t: string) => t.trim())
                .filter(Boolean)
            : [];

        // 認証情報のパース
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

        // 入力データの構築
        const recordData = {
          title: String(row.Title),
          url: row.URL ? String(row.URL) : "",
          memo: row.Memo ? String(row.Memo) : "",
          visibility: row.Visibility === "SHARED" ? "SHARED" : "PRIVATE",
          credentials,
          tags,
        };

        // Zodスキーマでバリデーション
        const parseResult = RecordInputSchema.safeParse(recordData);
        if (!parseResult.success) {
          const errorMessage = parseResult.error.issues
            .map((i) => i.message)
            .join(", ");
          failures.push({ row: rowNum, reason: errorMessage });
          continue;
        }

        validRecords.push({ ...parseResult.data, originalRow: rowNum });
      } catch (err) {
        failures.push({
          row: rowNum,
          reason: err instanceof Error ? err.message : "不明なエラー",
        });
      }
    }

    // 2. 正常なレコードのみをトランザクションで登録
    let successes = 0;
    if (validRecords.length > 0) {
      for (const record of validRecords) {
        try {
          await db.serviceRecord.create({
            data: {
              userId: user.id,
              familyId,
              title: record.title,
              url: record.url || null,
              memo: record.memo || null,
              visibility: record.visibility,
              credentials: {
                create: record.credentials.map((cred) => ({
                  label: cred.label,
                  loginId: cred.loginId,
                  passwordHint: cred.passwordHint,
                  passwordHintIv: cred.passwordHintIv,
                })),
              },
              tags: {
                create: record.tags.map((tagName: string) => ({
                  tagName,
                })),
              },
            },
          });
          successes++;
        } catch (err) {
          console.error("DB Insert failed for row:", record.originalRow, err);
          failures.push({
            row: record.originalRow,
            reason: "データベースへの保存時にエラーが発生しました",
          });
        }
      }
    }

    return { successes, failures };
  });
