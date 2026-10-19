"use client";

import { Button } from "@krizaka/ui/button";
import { cn } from "@krizaka/ui/cn";
import { AlertDialog } from "@krizaka/ui/dialog";
import { Field, Input, Select, Textarea } from "@krizaka/ui/field";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import React, { useActionState, useEffect, useId, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import type { ActionState } from "@/app/console/actions";

type Tone = "danger" | "primary" | "secondary";

export interface ConfirmDialogProps {
  /** The server action (app/actions.ts) the confirmed form posts to. */
  action: (state: ActionState, form: FormData) => Promise<ActionState>;
  /** Hidden fields sent with the form (ids, the decision). */
  fields?: Record<string, string>;
  trigger: { label: string; tone?: Tone; icon?: React.ReactNode; disabled?: boolean };
  title?: string;
  /** What will happen, in plain words — shown before the operator confirms. */
  description?: React.ReactNode;
  confirmLabel?: string;
  tone?: Tone;
  /** A required text the decision is recorded with (reason, transfer reference). */
  reason?: { label: string; placeholder?: string; minLength?: number; hint?: string };
  /** A phrase the operator must type to arm the action (irreversible operations). */
  phrase?: string;
  /** An option of the action (e.g. back up first), on by default unless said otherwise. */
  option?: { name: string; label: string; hint?: string; defaultChecked?: boolean };
  /** A choice the action needs (e.g. a role). */
  choice?: { name: string; label: string; options: { value: string; label: string }[]; defaultValue?: string };
  /** Run without a dialog (benign, reversible actions): one click, the same pending and error handling. */
  direct?: boolean;
}

/** The trigger, as the platform's small button: danger for what removes, outline for what grants, secondary otherwise. */
const TRIGGER_VARIANT = { danger: "danger", primary: "outline", secondary: "secondary" } as const;

/** The trigger of a direct action submits its form: its pending state comes from the form (useFormStatus). */
function DirectSubmit({ trigger }: { trigger: ConfirmDialogProps["trigger"] }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant={TRIGGER_VARIANT[trigger.tone ?? "secondary"]} loading={pending} disabled={trigger.disabled}>
      {trigger.icon}
      {trigger.label}
    </Button>
  );
}

/** Inside the dialog's form: the fields are locked while the server action runs (useFormStatus). */
function Fields({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <fieldset disabled={pending} className="space-y-4">
      {children}
    </fieldset>
  );
}

/**
 * Every operator decision goes through here: the platform's AlertDialog says what will happen, its form (the Field
 * primitives) collects what the decision is recorded with (a reason, a reference, a typed phrase for what cannot be
 * undone), the API's refusal shows in place, a success closes it. Escape and Cancel close it, never while it runs.
 *
 * The confirm button submits the form (requestSubmit): the browser checks the fields first (required, minLength, the
 * phrase's pattern), then the server action runs through useActionState and the dialog waits for its answer.
 */
