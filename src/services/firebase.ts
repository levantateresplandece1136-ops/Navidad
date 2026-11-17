import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDocFromServer, getFirestore, Timestamp } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getStorage } from 'firebase/storage';
import firebaseAppletConfig from '../../firebase-applet-config.json';
import { FirestoreErrorInfo, OperationType } from '../types/models';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseAppletConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseAppletConfig.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseAppletConfig.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseAppletConfig.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseAppletConfig.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseAppletConfig.appId,
  firestoreDatabaseId:
    import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || firebaseAppletConfig.firestoreDatabaseId,
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
auth.languageCode = 'es';
export const storage = getStorage(app);
export const functions = getFunctions(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const USE_CLOUD_FUNCTIONS = import.meta.env.VITE_USE_CLOUD_FUNCTIONS === 'true';

async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Por favor verifica tu configuración de Firebase: el cliente está sin conexión.');
    }
  }
}

void testConnection();

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function timestampToDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
}

export function getFriendlyFirebaseError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);

  if (raw.includes('¡Este regalo ya está siendo preparado por alguien más!')) {
    return '¡Este regalo ya está siendo preparado por alguien más!';
  }

  let parsedMsg = raw;
  try {
    const parsed = JSON.parse(raw) as Partial<FirestoreErrorInfo>;
    if (parsed.error) parsedMsg = parsed.error;
  } catch {
    // Keep raw message
  }

  if (parsedMsg.includes('Quota exceeded')) {
    return 'Se alcanzó temporalmente el límite diario de consultas de la base de datos. Intenta nuevamente mañana o revisa el plan en Firebase Console.';
  }
  if (parsedMsg.includes('permission-denied') || parsedMsg.includes('Missing or insufficient permissions')) {
    return 'No tienes permiso para realizar esta acción. Recarga la página o vuelve a entrar.';
  }
  if (parsedMsg.includes('unavailable') || parsedMsg.includes('offline')) {
    return 'Parece que no hay conexión con Firebase en este momento. Revisa tu internet e intenta de nuevo.';
  }
  if (parsedMsg.includes('storage/unauthorized') || parsedMsg.includes('storage/bucket-not-found')) {
    return 'Firebase Storage aún no está habilitado o faltan las reglas de Storage en tu proyecto de Firebase.';
  }
  return parsedMsg || 'Ocurrió un error inesperado. Inténtalo de nuevo.';
}
