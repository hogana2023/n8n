import { cn } from "@/lib/utils";

/**
 * Wordmark with a small pan-and-leaf glyph. Inline SVG so it inherits
 * currentColor and costs no extra request.
 */
export function Logo({ className, mark = true }: { className?: string; mark?: boolean }) {
  return (
    <svg
      viewBox="0 0 168 28"
      role="img"
      aria-label="PantryChef"
      className={cn("text-ink", className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {mark && (
        <g>
          {/* pan body */}
          <path
            d="M4 14.5a9 9 0 0 1 18 0v1.2a6.8 6.8 0 0 1-6.8 6.8h-4.4A6.8 6.8 0 0 1 4 15.7v-1.2Z"
            className="fill-herb"
          />
          {/* handle */}
          <rect x="21" y="12.6" width="7.5" height="2.6" rx="1.3" className="fill-ink/70" />
          {/* leaf */}
          <path
            d="M13 10.6c0-3 2.2-5.4 5.2-5.9-.2 3.2-2.2 5.4-5.2 5.9Z"
            className="fill-white"
          />
        </g>
      )}
      <text
        x={mark ? 36 : 0}
        y="19.5"
        className="fill-current"
        style={{
          fontSize: "17px",
          fontWeight: 600,
          letterSpacing: "-0.03em",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'SF Pro Display', Inter, sans-serif",
        }}
      >
        PantryChef
      </text>
    </svg>
  );
}
