import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useAccessibility } from '../context/AccessibilityContext';
import AccessibilityMenu from '../components/AccessibilityMenu';
import Webcam from 'react-webcam';
import { 
  User, ShieldCheck, Globe, Moon, Sun, Vote, Accessibility,
  Mail, Fingerprint, Camera, ChevronRight, AlertCircle, Loader2 
} from 'lucide-react';

export default function Login({ isAdminLogin = false }) {
  const [identifier, setIdentifier] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { settings, toggleTheme } = useAccessibility();
  const [showAccessibility, setShowAccessibility] = useState(false);
  const [step, setStep] = useState(1);
  
  const [photoUrl, setPhotoUrl] = useState(null);
  const [fingerprintFile, setFingerprintFile] = useState(null);
  const webcamRef = useRef(null);

  const { t, i18n } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();

  // Accessibility settings are managed by the Provider via useEffect
  
  const capture = useCallback(() => {
    const imageSrc = webcamRef.current.getScreenshot();
    if (imageSrc) setPhotoUrl(imageSrc);
  }, [webcamRef]);

  const handleFingerprintUpload = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFingerprintFile(e.target.files[0]);
    }
  };

  const handleStep1 = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!isAdminLogin) {
      if (identifier.length !== 8) {
        setError('El DNI debe tener exactamente 8 dígitos.');
        return;
      }
      setIsLoading(true);
      const result = await login({ dni: identifier });
      if (result.success) navigate('/vote');
      else { setError(result.error); setIsLoading(false); }
    } else {
      if (!identifier.includes('@')) {
        setError('Ingrese un correo electrónico válido.');
        return;
      }
      setStep(2);
    }
  };

  const handleAdminFinalLogin = async () => {
    setIsLoading(true);
    setError('');
    const result = await login({ email: identifier });
    if (result.success) navigate('/admin/dashboard');
    else { setError(result.error); setIsLoading(false); setStep(1); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-cover bg-center relative" 
      style={{ backgroundImage: 'linear-gradient(rgba(15, 23, 42, 0.6), rgba(15, 23, 42, 0.6)), url(/bg_institutional.png)' }}>
      
      {/* Navbar Overlay */}
      <header className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-10 max-w-7xl mx-auto w-full">
        <div className="relative group cursor-pointer">
          <div className="flex items-center gap-3 text-white">
            <Globe size={20} />
            <span className="font-semibold text-sm tracking-wider uppercase">{t('login.language')}</span>
          </div>
          {/* Dropdown menu */}
          <div className="absolute top-full left-0 mt-2 w-32 bg-white rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 overflow-hidden border border-slate-100">
            <button onClick={() => i18n.changeLanguage('es')} className="w-full text-left px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 hover:text-primary-blue">ESPAÑOL</button>
            <button onClick={() => i18n.changeLanguage('en')} className="w-full text-left px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 hover:text-primary-blue">ENGLISH</button>
            <button onClick={() => i18n.changeLanguage('qu')} className="w-full text-left px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 hover:text-primary-blue">QUECHUA</button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowAccessibility(true)} 
            className="glass-button secondary !w-11 !h-11 !p-0 rounded-full !border-white/20 !bg-white/10 !text-white hover:!bg-white/20 transition-all"
            title="Accesibilidad"
          >
            <Accessibility size={20} />
          </button>
          <button 
            onClick={toggleTheme} 
            className="glass-button secondary !w-11 !h-11 !p-0 rounded-full !border-white/20 !bg-white/10 !text-white hover:!bg-white/20 transition-all"
          >
            {settings.theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
          </button>
        </div>
      </header>

      <AccessibilityMenu isOpen={showAccessibility} onClose={() => setShowAccessibility(false)} />

      <main className="animate-fade-in w-full max-w-[460px] transition-all duration-500" 
        style={{ maxWidth: step === 1 ? '460px' : '640px' }}>
        
        {/* Logo Section */}
        <div className="flex flex-col items-center mb-10 text-center">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-surface p-2.5 rounded-xl shadow-2xl">
              <Vote size={32} className="text-primary-navy" />
            </div>
            <h1 className="text-4xl font-extrabold text-white tracking-tight">VoteSystem</h1>
          </div>
          <p className="text-white/80 font-medium tracking-[0.1em] uppercase text-xs">
            {isAdminLogin ? t('login.admin_portal') : t('login.citizen_portal')}
          </p>
        </div>

        {/* Multi-step Progress (Admin only) */}
        {isAdminLogin && step > 1 && (
          <div className="flex items-center justify-center gap-4 mb-8">
            <StepIcon active={step === 2} done={step > 2} icon={<Fingerprint size={18} />} label="Huella" />
            <div className={`h-0.5 w-10 transition-colors duration-500 ${step > 2 ? 'bg-success-emerald' : 'bg-white/20'}`} />
            <StepIcon active={step === 3} done={false} icon={<Camera size={18} />} label="Rostro" />
          </div>
        )}

        <div className="flat-card !shadow-2xl">
          {error && (
            <div className="animate-fade-in mb-6 p-4 rounded-xl bg-danger-rose/10 border border-danger-rose/20 text-danger-rose text-sm flex items-center gap-3">
              <AlertCircle size={18} /> {error}
            </div>
          )}

          {/* STEP 1: CREDENTIALS */}
          {step === 1 && (
            <form onSubmit={handleStep1} className="flex flex-col gap-6">
              <div className="text-center mb-2">
                <h2 className="text-2xl font-extrabold text-text-main">{t('login.welcome')}</h2>
                <p className="text-text-muted">{t('login.instruction')}</p>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-bold text-text-main block px-1">
                  {isAdminLogin ? t('login.admin_email') : t('login.citizen_dni')}
                </label>
                <div className="input-wrapper">
                  {isAdminLogin ? <Mail size={20} className="input-icon" /> : <User size={20} className="input-icon" />}
                  <input 
                    type={isAdminLogin ? "email" : "text"} 
                    className="glass-input" 
                    placeholder={isAdminLogin ? t('login.email_placeholder') : t('login.dni_placeholder')}
                    value={identifier}
                    onChange={(e) => setIdentifier(isAdminLogin ? e.target.value : e.target.value.replace(/\D/g, ''))}
                    maxLength={isAdminLogin ? 100 : 8}
                    required
                  />
                </div>
              </div>

              <button type="submit" className="glass-button !py-4" disabled={isLoading}>
                {isLoading ? t('login.verifying') : isAdminLogin ? t('login.continue_biometrics') : t('login.enter_system')}
                {!isLoading && <ChevronRight size={20} />}
              </button>

              {!isAdminLogin && (
                <div className="text-center border-t border-surface-border pt-6 mt-2">
                  <Link to="/admin/login" className="text-primary-blue font-bold hover:underline text-sm">
                    {t('login.admin_link')}
                  </Link>
                </div>
              )}
            </form>
          )}

          {/* STEP 2: FINGERPRINT (Admin) */}
          {isAdminLogin && step === 2 && (
            <div className="flex flex-col items-center gap-6">
              <div className="text-center">
                <h2 className="text-2xl font-extrabold">Identidad Dactilar</h2>
                <p className="text-text-muted">Coloque su dedo en el lector biométrico</p>
              </div>

              <div className="w-full h-60 border-2 border-dashed border-surface-border rounded-3xl bg-bg-main flex flex-col items-center justify-center gap-4 group transition-all hover:border-primary-blue/50">
                <Fingerprint 
                  size={80} 
                  className={`transition-all duration-500 ${fingerprintFile ? 'text-success-emerald scale-110' : 'text-primary-navy/30'}`} 
                />
                <input type="file" id="admin-finger-upload" onChange={handleFingerprintUpload} className="hidden" />
                <label htmlFor="admin-finger-upload" className="glass-button secondary !w-auto cursor-pointer py-2.5 px-6">
                  {fingerprintFile ? 'Huella Registrada' : 'Escanear Huella'}
                </label>
              </div>

              <div className="flex items-center gap-4 w-full mt-2">
                <button className="glass-button secondary !px-4 flex-1" onClick={() => setStep(1)}>
                  Atrás
                </button>
                <button className="glass-button !px-4 flex-2" onClick={() => setStep(3)} disabled={!fingerprintFile}>
                  Siguiente paso
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: FACE (Admin) */}
          {isAdminLogin && step === 3 && (
            <div className="flex flex-col items-center gap-8">
              <div className="text-center">
                <h2 className="text-2xl font-black text-text-main">Validación Facial</h2>
                <p className="text-text-muted">Mire directamente a la cámara para el escaneo 3D</p>
              </div>

              <div className="w-full rounded-3xl overflow-hidden bg-slate-900 shadow-2xl relative aspect-video border-4 border-surface-border">
                {!photoUrl ? (
                  <Webcam 
                    audio={false} 
                    ref={webcamRef} 
                    screenshotFormat="image/jpeg" 
                    className="w-full h-full object-cover scale-x-[-1]" 
                  />
                ) : (
                  <img src={photoUrl} alt="Captura" className="w-full h-full object-cover scale-x-[-1]" />
                )}
                <div className="absolute inset-8 border-4 border-white/20 rounded-full pointer-events-none border-dashed animate-[spin_10s_linear_infinite]" />
                <div className="absolute inset-0 bg-linear-to-b from-transparent via-transparent to-black/40 pointer-events-none" />
              </div>

              <div className="flex items-center gap-4 w-full mt-2">
                {!photoUrl ? (
                  <>
                    <button className="glass-button secondary !px-4 flex-1" onClick={() => setStep(2)}>
                      Atrás
                    </button>
                    <button className="glass-button !px-4 flex-2" onClick={capture}>
                      <Camera size={20} /> Capturar Rostro
                    </button>
                  </>
                ) : (
                  <>
                    <button className="glass-button secondary !px-4 flex-1" onClick={() => setPhotoUrl(null)}>
                      Reintentar
                    </button>
                    <button className="glass-button !px-4 flex-2" onClick={handleAdminFinalLogin} disabled={isLoading}>
                      {isLoading ? <Loader2 className="animate-spin" /> : 'Confirmar Identidad'}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-center gap-3 mt-10 text-white/70 text-sm font-semibold">
          <ShieldCheck size={18} className="text-success-emerald" />
          <span>{t('login.encryption')}</span>
        </div>
      </main>
    </div>
  );
}

function StepIcon({ active, done, icon, label }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-500 border-2 ${
        done 
          ? 'bg-success-emerald border-success-emerald text-white shadow-lg shadow-success-emerald/20' 
          : active 
            ? 'bg-white border-white text-primary-navy shadow-lg shadow-white/20 scale-110' 
            : 'bg-white/10 border-white/20 text-white/50'
      }`}>
        {icon}
      </div>
      <span className="text-[10px] text-white font-bold uppercase tracking-widest">{label}</span>
    </div>
  );
}
