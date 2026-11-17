import {
  createUserWithEmailAndPassword,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
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
} from '../utils/christmasLogic';

export function translateAuthError(error: unknown): string {
  const code = (error as { code?: string })?.code || '';
  switch (code) {
    case 'auth/invalid-email':
      return 'El correo electrónico no tiene un formato válido.';
    case 'auth/user-disabled':
      return 'Esta cuenta ha sido deshabilitada. Consulta con el administrador familiar.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Correo o contraseña incorrectos. Verifica tus datos e inténtalo de nuevo.';
    case 'auth/email-already-in-use':
      return 'Ya existe una cuenta registrada con este correo. Intenta iniciar sesión o recuperar tu contraseña.';
    case 'auth/weak-password':
      return 'La contraseña debe tener al menos 6 caracteres.';
    case 'auth/popup-closed-by-user':
      return 'Se cerró la ventana de inicio de sesión antes de completar el acceso.';
    case 'auth/popup-blocked':
      return 'El navegador bloqueó la ventana emergente de Google. Permite ventanas emergentes para este sitio.';
    case 'auth/operation-not-allowed':
    case 'auth/admin-restricted-operation':
      return 'El inicio de sesión con correo y contraseña aún no está activado en Firebase Console → Authentication → Sign-in method. Actívalo o inicia sesión con Google.';
    case 'auth/too-many-requests':
      return 'Demasiados intentos seguidos. Espera un momento antes de volver a intentarlo.';
    default:
      return error instanceof Error ? error.message : 'No pudimos completar el acceso.';
  }
}

export async function loginWithGoogle(): Promise<User> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    throw new Error(translateAuthError(error));
  }
}

export async function loginWithEmail(email: string, password: string): Promise<User> {
  try {
    const result = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
    return result.user;
  } catch (error) {
    throw new Error(translateAuthError(error));
  }
}

export async function registerWithEmail(name: string, email: string, password: string): Promise<User> {
  const cleanName = name.trim().slice(0, 100);
  if (!cleanName) {
    throw new Error('Escribe tu nombre para que tu familia reconozca tu lista.');
  }

  try {
    const cred = await createUserWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
    await updateProfile(cred.user, { displayName: cleanName });
    await sendEmailVerification(cred.user);
    return cred.user;
  } catch (error) {
    throw new Error(translateAuthError(error));
  }
}

export async function resendVerificationEmail(user: User): Promise<void> {
  try {
    await sendEmailVerification(user);
  } catch (error) {
    throw new Error(translateAuthError(error));
  }
}

export async function refreshAuthUser(user: User): Promise<User> {
  await reload(user);
  return auth.currentUser || user;
}

export async function sendPasswordRecovery(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(auth, email.trim().toLowerCase());
  } catch (error) {
    throw new Error(translateAuthError(error));
  }
}

export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

/**
 * Sincroniza el perfil del usuario autenticado con correo verificado (Email/Password o Google),
 * aplica invitaciones pendientes por correo y garantiza el evento por defecto si es administrador.
 */
export async function syncAuthenticatedUserProfile(firebaseUser: User): Promise<UserProfile> {
  const uid = firebaseUser.uid;
  const email = (firebaseUser.email || '').trim().toLowerCase();
  if (!email) {
    throw new Error('Tu cuenta necesita un correo electrónico verificado para continuar.');
  }

  const displayName = (firebaseUser.displayName || email.split('@')[0] || 'Familiar').trim().slice(0, 100);
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
    // Non-fatal if no matching invitation exists
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

  // 3. Ensure private contact record exists with verified email only
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

  // 4. Ensure default event exists when admin logs in
  if (resolvedRole === UserRole.ADMIN) {
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
