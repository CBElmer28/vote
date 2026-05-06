import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { GlassCard } from '../components/GlassCard';
import { UserPlus } from 'lucide-react';

export default function Register({ inDashboard = false }) {
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    dni: '',
    email: '',
    role_id: 2
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await axios.post('http://localhost:5001/api/usuarios/', formData);
      navigate('/', { state: { message: 'Registro exitoso. Ahora puedes iniciar sesión.' } });
    } catch (err) {
      setError(err.response?.data?.error || 'Error al registrar el usuario');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      width: inDashboard ? '100%' : '100vw',
      minHeight: inDashboard ? '100%' : '100vh',
      backgroundImage: inDashboard ? 'none' : 'url(/bg_voting_geometric.png)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundAttachment: 'fixed',
      position: inDashboard ? 'relative' : 'absolute',
      top: 0,
      left: 0,
      zIndex: 0,
      padding: inDashboard ? '2rem' : 0
    }}>
      {/* Overlay for blur and dimming */}
      {!inDashboard && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backdropFilter: 'blur(8px)',
          backgroundColor: 'rgba(255,255,255,0.4)',
          zIndex: 1
        }} />
      )}

      <div className="animate-fade-in" style={{ width: '100%', maxWidth: '500px', position: 'relative', zIndex: 2, padding: inDashboard ? 0 : '2rem' }}>
        <GlassCard>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h2 style={{ textAlign: 'center', marginBottom: '1rem' }}>Registro de Votante</h2>
            
            {error && (
              <div style={{ padding: '10px', backgroundColor: 'rgba(239, 68, 68, 0.2)', color: 'var(--danger)', borderRadius: '8px', fontSize: '0.9rem', textAlign: 'center' }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: '1rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>Nombres</label>
                <input name="first_name" type="text" className="glass-input" value={formData.first_name} onChange={handleChange} required />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>Apellidos</label>
                <input name="last_name" type="text" className="glass-input" value={formData.last_name} onChange={handleChange} required />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>DNI (8 dígitos)</label>
              <input name="dni" type="text" className="glass-input" maxLength={8} value={formData.dni} onChange={(e) => setFormData({...formData, dni: e.target.value.replace(/\D/g, '')})} required />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)' }}>Correo Electrónico</label>
              <input name="email" type="email" className="glass-input" value={formData.email} onChange={handleChange} required />
            </div>

            <button type="submit" className="glass-button" disabled={isLoading} style={{ marginTop: '1rem' }}>
              <UserPlus size={20} />
              {isLoading ? 'Registrando...' : 'Completar Registro'}
            </button>
          </form>

          {!inDashboard && (
            <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.9rem' }}>
              <p style={{ color: 'var(--text-muted)' }}>
                ¿Ya tienes cuenta? <Link to="/" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 'bold' }}>Inicia sesión aquí</Link>
              </p>
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
