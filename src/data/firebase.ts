import { initializeApp, type FirebaseApp } from 'firebase/app'
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check'
import { connectAuthEmulator, getAuth, signInAnonymously, type Auth } from 'firebase/auth'
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore'

/*
 * Firebase web config is public by design: it identifies the project, it does
 * not grant access. Access is enforced by Firestore rules (each visitor can only
 * touch the demo space under their own anonymous ID) and App Check. Each value
 * can be overridden with a `VITE_FIREBASE_*` variable, for example to point a
 * fork at its own project.
 */
const env = import.meta.env

/**
 * Build flag for end-to-end tests: talk to the local Auth and Firestore
 * emulators under a `demo-` project (which never reaches a real project) and
 * skip App Check.
 */
const useEmulators = import.meta.env.VITE_FIREBASE_EMULATORS === '1'

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || 'AIzaSyA02jypiK-CliI8RswM6jFJ_ShAyvJbgB8',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'fundsicles-demo.firebaseapp.com',
  projectId: useEmulators
    ? 'demo-fundsicles-e2e'
    : env.VITE_FIREBASE_PROJECT_ID || 'fundsicles-demo',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || 'fundsicles-demo.firebasestorage.app',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '363073625788',
  appId: env.VITE_FIREBASE_APP_ID || '1:363073625788:web:209c3c93e4b628c99c7ab9',
}

/** reCAPTCHA Enterprise site key used by App Check (public, domain-restricted). */
const appCheckSiteKey: string =
  env.VITE_FIREBASE_APPCHECK_SITE_KEY || '6LduYu0tAAAAAL2XjSOjAgn4lf_q6r2cshnCRs_l'

declare global {
  var FIREBASE_APPCHECK_DEBUG_TOKEN: boolean | string | undefined
}

export type FirebaseServices = { app: FirebaseApp; auth: Auth; db: Firestore }

let services: FirebaseServices | null = null
let signIn: Promise<string> | null = null

function isLocalHost(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    hostname.endsWith('.localhost')
  )
}

/**
 * Initializes Firebase once: App Check, Auth and Firestore with a persistent
 * local cache shared by every open tab. That cache is the only durability layer:
 * unsent writes survive a reload in the SDK's own IndexedDB queue.
 */
export function getFirebase(): FirebaseServices {
  if (services) return services

  // On localhost, App Check uses a debug token (registered in the console)
  // instead of reCAPTCHA. `VITE_APPCHECK_DEBUG=true` prints a new one.
  const debugToken: string | undefined = env.VITE_APPCHECK_DEBUG
  if (debugToken && typeof location !== 'undefined' && isLocalHost(location.hostname)) {
    globalThis.FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken === 'true' ? true : debugToken
  }

  const app = initializeApp(firebaseConfig)
  if (!useEmulators) {
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
      isTokenAutoRefreshEnabled: true,
    })
  }
  const auth = getAuth(app)
  const db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    ignoreUndefinedProperties: true,
  })
  if (useEmulators) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
    connectFirestoreEmulator(db, '127.0.0.1', 8080)
  }
  services = { app, auth, db }
  return services
}

/**
 * Resolves the user ID already stored by Auth's local persistence, without any
 * network call. Null for a first visit.
 */
export async function storedVisitorId(): Promise<string | null> {
  const { auth } = getFirebase()
  await auth.authStateReady()
  return auth.currentUser?.uid ?? null
}

/**
 * Resolves the visitor's anonymous user ID, signing in at most once. The ID is
 * kept by Auth's local persistence, so a returning visitor sees their changes.
 */
export function signInVisitor(): Promise<string> {
  if (signIn) return signIn
  const { auth } = getFirebase()
  signIn = (async () => {
    await auth.authStateReady()
    if (auth.currentUser) return auth.currentUser.uid
    const credential = await signInAnonymously(auth)
    return credential.user.uid
  })()
  // A failed attempt can be retried (for example after going back online).
  signIn.catch(() => {
    signIn = null
  })
  return signIn
}
