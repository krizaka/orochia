import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { I18nProvider } from "./i18n-client";
import { setTestLocale } from "./i18n-test-server";
import type { Locale } from "./locales";

/** Wraps an element the way the root layout does, so a client component renders in tests in the language asked. */
export function inLocale(locale: Locale, element: ReactElement): ReactElement {
  return <I18nProvider locale={locale}>{element}</I18nProvider>;
}

/** The HTML of a client (or plain) component in a language. */
export function htmlIn(locale: Locale, element: ReactElement): string {
  return renderToStaticMarkup(inLocale(locale, element));
}

/** Runs the async server components of a tree, the way the server would, so a sync renderer can print what is left. */
async function resolve(node: ReactNode): Promise<ReactNode> {
  if (Array.isArray(node)) return Promise.all(node.map(resolve));
  if (!isValidElement(node)) return node;
  const element = node as ReactElement<{ children?: ReactNode }>;
  if (typeof element.type === "function" && element.type.constructor.name === "AsyncFunction") {
    return resolve(await (element.type as (props: unknown) => Promise<ReactNode>)(element.props));
  }
  const children = element.props.children;
  if (children === undefined || typeof element.type === "function") return element;
  const resolved = await Promise.all(Children.toArray(children).map(resolve));
  return cloneElement(element, undefined, ...resolved);
}

/**
 * The HTML of an async server component in a language: the component runs as the request would (its language read by
 * `getI18n()`, which the test file maps to ./i18n-test-server) and the element it returns renders inside the provider.
 * The async server components it renders as children are run too; one that a sync component renders inside itself is not.
 */
export async function serverHtmlIn<P>(locale: Locale, component: (props: P) => Promise<ReactElement | null> | ReactElement | null, props: P): Promise<string> {
  setTestLocale(locale);
  const tree = await resolve(await component(props));
  return renderToStaticMarkup(inLocale(locale, <>{tree}</>));
}
