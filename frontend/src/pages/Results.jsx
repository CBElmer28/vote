import { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import axios from 'axios';
import { GlassCard } from '../components/GlassCard';
import { BarChart3, LogOut, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Results() {
  const [data, setData] = useState(null);
  const [charts, setCharts] = useState({ bar: null, pie: null });
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const { logout, user } = useAuth();

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const sumRes = await axios.get('http://localhost:5004/api/analisis/summary');
        setData(sumRes.data.data);

        const barRes = await axios.get('http://localhost:5004/api/analisis/charts/bar');
        const pieRes = await axios.get('http://localhost:5004/api/analisis/charts/pie');
        
        setCharts({
          bar: barRes.data.image_base64,
          pie: pieRes.data.image_base64
        });
      } catch (err) {
        console.error("Failed to load results", err);
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
    // Auto-refresh every 10 seconds
    const interval = setInterval(fetchResults, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="container animate-fade-in" style={{ padding: '2rem 0' }}>
      
      {/* Header and Status */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 className="gradient-text" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <BarChart3 /> Resultados en Tiempo Real
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>Actualización automática cada 10s</p>
        </div>
        
        {user && (
          <button className="glass-button secondary" onClick={logout}>
            <LogOut size={18} /> Salir
          </button>
        )}
      </div>

      {location.state?.success && (
        <div style={{ 
          marginBottom: '2rem', 
          padding: '1rem', 
          backgroundColor: 'rgba(16, 185, 129, 0.2)', 
          color: 'var(--success)', 
          borderRadius: '8px', 
          textAlign: 'center',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          fontWeight: 'bold'
        }}>
          <CheckCircle /> ¡Su voto ha sido registrado exitosamente!
        </div>
      )}

      {loading && !data ? (
        <div style={{ textAlign: 'center', padding: '4rem' }}>
          <h3>Cargando estadísticas...</h3>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Top KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
            <GlassCard style={{ textAlign: 'center' }}>
              <h3 style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>Votos Totales Emitidos</h3>
              <div style={{ fontSize: '3rem', fontWeight: 'bold', color: 'var(--primary)', marginTop: '0.5rem' }}>
                {data?.total_votes}
              </div>
            </GlassCard>

            <GlassCard style={{ textAlign: 'center' }}>
              <h3 style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>Precisión Facial Promedio</h3>
              <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--success)', marginTop: '0.5rem' }}>
                {data?.biometric_audit?.avg_face_confidence ? (data.biometric_audit.avg_face_confidence * 100).toFixed(1) : 0}%
              </div>
            </GlassCard>
            
            <GlassCard style={{ textAlign: 'center' }}>
              <h3 style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>Precisión Dactilar Promedio</h3>
              <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--success)', marginTop: '0.5rem' }}>
                {data?.biometric_audit?.avg_fingerprint_confidence ? (data.biometric_audit.avg_fingerprint_confidence * 100).toFixed(1) : 0}%
              </div>
            </GlassCard>
          </div>

          {/* Charts */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <GlassCard>
              <h3 style={{ marginBottom: '1rem', textAlign: 'center' }}>Distribución de Votos</h3>
              {charts.bar ? (
                <img 
                  src={`data:image/png;base64,${charts.bar}`} 
                  alt="Bar Chart" 
                  className="chart-image"
                  style={{ width: '100%', borderRadius: '8px' }} 
                />
              ) : (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No hay datos suficientes</p>
              )}
            </GlassCard>

            <GlassCard>
              <h3 style={{ marginBottom: '1rem', textAlign: 'center' }}>Porcentaje por Candidato</h3>
              {charts.pie ? (
                <img 
                  src={`data:image/png;base64,${charts.pie}`} 
                  alt="Pie Chart" 
                  className="chart-image"
                  style={{ width: '100%', borderRadius: '8px' }} 
                />
              ) : (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No hay datos suficientes</p>
              )}
            </GlassCard>
          </div>

        </div>
      )}
    </div>
  );
}
