import { describe, expect, it } from "vitest";
import {
  decrypt,
  deriveKeyFromPasscode,
  encrypt,
  generateMasterKey,
  unwrapMasterKey,
  wrapMasterKey,
} from "@/lib/crypto"; // 各自のパスエイリアスに合わせて調整してください

describe("1.1 暗号化コアロジックの単体テスト (src/lib/crypto.ts)", () => {
  // テスト共通のダミーデータ定義
  const DUMMY_PASSCODE = "SuperSecurePasscode123!";
  const DUMMY_SALT = "FamilySaltBase64StringOrString=";
  const SECRET_HINT_DATA = "MySecretHint-Netflix-Password-Is-Pooh";

  /**
   * 1.1.1 マスターキー生成とラップ・アンラップのサイクル
   */
  describe("1.1.1 マスターキー生成とラップ・アンラップのサイクル", () => {
    it("マスターキーの生成、パスコード鍵によるラップ、および元のマスターキーへの復元が正しく連動すること", async () => {
      // 1. マスターキー (AES-GCM 256bit) の新規生成
      const masterKey = await generateMasterKey();
      expect(masterKey.type).toBe("secret");
      expect(masterKey.extractable).toBe(true);
      expect(masterKey.algorithm.name).toBe("AES-GCM");

      // 2. ラップ用キー（パスコード由来の鍵）の導出
      const wrappingKey = await deriveKeyFromPasscode(
        DUMMY_PASSCODE,
        DUMMY_SALT,
      );

      // 3. 生成したマスターキーをパスコード鍵でラップ（暗号化）
      const wrapped = await wrapMasterKey(masterKey, wrappingKey);
      expect(wrapped.encrypted).toBeTypeOf("string");
      expect(wrapped.iv).toBeTypeOf("string");
      expect(wrapped.encrypted.length).toBeGreaterThan(0);
      expect(wrapped.iv.length).toBeGreaterThan(0);

      // 4. ラップされた暗号文・IVから元のマスターキーをアンラップ（復元）
      const unwrappedMasterKey = await unwrapMasterKey(
        wrapped.encrypted,
        wrapped.iv,
        wrappingKey,
      );
      expect(unwrappedMasterKey.type).toBe("secret");
      expect(unwrappedMasterKey.algorithm.name).toBe("AES-GCM");

      // 5. 【実効性検証】復元されたマスターキーを使ってデータを暗号化し、元のキーで復号できるかチェック
      const testEncrypted = await encrypt(SECRET_HINT_DATA, unwrappedMasterKey);
      const testDecrypted = await decrypt(
        testEncrypted.encrypted,
        testEncrypted.iv,
        masterKey,
      );
      expect(testDecrypted).toBe(SECRET_HINT_DATA);
    });
  });

  /**
   * 1.1.2 暗号化・復号の整合性とIVのランダム性
   */
  describe("1.1.2 暗号化・復号の整合性とIVのランダム性", () => {
    it("任意の文字列を暗号化し、同一のキーとIVで完全に平文へ復号できること", async () => {
      const masterKey = await generateMasterKey();

      // 暗号化の実行
      const { encrypted, iv } = await encrypt(SECRET_HINT_DATA, masterKey);

      // 復号の実行
      const decrypted = await decrypt(encrypted, iv, masterKey);

      // 平文の完全一致検証
      expect(decrypted).toBe(SECRET_HINT_DATA);
    });

    it("同一キー・同一平文で複数回暗号化を実行した際、IVが毎回ランダムに生成され、暗号文が非決定論的（ユニーク）になること", async () => {
      const masterKey = await generateMasterKey();

      // 同じ条件下で2回暗号化処理を実行
      const run1 = await encrypt(SECRET_HINT_DATA, masterKey);
      const run2 = await encrypt(SECRET_HINT_DATA, masterKey);

      // IVおよび暗号文（Base64）が毎回異なっていることを確認（IV再利用による鍵ストリーム漏洩脆弱性の防御検証）
      expect(run1.iv).not.toBe(run2.iv);
      expect(run1.encrypted).not.toBe(run2.encrypted);
    });
  });

  /**
   * 1.1.3 パスコードからの鍵導出 (PBKDF2)
   */
  describe("1.1.3 パスコードからの鍵導出 (PBKDF2)", () => {
    it("同一のパスコードおよびソルトからは、常に同一の暗号鍵が決定論的に導出されること", async () => {
      // 独立して2回同じパラメータから鍵を導出
      const key1 = await deriveKeyFromPasscode(DUMMY_PASSCODE, DUMMY_SALT);
      const key2 = await deriveKeyFromPasscode(DUMMY_PASSCODE, DUMMY_SALT);

      // 片方のキーで暗号化したデータを、もう片方のキーで正常に復号できることで鍵の同一性を証明
      const { encrypted, iv } = await encrypt(SECRET_HINT_DATA, key1);
      const decrypted = await decrypt(encrypted, iv, key2);

      expect(decrypted).toBe(SECRET_HINT_DATA);
    });

    it("異なるパスコード、または異なるソルトを使用した場合は異なる鍵が導出され、相互に復号できないこと", async () => {
      const keyCorrect = await deriveKeyFromPasscode(
        DUMMY_PASSCODE,
        DUMMY_SALT,
      );
      const keyWrongPass = await deriveKeyFromPasscode(
        "WrongPasscode123!",
        DUMMY_SALT,
      );
      const keyWrongSalt = await deriveKeyFromPasscode(
        DUMMY_PASSCODE,
        "DifferentSaltValue=",
      );

      const { encrypted, iv } = await encrypt(SECRET_HINT_DATA, keyCorrect);

      // 異なるパスコード由来の鍵での復号は認証失敗（エラーがスロー）すること
      await expect(decrypt(encrypted, iv, keyWrongPass)).rejects.toThrow();

      // 異なるソルト由来の鍵での復号も認証失敗すること
      await expect(decrypt(encrypted, iv, keyWrongSalt)).rejects.toThrow();
    });
  });

  /**
   * 1.1.4 異常系：改ざん検知とエラーハンドリング
   */
  describe("1.1.4 異常系：改ざん検知とエラーハンドリング", () => {
    it("暗号文の一部が改ざんされた場合、AES-GCMのタグ検証により復号処理が適切に例外をスローすること", async () => {
      const masterKey = await generateMasterKey();
      const { encrypted, iv } = await encrypt(SECRET_HINT_DATA, masterKey);

      // 暗号文（Base64）の末尾の文字を意図的に書き換えて改ざんをシミュレート
      const corruptedEncrypted =
        encrypted.slice(0, -1) + (encrypted.endsWith("A") ? "B" : "A");

      // AES-GCMの改ざん検知（認証タグ不一致）により例外がスローされることを検証
      await expect(
        decrypt(corruptedEncrypted, iv, masterKey),
      ).rejects.toThrow();
    });

    it("IV（初期化ベクトル）が改ざんされた場合、復号処理が認証エラーとして失敗すること", async () => {
      const masterKey = await generateMasterKey();
      const { encrypted, iv } = await encrypt(SECRET_HINT_DATA, masterKey);

      // IVの文字を一文字書き換える
      const corruptedIv = iv.slice(0, -1) + (iv.endsWith("A") ? "B" : "A");

      await expect(
        decrypt(encrypted, corruptedIv, masterKey),
      ).rejects.toThrow();
    });

    it("誤ったパスコード（鍵）でマスターキーのアンラップを試みた場合、処理が適切に失敗すること", async () => {
      const masterKey = await generateMasterKey();
      const correctWrappingKey = await deriveKeyFromPasscode(
        DUMMY_PASSCODE,
        DUMMY_SALT,
      );
      const wrongWrappingKey = await deriveKeyFromPasscode(
        "InvalidFamilyPasscode!!!",
        DUMMY_SALT,
      );

      // 正しい鍵でラップ
      const wrapped = await wrapMasterKey(masterKey, correctWrappingKey);

      // 誤った鍵でアンラップを試みた場合、復号エラー（例外スロー）になることを検証
      await expect(
        unwrapMasterKey(wrapped.encrypted, wrapped.iv, wrongWrappingKey),
      ).rejects.toThrow();
    });
  });
});
