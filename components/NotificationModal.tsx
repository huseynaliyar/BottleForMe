'use client';

import { useEffect, useRef } from 'react';
import { Bell, X } from 'lucide-react';
import { NotificationItem } from '@/lib/types';
import WebPushControl from './WebPushControl';

export default function NotificationModal({ isOpen, onClose, notifications, error, onMarkAllAsRead, userId, onOpenPickup }: {
  isOpen: boolean;
  userId?: string;
  onClose: () => void;
  notifications: (NotificationItem & { pickupChat?: boolean })[];
  error?: string;
  onOpenPickup: (pickupId: string, chat?: boolean) => void;
  onMarkAllAsRead: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (isOpen && element && !element.open) element.showModal();
    if (!isOpen && element?.open) element.close();
  }, [isOpen]);

  return (
    <dialog
      ref={dialog}
      aria-labelledby="activity-title"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      className="m-auto max-h-[85dvh] w-[calc(100%-1.5rem)] max-w-[390px] overflow-y-auto rounded-[28px] border border-blue-500/30 bg-[#090f1d] p-5 text-slate-100 backdrop:bg-black/80"
    >
      <header className="mb-3 flex items-center justify-between gap-2">
        <h2 id="activity-title" className="flex items-center gap-2 font-bold"><Bell className="size-4" /> Recent activity</h2>
        <button type="button" aria-label="Close notifications" onClick={onClose} className="rounded-xl p-2 hover:bg-white/10"><X className="size-4" /></button>
      </header>
      {error && <p role="alert" className="mb-3 text-xs text-red-300">{error}</p>}
      {isOpen && userId && <WebPushControl key={userId} userId={userId} />}
      {notifications.some((item) => !item.read && !item.pickupChat) && (
        <button type="button" onClick={onMarkAllAsRead} className="mb-2 text-xs font-semibold text-blue-300">Mark all as read</button>
      )}
      {notifications.length ? (
        <ul className="space-y-2">
          {notifications.map((item) => (
            <li key={item.id} className={`rounded-xl border p-3 text-xs ${item.read ? 'border-white/10' : 'border-blue-500/40 bg-blue-950'}`}>
              <strong>{item.title}</strong>
              <p>{item.message}</p>
              <small className="text-blue-200">{item.timestamp}</small>
              {item.pickupId && <button type="button" className="mt-1 block font-semibold text-blue-300" onClick={() => onOpenPickup(item.pickupId!, item.pickupChat)}>{item.pickupChat ? 'Open chat' : 'View pickup'}</button>}
            </li>
          ))}
        </ul>
      ) : <p className="text-sm text-blue-200">No activity yet.</p>}
    </dialog>
  );
}
