export const Arrow = () => (
  <svg className="arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);
export const Tab = ({ d }: { d: string }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden><path d={d} /></svg>
);
export const WhatsApp = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M12 2a10 10 0 0 0-8.6 15l-1.4 5 5.2-1.4A10 10 0 1 0 12 2Zm5.2 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.2-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.8 0-1.4.7-2 1-2.3.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.9 2.1c.1.2.1.4 0 .5l-.4.6-.4.4c-.1.2-.3.3-.1.6.2.3.8 1.3 1.8 2.1 1.2 1 2.2 1.4 2.5 1.5.3.1.5.1.6-.1l.9-1c.2-.3.4-.2.6-.1l2 1c.3.1.5.2.5.4.1.1.1.6-.1 1.2Z" /></svg>
);

const Stroke = ({ d, size = 18 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0"><path d={d} /></svg>
);
export const Back = () => <Stroke d="M15 6l-6 6 6 6" />;
export const Next = () => <Stroke d="M9 6l6 6-6 6" />;
export const Check = () => <Stroke d="M5 12l5 5 9-10" />;
export const Alert = () => <Stroke d="M12 8v5M12 17h.01M10.3 3.9L2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />;

export const GoogleG = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden className="shrink-0">
    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5Z" />
    <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.2 5.5-4.7 7.2l7.6 5.9c4.4-4.1 6.9-10.1 6.9-17.6Z" />
    <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.900-6.100a24 24 0 0 0 0 21.600l7.900-6.100Z" />
    <path fill="#34A853" d="M24 48c6.500 0 11.900-2.100 15.900-5.800l-7.600-5.900c-2.100 1.400-4.900 2.300-8.300 2.300-6.300 0-11.600-4.100-13.500-9.800l-7.900 6.100C6.500 42.600 14.600 48 24 48Z" />
  </svg>
);

export const GoogleCalendar = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden className="shrink-0">
    <rect x="8" y="8" width="32" height="32" fill="#fff" />
    <path fill="#4285F4" d="M8 14a6 6 0 0 1 6-6h18v6H14v26H8Z" />
    <path fill="#188038" d="M8 34h6v8H11a3 3 0 0 1-3-3Z" />
    <path fill="#FBBC04" d="M32 8h8v26h-8z" />
    <path fill="#EA4335" d="M32 34h8l-8 8Z" />
    <path fill="#34A853" d="M14 34h18v8H14z" />
    <path fill="#1967D2" d="M8 34h6v8H11a3 3 0 0 1-3-3Z" />
    <text x="23" y="29" fontSize="13" fontWeight="700" textAnchor="middle" fill="#4285F4" fontFamily="Arial,sans-serif">31</text>
  </svg>
);
export const Close = () => <Stroke d="M6 6l12 12M18 6L6 18" size={14} />;
export const Chevron = () => <Stroke d="M6 9l6 6 6-6" />;
