import { createServerFn } from "@tanstack/react-start";
import { getCookie, setCookie } from "@tanstack/react-start/server";
import { db } from "@/services/db.server";
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
        },
      });

      return user;
    } catch (error) {
      console.error("Auth verification failed:", error);
      return null;
    }
  },
);
