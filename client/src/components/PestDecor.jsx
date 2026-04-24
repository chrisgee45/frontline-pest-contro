// Decorative SVG elements for the dark sections of the site.
// All shapes use `currentColor` so the caller controls color + opacity
// through Tailwind text utilities (e.g. `text-forest-500/10`).
//
// Transform to other corners via Tailwind:
//   top-left     → default
//   top-right    → `-scale-x-100`
//   bottom-left  → `-scale-y-100`
//   bottom-right → `-scale-100` (Tailwind v3.2+, or use `rotate-180`)

export function SpiderWeb({ className = '' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 200 200"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Radial anchor threads fanning from the corner (0,0) */}
      <line x1="0" y1="0" x2="200" y2="0" />
      <line x1="0" y1="0" x2="195" y2="45" />
      <line x1="0" y1="0" x2="175" y2="90" />
      <line x1="0" y1="0" x2="145" y2="135" />
      <line x1="0" y1="0" x2="105" y2="170" />
      <line x1="0" y1="0" x2="60" y2="190" />
      <line x1="0" y1="0" x2="0" y2="200" />
      {/* Concentric silk threads, curved to suggest slight gravitational sag */}
      <path d="M 30,0 Q 25,25 0,30" />
      <path d="M 60,0 Q 48,48 0,60" />
      <path d="M 95,0 Q 75,75 0,95" />
      <path d="M 130,0 Q 100,100 0,130" />
      <path d="M 165,0 Q 125,125 0,165" />
      <path d="M 195,5 Q 150,150 5,195" />
    </svg>
  )
}

export function Spider({ className = '', withThread = false }) {
  return (
    <svg
      className={className}
      viewBox="0 0 80 100"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      aria-hidden="true"
    >
      {withThread && (
        <line
          x1="40"
          y1="0"
          x2="40"
          y2="32"
          stroke="currentColor"
          strokeWidth="0.6"
        />
      )}
      {/* 8 legs, symmetric pairs */}
      <g stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round">
        {/* Left side */}
        <path d="M 32,48 Q 16,40 10,24" />
        <path d="M 30,55 Q 10,55 2,50" />
        <path d="M 30,62 Q 10,68 4,82" />
        <path d="M 34,68 Q 24,80 20,94" />
        {/* Right side */}
        <path d="M 48,48 Q 64,40 70,24" />
        <path d="M 50,55 Q 70,55 78,50" />
        <path d="M 50,62 Q 70,68 76,82" />
        <path d="M 46,68 Q 56,80 60,94" />
      </g>
      {/* Abdomen */}
      <ellipse cx="40" cy="60" rx="11" ry="13" fill="currentColor" />
      {/* Cephalothorax / head */}
      <ellipse cx="40" cy="45" rx="7" ry="6" fill="currentColor" />
      {/* Tiny eye glints for character */}
      <circle cx="37" cy="43" r="1" fill="#ffffff" opacity="0.85" />
      <circle cx="43" cy="43" r="1" fill="#ffffff" opacity="0.85" />
    </svg>
  )
}
