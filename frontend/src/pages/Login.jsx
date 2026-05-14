import { useState, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useAccessibility } from '../context/AccessibilityContext';
import { startAuthentication } from '@simplewebauthn/browser';
import AccessibilityMenu from '../components/AccessibilityMenu';
import BarcodeScanner from '../components/BarcodeScanner'; // <-- Importar el Lector
import Webcam from 'react-webcam';
import axios from 'axios';
import {
  User, ShieldCheck, Globe, Moon, Sun, Vote, Accessibility,
  Mail, Fingerprint, Camera, ChevronRight, AlertCircle, Loader2, Upload,
  Barcode, Check // <-- Iconos añadidos
} from 'lucide-react';

// Utilidad para convertir el base64 a Blob
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
  const [fingerprintPreview, setFingerprintPreview] = useState(null);
  const [fingerprintFile, setFingerprintFile] = useState(null);
  const [step, setStep] = useState(1);
  const [photoUrl, setPhotoUrl] = useState(null);

  // Estados para Código de Barras
  const [isBarcodeScannerOpen, setIsBarcodeScannerOpen] = useState(false);
  const [scannedDni, setScannedDni] = useState('');

  const { settings, toggleTheme } = useAccessibility();
  const [showAccessibility, setShowAccessibility] = useState(false);
  const webcamRef = useRef(null);

  const { t, i18n } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();

  // --- PASO 1: CREDENCIALES ---
  const handleStep1 = (e) => {
    e.preventDefault();
    setError('');
    if (!isAdminLogin) {
      if (identifier.length !== 8) {
        setError('El DNI debe tener 8 dígitos.');
        return;
      }
      setStep(2); // Ciudadano va a escanear código de barras
    } else {
      if (!identifier.includes('@')) {
        setError('Ingrese un correo válido.');
        return;
      }
      setStep(3); // Administrador salta directo a huella
    }
  };

  // --- PASO 2: CÓDIGO DE BARRAS (Solo Ciudadanos) ---
  const handleBarcodeScan = (decodedText) => {
    // Extraer 8 dígitos de la lectura (filtro de seguridad)
    const dniMatch = decodedText.match(/\d{8}/);
    const extractedDni = dniMatch ? dniMatch[0] : decodedText;

    setScannedDni(extractedDni);
    setIsBarcodeScannerOpen(false);

    if (extractedDni === identifier) {
      setError('');
    } else {
      setError(`DNI no coincide. Ingresó: ${identifier}, Escaneó: ${extractedDni}`);
    }
  };

  // --- PASO 3: HUELLA (MODO DEMO) ---
  const handleFingerprintFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFingerprintFile(file);
      setError('');
      const reader = new FileReader();
      reader.onloadend = () => {
        setFingerprintPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFingerprintAuth = async () => {
    setIsLoading(true);
    setError('');

    try {
      if (!fingerprintFile) {
        setError('Por favor, seleccione o capture una imagen de su huella.');
        setIsLoading(false);
        return;
      }

      const field = isAdminLogin ? 'email' : 'dni';
      const userRoute = isAdminLogin ? `by-email/${identifier}` : `by-dni/${identifier}`;
      
      // 1. Obtener el template de referencia del usuario
      const userRes = await axios.get(`http://localhost:80/api/usuarios/${userRoute}`);
      const referenceTemplate = userRes.data.data.fingerprint_template;

      if (!referenceTemplate) {
        setError('El usuario no tiene una huella registrada con el nuevo sistema.');
        setIsLoading(false);
        return;
      }

      // 2. Enviar imagen para verificación
      const fingerData = new FormData();
      fingerData.append('fingerprint_image', fingerprintFile);
      fingerData.append('reference_template', JSON.stringify(referenceTemplate));

      const verifyRes = await axios.post('http://localhost:80/api/biometrico/verify/fingerprint/minutiae', fingerData);

      if (verifyRes.data.verified) {
        setStep(4); // Avanzar a Rostro
      } else {
        setError(`Fallo de verificación: ${verifyRes.data.message} (Score: ${verifyRes.data.score.toFixed(1)})`);
      }
      setIsLoading(false);
    } catch (err) {
      setError('Error en huella dactilar: ' + (err.response?.data?.error || err.message));
      setIsLoading(false);
    }
  };

  // --- PASO 4: ROSTRO (AWS) + LOGIN FINAL ---
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

  const handleFinalLogin = async () => {
    setIsLoading(true);
    setError('');
    try {
      const userRoute = isAdminLogin ? `by-email/${identifier}` : `by-dni/${identifier}`;
      const userRes = await axios.get(`http://localhost:80/api/usuarios/${userRoute}`);
      const awsFaceId = userRes.data.data.aws_face_id;

      const faceBlob = base64ToBlob(photoUrl);
      const faceData = new FormData();
      faceData.append('face_photo', faceBlob, 'login.jpg');
      faceData.append('reference_face_id', awsFaceId);

      const awsRes = await axios.post('http://localhost:80/api/biometrico/verify/face', faceData);

      if (awsRes.data.verified) {
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

      <main className="animate-fade-in w-full transition-all duration-500"
        style={{ maxWidth: step === 1 ? '460px' : '640px' }}>

        <div className="flex flex-col items-center mb-8 text-center">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-white p-2.5 rounded-xl shadow-lg"><Vote size={32} className="text-blue-900" /></div>
            <h1 className="text-4xl font-black text-white tracking-tight">VoteSystem</h1>
          </div>
          <p className="text-white/80 font-bold uppercase text-xs tracking-widest">
            {isAdminLogin ? t('login.admin_portal') : t('login.citizen_portal')}
          </p>
        </div>

        {/* Stepper Dinámico */}
        {step > 1 && (
          <div className="flex items-center justify-center gap-3 mb-8">
            {!isAdminLogin && (
              <>
                <StepIcon active={step === 2} done={step > 2} icon={<Barcode size={18} />} label={t('vote.step_barcode')} />
                <div className={`h-0.5 w-6 ${step > 2 ? 'bg-green-500' : 'bg-white/20'}`} />
              </>
            )}
            <StepIcon active={step === 3} done={step > 3} icon={<Fingerprint size={18} />} label={t('vote.step_finger')} />
            <div className={`h-0.5 w-6 ${step > 3 ? 'bg-green-500' : 'bg-white/20'}`} />
            <StepIcon active={step === 4} done={false} icon={<Camera size={18} />} label={t('vote.step_face')} />
          </div>
        )}

        <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm flex items-center gap-3 font-medium">
              <AlertCircle size={18} className="shrink-0" /> {error}
            </div>
          )}

          {step === 1 && (
            <form onSubmit={handleStep1} className="flex flex-col gap-6">
              <div className="text-center">
                <h2 className="text-2xl font-black text-slate-800">{t('login.welcome')}</h2>
                <p className="text-slate-500 font-medium">{t('login.instruction')}</p>
              </div>
              <div className="space-y-3">
                <label className="block text-xs font-bold text-blue-900 uppercase tracking-wider mb-3">
                  {isAdminLogin ? t('login.email_label') : t('login.dni_label')}
                </label>
                <div className="relative">
                  {isAdminLogin ? <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} /> : <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />}
                  <input
                    name="identifier"
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:border-blue-500 outline-none font-bold"
                    value={identifier}
                    onChange={(e) => setIdentifier(isAdminLogin ? e.target.value : e.target.value.replace(/\D/g, ''))}
                    maxLength={isAdminLogin ? 100 : 8}
                    placeholder={isAdminLogin ? t('login.email_placeholder') : t('login.dni_placeholder')}
                    required
                  />
                </div>
              </div>

              <button type="submit" className="w-full py-4 bg-blue-900 text-white rounded-2xl font-black flex items-center justify-center gap-2">
                {t('login.continue')} <ChevronRight size={20} />
              </button>

              {!isAdminLogin && (
                <div className="flex items-start gap-3 p-4 bg-slate-50 border border-slate-100 rounded-2xl text-slate-500 text-xs font-medium leading-relaxed">
                  <div className="mt-0.5"><ShieldCheck size={16} className="text-blue-600/50" /></div>
                  <p>{t('login.prepare_instruction')}</p>
                </div>
              )}
            </form>
          )}

          {step === 2 && !isAdminLogin && (
            <div className="flex flex-col items-center gap-6 text-center animate-fade-in">
              <div>
                <h2 className="text-2xl font-black">{t('login.barcode_validation')}</h2>
                <p className="text-slate-500">{t('login.barcode_instruction')}</p>
              </div>
              <div className={`w-full py-10 border-2 border-dashed rounded-3xl flex flex-col items-center transition-colors duration-300 ${scannedDni && scannedDni === identifier ? 'bg-green-50 border-green-500' : 'bg-slate-50 border-slate-200'
                }`}>
                <Barcode size={60} className={`mb-4 transition-transform duration-500 ${scannedDni && scannedDni === identifier ? 'text-green-500 scale-110' : 'text-blue-900/30'}`} />

                <button onClick={() => setIsBarcodeScannerOpen(true)} className="px-8 py-3 bg-blue-900 text-white rounded-xl font-bold flex items-center gap-2">
                  <Camera size={18} /> {scannedDni ? t('login.barcode_rescan') : t('login.barcode_scan')}
                </button>

                {scannedDni && (
                  <div className={`mt-6 font-black text-sm flex items-center gap-2 ${scannedDni === identifier ? 'text-green-600 animate-bounce' : 'text-red-600'}`}>
                    {scannedDni === identifier ? <Check size={18} /> : <AlertCircle size={18} />}
                    {scannedDni === identifier ? `${t('login.dni_verified')}: ${scannedDni}` : t('login.dni_mismatch')}
                  </div>
                )}
              </div>
              <div className="flex gap-4 w-full">
                <button className="flex-1 py-4 border border-slate-200 rounded-2xl font-bold text-slate-500" onClick={() => setStep(1)}>{t('vote.back')}</button>
                <button className="flex-2 py-4 bg-blue-900 text-white rounded-2xl font-bold disabled:opacity-50" disabled={!scannedDni || scannedDni !== identifier} onClick={() => setStep(3)}>
                  {t('login.validate_fingerprint')} <ChevronRight size={18} className="inline" />
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col items-center gap-6 text-center animate-fade-in">
              <div>
                <h2 className="text-2xl font-black">{t('vote.finger_title')}</h2>
                <p className="text-slate-500">{t('vote.finger_desc')}</p>
              </div>
              <div className="w-full py-12 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50 flex flex-col items-center relative overflow-hidden">
                {isLoading ? (
                  <div className="flex flex-col items-center animate-pulse py-4">
                    <div className="relative w-24 h-24 mb-6">
                      <Fingerprint size={96} className="text-blue-900 absolute inset-0 opacity-20" />
                      <div className="absolute top-0 left-0 w-full h-1 bg-blue-900 shadow-[0_0_15px_#1e3a8a] animate-scan" />
                      <Fingerprint size={96} className="text-blue-900 absolute inset-0 animate-pulse" />
                    </div>
                    <p className="text-blue-900 font-black text-lg tracking-widest animate-bounce">
                      VALIDANDO HUELLA...
                    </p>
                    <p className="text-slate-400 text-[10px] mt-2 uppercase tracking-[0.3em]">
                      Comparando minucias ISO/IEC 19794-2
                    </p>
                  </div>
                ) : (
                  <>
                    <Fingerprint size={60} className={`text-blue-900/30 mb-4 ${fingerprintFile ? 'text-blue-900/60 animate-pulse' : ''}`} />
                    <input type="file" id="f-up-finger-login" accept="image/*" className="hidden" onChange={handleFingerprintFileChange} />
                    <label htmlFor="f-up-finger-login" className="px-8 py-3 bg-blue-900 text-white rounded-xl font-bold flex items-center gap-2 cursor-pointer mb-4 hover:scale-105 transition-transform active:scale-95 shadow-lg shadow-blue-900/20">
                      <Upload size={18} /> {fingerprintFile ? fingerprintFile.name : t('admin.select_file')}
                    </label>
                    <button 
                      onClick={handleFingerprintAuth} 
                      className={`px-8 py-3 border-2 border-blue-900 text-blue-900 rounded-xl font-bold flex items-center gap-2 transition-all ${!fingerprintFile ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-900 hover:text-white'}`} 
                      disabled={isLoading || !fingerprintFile}
                    >
                      {t('login.validate_fingerprint')}
                    </button>
                  </>
                )}
              </div>
              <div className="flex w-full">
                <button className="text-sm font-bold text-slate-400 mx-auto" onClick={() => setStep(isAdminLogin ? 1 : 2)}>{t('vote.back')}</button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="flex flex-col items-center gap-6 animate-fade-in">
              <div className="text-center">
                <h2 className="text-2xl font-black">{t('vote.face_title')}</h2>
                <p className="text-slate-500">{t('vote.face_desc')}</p>
              </div>
              <div className="w-full aspect-video rounded-3xl overflow-hidden bg-slate-900 relative border-4 border-slate-100 shadow-inner">
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
                      <Camera size={20} /> {t('vote.capture_photo')}
                    </button>
                    <input type="file" id="f-up" accept="image/*" onChange={handleFaceUpload} className="hidden" />
                    <label htmlFor="f-up" className="w-full py-3 border border-slate-200 text-slate-500 rounded-2xl font-bold flex items-center justify-center gap-2 cursor-pointer">
                      <Upload size={18} /> {t('admin.select_file')}
                    </label>
                  </>
                ) : (
                  <div className="flex gap-4">
                    <button onClick={() => setPhotoUrl(null)} className="flex-1 py-4 border border-slate-200 rounded-2xl font-bold text-slate-500">{t('vote.retry')}</button>
                    <button onClick={handleFinalLogin} className="flex-2 py-4 bg-green-600 text-white rounded-2xl font-bold" disabled={isLoading}>
                      {isLoading ? <Loader2 className="animate-spin" /> : t('vote.confirm_continue')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      <BarcodeScanner
        isOpen={isBarcodeScannerOpen}
        onClose={() => setIsBarcodeScannerOpen(false)}
        onScanSuccess={handleBarcodeScan}
      />
    </div>
  );
}

function StepIcon({ active, done, icon, label }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center border-2 transition-all duration-300 ${done ? 'bg-green-500 border-green-500 text-white shadow-lg shadow-green-500/20' : active ? 'bg-white border-blue-900 text-blue-900 scale-110 shadow-xl' : 'bg-white/10 border-white/20 text-white/50'}`}>
        {icon}
      </div>
      <span className="text-[10px] text-white font-black uppercase tracking-widest">{label}</span>
    </div>
  );
}