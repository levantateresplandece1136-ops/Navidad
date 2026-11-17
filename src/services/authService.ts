import {
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  User,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError } from './firebase';
import { InvitationStatus, OperationType, UserProfile, UserRole } from '../types/models';
import {
  BOOTSTRAPPED_ADMIN_EMAIL,
  DEFAULT_EVENT_ID,
  DEFAULT_EXCHANGE_DATE,
  generateFreeParticipantUid,
  validateFreeAccessName,
} from '../utils/christmasLogic';

const FREE_SESSION_STORAGE_KEY = 'navidad_juntos_free_session_v1';

export interface FreeSession {
  uid: string;
  name: string;
}

export function getSavedFreeSession(): FreeSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(FREE_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<FreeSession>;
    if (typeof parsed.uid === 'string' && parsed.uid && typeof parsed.name === 'string' && parsed.name) {
      return { uid: parsed.uid, name: parsed.name };
    }
    return null;
  } catch {
    return null;
  }
}

export function saveFreeSession(session: FreeSession): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(FREE_SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Non-blocking in restricted storage environments
  }
}

export function clearFreeSession(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(FREE_SESSION_STORAGE_KEY);
  } catch {
    // Non-blocking
  }
}

export function translateAuthError(error: unknown): string {
  const code = (error as { code?: string })?.code || '';
  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  switch (code) {
    case 'auth/popup-closed-by-user':
      return 'Se cerró la ventana de Google antes de completar el acceso.';
    case 'auth/popup-blocked':
      return 'Tu celular bloqueó la ventana de Google. Puedes entrar arriba escribiendo solo tu nombre.';
    case 'auth/unauthorized-domain':
      return `Este dominio (${host}) no está autorizado para Google Sign-In. Entra arriba escribiendo solo tu nombre.`;
    case 'auth/network-request-failed':
      return 'Error de conexión con Firebase. Verifica tu internet e inténtalo de nuevo.';
    case 'auth/too-many-requests':
      return 'Demasiados intentos seguidos. Espera un momento antes de volver a intentarlo.';
    default:
      return error instanceof Error ? error.message : 'No pudimos completar el acceso.';
  }
}

export async function loginWithGoogle(): Promise<User | null> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    const code = (error as { code?: string })?.code || '';
    if (
      code === 'auth/popup-blocked' ||
      code === 'auth/operation-not-supported-in-this-environment' ||
      code === 'auth/cancelled-popup-request'
    ) {
      try {
        await signInWithRedirect(auth, googleProvider);
        return null;
      } catch (redirectError) {
        throw new Error(translateAuthError(redirectError));
      }
    }
    throw new Error(translateAuthError(error));
  }
}

export async function consumeGoogleRedirectResult(): Promise<User | null> {
  try {
    const res = await getRedirectResult(auth);
    return res?.user || null;
  } catch (error) {
    throw new Error(translateAuthError(error));
  }
}

