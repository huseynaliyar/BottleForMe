'use client';

import { useLanguage } from '@/lib/language-context';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { User as AuthUser } from '@supabase/supabase-js';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ReportPickup from '@/components/ReportPickup';
import PickupPhoto from '@/components/PickupPhoto';
import PickupPartner from '@/components/PickupPartner';
import ImpactAchievement from '@/components/ImpactAchievement';
import { loadAccountLifecycle } from '@/components/AccountLifecycleSettings';
import { useAccountLifecycle } from '@/lib/use-account-lifecycle';
import { readPickupPhoto } from '@/lib/read-pickup-photo';
import { usePickupFavorites } from '@/lib/use-pickup-favorites';
import GettingStarted from '@/components/GettingStarted';
import {
  Package, Compass, MessageSquare, User, MapPin, Camera, ArrowRight,
  Check, Bell, LogOut, Wallet, CircleHelp, Settings,
} from 'lucide-react';
import { MALTA_LOCALITIES, calculateDepositSplit, PickupOffer, PickupStatus, UserProfile, NotificationItem } from '@/lib/types';
import { MAX_BAGS, MAX_CONTAINERS, MAX_SELLER_SPLIT, REVOLUT_TAG, validatePickup } from '@/lib/pickup-validation';
import { loadProfile, pickupRequest, saveProfile, signOutFromSupabase } from '@/lib/auth';
import { AvailabilityEditor, EditPickupAvailability, PickupArrangements, PickupAvailability, RequestPickupTime } from '@/components/PickupSchedule';
import { formatAppointment, newWindow, parseWindowDrafts } from '@/lib/pickup-schedule';
import PickupAddressField from '@/components/PickupAddressField';
import { nearbyStreets } from '@/lib/nearby-streets';
import { pickupAddressText, type AddressSuggestion } from '@/lib/pickup-address';
import { readAvatar } from '@/lib/avatar';
import { supabase } from '@/lib/supabase';
import AuthModal from '@/components/AuthModal';
import ContainerCounter, { parseCount } from '@/components/ContainerCounter';
import NotificationModal from '@/components/NotificationModal';
import { bagPolicies, bagPolicyLabel, isBagPolicy } from '@/lib/bag-policy';
import { pickupRestriction, type PickupRestriction } from '@/lib/pickup-restriction';
import { pickupStatusCss } from '@/lib/pickup-status';
import PickupConversationCard from '@/components/PickupConversationCard';
import PickupChat, { usePickupUnread } from '@/components/PickupChat';
import { useMarketplaceStatus } from '@/lib/use-marketplace-status';
import { useInbox } from '@/lib/use-inbox';
import { disableBrowserPush } from '@/lib/browser-push';

const RadarMap = dynamic(() => import('@/components/RadarMap'), {
  ssr: false,
  loading: () => <p role="status" className="p-4 text-sm text-blue-300">Loading Radar map…</p>,
});

const pickupStatus: Record<PickupStatus, string> = {
  open: 'Awaiting a Taker', reserved: 'Confirmed', en_route: 'Taker on the way',
  arrived: 'Taker arrived', completed: 'Completed', cancelled: 'Cancelled',
};

function UnreadBadge({ count }: { count?: number }) {
  if (!count) return null;
  return <span aria-label={count + ' unread messages'} className="ml-1 inline-grid min-w-5 place-items-center rounded-full bg-blue-600 px-1 text-xs text-white">
    {count > 99 ? '99+' : count}
  </span>;
}

function loadFavorites(signal: AbortSignal) {
  return pickupRequest('/favorites', { signal });
}

function saveFavorite(pickupId: string, saved: boolean) {
  return pickupRequest('/favorites', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pickupId, saved }),
  });
}

type Tab = 'resident' | 'driver' | 'chat' | 'profile';

