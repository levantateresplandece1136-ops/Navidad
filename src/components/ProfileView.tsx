import React, { useEffect, useRef, useState } from 'react';
import { Camera, LogOut, Save, ShieldCheck } from 'lucide-react';
import { UserProfile, UserRole } from '../types/models';
import { FIELD_LIMITS } from '../utils/christmasLogic';
import { uploadAvatarImage } from '../services/storageService';
import { updateOwnProfile } from '../services/userService';
import { logoutUser } from '../services/authService';
import { getFriendlyFirebaseError } from '../services/firebase';
import { AvatarCircle } from './FestiveIllustrations';

interface ProfileViewProps {
  currentUser: UserProfile;
  userEmail: string;
  onOpenAdmin: () => void;
  onNotify: (type: 'success' | 'error', message: string) => void;
}

export function ProfileView({ currentUser, userEmail, onOpenAdmin, onNotify }: ProfileViewProps) {
  const [name, setName] = useState(currentUser.name);
  const [photoURL, setPhotoURL] = useState(currentUser.photoURL || '');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setName(currentUser.name);
    setPhotoURL(currentUser.photoURL || '');
  }, [currentUser.name, currentUser.photoURL]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadAvatarImage(currentUser.uid, file);
      setPhotoURL(url);
      await updateOwnProfile(currentUser.uid, { name, photoURL: url });
      onNotify('success', 'Tu fotografía de perfil se actualizó correctamente.');
    } catch (err) {
      onNotify('error', getFriendlyFirebaseError(err));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      onNotify('error', 'Tu nombre no puede quedar vacío.');
      return;
    }

    setSaving(true);
    try {
      await updateOwnProfile(currentUser.uid, { name: cleanName, photoURL });
      onNotify('success', 'Perfil actualizado.');
    } catch (err) {
      onNotify('error', getFriendlyFirebaseError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <section className="rounded-3xl bg-white border border-[#174C38]/10 shadow-xs p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="relative w-fit">
            <AvatarCircle name={name || currentUser.name} photoURL={photoURL} size="lg" />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              className="hidden"
              id="avatar-upload-input"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              aria-label="Cambiar fotografía de perfil"
              className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-[#174C38] hover:bg-[#103728] text-white flex items-center justify-center shadow-md border-2 border-white transition-colors"
            >
              <Camera className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-1">
            <h1 className="font-display text-2xl sm:text-3xl font-semibold text-[#174C38]">Mi perfil</h1>
            <p className="text-sm text-[#174C38]/75">
              {userEmail || 'Correo verificado'} ·{' '}
              <span className="font-semibold text-[#B83232]">
                {currentUser.role === UserRole.ADMIN ? 'Administrador' : 'Participante'}
              </span>
            </p>
            {uploading && <p className="text-xs font-medium text-[#174C38]">Subiendo nueva fotografía...</p>}
          </div>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-4 pt-2 border-t border-[#174C38]/10">
          <div>
            <label htmlFor="profile-name" className="block text-xs font-semibold text-[#174C38] mb-1.5">
              Nombre visible para tu familia
            </label>
            <input
              id="profile-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={FIELD_LIMITS.NAME_MAX}
              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-[#174C38]/20 bg-[#FFF8ED]/45 text-sm text-[#174C38] focus:outline-none focus:ring-2 focus:ring-[#174C38]/30"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <button
              type="submit"
              disabled={saving || uploading}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#174C38] hover:bg-[#103728] text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Guardando...' : 'Guardar cambios'}</span>
            </button>

            <button
              type="button"
              onClick={() => void logoutUser()}
              className="min-h-[44px] px-4 py-2.5 rounded-xl border border-[#B83232]/25 text-sm font-semibold text-[#B83232] hover:bg-[#B83232] hover:text-white inline-flex items-center gap-2 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Cerrar sesión</span>
            </button>
          </div>
        </form>
      </section>

      {currentUser.role === UserRole.ADMIN && (
        <section className="rounded-3xl bg-white border border-[#D6AD60]/45 shadow-xs p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="font-display text-xl font-semibold text-[#174C38] flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#B83232]" />
              <span>Panel del administrador</span>
            </h2>
            <p className="text-sm text-[#174C38]/75">
              Administra participantes, invitaciones por correo, roles y la fecha del intercambio navideño.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenAdmin}
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#B83232] hover:bg-[#942424] text-white text-sm font-semibold whitespace-nowrap shrink-0 transition-colors"
          >
            Abrir administración
          </button>
        </section>
      )}
    </div>
  );
}
