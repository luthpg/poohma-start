import { z } from "zod";
import { Visibility } from "@/../generated/prisma/client";

export const CredentialInputSchema = z.object({
  label: z.string().optional(),
  loginId: z.string().optional(),
  passwordHint: z.string().optional(),
});

export const RecordInputSchema = z.object({
  title: z.string().min(1, "タイトルは必須です"),
  url: z.url().optional().or(z.literal("")),
  ogpImage: z.string().optional(),
  ogpDescription: z.string().optional(),
  memo: z.string().optional(),
  visibility: z.enum(Visibility),
  credentials: z.array(CredentialInputSchema), // IDペアの配列
  tags: z.array(z.string()), // タグ文字列の配列
});
