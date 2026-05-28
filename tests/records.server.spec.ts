import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

// ============================================================================
// ファイルインポート時のクラッシュを防ぐ「空のモック（Void Mock）」
// ============================================================================
vi.mock("@tanstack/react-start", () => {
  const dummyChain = {
    middleware: () => dummyChain,
    inputValidator: () => dummyChain,
    handler: () => dummyChain,
    server: () => dummyChain,
    client: () => dummyChain,
  };
  return {
    createServerFn: () => dummyChain,
    createMiddleware: () => dummyChain,
  };
});
vi.mock("@/utils/url-safety", () => {
  return {
    validateUrlSafety: vi.fn().mockResolvedValue(undefined),
  };
});

import { Visibility } from "@/../generated/prisma/client";
import { db } from "@/services/db.server";
import {
  getOgpInfoLogic,
  getRecordsLogic,
  importRecordsCsvLogic,
} from "@/services/records.server";

describe("2.2.1 閲覧権限（Visibility）の境界値テスト", () => {
  beforeEach(async () => {
    await db.accountCredential.deleteMany();
    await db.recordTag.deleteMany();
    await db.serviceRecord.deleteMany();
    await db.user.deleteMany();
    await db.family.deleteMany();
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("「自分のみ (PRIVATE)」「家族と共有 (SHARED)」の設定が、DBクエリレベルで正しくフィルタリングされること", async () => {
    // 1. ユーザーA（家族1）が PRIVATE レコードと SHARED レコードを作成。
    const family1 = await db.family.create({
      data: {
        name: "Family 1",
        masterKeyEncrypted: "dummy",
        masterKeyIv: "dummy",
        masterKeySalt: "dummy",
      },
    });

    const userA = await db.user.create({
      data: { id: "user_a", email: "a@example.com", familyId: family1.id },
    });

    const userB = await db.user.create({
      data: { id: "user_b", email: "b@example.com", familyId: family1.id },
    });

    const userC = await db.user.create({
      data: { id: "user_c", email: "c@example.com", familyId: null }, // 家族未所属
    });

    // AがPRIVATEレコードを作成
    await db.serviceRecord.create({
      data: {
        userId: userA.id,
        familyId: family1.id,
        title: "Private Record A",
        visibility: Visibility.PRIVATE,
      },
    });

    // AがSHAREDレコードを作成
    const sharedRecord = await db.serviceRecord.create({
      data: {
        userId: userA.id,
        familyId: family1.id,
        title: "Shared Record A",
        visibility: Visibility.SHARED,
      },
    });

    // ユーザーA自身は両方取得できる
    const resA = await getRecordsLogic({
      id: userA.id,
      familyId: userA.familyId,
    });
    expect(resA.items).toHaveLength(2);

    // 2. ユーザーB（家族1）が getRecords を実行。
    const resB = await getRecordsLogic({
      id: userB.id,
      familyId: userB.familyId,
    });
    // 期待する結果: ユーザーBは「AのSHAREDレコード」のみ取得できること。
    expect(resB.items).toHaveLength(1);
    expect(resB.items[0].id).toBe(sharedRecord.id);

    // 3. ユーザーC（家族未所属または家族2）が getRecords を実行。
    const resC = await getRecordsLogic({
      id: userC.id,
      familyId: userC.familyId,
    });
    // 期待する結果: ユーザーCはAのレコードを一切取得できないこと。
    expect(resC.items).toHaveLength(0);
  });
});

describe("2.2.2. OGP取得処理のフェイルセーフとタイムアウト", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  describe("正常系", () => {
    it("正しい OGP メタタグを持つ HTML から、タイトル・画像・説明文を抽出できること", async () => {
      const mockHtml = `
        <html>
          <head>
            <meta property="og:title" content="テストサービスタイトル" />
            <meta property="og:image" content="https://example.com/ogp.png" />
            <meta property="og:description" content="テストサービスの詳細説明文です。" />
          </head>
        </html>
      `;

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          text: async () => mockHtml,
        }),
      );

      const result = await getOgpInfoLogic("https://example.com");

      expect(result).toEqual({
        title: "テストサービスタイトル",
        image: "https://example.com/ogp.png",
        description: "テストサービスの詳細説明文です。",
      });
    });

    it("OGPメタタグがない場合、通常の title タグと description メタタグからフォールバック抽出できること", async () => {
      const mockHtml = `
        <html>
          <head>
            <title>フォールバックタイトル</title>
            <meta name="description" content="フォールバック用の説明文。" />
          </head>
        </html>
      `;

      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          text: async () => mockHtml,
        }),
      );

      const result = await getOgpInfoLogic("https://example.com");

      expect(result).toEqual({
        title: "フォールバックタイトル",
        image: "",
        description: "フォールバック用の説明文。",
      });
    });
  });

  describe("異常系 (フェイルセーフ)", () => {
    it("HTTP ステータスコードが 500 などのエラーを返却した場合、クラッシュせず空のOGP情報を返却すること", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          text: async () => "Internal Server Error",
        }),
      );

      const result = await getOgpInfoLogic("https://example.com");

      expect(result).toEqual({
        title: "",
        image: "",
        description: "",
      });
    });

    it("ネットワーク接続エラー等の理由で fetch が例外をスローした場合、クラッシュせず空のOGP情報を返却すること", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockRejectedValue(new Error("Network Error")),
      );

      const result = await getOgpInfoLogic("https://example.com");

      expect(result).toEqual({
        title: "",
        image: "",
        description: "",
      });
    });
  });

  describe("異常系 (タイムアウト)", () => {
    it("接続先からの応答が極端に遅く5秒を経過した場合、タイムアウトして処理を中断し、空のOGP情報を返却すること", async () => {
      vi.useFakeTimers();

      // 決して自発的に解決しない、または AbortController によって abort された際に reject するモック fetch
      vi.stubGlobal(
        "fetch",
        vi.fn().mockImplementation((_url, options) => {
          return new Promise((_resolve, reject) => {
            const signal = options?.signal;
            const onAbort = () => {
              reject(
                new DOMException("The user aborted a request.", "AbortError"),
              );
            };

            if (signal?.aborted) {
              onAbort();
              return;
            }

            if (signal) {
              signal.addEventListener("abort", onAbort);
            }
          });
        }),
      );

      // 非同期の `getOgpInfoLogic` を呼び出し、Promise を開始させる
      const promise = getOgpInfoLogic("https://slow-response.com");

      // validateUrlSafety (非同期) が解決して、setTimeout が設定されるまでマイクロタスクを進める
      await Promise.resolve();

      // タイマーを5000ms（5秒）進めて、setTimeout タイムアウトをトリガーさせる
      vi.advanceTimersByTime(5000);

      // マイクロタスクキューを進めて非同期処理を解決させる
      await Promise.resolve();
      await Promise.resolve();

      // getOgpInfoLogic が完了するのを待ち、アサーション
      const result = await promise;

      expect(result).toEqual({
        title: "",
        image: "",
        description: "",
      });
    }, 10000);
  });
});

