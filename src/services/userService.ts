import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Unsubscribe,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { auth, db, handleFirestoreError, timestampToDate } from './firebase';
import { Invitation, InvitationStatus, OperationType, UserProfile, UserRole } from '../types/models';
import { DEFAULT_EVENT_ID } from '../utils/christmasLogic';

export function subscribeToParticipants(
  onData: (users: UserProfile[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = 'users';
  const q = query(collection(db, 'users'), where('uid', '!=', ''));

  return onSnapshot(
    q,
    (snap) => {
      const list: UserProfile[] = snap.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          uid: d.uid || docSnap.id,
          name: d.name || 'Familiar',
          photoURL: d.photoURL || '',
          role: d.role === UserRole.ADMIN ? UserRole.ADMIN : UserRole.PARTICIPANT,
          active: d.active !== false,
          wishesCount: typeof d.wishesCount === 'number' ? d.wishesCount : 0,
          lastWishAt: timestampToDate(d.lastWishAt),
          createdAt: timestampToDate(d.createdAt),
          updatedAt: timestampToDate(d.updatedAt),
        };
      });
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function updateOwnProfile(
  uid: string,
  updates: { name: string; photoURL?: string }
): Promise<void> {
  const path = `users/${uid}`;
  const cleanName = updates.name.trim().slice(0, 100);
  if (!cleanName) {
    throw new Error('Tu nombre no puede quedar vacío.');
  }

  try {
    const payload: Record<string, unknown> = {
      name: cleanName,
      updatedAt: serverTimestamp(),
    };
    if (typeof updates.photoURL === 'string') {
      payload.photoURL = updates.photoURL.slice(0, 1024);
    }

    await updateDoc(doc(db, 'users', uid), payload);

    if (auth.currentUser && auth.currentUser.uid === uid) {
      await updateProfile(auth.currentUser, {
        displayName: cleanName,
        ...(typeof updates.photoURL === 'string' && updates.photoURL ? { photoURL: updates.photoURL } : {}),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function adminUpdateParticipant(params: {
  targetUid: string;
  name: string;
  photoURL?: string;
  role: UserRole;
  active: boolean;
  adminUid: string;
}): Promise<void> {
  const path = `users/${params.targetUid}`;
  const cleanName = params.name.trim().slice(0, 100);
  if (!cleanName) {
    throw new Error('El nombre del participante es obligatorio.');
  }

  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'users', params.targetUid), {
      name: cleanName,
      photoURL: (params.photoURL || '').slice(0, 1024),
      role: params.role,
      active: params.active,
      updatedAt: serverTimestamp(),
    });

    const adminMarkerRef = doc(db, 'admins', params.targetUid);
    if (params.role === UserRole.ADMIN) {
      batch.set(adminMarkerRef, {
        uid: params.targetUid,
        grantedBy: params.adminUid,
        createdAt: serverTimestamp(),
      });
    } else if (params.targetUid !== params.adminUid) {
      batch.delete(adminMarkerRef);
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function adminRemoveParticipant(targetUid: string): Promise<void> {
  const path = `users/${targetUid}`;
  try {
    await deleteDoc(doc(db, 'users', targetUid));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeToInvitations(
  onData: (invitations: Invitation[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = 'invitations';
  const q = query(collection(db, 'invitations'));

  return onSnapshot(
    q,
    (snap) => {
      const items: Invitation[] = snap.docs
        .map((docSnap) => {
          const d = docSnap.data();
          return {
            inviteId: d.inviteId || docSnap.id,
            eventId: d.eventId || DEFAULT_EVENT_ID,
            name: d.name || '',
            email: d.email || '',
            role: d.role === UserRole.ADMIN ? UserRole.ADMIN : UserRole.PARTICIPANT,
            status: (d.status as InvitationStatus) || InvitationStatus.PENDING,
            createdByUid: d.createdByUid || '',
            createdAt: timestampToDate(d.createdAt),
            updatedAt: timestampToDate(d.updatedAt),
          };
        })
        .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function adminCreateInvitation(params: {
  name: string;
  email?: string;
  role: UserRole;
  adminUid: string;
  eventId?: string;
}): Promise<Invitation> {
  const cleanName = params.name.trim().slice(0, 100);
  const cleanEmail = (params.email || '').trim().toLowerCase().slice(0, 254);

  if (!cleanName) {
    throw new Error('Ingresa el nombre de tu familiar.');
  }

  if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error('Si incluyes correo electrónico, verifica que sea válido.');
  }

  const inviteId = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const path = `invitations/${inviteId}`;
  const eventId = params.eventId || DEFAULT_EVENT_ID;

  try {
    await setDoc(doc(db, 'invitations', inviteId), {
      inviteId,
      eventId,
      name: cleanName,
      email: cleanEmail,
      role: params.role,
      status: InvitationStatus.PENDING,
      createdByUid: params.adminUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return {
      inviteId,
      eventId,
      name: cleanName,
      email: cleanEmail,
      role: params.role,
      status: InvitationStatus.PENDING,
      createdByUid: params.adminUid,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function adminRevokeInvitation(inviteId: string): Promise<void> {
  const path = `invitations/${inviteId}`;
  try {
    await deleteDoc(doc(db, 'invitations', inviteId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
