import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { GlassCard } from '../components/GlassCard';
import { LogIn } from 'lucide-react';

export default function Login() {
  const [dni, setDni] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (dni.length !== 8) {
      setError('El DNI debe tener exactamente 8 dígitos.');
      setIsLoading(false);
      return;
    }

    const result = await login(dni);
    if (result.success) {
      navigate('/vote');
    } else {
      setError(result.error);
    }
    setIsLoading(false);
  };

  return (
    <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
      <div className="animate-fade-in" style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 className="gradient-text" style={{ fontSize: '2.5rem' }}>VoteSystem</h1>
          <p style={{ color: 'var(--text-muted)' }}>Plataforma Electoral Segura</p>
        </div>

        <GlassCard>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h2 style={{ textAlign: 'center', marginBottom: '1rem' }}>Iniciar Sesión</h2>
            
            {error && (
              <div style={{ padding: '10px', backgroundColor: 'rgba(239, 68, 68, 0.2)', color: 'var(--danger)', borderRadius: '8px', fontSize: '0.9rem', textAlign: 'center' }}>
                {error}
              </div>
            )}

            <div>
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>
                Documento de Identidad (DNI)
              </label>
              <input 
                type="text" 
                className="glass-input" 
                placeholder="12345678"
                value={dni}
                onChange={(e) => setDni(e.target.value.replace(/\D/g, ''))}
                maxLength={8}
                required
              />
            </div>

            <button type="submit" className="glass-button" disabled={isLoading} style={{ marginTop: '1rem' }}>
              <LogIn size={20} />
              {isLoading ? 'Verificando...' : 'Ingresar'}
            </button>
          </form>
          
          <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.9rem' }}>
            <p style={{ color: 'var(--text-muted)' }}>
              ¿No estás registrado? <Link to="/register" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 'bold' }}>Regístrate aquí</Link>
            </p>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