describe("2.2.3 CSV一括インポートのトランザクションと部分成功", () => {
  beforeEach(async () => {
    await db.accountCredential.deleteMany();
    await db.recordTag.deleteMany();
    await db.serviceRecord.deleteMany();
    await db.user.deleteMany();
    await db.family.deleteMany();
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it("正常なデータ2件と不正なデータ1件を含む配列で、successes: 2, failures: 1 が返り、DBには2件のみ登録されること", async () => {
    // テストデータのセットアップ
    const family = await db.family.create({
      data: {
        name: "CSV Test Family",
        masterKeyEncrypted: "dummy",
        masterKeyIv: "dummy",
        masterKeySalt: "dummy",
      },
    });

    const user = await db.user.create({
      data: {
        id: "csv_user",
        email: "csv@example.com",
        familyId: family.id,
      },
    });

    // 正常2件 + タイトル空の不正1件
    const rows: Record<string, unknown>[] = [
      { Title: "Netflix", URL: "https://netflix.com", Visibility: "PRIVATE" },
      { Title: "", URL: "https://invalid.com", Visibility: "PRIVATE" }, // タイトルが空 → 失敗
      {
        Title: "Amazon Prime",
        URL: "https://amazon.co.jp",
        Visibility: "SHARED",
      },
    ];

    const result = await importRecordsCsvLogic(rows, {
      id: user.id,
      familyId: user.familyId,
    });

    // レスポンスの検証
    expect(result.successes).toBe(2);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].row).toBe(2); // 2行目が失敗
    expect(result.failures[0].reason).toContain("タイトル");

    // DBに2件のみ登録されていることを確認
    const dbRecords = await db.serviceRecord.findMany({
      where: { userId: user.id },
    });
    expect(dbRecords).toHaveLength(2);

    const titles = dbRecords.map((r) => r.title).sort();
    expect(titles).toEqual(["Amazon Prime", "Netflix"]);
  });

  it("501行のデータを渡した場合、500行上限エラーがスローされること", async () => {
    const family = await db.family.create({
      data: {
        name: "Limit Test Family",
        masterKeyEncrypted: "dummy",
        masterKeyIv: "dummy",
        masterKeySalt: "dummy",
      },
    });

    const user = await db.user.create({
      data: {
        id: "limit_user",
        email: "limit@example.com",
        familyId: family.id,
      },
    });

    // 501行の配列を生成
    const rows = Array.from({ length: 501 }, (_, i) => ({
      Title: `Record ${i + 1}`,
    }));

    await expect(
      importRecordsCsvLogic(rows, { id: user.id, familyId: user.familyId }),
    ).rejects.toThrow("最大500行");
  });

  it("家族未所属のユーザーが実行した場合、エラーがスローされること", async () => {
    const user = await db.user.create({
      data: {
        id: "no_family_user",
        email: "nofamily@example.com",
        familyId: null,
      },
    });

    const rows = [{ Title: "Test" }];

    await expect(
      importRecordsCsvLogic(rows, { id: user.id, familyId: user.familyId }),
    ).rejects.toThrow("家族グループに所属していません");
  });
});
