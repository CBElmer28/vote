import { 
  X, Settings, Eye, Type, Activity, 
  Moon, Sun, Palette, ZoomIn, Info,
  CheckCircle2, MousePointer2, ZapOff
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAccessibility } from '../context/AccessibilityContext';

export default function AccessibilityMenu({ isOpen, onClose }) {
  const { t } = useTranslation();
  const { settings, updateSetting, toggleTheme } = useAccessibility();

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-primary-navy/40 backdrop-blur-sm z-[100] transition-opacity animate-fade-in"
        onClick={onClose}
      />
      
      {/* Sidebar */}
      <aside className="fixed top-0 right-0 h-full w-full max-w-sm bg-surface shadow-2xl z-[101] flex flex-col animate-scale-in origin-right overflow-hidden border-l border-surface-border">
        {/* Header */}
        <div className="p-8 bg-primary-navy text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-lg">
              <Settings size={20} />
            </div>
            <div>
              <h2 className="text-xl font-black">{t('accessibility.title')}</h2>
              <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest">{t('accessibility.subtitle')}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-all">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-10">
          
          {/* Visual Profile */}
          <section className="space-y-4">
            <h3 className="text-xs font-black text-text-muted uppercase tracking-widest flex items-center gap-2">
              <Palette size={14} /> {t('accessibility.profiles_title')}
            </h3>
            <div className="grid grid-cols-1 gap-2">
              <OptionButton 
                active={settings.colorProfile === 'default'} 
                onClick={() => updateSetting('colorProfile', 'default')}
                label={t('accessibility.profile_default')}
              />
              <OptionButton 
                active={settings.colorProfile === 'protanopia'} 
                onClick={() => updateSetting('colorProfile', 'protanopia')}
                label={t('accessibility.profile_protanopia')}
              />
              <OptionButton 
                active={settings.colorProfile === 'deuteranopia'} 
                onClick={() => updateSetting('colorProfile', 'deuteranopia')}
                label={t('accessibility.profile_deuteranopia')}
              />
              <OptionButton 
                active={settings.colorProfile === 'tritanopia'} 
                onClick={() => updateSetting('colorProfile', 'tritanopia')}
                label={t('accessibility.profile_tritanopia')}
              />
              <OptionButton 
                active={settings.colorProfile === 'achromatopsia'} 
                onClick={() => updateSetting('colorProfile', 'achromatopsia')}
                label={t('accessibility.profile_achromatopsia')}
              />
            </div>
          </section>

          {/* Typography */}
          <section className="space-y-4">
            <h3 className="text-xs font-black text-text-muted uppercase tracking-widest flex items-center gap-2">
              <Type size={14} /> {t('accessibility.typography_title')}
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <OptionCard 
                active={settings.font === 'dyslexic'} 
                onClick={() => updateSetting('font', settings.font === 'dyslexic' ? 'normal' : 'dyslexic')}
                icon={<Info size={20} />}
                label={t('accessibility.dyslexia_font')}
              />
              <OptionCard 
                active={settings.adhdMode} 
                onClick={() => updateSetting('adhdMode', !settings.adhdMode)}
                icon={<MousePointer2 size={20} />}
                label={t('accessibility.adhd_focus')}
              />
            </div>
          </section>

          {/* Vision & Contrast */}
          <section className="space-y-4">
            <h3 className="text-xs font-black text-text-muted uppercase tracking-widest flex items-center gap-2">
              <Eye size={14} /> {t('accessibility.vision_contrast_title')}
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-bg-main rounded-2xl border border-surface-border">
                <span className="text-sm font-bold text-text-main">{t('accessibility.text_scale')}</span>
                <div className="flex gap-2">
                  {[1, 1.2, 1.5].map(scale => (
                    <button 
                      key={scale}
                      onClick={() => updateSetting('textScale', scale)}
                      className={`w-10 h-10 rounded-xl font-bold transition-all ${settings.textScale === scale ? 'bg-primary-blue text-white shadow-lg' : 'bg-white text-text-muted'}`}
                    >
                      {scale === 1 ? '1x' : scale === 1.2 ? '1.2x' : '1.5x'}
                    </button>
                  ))}
                </div>
              </div>
              <OptionButton 
                active={settings.highContrast} 
                onClick={() => updateSetting('highContrast', !settings.highContrast)}
                label={t('accessibility.high_contrast')}
              />
            </div>
          </section>

          {/* Others */}
          <section className="space-y-4">
            <h3 className="text-xs font-black text-text-muted uppercase tracking-widest flex items-center gap-2">
              <Activity size={14} /> {t('accessibility.sensitivity_title')}
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <OptionCard 
                active={settings.theme === 'dark'} 
                onClick={toggleTheme}
                icon={settings.theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                label={settings.theme === 'dark' ? t('accessibility.mode_light') : t('accessibility.mode_dark')}
              />
              <OptionCard 
                active={settings.reducedMotion} 
                onClick={() => updateSetting('reducedMotion', !settings.reducedMotion)}
                icon={<ZapOff size={20} />}
                label={t('accessibility.reduced_motion')}
              />
            </div>
          </section>

        </div>

        {/* Footer */}
        <div className="p-8 bg-bg-main border-t border-surface-border shrink-0">
          <p className="text-[10px] text-text-muted font-bold text-center leading-relaxed">
            {t('accessibility.footer_note')}
          </p>
        </div>
      </aside>
    </>
  );
}

function OptionButton({ active, onClick, label }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all group ${
        active 
          ? 'bg-primary-blue/5 border-primary-blue text-primary-blue shadow-md' 
          : 'bg-surface border-surface-border text-text-main hover:border-primary-blue/30'
      }`}
    >
      <span className="text-sm font-bold">{label}</span>
      {active && <CheckCircle2 size={18} />}
    </button>
  );
}

function OptionCard({ active, onClick, icon, label }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center gap-3 p-5 rounded-[2rem] border-2 transition-all ${
        active 
          ? 'bg-primary-blue text-white border-primary-blue shadow-lg scale-[1.02]' 
          : 'bg-surface border-surface-border text-text-muted hover:border-primary-blue/30 hover:text-text-main'
      }`}
    >
      <div className={`p-3 rounded-2xl transition-colors ${active ? 'bg-white/20 text-white' : 'bg-bg-main text-text-muted'}`}>
        {icon}
      </div>
      <span className="text-[10px] font-black uppercase tracking-widest text-center">{label}</span>
    </button>
  );
}
