import React, { useState } from 'react';
import { Users, Lock, Phone, ArrowRight, ShieldCheck, Mail, X } from 'lucide-react';
import { signIn, activateAccount, resetPassword } from '../lib/auth';

interface LoginProps {
  onLogin: (user: any) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [isActivating, setIsActivating] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Form States
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [tcId, setTcId] = useState('');
  const [resetEmail, setResetEmail] = useState(''); // Şifre sıfırlama için e-posta state'i

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    
    const { user, error: loginError } = await signIn(phone, password);
    if (loginError) setError(loginError);
    else if (user) onLogin(user);
    
    setLoading(false);
  };

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const { success, error: actError } = await activateAccount(tcId, phone, password);
    if (success) {
      setMessage("Hesabınız başarıyla aktifleştirildi. Şimdi giriş yapabilirsiniz.");
      setIsActivating(false);
    } else {
      setError(actError);
    }
    setLoading(false);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const { success, error: resetError } = await resetPassword(resetEmail);
    if (success) {
      setMessage("Geçici şifreniz e-posta adresinize gönderildi.");
      setIsResetting(false);
      setResetEmail('');
    } else {
      setError(resetError);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Logo ve Başlık */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl text-white shadow-lg mb-4">
            <Users size={32} />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">NİL-BEL-DER</h1>
          <p className="text-slate-500 mt-2 font-medium">Dernek Yönetim Sistemi</p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-100 overflow-hidden">
          {/* Sekme Seçimi */}
          <div className="flex border-b">
            <button 
              onClick={() => { setIsActivating(false); setError(null); setMessage(null); }}
              className={`flex-1 py-4 text-sm font-semibold transition-colors ${!isActivating ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Giriş Yap
            </button>
            <button 
              onClick={() => { setIsActivating(true); setError(null); setMessage(null); }}
              className={`flex-1 py-4 text-sm font-semibold transition-colors ${isActivating ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Hesap Aktifleştir
            </button>
          </div>

          <div className="p-8">
            {error && (
              <div className="mb-6 p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl text-sm flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                {error}
              </div>
            )}

            {message && (
              <div className="mb-6 p-4 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-xl text-sm flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                {message}
              </div>
            )}

            <form onSubmit={isActivating ? handleActivate : handleLogin} className="space-y-5">
              {isActivating && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">T.C. Kimlik No</label>
                  <div className="relative">
                    <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="text" required
                      value={tcId} onChange={(e) => setTcId(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                      placeholder="11 haneli TC no"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Telefon Numarası</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="tel" required
                    value={phone} onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="5xx xxx xx xx"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  {isActivating ? 'Yeni Şifre Belirleyin' : 'Şifre'}
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="password" required
                    value={password} onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              {!isActivating && (
                <div className="flex justify-end">
                  <button 
                    type="button"
                    onClick={() => { setIsResetting(true); setError(null); setMessage(null); }}
                    className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    Şifremi Unuttum
                  </button>
                </div>
              )}

              <button 
                type="submit" disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-100 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-70"
              >
                {loading ? 'İşleniyor...' : (isActivating ? 'Hesabı Aktifleştir' : 'Giriş Yap')}
                {!loading && <ArrowRight size={18} />}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Şifre Sıfırlama Modalı */}
      {isResetting && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden border border-slate-100">
            <div className="p-6 border-b flex items-center justify-between bg-slate-50/50">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <Mail size={18} className="text-blue-600" />
                Şifremi Unuttum
              </h3>
              <button 
                onClick={() => setIsResetting(false)} 
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleResetPassword} className="p-6 space-y-4">
              <div className="bg-blue-50 border border-blue-100 p-3 rounded-xl text-xs text-blue-700 leading-relaxed">
                Sistemde kayıtlı <strong>e-posta adresinizi</strong> girin. Yeni şifreniz bu adrese gönderilecektir.
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">
                  E-Posta Adresi
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="email" 
                    required
                    value={resetEmail} 
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="ornek@mail.com"
                  />
                </div>
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-slate-900 text-white font-bold py-3.5 rounded-xl hover:bg-slate-800 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? 'Gönderiliyor...' : 'Geçici Şifre Gönder'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}