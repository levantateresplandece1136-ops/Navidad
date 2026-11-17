import React, { useState } from 'react';
import { ArrowRight, Gift, Heart, Lock, TreePine } from 'lucide-react';
import { CountdownBanner } from './CountdownBanner';
import { PineOrnamentDivider, SnowflakeCornerAccent } from './FestiveIllustrations';

interface WelcomeViewProps {
  onEnter: () => void;
  inviteEmail?: string;
}

export function WelcomeView({ onEnter, inviteEmail }: WelcomeViewProps) {
  const [imgError, setImgError] = useState(false);

  return (
    <div className="min-h-screen bg-[#FFF8ED] text-[#174C38] flex flex-col">
      <header className="border-b border-[#174C38]/10 bg-[#FFF8ED]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          <span className="font-display text-lg font-semibold tracking-tight text-[#174C38] whitespace-nowrap shrink-0">
            NAVIDAD JUNTOS 2026
          </span>
          <div className="hidden sm:flex items-center gap-6 text-sm font-medium text-[#174C38]/75">
            <a href="#como-funciona" className="hover:text-[#174C38] transition-colors whitespace-nowrap shrink-0">
              Cómo funciona
            </a>
            <a href="#cuenta-regresiva" className="hover:text-[#174C38] transition-colors whitespace-nowrap shrink-0">
              Cuenta regresiva
            </a>
          </div>
          <button
            type="button"
            onClick={onEnter}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-[#174C38] hover:bg-[#103728] text-[#FFF8ED] text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
          >
            Entrar
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16">
        <section className="relative rounded-3xl bg-white border border-[#174C38]/10 shadow-sm overflow-hidden">
          <SnowflakeCornerAccent className="absolute top-3 left-3 opacity-60 hidden sm:block" />

          <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
            <div className="lg:col-span-6 p-6 sm:p-10 lg:p-12 flex flex-col justify-center gap-6">
              {inviteEmail && (
                <p className="text-xs font-medium text-[#B83232]">
                  Invitación familiar para {inviteEmail}
                </p>
              )}

              <div className="space-y-4">
                <p className="text-xs font-semibold tracking-wider uppercase text-[#B83232]">
                  Una Navidad, muchos deseos y una familia
                </p>

                <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-semibold text-[#174C38] leading-[1.12] text-balance">
                  ¡Bienvenidos a nuestra Navidad!
                </h1>

                <p className="text-base sm:text-lg text-[#174C38]/80 leading-relaxed max-w-xl">
                  Este año queremos que regalar sea más fácil y divertido. Aquí podremos compartir nuestros deseos,
                  descubrir qué les gustaría recibir a nuestros seres queridos y organizar nuestras sorpresas.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-4 pt-2">
                <button
                  type="button"
                  onClick={onEnter}
                  className="min-h-[48px] px-7 py-3.5 rounded-2xl bg-[#B83232] hover:bg-[#942424] text-white text-sm sm:text-base font-semibold inline-flex items-center justify-center gap-2.5 shadow-sm transition-colors whitespace-nowrap shrink-0"
                >
                  <span>ENTRAR A NUESTRA NAVIDAD</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              <PineOrnamentDivider className="pt-2" />

              <p className="font-display italic text-base sm:text-lg text-[#174C38]/85 text-center sm:text-left">
                “Porque el mejor regalo es compartir.”
              </p>
            </div>

            <div className="lg:col-span-6 relative min-h-[260px] sm:min-h-[340px] lg:min-h-full overflow-hidden bg-[#FFF8ED]">
              {!imgError ? (
                <img
                  src="/src/assets/images/welcome_christmas_gifts_1794878272242.jpg"
                  alt="Ilustración navideña de cajas de regalo con ramas de pino y estrellas doradas"
                  referrerPolicy="no-referrer"
                  onError={() => setImgError(true)}
                  className="w-full h-full object-cover object-center scale-[1.22]"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-10 bg-gradient-to-br from-[#FFF8ED] to-[#F3E5CE] gap-4">
                  <TreePine className="w-16 h-16 text-[#174C38]" strokeWidth={1.5} />
                  <p className="font-display text-xl text-[#174C38]">NAVIDAD JUNTOS 2026</p>
                </div>
              )}
            </div>
          </div>
        </section>

        <section id="como-funciona" className="mt-10 sm:mt-12 grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            {
              Icon: Heart,
              title: 'Comparte tus deseos',
              desc: 'Sube fotografías, enlaces de tiendas, tallas, colores y tu nivel de ilusión para cada regalo.',
            },
            {
              Icon: Lock,
              title: 'Reservaciones secretas',
              desc: 'Aparta un regalo sin que la otra persona lo sepa, evitando duplicados con privacidad total.',
            },
            {
              Icon: Gift,
              title: 'Sincronizado en familia',
              desc: 'Cada cambio en listas y reservaciones se actualiza al instante en teléfonos y computadoras.',
            },
          ].map(({ Icon, title, desc }) => (
            <div
              key={title}
              className="rounded-2xl bg-white border border-[#174C38]/10 p-6 space-y-2.5 shadow-2xs"
            >
              <div className="w-10 h-10 rounded-xl bg-[#FFF8ED] border border-[#D6AD60]/40 flex items-center justify-center text-[#174C38]">
                <Icon className="w-5 h-5 text-[#B83232]" />
              </div>
              <h2 className="font-display text-lg font-semibold text-[#174C38]">{title}</h2>
              <p className="text-sm text-[#174C38]/75 leading-relaxed">{desc}</p>
            </div>
          ))}
        </section>

        <div id="cuenta-regresiva">
          <CountdownBanner />
        </div>
      </main>
    </div>
  );
}
