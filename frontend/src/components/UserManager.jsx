import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Webcam from 'react-webcam';
import { 
  Users, UserCheck, Shield, Search, Loader2, 
  MoreVertical, Mail, CreditCard, Calendar, Fingerprint,
  Edit2, Trash2, X, Check, ShieldCheck, Camera
} from 'lucide-react';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
import { useTranslation } from 'react-i18next';

export default function UserManager() {
  const { t } = useTranslation();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('voters'); // 'voters' or 'admins'
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showBioModal, setShowBioModal] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [bioAction, setBioAction] = useState(null); // 'face' or 'finger'
  const [activeMenu, setActiveMenu] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [savingBio, setSavingBio] = useState(false);
  const [bioStep, setBioStep] = useState('verify'); // 'verify' or 'update'
  const [isVerified, setIsVerified] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' }); // { type: 'error'|'success', text: '' }
  const webcamRef = useRef(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/usuarios/');
      const userData = res.data.data || (Array.isArray(res.data) ? res.data : []);
      setUsers(userData);
    } catch (err) {
      console.error("Error fetching users:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBiometrics = async () => {
    if (!capturedImage || !selectedUser) return;
    
    setSavingBio(true);
    setStatusMsg({ type: '', text: '' });
    try {
      const response = await fetch(capturedImage);
      const blob = await response.blob();
      const formData = new FormData();
      formData.append('face_photo', blob, 'capture.jpg');

      if (!isVerified && selectedUser.aws_face_id) {
        formData.append('reference_face_id', selectedUser.aws_face_id);
        const res = await axios.post('/api/biometrico/verify/face', formData);
        
        if (res.data.verified) {
          setIsVerified(true);
          setCapturedImage(null);
          setStatusMsg({ type: 'success', text: t('userManager.msg_face_verified') });
        } else {
          setStatusMsg({ type: 'error', text: t('userManager.msg_face_mismatch') });
          setCapturedImage(null);
        }
      } else {
        const resReg = await axios.post('/api/biometrico/register/face', formData);
        const newFaceId = resReg.data.aws_face_id;

        await axios.put(`/api/usuarios/${selectedUser.id}`, {
          aws_face_id: newFaceId,
          face_image: capturedImage
        });

        setStatusMsg({ type: 'success', text: t('userManager.msg_bio_updated') });
        setTimeout(() => {
          setShowCamera(false);
          setCapturedImage(null);
          setIsVerified(false);
          setStatusMsg({ type: '', text: '' });
          fetchUsers();
        }, 2000);
      }
    } catch (error) {
      console.error("Error en proceso biométrico:", error);
      const errorText = error.response?.data?.error || t('userManager.msg_err_server');
      setStatusMsg({ type: 'error', text: errorText });
    } finally {
      setSavingBio(false);
    }
  };

  const handleFingerprintUpdate = async () => {
    if (!selectedUser) return;
    setSavingBio(true);
    setStatusMsg({ type: '', text: '' });

    try {
      if (selectedUser.webauthn_credential_id) {
        const optRes = await axios.post('/api/biometrico/verify/fingerprint/options', { user_id: selectedUser.id });
        const authResp = await startAuthentication(optRes.data.options);
        
        await axios.post('/api/biometrico/verify/fingerprint/verify', {
          user_id: selectedUser.id,
          credential_response: authResp,
          public_key: selectedUser.webauthn_public_key
        });
        
        setStatusMsg({ type: 'success', text: t('userManager.msg_finger_verified') });
      }

      const regOptRes = await axios.post('/api/biometrico/register/fingerprint/options', { 
        user_id: selectedUser.id,
        user_name: selectedUser.first_name 
      });
      
      const regResp = await startRegistration(regOptRes.data.options);
      const verifyRegRes = await axios.post('/api/biometrico/register/fingerprint/verify', {
        user_id: selectedUser.id,
        credential_response: regResp
      });

      await axios.put(`/api/usuarios/${selectedUser.id}`, {
        webauthn_credential_id: verifyRegRes.data.credential_id,
        webauthn_public_key: verifyRegRes.data.public_key
      });

      setStatusMsg({ type: 'success', text: t('userManager.msg_finger_updated') });
      setTimeout(() => {
        setShowVerifyModal(false);
        setStatusMsg({ type: '', text: '' });
        fetchUsers();
      }, 2000);

    } catch (error) {
      console.error("Error WebAuthn:", error);
      setStatusMsg({ type: 'error', text: t('userManager.msg_err_bio') });
    } finally {
      setSavingBio(false);
    }
  };

  const filteredUsers = users.filter(u => {
    const isCorrectRole = filter === 'voters' ? u.role === 'VOTER' : u.role === 'ADMIN';
    const name = `${u.first_name || ''} ${u.paternal_last_name || ''} ${u.maternal_last_name || ''}`.toLowerCase();
    const dni = (u.dni || '').toString();
    const email = (u.email || '').toLowerCase();
    const search = searchTerm.toLowerCase();

    return isCorrectRole && (dni.includes(search) || name.includes(search) || email.includes(search));
  });

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
        <div>
          <h1 className="text-3xl font-black text-primary-navy mb-2 flex items-center gap-3">
            <Users className="text-blue-600" size={32} />
            {t('userManager.title')}
          </h1>
          <p className="text-slate-500 font-medium">{t('userManager.subtitle')}</p>
        </div>

        <div className="flex bg-white p-1.5 rounded-[1.5rem] shadow-sm border border-slate-100">
          <button 
            onClick={() => setFilter('voters')}
            className={`px-6 py-2.5 rounded-[1.2rem] text-sm font-bold transition-all flex items-center gap-2 ${
              filter === 'voters' ? 'bg-primary-navy text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <UserCheck size={18} /> {t('userManager.voters')}
          </button>
          <button 
            onClick={() => setFilter('admins')}
            className={`px-6 py-2.5 rounded-[1.2rem] text-sm font-bold transition-all flex items-center gap-2 ${
              filter === 'admins' ? 'bg-primary-navy text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <Shield size={18} /> {t('userManager.admins')}
          </button>
        </div>
      </div>

      <div className="mb-8 relative group">
        <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-600 transition-colors">
          <Search size={20} />
        </div>
        <input 
          type="text"
          placeholder={t('userManager.search_placeholder')}
          className="w-full pl-14 pr-6 py-4 bg-white border border-slate-200 rounded-3xl shadow-sm focus:ring-4 focus:ring-blue-600/5 focus:border-blue-600 outline-none transition-all font-medium text-slate-600"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-flat-xl border border-slate-100">
        {loading ? (
          <div className="py-32 flex flex-col items-center justify-center gap-4">
            <Loader2 className="animate-spin text-blue-600" size={40} />
            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">{t('userManager.loading')}</p>
          </div>
        ) : filteredUsers.length > 0 ? (
          <div className="overflow-visible">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50">
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">{t('userManager.col_user')}</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">{t('userManager.col_dni')}</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">{t('userManager.col_contact')}</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-center">{t('userManager.col_bio')}</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-right">{t('userManager.col_actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 font-black text-lg shadow-sm group-hover:scale-110 transition-transform">
                          {(u.first_name ? u.first_name[0] : 'U')}{(u.paternal_last_name ? u.paternal_last_name[0] : '')}
                        </div>
                        <div>
                          <p className="font-black text-primary-navy leading-tight">{u.first_name || t('userManager.no_name')}</p>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-tight mt-0.5">
                            {u.paternal_last_name || ''} {u.maternal_last_name || ''}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2 text-slate-600 font-bold">
                        <CreditCard size={16} className="text-slate-300" />
                        {u.dni}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 font-black uppercase mt-1">
                        <Calendar size={12} />
                        {u.dob}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2 text-sm text-slate-600 font-medium">
                        <Mail size={16} className="text-slate-300" />
                        {u.email || 'N/A'}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center justify-center gap-3">
                        <div className={`p-2 rounded-xl flex items-center gap-2 ${u.aws_face_id ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`} title={u.aws_face_id ? t('userManager.linked') : t('userManager.pending')}>
                          <Fingerprint size={16} />
                          <span className="text-[10px] font-black uppercase tracking-wider">{u.aws_face_id ? t('userManager.linked') : t('userManager.pending')}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right relative">
                      <button 
                        onClick={() => setActiveMenu(activeMenu === u.id ? null : u.id)}
                        className={`p-2.5 rounded-xl transition-all ${activeMenu === u.id ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50'}`}
                      >
                        <MoreVertical size={20} />
                      </button>

                      {activeMenu === u.id && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setActiveMenu(null)}></div>
                          <div className="absolute right-8 top-16 w-56 bg-white rounded-2xl shadow-2xl border border-slate-100 z-20 py-2 animate-in fade-in zoom-in duration-200">
                            <button 
                              onClick={() => {
                                setSelectedUser(u);
                                setShowEditModal(true);
                                setActiveMenu(null);
                              }}
                              className="w-full px-4 py-3 text-left flex items-center gap-3 text-slate-600 hover:bg-slate-50 font-bold transition-colors"
                            >
                              <Edit2 size={16} className="text-blue-500" />
                              {t('userManager.edit_personal')}
                            </button>
                            <button 
                              onClick={() => {
                                setSelectedUser(u);
                                setShowBioModal(true);
                                setActiveMenu(null);
                              }}
                              className="w-full px-4 py-3 text-left flex items-center gap-3 text-slate-600 hover:bg-slate-50 font-bold transition-colors"
                            >
                              <Fingerprint size={16} className="text-purple-500" />
                              {t('userManager.update_bio')}
                            </button>
                            <div className="border-t border-slate-50 my-1"></div>
                            <button className="w-full px-4 py-3 text-left flex items-center gap-3 text-red-500 hover:bg-red-50 font-bold transition-colors">
                              <Trash2 size={16} />
                              {t('userManager.remove_user')}
                            </button>
                          </div>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-24 flex flex-col items-center justify-center text-center px-6">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4 text-slate-300">
              <Users size={40} />
            </div>
            <h3 className="text-xl font-black text-primary-navy">{t('userManager.no_users')}</h3>
            <p className="text-slate-500 max-w-xs mt-2">{t('userManager.no_users_desc')}</p>
          </div>
        )}
      </div>

      {showEditModal && selectedUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-md bg-primary-navy/20 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-white">
            <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
              <div>
                <h3 className="text-xl font-black text-primary-navy">{t('userManager.edit_title')}</h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{t('userManager.edit_dni', { dni: selectedUser.dni })}</p>
              </div>
              <button onClick={() => setShowEditModal(false)} className="p-2 hover:bg-white rounded-xl text-slate-400 transition-all">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t('userManager.label_names')}</label>
                  <input defaultValue={selectedUser.first_name} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-primary-navy outline-none focus:ring-4 focus:ring-blue-600/5 focus:border-blue-600 transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t('userManager.label_email')}</label>
                  <input defaultValue={selectedUser.email} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-primary-navy outline-none focus:ring-4 focus:ring-blue-600/5 focus:border-blue-600 transition-all" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">{t('userManager.label_address')}</label>
                <input defaultValue={selectedUser.address} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-primary-navy outline-none focus:ring-4 focus:ring-blue-600/5 focus:border-blue-600 transition-all" />
              </div>

              <div className="pt-4 flex gap-3">
                <button onClick={() => setShowEditModal(false)} className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-200 transition-all">{t('admin.cancel')}</button>
                <button onClick={() => setShowEditModal(false)} className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-blue-600/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2">
                  <Check size={16} /> {t('userManager.save_changes')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showBioModal && selectedUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-md bg-primary-navy/20 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 text-center border-b border-slate-50">
              <div className="w-16 h-16 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-600 mx-auto mb-4">
                <Fingerprint size={32} />
              </div>
              <h3 className="text-xl font-black text-primary-navy">{t('userManager.bio_select_title')}</h3>
              <p className="text-sm text-slate-500 font-medium mt-1">{t('userManager.bio_select_desc', { name: selectedUser.first_name })}</p>
            </div>
            
            <div className="p-8 space-y-4">
              <button 
                onClick={() => {
                  setBioAction('face');
                  if (selectedUser.aws_face_id) setShowVerifyModal(true);
                  else setShowCamera(true);
                  setShowBioModal(false);
                }}
                className="w-full p-6 border-2 border-slate-100 rounded-[2rem] flex items-center gap-5 hover:border-blue-600 hover:bg-blue-50/50 transition-all group"
              >
                <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all">
                  <Camera size={24} />
                </div>
                <div className="text-left">
                  <p className="font-black text-primary-navy">{t('userManager.face_title')}</p>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('userManager.face_desc')}</p>
                </div>
              </button>

              <button 
                onClick={() => {
                  setBioAction('finger');
                  setShowVerifyModal(true);
                  setShowBioModal(false);
                }}
                className="w-full p-6 border-2 border-slate-100 rounded-[2rem] flex items-center gap-5 hover:border-purple-600 hover:bg-purple-50/50 transition-all group"
              >
                <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-all">
                  <Fingerprint size={24} />
                </div>
                <div className="text-left">
                  <p className="font-black text-primary-navy">{t('userManager.finger_title')}</p>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('userManager.finger_desc')}</p>
                </div>
              </button>
              <button onClick={() => setShowBioModal(false)} className="w-full py-4 text-slate-400 font-bold text-sm hover:text-slate-600 transition-all mt-2">{t('admin.cancel')}</button>
            </div>
          </div>
        </div>
      )}

      {showVerifyModal && selectedUser && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 backdrop-blur-xl bg-primary-navy/40 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-8 duration-500">
            <div className="p-8 text-center bg-red-600 text-white">
              <ShieldCheck size={48} className="mx-auto mb-4 animate-bounce" />
              <h3 className="text-xl font-black uppercase tracking-tight">{t('userManager.verify_required')}</h3>
              <p className="text-xs font-bold text-white/80 uppercase tracking-widest mt-1">{t('userManager.verify_auth')}</p>
            </div>
            
            <div className="p-10 text-center">
              <p className="text-slate-600 font-medium mb-8">
                {t('userManager.verify_desc', { name: selectedUser.first_name })}
              </p>

              <div className="w-32 h-32 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-8 border-4 border-slate-100 relative">
                {bioAction === 'face' ? <Camera size={40} className="text-slate-300" /> : <Fingerprint size={40} className="text-slate-300" />}
                {showVerifyModal && (
                  <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
                )}
              </div>

              <button 
                onClick={() => {
                  if (bioAction === 'face') {
                    setShowVerifyModal(false);
                    setTimeout(() => setShowCamera(true), 100);
                  } else handleFingerprintUpdate();
                }}
                disabled={savingBio}
                className="w-full py-5 bg-primary-navy text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-blue-900/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                {savingBio ? <Loader2 className="animate-spin" size={18} /> : null}
                {savingBio ? t('userManager.processing') : t('userManager.start_verify')}
              </button>
              <button onClick={() => {setShowVerifyModal(false); setStatusMsg({type:'', text:''});}} className="w-full py-4 text-slate-400 font-bold text-sm hover:text-red-500 transition-all mt-4">{t('userManager.cancel_op')}</button>
              
              {statusMsg.text && (
                <div className={`mt-6 p-4 rounded-2xl text-center font-bold text-xs ${
                  statusMsg.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
                }`}>
                  {statusMsg.text}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showCamera && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 backdrop-blur-md bg-primary-navy/20 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-xl rounded-[3.5rem] shadow-xl overflow-hidden animate-in zoom-in-95 duration-500 p-12 relative border border-white/20">
            <button onClick={() => {setShowCamera(false); setCapturedImage(null);}} className="absolute top-8 right-8 p-2 hover:bg-slate-50 rounded-full text-slate-400 transition-all">
              <X size={20} />
            </button>

            <div className="text-center mb-10">
              <h3 className="text-3xl font-black text-primary-navy tracking-tight mb-2">
                {!isVerified && selectedUser.aws_face_id ? t('userManager.cam_verify_title') : t('userManager.cam_reg_title')}
              </h3>
              <p className="text-sm font-bold text-slate-400 tracking-wide uppercase">
                {!isVerified && selectedUser.aws_face_id ? t('userManager.cam_verify_desc') : t('userManager.cam_reg_desc')}
              </p>
            </div>

            <div className="relative aspect-[4/3] bg-slate-100 rounded-[3rem] overflow-hidden shadow-inner mb-10">
              {!capturedImage ? (
                <Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg" className="w-full h-full object-cover" videoConstraints={{ facingMode: "user" }} />
              ) : (
                <img src={capturedImage} className="w-full h-full object-cover" alt="Captured" />
              )}
              <div className="absolute inset-0 border-[12px] border-white/10 pointer-events-none"></div>
            </div>

            <div className="space-y-4">
              {statusMsg.text && (
                <div className={`p-4 rounded-2xl text-center font-bold text-xs animate-in fade-in slide-in-from-top-2 duration-300 ${
                  statusMsg.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
                }`}>
                  {statusMsg.text}
                </div>
              )}
              
              {!capturedImage ? (
                <>
                  <button 
                    onClick={() => setCapturedImage(webcamRef.current.getScreenshot())}
                    className="w-full py-5 bg-primary-navy text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-blue-900/20 hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-3"
                  >
                    <Camera size={18} /> {t('userManager.capture_btn')}
                  </button>
                  <label className="w-full py-5 bg-white border border-slate-100 text-slate-500 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-sm hover:border-primary-navy hover:text-primary-navy transition-all flex items-center justify-center gap-3 cursor-pointer">
                    <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => setCapturedImage(reader.result);
                        reader.readAsDataURL(file);
                      }
                    }} />
                    <ShieldCheck size={18} className="opacity-40" /> {t('userManager.select_file')}
                  </label>
                </>
              ) : (
                <div className="space-y-3">
                  <button 
                    onClick={handleSaveBiometrics}
                    disabled={savingBio}
                    className={`w-full py-5 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                      !isVerified && selectedUser.aws_face_id ? 'bg-primary-navy shadow-blue-900/20' : 'bg-green-500 shadow-green-600/20'
                    }`}
                  >
                    {savingBio ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
                    {savingBio ? t('userManager.processing') : (!isVerified && selectedUser.aws_face_id ? t('userManager.validate_identity') : t('userManager.confirm_face'))}
                  </button>
                  <button onClick={() => setCapturedImage(null)} disabled={savingBio} className="w-full py-4 text-slate-400 font-bold text-[10px] uppercase tracking-widest hover:text-slate-600 transition-all disabled:opacity-30">
                    {t('userManager.retry')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
