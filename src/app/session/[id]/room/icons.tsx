const baseProps = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function MicOnIcon() {
  return (
    <svg {...baseProps}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
    </svg>
  );
}

export function MicOffIcon() {
  return (
    <svg {...baseProps}>
      <path d="M9 5a3 3 0 0 1 6 0v5" />
      <path d="M15 12.5a3 3 0 0 1-6 0V8" />
      <path d="M5 11a7 7 0 0 0 7 7" />
      <path d="M19 11a6.97 6.97 0 0 1-1.8 4.7" />
      <path d="M3 3l18 18" />
      <path d="M12 18v3" />
    </svg>
  );
}

export function CamOnIcon() {
  return (
    <svg {...baseProps}>
      <rect x="3" y="6" width="13" height="12" rx="2" />
      <path d="M16 10l5-2v8l-5-2z" />
    </svg>
  );
}

export function CamOffIcon() {
  return (
    <svg {...baseProps}>
      <path d="M16 10l5-2v8l-5-2v-4" />
      <path d="M16 16v-2.5" />
      <rect x="3" y="6" width="13" height="12" rx="2" />
      <path d="M3 3l18 18" />
    </svg>
  );
}

export function ScreenShareIcon() {
  return (
    <svg {...baseProps}>
      <rect x="3" y="4" width="18" height="13" rx="2" />
      <path d="M8 21h8" />
      <path d="M12 17v4" />
      <path d="M9 10l3-3 3 3" />
      <path d="M12 7v6" />
    </svg>
  );
}

export function CaptionsIcon() {
  return (
    <svg {...baseProps}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M9 10.5a2 2 0 1 0 0 3" />
      <path d="M17 10.5a2 2 0 1 0 0 3" />
    </svg>
  );
}

export function LinkIcon() {
  return (
    <svg {...baseProps}>
      <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1.5 1.5" />
      <path d="M14 10a4 4 0 0 0-5.66 0l-3 3A4 4 0 0 0 11 18.66l1.5-1.5" />
    </svg>
  );
}

export function LeaveIcon() {
  return (
    <svg {...baseProps}>
      <path d="M7.5 15.5c3-1.6 6-1.6 9 0" />
      <path d="M4.2 12.7c5.2-4.2 10.4-4.2 15.6 0" />
      <path d="M6.6 14.2l-2.3 3.2" />
      <path d="M17.4 14.2l2.3 3.2" />
    </svg>
  );
}

export function MoreIcon() {
  return (
    <svg {...baseProps}>
      <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function FullscreenIcon() {
  return (
    <svg {...baseProps}>
      <path d="M8 3H3v5" />
      <path d="M16 3h5v5" />
      <path d="M8 21H3v-5" />
      <path d="M16 21h5v-5" />
    </svg>
  );
}

export function GlobeIcon() {
  return (
    <svg {...baseProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a14 14 0 0 1 0 18" />
      <path d="M12 3a14 14 0 0 0 0 18" />
    </svg>
  );
}

export function ChevronDownIcon() {
  return (
    <svg {...baseProps} width={14} height={14}>
      <path d="M7 10l5 5 5-5" />
    </svg>
  );
}

export function CloseIcon() {
  return (
    <svg {...baseProps}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
