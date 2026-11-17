import React, { useEffect, useState } from 'react';
import { Calendar, Sparkles } from 'lucide-react';
import { calculateCountdown, DEFAULT_EXCHANGE_DATE } from '../utils/christmasLogic';
import { PineOrnamentDivider } from './FestiveIllustrations';

interface CountdownBannerProps {
  exchangeDate?: string;
  eventName?: string;
}

export function CountdownBanner({
  exchangeDate = DEFAULT_EXCHANGE_DATE,
  eventName = 'Intercambio Navideño',
}: CountdownBannerProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const countdown = calculateCountdown(exchangeDate, nowMs);

  return (
    <section
      aria-label="Mensaje navideño y contador regresivo"
      className="mt-12 rounded-3xl bg-white border border-[#174C38]/10 shadow-sm overflow-hidden"
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
        <div className="lg:col-span-6 p-6 sm:p-8 lg:p-10 flex flex-col justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-medium text-[#174C38]/70">
              <Calendar className="w-4 h-4 text-[#B83232]" />
              <span>{eventName}</span>
              <span aria-hidden="true">·</span>
              <span>{countdown.formattedDate}</span>
            </div>

            <h2 className="font-display text-2xl sm:text-3xl font-semibold text-[#174C38] leading-tight text-balance">
              Los mejores momentos no se compran, se comparten.
            </h2>

            <p className="text-sm sm:text-base text-[#174C38]/80 leading-relaxed">
              Que esta Navidad esté llena de amor, alegría, generosidad y gratitud.
            </p>
          </div>

          <PineOrnamentDivider />

          <div>
            {countdown.isToday ? (
              <div className="rounded-2xl bg-[#FFF8ED] border border-[#D6AD60]/50 p-4 flex items-center gap-3">
                <Sparkles className="w-6 h-6 text-[#B83232] shrink-0" />
                <div>
                  <p className="font-display text-lg font-semibold text-[#174C38]">
                    ¡Hoy es el gran intercambio navideño!
                  </p>
                  <p className="text-xs text-[#174C38]/75">Disfrutemos juntos cada sorpresa preparada con cariño.</p>
                </div>
              </div>
            ) : countdown.isPast ? (
              <div className="rounded-2xl bg-[#FFF8ED] border border-[#174C38]/10 p-4">
                <p className="font-display text-base font-semibold text-[#174C38]">
                  Gracias por compartir esta Navidad en familia.
                </p>
                <p className="text-xs text-[#174C38]/70 mt-1">
                  El administrador puede actualizar la fecha para el próximo encuentro familiar.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-medium text-[#174C38]/70">Faltan para nuestro intercambio</p>
                <div className="grid grid-cols-4 gap-2 sm:gap-3">
                  {[
                    { label: 'Días', value: countdown.days },
                    { label: 'Horas', value: countdown.hours },
                    { label: 'Minutos', value: countdown.minutes },
                    { label: 'Segundos', value: countdown.seconds },
                  ].map((unit) => (
                    <div
                      key={unit.label}
                      className="rounded-xl bg-[#FFF8ED] border border-[#174C38]/10 py-3 px-2 text-center"
                    >
                      <div className="font-mono tabular-nums text-xl sm:text-2xl font-semibold text-[#174C38]">
                        {String(unit.value).padStart(2, '0')}
                      </div>
                      <div className="text-[11px] font-medium text-[#174C38]/65 mt-0.5">{unit.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-6 relative min-h-[220px] lg:min-h-full bg-[#FFF8ED]">
          {!imgError ? (
            <img
              src="/src/assets/images/family_hearth_banner_1794878273226.jpg"
              alt="Árbol de Navidad familiar decorado con estrellas doradas y regalos envueltos"
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#174C38] to-[#103728] text-[#FFF8ED] p-8 text-center">
              <p className="font-display text-xl">NAVIDAD JUNTOS 2026</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
