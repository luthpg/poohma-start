import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  deriveKeyFromPasscode,
  generateMasterKey,
  generateSalt,
  wrapMasterKey,
} from "@/lib/crypto";
import {
  createFamilyFn,
  getFamilyMembersFn,
  joinFamilyFn,
} from "@/services/family.functions";

export const Route = createFileRoute("/(app)/family")({
  loader: async () => {
    const family = await getFamilyMembersFn();
    return { family };
  },
  pendingComponent: FamilyPending,
  component: FamilyComponent,
});

function FamilyPending() {
  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-[32px] font-semibold tracking-geist-h1 text-foreground">
          家族管理
        </h1>
        <Skeleton className="h-[36px] w-[120px] rounded-md" />
      </div>

      <div className="rounded-lg bg-card p-6 shadow-card transition-shadow">
        <div className="mb-6 flex items-center justify-between border-b border-border pb-4">
          <Skeleton className="h-6 w-32 rounded-md" />
        </div>
        <div className="mb-8">
          <Skeleton className="mb-3 h-5 w-24 rounded-md" />
          <div className="flex items-center gap-3 rounded-md bg-muted/50 p-4 shadow-border-light">
            <Skeleton className="h-6 w-full max-w-[300px] rounded-md" />
            <Skeleton className="h-[32px] w-[60px] rounded-md" />
          </div>
          <Skeleton className="mt-2 h-4 w-64 rounded-md" />
        </div>

        <div>
          <Skeleton className="mb-4 h-5 w-24 rounded-md" />
          <ul className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <li
                // biome-ignore lint/suspicious/noArrayIndexKey: Skeleton component uses index as key
                key={i}
                className="flex items-center justify-between rounded-md bg-card p-4 shadow-border-light border border-border/50"
              >
                <Skeleton className="h-5 w-24 rounded-md" />
                <Skeleton className="h-4 w-32 rounded-md" />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function FamilyComponent() {
  const { family } = Route.useLoaderData();
  const router = useRouter();

  const [createName, setCreateName] = useState("");
  const [createPasscode, setCreatePasscode] = useState("");
  const [createPasscodeConfirm, setCreatePasscodeConfirm] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (createPasscode.length < 4) {
      toast.error("パスコードは4文字以上にしてください");
      return;
    }
    if (createPasscode !== createPasscodeConfirm) {
      toast.error("パスコードが一致しません");
      return;
    }
    setIsLoading(true);
    try {
      // E2EE: マスターキーの生成とラップ
      const salt = generateSalt();
      const passcodeKey = await deriveKeyFromPasscode(createPasscode, salt);
      const masterKey = await generateMasterKey();
      const wrapped = await wrapMasterKey(masterKey, passcodeKey);

      await createFamilyFn({
        data: {
          name: createName,
          masterKeyEncrypted: wrapped.encrypted,
          masterKeyIv: wrapped.iv,
          masterKeySalt: salt,
        },
      });
      toast.success(
        "家族グループを作成しました。再ログインしてパスコードを入力してください。",
      );
      await router.invalidate();
    } catch {
      toast.error("作成に失敗しました");
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await joinFamilyFn({ data: { inviteCode: joinCode } });
      await router.invalidate();
    } catch {
      toast.error("参加に失敗しました");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-[32px] font-semibold tracking-geist-h1 text-foreground">
          家族管理
        </h1>
        <Link
          to="/dashboard"
          className="rounded-md bg-card px-4 py-2 text-[14px] font-medium text-foreground shadow-border hover:bg-accent transition"
        >
          ダッシュボードへ
        </Link>
      </div>

      {family ? (
        <div className="rounded-lg bg-card p-6 shadow-card transition-shadow">
          <div className="mb-6 flex items-center justify-between border-b border-border pb-4">
            <h2 className="text-[18px] font-semibold tracking-geist-ui text-foreground">
              {family.name}
            </h2>
          </div>
          <div className="mb-8">
            <h3 className="mb-3 text-[14px] font-medium text-foreground">
              招待コード
            </h3>
            <div className="flex items-center gap-3 rounded-md bg-muted/50 p-4 shadow-border-light">
              <code className="flex-1 font-mono text-[16px] font-semibold text-foreground">
                {family.id}
              </code>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(family.id)}
                className="rounded-md bg-card px-4 py-1.5 text-[14px] font-medium text-foreground shadow-border hover:bg-accent transition"
              >
                コピー
              </button>
            </div>
            <p className="mt-2 text-[12px] text-muted-foreground">
              このコードを家族に教えて参加してもらいます。
            </p>
          </div>

          <div>
            <h3 className="mb-4 text-[14px] font-medium text-foreground">
              メンバー一覧
            </h3>
            <ul className="space-y-3">
              {family.users.map((u) => (
                <li
                  key={u.id}
                  className="flex items-center justify-between rounded-md bg-card p-4 shadow-border-light"
                >
                  <span className="text-[14px] font-medium text-foreground">
                    {u.displayName || "名無し"}
                  </span>
                  <span className="text-[12px] text-muted-foreground">
                    {u.email}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {/* 家族を作成 */}
          <div className="rounded-lg bg-card p-6 shadow-card transition-shadow">
            <h2 className="mb-6 text-[18px] font-semibold tracking-geist-ui text-foreground">
              家族グループを作成
            </h2>
            <form onSubmit={handleCreate} className="space-y-5">
              <div>
                <label
                  htmlFor="family-name-input"
                  className="mb-1.5 block text-[14px] font-medium text-foreground"
                >
                  グループ名
                </label>
                <input
                  type="text"
                  id="family-name-input"
                  required
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="例: 田中家"
                  className="w-full rounded-md bg-card p-2.5 text-[14px] shadow-border focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                />
              </div>
              <div>
                <label
                  htmlFor="family-passcode-input"
                  className="mb-1.5 block text-[14px] font-medium text-foreground"
                >
                  パスコード <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  id="family-passcode-input"
                  required
                  minLength={4}
                  value={createPasscode}
                  onChange={(e) => setCreatePasscode(e.target.value)}
                  placeholder="4文字以上"
                  className="w-full rounded-md bg-card p-2.5 text-[14px] shadow-border focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                />
                <p className="mt-1.5 text-[12px] text-muted-foreground">
                  暗号化に使用します。忘れるとヒントを復元できません。
                </p>
              </div>
              <div>
                <label
                  htmlFor="family-passcode-confirm-input"
                  className="mb-1.5 block text-[14px] font-medium text-foreground"
                >
                  パスコード（確認）
                </label>
                <input
                  type="password"
                  id="family-passcode-confirm-input"
                  required
                  minLength={4}
                  value={createPasscodeConfirm}
                  onChange={(e) => setCreatePasscodeConfirm(e.target.value)}
                  placeholder="もう一度入力"
                  className="w-full rounded-md bg-card p-2.5 text-[14px] shadow-border focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="flex items-center justify-center w-full rounded-md bg-orange-500 px-4 py-2.5 text-[14px] font-medium text-white shadow-border transition hover:bg-orange-600 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Spinner className="mr-2 h-4 w-4" />
                    作成中...
                  </>
                ) : (
                  "作成する"
                )}
              </button>
            </form>
          </div>

          {/* 家族に参加 */}
          <div className="rounded-lg bg-card p-6 shadow-card transition-shadow">
            <h2 className="mb-6 text-[18px] font-semibold tracking-geist-ui text-foreground">
              既存の家族に参加
            </h2>
            <form onSubmit={handleJoin} className="space-y-5">
              <div>
                <label
                  htmlFor="family-join-input"
                  className="mb-1.5 block text-[14px] font-medium text-foreground"
                >
                  招待コード
                </label>
                <input
                  id="family-join-input"
                  type="text"
                  required
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  className="w-full font-mono rounded-md bg-card p-2.5 text-[14px] shadow-border focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="flex items-center justify-center w-full rounded-md bg-foreground px-4 py-2.5 text-[14px] font-medium text-background shadow-border transition hover:bg-foreground/90 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Spinner className="mr-2 h-4 w-4" />
                    参加中...
                  </>
                ) : (
                  "参加する"
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