export function ConfirmDialog(props: ConfirmDialogProps) {
  const { action, fields = {}, trigger, title = "", description, confirmLabel = "Confirm", tone = "danger", reason, phrase, option, choice, direct } = props;
  const [state, formAction] = useActionState(action, null);
  const [open, setOpen] = useState(false);
  // The result the dialog opened with: a newer one is this dialog's answer (a success closes it, an error shows in it).
  const [base, setBase] = useState<ActionState>(null);
  const [typed, setTyped] = useState("");
  const form = useRef<HTMLFormElement>(null);
  const waiting = useRef<{ resolve: () => void; reject: (error: Error) => void } | null>(null);
  const id = useId();

  // The server action answered: settle the confirm button's promise (a refusal keeps the dialog open).
  useEffect(() => {
    const pending = waiting.current;
    if (!pending) return;
    waiting.current = null;
    if (state?.ok) pending.resolve();
    else pending.reject(new Error(state?.error ?? "Refused"));
  }, [state]);

  const hidden = Object.entries(fields).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />);
  const answered = open && state !== base;
  const feedback = state && (state.ok ? state.message : direct && state.error) && (
    <span role="status" className={cn("text-[11px]", state.ok ? "text-fg-success" : "text-fg-danger")}>
      {state.ok ? state.message : state.error}
    </span>
  );

  if (direct) {
    return (
      <form action={formAction} className="inline-flex items-center gap-2">
        {hidden}
        <DirectSubmit trigger={trigger} />
        {feedback}
      </form>
    );
  }

  const onOpenChange = (next: boolean) => {
    if (next) {
      setTyped("");
      setBase(state);
    }
    setOpen(next);
  };

  const confirm = () => {
    const element = form.current;
    if (!element || !element.reportValidity()) return Promise.reject(new Error("invalid"));
    return new Promise<void>((resolve, reject) => {
      waiting.current = { resolve, reject };
      element.requestSubmit();
    });
  };

  // Enter in a text field would submit the form behind the dialog's back: the confirm button is the only way in.
  const submitsOnlyByConfirm = (event: React.KeyboardEvent<HTMLFormElement>) => {
    if (event.key === "Enter" && event.target instanceof HTMLInputElement) event.preventDefault();
  };

  const escaped = phrase?.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (
    <span className="inline-flex items-center gap-2">
      <AlertDialog
        open={open}
        onOpenChange={onOpenChange}
        trigger={
          <Button size="sm" variant={TRIGGER_VARIANT[trigger.tone ?? "secondary"]} disabled={trigger.disabled}>
            {trigger.icon}
            {trigger.label}
          </Button>
        }
        title={title}
        tone={tone === "danger" ? "danger" : "primary"}
        confirmLabel={confirmLabel}
        cancelLabel="Go back"
        onConfirm={confirm}
      >
        <form ref={form} action={formAction} onKeyDown={submitsOnlyByConfirm} className="space-y-4">
          {hidden}
          <div
            className={cn(
              "flex gap-3 rounded-xl border p-4 text-sm leading-relaxed text-fg",
              tone === "danger" ? "border-danger/40 bg-danger/10" : "border-border-default bg-surface-2",
            )}
          >
            {tone === "danger" ? (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-fg-danger" aria-hidden />
            ) : (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-fg-accent" aria-hidden />
            )}
            <div>{description}</div>
          </div>
          <Fields>
            {choice && (
              <Field.Root>
                <Field.Label htmlFor={`${id}-choice`}>{choice.label}</Field.Label>
                <Select id={`${id}-choice`} name={choice.name} defaultValue={choice.defaultValue}>
                  {choice.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </Field.Root>
            )}
            {reason && (
              <Field.Root>
                <Field.Label htmlFor={`${id}-reason`}>{reason.label}</Field.Label>
                <Textarea
                  id={`${id}-reason`}
                  name="reason"
                  required
                  minLength={reason.minLength ?? 3}
                  maxLength={500}
                  rows={3}
                  placeholder={reason.placeholder}
                  aria-describedby={reason.hint ? `${id}-reason-hint` : undefined}
                />
                {reason.hint && <Field.Hint id={`${id}-reason-hint`}>{reason.hint}</Field.Hint>}
              </Field.Root>
            )}
            {option && (
              <label className="flex items-start gap-3 rounded-xl border border-border-default p-4">
                <input type="checkbox" name={option.name} defaultChecked={option.defaultChecked ?? true} className="mt-0.5 h-4 w-4 accent-accent" />
                <span>
                  <span className="block text-sm font-semibold text-fg">{option.label}</span>
                  {option.hint && <span className="mt-0.5 block text-[11px] text-fg-secondary">{option.hint}</span>}
                </span>
              </label>
            )}
            {phrase && (
              <Field.Root>
                <Field.Label htmlFor={`${id}-phrase`}>
                  Type <code className="rounded-sm bg-surface-3 px-1.5 py-0.5 font-mono text-fg">{phrase}</code> to confirm
                </Field.Label>
                <Input
                  id={`${id}-phrase`}
                  name="phrase"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  required
                  pattern={`\\s*${escaped}\\s*`}
                  title={`Type “${phrase}” to confirm`}
                  autoComplete="off"
                  spellCheck={false}
                  data-armed={typed.trim() === phrase ? "" : undefined}
                  className="font-mono data-armed:border-success"
                />
                <Field.Hint>{typed.trim() === phrase ? "Armed: the action can run." : "The action stays locked until the phrase matches."}</Field.Hint>
              </Field.Root>
            )}
          </Fields>
          {answered && state && !state.ok && <Field.Error>{state.error}</Field.Error>}
        </form>
      </AlertDialog>
      {feedback}
    </span>
  );
}
