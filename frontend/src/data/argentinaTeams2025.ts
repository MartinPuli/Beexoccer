export type Kit = {
  primary: string;
  secondary: string;
};

export type Team = {
  id: string;
  name: string;
  shortName: string;
  badge: string;
  home: Kit;
  away: Kit;
};

export function makeTeamBadgeUrl(params: {
  teamId?: string;
  fill: string;
  stroke?: string;
}): string | undefined {
  const team = getArgentinaTeam2025(params.teamId);
  if (!team) return undefined;

  const text = team.badge;
  const fill = params.fill;
  const stroke = params.stroke || "#ffffff";

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <defs>
    <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.35"/>
    </filter>
    <filter id="glow" x="-80%" y="-80%" width="260%" height="260%">
      <feDropShadow dx="0" dy="0" stdDeviation="1.5" flood-color="#00ff6a" flood-opacity="0.22"/>
      <feDropShadow dx="0" dy="0" stdDeviation="4" flood-color="#00ff6a" flood-opacity="0.10"/>
    </filter>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.18"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0.10"/>
    </linearGradient>
    <linearGradient id="metal" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.65"/>
      <stop offset="0.35" stop-color="#ffffff" stop-opacity="0.15"/>
      <stop offset="0.65" stop-color="#000000" stop-opacity="0.18"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0.35"/>
    </linearGradient>
  </defs>
  <g filter="url(#shadow)">
    <path d="M32 6 C44 6 52 10 52 10 L52 28 C52 42 43 53 32 58 C21 53 12 42 12 28 L12 10 C12 10 20 6 32 6 Z" fill="${fill}"/>
    <path d="M32 6 C44 6 52 10 52 10 L52 28 C52 42 43 53 32 58 C21 53 12 42 12 28 L12 10 C12 10 20 6 32 6 Z" fill="none" stroke="${stroke}" stroke-width="4"/>
    <path d="M32 6 C44 6 52 10 52 10 L52 28 C52 42 43 53 32 58 C21 53 12 42 12 28 L12 10 C12 10 20 6 32 6 Z" fill="url(#metal)" opacity="0.55"/>
    <path d="M14 12 C18 10 24 8 32 8 C40 8 46 10 50 12 L50 28 C50 41 42 51 32 55 C22 51 14 41 14 28 Z" fill="url(#g)"/>
    <path d="M16 13 C20 11 25 10 32 10 C39 10 44 11 48 13 L48 28 C48 40 41 49 32 53 C23 49 16 40 16 28 Z" fill="none" stroke="#ffffff" stroke-opacity="0.18" stroke-width="2"/>
    <text x="32" y="38" text-anchor="middle" font-family="Chakra Petch, system-ui, -apple-system, Segoe UI, Roboto, Arial" font-size="18" font-weight="900" fill="#fff" stroke="#000" stroke-width="1" paint-order="stroke" filter="url(#glow)">${text}</text>
  </g>
</svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const ARGENTINA_TEAMS_2025: Team[] = [
  {
    id: "aldosivi",
    name: "Aldosivi",
    shortName: "Aldosivi",
    badge: "CAA",
    home: { primary: "#ffd100", secondary: "#00843d" },
    away: { primary: "#ffffff", secondary: "#00843d" },
  },
  {
    id: "atletico-tucuman",
    name: "Atlético Tucumán",
    shortName: "Atlético",
    badge: "CAT",
    home: { primary: "#1e5aa8", secondary: "#ffffff" },
    away: { primary: "#ffffff", secondary: "#1e5aa8" },
  },
  {
    id: "belgrano",
    name: "Belgrano",
    shortName: "Belgrano",
    badge: "CAB",
    home: { primary: "#4aa6ff", secondary: "#0b2d59" },
    away: { primary: "#ffffff", secondary: "#4aa6ff" },
  },
  {
    id: "central-cordoba-sde",
    name: "Central Córdoba (SdE)",
    shortName: "C. Córdoba",
    badge: "CC",
    home: { primary: "#000000", secondary: "#ffffff" },
    away: { primary: "#ffffff", secondary: "#000000" },
  },
  {
    id: "estudiantes-lp",
    name: "Estudiantes (LP)",
    shortName: "Estudiantes",
    badge: "EDEL",
    home: { primary: "#d6001c", secondary: "#ffffff" },
    away: { primary: "#ffffff", secondary: "#d6001c" },
  },
  {
    id: "gimnasia-lp",
    name: "Gimnasia y Esgrima (LP)",
    shortName: "Gimnasia",
    badge: "GELP",
    home: { primary: "#0b2d59", secondary: "#ffffff" },
    away: { primary: "#ffffff", secondary: "#0b2d59" },
  },
  {
    id: "godoy-cruz",
    name: "Godoy Cruz",
    shortName: "Godoy Cruz",
    badge: "GCAT",
    home: { primary: "#1e5aa8", secondary: "#ffffff" },
    away: { primary: "#ffffff", secondary: "#1e5aa8" },
  },
  {
    id: "independiente-rivadavia",
    name: "Independiente Rivadavia",
    shortName: "Ind. Rivadavia",
    badge: "CSIR",
    home: { primary: "#1e5aa8", secondary: "#ffffff" },
    away: { primary: "#ffffff", secondary: "#1e5aa8" },
  },
  {
    id: "instituto",
    name: "Instituto",
    shortName: "Instituto",
    badge: "IACC",
    home: { primary: "#d6001c", secondary: "#ffffff" },
    away: { primary: "#ffffff", secondary: "#d6001c" },
  },
  {
    id: "newells",
    name: "Newell's Old Boys",
    shortName: "Newell's",
    badge: "NOB",
    home: { primary: "#000000", secondary: "#d6001c" },
    away: { primary: "#ffffff", secondary: "#d6001c" },
  },
  {
    id: "rosario-central",
    name: "Rosario Central",
    shortName: "Central",
    badge: "CARC",
    home: { primary: "#f6c800", secondary: "#1e5aa8" },
    away: { primary: "#1e5aa8", secondary: "#f6c800" },
  },
  {
    id: "san-martin-sj",
    name: "San Martín (SJ)",
    shortName: "San Martín",
    badge: "CASM",
    home: { primary: "#0b2d59", secondary: "#000000" },
    away: { primary: "#ffffff", secondary: "#0b2d59" },
  },
  {
    id: "sarmiento-junin",
    name: "Sarmiento (J)",
    shortName: "Sarmiento",
    badge: "CASJ",
    home: { primary: "#00843d", secondary: "#ffffff" },
    away: { primary: "#ffffff", secondary: "#00843d" },
  },
  {
    id: "talleres",
    name: "Talleres (C)",
    shortName: "Talleres",
    badge: "CATC",
    home: { primary: "#1e5aa8", secondary: "#ffffff" },
    away: { primary: "#ffffff", secondary: "#1e5aa8" },
  },
  {
    id: "union",
    name: "Unión",
    shortName: "Unión",
    badge: "CAU",
    home: { primary: "#d6001c", secondary: "#ffffff" },
    away: { primary: "#ffffff", secondary: "#d6001c" },
  },
  {
    id: "argentinos",
    name: "Argentinos Juniors",
    shortName: "Argentinos",
    badge: "CAAJ",
    home: { primary: "#d6001c", secondary: "#ffffff" },
    away: { primary: "#ffffff", secondary: "#d6001c" },
  },
  {
    id: "banfield",
    name: "Banfield",
    shortName: "Banfield",
    badge: "CAB",
    home: { primary: "#00843d", secondary: "#ffffff" },
    away: { primary: "#ffffff", secondary: "#00843d" },
  },
  {
    id: "barracas-central",
    name: "Barracas Central",
    shortName: "Barracas",
    badge: "CBC",
    home: { primary: "#d6001c", secondary: "#ffffff" },
    away: { primary: "#ffffff", secondary: "#d6001c" },
  },
  {
    id: "boca",
    name: "Boca Juniors",
    shortName: "Boca",
    badge: "CABJ",
    home: { primary: "#0b2d59", secondary: "#f6c800" },
    away: { primary: "#f6c800", secondary: "#0b2d59" },
  },
  {
    id: "defensa-y-justicia",
    name: "Defensa y Justicia",
    shortName: "Defensa",
    badge: "CDYJ",
    home: { primary: "#00843d", secondary: "#f6c800" },
    away: { primary: "#ffffff", secondary: "#00843d" },
  },
  {
    id: "deportivo-riestra",
    name: "Deportivo Riestra",
    shortName: "Riestra",
    badge: "DR",
    home: { primary: "#000000", secondary: "#ffffff" },
    away: { primary: "#ffffff", secondary: "#000000" },
  },
  {
    id: "huracan",
    name: "Huracán",
    shortName: "Huracán",
    badge: "CAH",
    home: { primary: "#ffffff", secondary: "#d6001c" },
    away: { primary: "#d6001c", secondary: "#ffffff" },
  },
  {
    id: "independiente",
    name: "Independiente",
    shortName: "Independiente",
    badge: "CAI",
    home: { primary: "#d6001c", secondary: "#ffffff" },
    away: { primary: "#ffffff", secondary: "#d6001c" },
  },
  {
    id: "lanus",
    name: "Lanús",
    shortName: "Lanús",
    badge: "CAL",
    home: { primary: "#6a0f2d", secondary: "#ffffff" },
    away: { primary: "#ffffff", secondary: "#6a0f2d" },
  },
  {
    id: "platense",
    name: "Platense",
    shortName: "Platense",
    badge: "CAP",
    home: { primary: "#6a0f2d", secondary: "#ffffff" },
    away: { primary: "#ffffff", secondary: "#6a0f2d" },
  },
  {
    id: "racing",
    name: "Racing",
    shortName: "Racing",
    badge: "RAC",
    home: { primary: "#4aa6ff", secondary: "#ffffff" },
    away: { primary: "#ffffff", secondary: "#4aa6ff" },
  },
  {
    id: "river",
    name: "River Plate",
    shortName: "River",
    badge: "CARP",
    home: { primary: "#ffffff", secondary: "#d6001c" },
    away: { primary: "#d6001c", secondary: "#ffffff" },
  },
  {
    id: "san-lorenzo",
    name: "San Lorenzo",
    shortName: "San Lorenzo",
    badge: "CASLA",
    home: { primary: "#0b2d59", secondary: "#d6001c" },
    away: { primary: "#d6001c", secondary: "#0b2d59" },
  },
  {
    id: "tigre",
    name: "Tigre",
    shortName: "Tigre",
    badge: "CATI",
    home: { primary: "#1e5aa8", secondary: "#d6001c" },
    away: { primary: "#ffffff", secondary: "#1e5aa8" },
  },
  {
    id: "velez",
    name: "Vélez Sarsfield",
    shortName: "Vélez",
    badge: "CVS",
    home: { primary: "#ffffff", secondary: "#0b2d59" },
    away: { primary: "#0b2d59", secondary: "#ffffff" },
  },
];

export function getArgentinaTeam2025(teamId?: string) {
  if (!teamId) return undefined;
  return ARGENTINA_TEAMS_2025.find((t) => t.id === teamId);
}
