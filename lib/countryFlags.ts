const COUNTRY_CODES: Record<string, string> = {
  Estonia: "EE",
  Latvia: "LV",
  Lithuania: "LT",
  Finland: "FI",
  Sweden: "SE",
  Norway: "NO",
  Denmark: "DK",
  Iceland: "IS",
  Germany: "DE",
  France: "FR",
  Spain: "ES",
  Italy: "IT",
  Portugal: "PT",
  Belgium: "BE",
  Netherlands: "NL",
  Luxembourg: "LU",
  Switzerland: "CH",
  Austria: "AT",
  Poland: "PL",
  "Czech Republic": "CZ",
  Czechia: "CZ",
  Slovakia: "SK",
  Hungary: "HU",
  Slovenia: "SI",
  Croatia: "HR",
  Serbia: "RS",
  "Bosnia and Herzegovina": "BA",
  Montenegro: "ME",
  "North Macedonia": "MK",
  Albania: "AL",
  Kosovo: "XK",
  Greece: "GR",
  Bulgaria: "BG",
  Romania: "RO",
  Turkey: "TR",
  Cyprus: "CY",
  Malta: "MT",
  Ukraine: "UA",
  Belarus: "BY",
  Russia: "RU",
  Moldova: "MD",
  Georgia: "GE",
  Armenia: "AM",
  Azerbaijan: "AZ",
  Israel: "IL",
  "Great Britain": "GB",
  "United Kingdom": "GB",
  Ireland: "IE",
};

function flagEmoji(isoCode: string): string {
  return isoCode
    .toUpperCase()
    .split("")
    .map((c) => String.fromCodePoint(127397 + c.charCodeAt(0)))
    .join("");
}

export function countryFlag(countryName: string): string | null {
  const code = COUNTRY_CODES[countryName];
  return code ? flagEmoji(code) : null;
}
