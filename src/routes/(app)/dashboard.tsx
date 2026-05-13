import { useSuspenseInfiniteQuery } from "@tanstack/react-query";
import {
  createFileRoute,
  getRouteApi,
  Link,
  redirect,
  useNavigate,
} from "@tanstack/react-router";
import { LayoutGrid, List } from "lucide-react";
import { type SubmitEvent, useEffect, useRef, useState } from "react";
import { z } from "zod";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { UserMenu } from "@/components/user-menu";
import { getAvailableTagsFn, getRecords } from "@/services/records.functions";

type DashboardData = Awaited<ReturnType<typeof getRecords>>;

const searchSchema = z.object({
  q: z.string().optional(),
  tag: z.string().optional(),
  sort: z
    .enum(["name-asc", "name-desc", "url-asc", "url-desc", "updatedAt-desc"])
    .optional(),
  view: z.enum(["card", "list"]).optional(),
});

export const Route = createFileRoute("/(app)/dashboard")({
  validateSearch: searchSchema,
  loaderDeps: ({ search: { q, tag, sort, view } }) => ({ q, tag, sort, view }),
  loader: async ({ context, deps: { q, tag, sort, view } }) => {
    if (!context.user) {
      throw redirect({ to: "/login" });
    }

    const [availableTags] = await Promise.all([
      getAvailableTagsFn(),
      context.queryClient.ensureInfiniteQueryData({
        queryKey: ["records", q, tag, sort],
        queryFn: async ({ pageParam }) => {
          return await getRecords({
            data: {
              q,
              tag,
              sort,
              page: pageParam as number,
              limit: 20,
            },
          });
        },
        initialPageParam: 1,
        getNextPageParam: (
          lastPage: DashboardData,
          allPages: DashboardData[],
        ) => {
          return lastPage.hasNextPage ? allPages.length + 1 : undefined;
        },
      }),
    ]);

    return {
      availableTags,
      user: context.user,
      searchParams: { q, tag, sort, view },
    };
  },
  pendingComponent: DashboardPending,
  component: RouteComponent,
});

