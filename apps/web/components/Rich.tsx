import React from "react";

/** Renders a message with <b>…</b> emphasis and {placeholders} replaced by nodes (links, …). */
export function Rich({ text, slots = {} }: { text: string; slots?: Record<string, React.ReactNode> }) {
  const parts = text.split(/(<b>.*?<\/b>|\{\w+\})/g).filter(Boolean);
  return (
    <>
      {parts.map((part, i) => {
        const bold = /^<b>(.*)<\/b>$/.exec(part);
        if (bold) return <strong key={i} className="font-semibold text-fg">{bold[1]}</strong>;
        const slot = /^\{(\w+)\}$/.exec(part);
        if (slot && slot[1] in slots) return <React.Fragment key={i}>{slots[slot[1]]}</React.Fragment>;
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </>
  );
}
