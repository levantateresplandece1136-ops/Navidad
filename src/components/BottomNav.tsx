import React from 'react';
import { Gift, Heart, Home, User } from 'lucide-react';
import { AppView } from '../types/models';

interface BottomNavProps {
  activeView: AppView;
  onNavigate: (view: AppView) => void;
}

export function BottomNav({ activeView, onNavigate }: BottomNavProps) {
  const items: { id: AppView; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'dashboard', label: 'Inicio', Icon: Home },
    { id: 'wishlist', label: 'Mis deseos', Icon: Heart },
    { id: 'reservations', label: 'Reservaciones', Icon: Gift },
    { id: 'profile', label: 'Mi perfil', Icon: User },
  ];

  return (
    <nav
      aria-label="Navegación inferior móvil"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#174C38]/12"
    >
      <div className="grid grid-cols-4 h-16">
        {items.map(({ id, label, Icon }) => {
          const isActive = activeView === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onNavigate(id)}
              className={`min-h-[44px] flex flex-col items-center justify-center gap-1 transition-colors ${
                isActive ? 'text-[#B83232]' : 'text-[#174C38]/65 hover:text-[#174C38]'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[11px] font-medium tracking-tight whitespace-nowrap">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
