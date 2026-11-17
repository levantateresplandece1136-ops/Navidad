import {
  getRedirectResult,
  signInAnonymously,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile,
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
  validateFreeAccessName,
} from '../utils/christmasLogic';

export function translateAuthError(error: unknown): string {
  const code = (error as { code?: string })?.code || '';
  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  switch (code) {
    case 'auth/popup-closed-by-user':
      return 'Se cerró la ventana de Google antes de completar el acceso.';
    case 'auth/popup-blocked':
      return 'Tu celular bloqueó la ventana de Google. Puedes entrar arriba escribiendo solo tu nombre.';
    case 'auth/unauthorized-domain':
      return `Falta autorizar este dominio (${host}) en Firebase Console → Authentication → Settings → Authorized domains, o entra directo arriba solo con tu nombre.`;
    case 'auth/operation-not-allowed':
    case 'auth/admin-restricted-operation':
      return 'El administrador debe activar el proveedor «Anónimo» en Firebase Console → Authentication → Sign-in method para habilitar el acceso libre.';
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

/**
 * Acceso libre sin correo electrónico, contraseña ni WhatsApp.
 * Usa Firebase Anonymous Auth y crea/actualiza el perfil familiar del dispositivo.
 */
export async function loginFreeWithName(name: string): Promise<User> {
  const validation = validateFreeAccessName(name);
  if (!validation.valid) {
    throw new Error(validation.error || 'Escribe tu nombre para continuar.');
  }

  try {
    const cred = await signInAnonymously(auth);
    await updateProfile(cred.user, { displayName: validation.cleanName });
    await syncAuthenticatedUserProfile(cred.user, { overrideName: validation.cleanName });
    return cred.user;
  } catch (error) {
    throw new Error(translateAuthError(error));
  }
}

export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

/**
 * Sincroniza el perfil del usuario autenticado (Acceso libre o Google)
 * y garantiza que el evento navideño por defecto exista.
 */
export async function syncAuthenticatedUserProfile(
  firebaseUser: User,
  options?: { overrideName?: string }
): Promise<UserProfile> {
  const uid = firebaseUser.uid;
  const email = (firebaseUser.email || '').trim().toLowerCase();
  const displayName = (
    options?.overrideName ||
    firebaseUser.displayName ||
    (email ? email.split('@')[0] : 'Familiar')
  )
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

  // 2. Check pending invitation matching verified email (when using Google)
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
      // Non-fatal if no matching email invitation exists
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
    const newProfilePayload = {
      uid,
      name: (invitedName || displayName).slice(0, 100),
      photoURL: firebaseUser.photoURL || '',
      role: resolvedRole,
      active: true,
      wishesCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(userRef, newProfilePayload);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${uid}`);
    }
  } else {
    const existingData = userSnap.data();
    const shouldPromoteAdmin = isRootAdmin && existingData?.role !== UserRole.ADMIN;
    const shouldUpdateName = Boolean(options?.overrideName && options.overrideName !== existingData?.name);
    if (shouldPromoteAdmin || shouldUpdateName) {
      try {
        await updateDoc(userRef, {
          ...(shouldPromoteAdmin ? { role: UserRole.ADMIN } : {}),
          ...(shouldUpdateName ? { name: displayName } : {}),
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
      }
    }
  }

  // 3. Store private email contact only when signed in with an email provider (e.g. Google)
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

  // 4. Ensure default event exists so any participant can publish wishes immediately
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

  const finalSnap = await getDoc(userRef);
  const data = finalSnap.data()!;
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
