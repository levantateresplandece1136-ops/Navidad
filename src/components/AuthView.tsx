import React, { useMemo, useState } from 'react';
import { ArrowLeft, Sparkles, UserCheck } from 'lucide-react';
import { loginFreeWithName, loginWithGoogle } from '../services/authService';
import { getFriendlyFirebaseError } from '../services/firebase';
import { detectInAppBrowser, FIELD_LIMITS, validateFreeAccessName } from '../utils/christmasLogic';

import { UserProfile } from '../types/models';

interface AuthViewProps {
  initialName?: string;
  onFreeLogin: (profile: UserProfile) => void;
  onBackToWelcome: () => void;
}

export function AuthView({ initialName = '', onFreeLogin, onBackToWelcome }: AuthViewProps) {
  const [name, setName] = useState(initialName);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isInAppWebView = useMemo(
    () => (typeof navigator !== 'undefined' ? detectInAppBrowser(navigator.userAgent) : false),
    []
  );

  const handleFreeEnter = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const validation = validateFreeAccessName(name);
    if (!validation.valid) {
      setErrorMsg(validation.error || 'Escribe tu nombre para entrar.');
      return;
    }

    setLoading(true);
    try {
      const profile = await loginFreeWithName(validation.cleanName);
      onFreeLogin(profile);
    } catch (err) {
      setErrorMsg(getFriendlyFirebaseError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setErrorMsg(null);
    setLoading(true);
    try {
      await loginWithGoogle();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No pudimos iniciar sesión con Google.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFF8ED] flex flex-col justify-center py-8 px-4">
      <div className="w-full max-w-md mx-auto space-y-4">
        <button
          type="button"
          onClick={onBackToWelcome}
          className="inline-flex items-center gap-1.5 min-h-[44px] text-sm font-medium text-[#174C38]/75 hover:text-[#174C38] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver a bienvenida</span>
        </button>

        <div className="bg-white rounded-3xl border border-[#174C38]/10 shadow-sm p-6 sm:p-8 space-y-6">
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#B83232] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>NAVIDAD JUNTOS 2026</span>
            </p>
            <h1 className="font-display text-2xl sm:text-3xl font-semibold text-[#174C38]">
              Entra con tu nombre
            </h1>
            <p className="text-sm text-[#174C38]/75 leading-relaxed">
              Acceso libre para toda la familia: sin correo electrónico, sin contraseña y sin número de WhatsApp.
            </p>
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="rounded-xl bg-[#B83232]/10 border border-[#B83232]/25 p-3.5 text-xs font-medium text-[#942424] leading-relaxed break-words"
            >
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleFreeEnter} className="space-y-4" noValidate>
            <div>
              <label htmlFor="auth-name" className="block text-xs font-semibold text-[#174C38] mb-1.5">
                Tu nombre *
              </label>
              <input
                id="auth-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={FIELD_LIMITS.NAME_MAX}
                placeholder="Ej. Ammi, Sandy o Tío Carlos"
                autoComplete="name"
                className="w-full min-h-[48px] px-4 py-3 rounded-xl border border-[#174C38]/20 bg-[#FFF8ED]/50 text-base text-[#174C38] focus:outline-none focus:ring-2 focus:ring-[#174C38]/30"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-[#B83232] hover:bg-[#942424] text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
            >
              <UserCheck className="w-4 h-4" />
              <span>{loading ? 'Entrando...' : 'ENTRAR LIBREMENTE'}</span>
            </button>
          </form>

          <div className="flex items-center gap-3 text-xs text-[#174C38]/55">
            <div className="h-px flex-1 bg-[#174C38]/12" />
            <span>o si eres administrador</span>
            <div className="h-px flex-1 bg-[#174C38]/12" />
          </div>

          <div className="space-y-2.5">
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-white border border-[#174C38]/20 hover:bg-[#FFF8ED] text-sm font-semibold text-[#174C38] flex items-center justify-center gap-3 transition-colors shadow-2xs disabled:opacity-60"
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                />
              </svg>
              <span>Continuar con Google</span>
            </button>

            {isInAppWebView && (
              <p className="text-[11px] text-[#174C38]/70 text-center leading-relaxed">
                Si abriste el enlace dentro de WhatsApp u otra app y Google no responde, entra arriba solo con tu nombre
                o abre la página en Chrome o Safari.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
