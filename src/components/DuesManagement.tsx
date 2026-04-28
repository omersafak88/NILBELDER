import React, { useState, useEffect } from 'react';
import { Receipt, Save, Clock, CheckCircle, AlertCircle, Search, Edit2, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

export default function DuesManagement() {
  const [dues, setDues] = useState<any[]>([]);
  const [activeMembers, setActiveMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isBulk, setIsBulk] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null); // Düzenlenen kaydın ID'si
  const [accrualForm, setAccrualForm] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    amount: 1000,
    memberId: ''
  });

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      setLoading(true);
      const { data: mData } = await supabase.from('members').select('id, full_name').eq('is_active', true).order('full_name');
      if (mData) setActiveMembers(mData);
      
      const { data: dData } = await supabase.from('dues').select('*, members(full_name)').order('period_year', { ascending: false }).order('period_month', { ascending: false });
      if (dData) setDues(dData);
    } catch (err) { console.error("Veri yükleme hatası:", err); } finally { setLoading(false); }
  }

  const handleEdit = (due: any) => {
    setIsBulk(false);
    setEditingId(due.id);
    setAccrualForm({
      year: due.period_year,
      month: due.period_month,
      amount: due.amount,
      memberId: due.member_id
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => {
    setEditingId(null);
    setAccrualForm({
      year: new Date().getFullYear(),
      month: new Date().getMonth() + 1,
      amount: 1000,
      memberId: ''
    });
  };

  const handleAccrual = async () => {
    setProcessing(true);
    setMessage(null);
    try {
      const targetMembers = isBulk ? activeMembers : activeMembers.filter(m => m.id === accrualForm.memberId);
      if (!isBulk && !accrualForm.memberId) throw new Error('Lütfen bir üye seçin.');

      const dueDate = new Date(accrualForm.year, accrualForm.month - 1, 15).toISOString().split('T')[0];
      let successCount = 0;

      for (const member of targetMembers) {
        const payload: any = {
          member_id: member.id,
          amount: accrualForm.amount,
          period_year: accrualForm.year,
          period_month: accrualForm.month,
          due_date: dueDate,
          status: 'pending'
        };

        // Eğer tekil düzenleme yapılıyorsa ID'yi ekle ki yeni kayıt açmasın, mevcudu güncellesin
        if (editingId && !isBulk) {
          payload.id = editingId;
        }

        const { error } = await supabase.from('dues').upsert(payload, { 
          onConflict: 'member_id,period_year,period_month' 
        });

        if (!error) successCount++;
        else console.error(`Hata (${member.full_name}):`, error.message);
      }

      setMessage({ type: 'success', text: `${successCount} işlem başarıyla tamamlandı.` });
      resetForm();
      await loadData();
    } catch (err: any) { setMessage({ type: 'error', text: err.message }); } finally { setProcessing(false); }
  };

  const filtered = dues?.filter(d => d.members?.full_name?.toLowerCase().includes(searchTerm.toLowerCase())) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-slate-800 text-white rounded-2xl shadow-lg"><Receipt size={24} /></div>
        <h2 className="text-2xl font-bold text-slate-800">Aidat Tahakkuk Listesi</h2>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex justify-between items-center mb-6">
          <div className="flex gap-4">
            <button 
              onClick={() => { setIsBulk(true); resetForm(); }} 
              className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${isBulk ? 'bg-slate-800 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
            >
              Toplu Tahakkuk
            </button>
            <button 
              onClick={() => setIsBulk(false)} 
              className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${!isBulk ? 'bg-slate-800 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
            >
              Tekil {editingId ? 'Düzenleme' : 'Tahakkuk'}
            </button>
          </div>
          {editingId && (
            <button onClick={resetForm} className="text-rose-500 flex items-center gap-1 text-sm font-bold hover:bg-rose-50 px-3 py-1 rounded-lg">
              <X size={16} /> Vazgeç
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          {!isBulk && (
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase">Üye</label>
              <select 
                className="w-full p-2 border rounded-xl bg-white disabled:bg-slate-50" 
                value={accrualForm.memberId} 
                onChange={e => setAccrualForm({...accrualForm, memberId: e.target.value})}
                disabled={!!editingId} // Düzenleme modunda üye değiştirilemesin (opsiyonel)
              >
                <option value="">Seçiniz...</option>
                {activeMembers?.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
              </select>
            </div>
          )}
          <div className={isBulk ? "md:col-span-2" : ""}>
            <label className="text-[10px] font-bold text-slate-400 uppercase">Dönem</label>
            <div className="flex gap-2">
              <select className="flex-1 p-2 border rounded-xl bg-slate-50" value={accrualForm.month} onChange={e => setAccrualForm({...accrualForm, month: Number(e.target.value)})}>
                {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
              </select>
              <select className="w-24 p-2 border rounded-xl bg-slate-50" value={accrualForm.year} onChange={e => setAccrualForm({...accrualForm, year: Number(e.target.value)})}>
                {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase">Tutar (₺)</label>
            <input type="number" className="w-full p-2 border rounded-xl font-bold bg-slate-50" value={accrualForm.amount} onChange={e => setAccrualForm({...accrualForm, amount: Number(e.target.value)})} />
          </div>
          <button onClick={handleAccrual} disabled={processing} className={`${editingId ? 'bg-amber-600' : 'bg-slate-800'} text-white h-[42px] rounded-xl font-bold flex items-center justify-center gap-2 transition-colors`}>
            {processing ? <Clock className="animate-spin" size={18}/> : editingId ? <Edit2 size={18}/> : <Save size={18}/>} 
            {editingId ? 'Güncelle' : 'Kaydet'}
          </button>
        </div>
        {message && <div className={`mt-4 p-3 rounded-xl text-sm font-bold flex items-center gap-2 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>{message.text}</div>}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 bg-slate-50 border-b relative">
          <Search className="absolute left-7 top-7 text-slate-400" size={18} />
          <input type="text" placeholder="Üye adı ile ara..." className="w-full pl-10 pr-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-slate-200" onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase border-b">
              <tr>
                <th className="px-6 py-4">Üye Bilgisi</th>
                <th className="px-6 py-4 text-center">Dönem</th>
                <th className="px-6 py-4 text-right">Tutar</th>
                <th className="px-6 py-4 text-center">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={4} className="py-10 text-center text-slate-400">Yükleniyor...</td></tr>
              ) : filtered.length > 0 ? (
                filtered.map(d => (
                  <tr key={d.id} className={`hover:bg-slate-50 transition-colors ${editingId === d.id ? 'bg-amber-50' : ''}`}>
                    <td className="px-6 py-4 font-bold text-slate-700">{d.members?.full_name}</td>
                    <td className="px-6 py-4 text-center text-xs font-bold text-slate-500 uppercase">{MONTHS[d.period_month-1]} {d.period_year}</td>
                    <td className="px-6 py-4 text-right font-black text-slate-800">{d.amount?.toLocaleString('tr-TR')} TL</td>
                    <td className="px-6 py-4 text-center">
                      <button 
                        onClick={() => handleEdit(d)}
                        className="p-2 text-slate-400 hover:text-slate-800 hover:bg-white rounded-lg transition-all shadow-sm border border-transparent hover:border-slate-200"
                        title="Düzenle"
                      >
                        <Edit2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={4} className="py-10 text-center text-slate-400 font-medium">Kayıt bulunamadı.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}