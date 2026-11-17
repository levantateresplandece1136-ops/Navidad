import React, { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Loader2 } from 'lucide-react';
import { AppView, ChristmasEvent, Reservation, UserProfile, UserRole, Wish } from './types/models';
import { auth, getFriendlyFirebaseError } from './services/firebase';
import {
  consumeGoogleRedirectResult,
  getSavedFreeSession,
  restoreFreeParticipantSession,
  syncAuthenticatedUserProfile,
} from './services/authService';
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
      inviteName: params.get('para') || params.get('inviteName') || '',
    };
  });

  const [showAuthScreen, setShowAuthScreen] = useState(
    () => inviteParams.autostart || Boolean(inviteParams.inviteName)
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

  const hydrateGoogleUser = useCallback(
    async (user: User) => {
      try {
        const profile = await syncAuthenticatedUserProfile(user);
        setCurrentUser(profile);
      } catch (err) {
        notify('error', getFriendlyFirebaseError(err));
      }
    },
    [notify]
  );

  // Handle mobile Google redirect results if popup fell back to redirect
  useEffect(() => {
    void consumeGoogleRedirectResult().catch((err) => {
      notify('error', err instanceof Error ? err.message : 'Error al volver de Google.');
    });
  }, [notify]);

  // Observe Firebase Google Auth AND restore local free-access family session
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        await hydrateGoogleUser(user);
        setAuthReady(true);
        return;
      }

      const freeSession = getSavedFreeSession();
      if (freeSession) {
        try {
          const profile = await restoreFreeParticipantSession(freeSession.uid);
          setCurrentUser(profile);
        } catch (err) {
          notify('error', getFriendlyFirebaseError(err));
          setCurrentUser(null);
        }
      } else {
        setCurrentUser(null);
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, [hydrateGoogleUser, notify]);

  // Real-time Firestore listeners once signed in (either free session or Google)
  useEffect(() => {
    if (!currentUser) {
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
      },
      currentUser.role === UserRole.ADMIN
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
  }, [currentUser?.uid, notify]);

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

  if (!currentUser) {
    if (!showAuthScreen) {
      return (
        <>
          <WelcomeView
            onEnter={() => setShowAuthScreen(true)}
            inviteName={inviteParams.inviteName || undefined}
          />
          <ToastBanner toast={toast} onDismiss={() => setToast(null)} />
        </>
      );
    }

    return (
      <>
        <AuthView
          initialName={inviteParams.inviteName}
          onFreeLogin={(profile) => setCurrentUser(profile)}
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
            userEmail={firebaseUser?.email || ''}
            isAnonymous={!firebaseUser}
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
