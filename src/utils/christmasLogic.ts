import { ParticipantFilter, UserProfile, Wish, WishPriority } from '../types/models';

export const BOOTSTRAPPED_ADMIN_EMAIL = 'levantate.resplandece.11.36@gmail.com';
export const DEFAULT_EVENT_ID = 'navidad-2026';
export const DEFAULT_EXCHANGE_DATE = '2026-12-24';

export const PRIORITY_LABELS: Record<WishPriority, string> = {
  [WishPriority.ME_ENCANTARIA]: 'Me encantaría',
  [WishPriority.ME_GUSTARIA]: 'Me gustaría',
  [WishPriority.ES_OPCIONAL]: 'Es opcional',
};

export const PRIORITY_WEIGHT: Record<WishPriority, number> = {
  [WishPriority.ME_ENCANTARIA]: 3,
  [WishPriority.ME_GUSTARIA]: 2,
  [WishPriority.ES_OPCIONAL]: 1,
};

export const FIELD_LIMITS = {
  ID_MAX: 128,
  NAME_MAX: 100,
  TITLE_MAX: 140,
  DESCRIPTION_MAX: 1000,
  URL_MAX: 1024,
  PRICE_MAX: 40,
  SIZE_MAX: 40,
  COLOR_MAX: 50,
  DETAILS_MAX: 600,
} as const;

const ID_REGEX = /^[a-zA-Z0-9_-]+$/;

export function isValidFirestoreId(id: string): boolean {
  return typeof id === 'string' && id.length >= 1 && id.length <= FIELD_LIMITS.ID_MAX && ID_REGEX.test(id);
}

export interface CountdownResult {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isToday: boolean;
  isPast: boolean;
  isValid: boolean;
  formattedDate: string;
}

export function parseExchangeTarget(exchangeDate: string): Date | null {
  if (!exchangeDate || typeof exchangeDate !== 'string') return null;
  const trimmed = exchangeDate.trim();
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const month = Number(dateOnlyMatch[2]) - 1;
    const day = Number(dateOnlyMatch[3]);
    const d = new Date(year, month, day, 20, 0, 0, 0);
    if (d.getFullYear() === year && d.getMonth() === month && d.getDate() === day) {
      return d;
    }
    return null;
  }
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function calculateCountdown(exchangeDate: string, nowMs: number = Date.now()): CountdownResult {
  const target = parseExchangeTarget(exchangeDate);
  if (!target) {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      isToday: false,
      isPast: false,
      isValid: false,
      formattedDate: 'Fecha por definir',
    };
  }

  const formattedDate = new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(target);

  const nowDate = new Date(nowMs);
  const sameDay =
    nowDate.getFullYear() === target.getFullYear() &&
    nowDate.getMonth() === target.getMonth() &&
    nowDate.getDate() === target.getDate();

  const diffMs = target.getTime() - nowMs;

  if (diffMs <= 0) {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      isToday: sameDay,
      isPast: !sameDay,
      isValid: true,
      formattedDate,
    };
  }

  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return {
    days,
    hours,
    minutes,
    seconds,
    isToday: sameDay,
    isPast: false,
    isValid: true,
    formattedDate,
  };
}

export interface WishFormInput {
  title: string;
  description: string;
  imageURL?: string;
  productURL?: string;
  estimatedPrice?: string;
  size?: string;
  color?: string;
  additionalDetails?: string;
  priority: WishPriority;
}

export interface ValidationResult {
  valid: boolean;
  errors: Partial<Record<keyof WishFormInput, string>>;
  sanitized: WishFormInput;
}

