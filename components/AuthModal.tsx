'use client';

import { useState } from 'react';
import { X, User, Lock, Mail, Phone, MapPin, Camera, Zap, Check, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { UserProfile, UserRole, MALTA_LOCALITIES } from '@/lib/types';
import { DEMO_GIVER, DEMO_TAKER, registerWithSupabase, signInWithSupabase, saveStoredUser } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/supabase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (user: UserProfile, message?: string) => void;
}

export default function AuthModal({ isOpen, onClose, onAuthSuccess }: AuthModalProps) {
  const [mode, setMode] = useState<'signin' | 'register'>('register');
  const [role, setRole] = useState<UserRole>('giver');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState('+356 ');
  const [revolutTag, setRevolutTag] = useState('@');
  const [locality, setLocality] = useState('Sliema');
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

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
    setInfoMsg(null);
    setLoading(true);

    try {
      if (mode === 'register') {
        if (!fullName.trim() || !email.trim()) {
          setErrorMsg('Please enter your full name and email.');
          setLoading(false);
          return;
        }

        if (!password || password.length < 6) {
          setErrorMsg('Password must be at least 6 characters.');
          setLoading(false);
          return;
        }

        const result = await registerWithSupabase({
          full_name: fullName.trim(),
          email: email.trim(),
          password,
          role,
          phone: phone.trim(),
          revolut_tag: revolutTag.trim(),
          locality,
          avatar_url: avatarUrl || undefined,
        });

        if (result.message) {
          setInfoMsg(result.message);
        }
        onAuthSuccess(result.user, result.message);
        onClose();
      } else {
        // Sign In mode
        if (!email.trim() || !password) {
          setErrorMsg('Please enter your email and password.');
          setLoading(false);
          return;
        }

        const user = await signInWithSupabase(email.trim(), password);
        onAuthSuccess(user, `Welcome back, ${user.full_name}!`);
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication error. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = (demoUser: UserProfile) => {
    saveStoredUser(demoUser);
    onAuthSuccess(demoUser, `Switched to demo ${demoUser.role}: ${demoUser.full_name}`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-[390px] bg-[#090f1d] border border-blue-500/30 rounded-[32px] p-5 shadow-2xl relative overflow-hidden flex flex-col max-h-[92vh]">
        {/* Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-20 bg-blue-600/20 blur-[50px] pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.08] relative z-10">
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-base font-extrabold text-white">
                {mode === 'register' ? 'Join BottleForMe' : 'Welcome Back'}
              </h3>
              {isSupabaseConfigured() && (
                <span className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-[#00e599] border border-emerald-500/30">
                  <ShieldCheck className="w-2.5 h-2.5" />
                  Supabase Auth
                </span>
              )}
            </div>
            <p className="text-xs text-blue-200/60 mt-0.5">
              {mode === 'register' ? 'Register as Giver or Taker' : 'Secure Supabase Login'}
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
        <div className="my-2.5 p-2.5 bg-blue-950/40 rounded-2xl border border-blue-500/20">
          <span className="text-[10px] uppercase font-bold text-blue-400 tracking-wider block mb-1">
            ⚡ Quick Test Profiles (1-Tap Switch)
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
            onClick={() => {
              setMode('register');
              setErrorMsg(null);
            }}
            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${
              mode === 'register' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Register
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('signin');
              setErrorMsg(null);
            }}
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
              ⚠️ {errorMsg}
            </div>
          )}

          {infoMsg && (
            <div className="p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-200 text-xs font-medium">
              ℹ️ {infoMsg}
            </div>
          )}

          {/* Role Selection (on Register) */}
          {mode === 'register' && (
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
          )}

          {/* Profile Picture Upload */}
          {mode === 'register' && (
            <div>
              <label className="text-[11px] font-bold text-blue-200 block mb-1">
                Profile Photo (Optional)
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
                  <span>Choose Photo</span>
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
              <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                Full Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Maria Borg"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-[#0d1527] border border-blue-500/25 rounded-xl px-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          )}

          {/* Email */}
          <div>
            <label className="text-[11px] font-semibold text-slate-300 block mb-1">
              Email Address <span className="text-red-400">*</span>
            </label>
            <input
              type="email"
              required
              placeholder="maria@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#0d1527] border border-blue-500/25 rounded-xl px-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Password with View Toggle */}
          <div>
            <label className="text-[11px] font-semibold text-slate-300 block mb-1">
              Password {mode === 'register' ? '(Min 6 chars)' : ''} <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#0d1527] border border-blue-500/25 rounded-xl px-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Phone & Revolut (Register mode) */}
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
                  ? 'Authenticating with Supabase...'
                  : mode === 'register'
                  ? `Create Secure ${role === 'giver' ? 'Giver' : 'Taker'} Account`
                  : 'Sign In to Supabase'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
