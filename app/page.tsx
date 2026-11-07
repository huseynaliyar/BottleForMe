'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import {
  Package,
  Compass,
  MessageSquare,
  User,
  MapPin,
  Camera,
  ArrowRight,
  Check,
  Zap,
  Bell,
  Navigation,
  Shield,
  Layers,
  Phone,
  LogOut,
  Sliders,
  ExternalLink,
  Award,
  Sparkles,
} from 'lucide-react';
import {
  MALTA_LOCALITIES,
  calculateDepositSplit,
  PickupOffer,
  UserProfile,
  NotificationItem,
  UserRole,
} from '@/lib/types';
import { INITIAL_OFFERS } from '@/lib/mock-data';
import { getStoredUser, saveStoredUser, DEMO_GIVER, DEMO_TAKER } from '@/lib/auth';
import AuthModal from '@/components/AuthModal';
import NotificationModal from '@/components/NotificationModal';

// Dynamically import Leaflet Map to ensure zero SSR issues
const RadarMap = dynamic(() => import('@/components/RadarMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-72 rounded-2xl bg-[#090f1a] border border-blue-500/20 flex flex-col items-center justify-center text-blue-300 text-xs">
      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-2" />
      <span>Loading Malta Radar Map...</span>
    </div>
  ),
});

const DEFAULT_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif-1',
    title: 'Offer Claimed',
    message: 'Alex Zammit (Taker) reserved your 2 bags in Sliema. Expected at door in 15 mins.',
    timestamp: '10m ago',
    read: false,
    type: 'pickup',
  },
  {
    id: 'notif-2',
    title: 'Radar Alert',
    message: 'New collection request posted in Gzira: 50 plastic & cans (100% Free gift).',
    timestamp: '45m ago',
    read: false,
    type: 'pickup',
  },
  {
    id: 'notif-3',
    title: 'Direct Handover Complete',
    message: 'Handover in Sliema confirmed! €3.75 transferred via Revolut (@maria_mlt).',
    timestamp: '2h ago',
    read: true,
    type: 'payment',
  },
];

