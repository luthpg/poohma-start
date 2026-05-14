import Papa from "papaparse";
import { useState } from "react";
import { toast } from "sonner";
import { usePasscode } from "@/components/PasscodeProvider";
import { exportOwnedRecordsCsv } from "@/services/records.functions";

export function useExportCsv() {
  const [isExporting, setIsExporting] = useState(false);
  const { masterKey, requireUnlock, decryptHint } = usePasscode();

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const data = await exportOwnedRecordsCsv();

      // Check if there are any encrypted hints
      let hasEncryptedHints = false;
      for (const row of data) {
        for (let i = 1; i <= 10; i++) {
          if (row[`PasswordHint${i}`] && row[`PasswordHintIv${i}`]) {
            hasEncryptedHints = true;
            break;
          }
        }
        if (hasEncryptedHints) break;
      }

      if (hasEncryptedHints && !masterKey) {
        const unlocked = await requireUnlock();
        if (!unlocked) {
          setIsExporting(false);
          return;
        }
      }

      // Decrypt hints for export
      const decryptedData = await Promise.all(
        data.map(async (row) => {
          const newRow = { ...row };
          for (let i = 1; i <= 10; i++) {
            const hint = newRow[`PasswordHint${i}`];
            const iv = newRow[`PasswordHintIv${i}`];
            if (hint && iv) {
              try {
                newRow[`PasswordHint${i}`] = await decryptHint(hint, iv);
              } catch (e) {
                console.error("Failed to decrypt hint for export", e);
                newRow[`PasswordHint${i}`] = "";
              }
            }
            // Remove IV from export
            delete newRow[`PasswordHintIv${i}`];
          }
          return newRow;
        }),
      );

      const csv = Papa.unparse(decryptedData);
      // Excelの文字化け対策としてBOM (UTF-8) を付与
      const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
      const blob = new Blob([bom, csv], { type: "text/csv;charset=utf-8;" });
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

  return { handleExport, isExporting };
}
