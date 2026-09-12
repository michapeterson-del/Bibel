import type { Translation } from "../types";

const OPTIONS: { value: Translation; label: string }[] = [
  { value: "LUT1912", label: "Luther 1912" },
  { value: "SCH1951", label: "Schlachter 1951" },
  { value: "MENGE1939", label: "Menge 1939" },
];

export default function TranslationSwitch({
  value,
  onChange,
}: {
  value: Translation;
  onChange: (t: Translation) => void;
}) {
  return (
    <div className="chip-row">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          className={`chip ${value === opt.value ? "active" : ""}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
