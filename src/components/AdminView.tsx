import React, { useEffect, useState } from 'react';
import {
  Calendar,
  Check,
  Copy,
  Link2,
  Lock,
  Pencil,
  Save,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { ChristmasEvent, Invitation, InvitationStatus, UserProfile, UserRole } from '../types/models';
import { DEFAULT_EVENT_ID, DEFAULT_EXCHANGE_DATE } from '../utils/christmasLogic';
import { saveEventConfiguration } from '../services/eventService';
import {
  adminCreateInvitation,
  adminRemoveMultipleParticipants,
  adminRemoveParticipant,
  adminRevokeInvitation,
  adminUpdateParticipant,
  subscribeToInvitations,
} from '../services/userService';
import { getFriendlyFirebaseError } from '../services/firebase';
import { AvatarCircle } from './FestiveIllustrations';
import { ConfirmModal } from './ConfirmModal';

interface AdminViewProps {
  currentUser: UserProfile;
  participants: UserProfile[];
  activeEvent: ChristmasEvent | null;
  onNotify: (type: 'success' | 'error', message: string) => void;
}

export function AdminView({ currentUser, participants, activeEvent, onNotify }: AdminViewProps) {
  // Event configuration form
  const [eventName, setEventName] = useState(activeEvent?.name || 'NAVIDAD JUNTOS 2026');
  const [eventYear, setEventYear] = useState(String(activeEvent?.year || 2026));
  const [exchangeDate, setExchangeDate] = useState(activeEvent?.exchangeDate || DEFAULT_EXCHANGE_DATE);
  const [eventActive, setEventActive] = useState(activeEvent ? activeEvent.active : true);
  const [inviteCode, setInviteCode] = useState('');
  const [savingEvent, setSavingEvent] = useState(false);

  // Invitations
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>(UserRole.PARTICIPANT);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Edit participant
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhoto, setEditPhoto] = useState('');
  const [editRole, setEditRole] = useState<UserRole>(UserRole.PARTICIPANT);
  const [editActive, setEditActive] = useState(true);
  const [savingUser, setSavingUser] = useState(false);

  // Delete participant confirmation
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [deletingUser, setDeletingUser] = useState(false);

  // Bulk clear other participants confirmation
  const [confirmClearOthers, setConfirmClearOthers] = useState(false);
  const [clearingOthers, setClearingOthers] = useState(false);

  useEffect(() => {
    if (activeEvent) {
      setEventName(activeEvent.name);
      setEventYear(String(activeEvent.year));
      setExchangeDate(activeEvent.exchangeDate);
      setEventActive(activeEvent.active);
    }
  }, [activeEvent]);

  useEffect(() => {
    const unsub = subscribeToInvitations(
      (list) => setInvitations(list),
      (err) => onNotify('error', getFriendlyFirebaseError(err))
    );
    return () => unsub();
  }, []);

  if (currentUser.role !== UserRole.ADMIN) {
    return (
      <div className="rounded-3xl bg-white border border-[#B83232]/20 p-8 text-center space-y-2">
        <Lock className="w-8 h-8 text-[#B83232] mx-auto" />
        <h1 className="font-display text-2xl font-semibold text-[#174C38]">Acceso exclusivo para administradores</h1>
        <p className="text-sm text-[#174C38]/75">No cuentas con permisos para administrar este evento.</p>
      </div>
    );
  }

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventName.trim() || !exchangeDate) {
      onNotify('error', 'Completa el nombre del evento y la fecha del intercambio.');
      return;
    }
    setSavingEvent(true);
    try {
      await saveEventConfiguration({
        eventId: activeEvent?.eventId || DEFAULT_EVENT_ID,
        name: eventName,
        year: Number(eventYear) || 2026,
        exchangeDate,
        active: eventActive,
        inviteCode,
        existingInviteCodeHash: activeEvent?.inviteCodeHash,
        isNew: !activeEvent,
      });
      setInviteCode('');
      onNotify('success', 'Configuración del evento navideño guardada.');
    } catch (err) {
      onNotify('error', getFriendlyFirebaseError(err));
    } finally {
      setSavingEvent(false);
    }
  };

  const handleCreateInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendingInvite(true);
    try {
      await adminCreateInvitation({
        name: inviteName,
        role: inviteRole,
        adminUid: currentUser.uid,
        eventId: activeEvent?.eventId || DEFAULT_EVENT_ID,
      });
      setInviteName('');
      setInviteRole(UserRole.PARTICIPANT);
      onNotify('success', 'Invitación creada. Copia el enlace y compártelo con tu familiar.');
    } catch (err) {
      onNotify('error', getFriendlyFirebaseError(err));
    } finally {
      setSendingInvite(false);
    }
  };

  const buildInviteUrl = (name?: string) => {
    const base = `${window.location.origin}${window.location.pathname}`;
    return name ? `${base}?para=${encodeURIComponent(name)}` : base;
  };

  const handleCopyGeneralLink = async () => {
    try {
      await navigator.clipboard.writeText(buildInviteUrl());
      setCopiedId('general');
      setTimeout(() => setCopiedId(null), 2000);
      onNotify('success', 'Enlace general copiado. ¡Compártelo con tu familia!');
    } catch {
      onNotify('error', 'No se pudo copiar al portapapeles.');
    }
  };

  const handleCopyInvite = async (inv: Invitation) => {
    const url = buildInviteUrl(inv.name);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(inv.inviteId);
      setTimeout(() => setCopiedId(null), 2000);
      onNotify('success', `Enlace personalizado copiado para ${inv.name}.`);
    } catch {
      onNotify('error', 'No se pudo copiar al portapapeles.');
    }
  };

  const startEditUser = (u: UserProfile) => {
    setEditingUser(u);
    setEditName(u.name);
    setEditPhoto(u.photoURL || '');
    setEditRole(u.role);
    setEditActive(u.active);
  };

  const handleSaveUserEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setSavingUser(true);
    try {
      await adminUpdateParticipant({
        targetUid: editingUser.uid,
        name: editName,
        photoURL: editPhoto,
        role: editRole,
        active: editActive,
        adminUid: currentUser.uid,
      });
      onNotify('success', `Perfil de ${editName} actualizado.`);
      setEditingUser(null);
    } catch (err) {
      onNotify('error', getFriendlyFirebaseError(err));
    } finally {
      setSavingUser(false);
    }
  };

  const handleConfirmDeleteUser = async () => {
    if (!userToDelete) return;
    setDeletingUser(true);
    try {
      await adminRemoveParticipant(userToDelete.uid);
      onNotify('success', `${userToDelete.name} fue eliminado del evento.`);
      setUserToDelete(null);
    } catch (err) {
      onNotify('error', getFriendlyFirebaseError(err));
    } finally {
      setDeletingUser(false);
    }
  };

  const otherParticipants = participants.filter((p) => p.uid !== currentUser.uid);

  const handleConfirmClearOtherParticipants = async () => {
    if (otherParticipants.length === 0) {
      setConfirmClearOthers(false);
      return;
    }
    setClearingOthers(true);
    try {
      const removed = await adminRemoveMultipleParticipants(otherParticipants.map((p) => p.uid));
      onNotify('success', `Se eliminaron ${removed} perfiles de participantes correctamente.`);
      setConfirmClearOthers(false);
    } catch (err) {
      onNotify('error', getFriendlyFirebaseError(err));
    } finally {
      setClearingOthers(false);
    }
  };

  return (
    <div className="space-y-8">
      <section className="rounded-3xl bg-white border border-[#174C38]/10 shadow-xs p-6 sm:p-8 space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#B83232]">
          <ShieldCheck className="w-4 h-4" />
          <span>Administración familiar</span>
        </div>
        <h1 className="font-display text-2xl sm:text-3xl font-semibold text-[#174C38]">
          Panel del administrador
        </h1>
        <p className="text-sm text-[#174C38]/75 max-w-2xl">
          Configura la fecha del intercambio, comparte enlaces de acceso libre para tu familia y gestiona perfiles. Por
          privacidad, nadie —ni siquiera el administrador— puede ver quién reservó los regalos de los demás.
        </p>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Event Settings */}
        <section className="lg:col-span-5 rounded-3xl bg-white border border-[#174C38]/10 shadow-xs p-6 space-y-5 h-fit">
          <div className="flex items-center gap-2.5">
            <Calendar className="w-5 h-5 text-[#B83232]" />
            <h2 className="font-display text-xl font-semibold text-[#174C38]">Evento navideño</h2>
          </div>

          <form onSubmit={handleSaveEvent} className="space-y-4">
            <div>
              <label htmlFor="admin-event-name" className="block text-xs font-semibold text-[#174C38] mb-1.5">
                Nombre de la celebración
              </label>
              <input
                id="admin-event-name"
                type="text"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                maxLength={120}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#174C38]/20 bg-[#FFF8ED]/45 text-sm text-[#174C38]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="admin-event-year" className="block text-xs font-semibold text-[#174C38] mb-1.5">
                  Año
                </label>
                <input
                  id="admin-event-year"
                  type="number"
                  min={2024}
                  max={2100}
                  value={eventYear}
                  onChange={(e) => setEventYear(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#174C38]/20 bg-[#FFF8ED]/45 text-sm text-[#174C38]"
                />
              </div>
              <div>
                <label htmlFor="admin-exchange-date" className="block text-xs font-semibold text-[#174C38] mb-1.5">
                  Fecha del intercambio
                </label>
                <input
                  id="admin-exchange-date"
                  type="date"
                  value={exchangeDate}
                  onChange={(e) => setExchangeDate(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#174C38]/20 bg-[#FFF8ED]/45 text-sm text-[#174C38]"
                />
              </div>
            </div>

            <div>
              <label htmlFor="admin-invite-code" className="block text-xs font-semibold text-[#174C38] mb-1.5">
                Código familiar opcional (para futuras ediciones)
              </label>
              <input
                id="admin-invite-code"
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="Dejar vacío para conservar el actual"
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#174C38]/20 bg-[#FFF8ED]/45 text-sm text-[#174C38]"
              />
            </div>

            <label className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-[#FFF8ED] border border-[#174C38]/12 cursor-pointer">
              <div>
                <span className="block text-sm font-semibold text-[#174C38]">Evento activo</span>
                <span className="block text-xs text-[#174C38]/70">
                  Permite a la familia reservar regalos en secreto
                </span>
              </div>
              <input
                type="checkbox"
                checked={eventActive}
                onChange={(e) => setEventActive(e.target.checked)}
                className="w-5 h-5 accent-[#174C38]"
              />
            </label>

            <button
              type="submit"
              disabled={savingEvent}
              className="w-full min-h-[44px] px-5 py-2.5 rounded-xl bg-[#174C38] hover:bg-[#103728] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              <span>{savingEvent ? 'Guardando...' : 'Guardar configuración'}</span>
            </button>
          </form>
        </section>

        {/* Invite Participants */}
        <section className="lg:col-span-7 rounded-3xl bg-white border border-[#174C38]/10 shadow-xs p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <UserPlus className="w-5 h-5 text-[#B83232]" />
              <h2 className="font-display text-xl font-semibold text-[#174C38]">Invitar familiares (acceso libre)</h2>
            </div>

            <button
              type="button"
              onClick={() => void handleCopyGeneralLink()}
              className="min-h-[40px] px-3.5 py-2 rounded-xl border border-[#174C38]/20 text-xs font-semibold text-[#174C38] hover:bg-[#FFF8ED] inline-flex items-center gap-1.5 transition-colors"
            >
              {copiedId === 'general' ? <Check className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
              <span>Copiar enlace general</span>
            </button>
          </div>

          <form onSubmit={handleCreateInvitation} className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-8">
              <label htmlFor="invite-name" className="block text-xs font-semibold text-[#174C38] mb-1">
                Nombre del familiar *
              </label>
              <input
                id="invite-name"
                type="text"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="Ej. Sandy, Tía Lupita o Carlos"
                className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#174C38]/20 bg-[#FFF8ED]/45 text-sm text-[#174C38]"
              />
            </div>
            <div className="sm:col-span-4">
              <label htmlFor="invite-role" className="block text-xs font-semibold text-[#174C38] mb-1">
                Rol
              </label>
              <select
                id="invite-role"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as UserRole)}
                className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-[#174C38]/20 bg-[#FFF8ED]/45 text-sm text-[#174C38]"
              >
                <option value={UserRole.PARTICIPANT}>Participante</option>
                <option value={UserRole.ADMIN}>Administrador</option>
              </select>
            </div>
            <div className="sm:col-span-12 flex justify-end">
              <button
                type="submit"
                disabled={sendingInvite}
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#B83232] hover:bg-[#942424] text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors disabled:opacity-60"
              >
                <UserPlus className="w-4 h-4" />
                <span>{sendingInvite ? 'Creando...' : 'Crear enlace personalizado'}</span>
              </button>
            </div>
          </form>

          <div className="space-y-2.5 pt-2 border-t border-[#174C38]/10">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#174C38]/65">
              Enlaces creados ({invitations.length})
            </h3>
            {invitations.length === 0 ? (
              <p className="text-sm text-[#174C38]/65 py-2">
                Puedes compartir el enlace general arriba o crear un enlace personalizado con el nombre de cada familiar.
              </p>
            ) : (
              <div className="divide-y divide-[#174C38]/10">
                {invitations.map((inv) => (
                  <div key={inv.inviteId} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#174C38] truncate">{inv.name}</p>
                      <p className="text-xs text-[#174C38]/70 truncate">
                        Acceso libre · {inv.role === UserRole.ADMIN ? 'Administrador' : 'Participante'} ·{' '}
                        {inv.status === InvitationStatus.ACCEPTED ? 'Usada' : 'Lista para compartir'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => void handleCopyInvite(inv)}
                        className="min-h-[38px] px-3 py-1.5 rounded-lg border border-[#174C38]/20 text-xs font-semibold text-[#174C38] hover:bg-[#FFF8ED] inline-flex items-center gap-1.5"
                      >
                        {copiedId === inv.inviteId ? (
                          <Check className="w-3.5 h-3.5 text-[#174C38]" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>Copiar enlace</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void adminRevokeInvitation(inv.inviteId)}
                        aria-label={`Eliminar invitación de ${inv.name}`}
                        className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-lg text-[#B83232] hover:bg-[#B83232]/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Registered Participants */}
      <section className="rounded-3xl bg-white border border-[#174C38]/10 shadow-xs p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Users className="w-5 h-5 text-[#B83232]" />
            <h2 className="font-display text-xl font-semibold text-[#174C38]">
              Participantes registrados ({participants.length})
            </h2>
          </div>

          {otherParticipants.length > 0 && (
            <button
              type="button"
              onClick={() => setConfirmClearOthers(true)}
              className="min-h-[40px] px-3.5 py-2 rounded-xl border border-[#B83232]/25 text-xs font-semibold text-[#B83232] hover:bg-[#B83232] hover:text-white inline-flex items-center gap-1.5 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Limpiar otros perfiles ({otherParticipants.length})</span>
            </button>
          )}
        </div>

        <div className="divide-y divide-[#174C38]/10">
          {participants.map((p) => {
            const isSelf = p.uid === currentUser.uid;
            return (
              <div key={p.uid} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5 min-w-0">
                  <AvatarCircle name={p.name} photoURL={p.photoURL} size="sm" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#174C38] truncate">
                      {p.name} {isSelf ? '(Tú)' : ''}
                    </p>
                    <p className="text-xs text-[#174C38]/70 tabular-nums">
                      {p.role === UserRole.ADMIN ? 'Administrador' : 'Participante'} ·{' '}
                      {p.active ? 'Activo' : 'Inactivo'} · {p.wishesCount} deseos
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => startEditUser(p)}
                    className="min-h-[40px] px-3.5 py-2 rounded-xl border border-[#174C38]/20 text-xs font-semibold text-[#174C38] hover:bg-[#FFF8ED] inline-flex items-center gap-1.5 transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Editar perfil</span>
                  </button>
                  {!isSelf && (
                    <button
                      type="button"
                      onClick={() => setUserToDelete(p)}
                      className="min-h-[40px] px-3.5 py-2 rounded-xl border border-[#B83232]/25 text-xs font-semibold text-[#B83232] hover:bg-[#B83232] hover:text-white inline-flex items-center gap-1.5 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Eliminar</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Edit participant modal */}
      {editingUser && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#103728]/55 backdrop-blur-xs p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-participant-title"
        >
          <form
            onSubmit={handleSaveUserEdit}
            className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-xl border border-[#174C38]/12 p-6 space-y-4"
          >
            <h3 id="edit-participant-title" className="font-display text-xl font-semibold text-[#174C38]">
              Editar participante
            </h3>

            <div>
              <label htmlFor="edit-p-name" className="block text-xs font-semibold text-[#174C38] mb-1">
                Nombre
              </label>
              <input
                id="edit-p-name"
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#174C38]/20 text-sm text-[#174C38]"
              />
            </div>

            <div>
              <label htmlFor="edit-p-photo" className="block text-xs font-semibold text-[#174C38] mb-1">
                URL de fotografía (opcional)
              </label>
              <input
                id="edit-p-photo"
                type="url"
                value={editPhoto}
                onChange={(e) => setEditPhoto(e.target.value)}
                placeholder="https://..."
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#174C38]/20 text-sm text-[#174C38]"
              />
            </div>

            <div>
              <label htmlFor="edit-p-role" className="block text-xs font-semibold text-[#174C38] mb-1">
                Rol
              </label>
              <select
                id="edit-p-role"
                value={editRole}
                onChange={(e) => setEditRole(e.target.value as UserRole)}
                disabled={editingUser.uid === currentUser.uid}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-[#174C38]/20 text-sm text-[#174C38] disabled:opacity-60"
              >
                <option value={UserRole.PARTICIPANT}>Participante</option>
                <option value={UserRole.ADMIN}>Administrador</option>
              </select>
            </div>

            <label className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#FFF8ED] border border-[#174C38]/12 cursor-pointer">
              <span className="text-sm font-medium text-[#174C38]">Participante activo</span>
              <input
                type="checkbox"
                checked={editActive}
                onChange={(e) => setEditActive(e.target.checked)}
                disabled={editingUser.uid === currentUser.uid}
                className="w-5 h-5 accent-[#174C38]"
              />
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                disabled={savingUser}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-[#174C38]/20 text-sm font-medium text-[#174C38]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={savingUser}
                className="min-h-[44px] px-5 py-2 rounded-xl bg-[#174C38] text-white text-sm font-semibold"
              >
                {savingUser ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmModal
        open={Boolean(userToDelete)}
        title="Eliminar participante"
        message={
          userToDelete
            ? `¿Seguro que deseas eliminar a ${userToDelete.name} y sus deseos publicados? Ya no aparecerá en el directorio familiar.`
            : ''
        }
        confirmLabel="Sí, eliminar"
        variant="danger"
        loading={deletingUser}
        onConfirm={handleConfirmDeleteUser}
        onCancel={() => setUserToDelete(null)}
      />

      <ConfirmModal
        open={confirmClearOthers}
        title="Limpiar otros perfiles"
        message={`¿Seguro que deseas eliminar los ${otherParticipants.length} perfiles de otros participantes y sus deseos publicados? Tu perfil de administrador se conservará intacto.`}
        confirmLabel="Sí, limpiar perfiles"
        variant="danger"
        loading={clearingOthers}
        onConfirm={handleConfirmClearOtherParticipants}
        onCancel={() => setConfirmClearOthers(false)}
      />
    </div>
  );
}
