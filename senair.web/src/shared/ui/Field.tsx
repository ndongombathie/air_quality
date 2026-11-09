import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cx } from '../lib/cx';

interface FieldShellProps {
  id: string;
  label: ReactNode;
  error?: string;
  hint?: ReactNode;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

function FieldShell({ id, label, error, hint, required, children, className }: FieldShellProps) {
  return (
    <div className={cx('field', error && 'field--error', className)}>
      <label className="field__label" htmlFor={id}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      {children}
      {hint && !error && (
        <p className="field__hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
      {error && (
        <p className="field__error" id={`${id}-error`} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function describedBy(id: string, error?: string, hint?: ReactNode) {
  if (error) return `${id}-error`;
  return hint ? `${id}-hint` : undefined;
}

interface CommonProps {
  label: ReactNode;
  error?: string;
  hint?: ReactNode;
  fieldClassName?: string;
}

export function TextField({ label, error, hint, fieldClassName, id, required, className, ...rest }: CommonProps & InputHTMLAttributes<HTMLInputElement>) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldShell id={fieldId} label={label} error={error} hint={hint} required={required} className={fieldClassName}>
      <input
        id={fieldId}
        className={cx('input', className)}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fieldId, error, hint)}
        {...rest}
      />
    </FieldShell>
  );
}

export function TextAreaField({ label, error, hint, fieldClassName, id, required, className, ...rest }: CommonProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldShell id={fieldId} label={label} error={error} hint={hint} required={required} className={fieldClassName}>
      <textarea
        id={fieldId}
        className={cx('input', 'textarea', className)}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fieldId, error, hint)}
        {...rest}
      />
    </FieldShell>
  );
}

export interface SelectOption {
  value: string;
  label: string;
}

export function SelectField({
  label,
  error,
  hint,
  fieldClassName,
  id,
  options,
  placeholder,
  required,
  className,
  ...rest
}: CommonProps & SelectHTMLAttributes<HTMLSelectElement> & { options: readonly SelectOption[]; placeholder?: string }) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldShell id={fieldId} label={label} error={error} hint={hint} required={required} className={fieldClassName}>
      <select
        id={fieldId}
        className={cx('input', 'select', className)}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fieldId, error, hint)}
        {...rest}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

export function CheckboxField({ label, error, hint, id, className, ...rest }: CommonProps & Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <div className={cx('checkbox-field', error && 'field--error', className)}>
      <input
        id={fieldId}
        type="checkbox"
        className="checkbox"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fieldId, error, hint)}
        {...rest}
      />
      <div>
        <label htmlFor={fieldId} className="checkbox-field__label">
          {label}
        </label>
        {hint && !error && (
          <p className="field__hint" id={`${fieldId}-hint`}>
            {hint}
          </p>
        )}
        {error && (
          <p className="field__error" id={`${fieldId}-error`} role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

/** Groupe de cases à cocher (zones, polluants…) dans un fieldset accessible. */
export function CheckboxGroup<V extends string>({
  legend,
  options,
  value,
  onChange,
  error,
  hint,
}: {
  legend: ReactNode;
  options: readonly { value: V; label: string }[];
  value: readonly V[];
  onChange: (next: V[]) => void;
  error?: string;
  hint?: ReactNode;
}) {
  const toggle = (option: V) =>
    onChange(value.includes(option) ? value.filter((v) => v !== option) : [...value, option]);
  return (
    <fieldset className={cx('fieldset', error && 'field--error')}>
      <legend className="field__label">{legend}</legend>
      {hint && <p className="field__hint">{hint}</p>}
      <div className="chip-group">
        {options.map((option) => (
          <label key={option.value} className={cx('chip', value.includes(option.value) && 'chip--selected')}>
            <input type="checkbox" checked={value.includes(option.value)} onChange={() => toggle(option.value)} />
            {option.label}
          </label>
        ))}
      </div>
      {error && (
        <p className="field__error" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}
