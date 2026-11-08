import { MAX_CONTAINERS } from '@/lib/pickup-validation';

export function parseCount(value: string) {
  return /^\d+$/.test(value) && Number(value) <= MAX_CONTAINERS ? Number(value) : null;
}

export default function ContainerCounter({ name, icon, value, onChange }: {
  name: string;
  icon: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const count = parseCount(value);
  return (
    <div className="min-w-0 rounded-2xl border border-blue-500/20 bg-[#0b1220] p-2 text-center">
      <label className="block text-[10px] font-bold text-white">
        <span className="block text-base" aria-hidden="true">{icon}</span>
        {name}
        <input type="text" inputMode="numeric" value={value} onChange={(event) => onChange(event.target.value)}
          maxLength={6} aria-invalid={count === null}
          className="my-1 block w-full border-b border-blue-500/40 bg-transparent text-center text-sm font-extrabold text-blue-300" />
      </label>
      <div className="flex justify-center gap-1.5">
        <button type="button" aria-label={`Remove one ${name.toLowerCase()} container`} disabled={!count} onClick={() => onChange(String((count ?? 0) - 1))} className="h-7 w-7 rounded-lg bg-white/5 font-bold text-white disabled:opacity-40">−1</button>
        <button type="button" aria-label={`Add one ${name.toLowerCase()} container`} disabled={count === MAX_CONTAINERS} onClick={() => onChange(String((count ?? 0) + 1))} className="h-7 w-7 rounded-lg bg-blue-600 font-bold text-white disabled:opacity-40">+1</button>
      </div>
    </div>
  );
}
