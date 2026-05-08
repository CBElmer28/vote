import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  Plus, Search, Edit2, Trash2, Power, 
  PowerOff, Shield, Image as ImageIcon, Users,
  X, Check, AlertCircle, Loader2, User, 
  UserPlus, UserMinus, Info, Layout, Upload, Camera
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function PartyManager() {
  const { t } = useTranslation();
  const [parties, setParties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Single Unified Modal
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState('general'); // 'general' or 'members'
  
  // Selection & Editing
  const [editingId, setEditingId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Refs for file uploads
  const partySymbolRef = useRef(null);
  const memberPhotoRef = useRef(null);
  const [activeMemberId, setActiveMemberId] = useState(null);

  // Unified State for the Party being edited
  const [currentParty, setCurrentParty] = useState({
    name: '',
    symbol_url: '',
    is_active: true,
    members: []
  });

  const fetchParties = async () => {
    try {
      setLoading(true);
      const res = await axios.get('http://localhost/api/candidatos/');
      const adaptedData = res.data.data.map(item => ({
        id: item.id,
        name: item.party || item.full_name,
        symbol_url: item.party_symbol_url || item.photo_url,
        is_active: item.is_active,
        members: item.members || [
          { id: Date.now() + 1, name: item.full_name, role: 'Presidente', photo: item.photo_url },
          { id: Date.now() + 2, name: 'Primer Vicepresidente', role: '1er Vicepresidente', photo: '' },
          { id: Date.now() + 3, name: 'Segundo Vicepresidente', role: '2do Vicepresidente', photo: '' }
        ]
      }));
      setParties(adaptedData);
    } catch (err) {
      console.error("Failed to fetch parties", err);
      setError(t('admin.err_fetch'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchParties();
  }, []);

  const defaultMembers = [
    { id: 1, name: '', role: 'Presidente', photo: '' },
    { id: 2, name: '', role: '1er Vicepresidente', photo: '' },
    { id: 3, name: '', role: '2do Vicepresidente', photo: '' }
  ];

  const handleOpenModal = (party = null) => {
    if (party) {
      setEditingId(party.id);
      setCurrentParty({ 
        ...party, 
        members: party.members && party.members.length > 0 ? party.members : [...defaultMembers]
      });
      setActiveTab('general');
    } else {
      setEditingId(null);
      setCurrentParty({
        name: '',
        symbol_url: '',
        is_active: true,
        members: [...defaultMembers]
      });
      setActiveTab('general');
    }
    setError('');
    setShowModal(true);
  };

  const addMember = () => {
    const newMember = { 
      id: Date.now(), 
      name: '', 
      role: 'Candidato', 
      photo: '' 
    };
    setCurrentParty(prev => ({
      ...prev,
      members: [...prev.members, newMember]
    }));
  };

  const removeMember = (id) => {
    setCurrentParty(prev => ({
      ...prev,
      members: prev.members.filter(m => m.id !== id)
    }));
  };

  const handleFileChange = (e, type, memberId = null) => {
    const file = e.target.files[0];
    if (!file) return;

    // 1. Security Validation: Check extension and type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    const allowedExtensions = ['jpg', 'jpeg', 'png'];
    const extension = file.name.split('.').pop().toLowerCase();

    if (!allowedTypes.includes(file.type) || !allowedExtensions.includes(extension)) {
      setError(t('admin.err_format'));
      return;
    }

    // 2. Limit size (optional but recommended, e.g., 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setError(t('admin.err_size'));
      return;
    }

    setError(''); // Clear any previous errors

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result;
      if (type === 'party') {
        setCurrentParty(prev => ({ ...prev, symbol_url: base64String }));
      } else if (type === 'member' && memberId) {
        updateMember(memberId, 'photo', base64String);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setIsSubmitting(true);
    setError('');
    try {
      const payload = {
        party: currentParty.name,
        party_symbol_url: currentParty.symbol_url,
        full_name: currentParty.members.find(m => m.role === 'Presidente')?.name || currentParty.name,
        photo_url: currentParty.members.find(m => m.role === 'Presidente')?.photo || '',
        members: currentParty.members,
        is_active: currentParty.is_active
      };

      if (editingId) {
        await axios.put(`http://localhost/api/candidatos/${editingId}`, payload);
      } else {
        await axios.post('http://localhost/api/candidatos/', payload);
      }
      setShowModal(false);
      fetchParties();
    } catch (err) {
      setError(t('admin.err_process'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateMember = (id, field, value) => {
    setCurrentParty(prev => ({
      ...prev,
      members: prev.members.map(m => m.id === id ? { ...m, [field]: value } : m)
    }));
  };

  return (
    <div className="animate-fade-in p-8 min-h-full bg-bg-main/30 text-primary-navy">
      {/* Header */}
      <div className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-4xl font-black mb-1 tracking-tight">{t('admin.parties_title')}</h1>
          <p className="text-text-muted font-medium italic">{t('admin.parties_desc')}</p>
        </div>
        <button className="glass-button !w-auto px-8 py-4 shadow-xl" onClick={() => handleOpenModal()}>
          <Plus size={20} /> {t('admin.new_party')}
        </button>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-32 gap-4">
          <Loader2 className="animate-spin text-primary-blue" size={48} />
          <p className="text-text-muted font-bold uppercase tracking-widest text-xs">{t('admin.loading_parties')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {parties.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())).map(party => (
            <div key={party.id} className="flat-card !p-0 overflow-hidden flex flex-col group hover:border-primary-blue transition-all bg-white">
              <div className="p-8 flex items-center gap-6">
                <div className="w-20 h-20 rounded-2xl bg-bg-main border-2 border-surface-border p-2 shrink-0 group-hover:border-primary-blue/30 transition-all flex items-center justify-center">
                  {party.symbol_url ? (
                    <img src={party.symbol_url} alt="" className="w-full h-full object-contain" />
                  ) : (
                    <Shield className="w-full h-full text-primary-navy/10" />
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="text-2xl font-black truncate mb-1">{party.name}</h3>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${party.is_active ? 'bg-success-emerald' : 'bg-danger-rose'}`} />
                    <span className="text-[10px] font-black uppercase tracking-widest text-text-muted">
                      {party.is_active ? t('admin.active') : t('admin.inactive')}
                    </span>
                  </div>
                </div>
              </div>
              <div className="bg-bg-main/50 p-6 border-t border-surface-border flex gap-3">
                <button onClick={() => handleOpenModal(party)} className="glass-button !py-3 flex-1 !text-xs !bg-primary-navy/5 !text-primary-navy hover:!bg-primary-navy hover:!text-white shadow-none">
                  <Edit2 size={16} /> {t('admin.configure')}
                </button>
                <button className="p-3 border-2 border-surface-border text-danger-rose rounded-xl hover:bg-danger-rose/10 transition-all">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL UNIFICADO CON SUBIDA DE ARCHIVOS */}
      {showModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-primary-navy/80 backdrop-blur-xl" onClick={() => setShowModal(false)}></div>
          
          <div className="relative bg-white w-full max-w-5xl rounded-[3rem] shadow-2xl animate-scale-in overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header Modal */}
            <div className="bg-primary-navy p-10 text-white flex justify-between items-center shrink-0 border-b border-white/10">
              <div className="flex items-center gap-8">
                <div className="relative group">
                  <div className="w-24 h-24 bg-white rounded-[2rem] p-4 shadow-2xl flex items-center justify-center overflow-hidden border-4 border-white/20">
                    {currentParty.symbol_url ? (
                      <img src={currentParty.symbol_url} alt="" className="w-full h-full object-contain" />
                    ) : (
                      <Shield className="w-full h-full text-primary-navy/10" />
                    )}
                  </div>
                  <button 
                    onClick={() => partySymbolRef.current.click()}
                    className="absolute -bottom-2 -right-2 bg-primary-blue text-white p-3 rounded-2xl shadow-xl hover:scale-110 active:scale-95 transition-all border-4 border-primary-navy"
                  >
                    <Camera size={18} />
                  </button>
                  <input type="file" ref={partySymbolRef} className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, 'party')} />
                </div>
                <div>
                  <h2 className="text-3xl font-black tracking-tight">{editingId ? currentParty.name || t('admin.modal_title_edit') : t('admin.modal_title_new')}</h2>
                  <p className="text-white/60 font-bold text-xs uppercase tracking-[0.2em] mt-1">{t('admin.modal_subtitle')}</p>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} className="p-4 bg-white/10 hover:bg-white/20 rounded-2xl transition-all">
                <X size={24} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex bg-bg-main px-10 pt-2 shrink-0 border-b border-surface-border">
              <Tab active={activeTab === 'general'} onClick={() => setActiveTab('general')} icon={<Info size={18} />} label={t('admin.tab_identity')} />
              <Tab active={activeTab === 'members'} onClick={() => setActiveTab('members')} icon={<Users size={18} />} label={t('admin.tab_members')} />
            </div>

            <div className="p-12 overflow-y-auto flex-1">
              {error && (
                <div className="mb-8 p-5 bg-danger-rose/10 border-2 border-danger-rose/20 rounded-[2rem] text-danger-rose text-xs font-black flex items-center gap-4 animate-shake">
                  <AlertCircle size={20} /> {error}
                </div>
              )}
              {activeTab === 'general' ? (
                <div className="max-w-2xl mx-auto space-y-10 animate-fade-in">
                  <div className="space-y-3">
                    <label className="text-xs font-black uppercase tracking-widest opacity-60 px-1">{t('admin.party_name')}</label>
                    <div className="input-wrapper">
                      <Shield className="input-icon" />
                      <input className="glass-input" value={currentParty.name} onChange={e => setCurrentParty({...currentParty, name: e.target.value})} placeholder={t('admin.party_name_placeholder')} />
                    </div>
                  </div>
                  <div className="flex flex-col gap-8 p-10 bg-primary-blue/5 rounded-[3.5rem] border border-primary-blue/10 items-center text-center">
                    <div className="w-24 h-24 bg-white rounded-3xl shadow-xl flex items-center justify-center overflow-hidden border border-surface-border p-2">
                      {currentParty.symbol_url ? (
                        <img src={currentParty.symbol_url} alt="" className="w-full h-full object-contain" />
                      ) : (
                        <Shield className="w-full h-full text-primary-navy/10" />
                      )}
                    </div>
                    <div>
                      <h4 className="text-lg font-black mb-1">{t('admin.update_symbol')}</h4>
                      <p className="text-xs text-text-muted font-medium mb-6">{t('admin.symbol_formats')}</p>
                      <button onClick={() => partySymbolRef.current.click()} className="glass-button !w-auto !py-3.5 px-8 !text-xs shadow-xl">
                        <Upload size={16} /> {t('admin.select_file')}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-8 bg-white border border-surface-border rounded-3xl shadow-sm">
                    <div>
                      <h4 className="text-sm font-black mb-1">{t('admin.status')}</h4>
                      <p className="text-xs text-text-muted">{t('admin.status_desc')}</p>
                    </div>
                    <button 
                      onClick={() => setCurrentParty({...currentParty, is_active: !currentParty.is_active})}
                      className={`px-8 py-3 rounded-2xl text-[10px] font-black uppercase transition-all shadow-lg ${
                        currentParty.is_active ? 'bg-success-emerald text-white' : 'bg-danger-rose text-white'
                      }`}
                    >
                      {currentParty.is_active ? t('admin.enabled') : t('admin.suspended')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="animate-fade-in space-y-6">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-black">{t('admin.members_title')}</h3>
                    <div className="flex items-center gap-4">
                      <div className="text-xs font-bold text-text-muted bg-bg-main px-4 py-2 rounded-full border border-surface-border">
                        {currentParty.members.length} {t('admin.defined_candidates')}
                      </div>
                      <button onClick={addMember} className="glass-button !py-2 !px-4 !text-[10px] !w-auto">
                        <UserPlus size={14} /> {t('admin.add_member')}
                      </button>
                    </div>
                  </div>
                  <div className="border border-surface-border rounded-[2.5rem] overflow-hidden shadow-xl bg-white">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-bg-main/80">
                          <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest opacity-50">{t('admin.role_header')}</th>
                          <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest opacity-50">{t('admin.candidate')}</th>
                          <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest opacity-50">{t('admin.photo')}</th>
                          <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest opacity-50 text-right">{t('admin.action')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-border">
                        {currentParty.members.map((member) => (
                          <tr key={member.id} className="hover:bg-primary-blue/[0.02] transition-colors group/row">
                            <td className="px-8 py-6">
                              <div className="relative">
                                <input 
                                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all duration-300 w-full max-w-[160px] outline-none focus:ring-2 focus:ring-primary-blue/30 ${
                                    member.role.toLowerCase().includes('presidente') && !member.role.toLowerCase().includes('vice')
                                      ? 'bg-primary-navy text-white shadow-lg shadow-primary-navy/20' 
                                      : 'bg-primary-blue/10 text-primary-blue border border-primary-blue/20'
                                  }`}
                                  value={member.role}
                                  onChange={(e) => updateMember(member.id, 'role', e.target.value)}
                                  placeholder={t('admin.role_placeholder')}
                                />
                                <div className="absolute -right-1 -top-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
                                  <Edit2 size={10} className="text-primary-blue/40" />
                                </div>
                              </div>
                            </td>
                            <td className="px-8 py-6">
                              <input 
                                className="w-full bg-transparent border-b-2 border-transparent focus:border-primary-blue/30 outline-none font-bold py-2 px-1 transition-all focus:bg-primary-blue/[0.03] rounded-t-lg"
                                value={member.name}
                                onChange={(e) => updateMember(member.id, 'name', e.target.value)}
                                placeholder={t('admin.candidate_placeholder')}
                              />
                            </td>
                            <td className="px-8 py-6">
                              <div className="flex items-center gap-4">
                                <div className="relative group">
                                  <div className="w-12 h-12 rounded-xl bg-bg-main overflow-hidden border border-surface-border shrink-0 shadow-inner flex items-center justify-center">
                                    {member.photo ? <img src={member.photo} alt="" className="w-full h-full object-cover" /> : <User className="opacity-10" size={20} />}
                                  </div>
                                  <button 
                                    onClick={() => { setActiveMemberId(member.id); memberPhotoRef.current.click(); }}
                                    className="absolute -top-2 -right-2 bg-primary-navy text-white p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-all shadow-lg scale-90 hover:scale-100"
                                  >
                                    <Camera size={14} />
                                  </button>
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-[9px] font-black uppercase tracking-tighter opacity-40">{t('admin.file')}</span>
                                  <span className="text-[10px] font-bold text-primary-blue truncate max-w-[120px]">
                                    {member.photo?.startsWith('data:') ? t('admin.image_loaded') : (member.photo ? t('admin.on_server') : t('admin.pending'))}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="px-8 py-6 text-right">
                              <button 
                                onClick={() => removeMember(member.id)}
                                className="p-2 text-danger-rose hover:bg-danger-rose/10 rounded-lg transition-all"
                              >
                                <UserMinus size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <input type="file" ref={memberPhotoRef} className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, 'member', activeMemberId)} />
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-10 bg-bg-main border-t border-surface-border flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3 text-text-muted/60">
                <AlertCircle size={20} />
                <span className="text-[10px] font-black uppercase tracking-tight">{t('admin.sync_encrypted')}</span>
              </div>
              <div className="flex gap-4">
                <button onClick={() => setShowModal(false)} className="glass-button secondary !w-auto px-10 !h-14">{t('admin.cancel')}</button>
                <button onClick={handleSave} className="glass-button !w-auto px-14 !h-14 shadow-2xl" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="animate-spin" /> : t('admin.confirm_changes')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Tab({ active, onClick, icon, label }) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-3 px-10 py-6 text-[10px] font-black uppercase tracking-[0.2em] transition-all relative ${
        active ? 'text-primary-blue' : 'text-text-muted hover:text-text-main'
      }`}
    >
      {icon} {label}
      {active && <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary-blue rounded-t-full" />}
    </button>
  );
}
