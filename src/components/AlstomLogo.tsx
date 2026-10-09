/**
 * ALSTOM wordmark — the brand mark used across ShiftLine (landing, login, app header).
 * Light theme: navy letters + red swirl "O". Dark theme: all white.
 * Follows the page theme (`html[data-theme]`) automatically.
 * Letters are text (Poppins 800, already loaded) so they stay crisp at any size;
 * the "O" is drawn as an open ring with an inward swirl, sized to the cap height.
 */
export function AlstomLogo({ height = 22, className = '' }: { height?: number; className?: string }) {
  // Poppins cap height ≈ 0.7em, so this font size makes the capitals `height` px tall
  const fontSize = height / 0.7;

  return (
    <span
      role="img"
      aria-label="ALSTOM"
      className={`inline-flex items-baseline select-none whitespace-nowrap text-[#1D2A4D] dark:text-white ${className}`}
      style={{
        fontFamily: "'Poppins', 'Inter', sans-serif",
        fontWeight: 800,
        fontSize,
        lineHeight: 1,
        letterSpacing: '0.03em',
      }}
    >
      <span aria-hidden>ALST</span>
      <svg
        aria-hidden
        viewBox="0 0 100 100"
        className="stroke-[#E3051B] dark:stroke-white"
        style={{ height: '0.7em', width: '0.7em', margin: '0 0.03em', verticalAlign: 'baseline', flexShrink: 0 }}
      >
        {/* outer ring, open at the top-right */}
        <path d="M80.9 22.4 A43 43 0 1 1 57.5 7.7" fill="none" strokeWidth="13" strokeLinecap="round" />
        {/* swirl: from the ring's top end, curling inward */}
        <path d="M57.5 7.7 Q 76 30 56 52" fill="none" strokeWidth="9" strokeLinecap="round" />
      </svg>
      <span aria-hidden>M</span>
    </span>
  );
}
