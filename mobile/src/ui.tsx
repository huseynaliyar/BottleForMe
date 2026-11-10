import { useState, type PropsWithChildren } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text as NativeText, TextInput, View } from 'react-native';
import type { StyleProp, TextInputProps, TextProps, TextStyle, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronDown, X } from 'lucide-react-native';
import { useLanguage } from '../../lib/language-context';
import { isRtl } from '../../lib/locale';
import { MALTA_LOCALITIES } from '../../lib/types';
import { useAppearance } from './appearance';

export const darkPalette = {
  background: '#080b12', outer: '#05070c', panel: '#090f1d', field: '#0b1220', bar: '#090e1a',
  white: '#ffffff', ink: '#f1f5f9', blue: '#0066ff', sky: '#60a5fa', lightBlue: '#93c5fd',
  muted: '#a1b5d0', border: 'rgba(59,130,246,0.25)', subtle: 'rgba(255,255,255,0.08)',
  green: '#00e599', greenBorder: 'rgba(16,185,129,0.30)', greenTint: 'rgba(16,185,129,0.15)', red: '#fca5a5',
  onAccent: '#ffffff', placeholder: '#7892b2', cardTop: '#111c32', cardBottom: '#0a101e',
  chip: '#13294d', quiet: '#192133', secondary: '#132b54', picker: '#0e1626', redTint: '#350f1a',
  redBorder: '#763147', ambient: '#0d1a32',
};

export const lightPalette: typeof darkPalette = {
  background: '#f8fbff', outer: '#e8f0fa', panel: '#ffffff', field: '#f2f7fd', bar: '#f0f6fe',
  white: '#0d203a', ink: '#172a45', blue: '#0057d1', sky: '#1556a2', lightBlue: '#234e83',
  muted: '#435b78', border: '#c8d9ec', subtle: '#dbe5f0',
  green: '#006244', greenBorder: '#98cdb8', greenTint: '#e5f7ee', red: '#9d1837',
  onAccent: '#ffffff', placeholder: '#506a89', cardTop: '#ffffff', cardBottom: '#f0f6fd',
  chip: '#d8e9ff', quiet: '#eaf0f9', secondary: '#dfecfb', picker: '#e6effa', redTint: '#ffe8ec',
  redBorder: '#e5adba', ambient: '#d9eaff',
};

const font = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  heavy: 'PlusJakartaSans_800ExtraBold',
};

export function Text({ weight = 'regular', style, ...props }: TextProps & { weight?: keyof typeof font }) {
  const { colors } = useUi();
  return <NativeText {...props} style={[{ color: colors.ink, fontFamily: font[weight] }, style]} />;
}

function makeStyles(colors: typeof darkPalette) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.outer },
  scroll: { paddingHorizontal: 16, paddingBottom: 16, gap: 14 },
  card: { padding: 16, borderRadius: 28, borderWidth: 1, borderColor: colors.border, gap: 10 },
  inset: { padding: 10, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.field, gap: 3 },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  rule: { borderTopWidth: 1, borderTopColor: colors.subtle, paddingTop: 10 },
  title: { color: colors.white, fontSize: 18, letterSpacing: -0.35 },
  body: { fontSize: 14, lineHeight: 21 },
  small: { fontSize: 12, lineHeight: 17 },
  muted: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  eyebrow: { color: colors.sky, textTransform: 'uppercase', fontSize: 10, letterSpacing: 0.65 },
  error: { color: colors.red, fontSize: 12, lineHeight: 17 },
  field: {
    minHeight: 44, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1,
    borderRadius: 14, borderColor: colors.border, backgroundColor: colors.field,
    fontFamily: font.regular, fontSize: 16, color: colors.white,
  },
  });
}

const ui = {
  dark: { colors: darkPalette, styles: makeStyles(darkPalette) },
  light: { colors: lightPalette, styles: makeStyles(lightPalette) },
};

export function useUi() {
  const { theme } = useAppearance();
  return { theme, ...ui[theme] };
}

