import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Webcam from 'react-webcam';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { CandidateCard } from '../components/CandidateCard';
import { Camera, Fingerprint, CheckCircle, ChevronRight, Check, AlertCircle, User, Loader2, Accessibility, Moon, Sun } from 'lucide-react';
import { useAccessibility } from '../context/AccessibilityContext';
import AccessibilityMenu from '../components/AccessibilityMenu';

export default function Vote() {
  const { user, hasVoted } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const webcamRef = useRef(null);
  
  const [step, setStep] = useState(1);
  const [candidates, setCandidates] = useState([]);
  
  const [photoBlob, setPhotoBlob] = useState(null);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [fingerprintFile, setFingerprintFile] = useState(null);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const { settings, toggleTheme } = useAccessibility();
  const [showAccessibility, setShowAccessibility] = useState(false);

  useEffect(() => {
    if (hasVoted) navigate('/results');
  }, [hasVoted, navigate]);

  useEffect(() => {
    const fetchCandidates = async () => {
      try {
        const res = await axios.get('http://localhost/api/candidatos/?active=true');
        setCandidates(res.data.data);
      } catch (err) { console.error("Failed to load candidates", err); }
    };
    fetchCandidates();
  }, []);

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current.getScreenshot();
    if (imageSrc) {
      setPhotoUrl(imageSrc);
      fetch(imageSrc).then(res => res.blob()).then(blob => setPhotoBlob(blob));
    }
  }, [webcamRef]);

  const handleFingerprintUpload = (e) => {
    if (e.target.files && e.target.files[0]) setFingerprintFile(e.target.files[0]);
  };

  const submitVote = async () => {
    if (!selectedCandidate) return;
    setError('');
    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('user_id', user.id);
      formData.append('candidate_id', selectedCandidate.id);
      formData.append('reference_url', 'mock_url_placeholder');
      formData.append('stored_hash', 'valid_hash_placeholder'); 
      formData.append('face_photo', photoBlob, 'face.jpg');
      formData.append('fingerprint_sample', fingerprintFile, 'fingerprint.bin');

      const res = await axios.post('http://localhost/api/votacion/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.status === 201) navigate('/results', { state: { success: true } });
    } catch (err) {
      setError(err.response?.data?.error || 'Error al emitir el voto. Intente nuevamente.');
      setIsSubmitting(false);
    }
  };

  if (hasVoted) return null;

  return (
    <div className="min-h-screen bg-bg-main p-8 lg:p-14">
      <div className="max-w-7xl mx-auto w-full">
        
        {/* Header Area */}
        <div className="text-center mb-14">
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="bg-primary-navy text-white p-2.5 rounded-xl shadow-lg">
              <CheckCircle size={28} />
            </div>
            <h1 className="text-4xl font-black text-text-main m-0 tracking-tight">{t('vote.title')}</h1>
          </div>
          <div className="flex items-center justify-center gap-2 text-text-muted font-bold text-sm uppercase tracking-wider">
            <User size={16} />
            <span>{t('vote.citizen')} {user?.first_name} {user?.last_name}</span>
          </div>
        </div>

        {/* Progress Stepper */}
        <div className="flex items-center justify-center gap-4 mb-16">
          <StepIcon active={step === 1} done={step > 1} icon={<Camera size={20} />} label={t('vote.step_face')} />
          <div className={`h-0.5 w-16 transition-colors duration-500 ${step > 1 ? 'bg-success-emerald' : 'bg-surface-border'}`} />
          <StepIcon active={step === 2} done={step > 2} icon={<Fingerprint size={20} />} label={t('vote.step_finger')} />
          <div className={`h-0.5 w-16 transition-colors duration-500 ${step > 2 ? 'bg-success-emerald' : 'bg-surface-border'}`} />
          <StepIcon active={step === 3} done={false} icon={<CheckCircle size={20} />} label={t('vote.step_vote')} />
        </div>

        {error && (
          <div className="animate-fade-in max-w-2xl mx-auto mb-8 p-4 rounded-xl bg-danger-rose/10 border border-danger-rose/20 text-danger-rose text-sm flex items-center gap-3">
            <AlertCircle size={20} /> {error}
          </div>
        )}

        {/* STEP 1: FACE PHOTO */}
        {step === 1 && (
          <div className="animate-fade-in flat-card max-w-2xl mx-auto text-center !p-10">
            <div className="mb-8">
              <h2 className="text-2xl font-black text-text-main mb-1">{t('vote.face_title')}</h2>
              <p className="text-text-muted">{t('vote.face_desc')}</p>
            </div>
            
            <div className="w-full aspect-video rounded-3xl overflow-hidden border-4 border-surface-border mb-10 bg-slate-900 shadow-2xl relative">
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
              {!photoUrl && <div className="absolute inset-8 border-4 border-dashed border-white/20 rounded-full pointer-events-none animate-[spin_10s_linear_infinite]" />}
              <div className="absolute inset-0 bg-linear-to-b from-transparent via-transparent to-black/40 pointer-events-none" />
            </div>

            <div className="flex justify-center gap-4">
              {!photoUrl ? (
                <button className="glass-button !w-auto px-10" onClick={capture}>
                  <Camera size={20} /> {t('vote.capture_photo')}
                </button>
              ) : (
                <>
                  <button className="glass-button secondary !w-auto px-8" onClick={() => setPhotoUrl(null)}>
                    {t('vote.retry')}
                  </button>
                  <button className="glass-button !w-auto px-10" onClick={() => setStep(2)}>
                    {t('vote.confirm_continue')} <ChevronRight size={20} />
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* STEP 2: FINGERPRINT */}
        {step === 2 && (
          <div className="animate-fade-in flat-card max-w-2xl mx-auto text-center !p-10">
            <div className="mb-8">
              <h2 className="text-2xl font-black text-text-main mb-1">{t('vote.finger_title')}</h2>
              <p className="text-text-muted">{t('vote.finger_desc')}</p>
            </div>

            <div className={`flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-3xl mb-10 transition-all duration-300 ${
              fingerprintFile ? 'bg-success-emerald/5 border-success-emerald' : 'bg-bg-main border-surface-border'
            }`}>
              <Fingerprint 
                size={80} 
                className={`transition-all duration-500 mb-6 ${fingerprintFile ? 'text-success-emerald scale-110' : 'text-primary-navy/30'}`} 
              />
              
              <input type="file" id="fingerprint-upload" onChange={handleFingerprintUpload} className="hidden" />
              <label htmlFor="fingerprint-upload" className="glass-button secondary !w-auto cursor-pointer px-8 py-2.5">
                {fingerprintFile ? t('vote.finger_registered') : t('vote.scan_finger')}
              </label>
              
              {fingerprintFile && (
                <div className="mt-6 text-success-emerald font-black text-sm flex items-center gap-2 animate-bounce">
                  <Check size={18} /> {t('vote.valid_sample')} {fingerprintFile.name}
                </div>
              )}
            </div>

            <div className="flex justify-center gap-4">
              <button className="glass-button secondary !w-auto px-8" onClick={() => setStep(1)}>{t('vote.back')}</button>
              <button className="glass-button !w-auto px-10" onClick={() => setStep(3)} disabled={!fingerprintFile}>
                {t('vote.continue_vote')} <ChevronRight size={20} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: CANDIDATE SELECTION */}
        {step === 3 && (
          <div className="animate-fade-in">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-black text-text-main mb-1 tracking-tight">{t('vote.select_candidate_title')}</h2>
              <p className="text-text-muted">{t('vote.select_candidate_desc')}</p>
            </div>
            
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-14">
              {candidates.map(c => (
                <CandidateCard 
                  key={c.id} 
                  candidate={c} 
                  isSelected={selectedCandidate?.id === c.id}
                  onSelect={setSelectedCandidate}
                />
              ))}
            </div>

            <div className="flex items-center justify-center gap-6 pt-10 border-t border-surface-border">
              <button className="glass-button secondary !w-auto px-12 py-3.5" onClick={() => setStep(2)}>
                {t('vote.back')}
              </button>
              <button 
                className={`glass-button !w-auto px-16 py-3.5 transition-all duration-500 shadow-xl ${
                  selectedCandidate ? '!bg-success-emerald !from-success-emerald !to-emerald-600 scale-105 ring-4 ring-success-emerald/20' : ''
                }`}
                onClick={submitVote} 
                disabled={!selectedCandidate || isSubmitting}
              >
                {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : (selectedCandidate ? t('vote.confirm_vote') : t('vote.select_a_candidate'))}
                {!isSubmitting && <CheckCircle size={20} className={selectedCandidate ? 'animate-pulse' : ''} />}
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Floating Controls */}
      <div className="fixed top-8 right-8 flex flex-col gap-3 z-50">
        <button 
          onClick={() => setShowAccessibility(true)} 
          className="w-12 h-12 bg-surface border border-surface-border text-text-main rounded-2xl shadow-xl hover:bg-bg-main transition-all flex items-center justify-center"
          title="Accesibilidad"
        >
          <Accessibility size={24} />
        </button>
        <button 
          onClick={toggleTheme} 
          className="w-12 h-12 bg-surface border border-surface-border text-text-main rounded-2xl shadow-xl hover:bg-bg-main transition-all flex items-center justify-center"
        >
          {settings.theme === 'light' ? <Moon size={24} /> : <Sun size={24} />}
        </button>
      </div>

      <AccessibilityMenu isOpen={showAccessibility} onClose={() => setShowAccessibility(false)} />
    </div>
  );
}

function StepIcon({ active, done, icon, label }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 border-2 ${
        done 
          ? 'bg-success-emerald border-success-emerald text-white shadow-lg shadow-success-emerald/20' 
          : active 
            ? 'bg-primary-navy border-primary-navy text-white shadow-xl shadow-primary-navy/20 scale-110' 
            : 'bg-surface border-surface-border text-text-muted shadow-sm'
      }`}>
        {icon}
      </div>
      <span className={`text-[11px] font-black uppercase tracking-widest transition-colors duration-300 ${active ? 'text-primary-navy' : 'text-text-muted'}`}>
        {label}
      </span>
    </div>
  );
}
