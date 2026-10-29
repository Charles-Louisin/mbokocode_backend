import type { PricingPackageData } from "../modules/pricing/pricing.model.js";
import type { ProjectData } from "../modules/projects/project.model.js";
import type { SiteSettingsData } from "../modules/settings/settings.model.js";

// Contenu initial validé par le propriétaire (octobre 2026).
// Règle : aucun chiffre, client ou résultat non confirmé. Les indicateurs listés dans `metrics`
// ont été validés explicitement ; tout le reste est éditable ensuite depuis l'admin.

type SeedProject = Omit<
  Partial<ProjectData>,
  "createdAt" | "updatedAt" | "publishedAt" | "coverImage" | "gallery" | "metrics"
> &
  Pick<ProjectData, "title" | "slug" | "shortDescription" | "category" | "status"> & {
    coverImage?: { url: string; alt: string; width: number; height: number };
    gallery?: { url: string; alt: string; width: number; height: number }[];
    metrics?: { label: string; value: string }[];
  };

const img = (file: string, alt: string, width: number, height: number) => ({
  url: `/images/projects/${file}`,
  alt,
  width,
  height,
});

export const seedProjects: SeedProject[] = [
  {
    title: "KOUMALE",
    slug: "koumale",
    kicker: "Marketplace multi-vendeurs",
    category: "platform",
    status: "deployed",
    visibility: "public",
    isFeatured: true,
    licenseAvailable: true,
    sortOrder: 1,
    shortDescription:
      "Une marketplace pensée pour le mobile, où l'acheteur finalise sa commande directement sur le WhatsApp du vendeur.",
    challenge:
      "Digitaliser les commerçants locaux tout en respectant les habitudes des acheteurs, pour qui les systèmes de paiement en ligne traditionnels représentent souvent un obstacle.",
    solution:
      "J'ai conçu et déployé une marketplace sur mesure, rapide sur mobile. L'acheteur parcourt le catalogue puis finalise sa commande dans la conversation WhatsApp privée du vendeur, sans module de paiement en ligne à configurer.",
    features: [
      "Catalogue multi-vendeurs optimisé pour le mobile",
      "Tunnel de commande vers le WhatsApp du vendeur",
      "Aucun module de paiement en ligne requis",
    ],
    results: "Un parcours d'achat direct qui s'appuie sur un canal que vendeurs et acheteurs utilisent déjà.",
    metrics: [
      { label: "Vendeurs sur la plateforme", value: "50+" },
      { label: "Délai de mise en ligne", value: "2–4 jours" },
    ],
    technologies: ["Next.js", "TypeScript", "API REST", "WhatsApp deep links"],
    liveUrl: "https://koumale.com/",
    coverImage: img("koumale-mobile.webp", "Interface mobile de la marketplace KOUMALE", 299, 599),
  },
  {
    title: "HEVECAM",
    slug: "hevecam",
    kicker: "SaaS de gestion hospitalière",
    category: "platform",
    status: "in_progress",
    visibility: "public",
    isFeatured: true,
    sortOrder: 2,
    shortDescription:
      "Un système de gestion qui centralise les opérations médicales et administratives d'un réseau de santé réparti sur plusieurs sites.",
    challenge:
      "Unifier et moderniser la gestion sanitaire d'un réseau médical étendu, en remplaçant les processus manuels par une infrastructure centralisée.",
    solution:
      "J'architecture et je développe un système de gestion complet, pensé pour être robuste et sécurisé, qui synchronise les opérations médicales et administratives entre plusieurs sites physiques.",
    features: ["Infrastructure multi-sites", "Authentification et rôles", "Synchronisation en temps réel"],
    technologies: ["Next.js", "Node.js", "PostgreSQL", "Auth & rôles", "Temps réel"],
    coverImage: img("hevecam-dashboard.webp", "Tableau de bord du SaaS HEVECAM", 1600, 697),
  },
  {
    title: "MES POCHES",
    slug: "mes-poches",
    kicker: "Application de finances personnelles",
    category: "web",
    status: "deployed",
    visibility: "public",
    isFeatured: true,
    sortOrder: 3,
    shortDescription:
      "Une application de suivi des finances du quotidien, épurée à l'essentiel, disponible sur le web et en APK.",
    challenge:
      "Transformer le suivi des finances quotidiennes en une expérience intuitive et instantanée, sans friction.",
    solution:
      "J'ai conçu une application web fluide, réduite à l'essentiel et déployée sur une infrastructure cloud managée, accompagnée d'une version APK.",
    features: ["Application web et APK", "Vue du solde et des transactions", "Hébergement cloud managé"],
    metrics: [{ label: "Utilisateurs actifs", value: "20+" }],
    technologies: ["Next.js", "TypeScript", "Cloud managé", "APK"],
    coverImage: img("mes-poches-phone-1.webp", "MES POCHES — écran du solde et aperçu financier", 800, 1785),
    // Page de téléchargement publique, indiquée dans la bio TikTok de Charles.
    liveUrl: "https://www.mespoches.store/",
    gallery: [
      img("mes-poches-phone-1.webp", "MES POCHES — écran du solde et aperçu financier", 800, 1785),
      img("mes-poches-phone-2.webp", "MES POCHES — liste des transactions", 800, 1785),
    ],
  },
  {
    title: "Monde Délice",
    slug: "monde-delice",
    kicker: "Vitrine d'une pâtisserie événementielle",
    category: "web",
    status: "deployed",
    visibility: "public",
    isFeatured: true,
    sortOrder: 4,
    shortDescription:
      "La vitrine d'une pâtisserie événementielle, avec un back-office pour publier gâteaux, événements et articles en autonomie.",
    challenge:
      "Passer d'un commerce physique à une présence en ligne digne des créations : image soignée, contenus à jour, prise de contact simple.",
    solution:
      "Une plateforme Next.js reliée à une API et à MongoDB : vitrine publique, réalisations, services filtrables et back-office pour publier sans passer par un développeur.",
    features: [
      "Vitrine artisanale présentée comme une boutique",
      "Administration sécurisée des contenus",
      "Contact multicanal : WhatsApp, e-mail, Telegram",
    ],
    technologies: ["Next.js", "TypeScript", "Express", "MongoDB", "Framer Motion"],
    liveUrl: "https://monde-delice.vercel.app/",
    coverImage: img("md1.png", "Monde Délice — page d'accueil de la vitrine", 1920, 810),
    gallery: [
      img("md1.png", "Monde Délice — page d'accueil de la vitrine", 1920, 810),
      img("md2.png", "Monde Délice — catalogue de services sur mobile", 307, 583),
      img("md3.png", "Monde Délice — galerie des réalisations sur mobile", 306, 589),
    ],
  },
  {
    title: "CASHGLASS",
    slug: "cashglass",
    kicker: "Site de réservation à Strasbourg",
    category: "web",
    status: "deployed",
    visibility: "public",
    sortOrder: 5,
    shortDescription:
      "La refonte du site d'un poseur de pare-brise à domicile, reconstruite autour d'une promesse claire et d'une réservation immédiate.",
    context:
      "Un artisan poseur de pare-brise en France : son ancien site n'était ni attractif ni orienté conversion, et les visiteurs repartaient sans réserver.",
    challenge:
      "Passer d'une vitrine quelconque à un outil qui pousse à la réservation : message, structure, preuves et appel à l'action.",
    solution:
      "Une landing orientée conversion : promesse forte, vérification d'assurance, services clairs, FAQ et tunnel de réservation en quelques clics.",
    features: [
      "Réservation en ligne ou par appel",
      "Choix du service : réparation, remplacement, calandre",
      "Parcours client en quatre étapes",
    ],
    technologies: ["Next.js", "TypeScript", "Tailwind CSS", "Vercel"],
    liveUrl: "https://cashglass.vercel.app/",
    coverImage: img("cashglass.png", "Page d'accueil du site CASHGLASS", 1911, 835),
  },
  {
    title: "BibleVerse",
    slug: "bibleverse",
    kicker: "Application de lecture",
    category: "web",
    status: "deployed",
    visibility: "public",
    sortOrder: 6,
    shortDescription:
      "Un espace de lecture de la Bible pensé pour rester concentré : surlignage, plein écran, taille du texte et audio.",
    challenge:
      "Lire la Bible sur le web sans interface qui distrait : il fallait un outil calme, lisible et utilisable longtemps.",
    solution:
      "Une application React avec navigation par livres et chapitres, recherche, audio, thèmes, surlignage et plein écran, branchée sur API.Bible via un proxy Express.",
    features: ["Lecture immersive en plein écran", "Surlignage des passages", "Audio et thèmes clair / sombre"],
    technologies: ["React", "TypeScript", "Tailwind CSS", "Express", "API.Bible"],
    liveUrl: "https://bibleverse-nine.vercel.app/",
    coverImage: img("bbv2.png", "Interface de lecture de BibleVerse", 948, 826),
  },
  {
    // Synthèse fournie par le propriétaire (octobre 2026). Paiements locaux et suivi de livraison
    // sont prévus ou en cours d'intégration : ils restent dans `futureImprovements`, pas dans `features`.
    // Visuels à fournir.
    title: "FRIPCASH",
    slug: "fripcash",
    kicker: "Marketplace mobile en Guinée",
    category: "mobile",
    status: "in_progress",
    visibility: "public",
    sortOrder: 7,
    shortDescription:
      "Une marketplace mobile multi-profils pour le marché guinéen : vendeurs, acheteurs et livreurs réunis sur une même application.",
    context:
      "En Guinée, particuliers, boutiques, commerçants et grandes enseignes vendent chacun de leur côté. FripCash veut les réunir sur une seule plateforme, avec des outils adaptés à chaque profil.",
    challenge:
      "Plusieurs profils d'utilisateurs aux besoins différents, des commandes à traiter rapidement, des moyens de paiement locaux à intégrer et des livraisons à suivre, sur une application mobile reliée à son API.",
    solution:
      "Une application React Native (Expo) et une API Express / MongoDB séparées. L'architecture est multi-profils, avec un tableau de bord adapté à chaque rôle et des permissions contrôlées côté serveur. Les vendeurs reçoivent une notification push à chaque commande et l'ouvrent directement depuis la notification.",
    features: [
      "Authentification et gestion de plusieurs profils",
      "Tableaux de bord adaptés à chaque rôle, permissions côté backend",
      "Catalogue et gestion des produits côté vendeur",
      "Passage et gestion des commandes",
      "Notification push à chaque nouvelle commande, ouverte en un geste",
      "Interface d'administration de la plateforme",
    ],
    decisions: [
      "Application mobile et API séparées, pour faire évoluer chacune indépendamment",
      "Permissions vérifiées par l'API, pas seulement masquées dans l'interface",
    ],
    futureImprovements:
      "En cours d'intégration : paiements locaux via CinetPay (Orange Money, Mobile Money, carte), suivi de livraison géolocalisé avec itinéraire du livreur et progression visible par le client, puis publication sur les stores.",
    technologies: ["React Native", "Expo", "Node.js", "Express", "TypeScript", "MongoDB", "CinetPay", "Railway"],
  },
];

