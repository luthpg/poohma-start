import {
  createFileRoute,
  getRouteApi,
  Link,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { signOut } from "firebase/auth";
import { useState } from "react";
import { z } from "zod";
import { ModeToggle } from "@/components/mode-toggle";
import { logout } from "@/services/auth.functions";
import { getAvailableTagsFn, getRecords } from "@/services/records.functions";
import { auth } from "@/utils/firebase";

const searchSchema = z.object({
  q: z.string().optional(),
  tag: z.string().optional(),
});

export const Route = createFileRoute("/(app)/dashboard")({
  validateSearch: searchSchema,
  loaderDeps: ({ search: { q, tag } }) => ({ q, tag }),
  loader: async ({ context, deps: { q, tag } }) => {
    const [records, availableTags] = await Promise.all([
      getRecords({ data: { q, tag } }),
      getAvailableTagsFn(),
    ]);
    return {
      records,
      availableTags,
      user: context.user,
      searchParams: { q, tag },
    };
  },
  component: RouteComponent,
});

const routeApi = getRouteApi("/(app)/dashboard");

function RouteComponent() {
  const { records, availableTags, user, searchParams } =
    routeApi.useLoaderData();
  const navigate = useNavigate({ from: "/dashboard" });
  const router = useRouter();

  const [searchInput, setSearchInput] = useState(searchParams.q || "");
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate({
      search: (prev) => ({
        ...prev,
        q: searchInput || undefined,
      }),
    });
  };

  const handleTagClick = (tag: string) => {
    navigate({
      search: (prev) => ({
        ...prev,
        tag: tag === searchParams.tag ? undefined : tag, // Toggle tag
      }),
    });
  };

  const handleLogout = async () => {
    if (!window.confirm("ログアウトしますか？")) return;
    setIsLoggingOut(true);
    try {
      if (auth) {
        await signOut(auth);
      }
      await logout();
      await router.invalidate();
      await router.navigate({ to: "/" });
    } catch (error) {
      console.error("Logout failed:", error);
      alert("ログアウトに失敗しました");
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl p-6">
      {/* ヘッダーエリア */}
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-[32px] font-semibold tracking-geist-h1 text-foreground">
            Pooh<span className="text-orange-500">Ma</span>
          </h1>
          <div className="mt-1 flex items-center gap-2">
            <p className="text-[14px] text-muted-foreground">
              ようこそ、{user?.displayName || "ゲスト"}さん
            </p>
            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="text-[12px] text-red-500 hover:text-red-700 underline disabled:opacity-50"
            >
              {isLoggingOut ? "処理中..." : "ログアウト"}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ModeToggle />
          <Link
            to="/family"
            className="rounded-md bg-card px-4 py-2 text-[14px] font-medium text-foreground shadow-border hover:bg-accent transition"
          >
            家族管理
          </Link>
          <Link
            to="/records/new"
            className="rounded-md bg-orange-500 px-4 py-2 text-[14px] font-medium text-white shadow-border hover:bg-orange-600 transition"
          >
            + 新規登録
          </Link>
        </div>
      </header>

      {/* 検索・フィルターエリア */}
      <div className="mb-6">
        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="タグやサービス名で検索..."
            className="w-full rounded-md bg-card px-4 py-2.5 h-10 text-[14px] shadow-border focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-shadow"
          />
          <button
            type="submit"
            className="rounded-md bg-foreground px-4 py-2.5 h-10 w-20 text-[14px] font-medium text-background shadow-border hover:bg-foreground/90 transition"
          >
            検索
          </button>
        </form>
        {/* タグクラウド (フィルター) */}
        {availableTags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {availableTags.map((t: string) => {
              const isActive = searchParams.tag === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleTagClick(t)}
                  className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors ${
                    isActive
                      ? "bg-orange-500 text-white shadow-border"
                      : "bg-card text-muted-foreground shadow-border hover:bg-accent"
                  }`}
                >
                  #{t}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* レコード一覧 (Grid Layout) */}
      {records.length === 0 ? (
        <div className="rounded-lg bg-muted/50 p-12 text-center text-muted-foreground shadow-border">
          まだ登録されたサービスはありません。
          <br />
          右上のボタンから追加してみましょう！
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
          {records.map((record) => (
            <ServiceCard
              key={record.id}
              record={record}
              onTagClick={handleTagClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

type Record = Awaited<ReturnType<typeof getRecords>>[number];
type Tag = { id: string; tagName: string };

// カードコンポーネント (UIパーツ)
function ServiceCard({
  record,
  onTagClick,
}: {
  record: Record & { tags: Tag[] };
  onTagClick: (tag: string) => void;
}) {
  return (
    <Link
      to="/records/$id"
      params={{ id: record.id }}
      className="group relative flex flex-row md:flex-col overflow-hidden rounded-lg bg-card shadow-card transition-shadow hover:shadow-card-hover block"
    >
      {/* OGP画像エリア */}
      <div className="block aspect-square w-28 shrink-0 md:aspect-video md:w-full bg-muted object-cover overflow-hidden">
        {record.ogpImage ? (
          <img
            src={record.ogpImage}
            alt={record.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground/30 text-2xl md:text-4xl font-bold bg-muted transition-transform duration-300 group-hover:scale-105">
            {record.title.slice(0, 1)}
          </div>
        )}
      </div>

      {/* コンテンツエリア */}
      <div className="flex flex-1 flex-col justify-center p-3 md:p-4 overflow-hidden">
        <div className="mb-1 md:mb-2 flex items-start justify-between gap-2">
          <span className="text-[16px] md:text-[18px] font-semibold text-foreground line-clamp-2 md:line-clamp-1 tracking-geist-ui group-hover:text-orange-500 transition-colors">
            {record.title}
          </span>
          {/* 公開設定バッジ */}
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] md:text-xs font-medium ${
              record.visibility === "SHARED"
                ? "bg-blue-100/50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                : "bg-secondary text-muted-foreground"
            }`}
          >
            {record.visibility === "SHARED" ? "家族共有" : "自分のみ"}
          </span>
        </div>

        {/* タグ表示 */}
        <div className="mb-0 md:mb-4 flex flex-wrap gap-1">
          {record.tags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onTagClick(tag.tagName);
              }}
              className="relative z-10 cursor-pointer rounded-full bg-secondary px-2 py-0.5 text-[10px] md:text-[12px] text-muted-foreground hover:bg-accent transition"
            >
              #{tag.tagName}
            </button>
          ))}
        </div>

        {/* 詳細リンク (モバイルでは高さを節約するため非表示) */}
        <span className="mt-auto hidden w-full rounded-md bg-card py-1.5 text-center text-[14px] font-medium text-foreground shadow-border transition group-hover:bg-accent md:block">
          詳細を見る
        </span>
      </div>
    </Link>
  );
}
