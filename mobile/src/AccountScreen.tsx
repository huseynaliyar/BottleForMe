import { useLanguage } from '../../lib/language-context';
import { useRef, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Camera, CircleHelp, LogOut, Settings, Wallet } from 'lucide-react-native';
import { Image, Keyboard, Pressable, ScrollView, View } from 'react-native';
import ImpactAchievement from './ImpactAchievement';
import { balanceNote, formatEuro, pickupBalance } from '../../lib/pickup-balance';
import { gettingStarted } from '../../lib/getting-started';
import { supportFaq } from '../../lib/support-faq';
import { draftTerms, draftTermsVersion } from '../../lib/draft-terms';
import { authErrorCode, signupCodeError } from '../../lib/signup-otp';
import { useSignupCode } from '../../lib/use-signup-code';
import { formatPhone, phoneCountries } from '../../lib/phone';
import { REVOLUT_TAG } from '../../lib/pickup-validation';
import type { PickupOffer, UserProfile } from '../../lib/types';
import { errorMessage, register, resendSignupCode, resetPassword, signIn, supabase, verifySignupCode } from './backend';
import { Badge, Button, Card, Dialog, ErrorText, Field, localityOptions, Loading, Metric, Segmented, Select, Text, useUi } from './ui';

type Mode = 'signin' | 'register' | 'reset' | 'verify';
const modes = [
  { value: 'signin', label: 'Log in' }, { value: 'register', label: 'Register' }, { value: 'reset', label: 'Forgot password' },
] as const;
const roles = [{ value: 'giver', label: 'Giver' }, { value: 'taker', label: 'Taker' }] as const;

