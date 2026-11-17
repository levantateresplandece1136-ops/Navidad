import React from 'react';
import { Plus, ShieldCheck } from 'lucide-react';
import { AppView, UserRole } from '../types/models';

interface TopNavProps {
  activeView: AppView;
  userRole: UserRole;
  onNavigate: (view: AppView) => void;
  onAddWish: () => void;
}

export function TopNav({ activeView, userRole, onNavigate, onAddWish }: TopNavProps) {
  const navItems: { id: AppView; label: string }[] = [
    { id: 'dashboard', label: 'Inicio' },
    { id: 'wishlist', label: 'Mis deseos' },
    { id: 'reservations', label: 'Reservaciones' },
    { id: 'profile', label: 'Mi perfil' },
  ];

  if (userRole === UserRole.ADMIN) {
    navItems.push({ id: 'admin', label: 'Administrar' });
  }

  return (
    <header className="sticky top-0 z-30 bg-[#FFF8ED]/92 backdrop-blur-md border-b border-[#174C38]/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 md:h-16 flex items-center justify-between gap-4 md:gap-8">
        {/* Zone 1: Single-line Brand Wordmark */}
        <button
          type="button"
          onClick={() => onNavigate('dashboard')}
          className="font-display text-base sm:text-lg font-semibold tracking-tight text-[#174C38] whitespace-nowrap shrink-0 hover:text-[#B83232] transition-colors"
        >
          NAVIDAD JUNTOS 2026
        </button>

        {/* Zone 2: Desktop concise text nav links */}
        <nav aria-label="Navegación principal" className="hidden md:flex items-center gap-6">
          {navItems.map((item) => {
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`text-sm font-medium whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors ${
                  isActive
                    ? 'text-[#174C38] border-[#B83232]'
                    : 'text-[#174C38]/70 border-transparent hover:text-[#174C38]'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Single Primary Action */}
        <div className="flex items-center gap-2 shrink-0">
          {userRole === UserRole.ADMIN && (
            <button
              type="button"
              onClick={() => onNavigate('admin')}
              aria-label="Panel del administrador"
              className={`md:hidden min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl transition-colors ${
                activeView === 'admin'
                  ? 'bg-[#174C38] text-[#FFF8ED]'
                  : 'text-[#174C38] hover:bg-[#174C38]/10'
              }`}
            >
              <ShieldCheck className="w-5 h-5" />
            </button>
          )}
          <button
            type="button"
            onClick={onAddWish}
            className="hidden md:inline-flex items-center gap-1.5 min-h-[40px] px-4 py-2 rounded-xl bg-[#B83232] hover:bg-[#942424] text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Agregar deseo</span>
          </button>
        </div>
      </div>
    </header>
  );
}
