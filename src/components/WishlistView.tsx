import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Gift,
  Lock,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { ChristmasEvent, Reservation, UserProfile, Wish } from '../types/models';
import { canUserReserveWish, PRIORITY_LABELS, shouldExposeAvailabilityToViewer } from '../utils/christmasLogic';
import { subscribeToUserWishes, deleteWish } from '../services/wishService';
import { reserveWishSecretly, subscribeToWishlistAvailability } from '../services/reservationService';
import { getFriendlyFirebaseError } from '../services/firebase';
import { AvatarCircle, WishImageFrame } from './FestiveIllustrations';
import { ConfirmModal } from './ConfirmModal';

interface WishlistViewProps {
  owner: UserProfile;
  currentUser: UserProfile;
  activeEvent: ChristmasEvent | null;
  myReservations: Reservation[];
  onBack: () => void;
  onAddWish: () => void;
  onEditWish: (wish: Wish) => void;
  onNotify: (type: 'success' | 'error', message: string) => void;
}

export function WishlistView({
  owner,
  currentUser,
  activeEvent,
  myReservations,
  onBack,
  onAddWish,
  onEditWish,
  onNotify,
}: WishlistViewProps) {
  const isOwner = owner.uid === currentUser.uid;
  const canSeeAvailability = shouldExposeAvailabilityToViewer(currentUser.uid, owner.uid);

  const [wishes, setWishes] = useState<Wish[]>([]);
  const [availabilityMap, setAvailabilityMap] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [wishToDelete, setWishToDelete] = useState<Wish | null>(null);
  const [wishToReserve, setWishToReserve] = useState<Wish | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const myReservedWishIds = new Set(myReservations.map((r) => r.wishId));

  useEffect(() => {
    setLoading(true);
    const unsubWishes = subscribeToUserWishes(
      owner.uid,
      (list) => {
        setWishes(list);
        setLoading(false);
      },
      (err) => {
        setLoading(false);
        onNotify('error', getFriendlyFirebaseError(err));
      }
    );

    let unsubAvailability = () => {};
    if (canSeeAvailability) {
      unsubAvailability = subscribeToWishlistAvailability(
        owner.uid,
        currentUser.uid,
        (map) => setAvailabilityMap(map),
        (err) => onNotify('error', getFriendlyFirebaseError(err))
      );
    } else {
      setAvailabilityMap({});
    }

    return () => {
      unsubWishes();
      unsubAvailability();
    };
  }, [owner.uid, currentUser.uid, canSeeAvailability]);

  const handleConfirmDelete = async () => {
    if (!wishToDelete) return;
    setActionLoading(true);
    try {
      await deleteWish(wishToDelete);
      onNotify('success', `Se eliminó "${wishToDelete.title}" de tu lista.`);
      setWishToDelete(null);
    } catch (err) {
      onNotify('error', getFriendlyFirebaseError(err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmReserve = async () => {
    if (!wishToReserve) return;
    const isAlreadyReserved = Boolean(availabilityMap[wishToReserve.wishId]);
    const guard = canUserReserveWish({
      viewerUid: currentUser.uid,
      wishOwnerUid: owner.uid,
      isAlreadyReserved,
      eventActive: activeEvent ? activeEvent.active : true,
    });

    if (!guard.allowed) {
      onNotify('error', guard.reason || 'No se pudo completar la reservación.');
      setWishToReserve(null);
      return;
    }

    setActionLoading(true);
    try {
      await reserveWishSecretly({
        wish: wishToReserve,
        recipientName: owner.name,
        reserverUid: currentUser.uid,
      });
      onNotify('success', `¡Listo! Reservaste en secreto "${wishToReserve.title}" para ${owner.name}.`);
      setWishToReserve(null);
    } catch (err) {
      onNotify('error', getFriendlyFirebaseError(err));
      setWishToReserve(null);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 min-h-[44px] px-2 -ml-2 text-sm font-medium text-[#174C38]/80 hover:text-[#174C38] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver a participantes</span>
        </button>
      </div>

      {/* Wishlist Header */}
      <section className="rounded-3xl bg-white border border-[#174C38]/10 shadow-xs p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <AvatarCircle name={owner.name} photoURL={owner.photoURL} size="lg" />
          <div className="space-y-1">
            <h1 className="font-display text-2xl sm:text-3xl font-semibold text-[#174C38] text-balance">
              Los deseos de {owner.name}
            </h1>
            <p className="text-sm text-[#174C38]/75 tabular-nums">
              {wishes.length} {wishes.length === 1 ? 'regalo publicado' : 'regalos publicados'}
              {!isOwner && ' · Las reservaciones son secretas para mantener la sorpresa'}
            </p>
          </div>
        </div>

        {isOwner && (
          <button
            type="button"
            onClick={onAddWish}
            className="min-h-[48px] px-6 py-3 rounded-2xl bg-[#B83232] hover:bg-[#942424] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>+ AGREGAR UN DESEO</span>
          </button>
        )}
      </section>

      {/* Wishes Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-80 rounded-2xl bg-white/70 border border-[#174C38]/10 animate-pulse" />
          ))}
        </div>
      ) : wishes.length === 0 ? (
        <div className="rounded-3xl bg-white border border-[#174C38]/10 p-10 sm:p-12 text-center space-y-4">
          <Gift className="w-12 h-12 text-[#B83232]/70 mx-auto" strokeWidth={1.6} />
          <h2 className="font-display text-2xl font-semibold text-[#174C38]">
            {isOwner ? 'Aún no has agregado deseos' : `${owner.name} aún no publica deseos`}
          </h2>
          <p className="text-sm text-[#174C38]/75 max-w-md mx-auto leading-relaxed">
            {isOwner
              ? 'Agrega tus ideas favoritas con fotografías, enlaces o tallas para que tu familia sepa cómo sorprenderte.'
              : 'Vuelve más tarde para descubrir qué regalos le harán ilusión esta Navidad.'}
          </p>
          {isOwner && (
            <button
              type="button"
              onClick={onAddWish}
              className="min-h-[48px] px-6 py-3 rounded-2xl bg-[#B83232] hover:bg-[#942424] text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Agregar mi primer deseo</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {wishes.map((wish) => {
            const isReserved = canSeeAvailability ? Boolean(availabilityMap[wish.wishId]) : false;
            const isReservedByMe = canSeeAvailability && myReservedWishIds.has(wish.wishId);
            const metadataParts = [
              PRIORITY_LABELS[wish.priority],
              wish.estimatedPrice ? `Aprox. ${wish.estimatedPrice}` : null,
              wish.size ? `Talla ${wish.size}` : null,
              wish.color ? `Color ${wish.color}` : null,
            ].filter(Boolean);

            return (
              <article
                key={wish.wishId}
                className="rounded-2xl bg-white border border-[#174C38]/10 shadow-xs p-5 flex flex-col justify-between gap-4"
              >
                <div className="space-y-3.5">
                  <WishImageFrame src={wish.imageURL} alt={wish.title} />

                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-[#174C38]/70">
                      {metadataParts.map((part, idx) => (
                        <React.Fragment key={`${wish.wishId}-meta-${idx}`}>
                          {idx > 0 && <span aria-hidden="true">·</span>}
                          <span className={idx === 0 ? 'text-[#B83232] font-semibold' : ''}>{part}</span>
                        </React.Fragment>
                      ))}
                    </div>

                    <h2 className="font-display text-xl font-semibold text-[#174C38] leading-snug">{wish.title}</h2>
                    <p className="text-sm text-[#174C38]/80 leading-relaxed">{wish.description}</p>

                    {wish.additionalDetails && (
                      <p className="text-xs text-[#174C38]/70 pt-1 border-t border-[#174C38]/8">
                        <strong className="font-semibold text-[#174C38]">Detalles:</strong> {wish.additionalDetails}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-3 pt-2 border-t border-[#174C38]/10">
                  {/* Availability indicator — STRICTLY hidden from owner */}
                  {canSeeAvailability && (
                    <div className="flex items-center justify-between gap-2 text-xs font-semibold">
                      {isReserved ? (
                        <span className="inline-flex items-center gap-1.5 text-[#174C38]/75">
                          <Lock className="w-3.5 h-3.5 text-[#D6AD60]" />
                          <span>
                            {isReservedByMe ? 'YA RESERVADO (Por ti)' : 'YA RESERVADO'}
                          </span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[#174C38]">
                          <Sparkles className="w-3.5 h-3.5 text-[#174C38]" />
                          <span>DISPONIBLE</span>
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    {wish.productURL && (
                      <a
                        href={wish.productURL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl border border-[#174C38]/20 text-xs font-semibold text-[#174C38] hover:bg-[#FFF8ED] inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
                      >
                        <span>VER PRODUCTO</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}

                    {isOwner ? (
                      <>
                        <button
                          type="button"
                          onClick={() => onEditWish(wish)}
                          aria-label={`Editar ${wish.title}`}
                          className="min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[#FFF8ED] hover:bg-[#174C38] text-[#174C38] hover:text-white border border-[#174C38]/15 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          <span>Editar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setWishToDelete(wish)}
                          aria-label={`Eliminar ${wish.title}`}
                          className="min-h-[44px] px-3.5 py-2.5 rounded-xl border border-[#B83232]/25 text-xs font-semibold text-[#B83232] hover:bg-[#B83232] hover:text-white inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Eliminar</span>
                        </button>
                      </>
                    ) : isReservedByMe ? (
                      <div className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[#174C38]/10 text-[#174C38] text-xs font-semibold flex items-center justify-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-[#174C38]" />
                        <span>Ya te encargas de este regalo</span>
                      </div>
                    ) : isReserved ? (
                      <div className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[#FFF8ED] border border-[#174C38]/10 text-[#174C38]/65 text-xs font-medium flex items-center justify-center gap-1.5 text-center">
                        <Lock className="w-3.5 h-3.5 shrink-0" />
                        <span>Alguien de la familia ya lo eligió</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setWishToReserve(wish)}
                        className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[#B83232] hover:bg-[#942424] text-white text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
                      >
                        <Gift className="w-4 h-4 shrink-0" />
                        <span>YO ME ENCARGO DE ESTE REGALO</span>
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <ConfirmModal
        open={Boolean(wishToDelete)}
        title="Eliminar deseo"
        message={
          wishToDelete
            ? `¿Seguro que deseas eliminar "${wishToDelete.title}" de tu lista de deseos? Esta acción no se puede deshacer.`
            : ''
        }
        confirmLabel="Sí, eliminar"
        variant="danger"
        loading={actionLoading}
        onConfirm={handleConfirmDelete}
        onCancel={() => setWishToDelete(null)}
      />

      <ConfirmModal
        open={Boolean(wishToReserve)}
        title="Confirmar reservación secreta"
        message={
          wishToReserve
            ? `¿Confirmas que te encargarás de regalar "${wishToReserve.title}" a ${owner.name}? Aparecerá como reservado para el resto de la familia, pero ${owner.name} no lo sabrá.`
            : ''
        }
        confirmLabel="Sí, yo me encargo"
        loading={actionLoading}
        onConfirm={handleConfirmReserve}
        onCancel={() => setWishToReserve(null)}
      />
    </div>
  );
}
