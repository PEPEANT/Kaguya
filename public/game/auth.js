import { getApp, getApps, initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  updateProfile
} from "https://www.gstatic.com/firebasejs/12.7.0/firebase-auth.js";

import { getFirebaseRuntimeConfig } from "./config/runtime.js";

let persistenceReadyPromise = null;

function hasFirebaseConfig(config) {
  return Boolean(config?.apiKey && config?.authDomain && config?.projectId && config?.appId);
}

function ensureFirebaseReady() {
  const config = getFirebaseRuntimeConfig();

  if (!hasFirebaseConfig(config)) {
    throw new Error("Firebase auth is not configured.");
  }

  return config;
}

function getFirebaseApp() {
  const config = ensureFirebaseReady();
  return getApps()[0] || initializeApp(config);
}

function getFirebaseAuth() {
  return getAuth(getFirebaseApp());
}

function normalizeProviderIds(user) {
  return Array.isArray(user?.providerData)
    ? user.providerData
      .map((provider) => String(provider?.providerId || "").trim())
      .filter(Boolean)
    : [];
}

function normalizeAuthUser(user) {
  if (!user) {
    return null;
  }

  return {
    uid: String(user.uid || ""),
    email: String(user.email || "").trim(),
    displayName: String(user.displayName || "").trim(),
    emailVerified: Boolean(user.emailVerified),
    providerIds: normalizeProviderIds(user)
  };
}

async function ensurePersistenceReady() {
  if (!persistenceReadyPromise) {
    persistenceReadyPromise = setPersistence(getFirebaseAuth(), browserLocalPersistence).catch((error) => {
      console.warn("Failed to enable browserLocalPersistence for Firebase Auth.", error);
      return undefined;
    });
  }

  await persistenceReadyPromise;
}

export async function initAuth(onChange = () => {}) {
  ensureFirebaseReady();
  await ensurePersistenceReady();

  return new Promise((resolve, reject) => {
    let settled = false;

    const unsubscribe = onAuthStateChanged(
      getFirebaseAuth(),
      (user) => {
        const normalizedUser = normalizeAuthUser(user);
        onChange(normalizedUser);

        if (!settled) {
          settled = true;
          resolve({ user: normalizedUser, unsubscribe });
        }
      },
      (error) => {
        if (!settled) {
          settled = true;
          reject(error);
        } else {
          console.error(error);
        }
      }
    );
  });
}

export function getCurrentAuthUser() {
  try {
    return normalizeAuthUser(getFirebaseAuth().currentUser);
  } catch {
    return null;
  }
}

export async function getCurrentAuthIdToken(forceRefresh = false) {
  ensureFirebaseReady();
  await ensurePersistenceReady();

  const user = getFirebaseAuth().currentUser;
  if (!user) {
    throw new Error("Authenticated user is required.");
  }

  return user.getIdToken(Boolean(forceRefresh));
}

export async function signUpWithEmail({ email, password, nickname = "" }) {
  ensureFirebaseReady();
  await ensurePersistenceReady();

  const safeEmail = String(email || "").trim();
  const safeNickname = String(nickname || "").trim();
  const credential = await createUserWithEmailAndPassword(getFirebaseAuth(), safeEmail, password);

  if (safeNickname) {
    await updateProfile(credential.user, { displayName: safeNickname });
  }

  return normalizeAuthUser(getFirebaseAuth().currentUser || credential.user);
}

export async function signInWithEmail({ email, password }) {
  ensureFirebaseReady();
  await ensurePersistenceReady();

  const safeEmail = String(email || "").trim();
  const credential = await signInWithEmailAndPassword(getFirebaseAuth(), safeEmail, password);
  return normalizeAuthUser(getFirebaseAuth().currentUser || credential.user);
}

export async function sendPasswordResetLink(email) {
  ensureFirebaseReady();
  await ensurePersistenceReady();

  const safeEmail = String(email || "").trim();
  await sendPasswordResetEmail(getFirebaseAuth(), safeEmail);
}

export async function signOutCurrentUser() {
  ensureFirebaseReady();
  await ensurePersistenceReady();
  await signOut(getFirebaseAuth());
}

export async function updateCurrentUserNickname(nickname) {
  ensureFirebaseReady();
  await ensurePersistenceReady();

  const auth = getFirebaseAuth();
  const user = auth.currentUser;
  const safeNickname = Array.from(String(nickname || "").trim().replace(/\s+/g, " ")).slice(0, 12).join("");

  if (!user) {
    throw new Error("Authenticated user is required.");
  }

  if (!safeNickname) {
    throw new Error("Nickname is required.");
  }

  await updateProfile(user, { displayName: safeNickname });
  return normalizeAuthUser(auth.currentUser || user);
}
