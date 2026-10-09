"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChallengeView } from "@/lib/challenges";

interface PledgeEvent {
  type: "pledge";
  pledge: { id: string; alias: number; amountCents: number; createdAt: string };
  pledgedCents: number;
  backersCount: number;
  progress: number | null;
}

/**
 * A challenge kept current: loaded from its API route, then moved by its event stream — each pledge updates the pot,
 * the backers and the recent pledges in place; a change of state reloads it, and so does a reconnection, so nothing
 * missed while offline stays missing. `skewMs` aligns the countdowns on the server's clock.
 */
export function useChallengeStream(id: string) {
  const [challenge, setChallenge] = useState<ChallengeView | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [skewMs, setSkewMs] = useState(0);
  const [pulse, setPulse] = useState(0);
  const myAlias = useRef<number | null>(null);

  const reload = useCallback(async () => {
    const res = await fetch(`/api/challenges/${id}`, {
      cache: "no-store",
    }).catch(() => null);
    const data = res ? ((await res.json().catch(() => ({}))) as { challenge?: ChallengeView }) : {};
    const next = data.challenge ?? null;
    setChallenge(next);
    setLoaded(true);
    if (next) {
      myAlias.current = next.viewer.alias;
      setSkewMs(new Date(next.serverNow).getTime() - Date.now());
    }
  }, [id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const live = Boolean(challenge) && !["DELIVERED", "DECLINED", "EXPIRED", "FAILED", "CANCELLED"].includes(challenge?.stage ?? "");
  useEffect(() => {
    if (!live) return;
    const stream = new EventSource(`/api/challenges/${id}/stream`);
    let opened = false;
    stream.addEventListener("connected", () => {
      if (opened) void reload();
      opened = true;
    });
    stream.onmessage = (e) => {
      let event: PledgeEvent | { type: "state" };
      try {
        event = JSON.parse(e.data);
      } catch {
        return;
      }
      if (event.type === "state") {
        void reload();
        return;
      }
      const p = event;
      setPulse((n) => n + 1);
      setChallenge((c) => {
        if (!c || c.recentPledges.some((r) => r.id === p.pledge.id)) return c;
        const reached = (p.progress ?? 0) >= 1;
        return {
          ...c,
          pledgedCents: p.pledgedCents,
          backersCount: p.backersCount,
          progress: p.progress,
          stage: c.stage === "FUNDING" && reached ? "GOAL_REACHED" : c.stage,
          recentPledges: [{ ...p.pledge, mine: p.pledge.alias === myAlias.current }, ...c.recentPledges].slice(0, 12),
        };
      });
    };
    return () => stream.close();
  }, [id, live, reload]);

  return { challenge, loaded, skewMs, pulse, reload };
}
