import React, { useMemo, useState } from 'react';
import { ArrowRight, Plus, Search, TreePine } from 'lucide-react';
import { ChristmasEvent, ParticipantFilter, UserProfile } from '../types/models';
import { filterParticipants, formatShortDate } from '../utils/christmasLogic';
import { AvatarCircle } from './FestiveIllustrations';
import { CountdownBanner } from './CountdownBanner';

interface DashboardViewProps {
  currentUser: UserProfile;
  participants: UserProfile[];
  activeEvent: ChristmasEvent | null;
  loading: boolean;
  onSelectParticipant: (uid: string) => void;
  onAddWish: () => void;
}

export function DashboardView({
  currentUser,
  participants,
  activeEvent,
  loading,
  onSelectParticipant,
  onAddWish,
}: DashboardViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<ParticipantFilter>('all');

  const filteredParticipants = useMemo(
    () => filterParticipants(participants, currentUser.uid, searchQuery, filterMode),
    [participants, currentUser.uid, searchQuery, filterMode]
  );

  const filterOptions: { id: ParticipantFilter; label: string }[] = [
    { id: 'all', label: 'Todos' },
    { id: 'mine', label: 'Mis deseos' },
    { id: 'recent', label: 'Listas actualizadas recientemente' },
  ];

  return (
    <div className="space-y-8">
      {/* Greeting & Primary Header */}
      <section className="rounded-3xl bg-white border border-[#174C38]/10 shadow-xs p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wider uppercase text-[#B83232]">
            <TreePine className="w-4 h-4 text-[#174C38]" />
            <span>{activeEvent?.name || 'NAVIDAD JUNTOS 2026'}</span>
          </div>
          <h1 className="font-display text-2xl sm:text-4xl font-semibold text-[#174C38] text-balance">
            ¡Hola, {currentUser.name}!
          </h1>
          <p className="text-sm sm:text-base text-[#174C38]/80 max-w-2xl">
            Descubre qué desean recibir nuestros seres queridos esta Navidad.
          </p>
        </div>

        <button
          type="button"
          onClick={onAddWish}
          className="min-h-[48px] px-6 py-3 rounded-2xl bg-[#B83232] hover:bg-[#942424] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>Agregar un deseo</span>
        </button>
      </section>

      {activeEvent && !activeEvent.active && (
        <div
          role="status"
          className="rounded-2xl bg-[#D6AD60]/20 border border-[#D6AD60] px-5 py-4 text-sm text-[#174C38] font-medium"
        >
          El intercambio navideño se encuentra en pausa temporalmente por el administrador. Puedes consultar tus listas,
          y las nuevas reservaciones se habilitarán al reactivarlo.
        </div>
      )}

      {/* Search & Filter Controls */}
      <section className="space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-[#174C38]/50 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <label htmlFor="participant-search" className="sr-only">
              Buscar participante por nombre
            </label>
            <input
              id="participant-search"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar a alguien de la familia..."
              className="w-full min-h-[44px] pl-10 pr-4 py-2.5 rounded-xl bg-white border border-[#174C38]/15 text-sm text-[#174C38] placeholder:text-[#174C38]/45 focus:outline-none focus:ring-2 focus:ring-[#174C38]/25"
            />
          </div>

          <div
            role="group"
            aria-label="Filtrar participantes"
            className="flex flex-wrap items-center gap-1 p-1 bg-[#174C38]/6 rounded-xl"
          >
            {filterOptions.map((opt) => {
              const active = filterMode === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setFilterMode(opt.id)}
                  className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-white text-[#174C38] shadow-2xs'
                      : 'text-[#174C38]/70 hover:text-[#174C38]'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Participant Cards Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-44 rounded-2xl bg-white/70 border border-[#174C38]/10 p-6 animate-pulse"
              />
            ))}
          </div>
        ) : filteredParticipants.length === 0 ? (
          <div className="rounded-3xl bg-white border border-[#174C38]/10 p-10 text-center space-y-3">
            <TreePine className="w-10 h-10 text-[#174C38]/40 mx-auto" />
            <h2 className="font-display text-xl font-semibold text-[#174C38]">
              No encontramos participantes con ese criterio
            </h2>
            <p className="text-sm text-[#174C38]/70 max-w-md mx-auto">
              Prueba limpiando el buscador o seleccionando el filtro “Todos” para ver a toda la familia.
            </p>
            {(searchQuery || filterMode !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setFilterMode('all');
                }}
                className="min-h-[44px] px-5 py-2 rounded-xl border border-[#174C38]/20 text-sm font-medium text-[#174C38] hover:bg-[#FFF8ED] transition-colors"
              >
                Mostrar toda la familia
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredParticipants.map((person) => {
              const isSelf = person.uid === currentUser.uid;
              return (
                <article
                  key={person.uid}
                  className="rounded-2xl bg-white border border-[#174C38]/10 shadow-xs p-5 flex flex-col justify-between gap-5 hover:border-[#D6AD60]/70 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <AvatarCircle name={person.name} photoURL={person.photoURL} size="md" />
                    <div className="min-w-0 flex-1 space-y-1">
                      <h2 className="font-display text-lg font-semibold text-[#174C38] truncate">
                        {person.name}
                      </h2>
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#174C38]/70 tabular-nums">
                        <span>
                          {person.wishesCount} {person.wishesCount === 1 ? 'deseo publicado' : 'deseos publicados'}
                        </span>
                        {isSelf && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-semibold text-[#B83232]">Tu lista</span>
                          </>
                        )}
                        {person.lastWishAt && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>Actualizada {formatShortDate(person.lastWishAt)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onSelectParticipant(person.uid)}
                    className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[#FFF8ED] hover:bg-[#174C38] text-[#174C38] hover:text-[#FFF8ED] border border-[#174C38]/15 text-xs font-semibold flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
                  >
                    <span>VER LISTA</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <CountdownBanner
        exchangeDate={activeEvent?.exchangeDate}
        eventName={activeEvent?.name || 'NAVIDAD JUNTOS 2026'}
      />
    </div>
  );
}
