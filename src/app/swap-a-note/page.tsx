import type { Metadata } from "next";
import { SwapNoteWorkbench } from "@/components/swap-note/SwapNoteWorkbench";

export const metadata: Metadata = {
  title: "Swap a Note — Scenthub",
  description:
    "Edit one note in a fragrance, recalculate its scent profile, and find the closest real fragrances.",
  alternates: { canonical: "/swap-a-note" },
};

export default function SwapANotePage() {
  return <SwapNoteWorkbench />;
}