export function Card({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const { colors, styles } = useUi();
  return <LinearGradient colors={[colors.cardTop, colors.cardBottom]} style={[styles.card, style]}>{children}</LinearGradient>;
}

export function Badge({ children, tone = 'blue', style }: PropsWithChildren<{
  tone?: 'blue' | 'green' | 'neutral'; style?: StyleProp<TextStyle>;
}>) {
  const { colors } = useUi();
  const color = tone === 'green' ? colors.green : tone === 'blue' ? colors.lightBlue : colors.ink;
  return <Text weight="bold" style={[{
    color, fontSize: 10, alignSelf: 'flex-start', borderRadius: 16, overflow: 'hidden',
    paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1,
    backgroundColor: tone === 'green' ? colors.greenTint : tone === 'blue' ? colors.chip : colors.quiet,
    borderColor: tone === 'green' ? colors.greenBorder : tone === 'blue' ? colors.border : colors.subtle,
  }, style]}>{children}</Text>;
}

export function Button({ label, onPress, disabled = false, kind = 'primary', style, children, accessibilityLabel }: PropsWithChildren<{
  label: string; onPress: () => void; disabled?: boolean; kind?: 'primary' | 'secondary' | 'quiet' | 'green';
  style?: StyleProp<ViewStyle>; accessibilityLabel?: string;
}>) {
  const { colors } = useUi();
  const content = <>
    <Text weight={kind === 'primary' ? 'heavy' : 'bold'}
      style={{ fontSize: kind === 'primary' ? 14 : 12, color: kind === 'green' ? colors.green : kind === 'secondary' ? colors.lightBlue : kind === 'primary' ? colors.onAccent : colors.white, textAlign: 'center' }}>
      {label}
    </Text>
    {children}
  </>;
  const layout: ViewStyle = {
    minHeight: kind === 'primary' ? 46 : 40, paddingHorizontal: 12, paddingVertical: 7,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  };
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityState={{ disabled }}
    disabled={disabled} onPress={onPress} style={({ pressed }) => [
      { borderRadius: kind === 'primary' ? 16 : 12, overflow: 'hidden', opacity: disabled ? 0.45 : pressed ? 0.78 : 1 },
      style,
    ]}>
    {kind === 'primary'
      ? <LinearGradient colors={['#0066ff', '#004ecc']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={layout}>{content}</LinearGradient>
      : <View style={[layout, { backgroundColor: kind === 'green' ? colors.greenTint : kind === 'quiet' ? colors.quiet : colors.secondary,
        borderWidth: 1, borderRadius: 12, borderColor: kind === 'green' ? colors.greenBorder : kind === 'quiet' ? colors.subtle : colors.border }]}>
        {content}
      </View>}
  </Pressable>;
}

export function Segmented<T extends string>({ options, value, onChange, compact = false }: {
  options: readonly { value: T; label: string }[]; value: T; onChange: (value: T) => void; compact?: boolean;
}) {
  const { colors } = useUi();
  const { t } = useLanguage();
  return <View accessibilityRole="tablist" style={{
    flexDirection: 'row', borderWidth: 1, borderColor: colors.border,
    backgroundColor: compact ? colors.field : colors.picker, padding: compact ? 2 : 4, borderRadius: compact ? 12 : 16,
  }}>
    {options.map((option) => <Pressable key={option.value} accessibilityRole="tab"
      accessibilityState={{ selected: value === option.value }} onPress={() => onChange(option.value)}
      style={{
        flex: compact ? undefined : 1, minHeight: compact ? 36 : 40, justifyContent: 'center', alignItems: 'center',
        paddingHorizontal: compact ? 9 : 4, borderRadius: compact ? 8 : 12, backgroundColor: value === option.value ? colors.blue : 'transparent',
      }}>
      <Text weight="bold" style={{ fontSize: 12, color: value === option.value ? colors.onAccent : colors.muted, textAlign: 'center' }}>{t(option.label)}</Text>
    </Pressable>)}
  </View>;
}

export function ErrorText({ message }: { message?: string }) {
  const { styles } = useUi();
  return message ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>{message}</Text> : null;
}

export function Field({ label, showLabel = true, error, style, ...props }: TextInputProps & { label: string; showLabel?: boolean; error?: string }) {
  const { colors, styles, theme } = useUi();
  return <View style={{ gap: 4 }}>
    {showLabel && <Text weight="semibold" style={styles.small}>{label}</Text>}
    <TextInput {...props} accessibilityLabel={label} keyboardAppearance={theme} placeholderTextColor={colors.placeholder}
      style={[styles.field, error ? { borderColor: colors.red } : null, style]} />
    <ErrorText message={error} />
  </View>;
}

export function Dialog({ title, onClose, children }: PropsWithChildren<{ title: string; onClose: () => void }>) {
  const { locale } = useLanguage();
  const { colors, styles } = useUi();
  return <Modal transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 12, backgroundColor: 'rgba(0,0,0,0.80)' }}>
      <Pressable accessible={false} onPress={onClose} style={StyleSheet.absoluteFill} />
      <View accessibilityViewIsModal style={{
        width: '100%', maxWidth: 390, maxHeight: '86%', borderRadius: 28, overflow: 'hidden', direction: isRtl(locale) ? 'rtl' : 'ltr',
        borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel,
      }}>
        <ScrollView keyboardShouldPersistTaps="handled" bounces={false} contentContainerStyle={{ padding: 18, gap: 12 }}>
          <View style={styles.between}>
            <Text accessibilityRole="header" weight="heavy" style={[styles.title, { flex: 1 }]}>{title}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close dialog" onPress={onClose}
              style={{ width: 42, height: 42, justifyContent: 'center', alignItems: 'center' }}>
              <X size={17} color={colors.lightBlue} />
            </Pressable>
          </View>
          {children}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}

