import { useCallback } from 'react';
import translations from './translations';

/**
 * Hook de traduction MoveBissau.
 *
 * Usage:
 *   const { t, lang } = useTranslation();
 *   t('common.loading')  → "Chargement..." ou "Carregando..."
 *   t('auth.login')      → "Connexion" ou "Entrar"
 */
export function useTranslation() {
  // Lire la langue depuis localStorage (définie par useAuth/useCountryConfig)
  const lang = getLang();

  const t = useCallback((key, fallback) => {
    const keys = key.split('.');
    let value = translations;
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return fallback || key;
      }
    }
    if (value && typeof value === 'object' && lang in value) {
      return value[lang];
    }
    if (value && typeof value === 'object' && 'fr' in value) {
      return value.fr; // Fallback français
    }
    return fallback || key;
  }, [lang]);

  return { t, lang };
}

/**
 * Obtenir la langue courante.
 * Priorité : user.preferred_lang > localStorage > navigator > 'fr'
 */
export function getLang() {
  try {
    // 1. Depuis le choix explicite (switcher langue)
    const savedLang = localStorage.getItem('mb_lang');
    if (savedLang === 'pt' || savedLang === 'fr') return savedLang;
  } catch {}

  try {
    // 2. Depuis le profil utilisateur stocké
    const user = JSON.parse(localStorage.getItem('mb_user') || '{}');
    if (user.preferred_lang === 'pt') return 'pt';
    if (user.preferred_lang === 'fr') return 'fr';
  } catch {}

  try {
    // 3. Depuis la langue du navigateur
    const browserLang = navigator.language?.slice(0, 2);
    if (browserLang === 'pt') return 'pt';
  } catch {}

  return 'fr'; // Défaut
}
