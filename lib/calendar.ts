export const googleCalendarAddUrl = (id: string) => `/api/google/add/${id}`;

export const whatsappUrl = (text: string) =>
  `https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_PHONE ?? ""}?text=${encodeURIComponent(text)}`;
