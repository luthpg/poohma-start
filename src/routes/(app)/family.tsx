import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
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
  component: FamilyComponent,
});

function FamilyComponent() {
  const { family } = Route.useLoaderData();
  const router = useRouter();

  const [createName, setCreateName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await createFamilyFn({ data: { name: createName } });
      await router.invalidate();
    } catch {
      alert("作成に失敗しました");
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
      alert("参加に失敗しました");
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
        <a
          href="/dashboard"
          className="rounded-md bg-white px-4 py-2 text-[14px] font-medium text-foreground shadow-border hover:bg-gray-50 transition"
        >
          ダッシュボードへ
        </a>
      </div>

      {family ? (
        <div className="rounded-lg bg-white p-6 shadow-card transition-shadow">
          <div className="mb-6 flex items-center justify-between border-b border-border pb-4">
            <h2 className="text-[18px] font-semibold tracking-geist-ui text-foreground">
              {family.name}
            </h2>
          </div>
          <div className="mb-8">
            <h3 className="mb-3 text-[14px] font-medium text-foreground">
              招待コード
            </h3>
            <div className="flex items-center gap-3 rounded-md bg-gray-50/50 p-4 shadow-border-light">
              <code className="flex-1 font-mono text-[16px] font-semibold text-foreground">
                {family.id}
              </code>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(family.id)}
                className="rounded-md bg-white px-4 py-1.5 text-[14px] font-medium text-foreground shadow-border hover:bg-gray-50 transition"
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
                  className="flex items-center justify-between rounded-md bg-white p-4 shadow-border-light"
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
          <div className="rounded-lg bg-white p-6 shadow-card transition-shadow">
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
                  className="w-full rounded-md bg-white p-2.5 text-[14px] shadow-border focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full rounded-md bg-orange-500 px-4 py-2.5 text-[14px] font-medium text-white shadow-border transition hover:bg-orange-600 disabled:opacity-50"
              >
                {isLoading ? "作成中..." : "作成する"}
              </button>
            </form>
          </div>

          {/* 家族に参加 */}
          <div className="rounded-lg bg-white p-6 shadow-card transition-shadow">
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
                  className="w-full font-mono rounded-md bg-white p-2.5 text-[14px] shadow-border focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full rounded-md bg-foreground px-4 py-2.5 text-[14px] font-medium text-background shadow-border transition hover:bg-gray-800 disabled:opacity-50"
              >
                {isLoading ? "参加中..." : "参加する"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