const euros = (amount: number) => amount * 100;

type SeedPricing = Omit<Partial<PricingPackageData>, "createdAt" | "updatedAt"> &
  Pick<PricingPackageData, "name" | "slug" | "description" | "priceType">;

export const seedPricing: SeedPricing[] = [
  {
    name: "One-page / Landing page",
    slug: "landing-page",
    kicker: "Conversion",
    serviceType: "site",
    description: "Une page unique pensée pour convertir : message clair, parcours fluide, impact immédiat.",
    priceType: "from",
    priceMin: euros(500),
    features: ["4 à 7 sections", "Conception orientée conversion", "Site responsive", "Structure optimisée pour le SEO", "Google Analytics"],
    deliveryEstimate: "1 à 2 semaines",
    sortOrder: 1,
  },
  {
    name: "Site vitrine pro",
    slug: "site-vitrine",
    kicker: "Présence digitale",
    serviceType: "site",
    description: "Une vitrine multi-pages pour présenter ton activité avec une expérience soignée.",
    priceType: "from",
    priceMin: euros(1000),
    features: ["5 pages", "UI/UX sur mesure", "Formulaire de contact", "Tableau de bord admin", "Formation à l'autonomie"],
    deliveryEstimate: "4 à 8 semaines",
    sortOrder: 2,
  },
  {
    name: "E-commerce",
    slug: "e-commerce",
    kicker: "Vente en ligne",
    serviceType: "ecommerce",
    description: "Une boutique complète, prête à vendre, avec catalogue, panier et moyens de paiement.",
    priceType: "from",
    priceMin: euros(2000),
    features: ["5 pages + commande et panier", "50 fiches produits remplies", "Dashboard admin et statistiques", "Intégration des moyens de paiement"],
    deliveryEstimate: "8 à 16 semaines",
    sortOrder: 3,
  },
  {
    name: "Refonte de site",
    slug: "refonte",
    kicker: "Modernisation",
    serviceType: "maintenance",
    description: "Reprendre un site existant : design, structure, performance et parcours, pour qu'il convertisse enfin.",
    priceType: "from",
    priceMin: euros(500),
    features: ["Audit de l'existant", "Nouveau design et structure", "Migration des contenus", "Optimisation SEO et performance"],
    deliveryEstimate: "1 à 2 semaines",
    sortOrder: 4,
  },
  {
    name: "Rédaction web",
    slug: "redaction-web",
    kicker: "Contenu",
    serviceType: "conseil",
    description: "Des textes clairs et convaincants pour donner de la voix à ton site.",
    priceType: "from",
    priceMin: euros(200),
    features: ["Rédaction des textes", "Réécriture de contenu existant", "Mise à jour de blog"],
    sortOrder: 5,
  },
  {
    name: "Développement sur mesure",
    slug: "sur-mesure",
    kicker: "Sur devis",
    serviceType: "plateforme",
    description: "Plateformes complexes, applications métiers et SaaS construits autour de tes processus.",
    priceType: "quote",
    features: ["Architecture adaptée à tes flux", "Applications métiers / SaaS", "Intégrations et automatisations", "Contrôle qualité et déploiement"],
    sortOrder: 6,
  },
  {
    name: "Licences logicielles",
    slug: "licences",
    kicker: "Sur devis",
    serviceType: "licence",
    description: "Exploiter une architecture existante, comme la marketplace KOUMALE, adaptée à ton marché.",
    priceType: "quote",
    features: ["Architecture prête à déployer", "Adaptation à ton marché", "Documentation et transfert"],
    sortOrder: 7,
  },
];