export default function HomePage() {
  // Navigation & User State
  const [activeTab, setActiveTab] = useState<'resident' | 'driver' | 'chat' | 'profile'>('resident');
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState<boolean>(false);
  const [isNotifOpen, setIsNotifOpen] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>(DEFAULT_NOTIFICATIONS);

  // Radar View: List vs Map
  const [radarView, setRadarView] = useState<'list' | 'map'>('list');

  // Giver Form State: Plastic, Can, Glass Counters
  const [plasticCount, setPlasticCount] = useState<number>(35);
  const [canCount, setCanCount] = useState<number>(25);
  const [glassCount, setGlassCount] = useState<number>(15);
  const [bags, setBags] = useState<number>(2);
  const [splitPercent, setSplitPercent] = useState<number>(50);
  const [locality, setLocality] = useState<string>('Sliema');
  const [revolutTag, setRevolutTag] = useState<string>('@maria_mlt');
  const [addressNotes, setAddressNotes] = useState<string>('Tower Road, near Preluna');
  const [payoutMethod, setPayoutMethod] = useState<'revolut' | 'cash'>('revolut');

  // Offers State
  const [offers, setOffers] = useState<PickupOffer[]>(INITIAL_OFFERS);
  const [selectedOffer, setSelectedOffer] = useState<PickupOffer | null>(INITIAL_OFFERS[0]);
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [isPinningLocation, setIsPinningLocation] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Initialize User from Storage on Mount
  useEffect(() => {
    const user = getStoredUser();
    if (user) {
      setCurrentUser(user);
      if (user.role === 'taker') {
        setActiveTab('driver');
      }
      if (user.revolut_tag) {
        setRevolutTag(user.revolut_tag);
      }
      if (user.locality) {
        setLocality(user.locality);
      }
    }
  }, []);

  // Sync bags with container estimates
  const totalContainers = plasticCount + canCount + glassCount;
  const { totalDepositValue, sellerPayout, collectorProfit } = calculateDepositSplit(
    plasticCount,
    canCount,
    glassCount,
    splitPercent
  );

  // Auto-dismiss toast
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Geolocation Pin Button Handler
  const handlePinLocation = () => {
    if (!navigator.geolocation) {
      setToastMessage('⚠️ Geolocation not supported by your browser.');
      return;
    }

    setIsPinningLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;

        // Find nearest Malta locality using Euclidean distance
        let closest = MALTA_LOCALITIES[0];
        let minDistance = Infinity;

        MALTA_LOCALITIES.forEach((loc) => {
          const d = Math.hypot(loc.lat - latitude, loc.lng - longitude);
          if (d < minDistance) {
            minDistance = d;
            closest = loc;
          }
        });

        setLocality(closest.name);
        setAddressNotes((prev) => (prev ? `${prev} (GPS matched)` : `Near ${closest.name} center`));
        setToastMessage(`📍 GPS pinned to ${closest.name}!`);
        setIsPinningLocation(false);
      },
      (err) => {
        console.warn('Geolocation error:', err);
        // Default to Sliema if denied/mock
        setLocality('Sliema');
        setToastMessage('📍 Location pinned to Sliema (default).');
        setIsPinningLocation(false);
      },
      { timeout: 7000 }
    );
  };

  // Publish Offer Handler
  const handlePublishOffer = async () => {
    setIsPublishing(true);
    const newOffer: PickupOffer = {
      id: `offer-${Date.now()}`,
      seller_name: currentUser?.full_name || 'Maria Borg',
      seller_phone: currentUser?.phone || '+356 9912 3456',
      seller_revolut_tag: revolutTag,
      locality,
      address_notes: addressNotes,
      bag_count: bags,
      containers: {
        plastic_bottles: plasticCount,
        cans: canCount,
        glass_bottles: glassCount,
      },
      estimated_bottles: totalContainers,
      total_bcrs_value: totalDepositValue,
      split_percentage: splitPercent,
      seller_payout: sellerPayout,
      collector_profit: collectorProfit,
      payout_method: payoutMethod,
      status: 'open',
      lat: MALTA_LOCALITIES.find((l) => l.name === locality)?.lat || 35.9122,
      lng: MALTA_LOCALITIES.find((l) => l.name === locality)?.lng || 14.5042,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      const res = await fetch('/api/pickups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newOffer),
      });

      if (res.ok) {
        const created = await res.json();
        setOffers((prev) => [created, ...prev]);
      } else {
        setOffers((prev) => [newOffer, ...prev]);
      }

      // Add to notifications
      const newNotif: NotificationItem = {
        id: `notif-${Date.now()}`,
        title: 'Listing Published to Radar',
        message: `Your request for ${totalContainers} containers in ${locality} is now visible to nearby collectors.`,
        timestamp: 'Just now',
        read: false,
        type: 'pickup',
      };
      setNotifications((prev) => [newNotif, ...prev]);

      setToastMessage(`✓ Listing live on Radar! ${totalContainers} containers in ${locality}.`);
      setActiveTab('driver');
    } catch (e) {
      setOffers((prev) => [newOffer, ...prev]);
      setToastMessage(`✓ Listing published to Radar!`);
      setActiveTab('driver');
    } finally {
      setIsPublishing(false);
    }
  };

  // Reserve Offer Handler (Taker claims)
  const handleReserve = (offer: PickupOffer) => {
    setSelectedOffer(offer);
    setActiveTab('chat');

    const newNotif: NotificationItem = {
      id: `notif-${Date.now()}`,
      title: 'Route Claimed',
      message: `You reserved ${offer.estimated_bottles} containers in ${offer.locality}. Chat open with ${offer.seller_name}.`,
      timestamp: 'Just now',
      read: false,
      type: 'pickup',
    };
    setNotifications((prev) => [newNotif, ...prev]);
    setToastMessage(`✓ Route claimed for ${offer.locality}! Handover chat open.`);
  };

  // Avatar Upload in Profile
  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && currentUser) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const updated = { ...currentUser, avatar_url: reader.result as string };
        setCurrentUser(updated);
        saveStoredUser(updated);
        setToastMessage('✓ Profile photo updated!');
      };
      reader.readAsDataURL(file);
    }
  };

  // Switch Role
  const handleToggleRole = () => {
    if (!currentUser) return;
    const newRole: UserRole = currentUser.role === 'giver' ? 'taker' : 'giver';
    const updated = { ...currentUser, role: newRole };
    setCurrentUser(updated);
    saveStoredUser(updated);
    setActiveTab(newRole === 'giver' ? 'resident' : 'driver');
    setToastMessage(`Switched mode to ${newRole === 'giver' ? '🎁 Giver' : '🚛 Taker'}`);
  };

  const unreadNotifCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="flex justify-center min-h-screen p-2 sm:p-6 bg-[#05070c]">
      {/* Mobile Frame Container */}
      <div className="w-full max-w-[420px] bg-[#080b12] rounded-[36px] shadow-[0_25px_60px_-15px_rgba(0,102,255,0.2)] border border-white/[0.08] overflow-hidden flex flex-col relative min-h-[780px]">
        {/* Ambient Lighting */}
        <div className="absolute top-0 left-1/4 -translate-x-1/2 w-64 h-40 bg-blue-600/20 blur-[70px] pointer-events-none" />
        <div className="absolute top-10 right-0 w-48 h-40 bg-emerald-500/10 blur-[70px] pointer-events-none" />

        {/* Header */}
        <header className="p-4 pt-5 pb-3 relative z-10">
          <div className="flex items-center justify-between mb-3">
            {/* Logo & Brand Title */}
            <div className="flex items-center space-x-2.5">
              <div className="relative cursor-pointer" onClick={() => setActiveTab('profile')}>
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
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h1 className="text-base font-extrabold tracking-tight text-white leading-none">
                    BottleForMe
                  </h1>
                  <span
                    onClick={handleToggleRole}
                    className={`text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border cursor-pointer transition ${
                      currentUser?.role === 'taker'
                        ? 'bg-emerald-500/15 text-[#00e599] border-emerald-500/30'
                        : 'bg-blue-500/15 text-[#60a5fa] border-blue-500/30'
                    }`}
                  >
                    {currentUser?.role === 'taker' ? '🚛 Taker' : '🎁 Giver'}
                  </span>
                </div>
                <p className="text-[11px] text-blue-200/60 font-medium mt-0.5">
                  Plastic · Cans · Glass Collection
                </p>
              </div>
            </div>

            {/* Header Action Buttons */}
            <div className="flex items-center gap-1.5">
              {/* Notifications Bell */}
              <button
                onClick={() => setIsNotifOpen(true)}
                aria-label="Notifications"
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
                className="w-9 h-9 rounded-full bg-blue-950/40 border border-blue-500/20 flex items-center justify-center text-blue-200 hover:text-white hover:bg-blue-900/40 transition"
              >
                <User className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Top Segmented Switcher */}
          <div className="bg-[#0e1626] p-1 rounded-2xl flex text-xs font-semibold border border-blue-500/20 shadow-inner">
            <button
              onClick={() => setActiveTab('resident')}
              className={`flex-1 py-2 rounded-xl transition-all duration-200 font-bold ${
                activeTab === 'resident'
                  ? 'bg-[#0066ff] text-white shadow'
                  : 'text-blue-200/70 hover:text-white'
              }`}
            >
              Give Empties
            </button>
            <button
              onClick={() => setActiveTab('driver')}
              className={`flex-1 py-2 rounded-xl transition-all duration-200 ${
                activeTab === 'driver'
                  ? 'bg-[#0066ff] text-white shadow font-bold'
                  : 'text-blue-200/70 hover:text-white'
              }`}
            >
              Radar ({offers.length})
            </button>
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex-1 py-2 rounded-xl transition-all duration-200 relative ${
                activeTab === 'chat'
                  ? 'bg-[#0066ff] text-white shadow font-bold'
                  : 'text-blue-200/70 hover:text-white'
              }`}
            >
              Handover
              <span className="w-1.5 h-1.5 rounded-full bg-[#00e599] inline-block ml-1" />
            </button>
          </div>
        </header>

        {/* Toast Notification Banner */}
        {toastMessage && (
          <div className="mx-4 mb-2 p-3 bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 text-xs font-semibold rounded-2xl shadow-lg animate-fade-in flex items-center gap-2">
            <Check className="w-4 h-4 text-[#00e599] shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Scrollable Content Viewport */}
        <main className="flex-1 px-4 pb-4 space-y-4 overflow-y-auto relative z-10">
          {/* ================= 1. GIVER / RESIDENT VIEW ================= */}
          {activeTab === 'resident' && (
            <section className="space-y-3.5">
              {/* Hero Card */}
              <div className="glass-navy rounded-[28px] p-4 relative overflow-hidden">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">
                      Zero Queues · Doorstep Pickup
                    </span>
                    <h2 className="text-lg font-bold text-white tracking-tight mt-0.5">
                      Turn empties into cash.
                    </h2>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-[#00e599]/10 border border-[#00e599]/25 text-[#00e599]">
                    €0.10 deposit
                  </span>
                </div>

                {/* 3 Container Categories Breakdown (Plastic, Cans, Glass) */}
                <div className="mt-3.5 pt-3 border-t border-white/[0.08] space-y-2.5">
                  <span className="text-[11px] font-bold text-blue-200/70 uppercase tracking-wider block">
                    Containers to Hand Over:
                  </span>

                  <div className="grid grid-cols-3 gap-2">
                    {/* Plastic Bottles */}
                    <div className="bg-[#0b1220] p-2.5 rounded-2xl border border-blue-500/20 text-center flex flex-col justify-between">
                      <div>
                        <span className="text-base">🧴</span>
                        <div className="text-[10px] font-bold text-white mt-0.5">Plastic</div>
                        <div className="text-xs font-extrabold text-blue-300">{plasticCount}</div>
                      </div>
                      <div className="flex justify-center gap-1.5 mt-2">
                        <button
                          type="button"
                          onClick={() => setPlasticCount((c) => Math.max(0, c - 5))}
                          className="w-6 h-6 rounded-lg bg-white/5 hover:bg-white/10 text-white font-bold text-xs"
                        >
                          −
                        </button>
                        <button
                          type="button"
                          onClick={() => setPlasticCount((c) => c + 5)}
                          className="w-6 h-6 rounded-lg bg-blue-600 text-white font-bold text-xs"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Cans */}
                    <div className="bg-[#0b1220] p-2.5 rounded-2xl border border-blue-500/20 text-center flex flex-col justify-between">
                      <div>
                        <span className="text-base">🥫</span>
                        <div className="text-[10px] font-bold text-white mt-0.5">Cans</div>
                        <div className="text-xs font-extrabold text-blue-300">{canCount}</div>
                      </div>
                      <div className="flex justify-center gap-1.5 mt-2">
                        <button
                          type="button"
                          onClick={() => setCanCount((c) => Math.max(0, c - 5))}
                          className="w-6 h-6 rounded-lg bg-white/5 hover:bg-white/10 text-white font-bold text-xs"
                        >
                          −
                        </button>
                        <button
                          type="button"
                          onClick={() => setCanCount((c) => c + 5)}
                          className="w-6 h-6 rounded-lg bg-blue-600 text-white font-bold text-xs"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Glass Bottles */}
                    <div className="bg-[#0b1220] p-2.5 rounded-2xl border border-blue-500/20 text-center flex flex-col justify-between">
                      <div>
                        <span className="text-base">🍾</span>
                        <div className="text-[10px] font-bold text-white mt-0.5">Glass</div>
                        <div className="text-xs font-extrabold text-blue-300">{glassCount}</div>
                      </div>
                      <div className="flex justify-center gap-1.5 mt-2">
                        <button
                          type="button"
                          onClick={() => setGlassCount((c) => Math.max(0, c - 5))}
                          className="w-6 h-6 rounded-lg bg-white/5 hover:bg-white/10 text-white font-bold text-xs"
                        >
                          −
                        </button>
                        <button
                          type="button"
                          onClick={() => setGlassCount((c) => c + 5)}
                          className="w-6 h-6 rounded-lg bg-blue-600 text-white font-bold text-xs"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Bag count counter */}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-blue-200/70 font-medium">
                      Total: <strong className="text-white">{totalContainers} items</strong> in {bags} bags
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setBags((b) => Math.max(1, b - 1))}
                        className="px-2.5 py-1 rounded-lg bg-white/5 text-white text-xs font-bold"
                      >
                        − Bag
                      </button>
                      <button
                        type="button"
                        onClick={() => setBags((b) => Math.min(10, b + 1))}
                        className="px-2.5 py-1 rounded-lg bg-blue-600 text-white text-xs font-bold"
                      >
                        + Bag
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Deposit Split Slider Card */}
              <div className="glass-navy rounded-[28px] p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-xs font-bold text-white tracking-tight">Deposit Split Ratio</span>
                    <p className="text-[11px] text-blue-200/60">
                      Total Deposit Value:{' '}
                      <span className="text-white font-semibold">€{totalDepositValue.toFixed(2)}</span>
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
                    max="70"
                    step="10"
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
                    <span className="text-[10px] text-blue-300 font-medium block">You Get (At Door)</span>
                    <span className="text-lg font-extrabold text-white mt-0.5 block">
                      €{sellerPayout.toFixed(2)}
                    </span>
                    <span className="text-[10px] text-blue-200/50">Direct Revolut / Cash</span>
                  </div>
                  <div className="bg-[#0b1220] rounded-2xl p-2.5 border border-emerald-500/20">
                    <span className="text-[10px] text-emerald-400 font-medium block">Taker Reward</span>
                    <span className="text-lg font-extrabold text-[#00e599] mt-0.5 block">
                      €{collectorProfit.toFixed(2)}
                    </span>
                    <span className="text-[10px] text-emerald-300/50">Recycling cash margin</span>
                  </div>
                </div>
              </div>

              {/* Location & Contact Details Card (FIXED LAYOUT - NO OVERFLOW) */}
              <div className="glass-navy rounded-[28px] p-4 space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-white tracking-tight">
                    Location & Contact Details
                  </span>
                  <span className="text-[10px] text-blue-400 font-semibold">Malta</span>
                </div>

                {/* Locality Dropdown & Working Pin Button */}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 min-w-0">
                    <select
                      value={locality}
                      onChange={(e) => setLocality(e.target.value)}
                      className="w-full bg-[#0b1220] border border-blue-500/25 text-white text-xs font-semibold rounded-2xl px-3 py-2.5 appearance-none focus:outline-none focus:border-blue-500 truncate"
                    >
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
                    <span>{isPinningLocation ? 'Locating...' : 'Pin GPS'}</span>
                  </button>
                </div>

                {/* Revolut Tag Full-Width Row */}
                <div>
                  <input
                    type="text"
                    placeholder="@your_revolut_tag (e.g. @maria_mlt)"
                    value={revolutTag}
                    onChange={(e) => setRevolutTag(e.target.value)}
                    className="w-full bg-[#0b1220] border border-blue-500/25 text-white text-xs rounded-2xl px-3 py-2.5 placeholder-blue-300/40 focus:outline-none focus:border-blue-500 box-border"
                  />
                </div>

                {/* Address Notes Full-Width Row */}
                <div>
                  <input
                    type="text"
                    placeholder="Street, door/intercom, landmark (e.g. Tower Road)"
                    value={addressNotes}
                    onChange={(e) => setAddressNotes(e.target.value)}
                    className="w-full bg-[#0b1220] border border-blue-500/25 text-white text-xs rounded-2xl px-3 py-2.5 placeholder-blue-300/40 focus:outline-none focus:border-blue-500 box-border"
                  />
                </div>

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

              {/* Publish Request Button */}
              <button
                disabled={isPublishing}
                onClick={handlePublishOffer}
                className="w-full py-3.5 rounded-2xl blue-btn text-white font-extrabold text-sm tracking-tight flex items-center justify-center gap-2 cursor-pointer shadow-lg disabled:opacity-50"
              >
                <span>{isPublishing ? 'Broadcasting...' : 'Publish Collection Request'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </section>
          )}

          {/* ================= 2. TAKER / RADAR VIEW ================= */}
          {activeTab === 'driver' && (
            <section className="space-y-3.5">
              {/* Radar HUD Card with Map/List Toggle */}
              <div className="glass-navy rounded-[28px] p-4 relative overflow-hidden">
                <div className="flex justify-between items-center mb-2.5">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">
                      Malta Collector Radar
                    </span>
                    <h3 className="text-base font-bold text-white tracking-tight mt-0.5">
                      {offers.length} Live Pickup Requests
                    </h3>
                  </div>

                  {/* List vs Map Switcher */}
                  <div className="bg-[#0b1220] p-0.5 rounded-xl border border-blue-500/25 flex">
                    <button
                      onClick={() => setRadarView('list')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                        radarView === 'list'
                          ? 'bg-blue-600 text-white'
                          : 'text-blue-200/60 hover:text-white'
                      }`}
                    >
                      Feed
                    </button>
                    <button
                      onClick={() => setRadarView('map')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                        radarView === 'map'
                          ? 'bg-blue-600 text-white'
                          : 'text-blue-200/60 hover:text-white'
                      }`}
                    >
                      🗺️ Map
                    </button>
                  </div>
                </div>

                {/* Radar Interactive Map */}
                {radarView === 'map' ? (
                  <RadarMap
                    offers={offers}
                    selectedOffer={selectedOffer}
                    onSelectOffer={handleReserve}
                  />
                ) : (
                  /* Stylized Sweep Graphic for Feed mode */
                  <div className="relative h-24 rounded-2xl bg-[#090f1a] border border-blue-500/25 overflow-hidden flex items-center justify-center">
                    <div className="absolute w-20 h-20 rounded-full border border-blue-500/25" />
                    <div className="absolute w-36 h-36 rounded-full border border-blue-500/15" />
                    <div className="w-7 h-7 rounded-full bg-blue-600/30 flex items-center justify-center">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#0066ff] shadow-[0_0_12px_#0066ff]" />
                    </div>
                    <div className="absolute top-2 left-4 px-2 py-0.5 rounded-full bg-blue-900/60 border border-blue-400/30 text-[9px] text-blue-200 font-semibold">
                      Sliema · 2 Bags
                    </div>
                    <div className="absolute bottom-2 right-4 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-[9px] text-[#00e599] font-bold">
                      Gzira · Free
                    </div>
                  </div>
                )}
              </div>

              {/* Offer Feed List */}
              <div className="space-y-2.5">
                {offers.map((offer) => (
                  <div
                    key={offer.id}
                    className="glass-navy rounded-[24px] p-3.5 space-y-2.5 hover:border-blue-400/50 transition"
                  >
                    <div className="flex justify-between items-start">
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
                          {offer.bag_count} Bags (~{offer.estimated_bottles} plastic, cans, glass)
                        </h4>
                        <p className="text-[11px] text-blue-200/60 mt-0.5">{offer.address_notes}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[10px] text-slate-400 font-medium block">Taker Reward</span>
                        <span className="text-base font-extrabold text-[#00e599]">
                          €{offer.collector_profit.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-white/[0.08]">
                      <span className="text-[11px] text-slate-300">
                        Pay Giver:{' '}
                        <strong className="text-white">
                          €{offer.seller_payout.toFixed(2)}{' '}
                          {offer.seller_revolut_tag ? `(${offer.seller_revolut_tag})` : ''}
                        </strong>
                      </span>
                      <button
                        onClick={() => handleReserve(offer)}
                        className="px-3.5 py-1.5 rounded-xl bg-blue-600/30 hover:bg-blue-600 hover:text-white text-blue-300 text-xs font-bold border border-blue-500/40 transition shadow-sm"
                      >
                        Claim Route →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ================= 3. IN-APP CHAT & HANDOVER ================= */}
          {activeTab === 'chat' && (
            <section className="space-y-3">
              <div className="glass-navy rounded-[28px] overflow-hidden flex flex-col h-[420px]">
                {/* Chat Top Bar */}
                <div className="p-3 bg-blue-950/40 border-b border-blue-500/20 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-blue-600/30 text-blue-200 font-bold text-xs flex items-center justify-center border border-blue-500/40">
                      {selectedOffer ? selectedOffer.seller_name.slice(0, 2).toUpperCase() : 'MB'}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">
                        {selectedOffer?.seller_name || 'Maria Borg'}
                      </h4>
                      <p className="text-[10px] text-blue-200/60">
                        {selectedOffer?.locality || 'Sliema'} · {selectedOffer?.bag_count || 2} Bags Reserved
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-[#00e599] border border-emerald-500/20">
                    Route Claimed
                  </span>
                </div>

                {/* Message Thread */}
                <div className="flex-1 p-3 space-y-2.5 overflow-y-auto text-xs">
                  <div className="bg-blue-950/50 text-slate-200 p-2.5 rounded-2xl rounded-tl-none max-w-[85%] border border-blue-500/15">
                    Hello! I have accepted your reservation for the {selectedOffer?.bag_count || 2} bags of
                    plastic bottles & cans.
                  </div>
                  <div className="bg-blue-600 text-white p-2.5 rounded-2xl rounded-tr-none max-w-[85%] ml-auto shadow-sm">
                    Great! I am nearby in {selectedOffer?.locality || 'Sliema'}, can be at your door in 10 mins.
                  </div>
                  <div className="bg-blue-950/50 text-slate-200 p-2.5 rounded-2xl rounded-tl-none max-w-[85%] border border-blue-500/15">
                    {selectedOffer?.address_notes || 'Intercom 4, 2nd floor'}. You can pay the €
                    {selectedOffer?.seller_payout.toFixed(2) || '3.50'} via Revolut{' '}
                    <span className="text-blue-300 font-mono">
                      {selectedOffer?.seller_revolut_tag || '@maria_mlt'}
                    </span>{' '}
                    or cash.
                  </div>
                </div>

                {/* Direct Handover & Revolut Action Footer */}
                <div className="p-3 bg-[#080d17] border-t border-blue-500/20 space-y-2">
                  <div className="flex gap-2">
                    <a
                      href={`https://revolut.me/${
                        selectedOffer?.seller_revolut_tag?.replace('@', '') || 'maria_mlt'
                      }?amount=${selectedOffer?.seller_payout || 3.5}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-2.5 rounded-xl bg-[#0066ff] hover:bg-[#0052cc] text-white text-xs font-bold text-center flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(0,102,255,0.3)] transition"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>Pay €{selectedOffer?.seller_payout.toFixed(2) || '3.50'} Revolut</span>
                    </a>
                    <button
                      onClick={() => {
                        setToastMessage(
                          '🎉 Handover confirmed! Bottles collected and direct payment completed.'
                        );
                        setActiveTab('driver');
                      }}
                      className="flex-1 py-2.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.15] border border-white/10 text-white text-xs font-bold text-center transition"
                    >
                      ✓ Confirm Handover
                    </button>
                  </div>
                  <p className="text-[10px] text-center text-blue-300/40">
                    Zero custody: P2P payment executed directly between users.
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* ================= 4. PROFILE & SETTINGS TAB ================= */}
          {activeTab === 'profile' && (
            <section className="space-y-3.5">
              {/* Profile Card with Photo Upload */}
              <div className="glass-navy rounded-[28px] p-4 relative overflow-hidden">
                <div className="flex items-center gap-3.5">
                  {/* Avatar with Camera Overlay */}
                  <div className="relative group shrink-0">
                    <img
                      src={currentUser?.avatar_url || '/logo.jpg'}
                      alt="Avatar"
                      className="w-16 h-16 rounded-3xl object-cover border-2 border-blue-500/40 shadow-xl"
                    />
                    <label className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center cursor-pointer shadow-md transition">
                      <Camera className="w-3 h-3" />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarUpload}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {/* Name, Role & Email */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-base font-extrabold text-white truncate">
                        {currentUser?.full_name || 'Maria Borg'}
                      </h3>
                      <span className="text-xs text-amber-400">★ 5.0</span>
                    </div>
                    <p className="text-[11px] text-blue-200/60 truncate">
                      {currentUser?.email || 'maria@bottleforme.mt'}
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
                        📍 {currentUser?.locality || 'Sliema'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Role Switcher Action */}
                <div className="mt-3.5 pt-3 border-t border-white/[0.08] flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-white block">Switch Active Role</span>
                    <p className="text-[10px] text-blue-200/60">
                      Currently acting as {currentUser?.role === 'taker' ? 'Taker (Collector)' : 'Giver (Resident)'}
                    </p>
                  </div>
                  <button
                    onClick={handleToggleRole}
                    className="px-3 py-1.5 rounded-xl bg-blue-600/30 hover:bg-blue-600 text-blue-200 hover:text-white border border-blue-500/40 text-xs font-bold transition flex items-center gap-1"
                  >
                    <span>Switch to {currentUser?.role === 'taker' ? 'Giver' : 'Taker'}</span>
                  </button>
                </div>
              </div>

              {/* Impact & Recycling Statistics */}
              <div className="glass-navy rounded-[28px] p-4 space-y-2.5">
                <span className="text-xs font-bold text-white tracking-tight block">
                  Your Recycling Impact
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-[#0b1220] p-3 rounded-2xl border border-blue-500/20">
                    <span className="text-[10px] text-blue-300 font-medium block">Containers Recycled</span>
                    <span className="text-xl font-extrabold text-white mt-0.5 block">
                      {currentUser?.total_bottles_recycled || 185}
                    </span>
                    <span className="text-[10px] text-blue-200/50">Plastic, cans & glass</span>
                  </div>
                  <div className="bg-[#0b1220] p-3 rounded-2xl border border-emerald-500/20">
                    <span className="text-[10px] text-emerald-400 font-medium block">
                      {currentUser?.role === 'taker' ? 'Cash Earned' : 'Cash Saved'}
                    </span>
                    <span className="text-xl font-extrabold text-[#00e599] mt-0.5 block">
                      €{(currentUser?.total_earnings || 9.25).toFixed(2)}
                    </span>
                    <span className="text-[10px] text-emerald-300/50">Direct P2P payouts</span>
                  </div>
                </div>
              </div>

              {/* Contact Details & Revolut Handle */}
              <div className="glass-navy rounded-[28px] p-4 space-y-2.5">
                <span className="text-xs font-bold text-white tracking-tight block">
                  Payment & Contact Info
                </span>

                <div className="space-y-2 text-xs">
                  <div className="bg-[#0b1220] p-2.5 rounded-xl border border-white/5 flex items-center justify-between">
                    <span className="text-slate-400">Revolut Handle</span>
                    <span className="font-mono text-blue-300 font-bold">
                      {currentUser?.revolut_tag || '@maria_mlt'}
                    </span>
                  </div>
                  <div className="bg-[#0b1220] p-2.5 rounded-xl border border-white/5 flex items-center justify-between">
                    <span className="text-slate-400">Phone Number</span>
                    <span className="text-white font-semibold">
                      {currentUser?.phone || '+356 9912 3456'}
                    </span>
                  </div>
                  <div className="bg-[#0b1220] p-2.5 rounded-xl border border-white/5 flex items-center justify-between">
                    <span className="text-slate-400">Default Locality</span>
                    <span className="text-white font-semibold">
                      {currentUser?.locality || 'Sliema'}, Malta
                    </span>
                  </div>
                </div>
              </div>

              {/* Account Management & Demo Switcher */}
              <div className="space-y-2 pt-1">
                <button
                  onClick={() => setIsAuthOpen(true)}
                  className="w-full py-2.5 rounded-xl bg-blue-950/40 hover:bg-blue-900/40 border border-blue-500/30 text-blue-200 text-xs font-bold transition flex items-center justify-center gap-1.5"
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Register Another Account / Log In</span>
                </button>

                <button
                  onClick={() => {
                    saveStoredUser(null);
                    setCurrentUser(null);
                    setIsAuthOpen(true);
                    setToastMessage('Logged out.');
                  }}
                  className="w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-red-400 text-xs font-semibold transition flex items-center justify-center gap-1"
                >
                  <LogOut className="w-3 h-3" />
                  <span>Log Out</span>
                </button>
              </div>
            </section>
          )}
        </main>

        {/* Bottom Navigation Bar */}
        <footer className="p-2.5 px-5 bg-[#090e1a] border-t border-blue-500/15 flex justify-around text-xs font-semibold text-blue-200/60 relative z-10">
          <button
            onClick={() => setActiveTab('resident')}
            className={`flex flex-col items-center gap-1 transition ${
              activeTab === 'resident' ? 'text-white' : 'hover:text-white'
            }`}
          >
            <Package className={`w-4 h-4 ${activeTab === 'resident' ? 'text-[#0066ff]' : ''}`} />
            <span className="text-[10px]">Give</span>
          </button>
          <button
            onClick={() => setActiveTab('driver')}
            className={`flex flex-col items-center gap-1 transition ${
              activeTab === 'driver' ? 'text-white' : 'hover:text-white'
            }`}
          >
            <Compass className={`w-4 h-4 ${activeTab === 'driver' ? 'text-[#0066ff]' : ''}`} />
            <span className="text-[10px]">Radar</span>
          </button>
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex flex-col items-center gap-1 transition ${
              activeTab === 'chat' ? 'text-white' : 'hover:text-white'
            }`}
          >
            <MessageSquare className={`w-4 h-4 ${activeTab === 'chat' ? 'text-[#0066ff]' : ''}`} />
            <span className="text-[10px]">Handover</span>
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex flex-col items-center gap-1 transition ${
              activeTab === 'profile' ? 'text-white' : 'hover:text-white'
            }`}
          >
            <User className={`w-4 h-4 ${activeTab === 'profile' ? 'text-[#0066ff]' : ''}`} />
            <span className="text-[10px]">Profile</span>
          </button>
        </footer>

        {/* Authentication Modal */}
        <AuthModal
          isOpen={isAuthOpen}
          onClose={() => setIsAuthOpen(false)}
          onAuthSuccess={(user) => {
            setCurrentUser(user);
            if (user.role === 'taker') {
              setActiveTab('driver');
            } else {
              setActiveTab('resident');
            }
            setToastMessage(`Welcome, ${user.full_name}! Signed in as ${user.role}.`);
          }}
        />

        {/* Notification Center Modal */}
        <NotificationModal
          isOpen={isNotifOpen}
          onClose={() => setIsNotifOpen(false)}
          notifications={notifications}
          onMarkAllAsRead={() => {
            setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
            setToastMessage('All notifications marked as read.');
          }}
        />
      </div>
    </div>
  );
}
