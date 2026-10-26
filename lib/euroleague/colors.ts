// EuroLeague'i API klubivärve ei anna (ainult vapi). Hooaja 2026-27 klubide põhivärvid käsitsi,
// võtmeks API klubikood. Puuduv klubi saab dashboardi aktsendi (teamTone kasutajaliideses).
// Mustad klubid heledatakse kaardil automaatselt, et valge tekst jääks loetavaks.
const CLUB_COLORS: Record<string, string> = {
  ASV: "#00843d", // LDLC ASVEL
  BAR: "#004d98", // FC Barcelona
  BAS: "#002f6c", // Baskonia
  BES: "#1b1b1b", // Besiktas
  DUB: "#1b1b1b", // Dubai Basketball
  HTA: "#e30613", // Hapoel Tel Aviv
  IST: "#002f6c", // Anadolu Efes
  MAD: "#4b2a82", // Real Madrid
  MIL: "#d50032", // Olimpia Milano
  MUN: "#dc052d", // FC Bayern Munich
  OLY: "#e2001a", // Olympiacos
  PAM: "#ee7f00", // Valencia Basket
  PAN: "#007a33", // Panathinaikos
  PAR: "#1b1b1b", // Partizan
  PRS: "#1b1b1b", // Paris Basketball
  RED: "#d0021b", // Crvena Zvezda
  TEL: "#00338d", // Maccabi Tel Aviv
  ULK: "#002d72", // Fenerbahce
  VIR: "#1b1b1b", // Virtus Bologna
  ZAL: "#00843d", // Zalgiris
};

export function clubColor(code: string | undefined): string | null {
  return (code && CLUB_COLORS[code]) || null;
}
