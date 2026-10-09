"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Auction, BidEvent } from "./types";

/**
 * An auction kept current: loaded once from `source` (an /api route answering `{ auction }`), then moved by the auction's
 * event stream — each bid updates price, minimum, end and history in place; a change of state (closed, sold, declined)
 * reloads it. A reconnection reloads too, so nothing missed while offline stays missing. `skewMs` aligns countdowns on
 * the server's clock.
 */
export function useAuctionStream(source: string) {
  const [auction, setAuction] = useState<Auction | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [skewMs, setSkewMs] = useState(0);
  const [pulse, setPulse] = useState(0);
  const myAlias = useRef<number | null>(null);

  const reload = useCallback(async () => {
    const res = await fetch(source, { cache: "no-store" }).catch(() => null);
    if (!res) return;
    const data = (await res.json().catch(() => ({}))) as { auction?: Auction | null };
    const next = data.auction ?? null;
    setAuction(next);
    setLoaded(true);
    if (next) {
      myAlias.current = next.viewer.alias;
      setSkewMs(new Date(next.serverNow).getTime() - Date.now());
    }
  }, [source]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const id = auction?.id;
  const final = auction ? !["OPEN", "AWAITING_DECISION"].includes(auction.status) : false;
  useEffect(() => {
    if (!id || final) return;
    const stream = new EventSource(`/api/auctions/${id}/stream`);
    let opened = false;
    stream.addEventListener("connected", () => {
      if (opened) void reload();
      opened = true;
    });
    stream.onmessage = (e) => {
      let event: BidEvent | { type: "state" };
      try {
        event = JSON.parse(e.data);
      } catch {
        return;
      }
      if (event.type === "state") {
        void reload();
        return;
      }
      const bid = event;
      setPulse((n) => n + 1);
      setAuction((a) => {
        if (!a || a.recentBids.some((b) => b.id === bid.bid.id)) return a;
        const mine = bid.bid.alias === myAlias.current;
        return {
          ...a,
          highestBidCents: bid.highestBidCents,
          bidsCount: bid.bidsCount,
          leaderAlias: bid.leaderAlias,
          endsAt: bid.endsAt,
          minimumNextBidCents: bid.minimumNextBidCents,
          suggestedBidsCents: bid.suggestedBidsCents,
          biddersCount: Math.max(a.biddersCount, bid.bid.alias),
          // The creator learns the new leader's name on the next load; until then the alias stands.
          leaderUsername: a.viewer.isCreator ? null : a.leaderUsername,
          recentBids: [{ ...bid.bid, mine }, ...a.recentBids].slice(0, 12),
          viewer: { ...a.viewer, isLeader: mine },
        };
      });
    };
    return () => stream.close();
  }, [id, final, reload]);

  /** After this viewer's own bid: their alias is known from now on (first bid), and their balance moved. */
  const onOwnBid = useCallback((alias: number, balanceCents: number) => {
    myAlias.current = alias;
    setAuction((a) =>
      a
        ? {
            ...a,
            viewer: { ...a.viewer, alias, balanceCents, isLeader: a.leaderAlias === alias || a.viewer.isLeader },
            recentBids: a.recentBids.map((b) => (b.alias === alias ? { ...b, mine: true } : b)),
          }
        : a,
    );
  }, []);

  return { auction, loaded, skewMs, pulse, reload, onOwnBid };
}
