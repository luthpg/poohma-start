import { createServerFn } from "@tanstack/react-start";
import { getCookie, setCookie } from "@tanstack/react-start/server";
import { db } from "./db.server";
import { adminAuth, getSessionCookie } from "./firebase-admin.server";

/**
 * 認証ユーザーの取得
 * @param idToken FirebaseのIDトークン
 * @returns 認証ユーザー情報
 */
export const syncUser = createServerFn({ method: "GET" })
  .inputValidator((data: { idToken: string }) => data)
  .handler(async ({ data: { idToken } }) => {
    const decodedToken = await adminAuth().verifyIdToken(idToken);
    const { uid, email, name } = decodedToken;

    if (!email) throw new Error("Email is required");

    // ユーザー検索
    const user = await db.user.upsert({
      where: { id: uid },
      update: {
        email,
        displayName: name,
      },
      create: {
        id: uid,
        email,
        displayName: name,
      },
    });

    const sessionCookie = await getSessionCookie(idToken, 60 * 60 * 24 * 5);
    setCookie("session", sessionCookie, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      maxAge: 60 * 60 * 24 * 7,
    });

    return user.id;
  });

/**
 * 認証ユーザーの取得
 * @param idToken FirebaseのIDトークン
 * @returns 認証ユーザー情報
 */
export const getAuthUser = createServerFn({ method: "GET" }).handler(
  async () => {
    const idToken = getCookie("session");
    if (!idToken) return null;

    try {
      const decodedToken = await adminAuth().verifyIdToken(idToken);
      const { uid } = decodedToken;

      // ユーザー検索
      const user = await db.user.findUnique({
        where: { id: uid },
        select: {
          id: true,
          email: true,
          displayName: true,
          familyId: true,
        },
      });

      return user;
    } catch {
      return null;
    }
  },
);
