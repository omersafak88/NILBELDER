// project/src/components/MemberLedger.tsx
import { useState, useEffect } from 'react';
import { BookOpen, Search, X, User, TrendingUp, TrendingDown, DollarSign, Receipt, MousePointerClick } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface MemberSummary {
  id: string;
  full_name: string;
  totalDuesAccrued: number;
  totalDuesPaid: number;
  totalDuesOwed: number;
  totalDonationsMade: number;
  totalSocialAidReceived: number;
}

type TabType = 'accrual' | 'payment' | 'donation' | 'expense';

export default function MemberLedger({ isAdmin }: { isAdmin: boolean }) {
  const [members, setMembers] = useState<MemberSummary[]>([]);
  const [allDues, setAllDues] = useState<any[]>([]); 
  const [allTransactions, setAllTransactions] = useState<any[]>([]); 
  const [categories, setCategories] = useState<any[]>([]); 
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Seçili üye ve aktif sekme durumu
  const [selectedMember, setSelectedMember] = useState<MemberSummary | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('accrual');

  useEffect(() => {
    if (isAdmin) loadMemberLedger();
  }, [isAdmin]);

  // Yardımcı Fonksiyon: Limitsiz veri çekme
  const fetchAllFromTable = async (tableName: string, query: string = '*') => {
    let allData: any[] = [];
    let from = 0;
    const step = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from(tableName)
        .select(query)
        .range(from, from + step - 1);

      if (error || !data || data.length === 0) {
        hasMore = false;
      } else {
        allData = [...allData, ...data];
        from += step;
        if (data.length < step) hasMore = false;
      }
    }
    return allData;
  };

  const loadMemberLedger = async () => {
    setLoading(true);

    const [membersRes, categoriesRes] = await Promise.all([
      supabase.from('members').select('id, full_name').eq('is_active', true).order('full_name'),
      supabase.from('transaction_categories').select('id, name').in('name', ['Aidat', 'Bağış'])
    ]);

    const duesData = await fetchAllFromTable('dues', '*');
    const transData = await fetchAllFromTable('transactions', '*');

    if (!membersRes.data) return setLoading(false);
    
    setAllDues(duesData);
    setAllTransactions(transData);
    if (categoriesRes.data) setCategories(categoriesRes.data);

    const aidatCatId = categoriesRes.data?.find(c => c.name === 'Aidat')?.id;
    const bagisCatId = categoriesRes.data?.find(c => c.name === 'Bağış')?.id;

    const duesTotalMap = new Map<string, number>();
    const paidTotalMap = new Map<string, number>();
    const donationTotalMap = new Map<string, number>();
    const expenseTotalMap = new Map<string, number>();

    duesData.forEach(d => {
      duesTotalMap.set(d.member_id, (duesTotalMap.get(d.member_id) || 0) + Number(d.amount || 0));
    });

    transData.forEach(t => {
      const amount = Number(t.amount || 0);
      if (t.type === 'income') {
        if (t.category_id === aidatCatId) {
          paidTotalMap.set(t.member_id, (paidTotalMap.get(t.member_id) || 0) + amount);
        } else if (t.category_id === bagisCatId) {
          donationTotalMap.set(t.member_id, (donationTotalMap.get(t.member_id) || 0) + amount);
        }
      } else if (t.type === 'expense') {
        expenseTotalMap.set(t.member_id, (expenseTotalMap.get(t.member_id) || 0) + amount);
      }
    });

    const summaries: MemberSummary[] = membersRes.data.map(m => {
      const accrued = duesTotalMap.get(m.id) || 0;
      const paid = paidTotalMap.get(m.id) || 0;
      return {
        id: m.id,
        full_name: m.full_name,
        totalDuesAccrued: accrued,
        totalDuesPaid: paid,
        totalDuesOwed: accrued - paid,
        totalDonationsMade: donationTotalMap.get(m.id) || 0,
        totalSocialAidReceived: expenseTotalMap.get(m.id) || 0
      };
    });

    setMembers(summaries);
    setLoading(false);
  };

  const handleOpenDetail = (member: MemberSummary) => {
    setSelectedMember(member);
    setActiveTab('accrual'); // Her açılışta varsayılan olarak tahakkuku göster
  };

  const filtered = members.filter(m => m.full_name.toLowerCase().includes(searchTerm.toLowerCase()));

  // --- DETAY VERİLERİ ---
  const selectedMemberDues = selectedMember 
    ? allDues.filter(d => d.member_id === selectedMember.id).sort((a, b) => b.period_year - a.period_year || b.period_month - a.period_month)
    : [];

  const aidatCatId = categories.find(c => c.name === 'Aidat')?.id;
  const bagisCatId = categories.find(c => c.name === 'Bağış')?.id;

  const memberTransactions = selectedMember && allTransactions.length > 0
    ? allTransactions
        .filter(t => t.member_id === selectedMember.id)
        .sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime())
    : [];

  const paymentsList = memberTransactions.filter(t => t.type === 'income' && t.category_id === aidatCatId);
  const donationsList = memberTransactions.filter(t => t.type === 'income' && t.category_id === bagisCatId);
  const receivedAidList = memberTransactions.filter(t => t.type === 'expense');

  if (!isAdmin) return <div className="p-8 text-center text-slate-500 font-medium">Yetkiniz yok.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-slate-800 text-white rounded-2xl shadow-lg"><BookOpen className="w-6 h-6" /></div>
        <h2 className="text-2xl font-bold text-slate-800">Üye Kütüğü</h2>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 bg-slate-50 border-b">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-2.5 text-slate-400 w-5 h-5" />
            <input type="text" placeholder="Üye adı..." className="w-full pl-10 pr-4 py-2 border rounded-xl outline-none" onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/50 text-slate-400 uppercase text-[10px] font-bold">
              <tr>
                <th className="px-6 py-4">Üye</th>
                <th className="px-6 py-4 text-right">Tahakkuk</th>
                <th className="px-6 py-4 text-right">Ödenen</th>
                <th className="px-6 py-4 text-right">Borç</th>
                <th className="px-6 py-4 text-right">Bağış</th>
                <th className="px-6 py-4 text-right">Yardım</th>
                <th className="px-6 py-4 text-center">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={7} className="py-12 text-center text-slate-400 animate-pulse">Veritabanı taranıyor...</td></tr>
              ) : filtered.map(m => (
                <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-bold text-slate-800">{m.full_name}</td>
                  <td className="px-6 py-4 text-right font-medium">{m.totalDuesAccrued.toFixed(2)} TL</td>
                  <td className="px-6 py-4 text-right text-emerald-600 font-bold">{m.totalDuesPaid.toFixed(2)} TL</td>
                  <td className={`px-6 py-4 text-right font-black ${m.totalDuesOwed > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>{m.totalDuesOwed.toFixed(2)} TL</td>
                  <td className="px-6 py-4 text-right text-blue-600 font-bold">{m.totalDonationsMade.toFixed(2)} TL</td>
                  <td className="px-6 py-4 text-right text-orange-600 font-bold">{m.totalSocialAidReceived.toFixed(2)} TL</td>
                  <td className="px-6 py-4 text-center">
                    <button onClick={() => handleOpenDetail(m)} className="px-3 py-1 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-800 hover:text-white text-xs font-bold transition-colors">DETAY</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedMember && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200">
            
            {/* Modal Header */}
            <div className="p-6 border-b flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-800 text-white rounded-lg"><User className="w-5 h-5" /></div>
                <div>
                  <h3 className="text-xl font-bold text-slate-800">{selectedMember.full_name}</h3>
                  <p className="text-xs text-slate-500 font-medium">Finansal Hareket Dökümü</p>
                </div>
              </div>
              <button onClick={() => setSelectedMember(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors"><X className="text-slate-500 w-5 h-5" /></button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              
              {/* Sekme Butonları (Kartlar) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* 1. Tahakkuk Kartı */}
                <button 
                  onClick={() => setActiveTab('accrual')}
                  className={`p-3 rounded-xl border text-left transition-all ${activeTab === 'accrual' ? 'bg-slate-800 text-white ring-2 ring-slate-400 ring-offset-2 scale-105 shadow-lg' : 'bg-slate-50 hover:bg-slate-100 text-slate-800'}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className={`text-[10px] font-bold uppercase ${activeTab === 'accrual' ? 'text-slate-300' : 'text-slate-400'}`}>Tahakkuk</p>
                    {activeTab === 'accrual' && <Receipt className="w-3 h-3 text-slate-300" />}
                  </div>
                  <p className="text-sm font-black">{selectedMember.totalDuesAccrued.toFixed(2)} TL</p>
                </button>

                {/* 2. Ödenen Kartı */}
                <button 
                  onClick={() => setActiveTab('payment')}
                  className={`p-3 rounded-xl border text-left transition-all ${activeTab === 'payment' ? 'bg-emerald-600 text-white ring-2 ring-emerald-400 ring-offset-2 scale-105 shadow-lg' : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-100'}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className={`text-[10px] font-bold uppercase ${activeTab === 'payment' ? 'text-emerald-100' : 'text-emerald-600'}`}>Ödenen</p>
                    {activeTab === 'payment' && <TrendingUp className="w-3 h-3 text-emerald-100" />}
                  </div>
                  <p className="text-sm font-black">{selectedMember.totalDuesPaid.toFixed(2)} TL</p>
                </button>

                {/* 3. Bağış Kartı */}
                <button 
                  onClick={() => setActiveTab('donation')}
                  className={`p-3 rounded-xl border text-left transition-all ${activeTab === 'donation' ? 'bg-blue-600 text-white ring-2 ring-blue-400 ring-offset-2 scale-105 shadow-lg' : 'bg-blue-50 hover:bg-blue-100 text-blue-800 border-blue-100'}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className={`text-[10px] font-bold uppercase ${activeTab === 'donation' ? 'text-blue-100' : 'text-blue-600'}`}>Bağış</p>
                    {activeTab === 'donation' && <DollarSign className="w-3 h-3 text-blue-100" />}
                  </div>
                  <p className="text-sm font-black">{selectedMember.totalDonationsMade.toFixed(2)} TL</p>
                </button>

                {/* 4. Yardım Kartı */}
                <button 
                  onClick={() => setActiveTab('expense')}
                  className={`p-3 rounded-xl border text-left transition-all ${activeTab === 'expense' ? 'bg-orange-600 text-white ring-2 ring-orange-400 ring-offset-2 scale-105 shadow-lg' : 'bg-orange-50 hover:bg-orange-100 text-orange-800 border-orange-100'}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className={`text-[10px] font-bold uppercase ${activeTab === 'expense' ? 'text-orange-100' : 'text-orange-600'}`}>Yardım</p>
                    {activeTab === 'expense' && <TrendingDown className="w-3 h-3 text-orange-100" />}
                  </div>
                  <p className="text-sm font-black">{selectedMember.totalSocialAidReceived.toFixed(2)} TL</p>
                </button>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-400">
                <MousePointerClick className="w-3 h-3" />
                <span>Detayını görmek istediğiniz başlığa tıklayınız.</span>
              </div>

              {/* Dinamik Liste Alanı */}
              <div className="border rounded-2xl overflow-hidden bg-white shadow-sm min-h-[300px]">
                
                {/* 1. TAHAKKUK LİSTESİ */}
                {activeTab === 'accrual' && (
                  <div>
                    <div className="px-4 py-3 bg-slate-50 border-b flex items-center justify-between">
                      <h4 className="font-bold text-slate-700 text-sm uppercase flex items-center gap-2">
                        <Receipt className="w-4 h-4" /> Tahakkuk Geçmişi
                      </h4>
                      <span className="text-xs font-bold text-slate-400">{selectedMemberDues.length} Kayıt</span>
                    </div>
                    <div className="overflow-y-auto max-h-[300px]">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 text-slate-400 font-bold uppercase sticky top-0 shadow-sm z-10">
                          <tr>
                            <th className="px-4 py-3">Dönem</th>
                            <th className="px-4 py-3 text-right">Tutar</th>
                            <th className="px-4 py-3 text-center">Durum</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {selectedMemberDues.length === 0 ? (
                            <tr><td colSpan={3} className="px-4 py-8 text-slate-400 text-center">Kayıt bulunamadı.</td></tr>
                          ) : selectedMemberDues.map(d => (
                            <tr key={d.id} className="hover:bg-slate-50">
                              <td className="px-4 py-3 font-medium text-slate-600">{d.period_month}/{d.period_year}</td>
                              <td className="px-4 py-3 font-bold text-right text-slate-800">{d.amount.toFixed(2)} TL</td>
                              <td className="px-4 py-3 text-center">
                                <span className={`px-2 py-1 rounded-md text-[10px] font-bold ${d.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                  {d.status === 'paid' ? 'ÖDENDİ' : 'BEKLEYOR'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 2. ÖDEME LİSTESİ */}
                {activeTab === 'payment' && (
                  <div>
                     <div className="px-4 py-3 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between">
                      <h4 className="font-bold text-emerald-700 text-sm uppercase flex items-center gap-2">
                        <TrendingUp className="w-4 h-4" /> Yapılan Aidat Ödemeleri
                      </h4>
                      <span className="text-xs font-bold text-emerald-600 opacity-70">{paymentsList.length} İşlem</span>
                    </div>
                    <div className="overflow-y-auto max-h-[300px]">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-emerald-50 text-emerald-600 font-bold uppercase sticky top-0 shadow-sm z-10">
                          <tr>
                            <th className="px-4 py-3">Tarih</th>
                            <th className="px-4 py-3">Açıklama</th>
                            <th className="px-4 py-3 text-right">Tutar</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-emerald-50">
                          {paymentsList.length === 0 ? (
                            <tr><td colSpan={3} className="px-4 py-8 text-emerald-400/70 text-center">Ödeme kaydı yok.</td></tr>
                          ) : paymentsList.map(t => (
                            <tr key={t.id} className="hover:bg-emerald-50/50">
                              <td className="px-4 py-3 font-medium text-slate-600">{new Date(t.transaction_date).toLocaleDateString('tr-TR')}</td>
                              <td className="px-4 py-3 text-slate-500">{t.description || 'Aidat Ödemesi'}</td>
                              <td className="px-4 py-3 text-right font-black text-emerald-600">{t.amount.toFixed(2)} TL</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 3. BAĞIŞ LİSTESİ */}
                {activeTab === 'donation' && (
                  <div>
                    <div className="px-4 py-3 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
                      <h4 className="font-bold text-blue-700 text-sm uppercase flex items-center gap-2">
                        <DollarSign className="w-4 h-4" /> Yapılan Bağışlar
                      </h4>
                      <span className="text-xs font-bold text-blue-600 opacity-70">{donationsList.length} İşlem</span>
                    </div>
                    <div className="overflow-y-auto max-h-[300px]">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-blue-50 text-blue-600 font-bold uppercase sticky top-0 shadow-sm z-10">
                          <tr>
                            <th className="px-4 py-3">Tarih</th>
                            <th className="px-4 py-3">Açıklama</th>
                            <th className="px-4 py-3 text-right">Tutar</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-blue-50">
                          {donationsList.length === 0 ? (
                            <tr><td colSpan={3} className="px-4 py-8 text-blue-400/70 text-center">Bağış kaydı yok.</td></tr>
                          ) : donationsList.map(t => (
                            <tr key={t.id} className="hover:bg-blue-50/50">
                              <td className="px-4 py-3 font-medium text-slate-600">{new Date(t.transaction_date).toLocaleDateString('tr-TR')}</td>
                              <td className="px-4 py-3 text-slate-500">{t.description || 'Bağış'}</td>
                              <td className="px-4 py-3 text-right font-black text-blue-600">{t.amount.toFixed(2)} TL</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 4. YARDIM LİSTESİ */}
                {activeTab === 'expense' && (
                  <div>
                    <div className="px-4 py-3 bg-orange-50 border-b border-orange-100 flex items-center justify-between">
                      <h4 className="font-bold text-orange-700 text-sm uppercase flex items-center gap-2">
                        <TrendingDown className="w-4 h-4" /> Alınan Sosyal Yardımlar
                      </h4>
                      <span className="text-xs font-bold text-orange-600 opacity-70">{receivedAidList.length} İşlem</span>
                    </div>
                    <div className="overflow-y-auto max-h-[300px]">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-orange-50 text-orange-600 font-bold uppercase sticky top-0 shadow-sm z-10">
                          <tr>
                            <th className="px-4 py-3">Tarih</th>
                            <th className="px-4 py-3">Açıklama</th>
                            <th className="px-4 py-3 text-right">Tutar</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-orange-50">
                          {receivedAidList.length === 0 ? (
                            <tr><td colSpan={3} className="px-4 py-8 text-orange-400/70 text-center">Yardım kaydı yok.</td></tr>
                          ) : receivedAidList.map(t => (
                            <tr key={t.id} className="hover:bg-orange-50/50">
                              <td className="px-4 py-3 font-medium text-slate-600">{new Date(t.transaction_date).toLocaleDateString('tr-TR')}</td>
                              <td className="px-4 py-3 text-slate-500 max-w-[200px] truncate" title={t.description}>{t.description || 'Sosyal Yardım'}</td>
                              <td className="px-4 py-3 text-right font-black text-orange-600">{t.amount.toFixed(2)} TL</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t flex justify-end">
              <button onClick={() => setSelectedMember(null)} className="px-8 py-2.5 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-900 transition-colors">Kapat</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}