"use client";

import { Clapperboard, Clock, Flame, Lock, Megaphone, Target, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useState } from "react";

import { Button, Chip, cn, Dialog, Input, RadioGroup, Sheet, Textarea } from "@/components/ui";
import { type MessageKey,t } from "@/lib/i18n";
import { money } from "@/lib/money";

type Kind = "GOAL" | "REQUEST" | "OPEN_CALL";
const WINDOWS = {
  GOAL: ["1d", "3d", "7d", "30d"],
  OPEN_CALL: ["1d", "3d", "7d", "14d"],
} as const;
const DAYS: Record<string, number> = {
  "1d": 1,
  "3d": 3,
  "7d": 7,
  "14d": 14,
  "30d": 30,
};
const DELIVERY = ["3", "7", "14"] as const;
const KINDS = [
  { kind: "GOAL" as const, icon: Target, creatorsOnly: true },
  { kind: "REQUEST" as const, icon: Flame, creatorsOnly: false },
  { kind: "OPEN_CALL" as const, icon: Megaphone, creatorsOnly: false },
];

const field =
  "mt-1 w-full rounded-xl border border-border-default bg-surface-2 px-3 py-2.5 text-sm text-fg placeholder:text-fg-muted focus:border-accent focus:outline-hidden";
const label = "block text-xs font-semibold text-fg-secondary";
const hint = "mt-1 block text-[11px] leading-relaxed text-fg-muted";

/**
 * Starts a challenge. A creator sets a goal (all or nothing: made only if the goal is reached by the deadline); anyone
 * dares one creator (the offer is held; they accept or decline within three days) or posts an open call for any creator
 * (the pot is held; creators apply and the author picks one). A summary reads the choice back before it is confirmed.
 */