export const seedSettings: Omit<Partial<SiteSettingsData>, "createdAt" | "updatedAt" | "key" | "socials"> & { socials: { label: string; url: string }[] } &
  Pick<SiteSettingsData, "publicName" | "ownerName"> = {
  publicName: "MBOKO CODE",
  ownerName: "Charles Louisin Yimbne",
  role: "Développeur full-stack",
  tagline:
    "Je transforme les idées ambitieuses en produits numériques utiles : applications web, mobiles et plateformes sur mesure, de la réflexion à la mise en production.",
  location: "Douala, Cameroun",
  email: "clynlouisin@gmail.com",
  whatsappNumber: "237693460259",
  socials: [
    { label: "GitHub", url: "https://github.com/Charles-Louisin" },
    { label: "LinkedIn", url: "https://www.linkedin.com/in/charles-louisin-yimbne-88a028270" },
  ],
  // À confirmer depuis l'admin : la disponibilité n'est affichée que si elle est tenue à jour.
  availability: { isAvailable: false },
  currency: "EUR",
  seo: {
    title: "MBOKO CODE — Charles, développeur full-stack",
    description: "Applications web, mobiles et plateformes sur mesure, de l'idée à la mise en production.",
  },
};

// Savoir-faire publiés sur l'accueil et /services. `proofs` : projets qui les prouvent.
export const seedServices = [
  {
    slug: "plateformes",
    name: "Plateformes & SaaS",
    summary: "Des outils métiers qui encaissent la charge : rôles, données synchronisées, plusieurs sites, plusieurs vendeurs.",
    deliverables: ["Architecture et modèle de données", "Authentification et rôles", "Tableaux de bord"],
    proofs: ["hevecam", "koumale"],
    sortOrder: 10,
  },
  {
    slug: "applications",
    name: "Applications web & mobiles",
    summary: "Des applications rapides et épurées, pensées d'abord pour le téléphone, livrées sur le web ou en APK.",
    deliverables: ["Interfaces mobile-first", "Livraison web et APK", "Performance perçue"],
    proofs: ["mes-poches", "bibleverse"],
    sortOrder: 20,
  },
  {
    slug: "sites",
    name: "Sites & e-commerce",
    summary: "Des vitrines qui convertissent et des boutiques que tu administres toi-même, sans dépendre d'un développeur.",
    deliverables: ["Parcours orientés conversion", "Back-office autonome", "SEO technique"],
    proofs: ["cashglass", "monde-delice"],
    sortOrder: 30,
  },
  {
    slug: "evolution",
    name: "Refonte, automatisation & suivi",
    summary: "Reprendre l'existant, brancher les bons outils, automatiser ce qui se répète et faire évoluer le produit après la livraison.",
    deliverables: ["Audit et refonte", "Intégrations et automatisations", "Maintenance et évolutions"],
    proofs: ["cashglass", "koumale"],
    sortOrder: 40,
  },
];

