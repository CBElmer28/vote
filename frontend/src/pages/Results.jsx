import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { LogOut, Users, Activity, ShieldCheck, Loader2, MapPin, ChevronDown, Check, Globe, Accessibility } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAccessibility } from '../context/AccessibilityContext';
import AccessibilityMenu from '../components/AccessibilityMenu';

import countriesData from '../data/countries.json';
import departmentsData from '../data/departments.json';
import provincesData from '../data/provinces.json';
import districtsData from '../data/districts.json';

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
  
  const [filterMode, setFilterMode] = useState('TODOS');
  const [filterCountry, setFilterCountry] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterProv, setFilterProv] = useState('');
  const [filterDist, setFilterDist] = useState('');
  const [showModeDropdown, setShowModeDropdown] = useState(false);

  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { toggleTheme } = useAccessibility();
  const [showAccessibility, setShowAccessibility] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const fetchResults = async () => {
    try {
      let url = 'http://localhost/api/analisis/summary';
      const params = new URLSearchParams();
      
      if (filterMode === 'PERU') {
        params.append('country', 'Perú');
        if (filterDept) params.append('department', filterDept);
        if (filterProv) params.append('province', filterProv);
        if (filterDist) params.append('district', filterDist);
      } else if (filterMode === 'EXTRANJERO') {
        if (filterCountry) {
          params.append('country', filterCountry);
        } else {
          params.append('country', '!Perú');
        }
      }
      
      const queryString = params.toString();
      if (queryString) {
        url += `?${queryString}`;
      }

      const sumRes = await axios.get(url);
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
    if (!data) setLoading(true);
    fetchResults();
    const interval = setInterval(fetchResults, 600000); // 10 minutes
    return () => clearInterval(interval);
  }, [filterMode, filterCountry, filterDept, filterProv, filterDist]);

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
          <p className="text-slate-400 font-bold animate-pulse">{t('results.syncing')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-main p-4 md:p-8 lg:p-14 font-sans selection:bg-blue-100">
      {/* Header Section */}
      <div className="max-w-7xl mx-auto mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-2 h-12 bg-blue-600 rounded-full shadow-lg shadow-blue-200"></div>
          <div>
            <h1 className="text-3xl md:text-4xl font-black text-text-main tracking-tight">
              {t('results.title')}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <p className="text-slate-500 font-medium text-sm">{t('results.update_info')}</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="relative group cursor-pointer z-50">
            <div className="flex items-center gap-2 px-4 py-3 bg-surface border border-surface-border rounded-2xl shadow-sm hover:shadow-md hover:bg-surface-hover transition-all text-text-main font-bold text-sm uppercase">
              <Globe size={18} />
              <span>{t('login.language')}</span>
            </div>
            {/* Dropdown menu */}
            <div className="absolute top-full right-0 mt-2 w-32 bg-white rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 overflow-hidden border border-slate-100">
              <button onClick={() => i18n.changeLanguage('es')} className="w-full text-left px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 hover:text-primary-blue">ESPAÑOL</button>
              <button onClick={() => i18n.changeLanguage('en')} className="w-full text-left px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 hover:text-primary-blue">ENGLISH</button>
              <button onClick={() => i18n.changeLanguage('qu')} className="w-full text-left px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 hover:text-primary-blue">QUECHUA</button>
            </div>
          </div>

          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 px-6 py-3 bg-surface border border-surface-border text-text-main font-bold rounded-2xl shadow-sm hover:shadow-md hover:bg-surface-hover transition-all active:scale-95"
          >
            <LogOut className="w-5 h-5" />
            {t('results.logout')}
          </button>

          <button 
            onClick={() => setShowAccessibility(true)}
            className="p-3 bg-surface border border-surface-border text-text-main rounded-2xl shadow-sm hover:bg-surface-hover transition-all"
            title="Accesibilidad"
          >
            <Accessibility size={22} />
          </button>
        </div>
      </div>

      <AccessibilityMenu isOpen={showAccessibility} onClose={() => setShowAccessibility(false)} />

      {/* Overview Section */}
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-4 mb-6">
        {/* Voting Progress Bar */}
        <div className="flex-1 bg-surface p-5 rounded-[2rem] shadow-flat-xl border border-surface-border relative overflow-hidden flex flex-col justify-center">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <div>
              <h3 className="text-lg font-black text-text-main flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-600" />
                {t('results.progress_title')}
              </h3>
              <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mt-1">
                {t('results.progress_desc')}
              </p>
            </div>
            <div className="text-right">
              <span className="text-3xl font-black text-blue-600">
                {data.total_voters > 0 ? ((data.total_votes / data.total_voters) * 100).toFixed(1) : 0}%
              </span>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{t('results.participation_goal')}</p>
            </div>
          </div>

          <div className="relative w-full h-4 bg-slate-100 rounded-full overflow-hidden shadow-inner border border-slate-200/50">
            {/* Background Glow */}
            <div 
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-[#1e3a8a] to-[#3b82f6] shadow-[0_0_20px_rgba(30,58,138,0.3)] transition-all duration-1000 ease-out flex items-center justify-end px-4"
              style={{ width: `${data.total_voters > 0 ? (data.total_votes / data.total_voters) * 100 : 0}%` }}
            >
              {/* Shimmer Effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_2s_infinite]"></div>
            </div>
          </div>

          <div className="flex justify-between mt-3">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
              <p className="text-[10px] font-bold text-slate-500">
                {data.total_votes?.toLocaleString() || 0} <span className="text-slate-400 font-medium">{t('results.processed_votes')}</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-bold text-slate-500">
                {data.total_voters?.toLocaleString() || 0} <span className="text-slate-400 font-medium">{t('results.eligible_voters')}</span>
              </p>
              <div className="w-1.5 h-1.5 bg-slate-300 rounded-full"></div>
            </div>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="bg-surface p-5 rounded-[2rem] shadow-flat-xl border border-surface-border flex items-center gap-4 group hover:border-blue-200 transition-colors w-full lg:w-[320px] shrink-0">
          <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <Users className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{t('results.total_participation')}</p>
            <h2 className="text-3xl font-black text-text-main leading-none">{data.total_votes || 0}</h2>
            <p className="text-[10px] font-bold text-slate-400 mt-1">{t('results.votes_cast')}</p>
          </div>
        </div>
      </div>

      {/* Main Analysis Card */}
      <div className="max-w-7xl mx-auto bg-surface rounded-[3rem] shadow-flat-xl border border-surface-border overflow-hidden relative">
        <div className="p-6 border-b border-slate-50 flex flex-col gap-4 bg-slate-50/30">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="text-2xl font-black text-text-main">{t('results.chart_title')}</h3>
              <p className="text-slate-500 font-medium text-sm">{t('results.chart_desc')}</p>
            </div>
            <div className="hidden md:flex items-center gap-3 px-5 py-2 bg-blue-50 text-blue-700 font-black text-xs rounded-full border border-blue-100 uppercase tracking-wider">
              {data.count_by_candidate?.length || 0} {t('results.candidates_count')}
            </div>
          </div>
          
          {/* FILTERS UI */}
          <div className="flex flex-wrap items-center gap-3">
             <div className="w-10 h-10 bg-[#0f2d69] rounded-xl flex items-center justify-center shadow-lg shrink-0">
                <MapPin className="w-5 h-5 text-white" />
             </div>
             
             {/* MAIN DROPDOWN */}
             <div className="relative">
                <button 
                  onClick={() => setShowModeDropdown(!showModeDropdown)}
                  className="bg-[#2c7be5] text-white px-4 py-2.5 rounded-lg font-bold text-sm flex items-center gap-2 hover:bg-[#2368c4] transition-colors shadow-md border-0"
                >
                  {filterMode === 'PERU' ? t('results.mode_peru') : filterMode === 'EXTRANJERO' ? t('results.mode_abroad') : t('results.mode_all')} <ChevronDown className="w-4 h-4" />
                </button>
                {showModeDropdown && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowModeDropdown(false)}></div>
                    <div className="absolute top-full left-0 mt-2 w-48 bg-surface border border-surface-border rounded-lg shadow-xl z-50 overflow-hidden">
                      {['TODOS', 'PERU', 'EXTRANJERO'].map(mode => (
                        <button 
                          key={mode}
                          onClick={() => {
                            setFilterMode(mode);
                            setFilterCountry('');
                            setFilterDept('');
                            setFilterProv('');
                            setFilterDist('');
                            setShowModeDropdown(false);
                          }}
                          className={`w-full text-left px-4 py-3 text-sm font-bold flex items-center justify-between hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0 ${filterMode === mode ? 'bg-[#e9eff9] text-[#1e3a8a]' : 'text-slate-600'}`}
                        >
                          {mode === 'TODOS' ? t('results.mode_all') : mode === 'PERU' ? t('results.mode_peru') : t('results.mode_abroad')}
                          {filterMode === mode && <Check className="w-4 h-4 text-[#1e3a8a]" />}
                        </button>
                      ))}
                    </div>
                  </>
                )}
             </div>

             {/* CASCADE FOR PERU */}
             {filterMode === 'PERU' && (
               <>
                 <div className="relative">
                   <select 
                     value={filterDept}
                     onChange={(e) => {
                       setFilterDept(e.target.value);
                       setFilterProv('');
                       setFilterDist('');
                     }}
                     className="appearance-none bg-white text-slate-700 border border-slate-200 px-4 py-2.5 pr-10 rounded-lg font-bold text-sm outline-none focus:border-blue-500 transition-colors shadow-sm cursor-pointer min-w-[140px]"
                   >
                     <option value="">{t('results.region')}</option>
                     {departmentsData.map(d => (
                       <option key={d.id_depa} value={d.id_depa}>{d.name.toUpperCase()}</option>
                     ))}
                   </select>
                   <ChevronDown className="w-4 h-4 text-slate-800 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                 </div>

                 {filterDept && (
                   <div className="relative">
                     <select 
                       value={filterProv}
                       onChange={(e) => {
                         setFilterProv(e.target.value);
                         setFilterDist('');
                       }}
                       className="appearance-none bg-white text-slate-700 border border-slate-200 px-4 py-2.5 pr-10 rounded-lg font-bold text-sm outline-none focus:border-blue-500 transition-colors shadow-sm cursor-pointer min-w-[140px]"
                     >
                       <option value="">{t('results.province')}</option>
                       {provincesData.filter(p => p.id_depa === filterDept).map(p => (
                         <option key={p.id_prov} value={p.id_prov}>{p.name.toUpperCase()}</option>
                       ))}
                     </select>
                     <ChevronDown className="w-4 h-4 text-slate-800 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                   </div>
                 )}

                 {filterProv && (
                   <div className="relative">
                     <select 
                       value={filterDist}
                       onChange={(e) => setFilterDist(e.target.value)}
                       className="appearance-none bg-surface text-text-main border border-surface-border px-4 py-2.5 pr-10 rounded-lg font-bold text-sm outline-none focus:border-blue-500 transition-colors shadow-sm cursor-pointer min-w-[140px]"
                     >
                       <option value="">{t('results.district')}</option>
                       {districtsData.filter(d => d.id_prov === filterProv).map(d => (
                         <option key={d.id_dist} value={d.id_dist}>{d.name.toUpperCase()}</option>
                       ))}
                     </select>
                     <ChevronDown className="w-4 h-4 text-slate-800 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                   </div>
                 )}
               </>
             )}

             {/* CASCADE FOR EXTRANJERO */}
             {filterMode === 'EXTRANJERO' && (
               <div className="relative">
                 <select 
                   value={filterCountry}
                   onChange={(e) => setFilterCountry(e.target.value)}
                   className="appearance-none bg-surface text-text-main border border-surface-border px-4 py-2.5 pr-10 rounded-lg font-bold text-sm outline-none focus:border-blue-500 transition-colors shadow-sm cursor-pointer min-w-[180px]"
                 >
                   <option value="">{t('results.all_countries')}</option>
                   {countriesData.filter(c => c.name !== 'Perú').map(c => (
                     <option key={c.id} value={c.name}>{c.name.toUpperCase()}</option>
                   ))}
                 </select>
                 <ChevronDown className="w-4 h-4 text-slate-800 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
               </div>
             )}

             {/* CLEAR BUTTON */}
             {(filterMode !== 'TODOS' || filterCountry || filterDept || filterProv || filterDist) && (
               <button 
                 onClick={() => {
                   setFilterMode('TODOS');
                   setFilterCountry('');
                   setFilterDept('');
                   setFilterProv('');
                   setFilterDist('');
                 }}
                 className="px-6 py-2.5 rounded-lg border border-[#2c7be5] text-[#2c7be5] hover:bg-blue-50 font-bold text-sm transition-colors uppercase ml-auto"
               >
                 {t('results.clear')}
               </button>
             )}
          </div>
        </div>

        <div className="p-6">
          {/* --- NATIVE ELECTORAL CHART --- */}
          <div className="w-full mt-6 mb-24 px-4">
            <div className="relative h-[320px] w-full border-b-2 border-slate-200 flex items-end justify-around gap-4 md:gap-12 pt-24 pb-2">
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

                const isTopTwo = index < 2;
                const barColors = isTopTwo ? "from-[#1e3a8a] to-[#3b82f6]" : "from-blue-300 to-blue-200";
                const shadowColor = isTopTwo ? "shadow-[0_-10px_25px_-5px_rgba(59,130,246,0.3)]" : "shadow-[0_-10px_25px_-5px_rgba(147,197,253,0.3)]";
                const portraitBorder = isTopTwo ? "border-blue-500 group-hover:border-blue-400" : "border-blue-200 group-hover:border-blue-300";

                return (
                  <div key={index} className="relative flex-1 h-full flex flex-col items-center justify-end group max-w-[160px]">
                    {/* TOP: Candidate Portrait + Interactive Tooltip */}
                    <div 
                      className="absolute z-20 flex flex-col items-center transition-all duration-1000 ease-out"
                      style={{ bottom: `calc(${barHeight}% + 15px)` }}
                    >
                      {/* Interactive Tooltip */}
                      <div className="absolute -top-16 opacity-0 group-hover:opacity-100 group-hover:-top-20 transition-all duration-300 pointer-events-none">
                        <div className="bg-slate-900 text-white px-4 py-2 rounded-xl shadow-2xl relative whitespace-nowrap">
                          <p className={`text-[10px] font-black uppercase tracking-widest mb-0.5 ${isTopTwo ? 'text-blue-400' : 'text-slate-400'}`}>{t('results.exact_votes')}</p>
                          <p className="text-xl font-black">{c.total} <span className="text-xs text-slate-400">{t('results.votes')}</span></p>
                          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-900 rotate-45"></div>
                        </div>
                      </div>

                      <div className={`w-20 h-20 md:w-24 md:h-24 bg-surface border-4 ${portraitBorder} rounded-full overflow-hidden shadow-2xl ring-8 ring-surface-border/50 group-hover:scale-110 transition-all duration-500 cursor-pointer`}>
                        {photoUrl ? (
                          <img src={photoUrl} className="w-full h-full object-cover" alt={c.candidate_name} onError={(e) => e.target.style.display = 'none'} />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-blue-50">
                            <Users className={`w-12 h-12 opacity-30 ${isTopTwo ? 'text-blue-900' : 'text-slate-500'}`} />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* MAIN BAR */}
                    <div 
                      className={`w-full bg-gradient-to-t ${barColors} rounded-t-3xl ${shadowColor} relative overflow-hidden group-hover:brightness-110 transition-all duration-1000`}
                      style={{ height: `${barHeight}%` }}
                    >
                      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12 translate-x-[-150%] group-hover:translate-x-[150%] transition-transform duration-1000"></div>
                    </div>

                    {/* BOTTOM: Party & Name */}
                    <div className="absolute top-[100%] mt-8 flex flex-col items-center w-full">
                      <div className="w-14 h-14 md:w-16 md:h-16 bg-surface border-2 border-surface-border rounded-2xl shadow-xl p-2 flex items-center justify-center mb-3 group-hover:-translate-y-2 transition-transform duration-300">
                        {partyUrl ? (
                          <img src={partyUrl} className="w-full h-full object-contain" alt="Partido" />
                        ) : (
                          <ShieldCheck className="w-10 h-10 text-blue-900 opacity-10" />
                        )}
                      </div>
                      <span className="text-[11px] md:text-sm font-black text-text-main text-center leading-tight uppercase tracking-tight max-w-[120px]">
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
            {t('results.footer_security')}
          </div>
          <div className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">
            {t('results.footer_copyright')}
          </div>
        </div>
      </div>
    </div>
  );
}
