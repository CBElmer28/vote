import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import es from './locales/es.json';
import en from './locales/en.json';
import qu from './locales/qu.json';

const resources = {
  es: { translation: es },
  en: { translation: en },
  qu: { translation: qu }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'es', // default language
    fallbackLng: 'es',
    interpolation: {
      escapeValue: false // react already safes from xss
    }
  });

export default i18n;
