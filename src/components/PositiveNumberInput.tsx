import React from 'react';

// Positive whole-number input. Keeps what's being typed (including an empty field) as a draft
// and only commits values of 1 or more, so clearing "10" and typing "20" gives 20.
export const PositiveNumberInput: React.FC<{
  value: number;
  onCommit: (value: number) => void;
  className: string;
  label: string;
}> = ({ value, onCommit, className, label }) => {
  const [draft, setDraft] = React.useState<string | null>(null);
  return (
    <input
      type="number"
      min="1"
      value={draft ?? value}
      onChange={(e) => {
        setDraft(e.target.value);
        const parsed = Number(e.target.value);
        if (Number.isInteger(parsed) && parsed >= 1) {
          onCommit(parsed);
        }
      }}
      onBlur={() => setDraft(null)}
      className={className}
      aria-label={label}
    />
  );
};
