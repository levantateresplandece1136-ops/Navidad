export enum UserRole {
  ADMIN = 'admin',
  PARTICIPANT = 'participant',
}

export enum WishPriority {
  ME_ENCANTARIA = 'me_encantaria',
  ME_GUSTARIA = 'me_gustaria',
  ES_OPCIONAL = 'es_opcional',
}

export enum InvitationStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REVOKED = 'revoked',
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export interface UserProfile {
  uid: string;
  name: string;
  photoURL?: string;
  role: UserRole;
  active: boolean;
  wishesCount: number;
  lastWishAt?: Date | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

export interface UserPrivate {
  uid: string;
  email: string;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

export interface ChristmasEvent {
  eventId: string;
  name: string;
  year: number;
  exchangeDate: string; // YYYY-MM-DD or ISO string
  inviteCodeHash?: string;
  active: boolean;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

export interface Invitation {
  inviteId: string;
  eventId: string;
  name: string;
  email: string;
  role: UserRole;
  status: InvitationStatus;
  createdByUid: string;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

export interface Wishlist {
  wishlistId: string;
  ownerUid: string;
  eventId: string;
  updatedAt?: Date | null;
}

export interface Wish {
  wishId: string;
  wishlistId: string;
  ownerUid: string;
  eventId: string;
  title: string;
  description: string;
  imageURL?: string;
  productURL?: string;
  estimatedPrice?: string;
  size?: string;
  color?: string;
  additionalDetails?: string;
  priority: WishPriority;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

export interface WishAvailability {
  wishId: string;
  ownerUid: string;
  eventId: string;
  isReserved: boolean;
  updatedAt?: Date | null;
}

export interface Reservation {
  wishId: string;
  eventId: string;
  ownerUid: string;
  reservedByUid: string;
  recipientName: string;
  wishTitle: string;
  wishDescription?: string;
  wishImageURL?: string;
  productURL?: string;
  createdAt?: Date | null;
}

export type AppView =
  | 'welcome'
  | 'auth'
  | 'dashboard'
  | 'wishlist'
  | 'reservations'
  | 'profile'
  | 'admin';

export type ParticipantFilter = 'all' | 'mine' | 'recent';
