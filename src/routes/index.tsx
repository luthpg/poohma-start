import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className="min-h-screen bg-white font-sans text-gray-900">
      {/* ナビゲーション */}
      <nav className="flex items-center justify-between px-6 py-4 md:px-12">
        <div className="text-2xl font-black text-orange-500">PoohMa</div>
        <Link
          to="/login"
          className="rounded-full bg-gray-100 px-6 py-2 text-sm font-bold transition hover:bg-gray-200"
        >
          ログイン
        </Link>
      </nav>

      {/* ヒーローセクション */}
      <header className="px-6 py-16 text-center md:py-24">
        <h1 className="mx-auto max-w-3xl text-4xl font-extrabold tracking-tight md:text-6xl">
          家族のパスワード、
          <br />
          <span className="text-orange-500">「ヒント」</span>で安全に共有。
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-gray-600">
          パスワードそのものを教え合うのはもう終わり。
          PoohMaなら、ヒントだけで家族が「あぁ、あれね！」と思い出せる。
        </p>
        <div className="mt-10 flex justify-center gap-4">
          <Link
            to="/login"
            className="rounded-full bg-orange-500 px-8 py-4 text-lg font-bold text-white shadow-lg shadow-orange-200 transition hover:bg-orange-600"
          >
            無料で始める
          </Link>
        </div>
      </header>

      {/* 特徴セクション */}
      <section className="bg-orange-50 px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-12 text-center text-3xl font-bold">
            PoohMaが選ばれる理由
          </h2>
          <div className="grid gap-8 md:grid-cols-3">
            <FeatureCard
              icon="🔒"
              title="パスワードを保存しない"
              description="保存するのは「ヒント」だけ。万が一の流出時も、家族以外には正解が分かりません。"
            />
            <FeatureCard
              icon="👨‍👩‍👧‍👦"
              title="家族専用の共有空間"
              description="招待した家族だけで情報を管理。NetflixやWi-Fiの情報を一箇所にまとめます。"
            />
            <FeatureCard
              icon="✨"
              title="URLから情報を自動取得"
              description="サービスのURLを貼るだけで、ロゴやタイトルを自動設定。管理が楽しくなります。"
            />
          </div>
        </div>
      </section>

      {/* 使い方セクション */}
      <section className="px-6 py-20 text-center">
        <h2 className="mb-16 text-3xl font-bold">使いかたはシンプル</h2>
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-12 md:flex-row">
          <Step num="1" text="サービスを登録して「ヒント」を入力" />
          <div className="hidden text-gray-300 md:block">→</div>
          <Step num="2" text="家族を招待して情報を共有" />
          <div className="hidden text-gray-300 md:block">→</div>
          <Step num="3" text="ヒントを見てパスワードを思い出す" />
        </div>
      </section>

      {/* フッター */}
      <footer className="border-t border-gray-100 py-12 text-center text-sm text-gray-400">
        &copy; 2026 PoohMa - Family Password Hint Manager
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-8 shadow-sm transition hover:shadow-md">
      <div className="mb-4 text-4xl">{icon}</div>
      <h3 className="mb-2 text-xl font-bold">{title}</h3>
      <p className="text-sm leading-relaxed text-gray-600">{description}</p>
    </div>
  );
}

function Step({ num, text }: { num: string; text: string }) {
  return (
    <div className="flex flex-1 flex-col items-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-orange-500 font-bold text-white">
        {num}
      </div>
      <p className="font-medium">{text}</p>
    </div>
  );
}
