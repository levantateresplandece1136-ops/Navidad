import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Unsubscribe,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, timestampToDate } from './firebase';
import { ChristmasEvent, OperationType } from '../types/models';
import { DEFAULT_EVENT_ID, DEFAULT_EXCHANGE_DATE, sha256Hex } from '../utils/christmasLogic';

export function subscribeToActiveEvent(
  onData: (event: ChristmasEvent | null) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = `events/${DEFAULT_EVENT_ID}`;
  const eventRef = doc(db, 'events', DEFAULT_EVENT_ID);

  return onSnapshot(
    eventRef,
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      const d = snap.data();
      onData({
        eventId: d.eventId || snap.id,
        name: d.name || 'NAVIDAD JUNTOS 2026',
        year: typeof d.year === 'number' ? d.year : 2026,
        exchangeDate: d.exchangeDate || DEFAULT_EXCHANGE_DATE,
        inviteCodeHash: d.inviteCodeHash || '',
        active: d.active !== false,
        createdAt: timestampToDate(d.createdAt),
        updatedAt: timestampToDate(d.updatedAt),
      });
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export function subscribeToAllEvents(
  onData: (events: ChristmasEvent[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const path = 'events';
  const q = query(collection(db, 'events'), where('eventId', '!=', ''));

  return onSnapshot(
    q,
    (snap) => {
      const list: ChristmasEvent[] = snap.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          eventId: d.eventId || docSnap.id,
          name: d.name || 'NAVIDAD JUNTOS 2026',
          year: typeof d.year === 'number' ? d.year : 2026,
          exchangeDate: d.exchangeDate || DEFAULT_EXCHANGE_DATE,
          inviteCodeHash: d.inviteCodeHash || '',
          active: d.active !== false,
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

export async function saveEventConfiguration(params: {
  eventId?: string;
  name: string;
  year: number;
  exchangeDate: string;
  active: boolean;
  inviteCode?: string;
  existingInviteCodeHash?: string;
  isNew?: boolean;
}): Promise<void> {
  const eventId = params.eventId || DEFAULT_EVENT_ID;
  const path = `events/${eventId}`;
  const eventRef = doc(db, 'events', eventId);

  const inviteCodeHash = params.inviteCode?.trim()
    ? await sha256Hex(params.inviteCode.trim())
    : params.existingInviteCodeHash || '';

  const payload = {
    name: params.name.trim().slice(0, 120),
    year: Math.max(2024, Math.min(2100, Math.round(params.year))),
    exchangeDate: params.exchangeDate.trim().slice(0, 32),
    inviteCodeHash,
    active: params.active,
    updatedAt: serverTimestamp(),
  };

  try {
    if (params.isNew) {
      await setDoc(eventRef, {
        eventId,
        ...payload,
        createdAt: serverTimestamp(),
      });
    } else {
      await updateDoc(eventRef, payload);
    }
  } catch (error) {
    handleFirestoreError(error, params.isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}
