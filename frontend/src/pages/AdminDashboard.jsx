import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Register from './Register';
import CandidateManager from '../components/CandidateManager';
import { Users, LogOut, FileText, LayoutDashboard, ChevronRight, UserCircle } from 'lucide-react';

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('voters');

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  return (
    <div className="flex h-screen w-full bg-bg-main overflow-hidden text-text-main font-body">
      
      {/* Sidebar */}
      <aside className="w-72 h-full bg-primary-navy border-r border-white/10 p-8 flex flex-col z-20 shadow-2xl shrink-0 text-white">
        {/* Brand */}
        <div className="flex items-center gap-3 mb-12">
          <div className="bg-white text-primary-navy p-2 rounded-xl shadow-lg">
            <LayoutDashboard size={22} />
          </div>
          <h2 className="text-xl font-black tracking-tight uppercase text-white">Admin Portal</h2>
        </div>

        {/* Profile Summary */}
        <div className="mb-10 p-5 bg-white/10 backdrop-blur-md rounded-[2rem] flex items-center gap-4 border border-white/10 shadow-inner">
          <div className="p-1 bg-white/20 rounded-full">
            <UserCircle size={36} className="text-white" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-bold text-white truncate">
              {user?.first_name} {user?.last_name}
            </span>
            <span className="text-[10px] text-white/60 font-black uppercase tracking-widest">Administrador</span>
          </div>
        </div>

        <nav className="flex flex-col gap-3 flex-1">
          <SidebarButton 
            active={activeTab === 'voters'} 
            onClick={() => setActiveTab('voters')}
            icon={<Users size={20} />}
            label="Empadronar Votante"
          />
          
          <SidebarButton 
            active={activeTab === 'candidates'} 
            onClick={() => setActiveTab('candidates')}
            icon={<FileText size={20} />}
            label="Gestión de Candidatos"
          />
        </nav>

        <button 
          onClick={handleLogout}
          className="mt-auto flex items-center gap-3 px-5 py-4 text-white/70 font-bold text-sm rounded-2xl hover:bg-danger-rose/20 hover:text-white transition-all duration-300 group"
        >
          <div className="p-2 bg-white/10 rounded-lg group-hover:bg-danger-rose/30 transition-colors">
            <LogOut size={18} />
          </div>
          Cerrar Sesión
        </button>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 h-full overflow-y-auto relative scroll-smooth bg-bg-main">
        {activeTab === 'voters' && (
          <div className="animate-fade-in h-full">
            <Register inDashboard={true} />
          </div>
        )}

        {activeTab === 'candidates' && (
          <CandidateManager />
        )}
      </main>
    </div>
  );
}

function SidebarButton({ active, onClick, icon, label }) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-300 relative group overflow-hidden ${
        active 
          ? 'bg-white text-primary-navy shadow-xl scale-[1.02]' 
          : 'text-white/70 hover:bg-white/5 hover:text-white'
      }`}
    >
      <div className={`transition-transform duration-300 ${active ? 'scale-110' : 'group-hover:scale-110 opacity-70 group-hover:opacity-100'}`}>
        {icon}
      </div>
      <span className={`flex-1 text-sm tracking-wide ${active ? 'font-black' : 'font-bold'}`}>{label}</span>
      {active && <ChevronRight size={16} className="animate-in slide-in-from-left-2" />}
      
      {active && (
        <div className="absolute left-0 top-1/4 bottom-1/4 w-1.5 bg-primary-blue rounded-r-full" />
      )}
    </button>
  );
}