export function sanitizeExternalUrl(raw?: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

export function isValidHttpUrl(raw: string): boolean {
  if (!raw) return true;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function validateWishInput(input: WishFormInput): ValidationResult {
  const errors: Partial<Record<keyof WishFormInput, string>> = {};

  const title = (input.title || '').trim().slice(0, FIELD_LIMITS.TITLE_MAX);
  const description = (input.description || '').trim().slice(0, FIELD_LIMITS.DESCRIPTION_MAX);
  const rawProductUrl = (input.productURL || '').trim();
  const productURL = rawProductUrl ? sanitizeExternalUrl(rawProductUrl).slice(0, FIELD_LIMITS.URL_MAX) : '';
  const imageURL = (input.imageURL || '').trim().slice(0, FIELD_LIMITS.URL_MAX);
  const estimatedPrice = (input.estimatedPrice || '').trim().slice(0, FIELD_LIMITS.PRICE_MAX);
  const size = (input.size || '').trim().slice(0, FIELD_LIMITS.SIZE_MAX);
  const color = (input.color || '').trim().slice(0, FIELD_LIMITS.COLOR_MAX);
  const additionalDetails = (input.additionalDetails || '').trim().slice(0, FIELD_LIMITS.DETAILS_MAX);

  if (!title) {
    errors.title = 'Escribe el nombre del regalo que te gustaría recibir.';
  }

  if (!description) {
    errors.description = 'Agrega una breve descripción para orientar a tu familia.';
  }

  if (productURL && !isValidHttpUrl(productURL)) {
    errors.productURL = 'El enlace debe ser una dirección web válida (ej. https://amazon.com/...).';
  }

  if (!Object.values(WishPriority).includes(input.priority)) {
    errors.priority = 'Selecciona un nivel de prioridad válido.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    sanitized: {
      title,
      description,
      imageURL,
      productURL,
      estimatedPrice,
      size,
      color,
      additionalDetails,
      priority: Object.values(WishPriority).includes(input.priority)
        ? input.priority
        : WishPriority.ME_GUSTARIA,
    },
  };
}

export function filterParticipants(
  participants: UserProfile[],
  currentUid: string,
  searchQuery: string,
  filterMode: ParticipantFilter
): UserProfile[] {
  const normalizedQuery = searchQuery.trim().toLowerCase();

  let list = participants.filter((p) => p.active !== false);

  if (filterMode === 'mine') {
    list = list.filter((p) => p.uid === currentUid);
  }

  if (normalizedQuery) {
    list = list.filter((p) => p.name.toLowerCase().includes(normalizedQuery));
  }

  if (filterMode === 'recent') {
    list = [...list].sort((a, b) => {
      const timeA = a.lastWishAt ? a.lastWishAt.getTime() : 0;
      const timeB = b.lastWishAt ? b.lastWishAt.getTime() : 0;
      if (timeB !== timeA) return timeB - timeA;
      return b.wishesCount - a.wishesCount;
    });
  } else {
    list = [...list].sort((a, b) => {
      if (a.uid === currentUid && b.uid !== currentUid) return -1;
      if (b.uid === currentUid && a.uid !== currentUid) return 1;
      return a.name.localeCompare(b.name, 'es');
    });
  }

  return list;
}

export function sortWishesByPriorityAndDate(wishes: Wish[]): Wish[] {
  return [...wishes].sort((a, b) => {
    const weightDiff = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
    if (weightDiff !== 0) return weightDiff;
    const timeA = a.createdAt ? a.createdAt.getTime() : 0;
    const timeB = b.createdAt ? b.createdAt.getTime() : 0;
    return timeB - timeA;
  });
}

export function canUserReserveWish(params: {
  viewerUid: string;
  wishOwnerUid: string;
  isAlreadyReserved: boolean;
  eventActive: boolean;
}): { allowed: boolean; reason?: string } {
  if (!params.eventActive) {
    return { allowed: false, reason: 'El evento navideño está pausado temporalmente por el administrador.' };
  }
  if (!params.viewerUid || params.viewerUid === params.wishOwnerUid) {
    return { allowed: false, reason: 'No puedes reservar tus propios deseos.' };
  }
  if (params.isAlreadyReserved) {
    return { allowed: false, reason: '¡Este regalo ya está siendo preparado por alguien más!' };
  }
  return { allowed: true };
}

export function shouldExposeAvailabilityToViewer(viewerUid: string, wishOwnerUid: string): boolean {
  return Boolean(viewerUid) && Boolean(wishOwnerUid) && viewerUid !== wishOwnerUid;
}

export async function sha256Hex(text: string): Promise<string> {
  const normalized = text.trim();
  if (!normalized) return '';
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(normalized);
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  return '';
}

export function getInitials(name: string): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'N';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function formatShortDate(date?: Date | null): string {
  if (!date) return 'Reciente';
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function validateFreeAccessName(rawName: string): {
  valid: boolean;
  cleanName: string;
  error?: string;
} {
  const cleanName = (rawName || '').trim().slice(0, FIELD_LIMITS.NAME_MAX);
  if (!cleanName) {
    return {
      valid: false,
      cleanName: '',
      error: 'Escribe tu nombre para que tu familia reconozca tu lista.',
    };
  }
  if (cleanName.length < 2) {
    return {
      valid: false,
      cleanName,
      error: 'Escribe al menos 2 letras para tu nombre.',
    };
  }
  return { valid: true, cleanName };
}

export function detectInAppBrowser(userAgent: string): boolean {
  if (!userAgent) return false;
  return /WhatsApp|FBAN|FBAV|Instagram|Line\/|BytedanceWebview|musical_ly|Snapchat|Twitter/i.test(userAgent);
}

export function generateFreeParticipantUid(): string {
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function') {
    return `fam_${globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 20)}`;
  }
  const part1 = Math.random().toString(36).slice(2, 12);
  const part2 = Date.now().toString(36);
  return `fam_${part2}${part1}`.replace(/[^a-zA-Z0-9_-]/g, '');
}
