import { NoteImage } from "@/components/NoteImage";
import type { NoteProminence, NoteTier } from "@/lib/types";

interface PerfumePyramidProps {
  topNotes: string[];
  heartNotes: string[];
  baseNotes: string[];
  noteProminence?: NoteProminence;
  /** When set, matching notes get a highlighted ring. */
  highlight?: string;
}

export function PerfumePyramid({
  topNotes,
  heartNotes,
  baseNotes,
  noteProminence,
  highlight,
}: PerfumePyramidProps) {
  const hasNotes =
    topNotes.length > 0 || heartNotes.length > 0 || baseNotes.length > 0;

  if (!hasNotes) {
    return (
      <p className="text-sm text-muted">No note pyramid is available.</p>
    );
  }

  return (
    <div className="flex flex-col">
      <header className="mb-5 flex items-center gap-2 border-b border-border pb-3">
        <FlaskIcon className="h-4 w-4 text-muted" />
        <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
          Perfume pyramid
        </h2>
      </header>

      <div className="flex flex-col divide-y divide-border">
        <PyramidTier
          label="Top notes"
          tier="top"
          notes={topNotes}
          prominence={noteProminence?.top}
          highlight={highlight}
        />
        <PyramidTier
          label="Middle notes"
          tier="heart"
          notes={heartNotes}
          prominence={noteProminence?.heart}
          highlight={highlight}
        />
        <PyramidTier
          label="Base notes"
          tier="base"
          notes={baseNotes}
          prominence={noteProminence?.base}
          highlight={highlight}
        />
      </div>
    </div>
  );
}

function PyramidTier({
  label,
  tier,
  notes,
  prominence,
  highlight,
}: {
  label: string;
  tier: NoteTier;
  notes: string[];
  prominence?: Record<string, number>;
  highlight?: string;
}) {
  if (notes.length === 0) return null;

  return (
    <div className="flex flex-col items-center gap-3 py-5 first:pt-1 last:pb-1">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
        {label}
      </h3>
      <ul className="flex flex-wrap items-end justify-center gap-5">
        {notes.map((note) => {
          const isHighlighted =
            !!highlight &&
            note.trim().toLowerCase() === highlight.trim().toLowerCase();
          const score = noteProminenceScore(prominence, note);
          const size = score == null ? 80 : Math.round(40 + score * 40);
          return (
            <li
              key={`${tier}-${note}`}
              className={`flex w-24 flex-col items-center gap-2 ${
                isHighlighted ? "rounded-2xl ring-2 ring-accent ring-offset-2 ring-offset-card" : ""
              }`}
            >
              <NoteImage
                name={note}
                className="rounded-2xl"
                imageClassName="h-[88%] w-[88%] rounded-xl object-cover"
                style={{ width: size, height: size }}
              />
              <span
                className={`text-center text-sm leading-snug ${
                  isHighlighted ? "font-bold text-accent" : "font-medium"
                }`}
              >
                {note}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function noteProminenceScore(
  prominence: Record<string, number> | undefined,
  note: string,
): number | null {
  if (!prominence) return null;
  const wanted = note.trim().toLowerCase();
  const match = Object.entries(prominence).find(
    ([name]) => name.trim().toLowerCase() === wanted,
  );
  if (!match || !Number.isFinite(match[1])) return null;
  return Math.min(1, Math.max(0, match[1]));
}

function FlaskIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M9 3h6" />
      <path d="M10 3v6.5L5.2 17a2.5 2.5 0 0 0 2.1 3.9h9.4a2.5 2.5 0 0 0 2.1-3.9L14 9.5V3" />
      <path d="M8.5 14h7" />
    </svg>
  );
}
