import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import Register from './Register';
import { Users, LogOut, FileText } from 'lucide-react';

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('voters');

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-color)' }}>
      {/* Sidebar */}
      <div style={{
        width: '250px',
        backgroundColor: 'var(--surface)',
        borderRight: '1px solid var(--surface-border)',
        padding: '2rem 1rem',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
          <h2 className="gradient-text">Admin Portal</h2>
          <div style={{ marginTop: '0.5rem', padding: '0.5rem', backgroundColor: 'var(--primary-glow)', borderRadius: '8px' }}>
            <p style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 700 }}>
              {user?.first_name} {user?.last_name}
            </p>
          </div>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
          <button 
            onClick={() => setActiveTab('voters')}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.75rem 1rem',
              backgroundColor: activeTab === 'voters' ? 'rgba(30, 58, 138, 0.1)' : 'transparent',
              color: activeTab === 'voters' ? 'var(--primary)' : 'var(--text-muted)',
              border: activeTab === 'voters' ? '1px solid var(--surface-border)' : '1px solid transparent', 
              borderRadius: '8px', cursor: 'pointer',
              fontWeight: activeTab === 'voters' ? 700 : 500, transition: 'all 0.2s'
            }}
          >
            <Users size={18} /> Empadronar Votante
          </button>
          
          <button 
            onClick={() => setActiveTab('candidates')}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.75rem 1rem',
              backgroundColor: activeTab === 'candidates' ? 'rgba(30, 58, 138, 0.1)' : 'transparent',
              color: activeTab === 'candidates' ? 'var(--primary)' : 'var(--text-muted)',
              border: activeTab === 'candidates' ? '1px solid var(--surface-border)' : '1px solid transparent',
              borderRadius: '8px', cursor: 'pointer',
              fontWeight: activeTab === 'candidates' ? 700 : 500, transition: 'all 0.2s'
            }}
          >
            <FileText size={18} /> Gestión de Candidatos
          </button>
        </nav>

        <button 
          onClick={logout}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.75rem 1rem',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            color: 'var(--danger)',
            border: '1px solid rgba(239, 68, 68, 0.2)', 
            borderRadius: '8px', cursor: 'pointer',
            fontWeight: 600
          }}
        >
          <LogOut size={18} /> Cerrar Sesión
        </button>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, position: 'relative', overflowY: 'auto' }}>
        {activeTab === 'voters' && (
          <div style={{ position: 'relative', minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* We render Register directly, but Register has a fixed absolute full-screen background right now!
                We need to pass a prop to Register so it knows it's inside the dashboard, or we can just render the form inside the GlassCard without the absolute background. */}
            <Register inDashboard={true} />
          </div>
        )}

        {activeTab === 'candidates' && (
          <div style={{ padding: '3rem', maxWidth: '800px', margin: '0 auto' }}>
            <h2>Gestión de Candidatos</h2>
            <p style={{ color: 'var(--text-muted)' }}>Módulo en desarrollo para crear/editar candidatos consumiendo MS5.</p>
            {/* The candidate CRUD form would go here. For the scope of this MVP step, we just show a placeholder or we can quickly build a candidate form. */}
          </div>
        )}
      </div>
    </div>
  );
}
