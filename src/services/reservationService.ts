import {
  collection,
  doc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  Unsubscribe,
  where,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions, handleFirestoreError, timestampToDate, USE_CLOUD_FUNCTIONS } from './firebase';
import { OperationType, Reservation, Wish } from '../types/models';
import { shouldExposeAvailabilityToViewer } from '../utils/christmasLogic';

/**
 * Escucha en tiempo real la disponibilidad de los deseos de OTRO participante.
 * Nunca se suscribe si el visor es el propio dueño de la lista.
 */
export function subscribeToWishlistAvailability(
  ownerUid: string,
  viewerUid: string,
  onData: (availabilityMap: Record<string, boolean>) => void,
  onError: (err: Error) => void
): Unsubscribe {
  if (!shouldExposeAvailabilityToViewer(viewerUid, ownerUid)) {
    onData({});
    return () => {};
  }

  const path = `wishAvailability(ownerUid=${ownerUid})`;
  const q = query(collection(db, 'wishAvailability'), where('ownerUid', '==', ownerUid));

  return onSnapshot(
    q,
    (snap) => {
      const map: Record<string, boolean> = {};
      snap.docs.forEach((docSnap) => {
        const d = docSnap.data();
        map[d.wishId || docSnap.id] = Boolean(d.isReserved);
      });
      onData(map);
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

/**
 * Escucha exclusivamente las reservaciones secretas hechas por el usuario actual.
 */
export function subscribeToMyReservations(
  reserverUid: string,
  onData: (reservations: Reservation[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = `reservations(reservedByUid=${reserverUid})`;
  const q = query(collection(db, 'reservations'), where('reservedByUid', '==', reserverUid));

  return onSnapshot(
    q,
    (snap) => {
      const list: Reservation[] = snap.docs
        .map((docSnap) => {
          const d = docSnap.data();
          return {
            wishId: d.wishId || docSnap.id,
            eventId: d.eventId || '',
            ownerUid: d.ownerUid || '',
            reservedByUid: d.reservedByUid || '',
            recipientName: d.recipientName || 'Familiar',
            wishTitle: d.wishTitle || 'Regalo navideño',
            wishDescription: d.wishDescription || '',
            wishImageURL: d.wishImageURL || '',
            productURL: d.productURL || '',
            createdAt: timestampToDate(d.createdAt),
          };
        })
        .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
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

/**
 * Reserva un regalo en secreto mediante Cloud Function o Transacción Atómica en Firestore.
 */
export async function reserveWishSecretly(params: {
  wish: Wish;
  recipientName: string;
  reserverUid: string;
}): Promise<void> {
  if (params.wish.ownerUid === params.reserverUid) {
    throw new Error('No puedes reservar tus propios deseos.');
  }

  if (USE_CLOUD_FUNCTIONS) {
    try {
      const fn = httpsCallable<{ wishId: string }, { ok: boolean }>(functions, 'reserveWish');
      await fn({ wishId: params.wish.wishId });
      return;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('ya está siendo preparado')) {
        throw new Error('¡Este regalo ya está siendo preparado por alguien más!');
      }
      throw new Error(msg);
    }
  }

  const wishId = params.wish.wishId;
  const reservationRef = doc(db, 'reservations', wishId);
  const availabilityRef = doc(db, 'wishAvailability', wishId);
  const path = `reservations/${wishId}`;

  try {
    await runTransaction(db, async (tx) => {
      const [availSnap, resSnap] = await Promise.all([tx.get(availabilityRef), tx.get(reservationRef)]);

      if (resSnap.exists() || (availSnap.exists() && availSnap.data().isReserved === true)) {
        throw new Error('¡Este regalo ya está siendo preparado por alguien más!');
      }

      const now = serverTimestamp();

      tx.set(reservationRef, {
        wishId,
        eventId: params.wish.eventId,
        ownerUid: params.wish.ownerUid,
        reservedByUid: params.reserverUid,
        recipientName: params.recipientName.trim().slice(0, 100) || 'Familiar',
        wishTitle: params.wish.title.slice(0, 140),
        wishDescription: (params.wish.description || '').slice(0, 1000),
        wishImageURL: (params.wish.imageURL || '').slice(0, 1024),
        productURL: (params.wish.productURL || '').slice(0, 1024),
        createdAt: now,
      });

      tx.update(availabilityRef, {
        isReserved: true,
        updatedAt: now,
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('¡Este regalo ya está siendo preparado por alguien más!')) {
      throw error;
    }
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Cancela una reservación secreta existente mediante Cloud Function o Transacción Atómica.
 */
export async function cancelSecretReservation(wishId: string, callerUid: string): Promise<void> {
  if (USE_CLOUD_FUNCTIONS) {
    const fn = httpsCallable<{ wishId: string }, { ok: boolean }>(functions, 'cancelReservation');
    await fn({ wishId });
    return;
  }

  const reservationRef = doc(db, 'reservations', wishId);
  const availabilityRef = doc(db, 'wishAvailability', wishId);
  const path = `reservations/${wishId}`;

  try {
    await runTransaction(db, async (tx) => {
      const [resSnap, availSnap] = await Promise.all([tx.get(reservationRef), tx.get(availabilityRef)]);
      if (!resSnap.exists()) {
        throw new Error('Esta reservación ya fue cancelada.');
      }
      if (resSnap.data().reservedByUid !== callerUid) {
        throw new Error('Solo quien reservó este regalo puede cancelar la reservación.');
      }

      tx.delete(reservationRef);
      if (availSnap.exists()) {
        tx.update(availabilityRef, {
          isReserved: false,
          updatedAt: serverTimestamp(),
        });
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('ya fue cancelada')) {
      throw error;
    }
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
