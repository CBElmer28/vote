import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAccessibility } from '../context/AccessibilityContext';
import { Languages, Accessibility, Moon, Sun, ChevronDown, Check } from 'lucide-react';
import AccessibilityMenu from './AccessibilityMenu';

export default function GlobalControls() {
  const { t, i18n } = useTranslation();
  const { settings, toggleTheme } = useAccessibility();
  const [showAccessibility, setShowAccessibility] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);

  const languages = [
    { code: 'es', label: 'Español', flag: '🇪🇸' },
    { code: 'en', label: 'English', flag: '🇺🇸' },
    { code: 'qu', label: 'Quechua', flag: '🇵🇪' },
  ];

  const changeLanguage = (code) => {
    i18n.changeLanguage(code);
    setShowLangMenu(false);
  };

  const isDark = settings.theme === 'dark';
  const buttonClass = `w-12 h-12 flex items-center justify-center rounded-2xl shadow-2xl transition-all duration-300 border backdrop-blur-md group ${isDark
      ? 'bg-white/10 border-white/20 text-white hover:bg-white/20'
      : 'bg-white/80 border-slate-200 text-blue-900 hover:bg-white hover:border-blue-900/30'
    }`;

  return (
    <>
      <div className="fixed bottom-10 right-8 flex flex-col gap-3 z-[100]">
        {/* Language Selector */}
        <div className="relative">
          <button
            onClick={() => setShowLangMenu(!showLangMenu)}
            className={buttonClass}
            title={t('login.change_language')}
          >
            <Languages size={22} className="group-hover:scale-110 transition-transform" />
          </button>

          {showLangMenu && (
            <div className="absolute top-0 right-14 bg-white rounded-2xl shadow-2xl border border-slate-100 py-2 w-48 animate-fade-in">
              <div className="px-4 py-2 mb-1 border-b border-slate-50">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('login.select_language')}</span>
              </div>
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => changeLanguage(lang.code)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{lang.flag}</span>
                    <span className={`text-sm font-bold ${i18n.language === lang.code ? 'text-blue-900' : 'text-slate-600'}`}>
                      {lang.label}
                    </span>
                  </div>
                  {i18n.language === lang.code && <Check size={16} className="text-blue-900" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Accessibility Button */}
        <button
          onClick={() => setShowAccessibility(true)}
          className={buttonClass}
          title={t('admin.accessibility')}
        >
          <Accessibility size={22} className="group-hover:scale-110 transition-transform" />
        </button>

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className={buttonClass}
          title={t('login.change_theme')}
        >
          {settings.theme === 'light' ?
            <Moon size={22} className="group-hover:scale-110 transition-transform" /> :
            <Sun size={22} className="group-hover:scale-110 transition-transform" />
          }
        </button>
      </div>

      <AccessibilityMenu isOpen={showAccessibility} onClose={() => setShowAccessibility(false)} />
    </>
  );
}
