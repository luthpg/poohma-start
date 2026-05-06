import {
  createFileRoute,
  getRouteApi,
  Link,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { type SubmitEvent, useState } from "react";
import { toast } from "sonner";
import { usePasscode } from "@/components/PasscodeProvider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  deleteRecord,
  getOgpInfoFn,
  getRecordDetail,
  updateRecord,
} from "@/services/records.functions";

export const Route = createFileRoute("/(app)/records/$id")({
  loader: async ({ params }) => {
    // サーバー関数を呼び出してレコード詳細を取得
    const record = await getRecordDetail({ data: { id: params.id } });
    return { record };
  },
  component: RecordDetailComponent,
});

const routeApi = getRouteApi("/(app)/records/$id");

function RecordDetailComponent() {
  const { record } = routeApi.useLoaderData();
  const navigate = useNavigate();
  const router = useRouter();

  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(record.title);
  const [url, setUrl] = useState(record.url || "");
  const [ogpImage, setOgpImage] = useState(record.ogpImage || "");
  const [ogpDescription, setOgpDescription] = useState(
    record.ogpDescription || "",
  );
  const [credentials, setCredentials] = useState(
    record.credentials.map((c) => ({
      label: c.label || "",
      loginId: c.loginId || "",
      passwordHint: c.passwordHint || "",
    })),
  );
  const [tagsInput, setTagsInput] = useState(
    record.tags.map((t) => t.tagName).join(", "),
  );
  const [memo, setMemo] = useState(record.memo || "");
  const [visibility, setVisibility] = useState<"PRIVATE" | "SHARED">(
    record.visibility,
  );
  const [isLoading, setIsLoading] = useState(false);

  const handleUrlBlur = async () => {
    if (!url) return;
    try {
      const ogp = await getOgpInfoFn({ data: { url } });
      if (ogp.title && !title) setTitle(ogp.title);
      if (ogp.image) setOgpImage(ogp.image);
      if (ogp.description) setOgpDescription(ogp.description);
    } catch (e) {
      console.error("Failed to fetch OGP info", e);
    }
  };

  const handleAddCredential = () => {
    setCredentials([
      ...credentials,
      { label: "", loginId: "", passwordHint: "" },
    ]);
  };
  const { encryptHint, decryptHint, masterKey, requireUnlock } = usePasscode();

  const handleEditStart = async () => {
    // If there are encrypted credentials, we need to unlock and decrypt them first
    const hasEncrypted = record.credentials.some(
      (c) => c.passwordHintIv && c.passwordHint,
    );

    if (hasEncrypted) {
      const unlocked = await requireUnlock();
      if (!unlocked) return; // Cannot edit without unlocking

      const decryptedCreds = await Promise.all(
        record.credentials.map(async (c) => {
          if (c.passwordHint && c.passwordHintIv) {
            try {
              const plain = await decryptHint(c.passwordHint, c.passwordHintIv);
              return {
                label: c.label || "",
                loginId: c.loginId || "",
                passwordHint: plain,
              };
            } catch (e) {
              console.error("Decrypt failed during edit start", e);
              return {
                label: c.label || "",
                loginId: c.loginId || "",
                passwordHint: "",
              };
            }
          }
          return {
            label: c.label || "",
            loginId: c.loginId || "",
            passwordHint: c.passwordHint || "",
          };
        }),
      );
      setCredentials(decryptedCreds);
    } else {
      setCredentials(
        record.credentials.map((c) => ({
          label: c.label || "",
          loginId: c.loginId || "",
          passwordHint: c.passwordHint || "",
        })),
      );
    }

    setIsEditing(true);
  };

  const handleEditSubmit = async (e: SubmitEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const tagsArray = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      // E2EE: パスワードヒントを暗号化
      const filteredCreds = credentials.filter(
        (c) => c.label || c.loginId || c.passwordHint,
      );

      // If we are about to save hints, we must ensure we have the masterKey to encrypt them
      const hasHintsToEncrypt = filteredCreds.some((c) => c.passwordHint);
      if (hasHintsToEncrypt && !masterKey) {
        const unlocked = await requireUnlock();
        if (!unlocked) {
          setIsLoading(false);
          return;
        }
      }

      const encryptedCredentials = await Promise.all(
        filteredCreds.map(async (cred) => {
          if (cred.passwordHint) {
            const { encrypted, iv } = await encryptHint(cred.passwordHint);
            return {
              label: cred.label,
              loginId: cred.loginId,
              passwordHint: encrypted,
              passwordHintIv: iv,
            };
          }
          return {
            label: cred.label,
            loginId: cred.loginId,
            passwordHint: cred.passwordHint,
            passwordHintIv: undefined,
          };
        }),
      );

      await updateRecord({
        data: {
          id: record.id,
          data: {
            title,
            url: url || undefined,
            ogpImage: ogpImage || undefined,
            ogpDescription: ogpDescription || undefined,
            memo: memo || undefined,
            visibility,
            credentials: encryptedCredentials,
            tags: tagsArray,
          },
        },
      });
      await router.invalidate();
      setIsEditing(false);
    } catch (error) {
      console.error(error);
      toast.error("更新に失敗しました");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    setIsLoading(true);

    try {
      await deleteRecord({ data: { id: record.id } });
      toast.success("レコードを削除しました");
      await navigate({ to: "/dashboard" });
    } catch (error) {
      console.error("削除エラー:", error);
      toast.error("削除に失敗しました");
    } finally {
      setIsLoading(false);
    }
  };

  if (isEditing) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <h1 className="mb-8 text-[24px] font-semibold tracking-geist-h2 text-foreground">
          レコードを編集
        </h1>
        <form onSubmit={handleEditSubmit} className="space-y-8">
          <section className="rounded-lg bg-card p-6 shadow-card transition-shadow">
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="url-input"
                  className="block text-[14px] font-medium text-foreground"
                >
                  URL
                </label>
                <input
                  id="url-input"
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onBlur={handleUrlBlur}
                  className="mt-1 w-full rounded-md bg-card p-2 text-[14px] shadow-border focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                />
              </div>
              <div>
                <label
                  htmlFor="title-input"
                  className="block text-[14px] font-medium text-foreground"
                >
                  サービス名 <span className="text-red-500">*</span>
                </label>
                <input
                  id="title-input"
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1 w-full rounded-md bg-card p-2 text-[14px] shadow-border focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                />
              </div>
            </div>
          </section>

          <section className="rounded-lg bg-card p-6 shadow-card transition-shadow">
            <div className="mb-6 flex items-center justify-between border-b border-border pb-4">
              <h2 className="text-[18px] font-semibold text-foreground tracking-geist-ui">
                アカウント情報
              </h2>
              <button
                type="button"
                onClick={handleAddCredential}
                className="text-[14px] font-medium text-orange-500 hover:text-orange-600 transition"
              >
                + 追加する
              </button>
            </div>
            <div className="space-y-6">
              {credentials.map((cred, index) => (
                <div
                  // biome-ignore lint/suspicious/noArrayIndexKey: input label
                  key={index}
                  className="rounded-md bg-muted/50 p-5 shadow-border-light relative"
                >
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div>
                      <label
                        htmlFor={`label-input-${index}`}
                        className="block text-[12px] font-medium text-muted-foreground uppercase tracking-wider mb-1"
                      >
                        ラベル
                      </label>
                      <input
                        id={`label-input-${index}`}
                        type="text"
                        value={cred.label}
                        onChange={(e) => {
                          const newCreds = [...credentials];
                          newCreds[index].label = e.target.value;
                          setCredentials(newCreds);
                        }}
                        className="w-full rounded-md bg-card p-2 text-[14px] shadow-border focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor={`login-id-input-${index}`}
                        className="block text-[12px] font-medium text-muted-foreground uppercase tracking-wider mb-1"
                      >
                        ログインID
                      </label>
                      <input
                        id={`login-id-input-${index}`}
                        type="text"
                        value={cred.loginId}
                        onChange={(e) => {
                          const newCreds = [...credentials];
                          newCreds[index].loginId = e.target.value;
                          setCredentials(newCreds);
                        }}
                        className="w-full rounded-md bg-card p-2 text-[14px] shadow-border focus:outline-none focus:ring-2 focus:ring-orange-500/50 font-mono"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor={`password-hint-input-${index}`}
                        className="block text-[12px] font-medium text-muted-foreground uppercase tracking-wider mb-1"
                      >
                        パスワードヒント
                      </label>
                      <input
                        id={`password-hint-input-${index}`}
                        type="text"
                        value={cred.passwordHint}
                        onChange={(e) => {
                          const newCreds = [...credentials];
                          newCreds[index].passwordHint = e.target.value;
                          setCredentials(newCreds);
                        }}
                        className="w-full rounded-md bg-card p-2 text-[14px] shadow-border focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg bg-card p-6 shadow-card transition-shadow space-y-6">
            <div>
              <label
                htmlFor="visibility-input"
                className="block text-[14px] font-medium text-foreground mb-1"
              >
                公開設定
              </label>
              <select
                id="visibility-input"
                value={visibility}
                onChange={(e) =>
                  setVisibility(e.target.value as "PRIVATE" | "SHARED")
                }
                className="w-full rounded-md bg-card p-2.5 text-[14px] shadow-border focus:outline-none focus:ring-2 focus:ring-orange-500/50"
              >
                <option value="PRIVATE">自分のみ (Private)</option>
                <option value="SHARED">家族と共有 (Shared)</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="tags-input"
                className="block text-[14px] font-medium text-foreground mb-1"
              >
                タグ (カンマ区切り)
              </label>
              <input
                id="tags-input"
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                className="w-full rounded-md bg-card p-2 text-[14px] shadow-border focus:outline-none focus:ring-2 focus:ring-orange-500/50"
              />
            </div>
            <div>
              <label
                htmlFor="memo-input"
                className="block text-[14px] font-medium text-foreground mb-1"
              >
                メモ
              </label>
              <textarea
                id="memo-input"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                rows={3}
                className="w-full rounded-md bg-card p-2 text-[14px] shadow-border focus:outline-none focus:ring-2 focus:ring-orange-500/50"
              />
            </div>
          </section>

          <div className="flex justify-end gap-4 border-t border-border pt-6">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="rounded-md bg-card px-6 py-2 text-[14px] font-medium text-foreground shadow-border hover:bg-accent transition"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="rounded-md bg-orange-500 px-6 py-2 text-[14px] font-medium text-white shadow-border hover:bg-orange-600 disabled:opacity-50 transition"
            >
              {isLoading ? "保存中..." : "保存する"}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      {/* 戻るボタン */}
      <div className="mb-6">
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
          <span className="text-[16px] leading-none mb-0.5">←</span>{" "}
          ダッシュボードに戻る
        </button>
      </div>

      <div className="overflow-hidden rounded-lg bg-card shadow-card">
        {/* OGP ヘッダー */}
        <div className="relative aspect-video w-full bg-muted md:aspect-[21/9]">
          {record.ogpImage ? (
            <img
              src={record.ogpImage}
              alt={record.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-4xl font-bold text-muted-foreground/30">
              {record.title.slice(0, 1)}
            </div>
          )}
          {/* URLリンクがあればオーバーレイ */}
          {record.url && (
            <a
              href={record.url}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute bottom-4 right-4 rounded-full bg-black/60 px-4 py-2 text-sm font-medium text-white backdrop-blur-sm hover:bg-black/80"
            >
              サイトを開く ↗
            </a>
          )}
        </div>

        {/* 基本情報 */}
        <div className="p-6 md:p-8">
          <div className="mb-6 flex items-start justify-between">
            <h1 className="text-[24px] font-semibold tracking-geist-h2 text-foreground">
              {record.title}
            </h1>
            <span
              className={`rounded-full px-3 py-1 text-[12px] font-medium tracking-wide uppercase ${
                record.visibility === "SHARED"
                  ? "bg-blue-100/50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                  : "bg-secondary text-muted-foreground"
              }`}
            >
              {record.visibility === "SHARED" ? "家族と共有" : "自分のみ"}
            </span>
          </div>

          {/* タグ */}
          {record.tags.length > 0 && (
            <div className="mb-8 flex flex-wrap gap-2">
              {record.tags.map((tag) => (
                <Link
                  key={tag.id}
                  to="/dashboard"
                  search={{ tag: tag.tagName }}
                  className="rounded bg-secondary px-2 py-1 text-[12px] font-medium text-muted-foreground hover:bg-accent transition"
                >
                  #{tag.tagName}
                </Link>
              ))}
            </div>
          )}

          {/* アカウント情報（ID / ヒント） */}
          <div className="mb-10">
            <h2 className="mb-6 text-[18px] font-semibold text-foreground tracking-geist-ui border-b border-border pb-2">
              アカウント情報
            </h2>
            {record.credentials.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                登録された情報はありません。
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {record.credentials.map((cred) => (
                  <CredentialCard key={cred.id} cred={cred} />
                ))}
              </div>
            )}
          </div>

          {/* メモ */}
          {record.memo && (
            <div className="mb-10">
              <h2 className="mb-4 text-[14px] font-semibold text-foreground tracking-wide uppercase">
                メモ
              </h2>
              <div className="rounded-md bg-muted/50 p-4 text-[14px] text-muted-foreground whitespace-pre-wrap shadow-border-light">
                {record.memo}
              </div>
            </div>
          )}

          {/* アクションボタン (編集権限がある場合のみ) */}
          {record.isEditable && (
            <div className="mt-10 flex justify-end gap-4 border-t border-border pt-6">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    type="button"
                    className="rounded-md px-6 py-2 text-[14px] font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                  >
                    削除する
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      レコードを削除しますか？
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      この操作は取り消せません。本当に削除してもよろしいですか？
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>キャンセル</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-red-500 hover:bg-red-600 focus:ring-red-500"
                    >
                      削除する
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <button
                type="button"
                onClick={handleEditStart}
                className="rounded-md bg-foreground px-6 py-2 text-[14px] font-medium text-background hover:bg-foreground/90 transition"
              >
                編集する
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// E2EE対応: 暗号化されたヒントの復号表示カード
function CredentialCard({
  cred,
}: {
  cred: {
    id: string;
    label: string | null;
    loginId: string | null;
    passwordHint: string | null;
    passwordHintIv: string | null;
  };
}) {
  const { decryptHint, requireUnlock } = usePasscode();
  const [decryptedHint, setDecryptedHint] = useState<string | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);

  const isEncrypted = !!cred.passwordHintIv && !!cred.passwordHint;

  const handleReveal = async () => {
    if (!isEncrypted || !cred.passwordHint || !cred.passwordHintIv) return;
    setIsDecrypting(true);
    try {
      const unlocked = await requireUnlock();
      if (!unlocked) return; // user cancelled or failed

      const plaintext = await decryptHint(
        cred.passwordHint,
        cred.passwordHintIv,
      );
      setDecryptedHint(plaintext);
    } catch (error) {
      console.error("Decrypt failed:", error);
      toast.error("復号に失敗しました");
    } finally {
      setIsDecrypting(false);
    }
  };

  const displayedHint = isEncrypted ? decryptedHint : cred.passwordHint;

  return (
    <div className="rounded-md bg-muted/50 p-5 shadow-border-light relative">
      {cred.label && (
        <div className="mb-2 text-xs font-bold text-orange-600">
          {cred.label}
        </div>
      )}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <div className="text-xs text-muted-foreground">ログインID</div>
          {cred.loginId && (
            <CopyButton text={cred.loginId} label="ログインID" />
          )}
        </div>
        <div className="font-mono text-sm text-foreground select-all">
          {cred.loginId || "-"}
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between mb-1">
          <div className="text-xs text-gray-500 flex items-center gap-1.5">
            パスワードのヒント
            {isEncrypted && (
              <span className="inline-flex items-center rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-400">
                🔒 暗号化
              </span>
            )}
          </div>
          {displayedHint && (
            <CopyButton text={displayedHint} label="パスワードのヒント" />
          )}
        </div>
        {isEncrypted && decryptedHint == null ? (
          <button
            type="button"
            onClick={handleReveal}
            disabled={isDecrypting}
            className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-orange-50 px-3 py-1.5 text-[13px] font-medium text-orange-600 transition hover:bg-orange-100 disabled:opacity-50 dark:bg-orange-900/20 dark:text-orange-400 dark:hover:bg-orange-900/30"
          >
            {isDecrypting ? "復号中..." : "🔓 ヒントを見る"}
          </button>
        ) : (
          <div className="text-sm font-medium text-foreground select-all">
            {displayedHint || "-"}
          </div>
        )}
      </div>
    </div>
  );
}

// アクセシビリティとモバイル操作性を考慮したコピーボタン
function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={`${label}をコピー`}
      // モバイルでタップしやすいよう p-2 -m-2 で物理的なタッチエリアを拡大
      className="p-2 -m-2 text-[11px] font-medium text-orange-500 hover:text-orange-700 transition flex items-center gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 rounded"
    >
      {copied ? (
        <>
          <span aria-hidden="true" className="text-green-500">
            ✓
          </span>
          <span className="text-green-600">コピー済</span>
        </>
      ) : (
        <span>コピー</span>
      )}
    </button>
  );
}