export function AccountDialog({ onClose, onSignedIn }: { onClose: () => void; onSignedIn: (verified?: boolean) => void }) {
  const { t } = useLanguage();
  const { colors, styles } = useUi();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneCountry, setPhoneCountry] = useState('MT');
  const [tag, setTag] = useState('');
  const [locality, setLocality] = useState(localityOptions[0].value);
  const [role, setRole] = useState<'giver' | 'taker'>('giver');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const pending = useRef(false);
  const otp = useSignupCode();

  const emailError = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? '' : 'Enter a valid email address.';
  const nameError = mode === 'register' && !name.trim() ? 'Enter your full name.' : '';
  const passwordError = mode === 'register' && password.length < 6 ? 'Use at least 6 characters for your password.'
    : mode === 'signin' && !password ? 'Enter your password.' : '';
  const codeError = mode === 'verify' && !/^\d{6}$/.test(code) ? 'Enter the six-digit code from your email.' : '';
  const tagError = mode === 'register' && tag.trim() && !REVOLUT_TAG.test(tag.trim()) ? 'Enter a valid Revolut tag or leave it blank.' : '';

  function switchMode(next: Mode) {
    if (pending.current) return;
    setMode(next);
    setTermsAccepted(false);
    setShowTerms(false);
    setPassword('');
    setCode('');
    setError('');
    setNotice('');
    setAttempted(false);
  }

  async function submit() {
    if (pending.current) return;
    setAttempted(true);
    setError('');
    setNotice('');
    if ((mode === 'verify' && !otp.canVerify()) || (mode === 'reset' && otp.resetSeconds > 0)) return;
    if (emailError || nameError || passwordError || tagError || codeError) return;
    pending.current = true;
    setBusy(true);
    Keyboard.dismiss();
    try {
      if (mode === 'signin') {
        await signIn(email.trim(), password);
        onSignedIn();
      } else if (mode === 'verify') {
        await verifySignupCode(email.trim(), code);
        onSignedIn(true);
      } else if (mode === 'register') {
        if (!termsAccepted) { setError('Accept the draft Terms & Conditions to register.'); return; }
        await register(email.trim(), password, {
          terms_version: draftTermsVersion,
          full_name: name.trim(), role, phone: formatPhone(phoneCountry, phone), revolut_tag: tag.trim(), locality,
        });
        otp.sent();
        setMode('verify');
        setPassword('');
        setCode('');
        setAttempted(false);
        setNotice('Enter the six-digit code from your email. If your email has a confirmation link, open it, then sign in.');
      } else {
        await resetPassword(email.trim());
        otp.resetRequested();
        setNotice('If an account exists, a password reset link will be sent. Open it in your browser.');
      }
    } catch (cause) {
      if (mode === 'reset' && authErrorCode(cause) === 'over_request_rate_limit') otp.resetRequested(cause);
      if (mode === 'signin' && cause && typeof cause === 'object' && 'code' in cause && cause.code === 'email_not_confirmed') {
        setMode('verify');
        setPassword('');
        setAttempted(false);
        setNotice('Enter the six-digit code from your email. If your email has a confirmation link, open it, then sign in.');
      } else if (mode === 'verify') {
        otp.verificationFailed(cause);
        setError(signupCodeError(cause, 'verify'));
      } else {
        setError(errorMessage(cause));
      }
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  async function resend() {
    if (pending.current || !otp.canResend()) return;
    if (emailError) { setAttempted(true); return; }
    pending.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await resendSignupCode(email.trim());
      otp.sent();
      setNotice('If the account is awaiting confirmation, check your email for a new verification message.');
    } catch (cause) {
      if (['over_request_rate_limit', 'over_email_send_rate_limit'].includes(String(authErrorCode(cause)))) otp.sent();
      setError(signupCodeError(cause, 'resend'));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return <Dialog title={mode === 'register' ? 'Join BottleForMe' : mode === 'reset' ? 'Reset password' : mode === 'verify' ? 'Confirm your email' : 'Log in to BottleForMe'}
    onClose={() => { if (!pending.current) onClose(); }}>
    {mode !== 'verify' && <Segmented options={modes} value={mode} onChange={switchMode} />}

    {mode === 'verify' && <Button label={t("Back to log in")} kind="quiet" onPress={() => switchMode('signin')} disabled={busy} />}
    {mode === 'register' && <Field label={t("Full name")} value={name} onChangeText={setName} maxLength={100}
      autoComplete="name" editable={!busy} error={attempted ? nameError : ''} />}
    <Field label={t("Email address")} value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false}
      keyboardType="email-address" autoComplete="email" editable={!busy} error={attempted ? emailError : ''} />
    {mode !== 'reset' && mode !== 'verify' && <Field label={t("Password")} value={password} onChangeText={setPassword} secureTextEntry
      autoCapitalize="none" autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
      editable={!busy} error={attempted ? passwordError : ''} />}
    {mode === 'register' && <>
      <View style={{ gap: 4 }}>
        <Text style={styles.small}>{t("Starting role")}</Text>
        <Segmented options={roles} value={role} onChange={(value) => { if (!busy) setRole(value); }} />
      </View>
      <Select label={t("Country calling code")} value={phoneCountry} options={phoneCountries} onChange={setPhoneCountry} disabled={busy} />
      <Field label={t("Phone (optional)")} value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={40} editable={!busy} />
      <Field label={t("Revolut tag (optional)")} value={tag} onChangeText={setTag} autoCapitalize="none" autoCorrect={false}
        maxLength={51} editable={!busy} error={attempted ? tagError : ''} />
      <View style={{ gap: 4 }}>
        <Text style={styles.small}>{t("Locality")}</Text>
        <Select label={t("Locality")} value={locality} onChange={setLocality} options={localityOptions} disabled={busy} inline />
      </View>
    </>}
    {mode === 'verify' && <>
      <Field label={t("Six-digit code")} value={code} onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad" autoComplete="one-time-code" maxLength={6} editable={!busy} error={attempted ? codeError : ''} />
      <Button label={otp.resendSeconds ? 'Resend in ' + otp.resendSeconds + 's' : t("Resend code")} kind="secondary" onPress={resend} disabled={busy || otp.resendSeconds > 0} />
      {otp.verifySeconds > 0 && <Text style={styles.small}>Try another code in {otp.verifySeconds}s.</Text>}
    </>}
    {notice ? <Text accessibilityLiveRegion="polite" style={[styles.small, { color: colors.green }]}>{notice}</Text> : null}
    <ErrorText message={error || (supabase ? '' : 'Account service is unavailable in this build.')} />
    {mode === 'register' && <>
      <Button label={showTerms ? 'Hide draft terms' : t("Read the draft Terms & Conditions")} kind="quiet" onPress={() => setShowTerms(!showTerms)} />
      {showTerms && draftTerms.map((term) => <Text key={term} style={styles.small}>{term}</Text>)}
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: termsAccepted }} disabled={busy}
        onPress={() => setTermsAccepted(!termsAccepted)} style={styles.inset}>
        <Text style={styles.small}>{termsAccepted ? '☑' : '☐'}{' ' + t("I accept the draft Terms & Conditions.")}</Text>
      </Pressable>
    </>}
    <Button label={busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : mode === 'register' ? 'Create account' : mode === 'verify' ? t("Verify code") : otp.resetSeconds ? 'Send again in ' + otp.resetSeconds + 's' : 'Send reset link'}
      disabled={busy || !supabase || (mode === 'verify' && otp.verifySeconds > 0) || (mode === 'reset' && otp.resetSeconds > 0)} onPress={submit} />
  </Dialog>;
}

export function Avatar({ uri, size = 40 }: { uri?: string; size?: number }) {
  const { colors } = useUi();
  return <Image source={uri && /^data:image\/(jpeg|png|webp);base64,/i.test(uri) ? { uri } : require('../assets/logo.jpg')}
    style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel }} />;
}

