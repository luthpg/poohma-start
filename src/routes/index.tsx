import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      {/* ナビゲーション */}
      <nav className="flex items-center justify-between px-6 py-4 md:px-12">
        <div className="text-2xl font-bold text-orange-500 tracking-geist-h2">
          PoohMa
        </div>
        <Link
          to="/login"
          className="rounded-md bg-card px-4 py-1.5 text-sm font-medium transition hover:bg-accent shadow-border text-foreground"
        >
          ログイン
        </Link>
      </nav>

      {/* ヒーローセクション */}
      <header className="px-6 py-24 text-center md:py-32">
        <h1 className="mx-auto max-w-3xl text-[40px] font-semibold leading-[1.1] tracking-geist-hero md:text-[64px]">
          家族のパスワード、
          <br />
          <span className="text-orange-500">「ヒント」</span>で安全に共有。
        </h1>
        <p className="mx-auto mt-8 max-w-xl text-[18px] md:text-[20px] leading-[1.8] text-muted-foreground">
          パスワードそのものを教え合うのはもう終わり。
          PoohMaなら、ヒントだけで家族が「あぁ、あれね！」と思い出せる。
        </p>
        <div className="mt-12 flex justify-center gap-4">
          <Link
            to="/login"
            className="rounded-md bg-foreground px-6 py-3 text-[16px] font-medium text-background transition hover:bg-foreground/90 shadow-border"
          >
            無料で始める
          </Link>
          <Link
            to="/login"
            className="rounded-md bg-card px-6 py-3 text-[16px] font-medium text-foreground transition hover:bg-accent shadow-border"
          >
            ログイン
          </Link>
        </div>
      </header>

      {/* 特徴セクション */}
      <section className="bg-card px-6 py-24 md:py-32">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-16 text-center text-[32px] font-semibold tracking-geist-h1">
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
      <section className="px-6 py-24 text-center md:py-32 border-t border-border">
        <h2 className="mb-20 text-[32px] font-semibold tracking-geist-h1">
          使いかたはシンプル
        </h2>
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-12 md:flex-row relative">
          <Step num="1" text="サービスを登録して「ヒント」を入力" />
          <div className="hidden text-border md:block text-2xl font-light">
            →
          </div>
          <Step num="2" text="家族を招待して情報を共有" />
          <div className="hidden text-border md:block text-2xl font-light">
            →
          </div>
          <Step num="3" text="ヒントを見てパスワードを思い出す" />
        </div>
      </section>

      {/* フッター */}
      <footer className="border-t border-border py-12 text-center text-sm text-muted-foreground">
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
    <div className="rounded-lg bg-card p-8 shadow-card transition-shadow hover:shadow-card-hover">
      <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-secondary shadow-border text-2xl">
        {icon}
      </div>
      <h3 className="mb-3 text-[24px] font-semibold tracking-geist-h2 text-foreground">
        {title}
      </h3>
      <p className="text-[16px] leading-[1.6] text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

function Step({ num, text }: { num: string; text: string }) {
  return (
    <div className="flex flex-1 flex-col items-center">
      <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-full bg-orange-500/10 text-[14px] font-medium text-orange-600 shadow-border">
        {num}
      </div>
      <p className="font-medium text-[16px] leading-[1.5] text-foreground">
        {text}
      </p>
    </div>
  );
}
