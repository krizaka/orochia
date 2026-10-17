import React from "react";

/** Re-mounted on every navigation: each page enters with the Krizaka ease (stilled under reduced motion). */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="kz-page">{children}</div>;
}
