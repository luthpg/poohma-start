import { z } from "zod";
import { Visibility } from "@/../generated/prisma/client";

export const CredentialInputSchema = z.object({
  label: z
    .string()
    .max(100, "ラベルは100文字以内で入力してください")
    .optional(),
  loginId: z
    .string()
    .max(255, "ログインIDは255文字以内で入力してください")
    .optional(),
  passwordHint: z.string().optional(),
  passwordHintIv: z.string().optional(),
});

export const RecordInputSchema = z.object({
  title: z
    .string()
    .min(1, "タイトルは必須です")
    .max(255, "タイトルは255文字以内で入力してください"),
  url: z.url().optional().or(z.literal("")),
  ogpImage: z.string().optional(),
  ogpDescription: z.string().optional(),
  memo: z.string().optional(),
  visibility: z.enum(Visibility),
  credentials: z.array(CredentialInputSchema), // IDペアの配列
  tags: z.array(z.string().max(50, "タグは50文字以内で入力してください")), // タグ文字列の配列
});

export const CreateFamilyInputSchema = z.object({
  name: z
    .string()
    .min(1, "家族名は必須です")
    .max(100, "家族名は100文字以内で入力してください"),
  masterKeyEncrypted: z.string(),
  masterKeyIv: z.string(),
  masterKeySalt: z.string(),
});

export const ChangeFamilyInputSchema = z.object({
  action: z.enum(["create", "join"]),
  // create用
  name: z.string().optional(),
  masterKeyEncrypted: z.string().optional(),
  masterKeyIv: z.string().optional(),
  masterKeySalt: z.string().optional(),
  // join用
  inviteCode: z.string().optional(),

  // 再暗号化された認証情報のリスト
  credentials: z.array(
    z.object({
      id: z.string(),
      passwordHint: z.string(),
      passwordHintIv: z.string(),
    }),
  ),
});
