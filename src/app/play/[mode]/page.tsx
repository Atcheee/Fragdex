import { MODES } from "@/lib/modes";
import { PlayClient } from "./PlayClient";

export function generateStaticParams() {
  return [
    ...MODES.map((mode) => ({ mode: mode.id })),
    { mode: "connections-generated" },
  ];
}

export default function PlayPage() {
  return <PlayClient />;
}