// Contenu éditorial : parcours d'après le CV (public/CV-YIMBNE.pdf), méthode et engagements publiés.
export const seedContent = {
  method: [
    { title: "Découverte", text: "Un premier échange pour comprendre ton activité, tes utilisateurs et ce qui doit changer." },
    { title: "Cadrage", text: "Périmètre, priorités, délai et prix posés noir sur blanc avant d'écrire une ligne de code." },
    { title: "Conception", text: "Parcours et interfaces validés ensemble : tu vois le produit avant qu'il existe." },
    { title: "Développement", text: "Livraisons par étapes, avec un accès pour suivre l'avancement à tout moment." },
    { title: "Validation", text: "Tests, corrections et ajustements jusqu'à ce que le produit tienne ses promesses." },
    { title: "Mise en ligne & suivi", text: "Déploiement, prise en main, puis accompagnement si tu veux faire évoluer le produit." },
  ],
  journey: [
    {
      kind: "venture" as const,
      period: "Aujourd'hui",
      title: "Fondateur & développeur full-stack",
      place: "MBOKO CODE, Douala",
      text: "Conception et développement de plateformes, d'applications et de sites, de la marketplace au SaaS métier.",
    },
    {
      kind: "work" as const,
      period: "Mai — août 2025",
      title: "Développeur stagiaire",
      place: "Common Factor, Douala",
      text: "Un stage qui m'a fait passer par trois postes : frontend, backend et test.",
      points: [
        "Frontend complet de la plateforme de paiement PayUnit à partir d'une maquette Figma, et landing page d'Easybank (React, Next.js, Tailwind CSS, TypeScript).",
        "Contribution à l'API de la passerelle de paiement PayUnit (SDK Node.js), en veillant à la fiabilité et à la sécurité des endpoints.",
        "Tests fonctionnels et exploratoires, correction de bugs et maintenance d'applications internes avec l'équipe backend.",
      ],
    },
    {
      kind: "school" as const,
      period: "2023 — 2025",
      title: "Certificat de Qualification Professionnelle",
      place: "Seven Advanced Academy, Douala",
      text: "Formation au développement web, obtenue avec la mention Excellente.",
    },
    {
      kind: "school" as const,
      period: "2020 — 2021",
      title: "Baccalauréat F3 — Électrotechnique",
      place: "Lycée technique de Nieté",
      text: "Obtenu avec la mention Bien.",
    },
  ],
  skillGroups: [
    { title: "Front-end", skills: ["Next.js", "React", "TypeScript", "Tailwind CSS", "Framer Motion"] },
    { title: "Back-end & données", skills: ["Node.js", "Express", "API REST", "MongoDB", "PostgreSQL", "Auth & rôles"] },
    { title: "Produit & mise en production", skills: ["Figma", "Vercel", "CI/CD", "SEO technique", "Analytics"] },
  ],
  languages: [
    { name: "Français", level: "Avancé" },
    { name: "Anglais", level: "Débutant" },
  ],
  principles: [
    {
      icon: "messages" as const,
      title: "En direct",
      text: "Tu échanges avec la personne qui construit. Tu sais à tout moment où en est le projet, ce qui est livré et pourquoi.",
    },
    {
      icon: "target" as const,
      title: "Utile avant d'être spectaculaire",
      text: "Chaque décision technique sert un objectif concret. Pas de complexité ajoutée pour faire joli.",
    },
    {
      icon: "shield" as const,
      title: "Pensé pour durer",
      text: "Code lisible, documentation et remise des accès : ce qui est livré peut être repris et évoluer.",
    },
  ],
  values: [
    { icon: "code" as const, label: "Qualité du code" },
    { icon: "gauge" as const, label: "Performances" },
    { icon: "handshake" as const, label: "Expérience des utilisateurs" },
  ],
  afterDelivery: [
    { title: "Support inclus", text: "30 jours après la livraison pour les corrections et la prise en main." },
    { title: "Formation", text: "Je te montre comment utiliser et faire évoluer ce qui a été livré." },
    { title: "Code & documentation", text: "Remise du code source (projet sur mesure) et des accès nécessaires." },
    { title: "Accompagnement mensuel", text: "En option, sur devis : petites évolutions, maintenance et un interlocuteur unique après la livraison." },
  ],
  // Lieux vérifiés : base à Douala, CASHGLASS à Strasbourg, FRIPCASH en Guinée.
  places: [
    { lat: 4.05, lng: 9.7, label: "Douala, Cameroun" },
    { lat: 48.58, lng: 7.75, label: "Strasbourg, France" },
    { lat: 9.64, lng: -13.58, label: "Conakry, Guinée" },
  ],
  // TikTok @yncharles2 : chiffres et vues relevés sur le profil public le 29 octobre 2026.
  // Miniatures : couvertures des vidéos, enregistrées dans public/images/tiktok.
  creator: {
    platform: "tiktok" as const,
    handle: "yncharles2",
    profileUrl: "https://www.tiktok.com/@yncharles2",
    bio: "Développeur Full Stack Web & Mobile. Humour dev & création de contenu.",
    recordedAt: "29 octobre 2026",
    stats: [
      { label: "Abonnés", value: "4 964" },
      { label: "J'aime", value: "99,1 K" },
      { label: "Vidéos", value: "76" },
    ],
    videos: [
      { url: "https://www.tiktok.com/@yncharles2/video/7585632750015679766", caption: "Tout le monde perd 🤣", views: "348 K", cover: "/images/tiktok/7585632750015679766.webp" },
      { url: "https://www.tiktok.com/@yncharles2/video/7600461800483589398", caption: "MOI QUOI !!! Je ne perds pas seul…", views: "184,3 K", cover: "/images/tiktok/7600461800483589398.webp" },
      { url: "https://www.tiktok.com/@yncharles2/video/7673139201671515425", caption: "J'ai payé donc tu le fais Claude 😭", views: "155,5 K", cover: "/images/tiktok/7673139201671515425.webp" },
      { url: "https://www.tiktok.com/@yncharles2/video/7584182131631607062", caption: "J'allais ndem 😫… Une autre journée oklm…", views: "74,1 K", cover: "/images/tiktok/7584182131631607062.webp" },
      { url: "https://www.tiktok.com/@yncharles2/video/7647973758090743072", caption: "Quand ça marche on ne touche plus 😂", views: "68,7 K", cover: "/images/tiktok/7647973758090743072.webp" },
      { url: "https://www.tiktok.com/@yncharles2/video/7601208903850052886", caption: "Jamais après. AVANT 🙌🏾", views: "67,6 K", cover: "/images/tiktok/7601208903850052886.webp" },
      { url: "https://www.tiktok.com/@yncharles2/video/7660623263323770145", caption: "Catastrophe 😭", views: "52,6 K", cover: "/images/tiktok/7660623263323770145.webp" },
    ],
  },
  licenceVsCustom: [
    { criterion: "Délai", licence: "Quelques jours à quelques semaines", custom: "Plusieurs semaines à plusieurs mois" },
    { criterion: "Coût de départ", licence: "Souvent plus accessible", custom: "Investissement plus large" },
    { criterion: "Personnalisation", licence: "Adaptation à ton marché", custom: "Construit autour de tes process" },
    { criterion: "Idéal si", licence: "Tu veux démarrer vite sur une base éprouvée", custom: "Tes besoins sont très spécifiques" },
  ],
};
