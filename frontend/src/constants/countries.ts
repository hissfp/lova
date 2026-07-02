// Lightweight country name -> ISO-2 code mapping used to render round flag
// badges via the hatscripts/circle-flags CDN.
//
// This is intentionally limited to the countries we seed and the most common
// English country names users are likely to type into their profile.

const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  // English names (lowercased -> ISO-2)
  china: "cn",
  "people's republic of china": "cn",
  taiwan: "tw",
  "hong kong": "hk",
  japan: "jp",
  "south korea": "kr",
  korea: "kr",
  "north korea": "kp",
  vietnam: "vn",
  thailand: "th",
  indonesia: "id",
  malaysia: "my",
  philippines: "ph",
  singapore: "sg",
  india: "in",
  pakistan: "pk",
  bangladesh: "bd",
  "sri lanka": "lk",
  nepal: "np",
  mexico: "mx",
  brazil: "br",
  argentina: "ar",
  chile: "cl",
  colombia: "co",
  peru: "pe",
  venezuela: "ve",
  spain: "es",
  portugal: "pt",
  france: "fr",
  germany: "de",
  italy: "it",
  netherlands: "nl",
  belgium: "be",
  switzerland: "ch",
  austria: "at",
  poland: "pl",
  "czech republic": "cz",
  czechia: "cz",
  hungary: "hu",
  greece: "gr",
  sweden: "se",
  norway: "no",
  denmark: "dk",
  finland: "fi",
  ireland: "ie",
  iceland: "is",
  "united kingdom": "gb",
  uk: "gb",
  britain: "gb",
  england: "gb",
  scotland: "gb",
  wales: "gb",
  "united states": "us",
  "united states of america": "us",
  usa: "us",
  america: "us",
  canada: "ca",
  australia: "au",
  "new zealand": "nz",
  russia: "ru",
  ukraine: "ua",
  turkey: "tr",
  "saudi arabia": "sa",
  uae: "ae",
  "united arab emirates": "ae",
  egypt: "eg",
  israel: "il",
  iran: "ir",
  iraq: "iq",
  "south africa": "za",
  nigeria: "ng",
  kenya: "ke",
  morocco: "ma",
  ethiopia: "et",
};

/** Map a free-form country name (e.g., "China") to ISO-2 ("cn"). */
export const countryToCode = (
  country?: string | null,
): string | null => {
  if (!country) return null;
  const key = country.trim().toLowerCase();
  if (!key) return null;
  // Allow callers to pass an ISO-2 code directly.
  if (key.length === 2 && /^[a-z]{2}$/.test(key)) return key;
  return COUNTRY_NAME_TO_CODE[key] || null;
};

/** Round flag SVG URL for an ISO-2 country code. */
export const countryFlagUrl = (code?: string | null): string =>
  `https://hatscripts.github.io/circle-flags/flags/${(code || "xx").toLowerCase()}.svg`;
