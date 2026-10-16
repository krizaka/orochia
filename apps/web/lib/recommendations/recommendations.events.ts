import { randomUUID } from "node:crypto";

import { pseudonymOf } from "./recommendations.pseudonym";
import { type Pseudonym, type RecoEvent, RecoEventKind } from "./recommendations.types";

/**
 * Turning an interaction into the event Orazaka receives — pure, so the payload is a unit test and the contract test's
 * input. Only pseudonymous ids leave Orochia: the person's pseudonym, the public video and creator ids, the kind, when.
 */
export interface Interaction {
  accountId: string;
  videoId?: string | null;
  creatorId?: string | null;
  kind: RecoEventKind;
  watchedPct?: number | null;
  at: Date;
}

export function toRecoEvent(interaction: Interaction, key: string, id: string = randomUUID()): RecoEvent {
  const aboutCreator = interaction.kind === RecoEventKind.Follow || interaction.kind === RecoEventKind.Unfollow;
  return {
    id,
    user: pseudonymOf(interaction.accountId, key),
    item: aboutCreator ? null : (interaction.videoId ?? null),
    creator: interaction.creatorId ?? null,
    kind: interaction.kind,
    watchedPct: interaction.watchedPct ?? null,
    at: interaction.at.toISOString(),
  };
}

/** An erasure as it leaves: the people's pseudonyms and the videos' ids. */
export function toErasure(accountIds: string[], videoIds: string[], key: string): { users: Pseudonym[]; items: string[] } {
  return { users: accountIds.map((id) => pseudonymOf(id, key)), items: videoIds };
}