export type Option = { label: string; value: string };
export const localityOptions = MALTA_LOCALITIES.map(({ name }) => ({ value: name, label: name }));

export function Select({ label, options, value, onChange, placeholder, disabled = false, style, inline = false }: {
  label: string; options: readonly Option[]; value: string; onChange: (value: string) => void;
  placeholder?: string; disabled?: boolean; style?: StyleProp<ViewStyle>; inline?: boolean;
}) {
  const { colors, styles } = useUi();
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);
  const choices = options.map((option) => <Pressable key={option.value} accessibilityRole="button"
    accessibilityState={{ selected: option.value === value }} onPress={() => { setOpen(false); onChange(option.value); }}
    style={[styles.inset, option.value === value && { borderColor: colors.sky, backgroundColor: colors.chip }]}>
    <Text weight="semibold" style={styles.body}>{option.label}</Text>
  </Pressable>);
  return <View style={style}>
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityValue={{ text: selected?.label || placeholder }}
      accessibilityState={{ expanded: open, disabled }} disabled={disabled} onPress={() => setOpen(true)}
      style={[styles.field, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 }]}>
      <Text weight="semibold" style={[styles.small, { flex: 1 }]} numberOfLines={1}>{selected?.label || placeholder || label}</Text>
      <ChevronDown color={colors.lightBlue} size={15} />
    </Pressable>
    {open && (inline ? <View style={{ gap: 5, marginTop: 5 }}>{choices}</View> : <Dialog title={label} onClose={() => setOpen(false)}>{choices}</Dialog>)}
  </View>;
}

export function Metric({ label, value, caption, green }: { label: string; value: string; caption: string; green?: boolean }) {
  const { colors, styles } = useUi();
  return <View style={[styles.inset, { flex: 1 }, green && { borderColor: colors.greenBorder }]}>
    <Text weight="medium" style={{ fontSize: 10, color: green ? colors.green : colors.lightBlue }}>{label}</Text>
    <Text weight="heavy" style={[styles.title, { color: green ? colors.green : colors.white }]}>{value}</Text>
    <Text style={[styles.muted, { fontSize: 10 }]}>{caption}</Text>
  </View>;
}

export function Loading({ label }: { label: string }) {
  const { colors, styles } = useUi();
  return <View style={styles.row} accessibilityLiveRegion="polite">
    <ActivityIndicator size="small" color={colors.sky} />
    <Text style={styles.muted}>{label}</Text>
  </View>;
}
