import React, { useState } from 'react';
import { ExternalLink, Gift, Trash2 } from 'lucide-react';
import { Reservation } from '../types/models';
import { formatShortDate } from '../utils/christmasLogic';
import { cancelSecretReservation } from '../services/reservationService';
import { getFriendlyFirebaseError } from '../services/firebase';
import { WishImageFrame } from './FestiveIllustrations';
import { ConfirmModal } from './ConfirmModal';

interface ReservationsViewProps {
  currentUid: string;
  reservations: Reservation[];
  loading: boolean;
  onExploreFamily: () => void;
  onNotify: (type: 'success' | 'error', message: string) => void;
}

export function ReservationsView({
  currentUid,
  reservations,
  loading,
  onExploreFamily,
  onNotify,
}: ReservationsViewProps) {
  const [cancelTarget, setCancelTarget] = useState<Reservation | null>(null);
  const [canceling, setCanceling] = useState(false);

  const handleConfirmCancel = async () => {
    if (!cancelTarget) return;
    setCanceling(true);
    try {
      await cancelSecretReservation(cancelTarget.wishId, currentUid);
      onNotify(
        'success',
        `Cancelaste tu reservación de "${cancelTarget.wishTitle}". Ahora vuelve a estar disponible para la familia.`
      );
      setCancelTarget(null);
    } catch (err) {
      onNotify('error', getFriendlyFirebaseError(err));
    } finally {
      setCanceling(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white border border-[#174C38]/10 shadow-xs p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#B83232]">Mis sorpresas secretas</p>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-[#174C38]">
            REGALOS QUE VOY A PREPARAR
          </h1>
          <p className="text-sm text-[#174C38]/75">
            Esta lista es completamente privada: solo tú puedes ver los regalos que reservaste para tus seres queridos.
          </p>
        </div>
        <div className="text-sm font-semibold text-[#174C38] tabular-nums shrink-0">
          {reservations.length} {reservations.length === 1 ? 'regalo reservado' : 'regalos reservados'}
        </div>
      </section>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2].map((n) => (
            <div key={n} className="h-72 rounded-2xl bg-white/70 border border-[#174C38]/10 animate-pulse" />
          ))}
        </div>
      ) : reservations.length === 0 ? (
        <div className="rounded-3xl bg-white border border-[#174C38]/10 p-10 sm:p-12 text-center space-y-4">
          <Gift className="w-12 h-12 text-[#B83232]/70 mx-auto" strokeWidth={1.6} />
          <h2 className="font-display text-2xl font-semibold text-[#174C38]">
            Aún no has reservado ningún regalo
          </h2>
          <p className="text-sm text-[#174C38]/75 max-w-md mx-auto leading-relaxed">
            Explora las listas de tus familiares y elige qué sorpresa te gustaría preparar esta Navidad.
          </p>
          <button
            type="button"
            onClick={onExploreFamily}
            className="min-h-[48px] px-6 py-3 rounded-2xl bg-[#174C38] hover:bg-[#103728] text-white text-sm font-semibold transition-colors"
          >
            Ver listas de la familia
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {reservations.map((item) => (
            <article
              key={item.wishId}
              className="rounded-2xl bg-white border border-[#174C38]/10 shadow-xs p-5 flex flex-col justify-between gap-4"
            >
              <div className="space-y-3.5">
                <WishImageFrame src={item.wishImageURL} alt={item.wishTitle} />

                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#174C38]/70">
                    <span className="font-semibold text-[#B83232]">Para {item.recipientName}</span>
                    <span aria-hidden="true">·</span>
                    <span>Reservado el {formatShortDate(item.createdAt)}</span>
                  </div>

                  <h2 className="font-display text-xl font-semibold text-[#174C38] leading-snug">
                    {item.wishTitle}
                  </h2>
                  {item.wishDescription && (
                    <p className="text-sm text-[#174C38]/80 leading-relaxed">{item.wishDescription}</p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-[#174C38]/10">
                {item.productURL && (
                  <a
                    href={item.productURL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-[#174C38] hover:bg-[#103728] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
                  >
                    <span>IR A COMPRAR</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}

                <button
                  type="button"
                  onClick={() => setCancelTarget(item)}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl border border-[#B83232]/25 text-xs font-semibold text-[#B83232] hover:bg-[#B83232] hover:text-white inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Cancelar reservación</span>
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <ConfirmModal
        open={Boolean(cancelTarget)}
        title="Cancelar reservación"
        message={
          cancelTarget
            ? `¿Seguro que deseas cancelar tu reservación de "${cancelTarget.wishTitle}" para ${cancelTarget.recipientName}? Volverá a aparecer disponible para los demás.`
            : ''
        }
        confirmLabel="Sí, cancelar reservación"
        variant="danger"
        loading={canceling}
        onConfirm={handleConfirmCancel}
        onCancel={() => setCancelTarget(null)}
      />
    </div>
  );
}
