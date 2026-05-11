import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { CandidateCard } from '../components/CandidateCard';
import { CheckCircle, AlertCircle, User, Loader2, Accessibility, Moon, Sun } from 'lucide-react';
import { useAccessibility } from '../context/AccessibilityContext';

export default function Vote() {
  const { user, hasVoted } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [candidates, setCandidates] = useState([]);
  const [selectedCandidate, setSelectedCandidate] = useState(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const { settings, toggleTheme } = useAccessibility();

  // Redirigir si el usuario ya votó
  useEffect(() => {
    if (hasVoted) navigate('/results');
  }, [hasVoted, navigate]);

  // Cargar candidatos activos
  useEffect(() => {
    const fetchCandidates = async () => {
      try {
        const res = await axios.get('http://localhost/api/candidatos/?active=true');
        setCandidates(res.data.data);
      } catch (err) {
        console.error("Failed to load candidates", err);
      }
    };
    fetchCandidates();
  }, []);

  const submitVote = async () => {
    if (!selectedCandidate) return;
    setError('');
    setIsSubmitting(true);

    try {
      // El payload ahora es un JSON limpio y anónimo, sin archivos biométricos.
      // La identidad se valida mediante el token JWT en las cabeceras (configurado en AuthContext).
      const payload = {
        user_id: user.id,
        candidate_id: selectedCandidate.id
      };

      const res = await axios.post('http://localhost/api/votacion/', payload);

      if (res.status === 201 || res.status === 200) {
        navigate('/results', { state: { success: true } });
      }
    } catch (err) {
      setError(err.response?.data?.error || t('login.err_vote'));
      setIsSubmitting(false);
    }
  };

  if (hasVoted) return null;

  return (
    <div className="min-h-screen bg-bg-main p-8 lg:p-14">
      <div className="max-w-7xl mx-auto w-full">

        {/* Header Area */}
        <div className="text-center mb-10">
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

        {error && (
          <div className="animate-fade-in max-w-2xl mx-auto mb-8 p-4 rounded-xl bg-danger-rose/10 border border-danger-rose/20 text-danger-rose text-sm flex items-center gap-3">
            <AlertCircle size={20} /> {error}
          </div>
        )}

        {/* CANDIDATE SELECTION (Ahora es la vista principal) */}
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

          <div className="flex items-center justify-center pt-10 border-t border-surface-border">
            <button
              className={`glass-button !w-auto px-16 py-4 transition-all duration-500 shadow-xl ${selectedCandidate ? '!bg-success-emerald !from-success-emerald !to-emerald-600 scale-105 ring-4 ring-success-emerald/20' : 'opacity-50'
                }`}
              onClick={submitVote}
              disabled={!selectedCandidate || isSubmitting}
            >
              {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : (selectedCandidate ? t('vote.confirm_vote') : t('vote.select_a_candidate'))}
              {!isSubmitting && <CheckCircle size={20} className={selectedCandidate ? 'animate-pulse' : ''} />}
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}