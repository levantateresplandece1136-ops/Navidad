import {
  collection,
  doc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  Unsubscribe,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, timestampToDate } from './firebase';
import { OperationType, Wish, WishPriority } from '../types/models';
import { DEFAULT_EVENT_ID, sortWishesByPriorityAndDate, validateWishInput, WishFormInput } from '../utils/christmasLogic';
import { deleteStorageImageByUrl } from './storageService';

export function subscribeToUserWishes(
  ownerUid: string,
  onData: (wishes: Wish[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = `wishes(ownerUid=${ownerUid})`;
  const q = query(collection(db, 'wishes'), where('ownerUid', '==', ownerUid));

  return onSnapshot(
    q,
    (snap) => {
      const list: Wish[] = snap.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          wishId: d.wishId || docSnap.id,
          wishlistId: d.wishlistId || ownerUid,
          ownerUid: d.ownerUid,
          eventId: d.eventId || DEFAULT_EVENT_ID,
          title: d.title || '',
          description: d.description || '',
          imageURL: d.imageURL || '',
          productURL: d.productURL || '',
          estimatedPrice: d.estimatedPrice || '',
          size: d.size || '',
          color: d.color || '',
          additionalDetails: d.additionalDetails || '',
          priority: Object.values(WishPriority).includes(d.priority)
            ? (d.priority as WishPriority)
            : WishPriority.ME_GUSTARIA,
          createdAt: timestampToDate(d.createdAt),
          updatedAt: timestampToDate(d.updatedAt),
        };
      });
      onData(sortWishesByPriorityAndDate(list));
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

export async function createWish(ownerUid: string, rawInput: WishFormInput, eventId = DEFAULT_EVENT_ID): Promise<string> {
  const validation = validateWishInput(rawInput);
  if (!validation.valid) {
    const firstError = Object.values(validation.errors)[0] || 'Revisa los campos del deseo.';
    throw new Error(firstError);
  }

  const wishId = `wish_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const wishlistId = ownerUid;
  const path = `wishes/${wishId}`;

  try {
    await runTransaction(db, async (tx) => {
      const userRef = doc(db, 'users', ownerUid);
      const userSnap = await tx.get(userRef);
      const currentCount = userSnap.exists() && typeof userSnap.data().wishesCount === 'number'
        ? userSnap.data().wishesCount
        : 0;

      const wishlistRef = doc(db, 'wishlists', wishlistId);
      const wishRef = doc(db, 'wishes', wishId);
      const availabilityRef = doc(db, 'wishAvailability', wishId);

      const now = serverTimestamp();

      tx.set(wishlistRef, {
        wishlistId,
        ownerUid,
        eventId,
        updatedAt: now,
      });

      tx.set(wishRef, {
        wishId,
        wishlistId,
        ownerUid,
        eventId,
        title: validation.sanitized.title,
        description: validation.sanitized.description,
        imageURL: validation.sanitized.imageURL || '',
        productURL: validation.sanitized.productURL || '',
        estimatedPrice: validation.sanitized.estimatedPrice || '',
        size: validation.sanitized.size || '',
        color: validation.sanitized.color || '',
        additionalDetails: validation.sanitized.additionalDetails || '',
        priority: validation.sanitized.priority,
        createdAt: now,
        updatedAt: now,
      });

      tx.set(availabilityRef, {
        wishId,
        ownerUid,
        eventId,
        isReserved: false,
        updatedAt: now,
      });

      if (userSnap.exists()) {
        tx.update(userRef, {
          wishesCount: currentCount + 1,
          lastWishAt: now,
          updatedAt: now,
        });
      }
    });

    return wishId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateWish(wishId: string, ownerUid: string, rawInput: WishFormInput): Promise<void> {
  const validation = validateWishInput(rawInput);
  if (!validation.valid) {
    const firstError = Object.values(validation.errors)[0] || 'Revisa los campos del deseo.';
    throw new Error(firstError);
  }

  const path = `wishes/${wishId}`;
  try {
    await updateDoc(doc(db, 'wishes', wishId), {
      title: validation.sanitized.title,
      description: validation.sanitized.description,
      imageURL: validation.sanitized.imageURL || '',
      productURL: validation.sanitized.productURL || '',
      estimatedPrice: validation.sanitized.estimatedPrice || '',
      size: validation.sanitized.size || '',
      color: validation.sanitized.color || '',
      additionalDetails: validation.sanitized.additionalDetails || '',
      priority: validation.sanitized.priority,
      updatedAt: serverTimestamp(),
    });

    await updateDoc(doc(db, 'wishlists', ownerUid), {
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteWish(wish: Wish): Promise<void> {
  const path = `wishes/${wish.wishId}`;
  try {
    await runTransaction(db, async (tx) => {
      const userRef = doc(db, 'users', wish.ownerUid);
      const userSnap = await tx.get(userRef);
      const currentCount = userSnap.exists() && typeof userSnap.data().wishesCount === 'number'
        ? userSnap.data().wishesCount
        : 0;

      tx.delete(doc(db, 'wishes', wish.wishId));
      tx.delete(doc(db, 'wishAvailability', wish.wishId));

      if (userSnap.exists()) {
        tx.update(userRef, {
          wishesCount: Math.max(0, currentCount - 1),
          updatedAt: serverTimestamp(),
        });
      }
    });

    if (wish.imageURL) {
      await deleteStorageImageByUrl(wish.imageURL);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