export default function Marketplace({ initialPickup, initialChat = false }: { initialPickup?: string; initialChat?: boolean }) {
  const { t } = useLanguage();
  const maintenance = useMarketplaceStatus();
  const router = useRouter();
  const [requestedTab, setRequestedTab] = useState<Tab>(initialPickup ? 'chat' : 'resident');
  const setActiveTab = useCallback((tab: Tab) => {
    setRequestedTab(tab);
    if (initialPickup) router.replace(tab === 'profile' ? '/?view=profile' : tab === 'chat' ? '/?view=pickups' : '/');
  }, [initialPickup, router]);
  const [sessionUser, setSessionUser] = useState<AuthUser | null>(null);
  const lifecycle = useAccountLifecycle(sessionUser?.id, loadAccountLifecycle).lifecycle;
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [sessionNotifications, setNotifications] = useState<NotificationItem[]>([]);
  const [radarView, setRadarView] = useState<'list' | 'map'>('map');
  const [mapOfferId, setMapOfferId] = useState<string | null>(null);
  const [radarLocality, setRadarLocality] = useState('');
  const [plasticCount, setPlasticCount] = useState('0');
  const [canCount, setCanCount] = useState('0');
  const [glassCount, setGlassCount] = useState('0');
  const [bags, setBags] = useState(0);
  const [bagPolicy, setBagPolicy] = useState('');
  const [listingPhoto, setListingPhoto] = useState('');
  const [listingPhotoError, setListingPhotoError] = useState('');
  const [readingListingPhoto, setReadingListingPhoto] = useState(false);
  const photoSelection = useRef(0);
  const [splitPercent, setSplitPercent] = useState(50);
  const [locality, setLocality] = useState('');
  const [revolutTag, setRevolutTag] = useState('');
  const [addressNotes, setAddressNotes] = useState('');
  const [pickupAddress, setPickupAddress] = useState('');
  const [addressSelection, setAddressSelection] = useState<AddressSuggestion | null>(null);
  const [addressLookup, setAddressLookup] = useState(false);
  const [payoutMethod, setPayoutMethod] = useState<'revolut' | 'cash'>('cash');
  const [offers, setOffers] = useState<PickupOffer[]>([]);
  const [radarStatus, setRadarStatus] = useState('Loading Radar…');
  const canUseRadar = currentUser?.role === 'taker';
  const activeTab = requestedTab === 'resident' && canUseRadar ? 'driver'
    : requestedTab === 'driver' && !canUseRadar ? 'resident' : requestedTab;
  const radarDetails = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = radarDetails.current;
    if (dialog && mapOfferId && !dialog.open) dialog.showModal();
    if (dialog?.open && !mapOfferId) dialog.close();
  }, [mapOfferId, radarView, activeTab]);
  const fullscreenRadar = activeTab === 'driver' && canUseRadar && radarView === 'map';
  const [handoverCode, setHandoverCode] = useState<{ id: string; value: string }>();
  const [typedCode, setTypedCode] = useState<{ id: string; value: string }>();
  const [handovers, setHandovers] = useState<PickupOffer[]>([]);
  const [handoverStatus, setHandoverStatus] = useState('Loading your pickups…');
  const [selectedId, setSelectedId] = useState<string | null>(initialPickup ?? null);
  const [chatPickupId, setChatPickupId] = useState<string | null>(initialChat ? initialPickup ?? null : null);
  const [revision, setRevision] = useState(0);
  const [isPublishing, setIsPublishing] = useState(false);
  const [triedToPublish, setTriedToPublish] = useState(false);
  const [availabilityDraft, setAvailabilityDraft] = useState(() => [newWindow()]);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isPinningLocation, setIsPinningLocation] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [restriction, setRestriction] = useState<PickupRestriction>();
  const restrictionDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = restrictionDialog.current;
    if (restriction && !dialog?.open) dialog?.showModal();
    if (!restriction && dialog?.open) dialog.close();
  }, [restriction]);
  const [actionError, setActionError] = useState('');
  const actionInProgress = useRef(false);
  const publishRequest = useRef<{ id: string; body: string } | null>(null);
  const accountId = currentUser?.id;
  const [showArchived, setShowArchived] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [savedOnly, setSavedOnly] = useState(false);
  const [report, setReport] = useState<{ pickupId: string; target: 'listing' | 'user' }>();
  const favorites = usePickupFavorites(canUseRadar && activeTab === 'driver' ? accountId : undefined, loadFavorites, saveFavorite);
  const radarOffers = savedOnly ? offers.filter((offer) => favorites.ids?.includes(offer.id)) : offers;
  const sessionId = useRef<string | null>(null);
  const inbox = useInbox(supabase, sessionUser?.id, isNotifOpen);
  const { unread, refresh: refreshUnread } = usePickupUnread(accountId);
  const unreadCounts = new Map(unread.map((item) => [item.pickup_id, item.unread]));
  const chatNotifications: (NotificationItem & { pickupChat: boolean })[] = unread.map((item) => ({
    id: 'chat:' + item.pickup_id, pickupId: item.pickup_id, pickupChat: true,
    title: 'New pickup message', message: item.unread + (item.unread === 1 ? ' unread message' : ' unread messages'),
    timestamp: new Date(item.last_message).toLocaleString(), read: false, type: 'system',
  }));
  const notifications = [...chatNotifications, ...inbox.notifications.map((item) => ({
    ...item, message: item.message === 'Open Handover in BottleForMe to see the pickup arrangement.'
      ? 'Open Pickups in BottleForMe to see the pickup arrangement.' : item.message,
  })), ...sessionNotifications];

  const openActivity = useCallback((pickupId?: string, chat = false) => {
    if (pickupId && /^[0-9a-f-]{36}$/i.test(pickupId)) {
      setIsNotifOpen(false);
      if (initialPickup === pickupId && initialChat === chat) return;
      router.push('/pickups/' + encodeURIComponent(pickupId) + (chat ? '?chat=1' : ''));
      setRevision((value) => value + 1);
    } else setIsNotifOpen(true);
  }, [initialPickup, initialChat, router]);

  useEffect(() => {
    const openInbox = (event: MessageEvent) => {
      if (event.data?.type === 'bottleforme-open-inbox') openActivity(event.data.pickupId, event.data.pickupChat === true);
    };
    const serviceWorker = navigator.serviceWorker;
    serviceWorker?.addEventListener('message', openInbox);
    const url = new URL(window.location.href);
    const pickup = url.searchParams.get('pickup');
    const chat = url.searchParams.get('chat') === '1';
    if (pickup || url.searchParams.get('inbox') === '1') {
      url.searchParams.delete('pickup');
      url.searchParams.delete('inbox');
      url.searchParams.delete('chat');
      window.history.replaceState(window.history.state, '', url);
      queueMicrotask(() => openActivity(pickup ?? undefined, chat));
    } else if (url.searchParams.get('view') === 'profile') {
      queueMicrotask(() => setRequestedTab('profile'));
    } else if (url.searchParams.get('view') === 'pickups') {
      queueMicrotask(() => setRequestedTab('chat'));
    }
    return () => serviceWorker?.removeEventListener('message', openInbox);
  }, [openActivity]);

  useEffect(() => {
    try { localStorage.removeItem('bottleforme_current_user'); } catch { /* Storage may be disabled. */ }
    if (!supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const id = session?.user.id ?? null;
      const previousId = sessionId.current;
      if (id !== previousId) {
        sessionId.current = id;
        setSessionUser(session?.user ?? null);
        setCurrentUser(null);
        setHandovers([]);
        setOffers([]);
        setSavedOnly(false);
        setShowArchived(false);
        setReport(undefined);
        if (previousId) { setSelectedId(null); setChatPickupId(null); }
        setHandoverCode(undefined);
        setTypedCode(undefined);
        setNotifications([]);
        publishRequest.current = null;
        if (previousId) {
          setRevolutTag('');
          setAddressNotes('');
          setPickupAddress('');
          setAddressSelection(null);
          setLocality('');
          setPlasticCount('0');
          setCanCount('0');
          setGlassCount('0');
          setBagPolicy('');
          photoSelection.current += 1;
          setListingPhoto('');
          setListingPhotoError('');
          setReadingListingPhoto(false);
          setBags(0);
          setSplitPercent(50);
          setPayoutMethod('cash');
          setTriedToPublish(false);
          setAvailabilityDraft([newWindow()]);
        }
      }
      if (event === 'PASSWORD_RECOVERY') {
        setRecovery(true);
        setIsAuthOpen(true);
      }
      if (event === 'SIGNED_OUT') setRecovery(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!sessionUser) return;
    let active = true;
    loadProfile(sessionUser).then((user) => {
      if (active && sessionId.current === user.id) {
        setCurrentUser(user);
        setLocality((value) => value || user.locality);
        setRevolutTag((value) => value || user.revolut_tag);
      }
    }).catch(() => { if (active) setActionError('Could not load your profile. Try signing in again.'); });
    return () => { active = false; };
  }, [sessionUser]);

  useEffect(() => {
    if (activeTab !== 'driver' || !canUseRadar) return;
    const controller = new AbortController();
    pickupRequest(radarLocality ? '?locality=' + encodeURIComponent(radarLocality) : '', { signal: controller.signal })
      .then((payload) => {
        if (controller.signal.aborted) return;
        setOffers(payload.offers);

        setRadarStatus(payload.offers.length ? '' : 'No open listings in this area.');
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setOffers([]);

        setRadarStatus('Radar is unavailable. Try refreshing.');
      });
    return () => controller.abort();
  }, [accountId, activeTab, canUseRadar, radarLocality, revision]);

  useEffect(() => {
    if (!accountId || (activeTab !== 'chat' && activeTab !== 'profile')) return;
    const controller = new AbortController();
    const refreshPickups = () => pickupRequest('?mine=true', { signal: controller.signal }).then((payload) => {
      if (controller.signal.aborted || sessionId.current !== accountId) return;
      setHandovers(payload.offers);
      setHandoverStatus('');
    }).catch(() => {
      if (!controller.signal.aborted) setHandoverStatus('Could not load your pickups.');
    });
    void refreshPickups();
    const timer = activeTab === 'chat' ? window.setInterval(refreshPickups, 30_000) : undefined;
    return () => { window.clearInterval(timer); controller.abort(); };
  }, [accountId, activeTab, revision]);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/addresses', { signal: controller.signal }).then((response) => response.ok ? response.json() : null)
      .then((settings) => { if (!controller.signal.aborted) setAddressLookup(settings?.enabled === true); })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const plastic = parseCount(plasticCount);
  const cans = parseCount(canCount);
  const glass = parseCount(glassCount);
  const { totalContainers, totalDepositValue, sellerPayout, collectorProfit } = calculateDepositSplit(
    plastic ?? 0, cans ?? 0, glass ?? 0, splitPercent,
  );
  const countsValid = plastic !== null && cans !== null && glass !== null && totalContainers <= MAX_CONTAINERS;
  const needsRevolutTag = payoutMethod === 'revolut' && sellerPayout > 0;
  const countError = !countsValid ? 'Enter whole counts with up to 10,000 containers in total.'
    : totalContainers === 0 ? 'Add at least one eligible container.' : '';
  const localityError = locality ? '' : 'Choose a pickup locality.';
  const fullAddress = pickupAddressText(pickupAddress, addressNotes);
  const addressError = !pickupAddress.trim() ? 'Enter your pickup address.'
    : addressLookup && accountId && !addressSelection ? 'Choose an address from the Google Maps suggestions.'
      : fullAddress.length > 300 ? 'Use at most 300 characters for the address and instructions.' : '';
  const revolutError = needsRevolutTag && !REVOLUT_TAG.test(revolutTag.trim()) ? 'Enter a valid Revolut tag.' : '';
  const availability = parseWindowDrafts(availabilityDraft);
  const publishErrors = [countError, localityError, addressError, revolutError, !listingPhoto ? 'Add a photo of the bottles or bags.' : '', bags < 1 ? 'Specify the number of bags.' : '',
    !isBagPolicy(bagPolicy) ? 'Choose what happens to the bags.' : '',
    availability ? '' : 'Add future, non-overlapping pickup windows in Malta time.'].filter(Boolean);
  const pickupParticipant = canUseRadar ? 'collector_id' : 'seller_id';
  const rolePickups = handovers.filter((offer) => offer[pickupParticipant] === accountId);
  const visiblePickups = canUseRadar ? rolePickups : rolePickups.filter((offer) => !!offer.archived_at === showArchived);
  const completedPickups = handovers.filter((offer) => offer.status === 'completed');
  const recycledContainers = completedPickups.reduce((count, offer) => count + offer.estimated_bottles, 0);
  const selectedOffer = rolePickups.find((offer) => offer.id === selectedId);
  const selectedInOtherRole = !selectedOffer && handovers.some((offer) => offer.id === selectedId);
  const isCollector = Boolean(currentUser && selectedOffer?.collector_id === currentUser.id);
  const handoverActive = selectedOffer && ['reserved', 'en_route', 'arrived'].includes(selectedOffer.status);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => setToastMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  const [streets, setStreets] = useState<string[]>([]);
  const [gpsStreet, setGpsStreet] = useState('');

  function handlePinLocation() {
    setStreets([]);
    setGpsStreet('');
    if (!navigator.geolocation) {
      setActionError('Location is unavailable. Choose your locality manually.');
      return;
    }
    setActionError('');
    setIsPinningLocation(true);
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      const distance = (item: typeof MALTA_LOCALITIES[number]) => Math.hypot(item.lat - coords.latitude, item.lng - coords.longitude);
      const nearest = MALTA_LOCALITIES.reduce((best, item) => distance(item) < distance(best) ? item : best);
      setLocality(nearest.name);
      nearbyStreets('', coords.latitude, coords.longitude).then((names) => {
        setStreets(names);
        setToastMessage(names.length ? 'Choose a nearby street, then edit the address below.' : 'No nearby streets found. Enter your street manually.');
      }).catch(() => setActionError('Could not look up nearby streets. Enter your street manually.'))
        .finally(() => setIsPinningLocation(false));
    }, () => {
      setActionError('Could not get your location. Choose your locality manually.');
      setIsPinningLocation(false);
    }, { timeout: 7000 });
  }

  async function chooseListingPhoto(file: File) {
    const selection = ++photoSelection.current;
    setListingPhotoError('');
    setReadingListingPhoto(true);
    try {
      const photo = await readPickupPhoto(file);
      if (photoSelection.current === selection) setListingPhoto(photo);
    } catch (cause) {
      if (photoSelection.current === selection) setListingPhotoError(cause instanceof Error ? cause.message : 'Could not open that photo.');
    } finally {
      if (photoSelection.current === selection) setReadingListingPhoto(false);
    }
  }

  async function handlePublishOffer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (actionInProgress.current) return;
    setActionError('');
    setTriedToPublish(true);
    if (publishErrors.length || readingListingPhoto || !availability) return;
    const input = {
      locality, address_notes: fullAddress, bag_count: bags, bag_policy: bagPolicy, split_percentage: splitPercent,
      pickup_address: pickupAddress.trim(), address_proof: addressSelection?.proof, availability,
      payout_method: payoutMethod, seller_revolut_tag: revolutTag, photo: listingPhoto,
      containers: { plastic_bottles: plastic, cans, glass_bottles: glass },
    };
    if (!validatePickup(input)) {
      setActionError('Enter 1–10,000 eligible containers, select a locality and check the pickup and payment details.');
      return;
    }
    if (!accountId) { setIsAuthOpen(true); return; }
    actionInProgress.current = true;
    setIsPublishing(true);
    try {
      const body = JSON.stringify(input);
      if (publishRequest.current?.body !== body) publishRequest.current = { body, id: crypto.randomUUID() };
      const created: PickupOffer = await pickupRequest('', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': publishRequest.current.id },
        body,
      });
      if (sessionId.current !== accountId) return;
      publishRequest.current = null;
      setTriedToPublish(false);
      setAvailabilityDraft([newWindow()]);
      setPlasticCount('0');
      setCanCount('0');
      setGlassCount('0');
      setBags(0);
      setBagPolicy('');
      setListingPhoto('');
      setListingPhotoError('');
      setAddressNotes('');
      setPickupAddress('');
      setAddressSelection(null);
      setRadarLocality('');
      setRevision((value) => value + 1);
      setActiveTab('chat');
      setSelectedId(created.id);
      setNotifications((items) => [{
        id: created.id, title: 'Listing published', message: `${created.estimated_bottles} eligible containers in ${created.locality}.`,
        timestamp: 'Just now', read: false, type: 'pickup',
      }, ...items]);
      setToastMessage('Listing published to Radar.');
    } catch (error) {
      if (sessionId.current === accountId) setActionError(error instanceof Error ? error.message : 'Could not publish the listing.');
    } finally {
      actionInProgress.current = false;
      setIsPublishing(false);
    }
  }

  async function revealHandoverCode(id: string) {
    const account = accountId;
    setActionError('');
    try {
      const { code } = await pickupRequest('/' + encodeURIComponent(id) + '/code', { method: 'POST' });
      if (sessionId.current === account) setHandoverCode({ id, value: code });
    } catch (error) {
      if (sessionId.current === account) setActionError(error instanceof Error ? error.message : 'Could not show the code.');
    }
  }

  async function toggleArchive(offer: PickupOffer) {
    if (archiving) return;
    setArchiving(true);
    setActionError('');
    try {
      const updated = await pickupRequest('/archive', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pickupId: offer.id, archived: !offer.archived_at }),
      });
      if (sessionId.current === accountId) {
        setHandovers((items) => items.map((item) => item.id === offer.id ? { ...item, archived_at: updated.archived_at } : item));
        setRevision((value) => value + 1);
      }
    } catch (cause) {
      if (sessionId.current === accountId) setActionError(cause instanceof Error ? cause.message : 'Could not update the archive.');
    } finally { setArchiving(false); }
  }

  async function changePickup(offer: PickupOffer, status: PickupStatus, code?: string) {
    if (actionInProgress.current) return;
    setActionError('');
    if (!accountId) { setIsAuthOpen(true); return; }
    if (status === 'reserved' && !canUseRadar) { setActionError('Switch to Taker to reserve pickups.'); return; }
    actionInProgress.current = true;
    setIsUpdating(true);
    try {
      const updated: PickupOffer = await pickupRequest('/' + encodeURIComponent(offer.id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, code }),
      });
      if (sessionId.current !== accountId) return;
      setHandovers((items) => [updated, ...items.filter((item) => item.id !== updated.id)]);
      setSelectedId(updated.id);
      setRequestedTab('chat');
      setToastMessage(status === 'completed' ? 'Handover recorded.' : status === 'reserved' ? 'Pickup reserved.' : 'Pickup updated.');
    } catch (error) {
      if (sessionId.current === accountId) {
        const blocked = pickupRestriction(error);
        if (blocked) setRestriction(blocked);
        else setActionError(error instanceof Error ? error.message : 'Could not update the pickup.');
      }
    } finally {
      actionInProgress.current = false;
      setIsUpdating(false);
      setRevision((value) => value + 1);
    }
  }

  async function handleAvatarUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !currentUser) return;
    try {
      const avatar_url = await readAvatar(file);
      await saveProfile(currentUser, { avatar_url });
      if (sessionId.current !== accountId) return;
      setCurrentUser((user) => user ? { ...user, avatar_url } : user);
      setToastMessage('Profile photo updated.');
    } catch (error) {
      if (sessionId.current === accountId) setActionError(error instanceof Error ? error.message : 'Could not update your photo.');
    }
  }

  async function handleToggleRole(keepPickupOpen = false) {
    if (!currentUser) { setIsAuthOpen(true); return; }
    const role = currentUser.role === 'giver' ? 'taker' : 'giver';
    try {
      await saveProfile(currentUser, { role });
      if (sessionId.current !== accountId) return;
      setCurrentUser((user) => user ? { ...user, role } : user);
      if (!keepPickupOpen) {
        setSelectedId(null);
        setChatPickupId(null);
        setActiveTab(role === 'giver' ? 'resident' : 'driver');
      }
    } catch {
      setActionError('Could not change your role.');
    }
  }

  async function handleSignOut() {
    try {
      await disableBrowserPush().catch(() => {});
      await signOutFromSupabase();
      setToastMessage('Signed out.');
    } catch {
      setActionError('Could not sign out. Try again.');
    }
  }

  const RadarResults = fullscreenRadar ? 'dialog' : 'div';
  const unreadNotifCount = notifications.filter((n) => !n.read).length;
  const conversationOffer = currentUser && activeTab === 'chat' && chatPickupId === selectedId &&
    selectedOffer?.seller_id && selectedOffer.collector_id ? selectedOffer : undefined;

  return (
    <div className={fullscreenRadar ? 'bg-[#05070c]' : conversationOffer
      ? 'flex h-dvh justify-center bg-[#05070c]'
      : 'flex min-h-screen justify-center bg-[#05070c] p-2 sm:p-6'}>
      {/* Mobile Frame Container */}
      <div className={fullscreenRadar
        ? 'relative flex h-dvh w-full flex-col overflow-hidden bg-[#080b12]'
        : conversationOffer ? 'relative flex h-full w-full max-w-3xl flex-col overflow-hidden bg-[#080b12]'
        : 'relative flex min-h-[780px] w-full flex-col overflow-hidden rounded-[36px] border border-white/[0.08] bg-[#080b12] shadow-[0_25px_60px_-15px_rgba(0,102,255,0.2)] ' +
          (initialPickup ? 'max-w-3xl' : 'max-w-[420px]')}>
        {/* Ambient Lighting */}
        <div className="absolute top-0 left-1/4 -translate-x-1/2 w-64 h-40 bg-blue-600/20 blur-[70px] pointer-events-none" />
        <div className="absolute top-10 right-0 w-48 h-40 bg-emerald-500/10 blur-[70px] pointer-events-none" />

        {/* Header */}
        {!conversationOffer && <header className={fullscreenRadar ? 'relative z-10 shrink-0 px-4 py-2' : 'relative z-10 px-4 pb-3 pt-5'}>
          <div className={fullscreenRadar ? 'flex items-center justify-between' : 'mb-3 flex items-center justify-between'}>
            {/* Logo & Brand Title */}
            <div className="flex items-center space-x-2.5">
              <button type="button" aria-label={t("Open profile")} className="relative cursor-pointer" onClick={() => setActiveTab('profile')}>
                {/* eslint-disable-next-line @next/next/no-img-element -- avatars are private data URLs */}
                <img
                  src={currentUser?.avatar_url || '/logo.jpg'}
                  alt="BottleForMe"
                  className="w-10 h-10 rounded-2xl border-2 border-blue-500/40 object-cover shadow-lg"
                />
                <span
                  className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#080b12] ${
                    currentUser?.role === 'taker' ? 'bg-[#00e599]' : 'bg-[#0066ff]'
                  }`}
                />
              </button>
              <div>
                <div className="flex items-center gap-1.5">
                  <h1 className="text-base font-extrabold tracking-tight text-white leading-none">
                    BottleForMe
                  </h1>
                  <button
                    type="button"
                    onClick={() => void handleToggleRole()}
                    className={`text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border cursor-pointer transition ${
                      currentUser?.role === 'taker'
                        ? 'bg-emerald-500/15 text-[#00e599] border-emerald-500/30'
                        : 'bg-blue-500/15 text-[#60a5fa] border-blue-500/30'
                    }`}
                  >
                    {currentUser?.role === 'taker' ? '🚛 Taker' : currentUser ? '🎁 Giver' : 'Guest'}
                  </button>
                </div>
                <p className="text-[11px] text-blue-200/60 font-medium mt-0.5">{t("Plastic · Cans · Glass Collection")}</p>
              </div>
            </div>

            {/* Header Action Buttons */}
            <div className="flex items-center gap-1.5">
              {/* Notifications Bell */}
              <button
                onClick={() => setIsNotifOpen(true)}
                aria-label={t("Notifications")}
                className="relative w-9 h-9 rounded-full bg-blue-950/40 border border-blue-500/20 flex items-center justify-center text-blue-200 hover:text-white hover:bg-blue-900/40 transition"
              >
                <Bell className="w-4 h-4" />
                {unreadNotifCount > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-blue-500 ring-2 ring-[#080b12]" />
                )}
              </button>

              {/* Profile / Auth Button */}
              <button
                onClick={() => (currentUser ? setActiveTab('profile') : setIsAuthOpen(true))}
                aria-label={currentUser ? t("Profile") : t("Log in")}
                className="w-9 h-9 rounded-full bg-blue-950/40 border border-blue-500/20 flex items-center justify-center text-blue-200 hover:text-white hover:bg-blue-900/40 transition"
              >
                <User className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Top Segmented Switcher */}
          {!fullscreenRadar && <div className="bg-[#0e1626] p-1 rounded-2xl flex text-xs font-semibold border border-blue-500/20 shadow-inner">
            {!canUseRadar && (<button
              onClick={() => setActiveTab('resident')}
              className={`flex-1 py-2 rounded-xl transition-all duration-200 font-bold ${
                activeTab === 'resident'
                  ? 'bg-[#0066ff] text-white shadow'
                  : 'text-blue-200/70 hover:text-white'
              }`}
            >{t("List Empties")}</button>)}
            {canUseRadar && (<button
              onClick={() => setActiveTab('driver')}
              className={`flex-1 py-2 rounded-xl transition-all duration-200 ${
                activeTab === 'driver'
                  ? 'bg-[#0066ff] text-white shadow font-bold'
                  : 'text-blue-200/70 hover:text-white'
              }`}
            >{t("Radar")}</button>)}
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex-1 py-2 rounded-xl transition-all duration-200 relative ${
                activeTab === 'chat'
                  ? 'bg-[#0066ff] text-white shadow font-bold'
                  : 'text-blue-200/70 hover:text-white'
              }`}
            >{t("Pickups")}</button>
          </div>}
        </header>}

        {/* Toast Notification Banner */}
        {lifecycle?.paused && <p role="status" className="mx-4 mb-2 rounded-xl bg-amber-950 p-3 text-sm text-amber-100">
          Your account is {lifecycle.deleting ? 'pending deletion' : 'deactivated'}. <Link href="/settings" className="font-semibold underline">{t("Open Settings")}</Link>
        </p>}
        {maintenance && <p role="status" className="mx-4 mb-2 rounded-xl bg-amber-950 p-3 text-sm text-amber-100">{t("BottleForMe is under maintenance. Pickup changes are paused. Please try again shortly.")}</p>}
        {actionError && <p role="alert" className="mx-4 mb-2 break-words rounded-xl bg-red-950 p-3 text-xs text-red-200">{actionError}</p>}
        {toastMessage && (
          <div role="status" className="mx-4 mb-2 p-3 bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 text-xs font-semibold rounded-2xl shadow-lg animate-fade-in flex items-center gap-2">
            <Check className="w-4 h-4 text-[#00e599] shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Scrollable Content Viewport */}
        <main className={fullscreenRadar || conversationOffer ? 'relative z-10 flex min-h-0 flex-1 flex-col' : 'relative z-10 flex-1 space-y-4 px-4 pb-4'}>
          {/* ================= 1. GIVER / RESIDENT VIEW ================= */}
          {activeTab === 'resident' && (
            <form noValidate className="space-y-3.5" onSubmit={handlePublishOffer}>
              {/* Hero Card */}
              <div className="glass-navy rounded-[28px] p-4 relative overflow-hidden">
                <div className="flex flex-wrap justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">{t("Zero Queues · Doorstep Pickup")}</span>
                    <h2 className="text-lg font-bold text-white tracking-tight mt-0.5">{t("Arrange an empties pickup.")}</h2>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-[#00e599]/10 border border-[#00e599]/25 text-[#00e599]">{t("€0.10 per eligible item")}</span>
                </div>

                {/* 3 Container Categories Breakdown (Plastic, Cans, Glass) with 1-by-1 increments & direct input */}
                <div className="mt-3.5 pt-3 border-t border-white/[0.08] space-y-2.5">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-bold text-blue-200/70 uppercase tracking-wider">{t("Containers to Hand Over:")}</span>
                    <span className="text-[10px] text-blue-300 font-semibold">{t("Type exact count or tap − / +")}</span>
                  </div>

                  <p className="text-[11px] text-blue-200/70">{t("Count only empty containers accepted by Malta’s BCRS. Check for an eligible, readable barcode and keep the container intact.")}</p>
                  <div className="grid grid-cols-3 gap-2">
                    <ContainerCounter name="Plastic" icon="🧴" value={plasticCount} onChange={setPlasticCount} />
                    <ContainerCounter name="Cans" icon="🥫" value={canCount} onChange={setCanCount} />
                    <ContainerCounter name="Glass" icon="🍾" value={glassCount} onChange={setGlassCount} />
                  </div>
                  <p className="text-xs text-blue-200/70">{t("Total:") + ' '}<strong className="text-white">{countsValid ? totalContainers : '—'}{' ' + t("eligible items")}</strong>
                  </p>
                  {!countsValid && <p className="text-xs text-red-300">{countError}</p>}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <span className="text-xs text-blue-200/70">{t("Pickup bags ·") + ' '}{bags || 'Choose a quantity'}</span>
                    <div className="flex gap-1.5">
                      <button type="button" disabled={bags <= 1} onClick={() => setBags((count) => count - 1)} className="rounded-lg bg-white/5 px-2.5 py-1 text-xs font-bold text-white disabled:opacity-40">{t("−1 Bag")}</button>
                      <button type="button" disabled={bags === MAX_BAGS} onClick={() => setBags((count) => count + 1)} className="rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-bold text-white disabled:opacity-40">{t("+1 Bag")}</button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Deposit Split Slider Card */}
              <div className="glass-navy rounded-[28px] p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-xs font-bold text-white tracking-tight">{t("Deposit Split Ratio")}</span>
                    <p className="text-[11px] text-blue-200/60">{t("Estimated BCRS voucher value")}{' '}
                      <span className="text-white font-semibold">€{countsValid ? totalDepositValue.toFixed(2) : '—'}</span>
                    </p>
                  </div>
                  <span
                    className={`text-xs font-bold px-3 py-1 rounded-full border ${
                      splitPercent === 0
                        ? 'bg-emerald-500/20 text-[#00e599] border-emerald-500/40'
                        : splitPercent === 50
                        ? 'bg-blue-500/20 text-[#60a5fa] border-blue-500/30'
                        : 'bg-white/[0.08] text-white border-white/10'
                    }`}
                  >
                    {splitPercent === 0
                      ? '100% Free Gift'
                      : splitPercent === 50
                      ? '50/50 Fair Split'
                      : `${splitPercent}% to You`}
                  </span>
                </div>

                <div className="pt-1">
                  <input
                    type="range"
                    min="0"
                    max={MAX_SELLER_SPLIT}
                    aria-label={t("Seller share of estimated voucher value")}
                    step="5"
                    value={splitPercent}
                    onChange={(e) => setSplitPercent(Number(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-[10px] text-blue-200/60 font-medium mt-1.5 px-0.5">
                    <span>0% (Free Gift)</span>
                    <span className="text-blue-300">50% (Recommended)</span>
                    <span>70%</span>
                  </div>
                </div>

                {/* Split Metrics */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="bg-[#0b1220] rounded-2xl p-2.5 border border-blue-500/20">
                    <span className="text-[10px] text-blue-300 font-medium block">{t("You Get (At Door)")}</span>
                    <span className="text-lg font-extrabold text-white mt-0.5 block">
                      €{countsValid ? sellerPayout.toFixed(2) : '—'}
                    </span>
                    <span className="text-[10px] text-blue-200/50">{t("Direct Revolut / Cash")}</span>
                  </div>
                  <div className="bg-[#0b1220] rounded-2xl p-2.5 border border-emerald-500/20">
                    <span className="text-[10px] text-emerald-400 font-medium block">{t("Collector’s estimated net value")}</span>
                    <span className="text-lg font-extrabold text-[#00e599] mt-0.5 block">
                      €{countsValid ? collectorProfit.toFixed(2) : '—'}
                    </span>
                    <span className="text-[10px] text-emerald-300/50">{t("Voucher value minus seller payment")}</span>
                  </div>
                </div>
              </div>

              {/* Location & contact details */}
              <div className="glass-navy rounded-[28px] p-4 space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-white tracking-tight">{t("Location & Contact Details")}</span>
                  <span className="text-[10px] text-blue-400 font-semibold">Malta</span>
                </div>

                {/* Locality Dropdown & Working Pin Button */}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 min-w-0">
                    <select
                      value={locality}
                      aria-label={t("Pickup locality")}
                      aria-invalid={triedToPublish && Boolean(localityError) || undefined}
                      aria-describedby={triedToPublish && localityError ? 'publish-errors' : undefined}
                      required
                      onChange={(e) => setLocality(e.target.value)}
                      className="w-full bg-[#0b1220] border border-blue-500/25 text-white text-xs font-semibold rounded-2xl px-3 py-2.5 appearance-none focus:outline-none focus:border-blue-500 truncate"
                    >
                      <option value="">{t("Choose a locality")}</option>
                      {MALTA_LOCALITIES.map((loc) => (
                        <option key={loc.id} value={loc.name}>
                          {loc.name} ({loc.region})
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={handlePinLocation}
                    disabled={isPinningLocation}
                    className="shrink-0 px-3 py-2.5 bg-blue-900/40 hover:bg-blue-800/50 border border-blue-500/30 text-blue-300 rounded-2xl text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 disabled:opacity-50"
                  >
                    <MapPin className="w-3.5 h-3.5 text-blue-400" />
                    <span>{isPinningLocation ? 'Locating...' : t("Use GPS")}</span>
                  </button>
                </div>

                {needsRevolutTag && <div>
                  <input
                    type="text"
                    aria-label={t("Revolut tag")}
                    aria-invalid={triedToPublish && Boolean(revolutError) || undefined}
                    aria-describedby={triedToPublish && revolutError ? 'publish-errors' : undefined}
                    placeholder="@your_revolut_tag"
                    maxLength={51}
                    required
                    value={revolutTag}
                    onChange={(e) => setRevolutTag(e.target.value)}
                    className="w-full bg-[#0b1220] border border-blue-500/25 text-white text-xs rounded-2xl px-3 py-2.5 placeholder-blue-300/40 focus:outline-none focus:border-blue-500 box-border"
                  />
                </div>}

                {streets.length > 0 && <div className="space-y-1">
                  <label className="block text-sm text-blue-200">{t("Nearby street")}<select className="mt-1 block w-full min-w-0 rounded-xl bg-[#0b1220] p-2 text-base text-white" value={gpsStreet}
                      onChange={(event) => { setGpsStreet(event.target.value); setPickupAddress(event.target.value); setAddressSelection(null); }}>
                      <option value="">{t("Choose a street")}</option>
                      {streets.map((name) => <option key={name}>{name}</option>)}
                    </select>
                  </label>
                  <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="text-xs text-blue-300">© OpenStreetMap contributors</a>
                </div>}
                <PickupAddressField value={pickupAddress} selection={addressSelection} enabled={addressLookup} signedIn={!!accountId}
                  onChange={(value) => { setPickupAddress(value); setAddressSelection(null); }}
                  onSelect={(value) => { setPickupAddress(value.address); setAddressSelection(value); }} />
                {/* Address Notes Full-Width Row */}
                <div>
                  <input
                    type="text"
                    aria-label={t("Private pickup instructions")}
                    aria-invalid={triedToPublish && Boolean(addressError) || undefined}
                    aria-describedby={triedToPublish && addressError ? 'publish-errors' : undefined}
                    placeholder={t("Door, intercom, or other instructions (optional)")}
                    maxLength={300}
                    value={addressNotes}
                    onChange={(e) => setAddressNotes(e.target.value)}
                    className="w-full bg-[#0b1220] border border-blue-500/25 text-white text-xs rounded-2xl px-3 py-2.5 placeholder-blue-300/40 focus:outline-none focus:border-blue-500 box-border"
                  />
                </div>

                <p className="text-[10px] text-blue-200/70">{t("Pickup instructions are shared with the collector who reserves this listing.")}</p>
                {/* Payout Method Toggle */}
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setPayoutMethod('revolut')}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold border transition ${
                      payoutMethod === 'revolut'
                        ? 'bg-blue-600/30 border-blue-500 text-white'
                        : 'bg-[#0b1220] border-white/5 text-slate-400'
                    }`}
                  >
                    ⚡ Revolut P2P
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayoutMethod('cash')}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold border transition ${
                      payoutMethod === 'cash'
                        ? 'bg-emerald-500/20 border-emerald-500 text-[#00e599]'
                        : 'bg-[#0b1220] border-white/5 text-slate-400'
                    }`}
                  >
                    💵 Cash At Door
                  </button>
                </div>
              </div>

              <AvailabilityEditor drafts={availabilityDraft} onChange={setAvailabilityDraft} disabled={isPublishing} />
              <div className="glass-navy space-y-2 rounded-2xl p-3 text-sm text-white">
                <label className="block font-semibold" htmlFor="listing-photo">{t("Photo of the bottles or bags (required)")}</label>
                <input id="listing-photo" type="file" accept="image/jpeg,image/png,image/webp"
                  disabled={isPublishing || readingListingPhoto} className="block w-full max-w-full text-blue-100"
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0];
                    event.currentTarget.value = '';
                    if (file) void chooseListingPhoto(file);
                  }} />
                {readingListingPhoto && <p role="status">{t("Preparing photo…")}</p>}
                {listingPhotoError && <p role="alert" className="text-red-300">{listingPhotoError}</p>}
                {listingPhoto && <>
                  {/* eslint-disable-next-line @next/next/no-img-element -- preview of a local file */}
                  <img className="max-h-40 rounded-xl object-contain" src={'data:image/jpeg;base64,' + listingPhoto} alt={t("Listing photo preview")} />
                  <button type="button" disabled={isPublishing || readingListingPhoto} className="text-blue-200 underline"
                    onClick={() => { setListingPhoto(''); setListingPhotoError(''); }}>{t("Remove photo")}</button>
                </>}
              </div>
              {/* Publish Request Button */}
              <label className="block rounded-xl bg-[#0e1626] p-3 text-sm text-blue-200">{t("Bag arrangements")}<select value={bagPolicy} onChange={(event) => setBagPolicy(event.target.value)} className="mt-1 block w-full rounded-lg bg-[#080b12] p-2 text-white">
                  <option value="">{t("Choose an option")}</option>
                  {bagPolicies.map(({ value, label }) => <option key={value} value={value}>{t(label)}</option>)}
                </select>
              </label>
              {triedToPublish && publishErrors.length > 0 && (
                <div id="publish-errors" role="alert" className="rounded-xl bg-red-950 p-3 text-sm text-red-200">
                  <ul className="list-disc space-y-1 pl-5">
                    {publishErrors.map((error) => <li key={error}>{t(error)}</li>)}
                  </ul>
                </div>
              )}
              <button
                type="submit"
                disabled={isPublishing || readingListingPhoto}
                className="w-full py-3.5 rounded-2xl blue-btn text-white font-extrabold text-sm tracking-tight flex items-center justify-center gap-2 cursor-pointer shadow-lg disabled:opacity-50"
              >
                <span>{isPublishing ? t("Publishing…") : t("Publish Collection Request")}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* ================= 2. TAKER / RADAR VIEW ================= */}
          {activeTab === 'driver' && !canUseRadar && (
            <section className="glass-navy space-y-3 rounded-[28px] p-4">
              <h2 className="font-extrabold text-white">{t("Radar is for Takers")}</h2>
              <p className="text-sm text-blue-200">{t("Switch to Taker to see and reserve pickups from other accounts.")}</p>
              <button type="button" className="blue-btn rounded-xl px-3 py-2 text-sm font-bold text-white" onClick={() => void handleToggleRole()}>
                {currentUser ? t("Switch to Taker") : 'Sign in to use Radar'}
              </button>
            </section>
          )}
          {activeTab === 'driver' && canUseRadar && (
            <section className={fullscreenRadar ? 'relative flex min-h-0 flex-1 flex-col' : 'space-y-3.5'}>
              <div className={fullscreenRadar ? 'shrink-0 space-y-1 border-t border-blue-500/20 bg-[#0e1626] px-3 py-2' : 'glass-navy relative overflow-hidden rounded-[28px] p-4'}>
                <div className="flex justify-between items-center mb-2.5">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">{t("Malta Collector Radar")}</span>
                    <h3 className="text-base font-bold text-white tracking-tight mt-0.5">
                      {offers.length}{' ' + t("Live Pickup Requests")}</h3>
                  </div>

                  {/* List vs Map Switcher */}
                  <div className="bg-[#0b1220] p-0.5 rounded-xl border border-blue-500/25 flex">
                    <button
                      aria-pressed={radarView === 'list'} onClick={() => setRadarView('list')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                        radarView === 'list'
                          ? 'bg-blue-600 text-white'
                          : 'text-blue-200/60 hover:text-white'
                      }`}
                    >{t("List")}</button>
                    <button
                      aria-pressed={radarView === 'map'} onClick={() => setRadarView('map')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                        radarView === 'map'
                          ? 'bg-blue-600 text-white'
                          : 'text-blue-200/60 hover:text-white'
                      }`}
                    >{t("Map")}</button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <select aria-label={t("Filter Radar by locality")} value={radarLocality} onChange={(event) => { setOffers([]); setMapOfferId(null); setRadarStatus('Loading Radar…'); setRadarLocality(event.target.value); }} className="min-w-0 flex-1 rounded-xl border border-blue-500/25 bg-[#0b1220] p-2 text-xs text-white">
                    <option value="">{t("All localities")}</option>
                    {MALTA_LOCALITIES.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
                  </select>
                  <button type="button" onClick={() => setRevision((value) => value + 1)} className="rounded-xl bg-blue-950 p-2 text-xs text-blue-200">{t("Refresh")}</button>
                </div>

                <button type="button" aria-pressed={savedOnly} disabled={!favorites.ids} onClick={() => {
                  setMapOfferId(null);
                  setSavedOnly(!savedOnly);
                }} className="rounded-lg bg-blue-950 px-3 py-2 text-xs text-blue-100 disabled:opacity-50">{savedOnly ? t("Show all listings") : t("Show saved listings")}</button>
                {favorites.error && <p role="alert" className="text-xs text-red-300">{favorites.error}</p>}
                {savedOnly && !radarOffers.length && <p className="text-xs text-blue-200">{t("No saved listings in this area.")}</p>}
                {radarStatus && <p role="status" className="text-xs text-blue-200">{radarStatus}</p>}
              </div>
              {fullscreenRadar && (
                <div className="relative min-h-0 flex-1">
                  <RadarMap offers={radarOffers} onSelectOffer={(offer) => setMapOfferId(offer.id)} />
                </div>
              )}

              {/* List view or the pickup selected on the map. */}
              <RadarResults
                ref={(node: HTMLDivElement | HTMLDialogElement | null) => { radarDetails.current = node instanceof HTMLDialogElement ? node : null; }}
                aria-label={fullscreenRadar ? t("Pickup details") : undefined}
                onCancel={(event) => { event.preventDefault(); setMapOfferId(null); }}
                className={fullscreenRadar
                  ? 'm-auto w-[calc(100%-1.5rem)] max-w-md overflow-hidden rounded-[24px] bg-[#0e1626] text-white backdrop:bg-black/60'
                  : 'space-y-2.5'}>
                {radarOffers.filter((offer) => radarView === 'list' || offer.id === mapOfferId).map((offer) => (
                  <div
                    key={offer.id}
                    className={fullscreenRadar ? 'glass-navy flex max-h-[85dvh] flex-col overflow-hidden rounded-[24px]'
                      : 'glass-navy pointer-events-auto space-y-2.5 rounded-[24px] p-3.5 transition hover:border-blue-400/50'}
                  >
                    <div className={fullscreenRadar ? 'min-h-0 space-y-2.5 overflow-y-auto p-3.5' : 'space-y-2.5'}>
                      {fullscreenRadar && <button type="button" onClick={() => setMapOfferId(null)}
                        className="float-right ml-2 rounded-lg border border-blue-400/30 px-2 py-1 text-xs text-blue-200">{t("Close")}</button>}
                      <div className="flex flex-wrap justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                              {offer.locality}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                offer.split_percentage === 0
                                  ? 'bg-emerald-500/20 text-[#00e599]'
                                  : 'bg-white/[0.06] text-slate-300'
                              }`}
                            >
                              {offer.split_percentage === 0 ? '100% Free' : `${offer.split_percentage}% Split`}
                            </span>
                          </div>
                          <h4 className="text-sm font-bold text-white mt-1.5">
                            {offer.containers ? '' : 'About '}{offer.estimated_bottles} containers · {offer.bag_count} bags
                          </h4>

                        </div>
                        <div className="shrink-0">
                          <span className="text-[10px] text-slate-400 font-medium block">{t("Collector’s estimated net value")}</span>
                          <span className="text-base font-extrabold text-[#00e599]">
                            €{offer.collector_profit.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-white/[0.08]">
                        <span className="text-[11px] text-slate-300">{t("Pay Giver:")}{' '}
                          <strong className="text-white">
                            €{offer.seller_payout.toFixed(2)}{' '}
                            {offer.seller_revolut_tag ? `(${offer.seller_revolut_tag})` : ''}
                          </strong>
                        </span>
                        {!fullscreenRadar && !offer.availability?.length && <button
                          disabled={isUpdating}
                          onClick={() => changePickup(offer, 'reserved')}
                          className="px-3.5 py-1.5 rounded-xl bg-blue-600/30 hover:bg-blue-600 hover:text-white text-blue-300 text-xs font-bold border border-blue-500/40 transition shadow-sm"
                        >{t("Reserve pickup →")}</button>}
                      </div>
                      <p className="text-xs text-blue-200">{t(bagPolicyLabel(offer.bag_policy))}</p>
                      <PickupPhoto key={offer.id} pickupId={offer.id} />
                      <div className="flex flex-wrap gap-3 text-xs">
                        <button type="button" aria-pressed={favorites.ids?.includes(offer.id) ?? false}
                          disabled={!favorites.ids || favorites.busy} onClick={() => void favorites.toggle(offer.id)}
                          className="rounded-lg bg-blue-950 px-2 py-1 text-blue-100 disabled:opacity-50">{favorites.ids?.includes(offer.id) ? t("Remove favorite") : t("Save favorite")}</button>
                        <button type="button" onClick={() => setReport({ pickupId: offer.id, target: 'listing' })}
                          className="rounded-lg bg-white/10 px-2 py-1 text-blue-100">{t("Report listing")}</button>
                      </div>
                    </div>
                    {(fullscreenRadar || !!offer.availability?.length) && <div className={fullscreenRadar
                      ? 'max-h-[50dvh] shrink-0 overflow-y-auto border-t border-blue-400/25 p-3.5' : undefined}>
                      {offer.availability?.length ? <RequestPickupTime offer={offer} onRestriction={setRestriction}
                        onSaved={() => setRevision((value) => value + 1)} /> : <button type="button" disabled={isUpdating}
                        onClick={() => void changePickup(offer, 'reserved')}
                        className="blue-btn min-h-11 w-full rounded-xl px-3 py-2 text-sm font-bold text-white disabled:opacity-50">
                        {t('Reserve pickup →')}
                      </button>}
                    </div>}
                  </div>
                ))}
              </RadarResults>
            </section>
          )}

          {conversationOffer && <PickupChat key={currentUser?.id + ':' + conversationOffer.id} offer={conversationOffer}
            taker={canUseRadar} onRead={refreshUnread} onBack={() => router.push('/?view=pickups')}
            onDetails={() => openActivity(conversationOffer.id)} />}
          {activeTab === 'chat' && !conversationOffer && (
            <section className={selectedId ? 'glass-navy space-y-3 rounded-[24px] p-4 text-sm' : 'space-y-3 text-sm'}>
              <h2 className="py-2 text-center text-xl font-extrabold text-white">{t(selectedId ? 'Pickup details' : 'Pickups')}</h2>
              {!currentUser ? (
                <button type="button" className="blue-btn rounded-xl px-3 py-2 font-bold text-white" onClick={() => setIsAuthOpen(true)}>{t("Sign in to view pickups")}</button>
              ) : (
                <>
                  {selectedId ? <>
                    <button type="button" className="text-sm font-bold text-blue-300" onClick={() => {
                      setSelectedId(null); setHandoverCode(undefined); setTypedCode(undefined); setActionError('');
                      if (initialPickup) router.push('/?view=pickups');
                    }}>{t("← All pickups")}</button>
                    {handoverStatus && <p role="status" className="text-blue-200">{handoverStatus}</p>}
                    {selectedInOtherRole ? (
                      <p className="text-blue-200">
                        This pickup belongs to your {canUseRadar ? t("Giver") : t("Taker")} role.{' '}
                        <button type="button" onClick={() => void handleToggleRole(true)} className="font-bold text-blue-300 underline">
                          Switch to {canUseRadar ? t("Giver") : t("Taker")}
                        </button>
                      </p>
                    ) : <>
                      {selectedOffer && <>
                        <header className="space-y-1">
                          <span className="text-xs font-semibold text-blue-300" style={{ color: pickupStatusCss(selectedOffer.overdue ? 'overdue' : selectedOffer.status) }}>{!canUseRadar && selectedOffer.archived_at ? t("Archived") : selectedOffer.overdue ? t("Overdue") : t(pickupStatus[selectedOffer.status])}</span>
                          <h3 className="text-lg font-bold text-white">{selectedOffer.locality}</h3>
                          {selectedOffer.confirmed_at && <p className="text-blue-100">{formatAppointment(selectedOffer.confirmed_at)} · Malta time</p>}
                        </header>

                        {!canUseRadar && !handoverActive && selectedOffer.seller_id === accountId && <button type="button" disabled={archiving}
                          onClick={() => void toggleArchive(selectedOffer)} className="rounded-lg bg-white/10 px-3 py-2 text-blue-100 disabled:opacity-50">
                          {selectedOffer.archived_at ? t("Restore listing") : t("Archive listing")}
                        </button>}
                        <PickupPhoto key={selectedOffer.id} pickupId={selectedOffer.id} />
                        {handoverActive && selectedOffer.address_notes && <div className="rounded-xl bg-white/5 p-3">
                          <h4 className="font-semibold text-white">{t("Pickup address")}</h4>
                          <p className="whitespace-pre-line break-words text-blue-200">{selectedOffer.address_notes}</p>
                        </div>}

                        {handoverActive && <div className="space-y-2">
                          {isCollector && selectedOffer.status === 'reserved' && <button type="button" disabled={isUpdating}
                            onClick={() => changePickup(selectedOffer, 'en_route')} className="blue-btn rounded-xl px-3 py-2 font-bold text-white disabled:opacity-50">{t("Mark on the way")}</button>}
                          {isCollector && selectedOffer.status === 'en_route' && <button type="button" disabled={isUpdating}
                            onClick={() => changePickup(selectedOffer, 'arrived')} className="blue-btn rounded-xl px-3 py-2 font-bold text-white disabled:opacity-50">{t("Mark arrived")}</button>}
                          {isCollector && selectedOffer.status === 'arrived' && <form className="space-y-2" onSubmit={(event) => {
                            event.preventDefault();
                            if (typedCode?.id === selectedOffer.id && typedCode.value.length === 6) void changePickup(selectedOffer, 'completed', typedCode.value);
                          }}>
                            <label className="block text-blue-200">{t("Enter the six-digit code from the Giver")}<input className="mt-1 block w-full min-w-0 rounded-lg bg-[#0b1220] p-2 text-base text-white"
                                inputMode="numeric" maxLength={6} value={typedCode?.id === selectedOffer.id ? typedCode.value : ''}
                                onChange={(event) => setTypedCode({ id: selectedOffer.id, value: event.target.value.replace(/\D/g, '').slice(0, 6) })} />
                            </label>
                            <button type="submit" disabled={isUpdating || typedCode?.id !== selectedOffer.id || typedCode.value.length !== 6}
                              className="blue-btn rounded-xl px-3 py-2 font-bold text-white disabled:opacity-50">{t("Confirm handover")}</button>
                          </form>}
                          {!isCollector && <>
                            <button type="button" className="blue-btn rounded-xl px-3 py-2 font-bold text-white" onClick={() => revealHandoverCode(selectedOffer.id)}>{t("Show code")}</button>
                            {handoverCode?.id === selectedOffer.id && <p className="text-lg font-bold text-white">Show the Taker: {handoverCode.value}</p>}
                          </>}
                        </div>}

                        {selectedOffer.collector_id && selectedOffer.seller_id && <PickupPartner
                          key={selectedOffer.id + ':' + selectedOffer.status} pickupId={selectedOffer.id} />}
                        {selectedOffer.collector_id && selectedOffer.seller_id && <button type="button"
                          onClick={() => setReport({ pickupId: selectedOffer.id, target: 'user' })}
                          className="rounded-lg bg-white/10 px-2 py-1 text-xs text-blue-100">{t("Report pickup partner")}</button>}
                        {selectedOffer.collector_id && <button type="button" onClick={() => openActivity(selectedOffer.id, true)}
                          className="rounded-xl border border-blue-400/30 px-3 py-2 font-bold text-blue-100">
                          {handoverActive ? t("Chat") : t("Chat history")} <UnreadBadge count={unreadCounts.get(selectedOffer.id)} />
                        </button>}

                        <details className="space-y-2 rounded-xl border border-blue-400/20 p-3 text-blue-200">
                          <summary className="cursor-pointer font-semibold text-white">{t("Details")}</summary>
                          <p>{selectedOffer.estimated_bottles} containers · {selectedOffer.bag_count} bags</p>
                          <p>{t(bagPolicyLabel(selectedOffer.bag_policy))}</p>
                          {!handoverActive && !isCollector && selectedOffer.address_notes && <p className="whitespace-pre-line break-words">{selectedOffer.address_notes}</p>}
                          <p>{selectedOffer.seller_payout === 0 ? t("Free pickup") :
                            'Pay the Giver €' + selectedOffer.seller_payout.toFixed(2) +
                            (selectedOffer.payout_method === 'cash' ? ' in cash' : selectedOffer.payout_method === 'revolut' ? ' via Revolut' : ' as agreed')}</p>
                          {isCollector && handoverActive && selectedOffer.seller_payout > 0 && selectedOffer.payout_method === 'revolut' &&
                            selectedOffer.seller_revolut_tag && REVOLUT_TAG.test(selectedOffer.seller_revolut_tag) && (
                            <a target="_blank" rel="noopener noreferrer" className="inline-block rounded-xl bg-blue-600 px-3 py-2 text-white"
                              href={'https://revolut.me/' + encodeURIComponent(selectedOffer.seller_revolut_tag.replace(/^@/, '')) + '?amount=' + selectedOffer.seller_payout.toFixed(2)}>{t("Open Revolut")}</a>
                          )}
                          {!selectedOffer.confirmed_at && <PickupAvailability offer={selectedOffer} />}
                          {selectedOffer.status === 'open' && selectedOffer.seller_id === currentUser.id && <EditPickupAvailability
                            key={selectedOffer.id + ':' + (selectedOffer.availability_version ?? 0)} offer={selectedOffer} onSaved={() => setRevision((value) => value + 1)} />}
                          {(handoverActive || selectedOffer.status === 'open') && <button type="button" disabled={isUpdating}
                            onClick={() => { if (window.confirm('Cancel this pickup?')) void changePickup(selectedOffer, 'cancelled'); }}
                            className="block rounded-xl bg-white/10 px-3 py-2 text-white disabled:opacity-50">{t("Cancel pickup")}</button>}
                        </details>
                      </>}
                      <details open={!selectedOffer || selectedOffer.status === 'open'} className="rounded-xl border border-blue-400/20 p-3">
                        <summary className="cursor-pointer font-semibold text-white">{t("Time requests")}</summary>
                        <PickupArrangements key={selectedId} userId={currentUser.id} listingId={selectedId}
                          participantKey={pickupParticipant} onSwitchRole={() => void handleToggleRole(true)} revision={revision} onSaved={() => setRevision((value) => value + 1)} />
                      </details>
                    </>}
                  </> : <>
                    {handoverStatus && <p role="status" className="text-blue-200">{handoverStatus}</p>}
                    {!canUseRadar && <button type="button" aria-pressed={showArchived} onClick={() => setShowArchived(!showArchived)}
                      className="rounded-lg bg-blue-950 px-3 py-2 text-blue-100">{showArchived ? t("Show current listings") : t("Show archived listings")}</button>}
                    {!handoverStatus && !visiblePickups.length && <p className="text-blue-200">{showArchived && !canUseRadar ? t("No archived listings yet.") : 'No listings or assigned pickups in this role yet.'}</p>}
                    {visiblePickups.map((offer) => <PickupConversationCard key={offer.id} offer={offer} taker={canUseRadar}
                      status={t(!canUseRadar && offer.archived_at ? 'Archived' : offer.overdue ? 'Overdue' : pickupStatus[offer.status])}
                      unread={unreadCounts.get(offer.id)} onOpen={() => openActivity(offer.id, !!(offer.collector_id && offer.seller_id))} />)}
                    <PickupArrangements key={currentUser.id} userId={currentUser.id} onOpen={(id) => openActivity(id)}
                      participantKey={pickupParticipant} excludeAcceptedFor={new Set(rolePickups.map((offer) => offer.id))} revision={revision} onSaved={() => setRevision((value) => value + 1)} />
                  </>}
                </>
              )}
            </section>
          )}

          {/* ================= 4. PROFILE & SETTINGS TAB ================= */}
          {activeTab === 'profile' && !currentUser && (
            <section className="glass-navy rounded-3xl p-4 text-sm">
              <h2 className="mb-2 font-bold text-white">{t("Your profile")}</h2>
              <Link href="/settings" className="mb-3 flex items-center gap-2 text-blue-200"><Settings className="size-4" aria-hidden="true" /> {t('Settings')}</Link>
              <Link href="/help" className="mb-3 flex items-center gap-2 text-blue-200"><CircleHelp className="size-4" aria-hidden="true" />{' ' + t("Help & FAQ")}</Link>
              <button type="button" className="blue-btn rounded-xl px-3 py-2 font-bold text-white" onClick={() => setIsAuthOpen(true)}>{t("Sign in or register")}</button>
            </section>
          )}
          {activeTab === 'profile' && currentUser && (
            <section className="space-y-3.5">
              {/* Profile Card with Photo Upload */}
              <div className="glass-navy rounded-[28px] p-4 relative overflow-hidden">
                <div className="flex items-center gap-3.5">
                  {/* Avatar with Camera Overlay */}
                  <div className="relative group shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element -- avatars are private data URLs */}
                    <img
                      src={currentUser?.avatar_url || '/logo.jpg'}
                      alt="Avatar"
                      className="w-16 h-16 rounded-3xl object-cover border-2 border-blue-500/40 shadow-xl"
                    />
                    <label className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center cursor-pointer shadow-md transition">
                      <Camera className="w-3 h-3" />
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        aria-label={t("Update profile photo")}
                        onChange={handleAvatarUpload}
                        className="sr-only"
                      />
                    </label>
                  </div>

                  {/* Name, Role & Email */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-base font-extrabold text-white truncate">
                        {currentUser?.full_name}
                      </h3>
                    </div>
                    <p className="text-[11px] text-blue-200/60 truncate">
                      {currentUser?.email}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          currentUser?.role === 'taker'
                            ? 'bg-emerald-500/20 text-[#00e599] border border-emerald-500/30'
                            : 'bg-blue-500/20 text-[#60a5fa] border border-blue-500/30'
                        }`}
                      >
                        {currentUser?.role === 'taker' ? '🚛 Active Taker' : '🎁 Active Giver'}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        📍 {currentUser?.locality || '—'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Role Switcher Action */}
                <div className="mt-3.5 pt-3 border-t border-white/[0.08] flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-white block">{t("Switch Active Role")}</span>
                    <p className="text-[10px] text-blue-200/60">
                      Currently acting as {currentUser?.role === 'taker' ? 'Taker (Collector)' : 'Giver (Resident)'}
                    </p>
                  </div>
                  <button
                    onClick={() => void handleToggleRole()}
                    className="px-3 py-1.5 rounded-xl bg-blue-600/30 hover:bg-blue-600 text-blue-200 hover:text-white border border-blue-500/40 text-xs font-bold transition flex items-center gap-1"
                  >
                    <span>Switch to {currentUser?.role === 'taker' ? t("Giver") : t("Taker")}</span>
                  </button>
                </div>
              </div>

              {/* Impact & Recycling Statistics */}
              <div className="glass-navy rounded-[28px] p-4 space-y-2.5">
                <span className="text-xs font-bold text-white tracking-tight block">{t("Your Recycling Impact")}</span>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-[#0b1220] p-3 rounded-2xl border border-blue-500/20">
                    <span className="text-[10px] text-blue-300 font-medium block">{t("Containers handed over")}</span>
                    <span className="text-xl font-extrabold text-white mt-0.5 block">
                      {handoverStatus && !handovers.length ? '—' : recycledContainers}
                    </span>
                    <span className="text-[10px] text-blue-200/50">Plastic, cans & glass</span>
                  </div>
                  <div className="bg-[#0b1220] p-3 rounded-2xl border border-emerald-500/20">
                    <span className="text-[10px] text-emerald-400 font-medium block">
                      {t("Recorded handovers")}
                    </span>
                    <span className="text-xl font-extrabold text-[#00e599] mt-0.5 block">
                      {handoverStatus && !handovers.length ? '—' : completedPickups.length}
                    </span>
                    <span className="text-[10px] text-emerald-300/50">Pickups marked complete</span>
                  </div>
                </div>
              </div>

              <ImpactAchievement key={currentUser.id} userId={currentUser.id} containers={recycledContainers} completed={completedPickups.length} />

              {/* Contact Details & Revolut Handle */}
              <div className="glass-navy rounded-[28px] p-4 space-y-2.5">
                <span className="text-xs font-bold text-white tracking-tight block">{t("Payment & Contact Info")}</span>

                <div className="space-y-2 text-xs">
                  <div className="bg-[#0b1220] p-2.5 rounded-xl border border-white/5 flex items-center justify-between">
                    <span className="text-slate-400">Revolut Handle</span>
                    <span className="font-mono text-blue-300 font-bold">
                      {currentUser?.revolut_tag || '—'}
                    </span>
                  </div>
                  <div className="bg-[#0b1220] p-2.5 rounded-xl border border-white/5 flex items-center justify-between">
                    <span className="text-slate-400">{t("Phone Number")}</span>
                    <span className="text-white font-semibold">
                      {currentUser?.phone || '—'}
                    </span>
                  </div>
                  <div className="bg-[#0b1220] p-2.5 rounded-xl border border-white/5 flex items-center justify-between">
                    <span className="text-slate-400">{t("Default Locality")}</span>
                    <span className="text-white font-semibold">
                      {currentUser.locality ? currentUser.locality + ', Malta' : '—'}
                    </span>
                  </div>
                </div>
              </div>

              <button type="button" className="min-h-11 w-full rounded-xl bg-blue-950/40 px-3 text-left text-sm font-semibold text-blue-100"
                onClick={() => setShowGuide(true)}>{t("Getting started")}</button>

              {/* Account management */}
              <div className="space-y-2 pt-1">
                <Link href="/settings" className="flex min-h-11 items-center gap-2 rounded-xl bg-blue-950/40 px-3 text-sm font-semibold text-blue-100 hover:bg-blue-900/40">
                  <Settings className="size-4 text-blue-300" aria-hidden="true" />{' ' + t("Settings")}</Link>
                <Link href="/balance" className="flex min-h-11 items-center gap-2 rounded-xl bg-blue-950/40 px-3 text-sm font-semibold text-blue-100 hover:bg-blue-900/40">
                  <Wallet className="size-4 text-blue-300" aria-hidden="true" />{' ' + t("Balance")}</Link>
                <Link href="/help" className="flex min-h-11 items-center gap-2 rounded-xl bg-blue-950/40 px-3 text-sm font-semibold text-blue-100 hover:bg-blue-900/40">
                  <CircleHelp className="size-4 text-blue-300" aria-hidden="true" />{' ' + t("Help & FAQ")}</Link>
                <button
                  onClick={handleSignOut}
                  className="w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-red-400 text-xs font-semibold transition flex items-center justify-center gap-1"
                >
                  <LogOut className="w-3 h-3" />
                  <span>{t("Log out")}</span>
                </button>
              </div>
            </section>
          )}
        </main>

        {/* Bottom Navigation Bar */}
        {!conversationOffer && <footer className="relative z-10 flex shrink-0 justify-around border-t border-blue-500/15 bg-[#090e1a] px-5 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] text-xs font-semibold text-blue-200/60">
          {!canUseRadar && (<button
            onClick={() => setActiveTab('resident')}
            className={`flex flex-col items-center gap-1 transition ${
              activeTab === 'resident' ? 'text-white' : 'hover:text-white'
            }`}
          >
            <Package className={`w-4 h-4 ${activeTab === 'resident' ? 'text-[#0066ff]' : ''}`} />
            <span className="text-[10px]">{t("Give")}</span>
          </button>)}
          {canUseRadar && (<button
            onClick={() => setActiveTab('driver')}
            className={`flex flex-col items-center gap-1 transition ${
              activeTab === 'driver' ? 'text-white' : 'hover:text-white'
            }`}
          >
            <Compass className={`w-4 h-4 ${activeTab === 'driver' ? 'text-[#0066ff]' : ''}`} />
            <span className="text-[10px]">{t("Radar")}</span>
          </button>)}
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex flex-col items-center gap-1 transition ${
              activeTab === 'chat' ? 'text-white' : 'hover:text-white'
            }`}
          >
            <MessageSquare className={`w-4 h-4 ${activeTab === 'chat' ? 'text-[#0066ff]' : ''}`} />
            <span className="text-[10px]">{t("Pickups")}</span>
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex flex-col items-center gap-1 transition ${
              activeTab === 'profile' ? 'text-white' : 'hover:text-white'
            }`}
          >
            <User className={`w-4 h-4 ${activeTab === 'profile' ? 'text-[#0066ff]' : ''}`} />
            <span className="text-[10px]">{t("Profile")}</span>
          </button>
        </footer>}

        <dialog ref={restrictionDialog} aria-labelledby="pickup-restriction-title"
          onCancel={(event) => { event.preventDefault(); setRestriction(undefined); }}
          className="m-auto max-w-sm space-y-3 rounded-2xl bg-[#0e1626] p-5 text-white backdrop:bg-black/70">
          <h2 id="pickup-restriction-title" className="font-bold">{t("Pickup request blocked")}</h2>
          <p>{restriction?.message}</p>
          <div className="flex gap-3">
            <button type="button" className="rounded-lg border border-blue-400/30 px-3 py-2" onClick={() => setRestriction(undefined)}>{t("Close")}</button>
            <button type="button" className="blue-btn rounded-lg px-3 py-2" onClick={() => {
              setMapOfferId(null);
              setRestriction(undefined);
              if (restriction?.pickupId) openActivity(restriction.pickupId);
              else { setSelectedId(null); setActiveTab('chat'); }
            }}>{restriction?.pickupId ? t("Go to Pickup") : t("Go to Pickups")}</button>
          </div>
        </dialog>

        {/* Authentication Modal */}
        {report && <ReportPickup {...report} onClose={() => setReport(undefined)} />}
        {showGuide && <GettingStarted onClose={() => setShowGuide(false)} />}
        <AuthModal
          isOpen={isAuthOpen}
          onClose={() => setIsAuthOpen(false)}
          recovery={recovery}
          onAuthSuccess={(user, verified) => {
            if (sessionId.current !== user.id) return;
            setCurrentUser(user);
            setIsAuthOpen(false);
            setActionError('');
            if (verified) setShowGuide(true);
            setToastMessage(verified ? 'Email verified. Signed in.' : `Signed in as ${user.full_name}.`);
          }}
          onPasswordUpdated={() => {
            setRecovery(false);
            setIsAuthOpen(false);
            setToastMessage('Password updated.');
          }}
        />

        {/* Notification Center Modal */}
        <NotificationModal
          isOpen={isNotifOpen}
          userId={sessionUser?.id}
          onClose={() => setIsNotifOpen(false)}
          onOpenPickup={openActivity}
          notifications={notifications}
          error={inbox.error}
          onMarkAllAsRead={() => {
            setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
            void inbox.markRead();
          }}
        />
      </div>
    </div>
  );
}
