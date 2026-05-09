import { type FirebaseApp, getApps, initializeApp } from "firebase/app";
import { type Auth, GoogleAuthProvider, getAuth } from "firebase/auth";
import { env } from "@/env";

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: typeof window !== "undefined" ? window.location.host : env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
};

// ブラウザ環境でのみ初期化を行う（SSR対策）
const isBrowser = typeof window !== "undefined";

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let googleProvider: GoogleAuthProvider | null = null;

if (isBrowser) {
  app = getApps()?.length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  auth = getAuth(app);
  googleProvider = new GoogleAuthProvider();
}

export { auth, googleProvider };
