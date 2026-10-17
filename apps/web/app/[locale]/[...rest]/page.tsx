import { notFound } from "next/navigation";

/** An address under a language that no page matches: the app's own 404, inside the layout of its language. */
export default function UnmatchedPage() {
  notFound();
}