export function ChallengeComposer({
  open,
  onClose,
  isCreator,
  initialKind,
  creatorUsername,
}: {
  open: boolean;
  onClose: () => void;
  isCreator: boolean;
  initialKind?: Kind;
  creatorUsername?: string;
}) {
  const router = useRouter();
  const [kind, setKind] = useState<Kind>(initialKind ?? (isCreator ? "GOAL" : "REQUEST"));
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deliverable, setDeliverable] = useState<"VIDEO" | "STORY">("VIDEO");
  const [delivery, setDelivery] = useState<(typeof DELIVERY)[number]>("7");
  const [amount, setAmount] = useState(kind === "GOAL" ? "100" : "20");
  const [windowId, setWindowId] = useState<string>("7d");
  const [reward, setReward] = useState<"BACKERS" | "EVERYONE">("BACKERS");
  const [username, setUsername] = useState(creatorUsername ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cents = Math.round(Number(amount) * 100);
  const windows = kind === "REQUEST" ? [] : WINDOWS[kind];
  const pickKind = (next: Kind) => {
    setKind(next);
    setAmount(next === "GOAL" ? "100" : "20");
    if (next !== "REQUEST" && !(WINDOWS[next] as readonly string[]).includes(windowId)) setWindowId("7d");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const deadline = new Date();
    deadline.setTime(deadline.getTime() + DAYS[windowId] * 86400_000);
    const common = {
      kind,
      title,
      description,
      deliverable,
      deliveryDays: Number(delivery),
    };
    const body =
      kind === "GOAL"
        ? { ...common, goalCents: cents, deadline, reward }
        : kind === "REQUEST"
          ? {
              ...common,
              creatorUsername: username.replace(/^@/, "").trim(),
              offerCents: cents,
            }
          : { ...common, offerCents: cents, deadline };
    const res = await fetch("/api/challenges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    setBusy(false);
    const data = (await res?.json().catch(() => ({}))) as
      | {
          challengeId?: string;
          code?: string;
          error?: string;
          minimum?: number;
        }
      | undefined;
    if (res?.ok && data?.challengeId) {
      onClose();
      router.push(`/challenges/${data.challengeId}`);
      return;
    }
    if (data?.code === "OFFER_TOO_LOW" && data.minimum)
      setError(
        t("challenge.errors.OFFER_TOO_LOW_AMOUNT", {
          amount: money(data.minimum),
        }),
      );
    else if (data?.code) setError(t(`challenge.errors.${data.code}` as MessageKey));
    else setError(data?.error ?? t("challenge.errors.generic"));
  };

  return (
    <Dialog.Root open={open} onOpenChange={(open) => !open && onClose()}>
      <Sheet size="md" aria-describedby={undefined}>
        <Dialog.Header>
          <Dialog.Title>{t("challenge.compose.title")}</Dialog.Title>
        </Dialog.Header>
        <Dialog.Body>
          <form id="compose-challenge" onSubmit={submit} className="space-y-5">
            <RadioGroup.Root label={t("challenge.compose.kind")} value={kind} onValueChange={(k) => pickKind(k as Kind)} className="grid gap-2 sm:grid-cols-3">
              {KINDS.filter((k) => isCreator || !k.creatorsOnly).map(({ kind: k, icon: Icon }) => (
                <RadioGroup.Card key={k} value={k} className="gap-1.5 rounded-2xl">
                  <Icon className="h-4 w-4 text-accent" aria-hidden />
                  <span className="text-xs font-bold text-fg">{t(`challenge.kind.${k}`)}</span>
                  <span className="text-[11px] leading-snug text-fg-secondary">{t(`challenge.compose.kindHint.${k}`)}</span>
                </RadioGroup.Card>
              ))}
            </RadioGroup.Root>

            {kind === "REQUEST" && (
              <label className={label}>
                {t("challenge.compose.creator")}
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  maxLength={40}
                  placeholder={t("challenge.compose.creatorPlaceholder")}
                  className={field}
                  autoComplete="off"
                />
              </label>
            )}

            <label className={label}>
              {t("challenge.compose.titleLabel")}
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                minLength={4}
                maxLength={120}
                placeholder={t(`challenge.compose.titlePlaceholder.${kind}`)}
                className={field}
              />
            </label>
            <label className={label}>
              {t("challenge.compose.description")}
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                minLength={10}
                maxLength={1000}
                rows={4}
                placeholder={t("challenge.compose.descriptionPlaceholder")}
                className={field}
              />
              <span className={hint}>{t("challenge.compose.descriptionHint")}</span>
            </label>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className={label}>
                {t("challenge.compose.deliverable")}
                <div className="mt-1">
                  <Chip.Group type="single" required label={t("challenge.compose.deliverable")} value={deliverable} onValueChange={(v) => setDeliverable(v as "VIDEO" | "STORY")}>
                    <Chip value="VIDEO">
                      <Clapperboard className="h-3.5 w-3.5" aria-hidden /> {t("challenge.deliverable.VIDEO")}
                    </Chip>
                    <Chip value="STORY">
                      <Clock className="h-3.5 w-3.5" aria-hidden /> {t("challenge.deliverable.STORY")}
                    </Chip>
                  </Chip.Group>
                </div>
              </div>
              <div className={label}>
                {t("challenge.compose.delivery")}
                <div className="mt-1">
                  <Chip.Group type="single" required label={t("challenge.compose.delivery")} value={delivery} onValueChange={(v) => setDelivery(v as (typeof DELIVERY)[number])}>
                    {DELIVERY.map((d) => (
                      <Chip key={d} value={d}>
                        {t(`challenge.compose.deliveryLabels.${d}`)}
                      </Chip>
                    ))}
                  </Chip.Group>
                </div>
              </div>
            </div>

            <label className={label}>
              {t(`challenge.compose.amount.${kind}`)}
              <span className="relative mt-1 block">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-semibold text-fg-muted">$</span>
                <Input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  type="number"
                  inputMode="decimal"
                  min={1}
                  step={1}
                  required
                  className={cn(field, "mt-0 pl-6 font-mono tabular-nums")}
                />
              </span>
              <span className={hint}>{t(`challenge.compose.amountHint.${kind}`)}</span>
            </label>

            {windows.length > 0 && (
              <div className={label}>
                {t(`challenge.compose.window.${kind as "GOAL" | "OPEN_CALL"}`)}
                <div className="mt-1">
                  <Chip.Group type="single" required label={t(`challenge.compose.window.${kind as "GOAL" | "OPEN_CALL"}`)} value={windowId} onValueChange={setWindowId}>
                    {windows.map((w) => (
                      <Chip key={w} value={w}>
                        {t(`challenge.compose.windowLabels.${w}`)}
                      </Chip>
                    ))}
                  </Chip.Group>
                </div>
              </div>
            )}

            {kind === "GOAL" && (
              <div className={label}>
                {t("challenge.compose.reward")}
                <div className="mt-1">
                  <Chip.Group type="single" required label={t("challenge.compose.reward")} value={reward} onValueChange={(v) => setReward(v as "BACKERS" | "EVERYONE")}>
                    <Chip value="BACKERS">
                      <Lock className="h-3.5 w-3.5" aria-hidden /> {t("challenge.reward.BACKERS")}
                    </Chip>
                    <Chip value="EVERYONE">
                      <Users className="h-3.5 w-3.5" aria-hidden /> {t("challenge.reward.EVERYONE")}
                    </Chip>
                  </Chip.Group>
                </div>
              </div>
            )}

            {cents >= 100 && (
              <p className="rounded-2xl border border-accent/20 bg-accent/[0.06] px-4 py-3 text-xs leading-relaxed text-fg-secondary">
                {t(`challenge.compose.summary.${kind}`, {
                  amount: money(cents),
                  days: windows.length > 0 ? DAYS[windowId] : 3,
                  delivery,
                  what: t(`challenge.deliverable.${deliverable}`).toLowerCase(),
                  creator: username ? `@${username.replace(/^@/, "")}` : t("challenge.compose.theCreator"),
                })}
              </p>
            )}
            {error && (
              <p role="alert" className="text-xs text-danger">
                {error}
              </p>
            )}
          </form>
        </Dialog.Body>
        <Dialog.Footer>
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="sensual"
            type="submit"
            form="compose-challenge"
            loading={busy}
            disabled={!(cents >= 100) || title.trim().length < 4}>
            <Flame className="h-4 w-4" aria-hidden />
            {t(`challenge.compose.submit.${kind}`)}
          </Button>
        </Dialog.Footer>
      </Sheet>
    </Dialog.Root>
  );
}
