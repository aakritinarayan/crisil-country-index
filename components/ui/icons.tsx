// Small inline icon set (no icon dependency). Decorative: aria-hidden by default.
type P = { size?: number; className?: string };
const base = (size = 18) => ({ width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true });

export const ArrowUpRight = ({ size, className }: P) => (<svg {...base(size)} className={className}><path d="M7 17 17 7M9 7h8v8" /></svg>);
export const ArrowRight = ({ size, className }: P) => (<svg {...base(size)} className={className}><path d="M5 12h14M13 6l6 6-6 6" /></svg>);
export const ArrowLeft = ({ size, className }: P) => (<svg {...base(size)} className={className}><path d="M19 12H5M11 6l-6 6 6 6" /></svg>);
export const Search = ({ size, className }: P) => (<svg {...base(size)} className={className}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>);
export const Close = ({ size, className }: P) => (<svg {...base(size)} className={className}><path d="M6 6l12 12M18 6 6 18" /></svg>);
export const Sun = ({ size, className }: P) => (<svg {...base(size)} className={className}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>);
export const Moon = ({ size, className }: P) => (<svg {...base(size)} className={className}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" /></svg>);
export const Plus = ({ size, className }: P) => (<svg {...base(size)} className={className}><path d="M12 5v14M5 12h14" /></svg>);
export const Minus = ({ size, className }: P) => (<svg {...base(size)} className={className}><path d="M5 12h14" /></svg>);
export const Reset = ({ size, className }: P) => (<svg {...base(size)} className={className}><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>);
export const ChevronDown = ({ size, className }: P) => (<svg {...base(size)} className={className}><path d="m6 9 6 6 6-6" /></svg>);
export const Sort = ({ size, className }: P) => (<svg {...base(size)} className={className}><path d="M8 4v16M4 8l4-4 4 4M16 20V4M12 16l4 4 4-4" /></svg>);
export const Crosshair = ({ size, className }: P) => (<svg {...base(size)} className={className}><circle cx="12" cy="12" r="7" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" /></svg>);
export const Expand = ({ size, className }: P) => (<svg {...base(size)} className={className}><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></svg>);
export const Collapse = ({ size, className }: P) => (<svg {...base(size)} className={className}><path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7" /></svg>);
export const PanelRight = ({ size, className }: P) => (<svg {...base(size)} className={className}><rect x="3" y="4" width="18" height="16" /><path d="M15 4v16" /></svg>);
export const GlobeIcon = ({ size, className }: P) => (<svg {...base(size)} className={className}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z" /></svg>);
export const MapIcon = ({ size, className }: P) => (<svg {...base(size)} className={className}><path d="M9 4 3 6.5v13.5L9 17.5l6 2.5 6-2.5V4l-6 2.5L9 4Z" /><path d="M9 4v13.5M15 6.5V20" /></svg>);
export const Check = ({ size, className }: P) => (<svg {...base(size)} className={className}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>);
