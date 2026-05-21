import { type FirebaseApp, getApps, initializeApp } from "firebase/app";
import { type Auth, GoogleAuthProvider, getAuth } from "firebase/auth";
import { env } from "@/env";

const isBrowser = typeof window !== "undefined";

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  // 開発環境かつブラウザの場合は、Viteのプロキシ経由で認証を行うために現在のオリジンを使用する
  authDomain:
    isBrowser &&
    env.VITE_FIREBASE_AUTH_DOMAIN?.includes("firebaseapp.com") &&
    window.location.hostname === "localhost"
      ? window.location.host
      : env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let googleProvider: GoogleAuthProvider | null = null;

if (isBrowser) {
  app = getApps()?.length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  auth = getAuth(app);
  googleProvider = new GoogleAuthProvider();
}

export { auth, googleProvider };
