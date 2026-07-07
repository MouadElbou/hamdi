import React from 'react';

const S = (children: React.ReactNode) => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
);

const ICONS: Record<string, React.ReactNode> = {
  ecrans: S(<><rect x="2.5" y="3.5" width="19" height="13" rx="1.5" /><path d="M9 20.5h6M12 16.5v4" /></>),
  batteries: S(<><rect x="2.5" y="7" width="16" height="10" rx="2" /><path d="M18.5 10.5h1.5a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1h-1.5" /><path d="M6 10.5v3M9 10.5v3" /></>),
  chargeurs: S(<path d="M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12l1-8.5Z" />),
  claviers: S(<><rect x="2.5" y="6" width="19" height="12" rx="2" /><path d="M6 9.5h.01M9 9.5h.01M12 9.5h.01M15 9.5h.01M18 9.5h.01M8 14h8" /></>),
  laptops: S(<><rect x="4" y="4.5" width="16" height="11" rx="1.5" /><path d="M2 19h20l-1.5-3.5H3.5L2 19Z" /></>),
  ordinateurs: S(<><rect x="5" y="2.5" width="9" height="19" rx="1.5" /><path d="M8 6h3M8 9h3M8 18h.01" /><path d="M17 8h4M19 6v4M17 15h4v4h-4z" /></>),
  impression: S(<><path d="M6.5 8.5V3.5h11v5" /><rect x="3.5" y="8.5" width="17" height="8" rx="1.5" /><path d="M6.5 14h11v6.5h-11z" /><path d="M17.5 11.5h.01" /></>),
  reseaux: S(<><path d="M2 8.8a15 15 0 0 1 20 0M5 12.2a10 10 0 0 1 14 0M8.2 15.6a5 5 0 0 1 7.6 0" /><path d="M12 19h.01" /></>),
  peripheriques: S(<><rect x="7" y="2.5" width="10" height="19" rx="5" /><path d="M12 6.5v4" /></>),
  multimedia: S(<><path d="M4 9v6h4l5 4V5L8 9H4Z" /><path d="M17 9a4 4 0 0 1 0 6M19.5 6.5a8 8 0 0 1 0 11" /></>),
  securite: S(<><path d="M12 2.5 20 6v5c0 5-3.4 8.6-8 10.5C7.4 19.6 4 16 4 11V6l8-3.5Z" /><path d="m9 11.5 2 2 4-4" /></>),
  gaming: S(<><rect x="2.5" y="7.5" width="19" height="9" rx="4.5" /><path d="M7 11v2M6 12h2M15.5 11.5h.01M18 13.5h.01" /></>),
  services: S(<path d="M15.5 6.5a4.5 4.5 0 0 1-5.9 5.9L4 18l2 2 5.6-5.6a4.5 4.5 0 0 1 5.9-5.9l-2.8 2.8-1.9-.5-.5-1.9 2.8-2.8Z" />),
};

export function catIcon(key: string): React.ReactNode {
  return ICONS[key] ?? S(<><rect x="3" y="3" width="18" height="18" rx="2" /></>);
}
