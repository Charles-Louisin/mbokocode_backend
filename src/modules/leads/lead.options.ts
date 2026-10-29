// Valeurs fermées du formulaire de qualification. Les libellés sont repris côté site
// (src/lib/lead-options.ts) : garder les deux listes alignées.

export const SERVICE_TYPES = {
  site: "Site vitrine",
  ecommerce: "E-commerce",
  application: "Application web / mobile",
  plateforme: "Plateforme / SaaS",
  automatisation: "Automatisation",
  maintenance: "Refonte / maintenance",
  conseil: "Conseil",
  autre: "Autre",
} as const;

export const FEATURES = {
  admin: "Espace d'administration",
  comptes: "Comptes utilisateurs",
  paiement: "Paiement en ligne",
  whatsapp: "Commande ou contact WhatsApp",
  reservation: "Prise de rendez-vous",
  dashboard: "Tableau de bord / statistiques",
  contenus: "Blog / contenus",
  multilingue: "Plusieurs langues",
  mobile: "Application mobile",
  integrations: "Intégrations (API, outils)",
} as const;

export const BUDGETS = {
  "a-definir": "À définir ensemble",
  "moins-500": "Moins de 500 €",
  "500-1000": "500 – 1 000 €",
  "1000-2000": "1 000 – 2 000 €",
  "2000-5000": "2 000 – 5 000 €",
  "plus-5000": "Plus de 5 000 €",
} as const;

export const DEADLINES = {
  urgent: "Dès que possible",
  "1-mois": "D'ici un mois",
  "1-3-mois": "D'ici 1 à 3 mois",
  "plus-3-mois": "Dans plus de 3 mois",
  flexible: "Pas de date imposée",
} as const;

export const LEAD_STATUSES = ["new", "reviewing", "qualified", "meeting_scheduled", "proposal_sent", "won", "lost", "archived"] as const;

export const CONSENT_VERSION = "2026-10";

type Keys<T> = [keyof T & string, ...(keyof T & string)[]];
export const keysOf = <T extends object>(record: T) => Object.keys(record) as Keys<T>;
