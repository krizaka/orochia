/**
 * « View as the public » (orochia#263): the owner of a profile opens it as another audience would see it —
 * `/@username?as=public`. Only the owner gets a preview; any other viewer, and any other value, is the normal page.
 */
export type ViewAs = "public";

export function viewAsOf(value: string | string[] | undefined, isOwner: boolean): ViewAs | null {
  return isOwner && value === "public" ? "public" : null;
}
