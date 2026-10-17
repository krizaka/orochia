"use client";

import { type ShowcaseStep, StepShowcase } from "@krizaka/ui/step-showcase";

/**
 * The adapter of @krizaka/ui's StepShowcase for the visitor's home: the server passes plain words (a function cannot
 * cross into a client component), this builds the controls' labels. The recordings were made in a browser window.
 */
export function JourneyTour({ label, steps, words }: { label: string; steps: readonly ShowcaseStep[]; words: { play: string; pause: string; step: string } }) {
  const labels = { play: words.play, pause: words.pause, step: (n: number, total: number) => words.step.replace("{n}", String(n)).replace("{total}", String(total)) };
  return <StepShowcase label={label} steps={steps} device="browser" deviceTitle="dev.orochia.com" labels={labels} />;
}
