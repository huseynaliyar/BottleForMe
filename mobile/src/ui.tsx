import { useState, type PropsWithChildren } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text as NativeText, TextInput, View } from 'react-native';
import type { StyleProp, TextInputProps, TextProps, TextStyle, ViewStyle } from 'react-native';
import { ChevronDown, X } from 'lucide-react-native';
import { useLanguage } from '../../lib/language-context';
import { isRtl } from '../../lib/locale';
import { MALTA_LOCALITIES } from '../../lib/types';
import { useAppearance } from './appearance';

export const darkPalette = {
  background: '#111c17', outer: '#111c17', panel: '#1b2922', field: '#1b2922', bar: '#1b2922',
  white: '#e7f0e8', ink: '#e7f0e8', blue: '#c4e7c8', sky: '#c4e7c8', lightBlue: '#adbdaf',
  muted: '#adbdaf', border: '#34463a', subtle: '#34463a',
  green: '#c4e7c8', greenBorder: '#45634b', greenTint: '#243b2e', red: '#ffb4a9', warning: '#e2c38f',
  onAccent: '#173b27', placeholder: '#adbdaf', chip: '#304d38', quiet: '#243b2e',
  secondary: '#243b2e', picker: '#243b2e', redTint: '#3a2624', redBorder: '#6c4944',
};

export const lightPalette: typeof darkPalette = {
  background: '#f7f8f4', outer: '#f7f8f4', panel: '#ffffff', field: '#ffffff', bar: '#ffffff',
  white: '#183b31', ink: '#183b31', blue: '#1b5943', sky: '#1b5943', lightBlue: '#365b49',
  muted: '#61736a', border: '#e2e8e0', subtle: '#e2e8e0',
  green: '#1b5943', greenBorder: '#c0d7c5', greenTint: '#edf3eb', red: '#a23f36', warning: '#805a25',
  onAccent: '#ffffff', placeholder: '#61736a', chip: '#d7ebda', quiet: '#edf3eb',
  secondary: '#edf3eb', picker: '#edf3eb', redTint: '#f8eae5', redBorder: '#e9c9c0',
};

const font = {
  regular: '400', medium: '500', semibold: '600', bold: '600', heavy: '700',
} as const;

export function Text({ weight = 'regular', style, ...props }: TextProps & { weight?: keyof typeof font }) {
  const { colors } = useUi();
  return <NativeText {...props} style={[{ color: colors.ink, fontWeight: font[weight] }, style]} />;
}

function makeStyles(colors: typeof darkPalette) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.outer },
  scroll: { paddingHorizontal: 16, paddingTop: 22, paddingBottom: 20, gap: 14 },
  card: { padding: 16, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel, gap: 12 },
  inset: { padding: 10, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.field, gap: 3 },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  rule: { borderTopWidth: 1, borderTopColor: colors.subtle, paddingTop: 10 },
  title: { color: colors.white, fontSize: 17, letterSpacing: -0.35 },
  pageTitle: { color: colors.ink, fontSize: 28, lineHeight: 33, letterSpacing: -0.95 },
  tabular: { fontVariant: ['tabular-nums'] },
  body: { fontSize: 14, lineHeight: 21 },
  small: { fontSize: 12, lineHeight: 17 },
  muted: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  eyebrow: { color: colors.muted, textTransform: 'uppercase', fontSize: 10, letterSpacing: 1.1 },
  error: { color: colors.red, fontSize: 12, lineHeight: 17 },
  field: {
    minHeight: 44, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1,
    borderRadius: 9, borderColor: colors.border, backgroundColor: colors.field,
    fontSize: 16, color: colors.white,
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
  const { styles } = useUi();
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ number, children }: PropsWithChildren<{ number: number }>) {
  const { colors, styles } = useUi();
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
    <View accessible={false} style={{ width: 26, height: 26, alignItems: 'center', justifyContent: 'center', borderRadius: 13, borderWidth: 1, borderColor: colors.border }}>
      <Text style={styles.muted}>{number}</Text>
    </View>
    <Text accessibilityRole="header" weight="bold" style={[styles.title, { flex: 1 }]}>{children}</Text>
  </View>;
}

