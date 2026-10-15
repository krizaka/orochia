/**
 * APP_PUBLIC_ACTIONS: `off` on a development deployment, where a signed-out visitor's actions are accepted but not counted.
 * Anything else (and no value) keeps the production behaviour.
 */
export function publicActionsOn(value: string | undefined = process.env.APP_PUBLIC_ACTIONS): boolean {
  return value !== "off";
}
