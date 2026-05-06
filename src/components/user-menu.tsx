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
  Users,
} from "lucide-react";
import Papa from "papaparse";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useTheme } from "@/components/theme-provider";
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
import { logout } from "@/services/auth.functions";
import {
  exportRecordsCsv,
  importRecordsCsv,
} from "@/services/records.functions";
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
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const data = await exportRecordsCsv();
      const csv = Papa.unparse(data);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `poohma_export_${new Date().toISOString().split("T")[0]}.csv`,
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("データをエクスポートしました");
    } catch (_error) {
      toast.error("エクスポートに失敗しました");
    } finally {
      setIsExporting(false);
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
          await importRecordsCsv({
            data: results.data as Record<string, unknown>[],
          });
          toast.success(`${results.data.length}件のデータをインポートしました`);
          await router.invalidate();
        } catch (_error) {
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
                    <Download className="mr-2 h-4 w-4" />
                    <span>CSVエクスポート</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isImporting}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    <span>CSVインポート</span>
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
          <DropdownMenuItem
            onClick={handleLogout}
            className="text-red-500 focus:text-red-500 cursor-pointer"
          >
            <LogOut className="mr-2 h-4 w-4" />
            <span>ログアウト</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