function DashboardPending() {
  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="sticky top-0 z-20 -mx-6 -mt-6 mb-6 bg-background/95 px-6 pb-4 pt-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        {/* ヘッダーエリア */}
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-[32px] font-semibold tracking-geist-h1 text-foreground">
              Pooh<span className="text-orange-500">Ma</span>
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-[36px] w-[100px] rounded-md" />
            <Skeleton className="h-10 w-10 rounded-full" />
          </div>
        </header>

        {/* 検索・フィルターエリア */}
        <div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-20 rounded-md" />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-14 rounded-full" />
          </div>
        </div>
      </div>

      {/* レコード一覧 (Grid Layout) */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: Skeleton component uses index as key
            key={i}
            className="flex flex-row md:flex-col overflow-hidden rounded-lg bg-card shadow-card block border border-border/50"
          >
            <Skeleton className="aspect-square w-28 shrink-0 md:aspect-video md:w-full rounded-none" />
            <div className="flex flex-1 flex-col justify-center p-3 md:p-4 gap-2 md:gap-4">
              <Skeleton className="h-5 md:h-6 w-3/4" />
              <div className="flex gap-1">
                <Skeleton className="h-4 md:h-5 w-12 rounded-full" />
                <Skeleton className="h-4 md:h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="mt-auto hidden h-[34px] w-full rounded-md md:block" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const routeApi = getRouteApi("/(app)/dashboard");

type SortParam =
  | "name-asc"
  | "name-desc"
  | "url-asc"
  | "url-desc"
  | "updatedAt-desc";

function RouteComponent() {
  const { availableTags, user, searchParams } = routeApi.useLoaderData();
  const navigate = useNavigate({ from: "/dashboard" });

  // URLパラメータとlocalStorageの同期
  useEffect(() => {
    const STORAGE_KEY_SORT = "poohma_dashboard_sort";
    const STORAGE_KEY_VIEW = "poohma_dashboard_view";

    const lsSort = localStorage.getItem(STORAGE_KEY_SORT);
    const lsView = localStorage.getItem(STORAGE_KEY_VIEW);

    const currentSort = searchParams.sort;
    const currentView = searchParams.view;

    let nextSort = currentSort;
    let nextView = currentView;
    let needsUpdate = false;

    // 1. ソート順の同期
    if (currentSort) {
      // URLに指定がある場合はlocalStorageを更新
      localStorage.setItem(STORAGE_KEY_SORT, currentSort);
    } else if (lsSort) {
      // URLになくlocalStorageにある場合はURLを更新
      nextSort = lsSort as SortParam;
      needsUpdate = true;
    } else {
      // どちらにもない場合はデフォルトを適用
      nextSort = "name-asc";
      needsUpdate = true;
    }

    // 2. ビューモードの同期
    if (currentView) {
      // URLに指定がある場合はlocalStorageを更新
      localStorage.setItem(STORAGE_KEY_VIEW, currentView);
    } else if (lsView) {
      // URLになくlocalStorageにある場合はURLを更新
      nextView = lsView as "card" | "list";
      needsUpdate = true;
    }

    if (needsUpdate) {
      navigate({
        search: (prev) => ({
          ...prev,
          sort: nextSort,
          view: nextView === "card" ? undefined : (nextView as "list"),
        }),
        replace: true,
      });
    }
  }, [searchParams.sort, searchParams.view, navigate]);

  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      // ヘッダーの高さ分(約70px)は常に表示、それ以降でスクロール方向を判定
      if (currentScrollY < 70) {
        setIsHeaderVisible(true);
      } else if (currentScrollY > lastScrollY.current) {
        setIsHeaderVisible(false);
      } else {
        setIsHeaderVisible(true);
      }

      lastScrollY.current = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const [searchInput, setSearchInput] = useState(searchParams.q || "");
  const viewMode = searchParams.view || "card";

  const handleViewModeChange = (newMode: "card" | "list") => {
    navigate({
      search: (prev) => ({
        ...prev,
        view: newMode === "card" ? undefined : newMode, // card is default, save url space
      }),
    });
  };

  const sortParam = (searchParams.sort as SortParam) || "name-asc";

  const handleSortChange = (newSort: SortParam) => {
    navigate({
      search: (prev) => ({
        ...prev,
        sort: newSort,
      }),
    });
  };

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useSuspenseInfiniteQuery({
      queryKey: [
        "records",
        searchParams.q,
        searchParams.tag,
        searchParams.sort,
      ],
      queryFn: async ({ pageParam }) => {
        return await getRecords({
          data: {
            q: searchParams.q,
            tag: searchParams.tag,
            sort: searchParams.sort,
            page: pageParam as number,
            limit: 20,
          },
        });
      },
      initialPageParam: 1,
      getNextPageParam: (
        lastPage: DashboardData,
        allPages: DashboardData[],
      ) => {
        return lastPage.hasNextPage ? allPages.length + 1 : undefined;
      },
    });

  const records = data.pages.flatMap((page) => page.items);

  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          fetchNextPage();
        }
      },
      { threshold: 1.0 },
    );
    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }
    return () => observer.disconnect();
  }, [fetchNextPage]);

  const handleSearch = (e: SubmitEvent) => {
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
      <div
        className={`sticky top-0 z-20 -mx-6 -mt-6 mb-6 bg-background/95 px-6 pb-4 pt-6 backdrop-blur supports-[backdrop-filter]:bg-background/60 transition-transform duration-300 ease-in-out ${
          isHeaderVisible ? "translate-y-0" : "-translate-y-[72px]"
        }`}
      >
        {/* ヘッダーエリア */}
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-[32px] font-semibold tracking-geist-h1 text-foreground">
              Pooh<span className="text-orange-500">Ma</span>
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/records/new"
              className="rounded-md bg-orange-500 px-4 py-2 text-[14px] font-medium text-white shadow-border hover:bg-orange-600 transition"
            >
              + 新規登録
            </Link>
            <UserMenu user={user} />
          </div>
        </header>

        {/* 検索・フィルターエリア */}
        <div>
          <form onSubmit={handleSearch} className="flex items-center gap-2">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="タグやサービス名で検索..."
              className="w-full rounded-md bg-card px-4 py-2.5 h-10 text-base md:text-[14px] shadow-border focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-shadow"
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
      </div>

      {/* レコード一覧 */}
      {records.length > 0 && (
        <div className="mb-4 flex items-center justify-between">
          <div className="text-[14px] text-muted-foreground font-medium tracking-geist-ui">
            {records.length}
            {hasNextPage ? "+" : ""} 件のレコード
          </div>
          <div className="flex items-center gap-3">
            <select
              value={sortParam}
              onChange={(e) => handleSortChange(e.target.value as SortParam)}
              className="rounded-md border border-border/50 bg-card px-2 py-1.5 text-[12px] font-medium text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50"
            >
              <option value="name-asc">名前（昇順）</option>
              <option value="name-desc">名前（降順）</option>
              <option value="url-asc">URL（昇順）</option>
              <option value="url-desc">URL（降順）</option>
            </select>
            <div className="flex items-center rounded-md border border-border/50 bg-card shadow-sm overflow-hidden">
              <button
                type="button"
                onClick={() => handleViewModeChange("card")}
                className={`p-1.5 transition-colors ${viewMode === "card" ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
                title="カード表示"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => handleViewModeChange("list")}
                className={`p-1.5 transition-colors ${viewMode === "list" ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
                title="リスト表示"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {records.length === 0 ? (
        <div className="rounded-lg bg-muted/50 p-12 text-center text-muted-foreground shadow-border">
          まだ登録されたサービスはありません。
          <br />
          右上のボタンから追加してみましょう！
        </div>
      ) : (
        <div
          className={
            viewMode === "card"
              ? "grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-6"
              : "flex flex-col gap-3"
          }
        >
          {records.map((record) =>
            viewMode === "card" ? (
              <ServiceCard
                key={record.id}
                record={record}
                onTagClick={handleTagClick}
              />
            ) : (
              <ServiceListItem
                key={record.id}
                record={record}
                onTagClick={handleTagClick}
              />
            ),
          )}
        </div>
      )}

      {/* インフィニットスクロールの監視用要素とローディングスピナー */}
      {records.length > 0 && (
        <div ref={observerTarget} className="mt-8 flex justify-center py-4">
          {isFetchingNextPage && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Spinner className="h-5 w-5" />
              <span className="text-sm">読み込み中...</span>
            </div>
          )}
          {!hasNextPage && records.length > 0 && (
            <div className="text-sm text-muted-foreground/60">
              すべてのレコードを表示しました
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type Record = NonNullable<
  Awaited<ReturnType<typeof getRecords>>["items"]
>[number];
type Tag = { id: string; tagName: string };

// リスト表示用コンポーネント
function ServiceListItem({
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
      className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 overflow-hidden rounded-lg bg-card p-4 shadow-card transition-shadow hover:shadow-card-hover border border-border/50 block"
    >
      <div className="flex flex-col gap-1 overflow-hidden">
        <div className="flex items-center gap-2">
          <span className="text-[16px] font-semibold text-foreground truncate tracking-geist-ui group-hover:text-orange-500 transition-colors">
            {record.title}
          </span>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
              !record.isOwner
                ? "bg-purple-100/50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
                : record.visibility === "SHARED"
                  ? "bg-blue-100/50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                  : "bg-secondary text-muted-foreground"
            }`}
          >
            {!record.isOwner
              ? "家族レコード"
              : record.visibility === "SHARED"
                ? "共有中"
                : "個人"}
          </span>
        </div>
        {record.url && (
          <span className="text-[12px] text-muted-foreground truncate">
            {record.url}
          </span>
        )}
        {(() => {
          const loginIds = record.credentials
            .map((c) => c.loginId)
            .filter(Boolean);
          if (loginIds.length === 0) return null;
          return (
            <div className="flex items-center gap-1.5 overflow-hidden">
              <span className="text-[12px] font-mono text-muted-foreground truncate">
                {loginIds[0]}
              </span>
              {loginIds.length > 1 && (
                <span className="shrink-0 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  +{loginIds.length - 1} ID(s)
                </span>
              )}
            </div>
          );
        })()}
      </div>

      {record.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 shrink-0 sm:justify-end mt-2 sm:mt-0">
          {record.tags.map((t) => (
            <button
              type="button"
              key={t.id}
              onClick={(e) => {
                e.preventDefault();
                onTagClick(t.tagName);
              }}
              className="rounded-full bg-background border border-border/50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground shadow-sm hover:bg-orange-500 hover:text-white hover:border-orange-500 transition-colors"
            >
              #{t.tagName}
            </button>
          ))}
        </div>
      )}
    </Link>
  );
}

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
              !record.isOwner
                ? "bg-purple-100/50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
                : record.visibility === "SHARED"
                  ? "bg-blue-100/50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                  : "bg-secondary text-muted-foreground"
            }`}
          >
            {!record.isOwner
              ? "家族レコード"
              : record.visibility === "SHARED"
                ? "共有中"
                : "自分のみ"}
          </span>
        </div>

        {/* ログインID表示 */}
        {(() => {
          const loginIds = record.credentials
            .map((c) => c.loginId)
            .filter(Boolean);
          if (loginIds.length === 0) return null;
          return (
            <div className="mb-1 md:mb-2 flex items-center gap-1.5 overflow-hidden">
              <span className="text-[11px] md:text-[12px] font-mono text-muted-foreground truncate">
                {loginIds[0]}
              </span>
              {loginIds.length > 1 && (
                <span className="shrink-0 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  +{loginIds.length - 1} ID(s)
                </span>
              )}
            </div>
          );
        })()}

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
