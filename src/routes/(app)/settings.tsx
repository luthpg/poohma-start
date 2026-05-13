import {
  createFileRoute,
  getRouteApi,
  redirect,
  useRouter,
} from "@tanstack/react-router";
import { type SubmitEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import { updateProfileFn } from "@/services/auth.functions";

export const Route = createFileRoute("/(app)/settings")({
  loader: async ({ context }) => {
    if (!context.user) {
      throw redirect({ to: "/login" });
    }
    return { user: context.user };
  },
  component: SettingsComponent,
});

const routeApi = getRouteApi("/(app)/settings");

function SettingsComponent() {
  const { user } = routeApi.useLoaderData();
  const router = useRouter();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const [displayName, setDisplayName] = useState(user.displayName || "");
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: SubmitEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      toast.error("表示名を入力してください");
      return;
    }

    setIsSaving(true);
    try {
      await updateProfileFn({ data: { displayName: displayName.trim() } });
      toast.success("プロフィールを更新しました");
      await router.invalidate();
    } catch (error) {
      console.error(error);
      toast.error("プロフィールの更新に失敗しました");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl p-6">
      {/* 戻るボタン */}
      <div className="sticky top-0 z-20 -mx-6 -mt-6 mb-6 bg-background/95 px-6 pb-4 pt-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <button
          type="button"
          onClick={() => {
            if (window.history.length > 2) {
              window.history.back();
            } else {
              router.navigate({ to: "/dashboard" });
            }
          }}
          className="text-[14px] font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
        >
          <span className="text-[16px] leading-none mb-0.5">←</span> 戻る
        </button>
      </div>

      <div className="mb-8">
        <h1 className="text-[28px] font-semibold tracking-geist-h1 text-foreground mb-2">
          アカウント設定
        </h1>
        <p className="text-[14px] text-muted-foreground">
          プロフィールの情報を変更できます。
        </p>
      </div>

      <div className="rounded-lg bg-card p-6 shadow-card border border-border/50">
        <h2 className="text-[18px] font-semibold text-foreground tracking-geist-ui mb-6 border-b border-border pb-4">
          プロフィール
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="email-input"
              className="block text-[14px] font-medium text-muted-foreground mb-1"
            >
              メールアドレス
            </label>
            <input
              id="email-input"
              type="text"
              value={user.email}
              disabled
              className="w-full rounded-md bg-muted p-2.5 text-base md:text-[14px] text-muted-foreground shadow-sm focus:outline-none opacity-80 cursor-not-allowed"
            />
            <p className="mt-1.5 text-[12px] text-muted-foreground">
              メールアドレスは変更できません。
            </p>
          </div>

          <div>
            <label
              htmlFor="display-name-input"
              className="block text-[14px] font-medium text-foreground mb-1"
            >
              表示名 <span className="text-red-500">*</span>
            </label>
            <input
              id="display-name-input"
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-md bg-card p-2.5 text-base md:text-[14px] shadow-border focus:outline-none focus:ring-2 focus:ring-orange-500/50"
              placeholder="表示名を入力"
            />
          </div>

          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              disabled={isSaving || displayName.trim() === user.displayName}
              className="flex items-center rounded-md bg-foreground px-6 py-2.5 text-[14px] font-medium text-background shadow-lg transition hover:bg-foreground/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" />
                  保存中...
                </>
              ) : (
                "保存する"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
