const STEPS = [500, 1000, 2500, 5000];

/**
 * The four amounts a payment dialog offers: the creator's minimum first when there is one (an $8 unlock offers $8,
 * selected), then the usual steps above it — never an amount below the minimum.
 * (Amounts as text — `money`, `compact` — come from `useI18n()` / `getI18n()`, in the reader's language: lib/format.ts.)
 */
export function amountChoices(minimumCents: number): { cents: number }[] {
  const steps = minimumCents > 100 ? [minimumCents, ...STEPS.filter((c) => c > minimumCents)] : [...STEPS];
  while (steps.length < 4) steps.push(steps[steps.length - 1] * 2);
  return steps.slice(0, 4).map((cents) => ({ cents }));
}