function Balance({ userId, offers, loading }: { userId: string; offers: PickupOffer[]; loading: boolean }) {
  const { t } = useLanguage();
  const { colors, styles } = useUi();
  const [open, setOpen] = useState(false);
  const balance = pickupBalance(offers, userId);
  return <>
    <Button label={t("Balance")} kind="secondary" onPress={() => setOpen(true)}><Wallet size={16} color={colors.sky} /></Button>
    {open && <Dialog title={t("Balance")} onClose={() => setOpen(false)}>
      {loading ? <Loading label="Loading pickup estimates…" /> : <>
        <Card style={{ backgroundColor: colors.quiet }}>
          <Text style={styles.small}>{t('Estimated earnings')}</Text>
          <Text weight="bold" style={[styles.pageTitle, styles.tabular]}>{formatEuro(balance.earnings)}</Text>
          <Text style={[styles.body, styles.tabular]}>{t('Total deposit value') + ' · ' + formatEuro(balance.deposit)}</Text>
        </Card>
        <Text style={styles.small}>{balanceNote}</Text>
        <Text weight="bold" style={styles.body}>{t("Completed pickup history")}</Text>
        {!balance.entries.length && <Text style={styles.small}>{t("No completed pickups yet.")}</Text>}
        {balance.entries.map((entry) => <View key={entry.id} style={styles.inset}>
          <Text weight="bold" style={styles.small}>{entry.locality} · {entry.role}</Text>
          <Text style={styles.small}>{new Date(entry.date).toLocaleDateString('en-MT', { timeZone: 'Europe/Malta' })}</Text>
          <Text style={styles.small}>{t("Estimated earnings") + ' '}{formatEuro(entry.earnings)} · Deposit {formatEuro(entry.deposit)}</Text>
        </View>)}
      </>}
    </Dialog>}
  </>;
}

export function GettingStartedDialog({ onClose }: { onClose: () => void }) {
  const { t } = useLanguage();
  const { styles } = useUi();
  const [step, setStep] = useState(0);
  const item = gettingStarted[step];
  const last = step === gettingStarted.length - 1;
  return <Dialog title={t("Getting started")} onClose={onClose}>
    <Text style={styles.small}>Step {step + 1} of {gettingStarted.length}</Text>
    <Text accessibilityRole="header" weight="bold" style={styles.body}>{t(item.title)}</Text>
    <Text accessibilityLiveRegion="polite" style={styles.small}>{t(item.description)}</Text>
    {step > 0 && <Button label={t("Back")} kind="secondary" onPress={() => setStep(step - 1)} />}
    <Button label={last ? t("Done") : t("Next")} onPress={() => last ? onClose() : setStep(step + 1)} />
    {!last && <Button label={t("Skip")} kind="quiet" onPress={onClose} />}
  </Dialog>;
}

function HelpFaq() {
  const { t } = useLanguage();
  const { colors, styles } = useUi();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string>();
  return <>
    <Button label={t("Help & FAQ")} kind="secondary" onPress={() => setOpen(true)}><CircleHelp size={16} color={colors.sky} /></Button>
    {open && <Dialog title={t("Help & FAQ")} onClose={() => setOpen(false)}>
      {supportFaq.map(({ question, answer }) => <View key={question} style={styles.inset}>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: expanded === question }}
          onPress={() => setExpanded(expanded === question ? undefined : question)}>
          <Text weight="bold" style={styles.small}>{t(question)}</Text>
        </Pressable>
        {expanded === question && <Text style={styles.small}>{t(answer)}</Text>}
      </View>)}
    </Dialog>}
  </>;
}

