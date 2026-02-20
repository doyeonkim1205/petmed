export function PawIcon({ size = 24, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Main pad */}
      <ellipse cx="32" cy="40" rx="14" ry="12" fill="#60A5FA" />
      {/* Highlight on main pad */}
      <ellipse cx="29" cy="37" rx="6" ry="4.5" fill="#93C5FD" opacity="0.6" />
      {/* Top-left toe */}
      <ellipse cx="16" cy="22" rx="7" ry="8" transform="rotate(-15 16 22)" fill="#60A5FA" />
      <ellipse cx="15" cy="20" rx="3" ry="3.5" fill="#93C5FD" opacity="0.5" />
      {/* Top-right toe */}
      <ellipse cx="48" cy="22" rx="7" ry="8" transform="rotate(15 48 22)" fill="#60A5FA" />
      <ellipse cx="49" cy="20" rx="3" ry="3.5" fill="#93C5FD" opacity="0.5" />
      {/* Middle-left toe */}
      <ellipse cx="22" cy="14" rx="6" ry="7.5" transform="rotate(-5 22 14)" fill="#60A5FA" />
      <ellipse cx="21.5" cy="12.5" rx="2.5" ry="3" fill="#93C5FD" opacity="0.5" />
      {/* Middle-right toe */}
      <ellipse cx="42" cy="14" rx="6" ry="7.5" transform="rotate(5 42 14)" fill="#60A5FA" />
      <ellipse cx="42.5" cy="12.5" rx="2.5" ry="3" fill="#93C5FD" opacity="0.5" />
    </svg>
  );
}
