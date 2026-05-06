import { createMiddleware } from "@tanstack/react-start";
import { getAuthUser } from "@/services/auth.functions";

/**
 * 認証ミドルウェア
 * ユーザーが認証されていない場合は Unauthorized エラーをスローします。
 * 認証済みの場合は、context.user にユーザー情報をセットします。
 */
export const authMiddleware = createMiddleware().server(async ({ next }) => {
  const user = await getAuthUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  return next({
    context: {
      user,
    },
  });
});