export function ProfileScreen({ profile, signedIn, loading, error, offers, pickupsLoading, onSignIn, onRefresh, onSwitch, onAvatar, onSignOut, onGuide, onSettings }:  {
  profile: UserProfile | null; signedIn: boolean; loading: boolean; error: string; offers: PickupOffer[]; pickupsLoading: boolean;
  onSignIn: () => void; onRefresh: () => void; onSwitch: () => void; onAvatar: (url: string) => Promise<void>; onSignOut: () => void; onGuide: () => void; onSettings: () => void;
}) {
  const { t } = useLanguage();
  const { colors, styles } = useUi();
  const [uploading, setUploading] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const completed = offers.filter((offer) => offer.status === 'completed');
  const recycledContainers = completed.reduce((count, offer) => count + offer.estimated_bottles, 0);
  const taker = profile?.role === 'taker';

  async function choosePhoto() {
    setAvatarError('');
    setUploading(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1] });
      if (result.canceled) return;
      const photo = result.assets[0];
      const edit = ImageManipulator.manipulate(photo.uri);
      if (Math.max(photo.width, photo.height) > 480) edit.resize(photo.width >= photo.height ? { width: 480 } : { height: 480 });
      const rendered = await edit.renderAsync();
      const saved = await rendered.saveAsync({ base64: true, compress: 0.72, format: SaveFormat.JPEG });
      if (!saved.base64 || saved.base64.length > Math.floor(512 * 1024 / 3) * 4) throw new Error('Choose a smaller photo.');
      await onAvatar('data:image/jpeg;base64,' + saved.base64);
    } catch (cause) {
      setAvatarError(errorMessage(cause));
    } finally {
      setUploading(false);
    }
  }

  return <ScrollView contentContainerStyle={styles.scroll}>
    {!profile ? <Card>
      <Text accessibilityRole="header" weight="bold" style={styles.pageTitle}>{t('Your profile')}</Text>
      {loading && <Loading label={t("Loading your profile…")} />}
      <ErrorText message={error} />
      {!signedIn && <>
        <Button label={t('Settings')} kind="secondary" onPress={onSettings} />
        <HelpFaq />
      </>}
      {!signedIn && <Button label={t("Sign in or register")} onPress={onSignIn} style={{ alignSelf: 'flex-start' }} />}
      {signedIn && !loading && <Button label="Reload profile" onPress={onRefresh} style={{ alignSelf: 'flex-start' }} />}
      {signedIn && <Button label={t("Log out")} kind="quiet" onPress={onSignOut} />}
    </Card> : <>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <Pressable accessibilityRole="button" accessibilityLabel={t("Update profile photo")} disabled={uploading} onPress={choosePhoto}>
            <Avatar uri={profile.avatar_url} size={64} />
            <View style={{
              position: 'absolute', right: -3, bottom: -3, width: 24, height: 24, borderRadius: 12,
              backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center',
            }}><Camera color={colors.white} size={13} /></View>
          </Pressable>
          <View style={{ flex: 1, gap: 4 }}>
            <Text weight="heavy" style={[styles.title, { fontSize: 16 }]}>{profile.full_name}</Text>
            <Text style={styles.muted}>{profile.email}</Text>
            <View style={styles.row}>
              <Badge tone={taker ? 'green' : 'blue'}>{taker ? '🚛 Active Taker' : '🎁 Active Giver'}</Badge>
              <Text style={styles.muted}>📍 {profile.locality || '—'}</Text>
            </View>
          </View>
        </View>
        {uploading && <Loading label="Updating photo…" />}
        <ErrorText message={avatarError} />
        <View style={[styles.between, styles.rule]}>
          <View style={{ flex: 1 }}>
            <Text weight="bold" style={styles.small}>{t("Switch Active Role")}</Text>
            <Text style={styles.muted}>Currently acting as {taker ? 'Taker (Collector)' : 'Giver (Resident)'}</Text>
          </View>
          <Button label={taker ? t("Switch to Giver") : t("Switch to Taker")} kind="secondary" onPress={onSwitch} disabled={uploading} />
        </View>
      </Card>
      <Card>
        <Text weight="bold" style={styles.small}>{t("Your Recycling Impact")}</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Metric label={t("Containers handed over")} value={pickupsLoading && !offers.length ? '—' : String(recycledContainers)}
            caption="Plastic, cans & glass" />
          <Metric label={t("Recorded handovers")} value={pickupsLoading && !offers.length ? '—' : String(completed.length)} caption="Pickups marked complete" green />
        </View>
      </Card>
      <ImpactAchievement userId={profile.id} containers={recycledContainers} completed={completed.length} />
      <Card>
        <Text weight="bold" style={styles.small}>{t("Payment & Contact Info")}</Text>
        {[
          ['Revolut Handle', profile.revolut_tag], ['Phone Number', profile.phone],
          ['Default Locality', profile.locality && profile.locality + ', Malta'],
        ].map(([label, value]) => <View key={label} style={[styles.inset, styles.between, { borderColor: colors.subtle }]}>
          <Text style={styles.muted}>{t(label)}</Text>
          <Text weight="semibold" style={styles.small}>{value || '—'}</Text>
        </View>)}
      </Card>
      <Button label={t("Settings")} kind="secondary" onPress={onSettings}><Settings size={16} color={colors.sky} /></Button>
      <Balance userId={profile.id} offers={offers} loading={pickupsLoading} />
      <HelpFaq />
      <Button label={t("Getting started")} kind="secondary" onPress={onGuide} />
      <Button label={t("Log out")} kind="quiet" onPress={onSignOut} disabled={uploading}>
        <LogOut size={13} color={colors.muted} />
      </Button>
    </>}
  </ScrollView>;
}
