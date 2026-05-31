/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithPopup, signOut, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, serverTimestamp, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Determine if we have a real, configured Firebase config
export const isFirebaseEnabled = !!(
  firebaseConfig &&
  firebaseConfig.apiKey &&
  firebaseConfig.projectId
);

let app;
let db: any = null;
let auth: any = null;

if (isFirebaseEnabled) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    // CRITICAL: Initialize with firestoreDatabaseId if available
    db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
    auth = getAuth(app);
    
    // Validate Connection to Firestore and warn if client is offline or config is mismatching
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    };
    testConnection();
  } catch (err) {
    console.warn("Failed to initialize Firebase SDK:", err);
  }
}

export { db, auth };

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid || null,
      email: auth?.currentUser?.email || null,
      emailVerified: auth?.currentUser?.emailVerified || null,
      isAnonymous: auth?.currentUser?.isAnonymous || null,
      tenantId: auth?.currentUser?.tenantId || null,
      providerInfo: auth?.currentUser?.providerData?.map((provider: any) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Signs in with Google if Firebase is active
export async function signInWithGoogle(): Promise<User | null> {
  if (!isFirebaseEnabled || !auth) return null;
  try {
    const provider = new GoogleAuthProvider();
    const credential = await signInWithPopup(auth, provider);
    return credential.user;
  } catch (error) {
    console.error("Firebase Google Authentication failed:", error);
    return null;
  }
}

// Signs out the current user
export async function logOut(): Promise<void> {
  if (!isFirebaseEnabled || !auth) return;
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Firebase Sign Out failed:", error);
  }
}

// Saves progress to Cloud Firestore
export async function saveProgressToFirebase(
  userId: string,
  unlockedLevels: number[],
  levelBestTimes: Record<string, number>,
  audioMuted: boolean
): Promise<void> {
  if (!isFirebaseEnabled || !db) return;
  
  const path = `users/${userId}`;
  try {
    await setDoc(doc(db, 'users', userId), {
      userId,
      unlockedLevels,
      levelBestTimes,
      settings: {
        audioMuted
      },
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// Loads progress from Cloud Firestore
export async function loadProgressFromFirebase(userId: string): Promise<any | null> {
  if (!isFirebaseEnabled || !db) return null;
  
  const path = `users/${userId}`;
  try {
    const documentSnap = await getDoc(doc(db, 'users', userId));
    if (documentSnap.exists()) {
      return documentSnap.data();
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
}
