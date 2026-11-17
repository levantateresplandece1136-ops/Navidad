import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateCountdown,
  canUserReserveWish,
  detectInAppBrowser,
  filterParticipants,
  isValidFirestoreId,
  sanitizeExternalUrl,
  shouldExposeAvailabilityToViewer,
  sortWishesByPriorityAndDate,
  validateFreeAccessName,
  validateWishInput,
} from './christmasLogic';
import { UserProfile, UserRole, Wish, WishPriority } from '../types/models';

test('calculateCountdown calculates days, hours, minutes, seconds before exchange date', () => {
  const target = new Date(2026, 11, 24, 20, 0, 0, 0).getTime();
  const twoDaysBefore = target - (2 * 86400 + 3 * 3600 + 15 * 60 + 20) * 1000;
  const res = calculateCountdown('2026-12-24', twoDaysBefore);
  assert.equal(res.isValid, true);
  assert.equal(res.isPast, false);
  assert.equal(res.isToday, false);
  assert.equal(res.days, 2);
  assert.equal(res.hours, 3);
  assert.equal(res.minutes, 15);
  assert.equal(res.seconds, 20);
});

test('calculateCountdown marks isToday on the exchange day', () => {
  const morningOfExchange = new Date(2026, 11, 24, 10, 0, 0, 0).getTime();
  const res = calculateCountdown('2026-12-24', morningOfExchange);
  assert.equal(res.isToday, true);
  assert.equal(res.isPast, false);
  assert.equal(res.hours, 10);
});

test('validateWishInput enforces required title and description and sanitizes product URL', () => {
  const emptyResult = validateWishInput({
    title: '   ',
    description: '',
    priority: WishPriority.ME_ENCANTARIA,
  });
  assert.equal(emptyResult.valid, false);
  assert.ok(emptyResult.errors.title);
  assert.ok(emptyResult.errors.description);

  const validResult = validateWishInput({
    title: '  Suéter verde tejido  ',
    description: '  Talla mediana de algodón cálido  ',
    productURL: 'amazon.com.mx/dp/B09XYZ',
    estimatedPrice: '$650 MXN',
    priority: WishPriority.ME_ENCANTARIA,
  });
  assert.equal(validResult.valid, true);
  assert.equal(validResult.sanitized.title, 'Suéter verde tejido');
  assert.equal(validResult.sanitized.productURL, 'https://amazon.com.mx/dp/B09XYZ');
});

test('sanitizeExternalUrl preserves https and adds protocol when omitted', () => {
  assert.equal(sanitizeExternalUrl('https://temu.com/item'), 'https://temu.com/item');
  assert.equal(sanitizeExternalUrl('mercadolibre.com.mx/p/123'), 'https://mercadolibre.com.mx/p/123');
  assert.equal(sanitizeExternalUrl('   '), '');
});

test('filterParticipants supports search, mine, and recent filters', () => {
  const users: UserProfile[] = [
    {
      uid: 'u1',
      name: 'Ammi',
      role: UserRole.PARTICIPANT,
      active: true,
      wishesCount: 3,
      lastWishAt: new Date('2026-11-10T10:00:00Z'),
    },
    {
      uid: 'u2',
      name: 'Sandy',
      role: UserRole.ADMIN,
      active: true,
      wishesCount: 5,
      lastWishAt: new Date('2026-11-15T10:00:00Z'),
    },
    {
      uid: 'u3',
      name: 'Carlos',
      role: UserRole.PARTICIPANT,
      active: false,
      wishesCount: 2,
    },
  ];

  assert.equal(filterParticipants(users, 'u1', '', 'all').length, 2);
  assert.equal(filterParticipants(users, 'u1', 'san', 'all')[0].uid, 'u2');
  assert.equal(filterParticipants(users, 'u1', '', 'mine').length, 1);
  assert.equal(filterParticipants(users, 'u1', '', 'mine')[0].uid, 'u1');
  assert.equal(filterParticipants(users, 'u1', '', 'recent')[0].uid, 'u2');
});

test('secret reservation guards block self-reservation, double-reservation, and owner visibility', () => {
  assert.equal(shouldExposeAvailabilityToViewer('u1', 'u1'), false);
  assert.equal(shouldExposeAvailabilityToViewer('u1', 'u2'), true);

  const ownAttempt = canUserReserveWish({
    viewerUid: 'u1',
    wishOwnerUid: 'u1',
    isAlreadyReserved: false,
    eventActive: true,
  });
  assert.equal(ownAttempt.allowed, false);

  const duplicateAttempt = canUserReserveWish({
    viewerUid: 'u1',
    wishOwnerUid: 'u2',
    isAlreadyReserved: true,
    eventActive: true,
  });
  assert.equal(duplicateAttempt.allowed, false);
  assert.equal(duplicateAttempt.reason, '¡Este regalo ya está siendo preparado por alguien más!');

  const validAttempt = canUserReserveWish({
    viewerUid: 'u1',
    wishOwnerUid: 'u2',
    isAlreadyReserved: false,
    eventActive: true,
  });
  assert.equal(validAttempt.allowed, true);
});

test('sortWishesByPriorityAndDate orders by priority weight then newest', () => {
  const base = {
    wishlistId: 'w1',
    ownerUid: 'u1',
    eventId: 'e1',
    description: 'desc',
  };
  const wishes: Wish[] = [
    { ...base, wishId: '1', title: 'Opcional', priority: WishPriority.ES_OPCIONAL, createdAt: new Date(3000) },
    { ...base, wishId: '2', title: 'Encantaría viejo', priority: WishPriority.ME_ENCANTARIA, createdAt: new Date(1000) },
    { ...base, wishId: '3', title: 'Encantaría nuevo', priority: WishPriority.ME_ENCANTARIA, createdAt: new Date(2000) },
  ];
  const sorted = sortWishesByPriorityAndDate(wishes);
  assert.deepEqual(
    sorted.map((w) => w.wishId),
    ['3', '2', '1']
  );
});

test('isValidFirestoreId rejects path traversal and oversized IDs', () => {
  assert.equal(isValidFirestoreId('wish_123-abc'), true);
  assert.equal(isValidFirestoreId('../admin'), false);
  assert.equal(isValidFirestoreId(''), false);
  assert.equal(isValidFirestoreId('a'.repeat(129)), false);
});

test('validateFreeAccessName and detectInAppBrowser validate free name entry and WebViews', () => {
  const empty = validateFreeAccessName('   ');
  assert.equal(empty.valid, false);
  assert.ok(empty.error);

  const short = validateFreeAccessName('A');
  assert.equal(short.valid, false);

  const valid = validateFreeAccessName('  Tía Lupita  ');
  assert.equal(valid.valid, true);
  assert.equal(valid.cleanName, 'Tía Lupita');

  assert.equal(detectInAppBrowser('Mozilla/5.0 WhatsApp/2.24'), true);
  assert.equal(detectInAppBrowser('Mozilla/5.0 Chrome/120.0 Mobile Safari/537.36'), false);
});


