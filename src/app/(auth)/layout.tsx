import { redirect } from "next/navigation";
import { Wordmark } from "@/components/logo";
import { getCurrentUser } from "@/lib/auth/session";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (await getCurrentUser()) redirect("/today");
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <BrandPanel />
      <div className="flex flex-col px-5 py-6 sm:px-10">
        <div className="lg:hidden">
          <Wordmark />
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">{children}</div>
      </div>
    </div>
  );
}

const STOPS = [
  { label: "Saved", color: "var(--stage-saved)" },
  { label: "Applied", color: "var(--stage-applied)" },
  { label: "Interviewing", color: "var(--stage-interviewing)" },
  { label: "Offer", color: "var(--stage-offer)" },
];

/** The one orchestrated moment: the line draws itself and lands on the highlighted stop. */
function BrandPanel() {
  return (
    <div className="relative hidden flex-col justify-between overflow-hidden bg-ink p-12 text-bg lg:flex">
      <Wordmark inverted />
      <div className="max-w-lg">
        <h1 className="text-[52px] leading-[1.02] font-bold tracking-[-0.035em]" style={{ fontVariationSettings: '"wdth" 85' }}>
          Your job search, on one line.
        </h1>
        <p className="mt-5 max-w-md text-lg text-bg/70">
          Every application from saved to signed. Jobbier tells you what needs a nudge today, and nothing else.
        </p>
      </div>
      <div aria-hidden className="relative pb-6">
        <svg viewBox="0 0 600 90" className="w-full overflow-visible">
          <line x1="12" y1="30" x2="588" y2="30" stroke="currentColor" strokeOpacity="0.18" strokeWidth="4" strokeLinecap="round" />
          <line x1="12" y1="30" x2="588" y2="30" stroke="currentColor" strokeWidth="4" strokeLinecap="round" pathLength={1} className="brand-draw" />
          {STOPS.map((s, i) => {
            const x = 12 + (i * 576) / 3;
            const last = i === STOPS.length - 1;
            return (
              <g key={s.label} className="brand-stop" style={{ animationDelay: `${250 + i * 260}ms` }}>
                <circle cx={x} cy="30" r={last ? 14 : 9} fill={last ? "var(--highlight)" : s.color} stroke="var(--ink)" strokeWidth="4" />
                <text x={x} y="74" textAnchor={i === 0 ? "start" : last ? "end" : "middle"} fill="currentColor" fillOpacity="0.7" fontSize="15" fontWeight="500">
                  {s.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <style>{`
        .brand-draw { stroke-dasharray: 1; stroke-dashoffset: 1; animation: brand-draw 1.1s 150ms cubic-bezier(.6,0,.2,1) forwards; }
        .brand-stop { opacity: 0; transform-box: fill-box; transform-origin: center; animation: brand-stop 380ms cubic-bezier(.2,.9,.3,1.3) forwards; }
        @keyframes brand-draw { to { stroke-dashoffset: 0; } }
        @keyframes brand-stop { from { opacity: 0; transform: scale(.4); } to { opacity: 1; transform: scale(1); } }
        @media (prefers-reduced-motion: reduce) { .brand-draw { animation: none; stroke-dashoffset: 0; } .brand-stop { animation: none; opacity: 1; } }
      `}</style>
    </div>
  );
}
