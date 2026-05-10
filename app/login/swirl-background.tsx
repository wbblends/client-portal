// Procedural painterly swirl rendered as inline SVG. Replaces the legacy
// /brand/swirl.jpg raster — vector means it stays crisp at any resolution
// (4K laptops, ultrawides) and ships ~2 KB instead of a 130 KB JPG. The page
// layers tint + halo + grain on top, so this layer only has to carry color
// story, not composition.
export function SwirlBackground() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1920 1080"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 h-full w-full"
      aria-hidden
    >
      <defs>
        <radialGradient id="swirl-base" cx="50%" cy="50%" r="80%">
          <stop offset="0%" stopColor="#fbfaff" />
          <stop offset="100%" stopColor="#eeebff" />
        </radialGradient>
        <radialGradient id="swirl-hi" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#6e5bfe" stopOpacity="0.92" />
          <stop offset="35%" stopColor="#8675ff" stopOpacity="0.6" />
          <stop offset="75%" stopColor="#a698ff" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#a698ff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="swirl-deep" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#5947e8" stopOpacity="0.6" />
          <stop offset="55%" stopColor="#6e5bfe" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#6e5bfe" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="swirl-soft" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#b8acff" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#b8acff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="swirl-bright" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="1920" height="1080" fill="url(#swirl-base)" />

      {/* Saturated hero, upper-right — mass that will mostly survive the
          runtime tint and read as the brand purple. */}
      <ellipse cx="1500" cy="320" rx="780" ry="560" fill="url(#swirl-hi)" />

      {/* Mid-tone wash trailing across the right side. */}
      <ellipse cx="1300" cy="700" rx="900" ry="450" fill="url(#swirl-soft)" />

      {/* Deep accent in the lower-right corner for depth. */}
      <ellipse cx="1700" cy="1000" rx="500" ry="350" fill="url(#swirl-deep)" />

      {/* Faint counter-tone bottom-left so the composition isn't one-sided. */}
      <ellipse cx="220" cy="900" rx="520" ry="400" fill="url(#swirl-soft)" opacity="0.55" />

      {/* Bright focal — gives the headline area extra lift before the page's
          radial halo even kicks in. */}
      <ellipse cx="700" cy="450" rx="600" ry="450" fill="url(#swirl-bright)" />
    </svg>
  );
}
