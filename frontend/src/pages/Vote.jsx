import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Webcam from 'react-webcam';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { GlassCard } from '../components/GlassCard';
import { CandidateCard } from '../components/CandidateCard';
import { Camera, Fingerprint, CheckCircle, ChevronRight, Check } from 'lucide-react';

export default function Vote() {
  const { user, hasVoted } = useAuth();
  const navigate = useNavigate();
  const webcamRef = useRef(null);
  
  const [step, setStep] = useState(1);
  const [candidates, setCandidates] = useState([]);
  
  // Data states
  const [photoBlob, setPhotoBlob] = useState(null);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [fingerprintFile, setFingerprintFile] = useState(null);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (hasVoted) {
      navigate('/results');
    }
  }, [hasVoted, navigate]);

  useEffect(() => {
    // Fetch candidates
    const fetchCandidates = async () => {
      try {
        const res = await axios.get('http://localhost:5005/api/candidates/?active=true');
        setCandidates(res.data.data);
      } catch (err) {
        console.error("Failed to load candidates", err);
      }
    };
    fetchCandidates();
  }, []);

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current.getScreenshot();
    if (imageSrc) {
      setPhotoUrl(imageSrc);
      fetch(imageSrc)
        .then(res => res.blob())
        .then(blob => setPhotoBlob(blob));
    }
  }, [webcamRef]);

  const handleFingerprintUpload = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFingerprintFile(e.target.files[0]);
    }
  };

  const submitVote = async () => {
    if (!selectedCandidate) return;
    setError('');
    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('user_id', user.id);
      formData.append('candidate_id', selectedCandidate.id);
      // Mock data for reference photo and hash that the backend expects
      formData.append('reference_url', 'mock_url_placeholder');
      formData.append('stored_hash', 'valid_hash_placeholder'); 
      
      // The current captures
      formData.append('face_photo', photoBlob, 'face.jpg');
      formData.append('fingerprint_sample', fingerprintFile, 'fingerprint.bin');

      const res = await axios.post('http://localhost:5003/api/votos/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.status === 201) {
        navigate('/results', { state: { success: true } });
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error al emitir el voto. Intente nuevamente.');
      setIsSubmitting(false);
    }
  };

  if (hasVoted) return null; // Wait for redirect

  return (
    <div className="container animate-fade-in" style={{ padding: '2rem 0' }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h1 className="gradient-text">Emisión de Voto</h1>
        <p style={{ color: 'var(--text-muted)' }}>Votante: {user?.first_name} {user?.last_name}</p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <StepIndicator current={step} target={1} label="Foto" icon={<Camera size={16} />} />
          <div style={{ width: '40px', height: '2px', background: step > 1 ? 'var(--primary)' : 'var(--surface-border)' }} />
          <StepIndicator current={step} target={2} label="Huella" icon={<Fingerprint size={16} />} />
          <div style={{ width: '40px', height: '2px', background: step > 2 ? 'var(--primary)' : 'var(--surface-border)' }} />
          <StepIndicator current={step} target={3} label="Selección" icon={<CheckCircle size={16} />} />
        </div>
      </div>

      {error && (
        <div style={{ maxWidth: '600px', margin: '0 auto 1.5rem', padding: '1rem', backgroundColor: 'rgba(239, 68, 68, 0.2)', color: 'var(--danger)', borderRadius: '8px', textAlign: 'center' }}>
          {error}
        </div>
      )}

      {/* STEP 1: FACE PHOTO */}
      {step === 1 && (
        <GlassCard className="animate-fade-in" style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ marginBottom: '1.5rem' }}>1. Verificación Facial</h2>
          
          <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--surface-border)', marginBottom: '1.5rem', backgroundColor: '#000' }}>
            {!photoUrl ? (
              <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                videoConstraints={{ facingMode: "user" }}
                style={{ width: '100%', display: 'block' }}
              />
            ) : (
              <img src={photoUrl} alt="Captured" style={{ width: '100%', display: 'block' }} />
            )}
          </div>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            {!photoUrl ? (
              <button className="glass-button" onClick={capture}>
                <Camera size={20} /> Capturar Foto
              </button>
            ) : (
              <>
                <button className="glass-button secondary" onClick={() => setPhotoUrl(null)}>
                  Reintentar
                </button>
                <button className="glass-button" onClick={() => setStep(2)}>
                  Siguiente <ChevronRight size={20} />
                </button>
              </>
            )}
          </div>
        </GlassCard>
      )}

      {/* STEP 2: FINGERPRINT */}
      {step === 2 && (
        <GlassCard className="animate-fade-in" style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ marginBottom: '1.5rem' }}>2. Verificación Dactilar</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
            Por favor, coloque su dedo en el escáner (simulado adjuntando un archivo).
          </p>

          <div style={{ 
            padding: '3rem 2rem', 
            border: '2px dashed var(--surface-border)', 
            borderRadius: '12px',
            marginBottom: '2rem',
            backgroundColor: fingerprintFile ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
            borderColor: fingerprintFile ? 'var(--success)' : 'var(--surface-border)',
            transition: 'all 0.3s'
          }}>
            <Fingerprint size={64} color={fingerprintFile ? 'var(--success)' : 'var(--text-muted)'} style={{ marginBottom: '1rem' }} />
            
            <input 
              type="file" 
              id="fingerprint-upload" 
              onChange={handleFingerprintUpload} 
              style={{ display: 'none' }} 
            />
            
            <label htmlFor="fingerprint-upload" className="glass-button secondary" style={{ cursor: 'pointer' }}>
              {fingerprintFile ? 'Cambiar Archivo' : 'Simular Escáner (Subir archivo)'}
            </label>
            
            {fingerprintFile && (
              <p style={{ marginTop: '1rem', color: 'var(--success)', fontWeight: 'bold' }}>
                <Check size={16} style={{ verticalAlign: 'middle', marginRight: '4px' }}/>
                Huella capturada ({fingerprintFile.name})
              </p>
            )}
          </div>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button className="glass-button secondary" onClick={() => setStep(1)}>
              Atrás
            </button>
            <button className="glass-button" onClick={() => setStep(3)} disabled={!fingerprintFile}>
              Siguiente <ChevronRight size={20} />
            </button>
          </div>
        </GlassCard>
      )}

      {/* STEP 3: CANDIDATE SELECTION */}
      {step === 3 && (
        <div className="animate-fade-in" style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <h2 style={{ textAlign: 'center', marginBottom: '2rem' }}>3. Seleccione a su Candidato</h2>
          
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', 
            gap: '1.5rem',
            marginBottom: '3rem' 
          }}>
            {candidates.map(c => (
              <CandidateCard 
                key={c.id} 
                candidate={c} 
                isSelected={selectedCandidate?.id === c.id}
                onSelect={setSelectedCandidate}
              />
            ))}
          </div>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button className="glass-button secondary" onClick={() => setStep(2)}>
              Atrás
            </button>
            <button 
              className="glass-button" 
              onClick={submitVote} 
              disabled={!selectedCandidate || isSubmitting}
              style={{ padding: '12px 32px', backgroundColor: selectedCandidate ? 'var(--success)' : '' }}
            >
              <CheckCircle size={20} />
              {isSubmitting ? 'Procesando...' : 'Confirmar Voto'}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

// Subcomponent for Step Indicator
function StepIndicator({ current, target, label, icon }) {
  const isPast = current > target;
  const isCurrent = current === target;
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
      <div style={{ 
        width: '36px', height: '36px', 
        borderRadius: '50%', 
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: isPast ? 'var(--success)' : isCurrent ? 'var(--primary)' : 'var(--surface-hover)',
        color: isPast || isCurrent ? 'white' : 'var(--text-muted)',
        border: `2px solid ${isCurrent ? 'var(--primary)' : 'transparent'}`,
        transition: 'all 0.3s ease'
      }}>
        {icon}
      </div>
      <span style={{ 
        fontSize: '0.85rem', 
        fontWeight: isCurrent ? 'bold' : 'normal',
        color: isCurrent ? 'var(--text-main)' : 'var(--text-muted)' 
      }}>
        {label}
      </span>
    </div>
  );
}
