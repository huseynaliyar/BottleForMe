'use client';

import { useState } from 'react';
import { X, Bell, CheckCheck, MapPin, Zap, Check, AlertCircle } from 'lucide-react';
import { NotificationItem } from '@/lib/types';

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  onMarkAllAsRead: () => void;
  onNotificationClick?: (item: NotificationItem) => void;
}

export default function NotificationModal({
  isOpen,
  onClose,
  notifications,
  onMarkAllAsRead,
  onNotificationClick,
}: NotificationModalProps) {
  const [pushStatus, setPushStatus] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleEnablePush = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPushStatus('Browser does not support desktop notifications.');
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setPushStatus('✓ Device notifications enabled!');
        new Notification('BottleForMe Malta', {
          body: '🎉 Notifications enabled! You will be alerted when new bottles/cans are listed or claimed.',
          icon: '/logo.jpg',
        });
      } else {
        setPushStatus('Notification permission was declined.');
      }
    } catch (e: any) {
      setPushStatus('Could not enable notifications.');
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-[390px] bg-[#090f1d] border border-blue-500/30 rounded-[32px] p-5 shadow-2xl relative overflow-hidden flex flex-col max-h-[85vh]">
        {/* Ambient Glow */}
        <div className="absolute top-0 right-0 w-44 h-24 bg-blue-600/20 blur-[50px] pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.08] relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-white">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-600 text-white">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <p className="text-[11px] text-blue-200/60">Live pickup & handover alerts</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Push Notification Opt-in Card */}
        <div className="my-3 p-3 bg-blue-950/40 rounded-2xl border border-blue-500/20 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              <span className="text-xs font-bold text-white">Device Push Alerts</span>
            </div>
            <button
              onClick={handleEnablePush}
              className="text-[11px] font-bold px-2.5 py-1 rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition shadow-sm"
            >
              Enable Now
            </button>
          </div>
          <p className="text-[10px] text-blue-200/60 leading-relaxed">
            Get instant sounds & alerts when a Taker claims your bottles or when a Giver lists nearby empties.
          </p>
          {pushStatus && (
            <div className="text-[11px] font-semibold text-[#00e599] bg-emerald-500/10 p-1.5 rounded-lg border border-emerald-500/20 flex items-center gap-1.5">
              <Check className="w-3 h-3 text-[#00e599]" />
              <span>{pushStatus}</span>
            </div>
          )}
        </div>

        {/* Action Bar */}
        <div className="flex justify-between items-center mb-2 px-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Recent Activity</span>
          {unreadCount > 0 && (
            <button
              onClick={onMarkAllAsRead}
              className="text-[11px] text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Mark all read</span>
            </button>
          )}
        </div>

        {/* Notification List */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 text-xs">
          {notifications.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>No notifications yet</p>
            </div>
          ) : (
            notifications.map((item) => (
              <div
                key={item.id}
                onClick={() => onNotificationClick && onNotificationClick(item)}
                className={`p-3 rounded-2xl border transition cursor-pointer ${
                  !item.read
                    ? 'bg-blue-950/40 border-blue-500/40 shadow-sm'
                    : 'bg-[#0a1120] border-white/5 opacity-80 hover:opacity-100'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5">
                    <div
                      className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                        item.type === 'pickup'
                          ? 'bg-blue-600/30 text-blue-300'
                          : item.type === 'payment'
                          ? 'bg-emerald-500/20 text-[#00e599]'
                          : item.type === 'arrival'
                          ? 'bg-purple-500/20 text-purple-300'
                          : 'bg-white/10 text-slate-300'
                      }`}
                    >
                      {item.type === 'pickup' ? (
                        <MapPin className="w-3.5 h-3.5" />
                      ) : item.type === 'payment' ? (
                        <Zap className="w-3.5 h-3.5" />
                      ) : (
                        <Bell className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="font-bold text-white text-xs">{item.title}</h4>
                        {!item.read && (
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-300 mt-0.5 leading-snug">
                        {item.message}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400 whitespace-nowrap shrink-0">
                    {item.timestamp}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
