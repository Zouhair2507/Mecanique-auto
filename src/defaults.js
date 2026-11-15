'use strict';

/**
 * Réglages par défaut du garage.
 * Ils sont copiés dans data/db.json au premier démarrage, puis modifiables
 * depuis l'espace administration (/admin) sans toucher au code.
 *
 * Tous les prix sont exprimés TTC (TVA comprise).
 */

const TICKET_CATEGORIES = [
  { id: 'devis', label: 'Demande de devis' },
  { id: 'rdv', label: 'Question sur un rendez-vous' },
  { id: 'suivi', label: 'Suivi de réparation' },
  { id: 'facture', label: 'Facturation / paiement' },
  { id: 'reclamation', label: 'Réclamation / garantie' },
  { id: 'autre', label: 'Autre question' },
];

const FUEL_TYPES = ['Essence', 'Diesel', 'Hybride', 'Électrique', 'GPL', 'Autre'];

const ICONS = ['oil', 'brake', 'wrench', 'tire', 'snow', 'bolt', 'spring', 'car'];

const defaultSettings = {
  // Informations FICTIVES de démonstration : à remplacer dans /admin > Horaires & infos.
  // (Numéro de téléphone pris dans la plage réservée aux œuvres de fiction par l'ARCEP,
  // SIRET volontairement invalide.)
  garage: {
    name: 'Garage des Tilleuls',
    tagline: 'Mécanique toutes marques · Villeurbanne',
    description:
      'Garage indépendant à Villeurbanne : entretien, réparation et diagnostic pour toutes les marques. Prix affichés, devis gratuit et aucune intervention sans votre accord.',
    address: '18 avenue des Tilleuls',
    postalCode: '69100',
    city: 'Villeurbanne',
    phone: '04 65 71 23 48',
    email: 'contact@garage-des-tilleuls.fr',
    siret: '841 562 397 00027',
    mapUrl: '',
    legalManager: 'Karim Benali, gérant',
    host: 'OVH SAS, 2 rue Kellermann, 59100 Roubaix, France',
  },

  announcement: '',

  vatRate: 20,

  // Taux horaires de main d'œuvre (TTC)
  hourlyRates: [
    {
      id: 'mecanique',
      label: 'Mécanique générale',
      description: 'Entretien, freinage, distribution, embrayage, suspension, échappement.',
      priceTTC: 66,
    },
    {
      id: 'electricite',
      label: 'Électricité & diagnostic',
      description: 'Recherche de panne, électronique embarquée, faisceaux, codage.',
      priceTTC: 78,
    },
    {
      id: 'specialise',
      label: 'Travaux spécialisés',
      description: 'Moteur, boîte de vitesses, interventions lourdes.',
      priceTTC: 84,
    },
  ],

  // Horaires d'ouverture : une ou plusieurs plages par jour, [] = fermé
  openingHours: {
    mon: [{ open: '08:00', close: '12:00' }, { open: '14:00', close: '18:30' }],
    tue: [{ open: '08:00', close: '12:00' }, { open: '14:00', close: '18:30' }],
    wed: [{ open: '08:00', close: '12:00' }, { open: '14:00', close: '18:30' }],
    thu: [{ open: '08:00', close: '12:00' }, { open: '14:00', close: '18:30' }],
    fri: [{ open: '08:00', close: '12:00' }, { open: '14:00', close: '18:30' }],
    sat: [{ open: '08:30', close: '12:30' }],
    sun: [],
  },

  // Paramètres de la prise de rendez-vous
  booking: {
    slotMinutes: 30, // durée d'un créneau de dépôt
    capacityPerSlot: 2, // nombre de véhicules acceptés par créneau
    minNoticeHours: 2, // délai minimum avant un rendez-vous
    maxDaysAhead: 60, // réservation possible jusqu'à N jours à l'avance
    closeOnHolidays: true, // fermé les jours fériés
  },

  // Fermetures exceptionnelles (congés, inventaire...)
  closures: [],

  categories: [
    {
      id: 'entretien',
      name: 'Entretien & révision',
      icon: 'oil',
      services: [
        {
          id: 'vidange',
          name: 'Vidange + filtre à huile',
          description: 'Huile moteur adaptée aux préconisations constructeur et filtre à huile neuf.',
          price: 89,
          priceFrom: true,
          duration: 45,
        },
        {
          id: 'revision',
          name: 'Révision constructeur',
          description: 'Entretien selon le carnet : filtres, niveaux et points de contrôle. Garantie constructeur préservée.',
          price: 169,
          priceFrom: true,
          duration: 120,
        },
        {
          id: 'filtre-air',
          name: 'Remplacement du filtre à air',
          description: 'Pièce et main d’œuvre.',
          price: 29,
          priceFrom: true,
          duration: 15,
        },
        {
          id: 'filtre-habitacle',
          name: 'Remplacement du filtre d’habitacle',
          description: 'Filtre à pollen ou à charbon actif.',
          price: 35,
          priceFrom: true,
          duration: 20,
        },
        {
          id: 'filtre-carburant',
          name: 'Remplacement du filtre à carburant',
          description: 'Pièce, main d’œuvre et réamorçage du circuit.',
          price: 59,
          priceFrom: true,
          duration: 30,
        },
        {
          id: 'bougies',
          name: 'Remplacement des bougies',
          description: 'Moteurs essence, jeu complet.',
          price: 69,
          priceFrom: true,
          duration: 45,
        },
        {
          id: 'refroidissement',
          name: 'Vidange du liquide de refroidissement',
          description: 'Vidange, remplissage et purge du circuit.',
          price: 79,
          priceFrom: true,
          duration: 45,
        },
      ],
    },
    {
      id: 'freinage',
      name: 'Freinage',
      icon: 'brake',
      services: [
        {
          id: 'plaquettes-av',
          name: 'Plaquettes de frein avant',
          description: 'Pièces et main d’œuvre, contrôle des disques inclus.',
          price: 99,
          priceFrom: true,
          duration: 60,
        },
        {
          id: 'disques-plaquettes-av',
          name: 'Disques + plaquettes avant',
          description: 'Remplacement complet du train avant.',
          price: 229,
          priceFrom: true,
          duration: 90,
        },
        {
          id: 'plaquettes-ar',
          name: 'Plaquettes de frein arrière',
          description: 'Pièces et main d’œuvre.',
          price: 99,
          priceFrom: true,
          duration: 60,
        },
        {
          id: 'tambours',
          name: 'Kit freins à tambour arrière',
          description: 'Mâchoires, cylindres de roue et réglage.',
          price: 189,
          priceFrom: true,
          duration: 120,
        },
        {
          id: 'liquide-frein',
          name: 'Purge du liquide de frein',
          description: 'Remplacement complet du liquide (recommandé tous les 2 ans).',
          price: 59,
          priceFrom: false,
          duration: 30,
        },
      ],
    },
    {
      id: 'moteur',
      name: 'Distribution, embrayage & moteur',
      icon: 'wrench',
      services: [
        {
          id: 'distribution',
          name: 'Kit de distribution + pompe à eau',
          description: 'Courroie, galets, pompe à eau et liquide de refroidissement.',
          price: 449,
          priceFrom: true,
          duration: 240,
        },
        {
          id: 'courroie-accessoires',
          name: 'Courroie d’accessoires',
          description: 'Courroie et galet tendeur.',
          price: 119,
          priceFrom: true,
          duration: 60,
        },
        {
          id: 'embrayage',
          name: 'Kit embrayage',
          description: 'Disque, mécanisme et butée.',
          price: 590,
          priceFrom: true,
          duration: 360,
        },
      ],
    },
    {
      id: 'pneus',
      name: 'Pneumatiques & géométrie',
      icon: 'tire',
      services: [
        {
          id: 'montage-pneu',
          name: 'Montage + équilibrage (par pneu)',
          description: 'Hors prix du pneu. Valve neuve incluse.',
          price: 15,
          priceFrom: false,
          duration: 15,
        },
        {
          id: 'crevaison',
          name: 'Réparation de crevaison',
          description: 'Réparation par l’intérieur avec démontage.',
          price: 25,
          priceFrom: false,
          duration: 30,
        },
        {
          id: 'geometrie',
          name: 'Contrôle et réglage de la géométrie',
          description: 'Parallélisme du train avant.',
          price: 69,
          priceFrom: false,
          duration: 60,
        },
        {
          id: 'permutation',
          name: 'Permutation des pneus',
          description: 'Avant / arrière, contrôle des pressions.',
          price: 25,
          priceFrom: false,
          duration: 30,
        },
      ],
    },
    {
      id: 'clim',
      name: 'Climatisation',
      icon: 'snow',
      services: [
        {
          id: 'recharge-clim',
          name: 'Recharge de climatisation',
          description: 'Contrôle d’étanchéité, recharge en gaz et test de performance.',
          price: 79,
          priceFrom: true,
          duration: 60,
        },
        {
          id: 'desinfection-clim',
          name: 'Désinfection du circuit',
          description: 'Traitement antibactérien du circuit et de l’habitacle.',
          price: 39,
          priceFrom: false,
          duration: 30,
        },
      ],
    },
    {
      id: 'diagnostic',
      name: 'Diagnostic & électricité',
      icon: 'bolt',
      services: [
        {
          id: 'diagnostic',
          name: 'Diagnostic électronique',
          description: 'Lecture des codes défaut (voyant moteur, ABS, airbag…), analyse et devis.',
          price: 49,
          priceFrom: false,
          duration: 45,
        },
        {
          id: 'batterie',
          name: 'Remplacement de la batterie',
          description: 'Batterie fournie, contrôle du circuit de charge inclus.',
          price: 129,
          priceFrom: true,
          duration: 30,
        },
        {
          id: 'alternateur',
          name: 'Remplacement alternateur ou démarreur',
          description: 'Pièce et main d’œuvre.',
          price: 290,
          priceFrom: true,
          duration: 120,
        },
        {
          id: 'precontrole',
          name: 'Pré-contrôle technique',
          description: 'Vérification des points du contrôle technique avant le passage.',
          price: 39,
          priceFrom: false,
          duration: 45,
        },
      ],
    },
    {
      id: 'suspension',
      name: 'Suspension & échappement',
      icon: 'spring',
      services: [
        {
          id: 'amortisseurs-av',
          name: 'Amortisseurs avant (la paire)',
          description: 'Amortisseurs, coupelles et contrôle de la géométrie.',
          price: 279,
          priceFrom: true,
          duration: 120,
        },
        {
          id: 'echappement',
          name: 'Silencieux / ligne d’échappement',
          description: 'Remplacement de l’élément défectueux.',
          price: 149,
          priceFrom: true,
          duration: 60,
        },
      ],
    },
  ],

  faq: [
    {
      q: 'Le devis est-il gratuit ?',
      a: 'Oui. Le devis est gratuit et sans engagement. Aucune intervention n’est réalisée sans votre accord, et tout travail supplémentaire découvert pendant la réparation vous est soumis avant d’être fait.',
    },
    {
      q: 'Les prix affichés comprennent-ils les pièces ?',
      a: 'Les forfaits comprennent les pièces et la main d’œuvre, sauf mention contraire (par exemple le montage de pneus, hors prix du pneu). Les prix « à partir de » dépendent du modèle de votre véhicule : le prix exact vous est confirmé avant l’intervention.',
    },
    {
      q: 'Mon véhicule garde-t-il sa garantie constructeur si je fais l’entretien chez vous ?',
      a: 'Oui. Le règlement européen n° 461/2010 vous autorise à faire entretenir votre véhicule par le garage de votre choix. Nous respectons le programme d’entretien du constructeur et utilisons des pièces de qualité équivalente à l’origine.',
    },
    {
      q: 'Combien de temps dure une intervention ?',
      a: 'Une durée indicative est donnée pour chaque prestation. Le rendez-vous correspond à l’heure de dépôt de votre véhicule ; nous vous appelons dès qu’il est prêt.',
    },
    {
      q: 'Comment modifier ou annuler mon rendez-vous ?',
      a: 'Sur la page Rendez-vous, onglet « Gérer mon rendez-vous », avec votre référence et votre adresse e-mail. Vous pouvez aussi nous appeler ou ouvrir une demande de support.',
    },
    {
      q: 'Quels moyens de paiement acceptez-vous ?',
      a: 'Carte bancaire, espèces et virement.',
    },
    {
      q: 'Intervenez-vous sur toutes les marques ?',
      a: 'Oui, nous intervenons sur toutes les marques de véhicules légers et utilitaires légers : essence, diesel, hybride et GPL.',
    },
  ],
};

module.exports = { defaultSettings, TICKET_CATEGORIES, FUEL_TYPES, ICONS };
