/** The phone bar's fourth tab: Messages for a signed-in account (the inbox must be one tap away), Saved otherwise. */
export type BottomNavLeaf = "messages" | "saved";

export const bottomNavLeaf = (signedIn: boolean): BottomNavLeaf => (signedIn ? "messages" : "saved");
