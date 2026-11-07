'use client';

import { useState, useEffect } from 'react';
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
  Code2
} from 'lucide-react';
import { MALTA_LOCALITIES, calculateBcrsSplit, PickupOffer } from '@/lib/types';
import { INITIAL_OFFERS } from '@/lib/mock-data';

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<'resident' | 'driver' | 'chat'>('resident');
  const [bags, setBags] = useState<number>(2);
  const [splitPercent, setSplitPercent] = useState<number>(50);
  const [locality, setLocality] = useState<string>('Sliema');
  const [revolutTag, setRevolutTag] = useState<string>('@maria_mlt');
  const [addressNotes, setAddressNotes] = useState<string>('Tower Road, Apt 4');
  const [offers, setOffers] = useState<PickupOffer[]>(INITIAL_OFFERS);
  const [selectedOffer, setSelectedOffer] = useState<PickupOffer | null>(INITIAL_OFFERS[0]);
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const { estimatedBottles, totalBcrsValue, sellerPayout, collectorProfit } =
    calculateBcrsSplit(bags, splitPercent);

  // Auto-dismiss toast
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const handlePublishOffer = async () => {
    setIsPublishing(true);
    try {
      const res = await fetch('/api/pickups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seller_name: 'Maria Borg',
          seller_revolut_tag: revolutTag,
          locality,
          address_notes: addressNotes,
          bag_count: bags,
          split_percentage: splitPercent,
          payout_method: 'revolut',
        }),
      });

      if (res.ok) {
        const created: PickupOffer = await res.json();
        setOffers((prev) => [created, ...prev]);
        setToastMessage(`✓ Offer published to Malta Radar! ${created.bag_count} bags in ${created.locality}.`);
        setActiveTab('driver');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsPublishing(false);
    }
  };

  const handleReserve = (offer: PickupOffer) => {
    setSelectedOffer(offer);
    setActiveTab('chat');
    setToastMessage(`✓ Reserved ${offer.bag_count} bags in ${offer.locality}! Chat now open.`);
  };

  return (
    <div className="flex justify-center min-h-screen p-2 sm:p-6 bg-[#05070c]">
      {/* Mobile Frame Container */}
      <div className="w-full max-w-[420px] bg-[#080b12] rounded-[36px] shadow-[0_25px_60px_-15px_rgba(0,102,255,0.2)] border border-white/[0.08] overflow-hidden flex flex-col relative">

        {/* Ambient Lighting */}
        <div className="absolute top-0 left-1/4 -translate-x-1/2 w-64 h-40 bg-blue-600/20 blur-[70px] pointer-events-none" />
        <div className="absolute top-10 right-0 w-48 h-40 bg-emerald-500/10 blur-[70px] pointer-events-none" />

        {/* Header */}
        <header className="p-5 pt-6 pb-3 relative z-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="relative">
                <img
                  src="/logo.jpg"
                  alt="BottleForMe"
                  className="w-11 h-11 rounded-2xl border-2 border-blue-500/40 object-cover shadow-lg"
                />
                <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-[#00e599] rounded-full border-2 border-[#080b12]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-extrabold tracking-tight text-white leading-none">
                    BottleForMe
                  </h1>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-500/15 text-[#3b82f6] border border-blue-500/30">
                    Malta BCRS
                  </span>
                </div>
                <p className="text-xs text-blue-200/60 font-medium mt-1">
                  Doorstep Deposit Exchange
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                aria-label="Notifications"
                className="w-9 h-9 rounded-full bg-blue-950/40 border border-blue-500/20 flex items-center justify-center text-blue-200 hover:text-white hover:bg-blue-900/40 transition"
              >
                <Bell className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Segmented Switcher */}
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

        {/* Toast Notification */}
        {toastMessage && (
          <div className="mx-5 mb-2 p-3 bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 text-xs font-semibold rounded-2xl shadow-lg animate-fade-in flex items-center gap-2">
            <Check className="w-4 h-4 text-[#00e599] shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Scrollable Content */}
        <main className="flex-1 px-5 pb-5 space-y-4 overflow-y-auto relative z-10">

          {/* ================= 1. RESIDENT VIEW ================= */}
          {activeTab === 'resident' && (
            <section className="space-y-4">
              {/* Hero Card */}
              <div className="glass-navy rounded-[28px] p-5 relative overflow-hidden">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400">
                      Zero Queues · Home Pickup
                    </span>
                    <h2 className="text-xl font-bold text-white tracking-tight mt-0.5">
                      Turn empties into cash.
                    </h2>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-[#00e599]/10 border border-[#00e599]/25 text-[#00e599]">
                    €0.10 BCRS
                  </span>
                </div>

                {/* Bag Counter */}
                <div className="mt-4 pt-4 border-t border-white/[0.08] flex items-center justify-between">
                  <div>
                    <span className="text-xs text-blue-200/60 font-medium">Bags to collect</span>
                    <div className="flex items-baseline gap-2 mt-0.5">
                      <span className="text-3xl font-extrabold text-white">{bags}</span>
                      <span className="text-xs font-semibold text-blue-300">Recycling Bags</span>
                    </div>
                    <p className="text-[11px] text-[#00e599] font-medium mt-0.5">
                      ~{estimatedBottles} containers & cans
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setBags((b) => Math.max(1, b - 1))}
                      className="w-10 h-10 rounded-xl bg-blue-950/40 hover:bg-blue-900/50 active:scale-95 text-white font-bold flex items-center justify-center border border-blue-500/25 transition"
                    >
                      −
                    </button>
                    <button
                      onClick={() => setBags((b) => Math.min(10, b + 1))}
                      className="w-10 h-10 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold flex items-center justify-center shadow-[0_0_15px_rgba(0,102,255,0.4)] transition"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* Findflasche 50/50 Split Slider */}
              <div className="glass-navy rounded-[28px] p-5 space-y-3.5">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-xs font-bold text-white tracking-tight">Deposit Split Ratio</span>
                    <p className="text-[11px] text-blue-200/60">
                      Total BCRS Value:{' '}
                      <span className="text-white font-semibold">€{totalBcrsValue.toFixed(2)}</span>
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
                  <div className="flex justify-between text-[11px] text-blue-200/60 font-medium mt-2 px-0.5">
                    <span>0% (Free Gift)</span>
                    <span className="text-blue-300">50% (Recommended)</span>
                    <span>70%</span>
                  </div>
                </div>

                {/* Split Metrics */}
                <div className="grid grid-cols-2 gap-2.5 pt-2">
                  <div className="bg-[#0b1220] rounded-2xl p-3 border border-blue-500/20">
                    <span className="text-[11px] text-blue-300 font-medium block">You Get (At Door)</span>
                    <span className="text-xl font-extrabold text-white mt-0.5 block">
                      €{sellerPayout.toFixed(2)}
                    </span>
                    <span className="text-[10px] text-blue-200/50">Direct Revolut / Cash</span>
                  </div>
                  <div className="bg-[#0b1220] rounded-2xl p-3 border border-emerald-500/20">
                    <span className="text-[11px] text-emerald-400 font-medium block">Collector Margin</span>
                    <span className="text-xl font-extrabold text-[#00e599] mt-0.5 block">
                      €{collectorProfit.toFixed(2)}
                    </span>
                    <span className="text-[10px] text-emerald-300/50">RVM redemption cut</span>
                  </div>
                </div>
              </div>

              {/* Handover Details */}
              <div className="glass-navy rounded-[28px] p-5 space-y-3">
                <span className="text-xs font-bold text-white tracking-tight block">
                  Location & Contact Details
                </span>

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <select
                      value={locality}
                      onChange={(e) => setLocality(e.target.value)}
                      className="w-full bg-[#0b1220] border border-blue-500/25 text-white text-xs font-semibold rounded-2xl px-3.5 py-3 appearance-none focus:outline-none focus:border-blue-500"
                    >
                      {MALTA_LOCALITIES.map((loc) => (
                        <option key={loc.id} value={loc.name}>
                          {loc.name} ({loc.active_offers} active)
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    className="px-3.5 py-3 bg-blue-900/30 hover:bg-blue-800/40 border border-blue-500/30 text-blue-300 rounded-2xl text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    <MapPin className="w-3.5 h-3.5 text-blue-400" />
                    Pin
                  </button>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="@your_revolut_tag"
                    value={revolutTag}
                    onChange={(e) => setRevolutTag(e.target.value)}
                    className="flex-1 bg-[#0b1220] border border-blue-500/25 text-white text-xs rounded-2xl px-3.5 py-3 placeholder-blue-300/40 focus:outline-none focus:border-blue-500"
                  />
                  <input
                    type="text"
                    placeholder="Street / notes"
                    value={addressNotes}
                    onChange={(e) => setAddressNotes(e.target.value)}
                    className="flex-1 bg-[#0b1220] border border-blue-500/25 text-white text-xs rounded-2xl px-3.5 py-3 placeholder-blue-300/40 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Publish Button */}
              <button
                disabled={isPublishing}
                onClick={handlePublishOffer}
                className="w-full py-4 rounded-2xl blue-btn text-white font-extrabold text-sm tracking-tight flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <span>{isPublishing ? 'Publishing...' : 'Publish Collection Request'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </section>
          )}

          {/* ================= 2. COLLECTOR / RADAR VIEW ================= */}
          {activeTab === 'driver' && (
            <section className="space-y-3.5">
              {/* Radar HUD Card */}
              <div className="glass-navy rounded-[28px] p-5 relative overflow-hidden">
                <div className="flex justify-between items-center mb-3">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400">
                      Malta Central Radar
                    </span>
                    <h3 className="text-lg font-bold text-white tracking-tight mt-0.5">
                      {offers.length} Live Pickup Requests
                    </h3>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300 text-xs font-semibold">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                    Active Sweep
                  </div>
                </div>

                {/* Stylized Radar Sweep Graphic */}
                <div className="relative h-28 rounded-2xl bg-[#090f1a] border border-blue-500/25 overflow-hidden flex items-center justify-center">
                  <div className="absolute w-24 h-24 rounded-full border border-blue-500/25" />
                  <div className="absolute w-44 h-44 rounded-full border border-blue-500/15" />
                  <div className="w-8 h-8 rounded-full bg-blue-600/30 flex items-center justify-center">
                    <div className="w-3 h-3 rounded-full bg-[#0066ff] shadow-[0_0_14px_#0066ff]" />
                  </div>
                  <div className="absolute top-4 left-8 px-2 py-0.5 rounded-full bg-blue-900/60 border border-blue-400/30 text-[10px] text-blue-200 font-semibold">
                    Sliema · 2 Bags
                  </div>
                  <div className="absolute bottom-4 right-10 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-[10px] text-[#00e599] font-bold">
                    Gzira · Free
                  </div>
                </div>
              </div>

              {/* Offer Feed List */}
              <div className="space-y-3">
                {offers.map((offer) => (
                  <div
                    key={offer.id}
                    className="glass-navy rounded-[24px] p-4 space-y-3 hover:border-blue-400/50 transition"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
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
                          {offer.bag_count} Bags (~{offer.estimated_bottles} bottles)
                        </h4>
                        <p className="text-xs text-blue-200/60 mt-0.5">{offer.address_notes}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 font-medium block">Your Net Cut</span>
                        <span className="text-base font-extrabold text-[#00e599]">
                          €{offer.collector_profit.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2.5 border-t border-white/[0.08]">
                      <span className="text-xs text-slate-300">
                        Pay Seller:{' '}
                        <strong className="text-white">
                          €{offer.seller_payout.toFixed(2)} {offer.seller_revolut_tag ? `(${offer.seller_revolut_tag})` : ''}
                        </strong>
                      </span>
                      <button
                        onClick={() => handleReserve(offer)}
                        className="px-4 py-2 rounded-xl bg-blue-600/30 hover:bg-blue-600 hover:text-white text-blue-300 text-xs font-bold border border-blue-500/40 transition"
                      >
                        Reserve & Chat →
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
              <div className="glass-navy rounded-[28px] overflow-hidden flex flex-col h-[400px]">
                {/* Chat Top Bar */}
                <div className="p-3.5 bg-blue-950/30 border-b border-blue-500/20 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
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
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-[#00e599] border border-emerald-500/20">
                    Reserved
                  </span>
                </div>

                {/* Message Thread */}
                <div className="flex-1 p-3.5 space-y-2.5 overflow-y-auto text-xs">
                  <div className="bg-blue-950/50 text-slate-200 p-2.5 rounded-2xl rounded-tl-none max-w-[82%] border border-blue-500/15">
                    Hello! I have accepted your reservation for the {selectedOffer?.bag_count || 2} bags.
                  </div>
                  <div className="bg-blue-600 text-white p-2.5 rounded-2xl rounded-tr-none max-w-[82%] ml-auto shadow-sm">
                    Great! I am nearby in {selectedOffer?.locality || 'Sliema'}, can be at your door in 10 mins.
                  </div>
                  <div className="bg-blue-950/50 text-slate-200 p-2.5 rounded-2xl rounded-tl-none max-w-[82%] border border-blue-500/15">
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
                      <span>Pay €{selectedOffer?.seller_payout.toFixed(2) || '3.50'} via Revolut</span>
                    </a>
                    <button
                      onClick={() => {
                        setToastMessage('🎉 Handover confirmed! Bottles collected and direct payment completed.');
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

        </main>

        {/* Bottom Navigation Bar */}
        <footer className="p-3 px-6 bg-[#090e1a] border-t border-blue-500/15 flex justify-around text-xs font-semibold text-blue-200/60 relative z-10">
          <button
            onClick={() => setActiveTab('resident')}
            className={`flex flex-col items-center gap-1 transition ${
              activeTab === 'resident' ? 'text-white' : 'hover:text-white'
            }`}
          >
            <Package className={`w-4 h-4 ${activeTab === 'resident' ? 'text-[#0066ff]' : ''}`} />
            <span className="text-[10px]">Request</span>
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
            onClick={() => setToastMessage('Profile settings & Revolut tag')}
            className="flex flex-col items-center gap-1 hover:text-white transition"
          >
            <User className="w-4 h-4" />
            <span className="text-[10px]">Profile</span>
          </button>
        </footer>

      </div>
    </div>
  );
}
