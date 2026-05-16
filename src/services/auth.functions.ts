import { createServerFn } from "@tanstack/react-start";
import { getCookie, setCookie } from "@tanstack/react-start/server";
import { authMiddleware } from "@/services/auth.middleware";
import { db, withSession } from "@/services/db.server";
import {
  adminAuth,
  getSessionCookie,
  verifySessionCookie,
} from "@/services/firebase-admin.server";

/**
 * 14日間の秒数とミリ秒数
 */
const SESSION_EXPIRES_IN_SECONDS = 60 * 60 * 24 * 14;
const SESSION_EXPIRES_IN_MS = SESSION_EXPIRES_IN_SECONDS * 1000;

/**
 * 認証ユーザーの同期とセッションクッキーの発行
 * @param idToken FirebaseのIDトークン
 * @returns 認証ユーザーID
 */
export const syncUser = createServerFn({ method: "POST" })
  .inputValidator((data: { idToken: string }) => data)
  .handler(async ({ data: { idToken } }) => {
    const decodedToken = await adminAuth().verifyIdToken(idToken);
    const { uid, email, name, picture } = decodedToken;

    if (!email) throw new Error("Email is required");

    // ユーザー検索・作成
    const user = await db.user.upsert({
      where: { id: uid },
      update: {
        email,
        displayName: name,
        photoURL: picture,
      },
      create: {
        id: uid,
        email,
        displayName: name,
        photoURL: picture,
      },
    });

    // セッションクッキーの作成 (expiresIn はミリ秒)
    const sessionCookie = await getSessionCookie(
      idToken,
      SESSION_EXPIRES_IN_MS,
    );

    // クッキーの設定 (maxAge は秒)
    setCookie("session", sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_EXPIRES_IN_SECONDS,
    });

    return user.id;
  });

/**
 * ログアウト処理（クッキーの削除）
 */
export const logout = createServerFn({ method: "POST" }).handler(async () => {
  setCookie("session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0, // 即時無効化
  });
});

/**
 * 認証済みユーザーの取得
 * @returns 認証ユーザー情報 または null
 */
export const getAuthUser = createServerFn({ method: "GET" }).handler(
  async () => {
    const sessionCookie = getCookie("session");
    if (!sessionCookie) return null;

    try {
      const decodedToken = await verifySessionCookie(sessionCookie);
      const { uid } = decodedToken;

      // ユーザー検索
      const user = await db.user.findUnique({
        where: { id: uid },
        select: {
          id: true,
          email: true,
          displayName: true,
          photoURL: true,
          familyId: true,
          family: {
            select: {
              id: true,
              name: true,
              masterKeyEncrypted: true,
              masterKeyIv: true,
              masterKeySalt: true,
            },
          },
        },
      });

      return user;
    } catch (error) {
      console.error("Auth verification failed:", error);
      return null;
    }
  },
);

/**
 * プロフィール（表示名）の更新
 */
export const updateProfileFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .inputValidator((data: { displayName: string }) => data)
  .handler(async ({ data, context: { user } }) => {
    return await withSession(user.id, user.familyId, async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: user.id },
        data: {
          displayName: data.displayName,
        },
      });

      return updatedUser;
    });
  });

/**
 * アカウント（退会）処理
 * - DBからのユーザーデータ（ServiceRecord, User等）削除
 * - 所属メンバーが0人になる場合はFamily削除
 * - Firebase Authからのユーザー削除
 * - セッションクッキー無効化
 */
export const deleteAccountFn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context: { user } }) => {
    // 1. DBトランザクションでデータ削除
    await withSession(user.id, user.familyId, async (tx) => {
      const familyId = user.familyId;

      // 自身が作成したサービスレコードの削除
      // AccountCredentialやRecordTagはCascade設定により自動削除される
      await tx.serviceRecord.deleteMany({
        where: { userId: user.id },
      });

      if (familyId) {
        // 現在の家族メンバー数を取得
        const familyUserCount = await tx.user.count({
          where: { familyId },
        });

        // ユーザー情報を削除
        await tx.user.delete({
          where: { id: user.id },
        });

        // 自身が最後のメンバーだった場合は家族も削除
        if (familyUserCount <= 1) {
          await tx.family.delete({
            where: { id: familyId },
          });
        }
      } else {
        // ユーザー情報を削除 (家族未所属の場合)
        await tx.user.delete({
          where: { id: user.id },
        });
      }
    });

    // 2. Firebase Authからユーザー削除
    try {
      await adminAuth().deleteUser(user.id);
    } catch (error) {
      console.error("Failed to delete user from Firebase Auth:", error);
    }

    // 3. セッションクッキーの無効化
    setCookie("session", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    return { success: true };
  });
