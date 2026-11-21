import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type Language = 'en' | 'es' | 'fr';

interface LanguageContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

const dictionary: Record<Exclude<Language, 'en'>, Record<string, string>> = {
  es: {
    Roster: 'Lista',
    Calendar: 'Calendario',
    Messages: 'Mensajes',
    Bookings: 'Reservas',
    Dashboard: 'Panel',
    Admin: 'Administración',
    'Client Profile': 'Perfil del Cliente',
    'Book Talent': 'Reservar Talento',
    'Search celebrities, categories, bookings...': 'Buscar celebridades, categorías, reservas...',
    'Platform Admin': 'Administrador de Plataforma',
    'Client Booking View': 'Vista de Reservas del Cliente',
    'Manager Dashboard View': 'Panel del Representante',
    'Awaiting admin approval': 'Esperando aprobación del administrador',
    Approved: 'Aprobado',
    Rejected: 'Rechazado',
    Pending: 'Pendiente',
    Approve: 'Aprobar',
    Reject: 'Rechazar',
    Submit: 'Enviar',
    Save: 'Guardar',
    Cancel: 'Cancelar',
    'Deposit Approved': 'Depósito Aprobado',
    'Deposit Rejected': 'Depósito Rechazado',
    'View Booking': 'Ver Reserva',
    'View Fan Card': 'Ver Tarjeta Fan',
    'View Details': 'Ver Detalles',
    Roster_Admin: 'Lista de Celebridades',
    'Escrow & Deposits': 'Depósitos y Garantía',
    Approvals: 'Aprobaciones',
    'Fan Cards': 'Tarjetas Fan',
    'All Messages': 'Todos los Mensajes',
    'Bank deposit details': 'Datos de depósito bancario',
    'Deposit proof': 'Comprobante de depósito',
    'Expected amount': 'Monto esperado',
    'Submitted amount': 'Monto enviado',
    'Daily rate': 'Tarifa diaria',
    Biography: 'Biografía',
  },
  fr: {
    Roster: 'Liste',
    Calendar: 'Calendrier',
    Messages: 'Messages',
    Bookings: 'Réservations',
    Dashboard: 'Tableau de bord',
    Admin: 'Administration',
    'Client Profile': 'Profil Client',
    'Book Talent': 'Réserver un talent',
    'Search celebrities, categories, bookings...': 'Rechercher célébrités, catégories, réservations...',
    'Platform Admin': 'Administrateur de la plateforme',
    'Client Booking View': 'Vue réservation client',
    'Manager Dashboard View': 'Tableau de bord du manager',
    'Awaiting admin approval': 'En attente d’approbation admin',
    Approved: 'Approuvé',
    Rejected: 'Rejeté',
    Pending: 'En attente',
    Approve: 'Approuver',
    Reject: 'Rejeter',
    Submit: 'Envoyer',
    Save: 'Enregistrer',
    Cancel: 'Annuler',
    'Deposit Approved': 'Dépôt approuvé',
    'Deposit Rejected': 'Dépôt rejeté',
    'View Booking': 'Voir la réservation',
    'View Fan Card': 'Voir la carte Fan',
    'View Details': 'Voir les détails',
    Roster_Admin: 'Liste des célébrités',
    'Escrow & Deposits': 'Dépôts et séquestre',
    Approvals: 'Approbations',
    'Fan Cards': 'Cartes Fan',
    'All Messages': 'Tous les messages',
    'Bank deposit details': 'Coordonnées bancaires',
    'Deposit proof': 'Preuve de dépôt',
    'Expected amount': 'Montant attendu',
    'Submitted amount': 'Montant envoyé',
    'Daily rate': 'Tarif journalier',
    Biography: 'Biographie',
  },
};

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const stored = localStorage.getItem('ms_language');
    return stored === 'es' || stored === 'fr' ? stored : 'en';
  });

  useEffect(() => {
    localStorage.setItem('ms_language', language);
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback((next: Language) => setLanguageState(next), []);

  const t = useCallback(
    (key: string) => (language === 'en' ? key : dictionary[language][key] || key),
    [language]
  );

  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
