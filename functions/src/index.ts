import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentDeleted } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';

admin.initializeApp();

const db = admin.firestore();

interface ReserveWishPayload {
  wishId: string;
}

interface CancelReservationPayload {
  wishId: string;
}

/**
 * Cloud Function transaccional para reservar un regalo en secreto.
 * - Verifica autenticación y correo verificado.
 * - Impide que el propietario reserve su propio deseo.
 * - Garantiza mediante transacción que no existan reservaciones duplicadas.
 * - Mantiene la identidad del reservante separada de wishAvailability.
 */
export const reserveWish = onCall<ReserveWishPayload>(async (request) => {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError('unauthenticated', 'Debes iniciar sesión para reservar un regalo.');
  }

  if (request.auth.token.email_verified !== true) {
    throw new HttpsError('permission-denied', 'Verifica tu correo electrónico antes de reservar.');
  }

  const wishId = request.data?.wishId?.trim();
  if (!wishId || wishId.length > 128 || !/^[a-zA-Z0-9_-]+$/.test(wishId)) {
    throw new HttpsError('invalid-argument', 'Identificador de deseo inválido.');
  }

  const reserverUid = request.auth.uid;

  await db.runTransaction(async (tx) => {
    const wishRef = db.collection('wishes').doc(wishId);
    const availabilityRef = db.collection('wishAvailability').doc(wishId);
    const reservationRef = db.collection('reservations').doc(wishId);

    const [wishSnap, availabilitySnap, reservationSnap] = await Promise.all([
      tx.get(wishRef),
      tx.get(availabilityRef),
      tx.get(reservationRef),
    ]);

    if (!wishSnap.exists) {
      throw new HttpsError('not-found', 'Este deseo ya no existe.');
    }

    const wishData = wishSnap.data()!;
    if (wishData.ownerUid === reserverUid) {
      throw new HttpsError('failed-precondition', 'No puedes reservar tus propios deseos.');
    }

    if (reservationSnap.exists || (availabilitySnap.exists && availabilitySnap.data()?.isReserved === true)) {
      throw new HttpsError('already-exists', '¡Este regalo ya está siendo preparado por alguien más!');
    }

    const ownerSnap = await tx.get(db.collection('users').doc(wishData.ownerUid));
    const recipientName = ownerSnap.exists ? String(ownerSnap.data()?.name || 'Familiar') : 'Familiar';

    const now = admin.firestore.FieldValue.serverTimestamp();

    tx.set(reservationRef, {
      wishId,
      eventId: wishData.eventId,
      ownerUid: wishData.ownerUid,
      reservedByUid: reserverUid,
      recipientName,
      wishTitle: wishData.title,
      wishDescription: wishData.description || '',
      wishImageURL: wishData.imageURL || '',
      productURL: wishData.productURL || '',
      createdAt: now,
    });

    tx.set(
      availabilityRef,
      {
        wishId,
        ownerUid: wishData.ownerUid,
        eventId: wishData.eventId,
        isReserved: true,
        updatedAt: now,
      },
      { merge: true }
    );
  });

  return { ok: true, wishId };
});

/**
 * Cloud Function transaccional para cancelar una reservación secreta.
 * - Solo el usuario que realizó la reservación puede cancelarla.
 */
export const cancelReservation = onCall<CancelReservationPayload>(async (request) => {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError('unauthenticated', 'Debes iniciar sesión para cancelar una reservación.');
  }

  const wishId = request.data?.wishId?.trim();
  if (!wishId || wishId.length > 128 || !/^[a-zA-Z0-9_-]+$/.test(wishId)) {
    throw new HttpsError('invalid-argument', 'Identificador de deseo inválido.');
  }

  const callerUid = request.auth.uid;

  await db.runTransaction(async (tx) => {
    const reservationRef = db.collection('reservations').doc(wishId);
    const availabilityRef = db.collection('wishAvailability').doc(wishId);

    const [reservationSnap, availabilitySnap] = await Promise.all([
      tx.get(reservationRef),
      tx.get(availabilityRef),
    ]);

    if (!reservationSnap.exists) {
      throw new HttpsError('not-found', 'La reservación no existe o ya fue cancelada.');
    }

    if (reservationSnap.data()?.reservedByUid !== callerUid) {
      throw new HttpsError('permission-denied', 'Solo quien reservó este regalo puede cancelarlo.');
    }

    tx.delete(reservationRef);

    if (availabilitySnap.exists) {
      tx.update(availabilityRef, {
        isReserved: false,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  });

  return { ok: true, wishId };
});

/**
 * Limpieza automática cuando el propietario elimina un deseo:
 * elimina la disponibilidad y cualquier reservación asociada.
 */
export const onWishDeleted = onDocumentDeleted('wishes/{wishId}', async (event) => {
  const wishId = event.params.wishId;
  const batch = db.batch();
  batch.delete(db.collection('wishAvailability').doc(wishId));
  batch.delete(db.collection('reservations').doc(wishId));
  await batch.commit();
});
