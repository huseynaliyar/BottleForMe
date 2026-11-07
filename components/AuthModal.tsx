'use client';

import { useState } from 'react';
import { X, User, Lock, Mail, Phone, MapPin, Camera, Zap, Check } from 'lucide-react';
import { UserProfile, UserRole, MALTA_LOCALITIES } from '@/lib/types';
import { DEMO_GIVER, DEMO_TAKER, registerUser, saveStoredUser } from '@/lib/auth';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (user: UserProfile) => void;
}

export default function AuthModal({ isOpen, onClose, onAuthSuccess }: AuthModalProps) {
  const [mode, setMode] = useState<'signin' | 'register'>('register');
  const [role, setRole] = useState<UserRole>('giver');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('+356 ');
  const [revolutTag, setRevolutTag] = useState('@');
  const [locality, setLocality] = useState('Sliema');
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      if (mode === 'register') {
        if (!fullName.trim() || !email.trim()) {
          setErrorMsg('Please enter your full name and email.');
          setLoading(false);
          return;
        }

        const user = await registerUser({
          full_name: fullName.trim(),
          email: email.trim(),
          password,
          role,
          phone: phone.trim(),
          revolut_tag: revolutTag.trim(),
          locality,
          avatar_url: avatarUrl || undefined,
        });

        onAuthSuccess(user);
        onClose();
      } else {
        // Sign in mode: match demo or create logged in session
        if (!email.trim()) {
          setErrorMsg('Please enter your email.');
          setLoading(false);
          return;
        }

        const user: UserProfile = {
          id: `usr-${Date.now()}`,
          email: email.trim(),
          full_name: email.split('@')[0] || 'User',
          phone: '+356 9900 1122',
          revolut_tag: `@${email.split('@')[0]}`,
          role,
          avatar_url: avatarUrl || '/logo.jpg',
          locality: 'Sliema',
          rating: 5.0,
          total_bottles_recycled: 10,
          total_earnings: 1.0,
        };

        saveStoredUser(user);
        onAuthSuccess(user);
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = (demoUser: UserProfile) => {
    saveStoredUser(demoUser);
    onAuthSuccess(demoUser);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-[390px] bg-[#090f1d] border border-blue-500/30 rounded-[32px] p-5 shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
        {/* Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-20 bg-blue-600/20 blur-[50px] pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.08] relative z-10">
          <div>
            <h3 className="text-base font-extrabold text-white">
              {mode === 'register' ? 'Join BottleForMe' : 'Welcome Back'}
            </h3>
            <p className="text-xs text-blue-200/60 mt-0.5">
              {mode === 'register' ? 'Register as a Giver or Taker' : 'Log in to your account'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Demo Selector */}
        <div className="my-3 p-2.5 bg-blue-950/40 rounded-2xl border border-blue-500/20">
          <span className="text-[10px] uppercase font-bold text-blue-400 tracking-wider block mb-1.5">
            ⚡ Quick Test (1-Tap Switch)
          </span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleQuickDemo(DEMO_GIVER)}
              className="py-1.5 px-2 bg-blue-600/30 hover:bg-blue-600 text-white rounded-xl text-xs font-bold border border-blue-500/40 transition flex items-center justify-center gap-1"
            >
              <span>🎁 Giver (Maria)</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickDemo(DEMO_TAKER)}
              className="py-1.5 px-2 bg-emerald-500/20 hover:bg-emerald-500 text-emerald-200 hover:text-white rounded-xl text-xs font-bold border border-emerald-500/30 transition flex items-center justify-center gap-1"
            >
              <span>🚛 Taker (Alex)</span>
            </button>
          </div>
        </div>

        {/* Tabs: Sign In vs Register */}
        <div className="flex bg-[#070b14] p-1 rounded-xl mb-3 border border-white/5">
          <button
            type="button"
            onClick={() => setMode('register')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${
              mode === 'register' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Register
          </button>
          <button
            type="button"
            onClick={() => setMode('signin')}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${
              mode === 'signin' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Log In
          </button>
        </div>

        {/* Scrollable Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-red-500/20 border border-red-500/30 text-red-200 text-xs font-medium">
              {errorMsg}
            </div>
          )}

          {/* Role Selection */}
          <div>
            <label className="text-[11px] font-bold text-blue-200 block mb-1.5">
              Select Your Role <span className="text-red-400">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRole('giver')}
                className={`p-3 rounded-2xl border text-left transition ${
                  role === 'giver'
                    ? 'bg-blue-600/30 border-blue-500 text-white shadow-[0_0_15px_rgba(0,102,255,0.3)]'
                    : 'bg-[#0d1527] border-white/10 text-slate-400 hover:border-white/20'
                }`}
              >
                <div className="text-base mb-1">🎁</div>
                <div className="font-extrabold text-white text-xs">Giver</div>
                <p className="text-[10px] text-blue-200/60 leading-tight mt-0.5">
                  I have bottles & cans to give away or split
                </p>
              </button>

              <button
                type="button"
                onClick={() => setRole('taker')}
                className={`p-3 rounded-2xl border text-left transition ${
                  role === 'taker'
                    ? 'bg-emerald-500/20 border-emerald-500 text-white shadow-[0_0_15px_rgba(0,229,153,0.3)]'
                    : 'bg-[#0d1527] border-white/10 text-slate-400 hover:border-white/20'
                }`}
              >
                <div className="text-base mb-1">🚛</div>
                <div className="font-extrabold text-[#00e599] text-xs">Taker</div>
                <p className="text-[10px] text-emerald-200/60 leading-tight mt-0.5">
                  I collect bottles & cans to earn recycling deposit
                </p>
              </button>
            </div>
          </div>

          {/* Profile Picture Upload */}
          {mode === 'register' && (
            <div>
              <label className="text-[11px] font-bold text-blue-200 block mb-1">
                Profile Photo
              </label>
              <div className="flex items-center gap-3">
                <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-blue-500/40 bg-blue-950/60 flex items-center justify-center shrink-0">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-6 h-6 text-blue-400" />
                  )}
                </div>
                <label className="cursor-pointer px-3 py-2 bg-blue-950/60 hover:bg-blue-900/60 border border-blue-500/30 rounded-xl text-blue-300 text-xs font-semibold flex items-center gap-1.5 transition">
                  <Camera className="w-3.5 h-3.5 text-blue-400" />
                  <span>Upload Picture</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          )}

          {/* Full Name */}
          {mode === 'register' && (
            <div>
              <label className="text-[11px] font-semibold text-slate-300 block mb-1">Full Name</label>
              <input
                type="text"
                placeholder="e.g. Maria Borg"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-[#0d1527] border border-blue-500/25 rounded-xl px-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          )}

          {/* Email */}
          <div>
            <label className="text-[11px] font-semibold text-slate-300 block mb-1">Email</label>
            <input
              type="email"
              placeholder="maria@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#0d1527] border border-blue-500/25 rounded-xl px-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Password */}
          <div>
            <label className="text-[11px] font-semibold text-slate-300 block mb-1">Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#0d1527] border border-blue-500/25 rounded-xl px-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Phone & Revolut */}
          {mode === 'register' && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">Phone</label>
                  <input
                    type="tel"
                    placeholder="+356 9912 3456"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-[#0d1527] border border-blue-500/25 rounded-xl px-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">Revolut Tag</label>
                  <input
                    type="text"
                    placeholder="@username"
                    value={revolutTag}
                    onChange={(e) => setRevolutTag(e.target.value)}
                    className="w-full bg-[#0d1527] border border-blue-500/25 rounded-xl px-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">Town / Locality</label>
                <select
                  value={locality}
                  onChange={(e) => setLocality(e.target.value)}
                  className="w-full bg-[#0d1527] border border-blue-500/25 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-blue-500"
                >
                  {MALTA_LOCALITIES.map((loc) => (
                    <option key={loc.id} value={loc.name}>
                      {loc.name} ({loc.region})
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* Submit */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 blue-btn rounded-2xl text-white font-extrabold text-sm tracking-tight flex items-center justify-center gap-2 cursor-pointer shadow-lg disabled:opacity-50"
            >
              <span>
                {loading
                  ? 'Saving...'
                  : mode === 'register'
                  ? `Create ${role === 'giver' ? 'Giver' : 'Taker'} Account`
                  : 'Sign In'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
