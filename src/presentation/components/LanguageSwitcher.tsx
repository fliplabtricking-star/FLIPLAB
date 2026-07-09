import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const location = useLocation();
  const isAdmin = location.pathname.startsWith('/admin');

  useEffect(() => {
    if (isAdmin) {
      document.documentElement.dir = 'ltr';
    } else {
      if (i18n.language === 'ar') {
        document.documentElement.dir = 'rtl';
      } else {
        document.documentElement.dir = 'ltr';
      }
    }
  }, [i18n.language, isAdmin]);

  if (isAdmin) return null;

  const toggleLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
  };

  return (
    <div className="absolute top-4 right-4 rtl:left-4 rtl:right-auto flex gap-2 z-50">
      <button 
        onClick={() => toggleLanguage('en')}
        className={`px-3 py-1 font-mono text-xs font-bold border border-outline-variant uppercase tracking-widest transition-colors ${i18n.language === 'en' ? 'bg-primary text-on-primary border-primary' : 'bg-surface-container text-secondary hover:text-on-surface'}`}
      >
        EN
      </button>
      <button 
        onClick={() => toggleLanguage('ms')}
        className={`px-3 py-1 font-mono text-xs font-bold border border-outline-variant uppercase tracking-widest transition-colors ${i18n.language === 'ms' ? 'bg-primary text-on-primary border-primary' : 'bg-surface-container text-secondary hover:text-on-surface'}`}
      >
        MS
      </button>
      <button 
        onClick={() => toggleLanguage('ar')}
        className={`px-3 py-1 font-mono text-xs font-bold border border-outline-variant uppercase tracking-widest transition-colors ${i18n.language === 'ar' ? 'bg-primary text-on-primary border-primary' : 'bg-surface-container text-secondary hover:text-on-surface'}`}
      >
        عربي
      </button>
    </div>
  );
}
