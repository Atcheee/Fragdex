import { MODES } from "@/lib/modes";
import { PlayClient } from "./PlayClient";

// Every supported mode is generated below; unknown modes should be a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return [
    ...MODES.map((mode) => ({ mode: mode.id })),
    { mode: "connections-generated" },
  ];
}

export default function PlayPage() {
  return <PlayClient />;
}
