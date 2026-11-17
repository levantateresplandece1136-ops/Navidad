import React from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';

export interface ToastState {
  type: 'success' | 'error';
  message: string;
}

export function ToastBanner({
  toast,
  onDismiss,
}: {
  toast: ToastState | null;
  onDismiss: () => void;
}) {
  if (!toast) return null;

  const isError = toast.type === 'error';

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-20 md:bottom-6 right-4 left-4 md:left-auto md:max-w-md z-50"
    >
      <div
        className={`flex items-start gap-3 rounded-2xl p-4 shadow-lg border ${
          isError
            ? 'bg-white border-[#B83232]/30 text-[#942424]'
            : 'bg-[#174C38] border-[#D6AD60]/40 text-[#FFF8ED]'
        }`}
      >
        {isError ? (
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-[#B83232]" />
        ) : (
          <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-[#D6AD60]" />
        )}
        <p className="text-sm font-medium flex-1 leading-snug">{toast.message}</p>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Cerrar aviso"
          className="min-h-[32px] min-w-[32px] -mr-1 -mt-1 flex items-center justify-center rounded-lg opacity-75 hover:opacity-100 transition-opacity"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
