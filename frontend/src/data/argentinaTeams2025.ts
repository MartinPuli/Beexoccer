export type Kit = {
  primary: string;
  secondary: string;
};

export type Team = {
  id: string;
  name: string;
  shortName: string;
  home: Kit;
  away: Kit;
};

export const ARGENTINA_TEAMS_2025: Team[] = [
  {
    id: "aldosivi",
    name: "Aldosivi",
    shortName: "Aldosivi",
    home: { primary: "#ffd100", secondary: "#00843d" },
    away: { primary: "#ffffff", secondary: "#00843d" },
  },
  {
    id: "atletico-tucuman",
    name: "Atlético Tucumán",
    shortName: "Atlético",
    home: { primary: "#1e5aa8", secondary: "#ffffff" },
    away: { primary: "#ffffff", secondary: "#1e5aa8" },
  },
  {
    id: "belgrano",
    name: "Belgrano",
    shortName: "Belgrano",
    home: { primary: "#4aa6ff", secondary: "#0b2d59" },
    away: { primary: "#ffffff", secondary: "#4aa6ff" },
  },
  {
    id: "central-cordoba-sde",
    name: "Central Córdoba (SdE)",
    shortName: "C. Córdoba",
    home: { primary: "#000000", secondary: "#ffffff" },
    away: { primary: "#ffffff", secondary: "#000000" },
  },
  {
    id: "estudiantes-lp",
    name: "Estudiantes (LP)",
    shortName: "Estudiantes",
    home: { primary: "#d6001c", secondary: "#ffffff" },
    away: { primary: "#ffffff", secondary: "#d6001c" },
  },
  {
    id: "gimnasia-lp",
    name: "Gimnasia y Esgrima (LP)",
    shortName: "Gimnasia",
    home: { primary: "#0b2d59", secondary: "#ffffff" },
    away: { primary: "#ffffff", secondary: "#0b2d59" },
  },
  {
    id: "godoy-cruz",
    name: "Godoy Cruz",
    shortName: "Godoy Cruz",
    home: { primary: "#1e5aa8", secondary: "#ffffff" },
    away: { primary: "#ffffff", secondary: "#1e5aa8" },
  },
  {
    id: "independiente-rivadavia",
    name: "Independiente Rivadavia",
    shortName: "Ind. Rivadavia",
    home: { primary: "#1e5aa8", secondary: "#ffffff" },
    away: { primary: "#ffffff", secondary: "#1e5aa8" },
  },
  {
    id: "instituto",
    name: "Instituto",
    shortName: "Instituto",
    home: { primary: "#d6001c", secondary: "#ffffff" },
    away: { primary: "#ffffff", secondary: "#d6001c" },
  },
  {
    id: "newells",
    name: "Newell's Old Boys",
    shortName: "Newell's",
    home: { primary: "#000000", secondary: "#d6001c" },
    away: { primary: "#ffffff", secondary: "#d6001c" },
  },
  {
    id: "rosario-central",
    name: "Rosario Central",
    shortName: "Central",
    home: { primary: "#f6c800", secondary: "#1e5aa8" },
    away: { primary: "#1e5aa8", secondary: "#f6c800" },
  },
  {
    id: "san-martin-sj",
    name: "San Martín (SJ)",
    shortName: "San Martín",
    home: { primary: "#0b2d59", secondary: "#000000" },
    away: { primary: "#ffffff", secondary: "#0b2d59" },
  },
  {
    id: "sarmiento-junin",
    name: "Sarmiento (J)",
    shortName: "Sarmiento",
    home: { primary: "#00843d", secondary: "#ffffff" },
    away: { primary: "#ffffff", secondary: "#00843d" },
  },
  {
    id: "talleres",
    name: "Talleres (C)",
    shortName: "Talleres",
    home: { primary: "#1e5aa8", secondary: "#ffffff" },
    away: { primary: "#ffffff", secondary: "#1e5aa8" },
  },
  {
    id: "union",
    name: "Unión",
    shortName: "Unión",
    home: { primary: "#d6001c", secondary: "#ffffff" },
    away: { primary: "#ffffff", secondary: "#d6001c" },
  },
  {
    id: "argentinos",
    name: "Argentinos Juniors",
    shortName: "Argentinos",
    home: { primary: "#d6001c", secondary: "#ffffff" },
    away: { primary: "#ffffff", secondary: "#d6001c" },
  },
  {
    id: "banfield",
    name: "Banfield",
    shortName: "Banfield",
    home: { primary: "#00843d", secondary: "#ffffff" },
    away: { primary: "#ffffff", secondary: "#00843d" },
  },
  {
    id: "barracas-central",
    name: "Barracas Central",
    shortName: "Barracas",
    home: { primary: "#d6001c", secondary: "#ffffff" },
    away: { primary: "#ffffff", secondary: "#d6001c" },
  },
  {
    id: "boca",
    name: "Boca Juniors",
    shortName: "Boca",
    home: { primary: "#0b2d59", secondary: "#f6c800" },
    away: { primary: "#f6c800", secondary: "#0b2d59" },
  },
  {
    id: "defensa-y-justicia",
    name: "Defensa y Justicia",
    shortName: "Defensa",
    home: { primary: "#00843d", secondary: "#f6c800" },
    away: { primary: "#ffffff", secondary: "#00843d" },
  },
  {
    id: "deportivo-riestra",
    name: "Deportivo Riestra",
    shortName: "Riestra",
    home: { primary: "#000000", secondary: "#ffffff" },
    away: { primary: "#ffffff", secondary: "#000000" },
  },
  {
    id: "huracan",
    name: "Huracán",
    shortName: "Huracán",
    home: { primary: "#ffffff", secondary: "#d6001c" },
    away: { primary: "#d6001c", secondary: "#ffffff" },
  },
  {
    id: "independiente",
    name: "Independiente",
    shortName: "Independiente",
    home: { primary: "#d6001c", secondary: "#ffffff" },
    away: { primary: "#ffffff", secondary: "#d6001c" },
  },
  {
    id: "lanus",
    name: "Lanús",
    shortName: "Lanús",
    home: { primary: "#6a0f2d", secondary: "#ffffff" },
    away: { primary: "#ffffff", secondary: "#6a0f2d" },
  },
  {
    id: "platense",
    name: "Platense",
    shortName: "Platense",
    home: { primary: "#6a0f2d", secondary: "#ffffff" },
    away: { primary: "#ffffff", secondary: "#6a0f2d" },
  },
  {
    id: "racing",
    name: "Racing",
    shortName: "Racing",
    home: { primary: "#4aa6ff", secondary: "#ffffff" },
    away: { primary: "#ffffff", secondary: "#4aa6ff" },
  },
  {
    id: "river",
    name: "River Plate",
    shortName: "River",
    home: { primary: "#ffffff", secondary: "#d6001c" },
    away: { primary: "#d6001c", secondary: "#ffffff" },
  },
  {
    id: "san-lorenzo",
    name: "San Lorenzo",
    shortName: "San Lorenzo",
    home: { primary: "#0b2d59", secondary: "#d6001c" },
    away: { primary: "#d6001c", secondary: "#0b2d59" },
  },
  {
    id: "tigre",
    name: "Tigre",
    shortName: "Tigre",
    home: { primary: "#1e5aa8", secondary: "#d6001c" },
    away: { primary: "#ffffff", secondary: "#1e5aa8" },
  },
  {
    id: "velez",
    name: "Vélez Sarsfield",
    shortName: "Vélez",
    home: { primary: "#ffffff", secondary: "#0b2d59" },
    away: { primary: "#0b2d59", secondary: "#ffffff" },
  },
];

export function getArgentinaTeam2025(teamId?: string) {
  if (!teamId) return undefined;
  return ARGENTINA_TEAMS_2025.find((t) => t.id === teamId);
}
