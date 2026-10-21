/** The wall clock, behind a function: a server page reads it once per request (and a test can pass its own to deriveTasks). */
export const now = (): number => Date.now();
