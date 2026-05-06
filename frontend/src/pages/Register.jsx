import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { UserPlus, User, Mail, CreditCard, ChevronLeft, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

export default function Register({ inDashboard = false }) {
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    dni: '',
    email: '',
    role_id: 2
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
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
      await axios.post('http://localhost/api/usuarios/', formData);
      setSuccess(true);
      if (!inDashboard) {
        setTimeout(() => navigate('/'), 2000);
      } else {
        setFormData({ first_name: '', last_name: '', dni: '', email: '', role_id: 2 });
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error al registrar el usuario');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`animate-fade-in ${inDashboard ? 'p-14 max-w-4xl mx-auto' : 'min-h-screen flex items-center justify-center p-6 bg-cover bg-center relative'}`}
      style={!inDashboard ? { backgroundImage: 'linear-gradient(rgba(15, 23, 42, 0.6), rgba(15, 23, 42, 0.6)), url(/bg_voting_geometric.png)' } : {}}>
      
      <div className={`w-full max-w-2xl ${inDashboard ? '' : 'flat-card !p-0 overflow-hidden shadow-2xl'}`}>
        
        {!inDashboard && (
          <div className="mb-10 text-center">
            <h1 className="text-4xl font-black text-white mb-2 tracking-tight">Registro Civil</h1>
            <p className="text-white/80 font-medium tracking-wide">Empadronamiento nacional de votantes</p>
          </div>
        )}

        <div className={`transition-all duration-500 ${inDashboard ? 'flat-card !p-10' : 'p-12'}`}>
          <div className="mb-10">
            <h2 className="text-2xl font-black text-text-main mb-1">
              {inDashboard ? 'Empadronar Nuevo Votante' : 'Crea tu Cuenta'}
            </h2>
            <p className="text-text-muted">Complete los datos oficiales del ciudadano</p>
          </div>

          {error && (
            <div className="animate-fade-in mb-8 p-4 rounded-xl bg-danger-rose/10 border border-danger-rose/20 text-danger-rose text-sm flex items-center gap-3">
              <AlertCircle size={18} /> {error}
            </div>
          )}

          {success && (
            <div className="animate-fade-in mb-8 p-4 rounded-xl bg-success-emerald/10 border border-success-emerald/20 text-success-emerald text-sm flex items-center gap-3 font-bold">
              <CheckCircle size={18} /> Registro completado exitosamente.
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-text-main px-1">Nombres</label>
                <div className="input-wrapper">
                  <User size={18} className="input-icon" />
                  <input name="first_name" type="text" className="glass-input" value={formData.first_name} onChange={handleChange} required placeholder="Juan" />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-text-main px-1">Apellidos</label>
                <div className="input-wrapper">
                  <User size={18} className="input-icon" />
                  <input name="last_name" type="text" className="glass-input" value={formData.last_name} onChange={handleChange} required placeholder="Pérez" />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-text-main px-1">Número de DNI</label>
              <div className="input-wrapper">
                <CreditCard size={18} className="input-icon" />
                <input name="dni" type="text" className="glass-input" maxLength={8} value={formData.dni} onChange={(e) => setFormData({...formData, dni: e.target.value.replace(/\D/g, '')})} required placeholder="8 dígitos" />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-bold text-text-main px-1">Correo Electrónico</label>
              <div className="input-wrapper">
                <Mail size={18} className="input-icon" />
                <input name="email" type="email" className="glass-input" value={formData.email} onChange={handleChange} required placeholder="ejemplo@correo.com" />
              </div>
            </div>

            <div className="flex gap-4 mt-4">
              {!inDashboard && (
                <Link to="/" className="glass-button secondary !w-auto px-8">
                  <ChevronLeft size={18} /> Volver
                </Link>
              )}
              <button type="submit" className="glass-button flex-1" disabled={isLoading || success}>
                {isLoading ? <Loader2 className="animate-spin" size={20} /> : <UserPlus size={18} />}
                {isLoading ? 'Registrando...' : inDashboard ? 'Empadronar Ciudadano' : 'Completar Registro'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
