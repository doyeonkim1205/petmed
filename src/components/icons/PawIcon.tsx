export function PawIcon({ size = 24, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Main pad - heart-like shape */}
      <path
        d="M18 32c-1.5 0-12-7-12-15a7 7 0 0 1 12-4.9A7 7 0 0 1 30 17c0 8-10.5 15-12 15z"
        fill="currentColor"
      />
      {/* Toe 1 - top left */}
      <circle cx="8.5" cy="9" r="4" fill="currentColor" />
      {/* Toe 2 - inner left */}
      <circle cx="16" cy="5.5" r="3.5" fill="currentColor" />
      {/* Toe 3 - inner right */}
      <circle cx="23.5" cy="5.5" r="3.5" fill="currentColor" />
      {/* Toe 4 - top right */}
      <circle cx="30.5" cy="9" r="4" fill="currentColor" />
    </svg>
  );
}
