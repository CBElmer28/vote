import { useState, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useAccessibility } from '../context/AccessibilityContext';
import { startAuthentication } from '@simplewebauthn/browser';
import AccessibilityMenu from '../components/AccessibilityMenu';
import Webcam from 'react-webcam';
import axios from 'axios';
import {
  User, ShieldCheck, Globe, Moon, Sun, Vote, Accessibility,
  Mail, Fingerprint, Camera, ChevronRight, AlertCircle, Loader2, Upload
} from 'lucide-react';

// Utilidad para convertir el base64 a Blob para el envío al Backend
const base64ToBlob = (base64, mime = 'image/jpeg') => {
  const byteString = atob(base64.split(',')[1]);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: mime });
};

export default function Login({ isAdminLogin = false }) {
  const [identifier, setIdentifier] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [photoUrl, setPhotoUrl] = useState(null);

  const { settings, toggleTheme } = useAccessibility();
  const [showAccessibility, setShowAccessibility] = useState(false);
  const webcamRef = useRef(null);

  const { t, i18n } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();

  // --- CAPTURA DE ROSTRO ---
  const capture = useCallback(() => {
    const imageSrc = webcamRef.current.getScreenshot();
    if (imageSrc) setPhotoUrl(imageSrc);
  }, [webcamRef]);

  const handleFaceUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setPhotoUrl(reader.result);
      reader.readAsDataURL(file);
    }
  };

  // --- PASO 1: VALIDAR CREDENCIALES ---
  const handleStep1 = (e) => {
    e.preventDefault();
    setError('');
    if (!isAdminLogin && identifier.length !== 8) {
      setError('El DNI debe tener 8 dígitos.');
      return;
    }
    if (isAdminLogin && !identifier.includes('@')) {
      setError('Ingrese un correo válido.');
      return;
    }
    setStep(2); // Todos van a Huella
  };

  // --- PASO 2: HUELLA (MODO DEMO PARA PRESENTACIÓN) ---
  const handleFingerprintAuth = async () => {
    setIsLoading(true);
    setError('');

    try {
      // ⏱️ Simulamos el tiempo que tardaría el lector y la red (1.5 segundos)
      setTimeout(() => {
        setIsLoading(false);
        setStep(3); // Avanzar directamente al paso de Rostro
      }, 1500);

      /* --- CÓDIGO WEBAUTHN REAL (COMENTADO PARA PRODUCCIÓN FUTURA) ---
      const field = isAdminLogin ? 'email' : 'dni';
      const optionsRes = await axios.post('http://localhost:5002/api/biometrico/verify/fingerprint/options', { 
        [field]: identifier 
      });

      const assertion = await startAuthentication(optionsRes.data.options);

      const verifyRes = await axios.post('http://localhost:5002/api/biometrico/verify/fingerprint/verify', {
        [field]: identifier,
        credential_response: assertion
      });

      if (verifyRes.data.verified) setStep(3); 
      ------------------------------------------------------------------ */

    } catch (err) {
      setError('Error en huella dactilar: ' + (err.response?.data?.error || err.message));
      setIsLoading(false);
    }
  };

  // --- PASO 3: ROSTRO (AWS) + LOGIN FINAL ---
  const handleFinalLogin = async () => {
    setIsLoading(true);
    setError('');
    try {
      // 1. Buscar el aws_face_id del usuario
      const userRoute = isAdminLogin ? `by-email/${identifier}` : `by-dni/${identifier}`;
      const userRes = await axios.get(`http://localhost:80/api/usuarios/${userRoute}`);
      const awsFaceId = userRes.data.data.aws_face_id;

      // 2. Verificar en AWS
      const faceBlob = base64ToBlob(photoUrl);
      const faceData = new FormData();
      faceData.append('face_photo', faceBlob, 'login.jpg');
      faceData.append('reference_face_id', awsFaceId);

      const awsRes = await axios.post('http://localhost:80/api/biometrico/verify/face', faceData);

      if (awsRes.data.verified) {
        // 3. Login de sesión en ms_usuarios
        const loginData = isAdminLogin ? { email: identifier } : { dni: identifier };
        const result = await login(loginData);
        if (result.success) navigate(isAdminLogin ? '/admin/dashboard' : '/vote');
        else setError(result.error);
      } else {
        setError('El rostro no coincide.');
        setPhotoUrl(null);
      }
    } catch (err) {
      setError('Error en validación facial.');
      setPhotoUrl(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-cover bg-center"
      style={{ backgroundImage: 'linear-gradient(rgba(15, 23, 42, 0.6), rgba(15, 23, 42, 0.6)), url(/bg_institutional.png)' }}>

      <main className="animate-fade-in w-full max-w-[460px] transition-all duration-500"
        style={{ maxWidth: step === 1 ? '460px' : '600px' }}>

        <div className="flex flex-col items-center mb-8 text-center">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-white p-2.5 rounded-xl shadow-lg"><Vote size={32} className="text-blue-900" /></div>
            <h1 className="text-4xl font-black text-white tracking-tight">VoteSystem</h1>
          </div>
          <p className="text-white/80 font-bold uppercase text-xs tracking-widest">
            {isAdminLogin ? 'Portal Administrativo' : 'Portal del Ciudadano'}
          </p>
        </div>

        {step > 1 && (
          <div className="flex items-center justify-center gap-4 mb-8">
            <StepIcon active={step === 2} done={step > 2} icon={<Fingerprint size={18} />} label="Huella" />
            <div className={`h-0.5 w-10 ${step > 2 ? 'bg-green-500' : 'bg-white/20'}`} />
            <StepIcon active={step === 3} done={false} icon={<Camera size={18} />} label="Rostro" />
          </div>
        )}

        <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl">
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm flex items-center gap-3 font-medium">
              <AlertCircle size={18} /> {error}
            </div>
          )}

          {step === 1 && (
            <form onSubmit={handleStep1} className="flex flex-col gap-6">
              <div className="text-center">
                <h2 className="text-2xl font-black text-slate-800">{t('login.welcome')}</h2>
                <p className="text-slate-500 font-medium">{t('login.instruction')}</p>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-blue-900 uppercase tracking-wider">{isAdminLogin ? 'Email' : 'DNI'}</label>
                <div className="relative">
                  {isAdminLogin ? <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} /> : <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />}
                  <input
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:border-blue-500 outline-none font-bold"
                    value={identifier}
                    onChange={(e) => setIdentifier(isAdminLogin ? e.target.value : e.target.value.replace(/\D/g, ''))}
                    maxLength={isAdminLogin ? 100 : 8}
                    required
                  />
                </div>
              </div>
              <button type="submit" className="w-full py-4 bg-blue-900 text-white rounded-2xl font-black flex items-center justify-center gap-2">
                Continuar <ChevronRight size={20} />
              </button>
            </form>
          )}

          {step === 2 && (
            <div className="flex flex-col items-center gap-6 text-center">
              <div>
                <h2 className="text-2xl font-black">Validación Dactilar</h2>
                <p className="text-slate-500">Use el sensor de su dispositivo</p>
              </div>
              <div className="w-full py-12 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50 flex flex-col items-center">
                <Fingerprint size={60} className="text-blue-900/30 mb-4" />
                <button onClick={handleFingerprintAuth} className="px-8 py-3 bg-blue-900 text-white rounded-xl font-bold flex items-center gap-2" disabled={isLoading}>
                  {isLoading ? <Loader2 className="animate-spin" /> : 'Escanear Huella'}
                </button>
              </div>
              <button className="text-sm font-bold text-slate-400" onClick={() => setStep(1)}>Volver</button>
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col items-center gap-6">
              <div className="text-center">
                <h2 className="text-2xl font-black">Validación Facial</h2>
                <p className="text-slate-500">Mire a la cámara o suba una foto</p>
              </div>
              <div className="w-full aspect-video rounded-3xl overflow-hidden bg-slate-900 relative border-4 border-slate-100">
                {!photoUrl ? (
                  <Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg" className="w-full h-full object-cover scale-x-[-1]" />
                ) : (
                  <img src={photoUrl} className="w-full h-full object-cover" />
                )}
              </div>
              <div className="flex flex-col gap-3 w-full">
                {!photoUrl ? (
                  <>
                    <button onClick={capture} className="w-full py-4 bg-blue-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2">
                      <Camera size={20} /> Capturar Rostro
                    </button>
                    <input type="file" id="f-up" accept="image/*" onChange={handleFaceUpload} className="hidden" />
                    <label htmlFor="f-up" className="w-full py-3 border border-slate-200 text-slate-500 rounded-2xl font-bold flex items-center justify-center gap-2 cursor-pointer">
                      <Upload size={18} /> Subir Imagen de Prueba
                    </label>
                  </>
                ) : (
                  <div className="flex gap-4">
                    <button onClick={() => setPhotoUrl(null)} className="flex-1 py-4 border border-slate-200 rounded-2xl font-bold">Reintentar</button>
                    <button onClick={handleFinalLogin} className="flex-2 py-4 bg-green-600 text-white rounded-2xl font-bold" disabled={isLoading}>
                      {isLoading ? <Loader2 className="animate-spin" /> : 'Confirmar Identidad'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function StepIcon({ active, done, icon, label }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center border-2 transition-all ${done ? 'bg-green-500 border-green-500 text-white' : active ? 'bg-white border-blue-900 text-blue-900 scale-110' : 'bg-white/10 border-white/20 text-white/50'}`}>
        {icon}
      </div>
      <span className="text-[10px] text-white font-black uppercase tracking-widest">{label}</span>
    </div>
  );
}