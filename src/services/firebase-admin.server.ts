import fs from "node:fs";
import path from "node:path";
import admin from "firebase-admin";

/**
 * Firebase Admin SDK の初期化
 * HMR(Hot Module Replacement)による二重初期化を防止する
 */
export function initializeFirebaseAdmin() {
  if (admin.apps.length > 0) {
    return admin.app();
  }

  // 1. 環境変数から直接 JSON 文字列を取得（Vercel用）
  const serviceAccountVar = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (serviceAccountVar) {
    try {
      const serviceAccount = JSON.parse(serviceAccountVar);
      // Private key の改行コードを正しく処理する
      if (serviceAccount.private_key) {
        serviceAccount.private_key = serviceAccount.private_key.replace(
          /\\n/g,
          "\n",
        );
      }
      return admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
      });
    } catch (e) {
      console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT env var", e);
    }
  }

  // 2. 従来のファイルパス指定（ローカル開発用）
  const credentialsPath = process.env.FIREBASE_ADMINSDK_CREDENTIALS;
  if (credentialsPath) {
    const fullPath = path.resolve(credentialsPath);
    const fileContent = fs.readFileSync(fullPath, "utf-8");
    return admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(fileContent)),
      storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    });
  }

  return admin.initializeApp({
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  });
}

export const adminAuth = () => initializeFirebaseAdmin().auth();

export const getSessionCookie = async (idToken: string, expiresIn: number) => {
  return adminAuth().createSessionCookie(idToken, { expiresIn });
};

export const verifySessionCookie = async (sessionCookie: string) => {
  return adminAuth().verifySessionCookie(sessionCookie);
};

export const revokeSessionCookie = async (sessionCookie: string) => {
  return adminAuth().revokeRefreshTokens(sessionCookie);
};
