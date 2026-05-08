import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { 
  UserPlus, User, Mail, CreditCard, ChevronLeft, ChevronRight, 
  AlertCircle, CheckCircle, Loader2, MapPin, Calendar, Phone
} from 'lucide-react';

import countriesData from '../data/countries.json';
import departmentsData from '../data/departments.json';
import provincesData from '../data/provinces.json';
import districtsData from '../data/districts.json';

export default function Register({ inDashboard = false }) {
  const { t } = useTranslation();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    first_name: '',
    paternal_last_name: '',
    maternal_last_name: '',
    dob: '',
    dni: '',
    email: '',
    phone: '',
    country_residence: 'Perú',
    department_id: '',
    province_id: '',
    district_id: '',
    address: '',
    role_id: 2
  });

  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  // Derived state for cascading selects
  const isPeru = formData.country_residence === 'Perú';
  const availableProvinces = provincesData.filter(p => p.id_depa === formData.department_id);
  const availableDistricts = districtsData.filter(d => d.id_prov === formData.province_id);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError(''); // Clear error on change
  };

  const handleDepartmentChange = (e) => {
    setFormData(prev => ({
      ...prev,
      department_id: e.target.value,
      province_id: '', // reset cascade
      district_id: ''
    }));
  };

  const handleProvinceChange = (e) => {
    setFormData(prev => ({
      ...prev,
      province_id: e.target.value,
      district_id: '' // reset cascade
    }));
  };

  const calculateAge = (dobString) => {
    if (!dobString) return 0;
    const today = new Date();
    const birthDate = new Date(dobString);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const nextStep = () => {
    setError('');
    if (step === 1) {
      if (!formData.first_name || !formData.paternal_last_name || !formData.maternal_last_name || !formData.dni || !formData.dob) {
        setError(t('register.err_required'));
        return;
      }
      if (formData.dni.length !== 8) {
        setError(t('register.err_dni_length'));
        return;
      }
      const age = calculateAge(formData.dob);
      if (age < 18) {
        setError(t('register.err_age'));
        return;
      }
    }
    if (step === 2) {
      if (isPeru && (!formData.department_id || !formData.province_id || !formData.district_id)) {
        setError(t('register.err_location'));
        return;
      }
    }
    setStep(s => s + 1);
  };

  const prevStep = () => {
    setError('');
    setStep(s => s - 1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await axios.post('http://localhost/api/usuarios/', formData);
      setStep(4); // Move to success step
    } catch (err) {
      setError(err.response?.data?.error || 'Error al registrar el ciudadano');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      first_name: '',
      paternal_last_name: '',
      maternal_last_name: '',
      dob: '',
      dni: '',
      email: '',
      phone: '',
      country_residence: 'Perú',
      department_id: '',
      province_id: '',
      district_id: '',
      address: '',
      role_id: 2
    });
    setStep(1);
    setSuccess(false);
  };

  // UI Components
  const renderStepper = () => (
    <div className="flex items-center justify-center mb-10">
      {[1, 2, 3].map((num, i) => (
        <div key={num} className="flex items-center">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all duration-300 ${
            step >= num ? 'bg-[#1e3a8a] text-white shadow-lg' : 'bg-slate-100 text-slate-400'
          }`}>
            {num}
          </div>
          {i < 2 && (
            <div className={`w-12 h-1 transition-all duration-300 ${
              step > num ? 'bg-[#1e3a8a]' : 'bg-slate-100'
            }`} />
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div className={`animate-fade-in ${inDashboard ? 'p-14 max-w-4xl mx-auto' : 'min-h-screen flex items-center justify-center p-6 bg-cover bg-center relative'}`}
      style={!inDashboard ? { backgroundImage: 'linear-gradient(rgba(15, 23, 42, 0.6), rgba(15, 23, 42, 0.6)), url(/bg_voting_geometric.png)' } : {}}>
      
      <div className={`w-full max-w-2xl ${inDashboard ? '' : 'flat-card !p-0 overflow-hidden shadow-2xl bg-white rounded-3xl'}`}>
        
        {!inDashboard && (
          <div className="mb-10 text-center">
            <h1 className="text-4xl font-black text-white mb-2 tracking-tight">{t('register.title')}</h1>
            <p className="text-white/80 font-medium tracking-wide">{t('register.subtitle')}</p>
          </div>
        )}

        <div className={`transition-all duration-500 bg-white ${inDashboard ? 'flat-card !p-10' : 'p-12'}`}>
          
          {step !== 4 && (
            <>
              <div className="mb-8 text-center">
                <h2 className="text-2xl font-black text-[#1e3a8a] mb-1">
                  {t('register.new_voter')}
                </h2>
                <p className="text-slate-500 font-medium text-sm">{t('register.new_voter_desc')}</p>
              </div>
              {renderStepper()}
            </>
          )}

          {error && (
            <div className="animate-fade-in mb-8 p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm flex items-center gap-3 font-medium">
              <AlertCircle size={18} /> {error}
            </div>
          )}

          <div className="min-h-[300px]">
            {/* STEP 1 */}
            {step === 1 && (
              <div className="animate-fade-in space-y-6">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-[#1e3a8a] uppercase tracking-wider px-1">{t('register.country')}</label>
                  <div className="input-wrapper">
                    <MapPin size={18} className="input-icon" />
                    <select name="country_residence" className="glass-input" value={formData.country_residence} onChange={handleChange}>
                      {countriesData.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-[#1e3a8a] uppercase tracking-wider px-1">{t('register.dni')}</label>
                    <div className="input-wrapper">
                      <CreditCard size={18} className="input-icon" />
                      <input name="dni" type="text" className="glass-input" maxLength={8} value={formData.dni} onChange={(e) => setFormData({...formData, dni: e.target.value.replace(/\D/g, '')})} placeholder={t('register.dni_placeholder')} />
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-[#1e3a8a] uppercase tracking-wider px-1">{t('register.dob')}</label>
                    <div className="input-wrapper">
                      <Calendar size={18} className="input-icon" />
                      <input name="dob" type="date" className="glass-input" value={formData.dob} onChange={handleChange} />
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-[#1e3a8a] uppercase tracking-wider px-1">{t('register.first_name')}</label>
                  <div className="input-wrapper">
                    <User size={18} className="input-icon" />
                    <input name="first_name" type="text" className="glass-input" value={formData.first_name} onChange={handleChange} placeholder={t('register.first_name_placeholder')} />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-[#1e3a8a] uppercase tracking-wider px-1">{t('register.paternal_last_name')}</label>
                    <div className="input-wrapper">
                      <input name="paternal_last_name" type="text" className="glass-input !pl-4" value={formData.paternal_last_name} onChange={handleChange} placeholder={t('register.paternal_placeholder')} />
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-[#1e3a8a] uppercase tracking-wider px-1">{t('register.maternal_last_name')}</label>
                    <div className="input-wrapper">
                      <input name="maternal_last_name" type="text" className="glass-input !pl-4" value={formData.maternal_last_name} onChange={handleChange} placeholder={t('register.maternal_placeholder')} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2 */}
            {step === 2 && (
              <div className="animate-fade-in space-y-6">
                {isPeru ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex flex-col gap-2">
                        <label className="text-xs font-bold text-[#1e3a8a] uppercase tracking-wider px-1">{t('register.department')}</label>
                        <select className="glass-input !pl-4" value={formData.department_id} onChange={handleDepartmentChange}>
                          <option value="">{t('register.select')}</option>
                          {departmentsData.map(d => <option key={d.id_depa} value={d.id_depa}>{d.name}</option>)}
                        </select>
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-xs font-bold text-[#1e3a8a] uppercase tracking-wider px-1">{t('register.province')}</label>
                        <select className="glass-input !pl-4" value={formData.province_id} onChange={handleProvinceChange} disabled={!formData.department_id}>
                          <option value="">{t('register.select')}</option>
                          {availableProvinces.map(p => <option key={p.id_prov} value={p.id_prov}>{p.name}</option>)}
                        </select>
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-xs font-bold text-[#1e3a8a] uppercase tracking-wider px-1">{t('register.district')}</label>
                        <select name="district_id" className="glass-input !pl-4" value={formData.district_id} onChange={handleChange} disabled={!formData.province_id}>
                          <option value="">{t('register.select')}</option>
                          {availableDistricts.map(d => <option key={d.id_dist} value={d.id_dist}>{d.name}</option>)}
                        </select>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                    <MapPin className="mx-auto text-slate-300 mb-2" size={32} />
                    <p className="text-slate-500 font-medium text-sm">{t('register.abroad_residence')}</p>
                  </div>
                )}
                
                <div className="flex flex-col gap-2 mt-6">
                  <label className="text-xs font-bold text-[#1e3a8a] uppercase tracking-wider px-1">{t('register.address')}</label>
                  <div className="input-wrapper">
                    <input name="address" type="text" className="glass-input !pl-4" value={formData.address} onChange={handleChange} placeholder={t('register.address_placeholder')} />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3 */}
            {step === 3 && (
              <div className="animate-fade-in space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-[#1e3a8a] uppercase tracking-wider px-1 flex justify-between">
                      {t('register.phone')} <span className="text-slate-400">{t('register.optional')}</span>
                    </label>
                    <div className="input-wrapper">
                      <Phone size={18} className="input-icon" />
                      <input name="phone" type="text" className="glass-input" value={formData.phone} onChange={handleChange} placeholder={t('register.phone_placeholder')} />
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold text-[#1e3a8a] uppercase tracking-wider px-1 flex justify-between">
                      {t('register.email')} <span className="text-slate-400">{t('register.optional')}</span>
                    </label>
                    <div className="input-wrapper">
                      <Mail size={18} className="input-icon" />
                      <input name="email" type="email" className="glass-input" value={formData.email} onChange={handleChange} placeholder={t('register.email_placeholder')} />
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-100 p-6 rounded-[2rem]">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">{t('register.summary')}</h4>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm border border-slate-100">
                      <User className="text-[#1e3a8a]" size={20} />
                    </div>
                    <div>
                      <p className="font-black text-lg text-[#1e3a8a] leading-tight">
                        {formData.first_name} {formData.paternal_last_name} {formData.maternal_last_name}
                      </p>
                      <p className="text-sm font-medium text-slate-500">DNI: {formData.dni}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 4 (Success) */}
            {step === 4 && (
              <div className="animate-fade-in flex flex-col items-center justify-center text-center py-10">
                <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mb-6 shadow-xl shadow-green-100/50">
                  <CheckCircle size={48} className="text-green-500" />
                </div>
                <h2 className="text-3xl font-black text-[#1e3a8a] mb-2">{t('register.success_title')}</h2>
                <p className="text-slate-500 font-medium mb-10 max-w-sm">
                  {t('register.success_desc')}
                </p>
                <button onClick={resetForm} className="glass-button !bg-[#1e3a8a] !text-white !px-10">
                  <UserPlus size={18} /> {t('register.register_another')}
                </button>
              </div>
            )}
          </div>

          {/* Navigation Buttons */}
          {step < 4 && (
            <div className="flex gap-4 mt-8 pt-8 border-t border-slate-100">
              {step > 1 ? (
                <button type="button" onClick={prevStep} className="glass-button secondary !w-auto px-8">
                  <ChevronLeft size={18} /> {t('register.back')}
                </button>
              ) : (
                !inDashboard && (
                  <Link to="/" className="glass-button secondary !w-auto px-8">
                    <ChevronLeft size={18} /> {t('register.go_back')}
                  </Link>
                )
              )}
              
              {step < 3 ? (
                <button type="button" onClick={nextStep} className="glass-button flex-1 bg-[#1e3a8a]">
                  {t('register.next')} <ChevronRight size={18} />
                </button>
              ) : (
                <button type="button" onClick={handleSubmit} className="glass-button flex-1 bg-green-600 hover:bg-green-700 border-none" disabled={isLoading}>
                  {isLoading ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle size={18} />}
                  {isLoading ? t('register.submitting') : t('register.submit')}
                </button>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
