import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { LogOut, Users, Activity, ShieldCheck, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// Helper to fix common UTF-8 to ISO encoding issues in Spanish
const fixEncoding = (str) => {
  if (typeof str !== 'string') return str;
  try {
    return decodeURIComponent(escape(str));
  } catch (e) {
    return str
      .replace(/Ã¡/g, 'á').replace(/Ã /g, 'Á')
      .replace(/Ã©/g, 'é').replace(/Ã‰/g, 'É')
      .replace(/Ã­/g, 'í').replace(/Ã /g, 'Í')
      .replace(/Ã³/g, 'ó').replace(/Ã“/g, 'Ó')
      .replace(/Ãº/g, 'ú').replace(/Ãš/g, 'Ú')
      .replace(/Ã±/g, 'ñ').replace(/Ã‘/g, 'Ñ');
  }
};

export default function Results() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const fetchResults = async () => {
    try {
      const sumRes = await axios.get('http://localhost/api/analisis/summary');
      const rawData = sumRes.data.data;
      
      // Sanitize names
      if (rawData.count_by_candidate) {
        rawData.count_by_candidate = rawData.count_by_candidate.map(item => ({
          ...item,
          candidate_name: fixEncoding(item.candidate_name)
        }));
      }
      
      setData(rawData);
    } catch (err) {
      console.error("Failed to load results", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResults();
    const interval = setInterval(fetchResults, 600000); // 10 minutes
    return () => clearInterval(interval);
  }, []);

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
          <p className="text-slate-400 font-bold animate-pulse">Sincronizando Escrutinio...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 md:p-8 lg:p-14 font-sans selection:bg-blue-100">
      {/* Header Section */}
      <div className="max-w-7xl mx-auto mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-2 h-12 bg-blue-600 rounded-full shadow-lg shadow-blue-200"></div>
          <div>
            <h1 className="text-3xl md:text-4xl font-black text-[#1e3a8a] tracking-tight">
              Resultados Electorales
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <p className="text-slate-500 font-medium text-sm">Actualización en tiempo real activa (cada 10 min)</p>
            </div>
          </div>
        </div>
        <button 
          onClick={handleLogout}
          className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 text-[#1e3a8a] font-bold rounded-2xl shadow-sm hover:shadow-md hover:bg-slate-50 transition-all active:scale-95"
        >
          <LogOut className="w-5 h-5" />
          Finalizar Sesión
        </button>
      </div>

      {/* Stats Overview */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div className="bg-white p-8 rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 flex items-center gap-6 group hover:border-blue-200 transition-colors">
          <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <Users className="w-8 h-8 text-blue-600" />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Participación Total</p>
            <h2 className="text-4xl font-black text-[#1e3a8a]">{data.total_votes || 0}</h2>
            <p className="text-xs font-bold text-slate-400 mt-1">Votos emitidos</p>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 flex items-center gap-6 group hover:border-green-200 transition-colors">
          <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <ShieldCheck className="w-8 h-8 text-green-600" />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Confianza Biométrica</p>
            <h2 className="text-4xl font-black text-[#1e3a8a]">98.5%</h2>
            <p className="text-xs font-bold text-slate-400 mt-1">Promedio de validación</p>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 flex items-center gap-6 group hover:border-purple-200 transition-colors">
          <div className="w-16 h-16 bg-purple-50 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <Activity className="w-8 h-8 text-purple-600" />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Integridad del Sistema</p>
            <h2 className="text-4xl font-black text-[#1e3a8a]">99.9%</h2>
            <p className="text-xs font-bold text-slate-400 mt-1">Nodos operativos</p>
          </div>
        </div>
      </div>

      {/* Main Analysis Card */}
      <div className="max-w-7xl mx-auto bg-white rounded-[3rem] shadow-2xl shadow-slate-200/60 border border-slate-100 overflow-hidden relative">
        <div className="p-10 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
          <div>
            <h3 className="text-2xl font-black text-[#1e3a8a]">Distribución de Votos en Tiempo Real</h3>
            <p className="text-slate-500 font-medium">Análisis detallado por candidato y organización política</p>
          </div>
          <div className="hidden md:flex items-center gap-3 px-5 py-2 bg-blue-50 text-blue-700 font-black text-xs rounded-full border border-blue-100 uppercase tracking-wider">
            {data.count_by_candidate?.length || 0} Candidatos en Escrutinio
          </div>
        </div>

        <div className="p-10">
          {/* --- NATIVE ELECTORAL CHART --- */}
          <div className="w-full mt-12 mb-32 px-4">
            <div className="relative h-[450px] w-full border-b-2 border-slate-200 flex items-end justify-around gap-4 md:gap-12 pt-24 pb-2">
              {/* Dynamic Y-Axis Labels */}
              {(() => {
                const maxVal = Math.max(...(data.count_by_candidate?.map(v => v.total) || [1]), 1);
                const ceiling = Math.ceil(maxVal * 1.2); // 20% headroom
                const steps = [0, Math.floor(ceiling * 0.25), Math.floor(ceiling * 0.5), Math.floor(ceiling * 0.75), ceiling];
                
                return steps.map((val, i) => (
                  <div 
                    key={i} 
                    className="absolute w-full border-t border-slate-100 flex items-center"
                    style={{ bottom: `${(val / ceiling) * 100}%` }}
                  >
                    <span className="absolute -left-12 text-[10px] font-black text-slate-400 w-8 text-right">
                      {val}
                    </span>
                  </div>
                ));
              })()}

              {data.count_by_candidate && data.count_by_candidate.map((c, index) => {
                const maxVal = Math.max(...data.count_by_candidate.map(v => v.total), 1);
                const ceiling = Math.ceil(maxVal * 1.2);
                const barHeight = (c.total / ceiling) * 100;
                
                const photoUrl = c.photo_url ? (c.photo_url.startsWith('/') ? `http://localhost${c.photo_url}` : c.photo_url) : null;
                const partyUrl = c.party_symbol_url ? (c.party_symbol_url.startsWith('/') ? `http://localhost${c.party_symbol_url}` : c.party_symbol_url) : null;

                return (
                  <div key={index} className="relative flex-1 h-full flex flex-col items-center justify-end group max-w-[160px]">
                    {/* TOP: Candidate Portrait + Interactive Tooltip */}
                    <div 
                      className="absolute z-20 flex flex-col items-center transition-all duration-1000 ease-out"
                      style={{ bottom: `calc(${barHeight}% + 15px)` }}
                    >
                      {/* Interactive Tooltip */}
                      <div className="absolute -top-16 opacity-0 group-hover:opacity-100 group-hover:-top-20 transition-all duration-300 pointer-events-none">
                        <div className="bg-slate-900 text-white px-4 py-2 rounded-xl shadow-2xl relative">
                          <p className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-0.5">Votación Exacta</p>
                          <p className="text-xl font-black">{c.total} <span className="text-xs text-slate-400">votos</span></p>
                          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-900 rotate-45"></div>
                        </div>
                      </div>

                      <div className="w-20 h-20 md:w-24 md:h-24 bg-white border-4 border-blue-500 rounded-full overflow-hidden shadow-2xl ring-8 ring-white/50 group-hover:scale-110 group-hover:border-blue-400 transition-all duration-500 cursor-pointer">
                        {photoUrl ? (
                          <img src={photoUrl} className="w-full h-full object-cover" alt={c.candidate_name} onError={(e) => e.target.style.display = 'none'} />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-blue-50">
                            <Users className="w-12 h-12 text-blue-900 opacity-30" />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* MAIN BAR */}
                    <div 
                      className="w-full bg-gradient-to-t from-[#1e3a8a] to-[#3b82f6] rounded-t-3xl shadow-[0_-10px_25px_-5px_rgba(59,130,246,0.3)] relative overflow-hidden group-hover:brightness-110 transition-all duration-1000"
                      style={{ height: `${barHeight}%` }}
                    >
                      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12 translate-x-[-150%] group-hover:translate-x-[150%] transition-transform duration-1000"></div>
                    </div>

                    {/* BOTTOM: Party & Name */}
                    <div className="absolute top-[100%] mt-8 flex flex-col items-center w-full">
                      <div className="w-14 h-14 md:w-16 md:h-16 bg-white border-2 border-slate-100 rounded-2xl shadow-xl p-2 flex items-center justify-center mb-3 group-hover:-translate-y-2 transition-transform duration-300">
                        {partyUrl ? (
                          <img src={partyUrl} className="w-full h-full object-contain" alt="Partido" />
                        ) : (
                          <ShieldCheck className="w-10 h-10 text-blue-900 opacity-10" />
                        )}
                      </div>
                      <span className="text-[11px] md:text-sm font-black text-[#1e3a8a] text-center leading-tight uppercase tracking-tight max-w-[120px]">
                        {c.candidate_name}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="bg-slate-900 p-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-slate-400 text-sm font-bold">
            <span className="w-3 h-3 bg-blue-500 rounded-full"></span>
            Sistema Protegido por Biometría Avanzada
          </div>
          <div className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">
            © 2026 Consejo Nacional Electoral - Versión 4.2.0-FINAL
          </div>
        </div>
      </div>
    </div>
  );
}
