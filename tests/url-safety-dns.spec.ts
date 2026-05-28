import dns from "node:dns/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { validateUrlSafety } from "@/utils/url-safety";

// node:dns/promises モジュール全体をモック化
vi.mock("node:dns/promises");

describe("1.2 SSRF対策ロジック (DNS解決のモックによる動的IP検証)", () => {
  beforeEach(() => {
    // 各テストの実行前にモックの状態（呼ばれた回数や設定された戻り値）をリセット
    vi.resetAllMocks();
  });

  it("DNS解決結果がパブリックIPのみを返す場合は検証を通過すること", async () => {
    // resolve4, resolve6 がそれぞれパブリックIPを返すようにスタブ化
    vi.mocked(dns.resolve4).mockResolvedValue(["8.8.8.8"]);
    vi.mocked(dns.resolve6).mockResolvedValue(["2001:4860:4860::8888"]);

    // 通常のドメインを指定
    await expect(
      validateUrlSafety("https://safe-domain.com"),
    ).resolves.toBeUndefined();

    // モックが対象のドメイン名で正しく呼び出されたかアサーション
    expect(dns.resolve4).toHaveBeenCalledWith("safe-domain.com");
    expect(dns.resolve6).toHaveBeenCalledWith("safe-domain.com");
  });

  it("ホスト名は正当に見えても、DNS解決結果がIPv4のプライベートIPを返す場合はブロックすること", async () => {
    // 悪意のあるDNSサーバーがプライベートIP (10.0.0.1) を返した状況をシミュレート
    vi.mocked(dns.resolve4).mockResolvedValue(["10.0.0.1"]);
    vi.mocked(dns.resolve6).mockResolvedValue([]);

    await expect(
      validateUrlSafety("https://malicious-rebinding-domain.com"),
    ).rejects.toThrow("Access to private IP addresses is not allowed");
  });

  it("DNS解決結果がIPv6のプライベートIP（ループバック）を返す場合もブロックすること", async () => {
    // IPv6のループバック (::1) を返すようにシミュレート
    vi.mocked(dns.resolve4).mockResolvedValue([]);
    vi.mocked(dns.resolve6).mockResolvedValue(["::1"]);

    await expect(
      validateUrlSafety("https://malicious-ipv6-domain.com"),
    ).rejects.toThrow("Access to private IP addresses is not allowed");
  });

  it("複数のIPアドレスが返され、その中に1つでもプライベートIPが含まれている場合はブロックすること", async () => {
    // パブリックIPとプライベートIPが混在して返却されるケース
    vi.mocked(dns.resolve4).mockResolvedValue(["8.8.8.8", "192.168.1.5"]);
    vi.mocked(dns.resolve6).mockResolvedValue([]);

    await expect(
      validateUrlSafety("https://mixed-ips-domain.com"),
    ).rejects.toThrow("Access to private IP addresses is not allowed");
  });

  it("DNS解決に失敗した場合（NXDOMAINなど）は空配列として処理され、クラッシュしないこと", async () => {
    // DNS解決エラー（ドメインが存在しない等）をシミュレート
    vi.mocked(dns.resolve4).mockRejectedValue(new Error("ENOTFOUND"));
    vi.mocked(dns.resolve6).mockRejectedValue(new Error("ENOTFOUND"));

    // 実装側で `.catch(() => [])` とフォールバック処理されているため、
    // プライベートIPチェックには引っかからず、関数自体は正常終了（通過）すること。
    // ※ 存在しないドメインに対する後続の fetch 自体は失敗するため、セキュリティ上問題ありません。
    await expect(
      validateUrlSafety("https://non-existent-domain.com"),
    ).resolves.toBeUndefined();
  });
});