async function ensureDefaultEventExists(): Promise<void> {
  const eventRef = doc(db, 'events', DEFAULT_EVENT_ID);
  try {
    const eventSnap = await getDoc(eventRef);
    if (!eventSnap.exists()) {
      await setDoc(eventRef, {
        eventId: DEFAULT_EVENT_ID,
        name: 'NAVIDAD JUNTOS 2026',
        year: 2026,
        exchangeDate: DEFAULT_EXCHANGE_DATE,
        inviteCodeHash: '',
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch {
    // Non-fatal
  }
}

function mapDocToUserProfile(data: Record<string, any>): UserProfile {
  return {
    uid: data.uid,
    name: data.name,
    photoURL: data.photoURL || '',
    role: data.role === UserRole.ADMIN ? UserRole.ADMIN : UserRole.PARTICIPANT,
    active: data.active !== false,
    wishesCount: typeof data.wishesCount === 'number' ? data.wishesCount : 0,
    lastWishAt: data.lastWishAt?.toDate ? data.lastWishAt.toDate() : null,
    createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : null,
    updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : null,
  };
}

/**
 * Acceso libre inmediato sin correo, sin contraseña, sin WhatsApp
 * y sin requerir proveedores adicionales en Firebase Console.
 */
export async function loginFreeWithName(name: string): Promise<UserProfile> {
  const validation = validateFreeAccessName(name);
  if (!validation.valid) {
    throw new Error(validation.error || 'Escribe tu nombre para continuar.');
  }

  const existingSession = getSavedFreeSession();
  const uid = existingSession?.uid || generateFreeParticipantUid();

  const profile = await syncFreeParticipantProfile(uid, validation.cleanName);
  saveFreeSession({ uid: profile.uid, name: profile.name });
  return profile;
}

export async function syncFreeParticipantProfile(uid: string, name?: string): Promise<UserProfile> {
  const userRef = doc(db, 'users', uid);
  let userSnap;
  try {
    userSnap = await getDoc(userRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `users/${uid}`);
  }

  const cleanName = (name || '').trim().slice(0, 100);

  if (!userSnap.exists()) {
    const resolvedName = cleanName || 'Familiar';
    try {
      await setDoc(userRef, {
        uid,
        name: resolvedName,
        photoURL: '',
        role: UserRole.PARTICIPANT,
        active: true,
        wishesCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${uid}`);
    }
  } else {
    const existingData = userSnap.data();
    if (cleanName && cleanName !== existingData?.name) {
      try {
        await updateDoc(userRef, {
          name: cleanName,
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
      }
    }
  }

  await ensureDefaultEventExists();

  const finalSnap = await getDoc(userRef);
  return mapDocToUserProfile(finalSnap.data()!);
}

export async function logoutUser(): Promise<void> {
  clearFreeSession();
  if (auth.currentUser) {
    await signOut(auth);
  }
}

/**
 * Sincroniza el perfil de un usuario autenticado con Google
 * y garantiza que el evento navideño por defecto exista.
 */
export async function syncAuthenticatedUserProfile(firebaseUser: User): Promise<UserProfile> {
  const uid = firebaseUser.uid;
  const email = (firebaseUser.email || '').trim().toLowerCase();
  const displayName = (firebaseUser.displayName || (email ? email.split('@')[0] : 'Familiar'))
    .trim()
    .slice(0, 100);
  const isRootAdmin = Boolean(firebaseUser.emailVerified && email === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase());

  // 1. Check admin marker
  const adminRef = doc(db, 'admins', uid);
  let hasAdminMarker = false;
  try {
    const adminSnap = await getDoc(adminRef);
    hasAdminMarker = adminSnap.exists();
  } catch {
    hasAdminMarker = isRootAdmin;
  }

  if (isRootAdmin && !hasAdminMarker) {
    try {
      await setDoc(adminRef, {
        uid,
        grantedBy: 'bootstrap',
        createdAt: serverTimestamp(),
      });
      hasAdminMarker = true;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `admins/${uid}`);
    }
  }

  // 2. Check pending invitation matching verified email
  let invitedRole: UserRole | null = null;
  let invitedName: string | null = null;
  if (email && firebaseUser.emailVerified) {
    try {
      const invQ = query(
        collection(db, 'invitations'),
        where('email', '==', email),
        where('status', '==', InvitationStatus.PENDING)
      );
      const invSnap = await getDocs(invQ);
      if (!invSnap.empty) {
        const invDoc = invSnap.docs[0];
        const invData = invDoc.data();
        invitedRole = invData.role === UserRole.ADMIN ? UserRole.ADMIN : UserRole.PARTICIPANT;
        invitedName = typeof invData.name === 'string' ? invData.name : null;

        await updateDoc(invDoc.ref, {
          status: InvitationStatus.ACCEPTED,
          updatedAt: serverTimestamp(),
        });
      }
    } catch {
      // Non-fatal
    }
  }

  const userRef = doc(db, 'users', uid);
  let userSnap;
  try {
    userSnap = await getDoc(userRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `users/${uid}`);
  }

  const resolvedRole =
    isRootAdmin || hasAdminMarker || invitedRole === UserRole.ADMIN
      ? UserRole.ADMIN
      : UserRole.PARTICIPANT;

  if (!userSnap.exists()) {
    try {
      await setDoc(userRef, {
        uid,
        name: (invitedName || displayName).slice(0, 100),
        photoURL: firebaseUser.photoURL || '',
        role: resolvedRole,
        active: true,
        wishesCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${uid}`);
    }
  } else {
    const existingData = userSnap.data();
    const shouldPromoteAdmin = isRootAdmin && existingData?.role !== UserRole.ADMIN;
    if (shouldPromoteAdmin) {
      try {
        await updateDoc(userRef, {
          role: UserRole.ADMIN,
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
      }
    }
  }

  if (email) {
    const privateRef = doc(db, 'users', uid, 'private', 'contact');
    try {
      const privateSnap = await getDoc(privateRef);
      if (!privateSnap.exists()) {
        await setDoc(privateRef, {
          uid,
          email,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else if (privateSnap.data()?.email !== email) {
        await updateDoc(privateRef, {
          email,
          updatedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${uid}/private/contact`);
    }
  }

  await ensureDefaultEventExists();

  const finalSnap = await getDoc(userRef);
  return mapDocToUserProfile(finalSnap.data()!);
}
