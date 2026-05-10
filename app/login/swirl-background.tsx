// Procedural painterly swirl rendered as inline SVG. Replaces the legacy
// /brand/swirl.jpg raster — vector means it stays crisp at any resolution
// (4K laptops, ultrawides) and keeps the JS bundle ~3 KB instead of a 130 KB
// JPG round-trip. The page layers tint + halo + grain on top, so this layer
// only has to carry color story and texture, not composition.
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

        <filter id="swirl-painterly" x="-15%" y="-15%" width="130%" height="130%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.006"
            numOctaves="3"
            seed="11"
            result="t"
          />
          <feDisplacementMap in="SourceGraphic" in2="t" scale="120" />
        </filter>
        <filter id="swirl-painterly-fine" x="-15%" y="-15%" width="130%" height="130%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.018"
            numOctaves="2"
            seed="3"
            result="t"
          />
          <feDisplacementMap in="SourceGraphic" in2="t" scale="42" />
        </filter>
      </defs>

      <rect width="1920" height="1080" fill="url(#swirl-base)" />

      <g filter="url(#swirl-painterly)">
        <ellipse cx="1500" cy="320" rx="780" ry="560" fill="url(#swirl-hi)" />
      </g>

      <g filter="url(#swirl-painterly-fine)">
        <ellipse cx="1300" cy="700" rx="900" ry="450" fill="url(#swirl-soft)" />
      </g>

      <g filter="url(#swirl-painterly)">
        <ellipse cx="1700" cy="1000" rx="500" ry="350" fill="url(#swirl-deep)" />
      </g>

      <g filter="url(#swirl-painterly-fine)">
        <ellipse cx="220" cy="900" rx="520" ry="400" fill="url(#swirl-soft)" opacity="0.55" />
      </g>

      <ellipse cx="700" cy="450" rx="600" ry="450" fill="url(#swirl-bright)" />
    </svg>
  );
}
