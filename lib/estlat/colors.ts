// Est-Lat liiga ei anna tiimivärve: põhivärv on võetud klubi logost (estlatbl.com), et parimate
// soorituste ja MVP kaardid oleksid tiimi värvi. Must logo (Tartu, VEF) annaks halli kaardi, seal on
// klubi enda sinine. Uus klubi ilma värvita saab kaardil dashboardi põhivärvi.

const CLUB_COLORS: Record<string, string> = {
  BKL: "#c41e3a", // BK Liepāja: punane kilp
  BKO: "#2f62ad", // BK Ogre: sinine
  BKV: "#8e1b3a", // BK Ventspils: kirsipunane
  KEB: "#2b2b2b", // Keila Basket: must logo
  KEI: "#1e9ad6", // Keila KK: helesinine
  KLV: "#0b5c82", // Bigbank/Kalev: petrool
  LAT: "#1f3a6e", // Latvijas Universitāte: tumesinine
  PAR: "#2a3f9d", // BC Pärnu: logo sinine ring (oranž on Viimsil)
  REJ: "#3b7fc4", // Rīgas Ekselences Juniori: sinine
  TAL: "#c2187a", // TalTech/ALEXELA: vaarikas
  TAR: "#2c5697", // Tartu Ülikool: ülikooli sinine (logo on must)
  VAL: "#2e7d32", // Valmiera Glass VIA: roheline
  VEF: "#1b2a4a", // VEF Rīga: tumesinine (logo on peaaegu must)
  // Viimsi: oranž, logost (#f47b20) sügavam, sest kaart tumendab heledat värvi ja see läheks pruuniks.
  VMS: "#e2661b",
  ZEL: "#c21fc9", // Rīgas Zeļļi: magenta
};

export function clubColor(code: string | undefined): string | null {
  return (code && CLUB_COLORS[code]) || null;
}
