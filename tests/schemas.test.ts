import { describe, expect, it } from "vitest";
import { RecordInputSchema } from "@/utils/schemas";

describe("RecordInputSchema", () => {
  it("should validate a valid record with encrypted hint", () => {
    const validData = {
      title: "Test Service",
      url: "https://example.com",
      ogpImage: "https://example.com/image.png",
      ogpDescription: "Test Description",
      memo: "Test Memo",
      visibility: "PRIVATE",
      credentials: [
        {
          label: "Admin",
          loginId: "admin@example.com",
          passwordHint: "SGVsbG8gV29ybGQ=", // Base64 encrypted hint
          passwordHintIv: "dGVzdGl2MTIzNDU2", // Base64 IV
        },
      ],
      tags: ["test", "service"],
    };

    const result = RecordInputSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("should validate a credential without passwordHint", () => {
    const validData = {
      title: "Test",
      visibility: "PRIVATE",
      credentials: [
        {
          label: "Admin",
          loginId: "admin@example.com",
        },
      ],
      tags: [],
    };

    const result = RecordInputSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("should reject plaintext passwordHint (not Base64)", () => {
    const invalidData = {
      title: "Test",
      visibility: "PRIVATE",
      credentials: [
        {
          label: "Admin",
          passwordHint: "my secret hint", // plaintext with spaces
          passwordHintIv: "dGVzdGl2MTIzNDU2",
        },
      ],
      tags: [],
    };

    const result = RecordInputSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it("should reject passwordHint without IV", () => {
    const invalidData = {
      title: "Test",
      visibility: "PRIVATE",
      credentials: [
        {
          label: "Admin",
          passwordHint: "SGVsbG8gV29ybGQ=",
          // passwordHintIv is missing
        },
      ],
      tags: [],
    };

    const result = RecordInputSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      const ivIssue = result.error.issues.find(
        (i) => i.path.includes("passwordHintIv"),
      );
      expect(ivIssue).toBeDefined();
    }
  });

  it("should reject IV without passwordHint", () => {
    const invalidData = {
      title: "Test",
      visibility: "PRIVATE",
      credentials: [
        {
          label: "Admin",
          passwordHintIv: "dGVzdGl2MTIzNDU2",
          // passwordHint is missing
        },
      ],
      tags: [],
    };

    const result = RecordInputSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      const hintIssue = result.error.issues.find(
        (i) => i.path.includes("passwordHint"),
      );
      expect(hintIssue).toBeDefined();
    }
  });

  it("should fail if title is empty", () => {
    const invalidData = {
      title: "",
      visibility: "PRIVATE",
      credentials: [],
      tags: [],
    };

    const result = RecordInputSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("タイトルは必須です");
    }
  });

  it("should fail if url is invalid", () => {
    const invalidData = {
      title: "Test",
      url: "not-a-url",
      visibility: "PRIVATE",
      credentials: [],
      tags: [],
    };

    const result = RecordInputSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it("should allow empty string for url", () => {
    const validData = {
      title: "Test",
      url: "",
      visibility: "PRIVATE",
      credentials: [],
      tags: [],
    };

    const result = RecordInputSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  // --- .max() バリデーション ---

  it("should fail if title exceeds 255 characters", () => {
    const invalidData = {
      title: "a".repeat(256),
      visibility: "PRIVATE",
      credentials: [],
      tags: [],
    };

    const result = RecordInputSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        "タイトルは255文字以内で入力してください",
      );
    }
  });

  it("should allow title with exactly 255 characters", () => {
    const validData = {
      title: "a".repeat(255),
      visibility: "PRIVATE",
      credentials: [],
      tags: [],
    };

    const result = RecordInputSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("should fail if tag exceeds 50 characters", () => {
    const invalidData = {
      title: "Test",
      visibility: "PRIVATE",
      credentials: [],
      tags: ["a".repeat(51)],
    };

    const result = RecordInputSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        "タグは50文字以内で入力してください",
      );
    }
  });

  it("should fail if credential label exceeds 100 characters", () => {
    const invalidData = {
      title: "Test",
      visibility: "PRIVATE",
      credentials: [{ label: "a".repeat(101) }],
      tags: [],
    };

    const result = RecordInputSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        "ラベルは100文字以内で入力してください",
      );
    }
  });

  it("should fail if credential loginId exceeds 255 characters", () => {
    const invalidData = {
      title: "Test",
      visibility: "PRIVATE",
      credentials: [{ loginId: "a".repeat(256) }],
      tags: [],
    };

    const result = RecordInputSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        "ログインIDは255文字以内で入力してください",
      );
    }
  });
});
