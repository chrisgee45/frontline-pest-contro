export function LogoIcon({ size = 40, className = '' }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56" fill="none" width={size} height={size} className={className}>
      <path d="M28 4L8 12v16c0 12.7 8.5 24.5 20 28 11.5-3.5 20-15.3 20-28V12L28 4z" fill="#1a5223"/>
      <path d="M28 8L12 14.5v13.5c0 10.5 7 20.3 16 23.2 9-2.9 16-12.7 16-23.2V14.5L28 8z" fill="#1e6328"/>
      <circle cx="28" cy="28" r="8" stroke="white" strokeWidth="1.8" fill="none"/>
      <circle cx="28" cy="28" r="3" fill="white"/>
      <line x1="28" y1="17" x2="28" y2="22" stroke="white" strokeWidth="1.8"/>
      <line x1="28" y1="34" x2="28" y2="39" stroke="white" strokeWidth="1.8"/>
      <line x1="17" y1="28" x2="22" y2="28" stroke="white" strokeWidth="1.8"/>
      <line x1="34" y1="28" x2="39" y2="28" stroke="white" strokeWidth="1.8"/>
    </svg>
  )
}

export function LogoIconWhite({ size = 40, className = '' }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56" fill="none" width={size} height={size} className={className}>
      <path d="M28 4L8 12v16c0 12.7 8.5 24.5 20 28 11.5-3.5 20-15.3 20-28V12L28 4z" fill="rgba(255,255,255,0.15)"/>
      <path d="M28 8L12 14.5v13.5c0 10.5 7 20.3 16 23.2 9-2.9 16-12.7 16-23.2V14.5L28 8z" fill="rgba(255,255,255,0.1)"/>
      <circle cx="28" cy="28" r="8" stroke="white" strokeWidth="1.8" fill="none" opacity="0.9"/>
      <circle cx="28" cy="28" r="3" fill="white" opacity="0.9"/>
      <line x1="28" y1="17" x2="28" y2="22" stroke="white" strokeWidth="1.8" opacity="0.9"/>
      <line x1="28" y1="34" x2="28" y2="39" stroke="white" strokeWidth="1.8" opacity="0.9"/>
      <line x1="17" y1="28" x2="22" y2="28" stroke="white" strokeWidth="1.8" opacity="0.9"/>
      <line x1="34" y1="28" x2="39" y2="28" stroke="white" strokeWidth="1.8" opacity="0.9"/>
    </svg>
  )
}

export function LogoFull({ className = '' }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <LogoIcon size={40} />
      <div className="leading-tight">
        <div className="font-display font-extrabold text-white text-base md:text-lg tracking-tight">FRONTLINE</div>
        <div className="text-[10px] md:text-xs text-gray-400 font-medium tracking-wide uppercase">Termite & Pest Control</div>
      </div>
    </div>
  )
}

export function LogoFullDark({ className = '' }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <LogoIcon size={40} />
      <div className="leading-tight">
        <div className="font-display font-extrabold text-charcoal-900 text-base md:text-lg tracking-tight">FRONTLINE</div>
        <div className="text-[10px] md:text-xs text-gray-500 font-medium tracking-wide uppercase">Termite & Pest Control</div>
      </div>
    </div>
  )
}
