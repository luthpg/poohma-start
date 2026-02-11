import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { signInWithPopup } from "firebase/auth";
import { useState } from "react";
import { syncUser } from "../services/auth.functions";
import { auth, googleProvider } from "../utils/firebase.client";

// 既にログイン済みならダッシュボードへ飛ばす
export const Route = createFileRoute("/login")({
  beforeLoad: ({ context }) => {
    if (context.user) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: LoginPage,
});

function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // 1. Firebase (Client) でログイン
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      const idToken = await user.getIdToken();

      // 2. Server Function を呼んで DB同期 & Cookie設定
      await syncUser({ data: { idToken } });

      // 3. ダッシュボードへリダイレクト
      await router.navigate({ to: "/dashboard" });
    } catch (err) {
      console.error(err);
      setError("ログインに失敗しました。もう一度お試しください。");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md space-y-8 rounded-xl bg-white p-8 shadow-lg">
        {/* ロゴエリア */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-orange-500">PoohMa</h1>
          <p className="mt-2 text-gray-600">
            家族のパスワード、
            <br />
            ヒントで安全に共有しよう。
          </p>
        </div>

        {/* エラー表示 */}
        {error && (
          <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* ログインボタン */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={isLoading}
          className="flex w-full items-center justify-center rounded-lg bg-white border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          {isLoading ? (
            <span>処理中...</span>
          ) : (
            <>
              {/* Google G Logo SVG */}
              <svg className="mr-3 h-5 w-5" viewBox="0 0 24 24">
                <title>Google</title>
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Googleでログイン
            </>
          )}
        </button>
      </div>
    </div>
  );
}