export function StatusPill({ children, status }: PropsWithChildren<{ status: string }>) {
  const { colors, styles, theme } = useUi();
  const color = ['overdue', 'cancelled', 'rejected'].includes(status) ? colors.red
    : status === 'pending' ? colors.warning : status === 'expired' ? colors.muted
      : status === 'en_route' ? (theme === 'light' ? '#24675e' : '#a6dad3')
        : status === 'arrived' ? (theme === 'light' ? '#6a527e' : '#d6c4e5') : colors.green;
  return <View style={{ alignSelf: 'flex-start', maxWidth: '100%', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, backgroundColor: colors.quiet }}>
    <View accessible={false} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
    <Text weight="semibold" style={[styles.muted, { flexShrink: 1, color }]}>{children}</Text>
  </View>;
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
    minHeight: 44, paddingHorizontal: 12, paddingVertical: 7,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  };
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityState={{ disabled }}
    disabled={disabled} onPress={onPress} style={({ pressed }) => [
      { borderRadius: 10, overflow: 'hidden', opacity: disabled ? 0.45 : pressed ? 0.78 : 1 },
      style,
    ]}>
    {kind === 'primary'
      ? <View style={[layout, { backgroundColor: colors.blue }]}>{content}</View>
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
        flex: compact ? undefined : 1, minHeight: 44, justifyContent: 'center', alignItems: 'center',
        paddingHorizontal: compact ? 9 : 4, borderRadius: compact ? 8 : 12, backgroundColor: value === option.value ? colors.panel : 'transparent',
      }}>
      <Text weight="bold" style={{ fontSize: 12, color: value === option.value ? colors.ink : colors.muted, textAlign: 'center' }}>{t(option.label)}</Text>
    </Pressable>)}
  </View>;
}

export function ErrorText({ message }: { message?: string }) {
  const { styles } = useUi();
  return message ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>{message}</Text> : null;
}

export function Field({ label, showLabel = true, error, style, ...props }: TextInputProps & { label: string; showLabel?: boolean; error?: string }) {
  const { colors, styles, theme } = useUi();
  const ltr = props.keyboardType && ['email-address', 'phone-pad', 'numeric', 'number-pad', 'decimal-pad'].includes(props.keyboardType);
  return <View style={{ gap: 4 }}>
    {showLabel && <Text weight="semibold" style={styles.small}>{label}</Text>}
    <TextInput {...props} accessibilityLabel={label} keyboardAppearance={theme} placeholderTextColor={colors.placeholder}
      style={[styles.field, ltr ? { writingDirection: 'ltr' } : null, error ? { borderColor: colors.red } : null, style]} />
    <ErrorText message={error} />
  </View>;
}

export function Dialog({ title, onClose, children }: PropsWithChildren<{ title: string; onClose: () => void }>) {
  const { locale } = useLanguage();
  const { colors, styles } = useUi();
  return <Modal transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 12, backgroundColor: 'rgba(8,27,19,0.65)' }}>
      <Pressable accessible={false} onPress={onClose} style={StyleSheet.absoluteFill} />
      <View accessibilityViewIsModal style={{
        width: '100%', maxWidth: 390, maxHeight: '86%', borderRadius: 20, overflow: 'hidden', direction: isRtl(locale) ? 'rtl' : 'ltr',
        borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panel,
      }}>
        <ScrollView keyboardShouldPersistTaps="handled" bounces={false} contentContainerStyle={{ padding: 18, gap: 12 }}>
          <View style={styles.between}>
            <Text accessibilityRole="header" weight="heavy" style={[styles.title, { flex: 1 }]}>{title}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close dialog" onPress={onClose}
              style={{ width: 44, height: 44, justifyContent: 'center', alignItems: 'center' }}>
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
    style={[styles.inset, { minHeight: 44, justifyContent: 'center' }, option.value === value && { borderColor: colors.sky, backgroundColor: colors.chip }]}>
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
