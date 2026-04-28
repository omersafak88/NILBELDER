import React, { useState, useEffect } from 'react';
import { Wallet, CreditCard, TrendingUp, Info, DollarSign, Receipt } from 'lucide-react';
import { supabase } from '../lib/supabase';

const formatCurrency = (amount: number) => amount.toLocaleString('tr-TR', { minimumFractionDigits: 2 });

export default function MemberFinancials() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalDues: 0, paidDues: 0, pendingDues: 0, totalDonations: 0 });
  const [ledger, setLedger] = useState<any[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadFinancialData = async () => {
      try {
        setLoading(true);
        setError('');

        // 1. DİĞER DOSYALARLA AYNI YÖNTEM: localStorage üzerinden kullanıcıyı al
        const userStr = localStorage.getItem('association_user');
        const userData = userStr ? JSON.parse(userStr) : null;
        
        // Üye ID'sine erişim (Sistemin standart hiyerarşisi)
        const memberId = userData?.member?.id || userData?.id;

        if (!memberId) {
          setError('Oturum bilgisi doğrulanamadı. Lütfen tekrar giriş yapın.');
          setLoading(false);
          return;
        }

        // 2. Kategorileri Çek (Aidat ve Bağış ID'lerini bulmak için)
        const { data: categories } = await supabase.from('transaction_categories').select('id, name');
        const aidatCatId = categories?.find(c => c.name === 'Aidat')?.id;
        const bagisCatId = categories?.find(c => c.name === 'Bağış')?.id;

        // 3. Verileri Paralel Çek
        const [duesRes, transRes] = await Promise.all([
          supabase.from('dues').select('*').eq('member_id', memberId),
          supabase.from('transactions').select('*, transaction_categories(name)').eq('member_id', memberId)
        ]);

        const dues = duesRes.data || [];
        const trans = transRes.data || [];

        // 4. Hesaplamalar
        const totalAccrued = dues.reduce((s, d) => s + Number(d.amount), 0);
        const totalPaidAidat = trans
          .filter(t => t.category_id === aidatCatId && t.type === 'income')
          .reduce((s, t) => s + Number(t.amount), 0);
        const totalDonations = trans
          .filter(t => t.category_id === bagisCatId && t.type === 'income')
          .reduce((s, t) => s + Number(t.amount), 0);

        // 5. Döküm Hazırlama
        const combinedLedger = [
          ...dues.map(d => ({
            date: d.due_date || d.created_at,
            label: 'Aidat Tahakkuku (Borç)',
            amount: d.amount,
            type: 'debt',
            category: 'Aidat'
          })),
          ...trans.map(t => ({
            date: t.transaction_date,
            label: t.category_id === bagisCatId ? 'Bağış Ödemesi' : 'Aidat Ödemesi',
            amount: t.amount,
            type: 'payment',
            category: t.transaction_categories?.name
          }))
        ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        setStats({ 
          totalDues: totalAccrued, 
          paidDues: totalPaidAidat, 
          pendingDues: totalAccrued - totalPaidAidat, 
          totalDonations: totalDonations 
        });
        setLedger(combinedLedger);
      } catch (err: any) {
        setError('Teknik bir sorun oluştu: ' + err.message);
      } finally {
        setLoading(false);
      }
    };

    loadFinancialData();
  }, []);

  if (loading) return <div className="p-8 text-center text-slate-500 font-bold">Yükleniyor...</div>;
  if (error) return <div className="p-8 text-center"><div className="bg-rose-50 text-rose-600 p-4 rounded-xl border border-rose-100 font-bold">{error}</div></div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg"><Wallet className="w-6 h-6" /></div>
        <h2 className="text-2xl font-bold text-slate-800">Borç ve Ödeme Durumum</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Tahakkuk Eden', val: stats.totalDues, color: 'text-slate-600', icon: CreditCard },
          { label: 'Ödenen Aidat', val: stats.paidDues, color: 'text-emerald-600', icon: TrendingUp },
          { label: 'Kalan Borç', val: stats.pendingDues, color: 'text-rose-600', icon: Info },
          { label: 'Toplam Bağışım', val: stats.totalDonations, color: 'text-blue-600', icon: DollarSign }
        ].map((item, idx) => (
          <div key={idx} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex items-center gap-2 text-slate-400 mb-2 font-bold text-[10px] uppercase"><item.icon size={14} /> {item.label}</div>
            <p className={`text-xl font-black ${item.color}`}>{formatCurrency(item.val)} TL</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 bg-slate-50 border-b font-bold text-slate-700 flex items-center gap-2"><Receipt className="w-4 h-4" /> Finansal Hareket Detayları</div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/50 text-slate-400 uppercase text-[10px] font-bold">
              <tr><th className="px-6 py-3">Tarih</th><th className="px-6 py-3">Açıklama</th><th className="px-6 py-3 text-right">Borç</th><th className="px-6 py-3 text-right">Ödeme</th></tr>
            </thead>
            <tbody className="divide-y">
              {ledger.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="px-6 py-4 text-slate-500">{new Date(item.date).toLocaleDateString('tr-TR')}</td>
                  <td className="px-6 py-4"><div className="font-bold text-slate-700">{item.label}</div><div className="text-[10px] text-slate-400 uppercase">{item.category}</div></td>
                  <td className="px-6 py-4 text-right font-bold text-rose-600">{item.type === 'debt' ? formatCurrency(item.amount) : '-'}</td>
                  <td className="px-6 py-4 text-right font-bold text-emerald-600">{item.type === 'payment' ? formatCurrency(item.amount) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}