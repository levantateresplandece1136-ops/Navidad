import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { ArrowLeft, CheckCircle2, KeyRound, Lock, LogIn, Mail, RefreshCw, UserPlus } from 'lucide-react';
import {
  loginWithEmail,
  loginWithGoogle,
  logoutUser,
  refreshAuthUser,
  registerWithEmail,
  resendVerificationEmail,
  sendPasswordRecovery,
} from '../services/authService';
import { FIELD_LIMITS } from '../utils/christmasLogic';

type AuthMode = 'login' | 'register' | 'reset';

interface AuthViewProps {
  initialEmail?: string;
  pendingVerificationUser?: User | null;
  onVerificationConfirmed: (user: User) => Promise<void> | void;
  onBackToWelcome: () => void;
}

export function AuthView({
  initialEmail = '',
  pendingVerificationUser = null,
  onVerificationConfirmed,
  onBackToWelcome,
}: AuthViewProps) {
  const [mode, setMode] = useState<AuthMode>(initialEmail ? 'register' : 'login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setErrorMsg(null);
    setInfoMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMsg('Ingresa un correo electrónico válido.');
      return;
    }

    if (mode === 'reset') {
      setLoading(true);
      try {
        await sendPasswordRecovery(cleanEmail);
        setInfoMsg('Te enviamos un enlace a tu correo para restablecer tu contraseña.');
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'No pudimos enviar el correo de recuperación.');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (mode === 'register') {
      const cleanName = name.trim();
      if (!cleanName) {
        setErrorMsg('Escribe tu nombre para que tu familia reconozca tu lista.');
        return;
      }
      if (password.length < 6) {
        setErrorMsg('La contraseña debe tener al menos 6 caracteres.');
        return;
      }

      setLoading(true);
      try {
        await registerWithEmail(cleanName, cleanEmail, password);
        setInfoMsg('Cuenta creada. Revisa tu bandeja de entrada para verificar tu correo electrónico.');
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'No pudimos crear tu cuenta.');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!password) {
      setErrorMsg('Ingresa tu contraseña para continuar.');
      return;
    }

    setLoading(true);
    try {
      await loginWithEmail(cleanEmail, password);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No pudimos iniciar sesión.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setErrorMsg(null);
    setInfoMsg(null);
    setLoading(true);
    try {
      await loginWithGoogle();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No pudimos iniciar sesión con Google.');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckVerification = async () => {
    if (!pendingVerificationUser) return;
    setErrorMsg(null);
    setInfoMsg(null);
    setLoading(true);
    try {
      const updatedUser = await refreshAuthUser(pendingVerificationUser);
      if (updatedUser.emailVerified) {
        await onVerificationConfirmed(updatedUser);
      } else {
        setErrorMsg('Tu correo aún aparece sin verificar. Haz clic en el enlace que te enviamos y vuelve a intentarlo.');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No pudimos verificar tu estado.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (!pendingVerificationUser) return;
    setErrorMsg(null);
    setInfoMsg(null);
    setLoading(true);
    try {
      await resendVerificationEmail(pendingVerificationUser);
      setInfoMsg('Enviamos un nuevo enlace de verificación a tu correo electrónico.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No pudimos reenviar el correo.');
    } finally {
      setLoading(false);
    }
  };

  if (pendingVerificationUser) {
    return (
      <div className="min-h-screen bg-[#FFF8ED] flex flex-col justify-center py-8 px-4">
        <div className="w-full max-w-md mx-auto bg-white rounded-3xl border border-[#174C38]/10 shadow-sm p-6 sm:p-8 space-y-5">
          <div className="w-12 h-12 rounded-2xl bg-[#FFF8ED] border border-[#D6AD60]/40 flex items-center justify-center text-[#174C38]">
            <Mail className="w-6 h-6 text-[#B83232]" />
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#B83232]">Verifica tu correo</p>
            <h1 className="font-display text-2xl font-semibold text-[#174C38]">
              Confirma tu dirección de correo
            </h1>
            <p className="text-sm text-[#174C38]/80 leading-relaxed">
              Enviamos un enlace de verificación a{' '}
              <span className="font-semibold text-[#174C38]">{pendingVerificationUser.email}</span>. Ábrelo para activar
              tu acceso familiar.
            </p>
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="rounded-xl bg-[#B83232]/10 border border-[#B83232]/25 p-3.5 text-xs font-medium text-[#942424]"
            >
              {errorMsg}
            </div>
          )}

          {infoMsg && (
            <div className="rounded-xl bg-[#174C38]/10 border border-[#174C38]/20 p-3.5 text-xs font-medium text-[#174C38]">
              {infoMsg}
            </div>
          )}

          <div className="space-y-2.5 pt-1">
            <button
              type="button"
              onClick={handleCheckVerification}
              disabled={loading}
              className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-[#174C38] hover:bg-[#103728] text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{loading ? 'Comprobando...' : 'Ya verifiqué mi correo'}</span>
            </button>

            <button
              type="button"
              onClick={handleResendVerification}
              disabled={loading}
              className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-[#174C38]/20 text-sm font-semibold text-[#174C38] hover:bg-[#FFF8ED] flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Reenviar enlace de verificación</span>
            </button>

            <button
              type="button"
              onClick={() => void logoutUser()}
              disabled={loading}
              className="w-full min-h-[44px] px-4 py-2 text-xs font-semibold text-[#B83232] hover:underline"
            >
              Usar otro correo electrónico
            </button>
          </div>
        </div>
      </div>
    );
  }

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
            <p className="text-xs font-semibold uppercase tracking-wider text-[#B83232]">NAVIDAD JUNTOS 2026</p>
            <h1 className="font-display text-2xl sm:text-3xl font-semibold text-[#174C38]">
              {mode === 'login' && 'Inicia sesión en familia'}
              {mode === 'register' && 'Crea tu cuenta familiar'}
              {mode === 'reset' && 'Recuperar contraseña'}
            </h1>
            <p className="text-sm text-[#174C38]/75">
              {mode === 'login' && 'Entra con tu correo electrónico o con tu cuenta de Google.'}
              {mode === 'register' && 'Registra tu nombre y correo para compartir tu lista navideña.'}
              {mode === 'reset' && 'Te enviaremos un enlace para elegir una nueva contraseña.'}
            </p>
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="rounded-xl bg-[#B83232]/10 border border-[#B83232]/25 p-3.5 text-xs font-medium text-[#942424] leading-relaxed"
            >
              {errorMsg}
            </div>
          )}

          {infoMsg && (
            <div className="rounded-xl bg-[#174C38]/10 border border-[#174C38]/20 p-3.5 text-xs font-medium text-[#174C38] leading-relaxed">
              {infoMsg}
            </div>
          )}

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

          <div className="flex items-center gap-3 text-xs text-[#174C38]/55">
            <div className="h-px flex-1 bg-[#174C38]/12" />
            <span>o con tu correo electrónico</span>
            <div className="h-px flex-1 bg-[#174C38]/12" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {mode === 'register' && (
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
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-[#174C38]/20 bg-[#FFF8ED]/50 text-sm text-[#174C38] focus:outline-none focus:ring-2 focus:ring-[#174C38]/30"
                />
              </div>
            )}

            <div>
              <label htmlFor="auth-email" className="block text-xs font-semibold text-[#174C38] mb-1.5">
                Correo electrónico *
              </label>
              <input
                id="auth-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@correo.com"
                autoComplete="email"
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-[#174C38]/20 bg-[#FFF8ED]/50 text-sm text-[#174C38] focus:outline-none focus:ring-2 focus:ring-[#174C38]/30"
              />
            </div>

            {mode !== 'reset' && (
              <div>
                <label htmlFor="auth-password" className="block text-xs font-semibold text-[#174C38] mb-1.5">
                  Contraseña *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#174C38]/45 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="auth-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === 'register' ? 'Mínimo 6 caracteres' : '••••••••'}
                    autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                    className="w-full min-h-[44px] pl-10 pr-3.5 py-2.5 rounded-xl border border-[#174C38]/20 bg-[#FFF8ED]/50 text-sm text-[#174C38] focus:outline-none focus:ring-2 focus:ring-[#174C38]/30"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-[#B83232] hover:bg-[#942424] text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
            >
              {mode === 'login' && <LogIn className="w-4 h-4" />}
              {mode === 'register' && <UserPlus className="w-4 h-4" />}
              {mode === 'reset' && <KeyRound className="w-4 h-4" />}
              <span>
                {loading
                  ? 'Procesando...'
                  : mode === 'login'
                    ? 'Iniciar sesión'
                    : mode === 'register'
                      ? 'Crear cuenta'
                      : 'Enviar enlace de recuperación'}
              </span>
            </button>
          </form>

          <div className="pt-2 border-t border-[#174C38]/10 flex flex-wrap items-center justify-between gap-2 text-xs">
            {mode !== 'login' ? (
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="min-h-[44px] px-2 font-semibold text-[#174C38] hover:underline"
              >
                Ya tengo cuenta
              </button>
            ) : (
              <button
                type="button"
                onClick={() => switchMode('register')}
                className="min-h-[44px] px-2 font-semibold text-[#174C38] hover:underline"
              >
                Crear cuenta nueva
              </button>
            )}

            {mode !== 'reset' && (
              <button
                type="button"
                onClick={() => switchMode('reset')}
                className="min-h-[44px] px-2 font-medium text-[#B83232] hover:underline"
              >
                ¿Olvidaste tu contraseña?
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
