import { Link, useRouter } from "@tanstack/react-router";
import { signOut } from "firebase/auth";
import {
  Database,
  Download,
  Laptop,
  LogOut,
  Moon,
  Sun,
  Upload,
  UserCog,
  Users,
} from "lucide-react";
import Papa from "papaparse";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { usePasscode } from "@/components/PasscodeProvider";
import { useTheme } from "@/components/theme-provider";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { useExportCsv } from "@/hooks/use-export-csv";
import { logout } from "@/services/auth.functions";
import { importRecordsCsv } from "@/services/records.functions";
import { auth } from "@/utils/firebase";

export function UserMenu({
  user,
}: {
  user: {
    displayName?: string | null;
    email?: string | null;
    photoURL?: string | null;
  };
}) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { masterKey, requireUnlock, encryptHint } = usePasscode();
  const { handleExport, isExporting } = useExportCsv();

  const handleLogout = async () => {
    try {
      if (auth) await signOut(auth);
      await logout();
      await router.invalidate();
      await router.navigate({ to: "/" });
    } catch (_error) {
      toast.error("ログアウトに失敗しました");
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const data = results.data as Record<string, string>[];

          let hasHintsToEncrypt = false;
          for (const row of data) {
            for (let i = 1; i <= 10; i++) {
              if (row[`PasswordHint${i}`]) {
                hasHintsToEncrypt = true;
                break;
              }
            }
            if (hasHintsToEncrypt) break;
          }

          if (hasHintsToEncrypt && !masterKey) {
            const unlocked = await requireUnlock();
            if (!unlocked) {
              setIsImporting(false);
              if (fileInputRef.current) fileInputRef.current.value = "";
              return;
            }
          }

          const encryptedData = await Promise.all(
            data.map(async (row) => {
              const newRow = { ...row };
              for (let i = 1; i <= 10; i++) {
                const hint = newRow[`PasswordHint${i}`];
                if (hint) {
                  const { encrypted, iv } = await encryptHint(hint);
                  newRow[`PasswordHint${i}`] = encrypted;
                  newRow[`PasswordHintIv${i}`] = iv;
                }
              }
              return newRow;
            }),
          );

          const response = await importRecordsCsv({
            data: encryptedData as Record<string, unknown>[],
          });

          if (response.failures && response.failures.length > 0) {
            toast.error(
              <div className="flex flex-col gap-1">
                <p className="font-semibold">
                  {response.successes}件成功、{response.failures.length}件失敗
                </p>
                <ul className="max-h-32 overflow-y-auto text-xs space-y-1 mt-1 opacity-90 list-disc list-inside">
                  {response.failures.map((f) => (
                    <li key={`failure-${f.row}`}>
                      {f.row}行目: {f.reason}
                    </li>
                  ))}
                </ul>
              </div>,
              { duration: 10000 },
            );
          } else {
            toast.success(
              `${response.successes}件のデータをインポートしました`,
            );
          }
          await router.invalidate();
        } catch (error) {
          console.error(error);
          toast.error("インポートに失敗しました");
        } finally {
          setIsImporting(false);
          if (fileInputRef.current) fileInputRef.current.value = "";
        }
      },
    });
  };

  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".csv"
        className="hidden"
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary shadow-border outline-none focus-visible:ring-2 focus-visible:ring-orange-500/50 transition-transform hover:scale-105 active:scale-95"
          >
            <Avatar className="h-8 w-8">
              <AvatarImage
                src={user?.photoURL || undefined}
                alt={user?.displayName || undefined}
              />
              <AvatarFallback className="bg-orange-500 text-white text-[12px] font-semibold">
                {(user?.displayName || user?.email || "U")
                  .slice(0, 1)
                  .toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none text-foreground">
                {user?.displayName || "ユーザー"}
              </p>
              <p className="text-xs leading-none text-muted-foreground">
                {user?.email}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem asChild>
              <Link to="/settings" className="cursor-pointer">
                <UserCog className="mr-2 h-4 w-4" />
                <span>アカウント設定</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/family" className="cursor-pointer">
                <Users className="mr-2 h-4 w-4" />
                <span>家族管理</span>
              </Link>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Database className="mr-2 h-4 w-4" />
                <span>データ管理</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent>
                  <DropdownMenuItem
                    onClick={handleExport}
                    disabled={isExporting}
                  >
                    {isExporting ? (
                      <Spinner className="mr-2 h-4 w-4" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    <span>
                      {isExporting ? "エクスポート中..." : "CSVエクスポート"}
                    </span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isImporting}
                  >
                    {isImporting ? (
                      <Spinner className="mr-2 h-4 w-4" />
                    ) : (
                      <Upload className="mr-2 h-4 w-4" />
                    )}
                    <span>
                      {isImporting ? "インポート中..." : "CSVインポート"}
                    </span>
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                {theme === "dark" ? (
                  <Moon className="mr-2 h-4 w-4" />
                ) : theme === "light" ? (
                  <Sun className="mr-2 h-4 w-4" />
                ) : (
                  <Laptop className="mr-2 h-4 w-4" />
                )}
                <span>テーマ切り替え</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onClick={() => setTheme("light")}>
                    <Sun className="mr-2 h-4 w-4" />
                    <span>ライト</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTheme("dark")}>
                    <Moon className="mr-2 h-4 w-4" />
                    <span>ダーク</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTheme("system")}>
                    <Laptop className="mr-2 h-4 w-4" />
                    <span>システム設定</span>
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <DropdownMenuItem
                onSelect={(e) => e.preventDefault()}
                className="text-red-500 focus:text-red-500 cursor-pointer"
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>ログアウト</span>
              </DropdownMenuItem>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>ログアウトしますか？</AlertDialogTitle>
                <AlertDialogDescription>
                  セッションが終了し、ログイン画面に戻ります。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>キャンセル</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleLogout}
                  className="bg-red-500 hover:bg-red-600 focus:ring-red-500"
                >
                  ログアウト
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
