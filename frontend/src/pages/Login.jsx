import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { GlassCard } from '../components/GlassCard';
import Webcam from 'react-webcam';
import { 
  LogIn, User, ShieldCheck, Globe, Moon, Sun, Vote, 
  Mail, Fingerprint, Camera, ChevronRight, Check, AlertCircle 
} from 'lucide-react';

export default function Login({ isAdminLogin = false }) {
  const [identifier, setIdentifier] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [theme, setTheme] = useState('light');
  const [step, setStep] = useState(1);
  
  // Biometrics
  const [photoUrl, setPhotoUrl] = useState(null);
  const [fingerprintFile, setFingerprintFile] = useState(null);
  const webcamRef = useRef(null);

  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current.getScreenshot();
    if (imageSrc) {
      setPhotoUrl(imageSrc);
    }
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
      // Voter flow: Just DNI and redirect
      if (identifier.length !== 8) {
        setError('El DNI debe tener exactamente 8 dígitos.');
        return;
      }
      setIsLoading(true);
      const result = await login({ dni: identifier });
      if (result.success) {
        navigate('/vote');
      } else {
        setError(result.error);
        setIsLoading(false);
      }
    } else {
      // Admin flow: Validate email format then proceed to biometrics
      if (!identifier.includes('@')) {
        setError('Ingrese un correo electrónico válido.');
        return;
      }
      setStep(2); // Go to Fingerprint
    }
  };

  const handleAdminFinalLogin = async () => {
    setIsLoading(true);
    setError('');
    
    // In a real system, we'd send the biometrics to ms_biometrico here.
    // For this flow, we'll validate the email and then redirect.
    const result = await login({ email: identifier });
    if (result.success) {
      navigate('/admin/dashboard');
    } else {
      setError(result.error);
      setIsLoading(false);
      setStep(1); // Reset on error
    }
  };

  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      width: '100vw',
      minHeight: '100vh',
      backgroundImage: 'url(/bg_institutional.png)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundAttachment: 'fixed',
      position: 'absolute',
      top: 0,
      left: 0,
      zIndex: 0
    }}>
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backdropFilter: 'blur(12px)',
        backgroundColor: 'var(--overlay-bg)',
        zIndex: 1,
        transition: 'background-color 0.3s ease'
      }} />

      {/* Header Bar */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        padding: '1.5rem 2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 3
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#fff' }}>
          <Globe size={18} />
          <select style={{ background: 'transparent', color: '#fff', border: 'none', outline: 'none', fontWeight: 500, cursor: 'pointer' }}>
            <option value="es" style={{ color: '#000' }}>ES</option>
            <option value="en" style={{ color: '#000' }}>EN</option>
          </select>
        </div>
        <button onClick={toggleTheme} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: 'pointer' }}>
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>
      </div>

      <div className="animate-fade-in" style={{ width: '100%', maxWidth: step === 1 ? '440px' : '600px', position: 'relative', zIndex: 2, padding: '2rem', transition: 'max-width 0.5s ease' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <Vote size={36} color="var(--primary)" />
            <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: '#fff', textShadow: '0 2px 10px rgba(0,0,0,0.3)' }}>VoteSystem</h1>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>Portal de {isAdminLogin ? 'Administración' : 'Votantes'}</p>
        </div>

        {isAdminLogin && step > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2rem' }}>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <StepIndicator current={step} target={2} label="Huella" icon={<Fingerprint size={16} />} />
              <div style={{ width: '40px', height: '2px', background: step > 2 ? 'var(--primary)' : 'var(--surface-border)' }} />
              <StepIndicator current={step} target={3} label="Rostro" icon={<Camera size={16} />} />
            </div>
          </div>
        )}

        <GlassCard>
          {error && (
            <div style={{ marginBottom: '1.5rem', padding: '12px', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: 'var(--danger)', borderRadius: '8px', fontSize: '0.9rem', textAlign: 'center', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
              <AlertCircle size={16} /> {error}
            </div>
          )}

          {/* STEP 1: CREDENTIALS */}
          {step === 1 && (
            <form onSubmit={handleStep1} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <h2 style={{ textAlign: 'center', marginBottom: '0.5rem', color: 'var(--text-main)' }}>
                {isAdminLogin ? 'Acceso Administrativo' : 'Iniciar Sesión'}
              </h2>
              
              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-main)', fontWeight: 600 }}>
                  {isAdminLogin ? 'Correo Electrónico' : 'Documento de Identidad (DNI)'}
                </label>
                <div className="input-wrapper">
                  {isAdminLogin ? <Mail size={20} className="input-icon" /> : <User size={20} className="input-icon" />}
                  <input 
                    type={isAdminLogin ? "email" : "text"} 
                    className="glass-input" 
                    placeholder={isAdminLogin ? "admin@example.com" : "Ej. 12345678"}
                    value={identifier}
                    onChange={(e) => setIdentifier(isAdminLogin ? e.target.value : e.target.value.replace(/\D/g, ''))}
                    maxLength={isAdminLogin ? 100 : 8}
                    required
                  />
                </div>
              </div>

              <button type="submit" className="glass-button" disabled={isLoading}>
                {isLoading ? 'Cargando...' : isAdminLogin ? 'Continuar a Biometría' : 'Ingresar'}
                {!isLoading && <ChevronRight size={20} />}
              </button>
            </form>
          )}

          {/* STEP 2: FINGERPRINT (Admin Only) */}
          {isAdminLogin && step === 2 && (
            <div style={{ textAlign: 'center' }}>
              <h2 style={{ marginBottom: '1.5rem' }}>Verificación Dactilar</h2>
              <div style={{ padding: '2rem', border: '2px dashed var(--surface-border)', borderRadius: '12px', marginBottom: '2rem' }}>
                <Fingerprint size={64} color={fingerprintFile ? 'var(--success)' : 'var(--text-muted)'} style={{ marginBottom: '1rem' }} />
                <input type="file" id="admin-finger-upload" onChange={handleFingerprintUpload} style={{ display: 'none' }} />
                <label htmlFor="admin-finger-upload" className="glass-button secondary" style={{ cursor: 'pointer' }}>
                  {fingerprintFile ? 'Huella Capturada' : 'Subir Huella (Simulado)'}
                </label>
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button className="glass-button secondary" onClick={() => setStep(1)}>Atrás</button>
                <button className="glass-button" onClick={() => setStep(3)} disabled={!fingerprintFile}>
                  Siguiente <ChevronRight size={20} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: FACE (Admin Only) */}
          {isAdminLogin && step === 3 && (
            <div style={{ textAlign: 'center' }}>
              <h2 style={{ marginBottom: '1.5rem' }}>Verificación Facial</h2>
              <div style={{ borderRadius: '12px', overflow: 'hidden', marginBottom: '1.5rem', backgroundColor: '#000' }}>
                {!photoUrl ? (
                  <Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg" style={{ width: '100%' }} />
                ) : (
                  <img src={photoUrl} alt="Capture" style={{ width: '100%' }} />
                )}
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                {!photoUrl ? (
                  <button className="glass-button" onClick={capture}><Camera size={20} /> Capturar</button>
                ) : (
                  <>
                    <button className="glass-button secondary" onClick={() => setPhotoUrl(null)}>Reintentar</button>
                    <button className="glass-button" onClick={handleAdminFinalLogin} disabled={isLoading}>
                      {isLoading ? 'Verificando...' : 'Finalizar Login'}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {!isAdminLogin && step === 1 && (
            <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.85rem' }}>
              <Link to="/admin/login" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Acceso Administrativo</Link>
            </div>
          )}
        </GlassCard>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: '2rem', color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem' }}>
          <ShieldCheck size={16} />
          <span>Seguridad Biométrica Activa</span>
        </div>
      </div>
    </div>
  );
}

function StepIndicator({ current, target, label, icon }) {
  const isPast = current > target;
  const isCurrent = current === target;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
      <div style={{ 
        width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: isPast ? 'var(--success)' : isCurrent ? 'var(--primary)' : 'rgba(255,255,255,0.1)',
        color: 'white',
        border: `2px solid ${isPast ? 'var(--success)' : isCurrent ? 'var(--primary)' : 'rgba(255,255,255,0.3)'}`,
        boxShadow: isCurrent ? '0 0 15px var(--primary-glow)' : 'none'
      }}>{icon}</div>
      <span style={{ fontSize: '0.8rem', fontWeight: isCurrent ? '700' : '500', color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>{label}</span>
    </div>
  );
}
