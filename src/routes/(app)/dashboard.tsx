import { createFileRoute } from "@tanstack/react-router";
import { getRecords } from "@/services/records.functions";

export const Route = createFileRoute("/(app)/dashboard")({
  loader: async ({ context }) => {
    const records = await getRecords({ data: {} });
    return { records, user: context.user };
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { records, user } = Route.useLoaderData();

  return (
    <div className="mx-auto max-w-5xl p-6">
      {/* ヘッダーエリア */}
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">ダッシュボード</h1>
          <p className="text-sm text-gray-500">
            ようこそ、{user?.displayName || "ゲスト"}さん
          </p>
        </div>
        <a
          href="/records/new"
          className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-bold text-white shadow-md hover:bg-orange-600 transition"
        >
          + 新規登録
        </a>
      </header>

      {/* 検索・フィルターエリア (今回は見た目だけ) */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="タグやサービス名で検索..."
          className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-orange-500 focus:outline-none"
        />
      </div>

      {/* レコード一覧 (Grid Layout) */}
      {records.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-300 p-10 text-center text-gray-500">
          まだ登録されたサービスはありません。
          <br />
          右上のボタンから追加してみましょう！
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {records.map((record) => (
            <ServiceCard key={record.id} record={record} />
          ))}
        </div>
      )}
    </div>
  );
}

// カードコンポーネント (UIパーツ)
function ServiceCard({ record }: { record: any }) {
  return (
    <div className="group relative overflow-hidden rounded-xl bg-white shadow-sm transition hover:shadow-md border border-gray-100">
      {/* OGP画像エリア */}
      <div className="aspect-video w-full bg-gray-100 object-cover">
        {record.ogpImage ? (
          <img
            src={record.ogpImage}
            alt={record.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-300 text-4xl font-bold bg-gray-50">
            {record.title.slice(0, 1)}
          </div>
        )}
      </div>

      {/* コンテンツエリア */}
      <div className="p-4">
        <div className="mb-2 flex items-start justify-between">
          <h3 className="text-lg font-bold text-gray-800 line-clamp-1">
            {record.title}
          </h3>
          {/* 公開設定バッジ */}
          <span
            className={`rounded px-2 py-0.5 text-xs font-medium ${
              record.visibility === "SHARED"
                ? "bg-green-100 text-green-700"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {record.visibility === "SHARED" ? "家族" : "自分"}
          </span>
        </div>

        {/* タグ表示 */}
        <div className="mb-4 flex flex-wrap gap-1">
          {record.tags.map((tag: any) => (
            <span
              key={tag.id}
              className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
            >
              #{tag.tagName}
            </span>
          ))}
        </div>

        {/* 詳細リンク */}
        <a
          href={`/records/${record.id}`}
          className="block w-full rounded border border-gray-200 bg-white py-1.5 text-center text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          詳細を見る
        </a>
      </div>
    </div>
  );
}
