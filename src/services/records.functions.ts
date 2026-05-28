import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/services/auth.middleware";
import {
  createRecordLogic,
  deleteRecordLogic,
  exportOwnedRecordsCsvLogic,
  exportRecordsCsvLogic,
  getAvailableTagsLogic,
  getOgpInfoLogic,
  getRecordDetailLogic,
  getRecordsLogic,
  importRecordsCsvLogic,
  updateRecordLogic,
} from "@/services/records.server";
import type { RecordInputSchema } from "@/utils/schemas";

/**
 * レコード一覧取得
 * 条件: 自分が作成したもの OR (共有設定 AND 同じ家族)
 */
export const getRecords = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .inputValidator((data: unknown) =>
    z
      .object({
        tag: z.string().optional(),
        q: z.string().optional(),
        page: z.number().min(1).optional(),
        limit: z.number().min(1).max(100).optional(),
        sort: z.string().optional(),
      })
      .optional()
      .parse(data),
  )
  .handler(async ({ data, context: { user } }) => {
    return await getRecordsLogic(user, data);
  });

/**
 * レコード詳細取得
 */
export const getRecordDetail = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data: { id }, context: { user } }) => {
    return await getRecordDetailLogic(user, id);
  });

/**
 * レコード作成
 * トランザクションを使用して、レコード本体・認証情報・タグを一括保存
 */
export const createRecord = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((data: z.infer<typeof RecordInputSchema>) => data)
  .handler(async ({ data, context: { user } }) => {
    return await createRecordLogic(user, data);
  });

/**
 * レコード削除
 * 権限チェック付き
 */
export const deleteRecord = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data: { id }, context: { user } }) => {
    return await deleteRecordLogic(user, id);
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
    return await updateRecordLogic(user, id, inputData);
  });

/**
 * OGP情報取得
 * 指定されたURLからHTMLを取得し、タイトルやOGP画像を抽出します
 */
export const getOgpInfoFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .inputValidator((data: { url: string }) => data)
  .handler(async ({ data: { url } }) => {
    return await getOgpInfoLogic(url);
  });

/**
 * 利用可能な全タグ一覧の取得
 */
export const getAvailableTagsFn = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context: { user } }) => {
    return await getAvailableTagsLogic(user);
  });

/**
 * 全レコード（自分＋共有）をエクスポート用の形式で取得
 */
export const exportRecordsCsv = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context: { user } }) => {
    return await exportRecordsCsvLogic(user);
  });

/**
 * 自身がオーナーのレコードのみをエクスポート用の形式で取得
 */
export const exportOwnedRecordsCsv = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context: { user } }) => {
    return await exportOwnedRecordsCsvLogic(user);
  });

/**
 * CSVデータからレコードを一括登録（部分的成功を許容）
 */
export const importRecordsCsv = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((data: Record<string, unknown>[]) => data)
  .handler(async ({ data: rows, context: { user } }) => {
    return await importRecordsCsvLogic(rows, user);
  });
