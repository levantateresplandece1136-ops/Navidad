import React, { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Loader2 } from 'lucide-react';
import { AppView, ChristmasEvent, Reservation, UserProfile, Wish } from './types/models';
import { auth, getFriendlyFirebaseError } from './services/firebase';
import { syncAuthenticatedUserProfile } from './services/authService';
import { subscribeToActiveEvent } from './services/eventService';
import { subscribeToParticipants } from './services/userService';
import { subscribeToMyReservations } from './services/reservationService';
import { createWish, updateWish } from './services/wishService';
import { DEFAULT_EVENT_ID, WishFormInput } from './utils/christmasLogic';
import { WelcomeView } from './components/WelcomeView';
import { AuthView } from './components/AuthView';
import { TopNav } from './components/TopNav';
import { BottomNav } from './components/BottomNav';
import { DashboardView } from './components/DashboardView';
import { WishlistView } from './components/WishlistView';
import { ReservationsView } from './components/ReservationsView';
import { ProfileView } from './components/ProfileView';
import { AdminView } from './components/AdminView';
import { WishFormModal } from './components/WishFormModal';
import { ToastBanner, ToastState } from './components/ToastBanner';

export default function App() {
  const [authReady, setAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);

  const [inviteParams] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      autostart: params.get('autostart') === '1',
      inviteEmail: params.get('invite') || '',
    };
  });

  const [showAuthScreen, setShowAuthScreen] = useState(
    () => inviteParams.autostart || Boolean(inviteParams.inviteEmail)
  );

  const [activeView, setActiveView] = useState<AppView>('dashboard');
  const [selectedWishlistUid, setSelectedWishlistUid] = useState<string | null>(null);

  const [activeEvent, setActiveEvent] = useState<ChristmasEvent | null>(null);
  const [participants, setParticipants] = useState<UserProfile[]>([]);
  const [participantsLoading, setParticipantsLoading] = useState(true);
  const [myReservations, setMyReservations] = useState<Reservation[]>([]);
  const [reservationsLoading, setReservationsLoading] = useState(true);

  const [wishModalOpen, setWishModalOpen] = useState(false);
  const [editingWish, setEditingWish] = useState<Wish | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const notify = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const hydrateUserProfile = useCallback(
    async (user: User) => {
      if (!user.emailVerified) {
        setCurrentUser(null);
        return;
      }
      try {
        const profile = await syncAuthenticatedUserProfile(user);
        setCurrentUser(profile);
      } catch (err) {
        notify('error', getFriendlyFirebaseError(err));
      }
    },
    [notify]
  );

  // Auth state observer (Email/Password + Google with emailVerified check)
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user && user.emailVerified) {
        await hydrateUserProfile(user);
      } else {
        setCurrentUser(null);
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, [hydrateUserProfile]);

  // Real-time Firestore listeners once authenticated and email-verified
  useEffect(() => {
    if (!currentUser || !firebaseUser || !firebaseUser.emailVerified) {
      setParticipants([]);
      setMyReservations([]);
      setActiveEvent(null);
      return;
    }

    setParticipantsLoading(true);
    setReservationsLoading(true);

    const unsubEvent = subscribeToActiveEvent(
      (ev) => setActiveEvent(ev),
      (err) => notify('error', getFriendlyFirebaseError(err))
    );

    const unsubParticipants = subscribeToParticipants(
      (list) => {
        setParticipants(list);
        const me = list.find((u) => u.uid === currentUser.uid);
        if (me) setCurrentUser(me);
        setParticipantsLoading(false);
      },
      (err) => {
        setParticipantsLoading(false);
        notify('error', getFriendlyFirebaseError(err));
      }
    );

    const unsubReservations = subscribeToMyReservations(
      currentUser.uid,
      (list) => {
        setMyReservations(list);
        setReservationsLoading(false);
      },
      (err) => {
        setReservationsLoading(false);
        notify('error', getFriendlyFirebaseError(err));
      }
    );

    return () => {
      unsubEvent();
      unsubParticipants();
      unsubReservations();
    };
  }, [currentUser?.uid, firebaseUser?.uid, firebaseUser?.emailVerified]);

  const handleNavigate = (view: AppView) => {
    if (view === 'wishlist' && currentUser) {
      setSelectedWishlistUid(currentUser.uid);
    }
    setActiveView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectParticipant = (uid: string) => {
    setSelectedWishlistUid(uid);
    setActiveView('wishlist');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenAddWish = () => {
    setEditingWish(null);
    setWishModalOpen(true);
  };

  const handleOpenEditWish = (wish: Wish) => {
    setEditingWish(wish);
    setWishModalOpen(true);
  };

  const handleSaveWish = async (input: WishFormInput, existingWishId?: string) => {
    if (!currentUser) return;
    try {
      if (existingWishId) {
        await updateWish(existingWishId, currentUser.uid, input);
        notify('success', 'Tu deseo se actualizó correctamente.');
      } else {
        await createWish(currentUser.uid, input, activeEvent?.eventId || DEFAULT_EVENT_ID);
        notify('success', '¡Deseo agregado a tu lista navideña!');
      }
    } catch (err) {
      throw new Error(getFriendlyFirebaseError(err));
    }
  };

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#FFF8ED] flex flex-col items-center justify-center gap-3 text-[#174C38]">
        <Loader2 className="w-8 h-8 animate-spin text-[#B83232]" />
        <p className="font-display text-lg">Preparando nuestra Navidad...</p>
      </div>
    );
  }

  const pendingVerificationUser = firebaseUser && !firebaseUser.emailVerified ? firebaseUser : null;

  if (!firebaseUser || pendingVerificationUser || !currentUser) {
    if (!showAuthScreen && !pendingVerificationUser) {
      return (
        <>
          <WelcomeView
            onEnter={() => setShowAuthScreen(true)}
            inviteEmail={inviteParams.inviteEmail || undefined}
          />
          <ToastBanner toast={toast} onDismiss={() => setToast(null)} />
        </>
      );
    }

    return (
      <>
        <AuthView
          initialEmail={inviteParams.inviteEmail}
          pendingVerificationUser={pendingVerificationUser}
          onVerificationConfirmed={hydrateUserProfile}
          onBackToWelcome={() => setShowAuthScreen(false)}
        />
        <ToastBanner toast={toast} onDismiss={() => setToast(null)} />
      </>
    );
  }

  const targetWishlistOwner =
    participants.find((p) => p.uid === (selectedWishlistUid || currentUser.uid)) || currentUser;

  return (
    <div className="min-h-screen bg-[#FFF8ED] text-[#174C38] flex flex-col">
      <TopNav
        activeView={activeView}
        userRole={currentUser.role}
        onNavigate={handleNavigate}
        onAddWish={handleOpenAddWish}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-24 md:pb-12">
        {activeView === 'dashboard' && (
          <DashboardView
            currentUser={currentUser}
            participants={participants}
            activeEvent={activeEvent}
            loading={participantsLoading}
            onSelectParticipant={handleSelectParticipant}
            onAddWish={handleOpenAddWish}
          />
        )}

        {activeView === 'wishlist' && (
          <WishlistView
            owner={targetWishlistOwner}
            currentUser={currentUser}
            activeEvent={activeEvent}
            myReservations={myReservations}
            onBack={() => handleNavigate('dashboard')}
            onAddWish={handleOpenAddWish}
            onEditWish={handleOpenEditWish}
            onNotify={notify}
          />
        )}

        {activeView === 'reservations' && (
          <ReservationsView
            currentUid={currentUser.uid}
            reservations={myReservations}
            loading={reservationsLoading}
            onExploreFamily={() => handleNavigate('dashboard')}
            onNotify={notify}
          />
        )}

        {activeView === 'profile' && (
          <ProfileView
            currentUser={currentUser}
            userEmail={firebaseUser.email || ''}
            onOpenAdmin={() => handleNavigate('admin')}
            onNotify={notify}
          />
        )}

        {activeView === 'admin' && (
          <AdminView
            currentUser={currentUser}
            participants={participants}
            activeEvent={activeEvent}
            onNotify={notify}
          />
        )}
      </main>

      <BottomNav activeView={activeView} onNavigate={handleNavigate} />

      <WishFormModal
        open={wishModalOpen}
        uid={currentUser.uid}
        initialWish={editingWish}
        onSave={handleSaveWish}
        onClose={() => {
          setWishModalOpen(false);
          setEditingWish(null);
        }}
      />

      <ToastBanner toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
