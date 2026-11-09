import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, ChevronDown } from 'lucide-react-native';
import { COLORS, RADIUS, SHADOWS, SPACING, TOUCH_TARGET, TYPE } from '@/theme';
import { Button } from './Button';
import { PressableScale } from './PressableScale';

export interface SelectOption<T extends string> {
  value: T;
  label: string;
}

interface BaseProps<T extends string> {
  label: string;
  options: readonly SelectOption<T>[];
  placeholder?: string;
  hint?: string;
  error?: string;
}

interface SingleProps<T extends string> extends BaseProps<T> {
  multiple?: false;
  value: T | null;
  onChange: (value: T) => void;
}

interface MultipleProps<T extends string> extends BaseProps<T> {
  multiple: true;
  value: readonly T[];
  onChange: (value: T[]) => void;
  /** Nombre maximal de choix (les autres options sont grisées une fois atteint). */
  max?: number;
}

/**
 * Liste déroulante : un champ compact, et au toucher une feuille en bas de l'écran avec les choix.
 * Choix unique : la feuille se ferme dès qu'on choisit. Choix multiple : on coche puis « Valider ».
 */
export function SelectField<T extends string>(props: SingleProps<T> | MultipleProps<T>) {
  const { label, options, placeholder = 'Choisir', hint, error } = props;
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<T[]>([]);

  const selected: readonly T[] = props.multiple ? props.value : props.value ? [props.value] : [];
  const labels = options.filter((o) => selected.includes(o.value)).map((o) => o.label);
  const summary = labels.length ? labels.join(', ') : placeholder;
  const max = props.multiple ? props.max : undefined;

  const show = () => {
    setDraft([...selected]);
    setOpen(true);
  };

  const choose = (value: T) => {
    if (!props.multiple) {
      props.onChange(value);
      setOpen(false);
      return;
    }
    setDraft((list) => (list.includes(value) ? list.filter((v) => v !== value) : max && list.length >= max ? list : [...list, value]));
  };

  const confirm = () => {
    if (props.multiple) props.onChange(draft);
    setOpen(false);
  };

  const current = props.multiple ? draft : selected;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <PressableScale
        onPress={show}
        accessibilityRole="button"
        accessibilityLabel={`${label} : ${summary}`}
        accessibilityHint="Ouvre la liste des choix"
        scaleTo={0.99}
        style={[styles.field, error ? styles.fieldError : null]}
      >
        <Text style={[styles.value, !labels.length && styles.placeholder]} numberOfLines={1}>
          {summary}
        </Text>
        <ChevronDown size={20} color={COLORS.textMuted} />
      </PressableScale>
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityLabel="Fermer la liste" />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + SPACING.lg }]} accessibilityViewIsModal>
          <View style={styles.grip} />
          <Text style={styles.sheetTitle} accessibilityRole="header">
            {label}
          </Text>
          {max ? (
            <Text style={styles.hint}>
              {current.length} / {max} choix
            </Text>
          ) : null}
          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {options.map((option) => {
              const active = current.includes(option.value);
              const disabled = !active && max !== undefined && current.length >= max;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => choose(option.value)}
                  disabled={disabled}
                  accessibilityRole={props.multiple ? 'checkbox' : 'radio'}
                  accessibilityState={{ checked: active, disabled }}
                  style={({ pressed }) => [styles.option, active && styles.optionActive, pressed && styles.optionPressed, disabled && styles.optionDisabled]}
                >
                  <Text style={[styles.optionText, active && styles.optionTextActive]}>{option.label}</Text>
                  {active ? <Check size={20} color={COLORS.primaryText} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
          {props.multiple ? <Button label="Valider" onPress={confirm} /> : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: SPACING.lg },
  label: {
    ...TYPE.smallSemibold,
    color: COLORS.text,
    marginBottom: SPACING.xs + SPACING.xxs,
  },
  field: {
    minHeight: TOUCH_TARGET + 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md + SPACING.xxs,
    backgroundColor: COLORS.surface,
  },
  fieldError: { borderColor: COLORS.danger },
  value: { ...TYPE.body, color: COLORS.text, flex: 1 },
  placeholder: { color: COLORS.textMuted },
  hint: { ...TYPE.small, color: COLORS.textMuted, marginTop: SPACING.xs },
  error: { ...TYPE.small, color: COLORS.danger, marginTop: SPACING.xs },
  backdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.35)' },
  sheet: {
    maxHeight: '75%',
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    gap: SPACING.sm,
    ...SHADOWS.raised,
  },
  grip: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    marginBottom: SPACING.sm,
  },
  sheetTitle: { ...TYPE.h2, color: COLORS.text },
  list: { flexGrow: 0 },
  listContent: { gap: SPACING.xs, paddingVertical: SPACING.sm },
  option: {
    minHeight: TOUCH_TARGET + 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
  },
  optionActive: { backgroundColor: COLORS.primarySoft },
  optionPressed: { backgroundColor: COLORS.background },
  optionDisabled: { opacity: 0.4 },
  optionText: { ...TYPE.body, color: COLORS.text },
  optionTextActive: {
    fontFamily: TYPE.bodySemibold.fontFamily,
    color: COLORS.primaryText,
  },
});
