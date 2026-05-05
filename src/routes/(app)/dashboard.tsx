import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { getAvailableTagsFn, getRecords } from "@/services/records.functions";

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

function RouteComponent() {
  const { records, availableTags, user, searchParams } = Route.useLoaderData();
  const navigate = useNavigate({ from: Route.fullPath });
  const [searchInput, setSearchInput] = useState(searchParams.q || "");

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

  return (
    <div className="mx-auto max-w-5xl p-6">
      {/* ヘッダーエリア */}
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-[32px] font-semibold tracking-geist-h1 text-foreground">
            Pooh<span className="text-orange-500">Ma</span>
          </h1>
          <p className="text-[14px] text-muted-foreground mt-1">
            ようこそ、{user?.displayName || "ゲスト"}さん
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/family"
            className="hidden md:block rounded-md bg-white px-4 py-2 text-[14px] font-medium text-foreground shadow-border hover:bg-gray-50 transition"
          >
            家族管理
          </a>
          <a
            href="/records/new"
            className="rounded-md bg-orange-500 px-4 py-2 text-[14px] font-medium text-white shadow-border hover:bg-orange-600 transition"
          >
            + 新規登録
          </a>
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
            className="w-full rounded-md bg-white px-4 py-2.5 h-10 text-[14px] shadow-border focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-shadow"
          />
          <button
            type="submit"
            className="rounded-md bg-foreground px-4 py-2.5 h-10 w-20 text-[14px] font-medium text-background shadow-border hover:bg-gray-800 transition"
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
                      : "bg-white text-gray-600 shadow-border hover:bg-gray-50"
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
        <div className="rounded-lg bg-gray-50/50 p-12 text-center text-muted-foreground shadow-border">
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

// カードコンポーネント (UIパーツ)
function ServiceCard({
  record,
  onTagClick,
}: {
  record: any;
  onTagClick: (tag: string) => void;
}) {
  return (
    <Link
      to="/records/$id"
      params={{ id: record.id }}
      className="group relative flex flex-row md:flex-col overflow-hidden rounded-lg bg-white shadow-card transition-shadow hover:shadow-card-hover block"
    >
      {/* OGP画像エリア */}
      <div className="block aspect-square w-28 shrink-0 md:aspect-video md:w-full bg-gray-100 object-cover overflow-hidden">
        {record.ogpImage ? (
          <img
            src={record.ogpImage}
            alt={record.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-300 text-2xl md:text-4xl font-bold bg-gray-50 transition-transform duration-300 group-hover:scale-105">
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
                ? "bg-[#ebf5ff] text-[#0068d6]"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {record.visibility === "SHARED" ? "家族共有" : "自分のみ"}
          </span>
        </div>

        {/* タグ表示 */}
        <div className="mb-0 md:mb-4 flex flex-wrap gap-1">
          {record.tags.map((tag: any) => (
            <button
              key={tag.id}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onTagClick(tag.tagName);
              }}
              className="relative z-10 cursor-pointer rounded-full bg-gray-100 px-2 py-0.5 text-[10px] md:text-[12px] text-gray-600 hover:bg-gray-200 transition"
            >
              #{tag.tagName}
            </button>
          ))}
        </div>

        {/* 詳細リンク (モバイルでは高さを節約するため非表示) */}
        <span className="mt-auto hidden w-full rounded-md bg-white py-1.5 text-center text-[14px] font-medium text-foreground shadow-border transition group-hover:bg-gray-50 md:block">
          詳細を見る
        </span>
      </div>
    </Link>
  );
}
