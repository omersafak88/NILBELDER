import React, { useState, useEffect } from 'react';
import { Mail, Send, Users, AlertCircle, CheckCircle2, Loader2, Filter, ListChecks, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { sendBrevoEmail } from '../lib/email';

type MailOption = 'debt' | 'other';

export default function EmailManagement() {
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [status, setStatus] = useState<{ type: 'success' | 'error' | ''; msg: string }>({ type: '', msg: '' });
  
  // Seçenekler ve Filtreler
  const [mailOption, setMailOption] = useState<MailOption>('debt');
  const [debtLimit, setDebtLimit] = useState<number>(0);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  
  const [mailData, setMailData] = useState({
    subject: '',
    content: ''
  });

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    setLoading(true);
    // E-postası olan üyeleri çekiyoruz
    const { data } = await supabase
      .from('members')
      .select('id, full_name, email')
      .not('email', 'is', null);
    if (data) setMembers(data);
    setLoading(false);
  };

  const toggleMemberSelection = (id: string) => {
    setSelectedMemberIds(prev => 
      prev.includes(id) ? prev.filter(mid => mid !== id) : [...prev, id]
    );
  };

  const handleSendMail = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setStatus({ type: '', msg: '' });

    try {
      let finalRecipients: { email: string; name: string }[] = [];

      if (mailOption === 'debt') {
        // 1. Borç Limiti Seçeneği
        const { data: dues } = await supabase
          .from('dues')
          .select('member_id, amount')
          .eq('status', 'pending');

        const debtMap = new Map();
        dues?.forEach(d => {
          debtMap.set(d.member_id, (debtMap.get(d.member_id) || 0) + Number(d.amount));
        });

        const targetIds = Array.from(debtMap.entries())
          .filter(([_, total]) => total >= debtLimit)
          .map(([id, _]) => id);

        finalRecipients = members
          .filter(m => targetIds.includes(m.id))
          .map(m => ({ email: m.email, name: m.full_name }));

      } else {
        // 2. Diğer (Manuel Seçim) Seçeneği
        if (selectedMemberIds.length === 0) {
          throw new Error('Lütfen e-posta göndermek için en az bir üye seçin.');
        }
        finalRecipients = members
          .filter(m => selectedMemberIds.includes(m.id))
          .map(m => ({ email: m.email, name: m.full_name }));
      }

      if (finalRecipients.length === 0) {
        throw new Error('Belirlenen kriterlere uygun alıcı bulunamadı.');
      }

      await sendBrevoEmail(finalRecipients, mailData.subject, mailData.content.replace(/\n/g, '<br>'));
      
      setStatus({ type: 'success', msg: `${finalRecipients.length} kişiye e-posta başarıyla gönderildi.` });
      setMailData({ subject: '', content: '' });
      setSelectedMemberIds([]);
    } catch (error: any) {
      setStatus({ type: 'error', msg: error.message || 'E-posta gönderilemedi.' });
    } finally {
      setSending(false);
    }
  };

  const filteredMembers = members.filter(m => 
    m.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <Mail className="w-8 h-8 text-blue-600" />
        <h2 className="text-2xl font-bold text-slate-800">E-posta Gönderimi</h2>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
        <form onSubmit={handleSendMail} className="space-y-8">
          
          {/* Seçenekler Paneli */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setMailOption('debt')}
              className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${
                mailOption === 'debt' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-100 text-slate-500 hover:border-slate-200'
              }`}
            >
              <Filter className="w-6 h-6" />
              <span className="font-bold text-sm text-center">Birikmiş Aidat Borcu Bilgilendirme</span>
            </button>

            <button
              type="button"
              onClick={() => setMailOption('other')}
              className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${
                mailOption === 'other' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-100 text-slate-500 hover:border-slate-200'
              }`}
            >
              <ListChecks className="w-6 h-6" />
              <span className="font-bold text-sm">Diğer (Manuel Seçim)</span>
            </button>
          </div>

          {/* Dinamik Filtre Alanları */}
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
            {mailOption === 'debt' ? (
              <div className="space-y-3">
                <label className="text-sm font-bold text-slate-600 uppercase tracking-wider">Borç Limiti (TL)</label>
                <div className="flex items-center gap-4">
                  <input
                    type="number"
                    className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Örn: 500"
                    value={debtLimit}
                    onChange={(e) => setDebtLimit(Number(e.target.value))}
                  />
                  <p className="text-sm text-slate-500 font-medium">Bu tutar ve üzerinde borcu olanlara gider.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-bold text-slate-600 uppercase tracking-wider">Üye Seçimi ({selectedMemberIds.length} seçili)</label>
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Üye ara..."
                      className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-lg outline-none"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
                <div className="max-h-48 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-2 pr-2">
                  {filteredMembers.map(m => (
                    <label key={m.id} className="flex items-center gap-3 p-2 bg-white rounded-lg border border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 rounded text-blue-600"
                        checked={selectedMemberIds.includes(m.id)}
                        onChange={() => toggleMemberSelection(m.id)}
                      />
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-700">{m.full_name}</span>
                        <span className="text-[10px] text-slate-400">{m.email}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            {status.msg && (
              <div className={`p-4 rounded-xl flex items-center gap-3 border ${
                status.type === 'success' ? 'bg-green-50 border-green-100 text-green-700' : 'bg-red-50 border-red-100 text-red-700'
              }`}>
                {status.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                <p className="text-sm font-medium">{status.msg}</p>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Konu</label>
              <input
                type="text"
                required
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="E-posta konusu..."
                value={mailData.subject}
                onChange={(e) => setMailData({ ...mailData, subject: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Mesaj İçeriği</label>
              <textarea
                required
                rows={6}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Mesajınızı buraya yazın..."
                value={mailData.content}
                onChange={(e) => setMailData({ ...mailData, content: e.target.value })}
              />
            </div>

            <button
              type="submit"
              disabled={sending || loading}
              className="w-full py-4 bg-slate-800 text-white rounded-xl font-bold text-lg hover:bg-slate-700 active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {sending ? (
                <><Loader2 className="w-6 h-6 animate-spin" /> Gönderiliyor...</>
              ) : (
                <><Send className="w-6 h-6" /> Gönderimi Başlat</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}