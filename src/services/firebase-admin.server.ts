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
