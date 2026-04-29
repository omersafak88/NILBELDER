import { useState, useEffect } from 'react';
import { List, X, FileText, Calendar, Users, ClipboardList } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { AuthSession } from '../lib/auth';

interface DashboardProps {
  session: AuthSession;
  onLogout: () => void;
}

export default function NewDashboard({ session, onLogout }: DashboardProps) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    activeMembers: 0, totalIncome: 0, totalExpense: 0, totalBalance: 0,
    totalRequests: 0, totalActivities: 0, positiveRequests: 0
  });
  
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportDate, setReportDate] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1
  });
  const [reportData, setReportData] = useState<any>(null);
  const [reportLoading, setReportLoading] = useState(false);

  useEffect(() => { loadStats(); }, []);

  async function fetchAllData(table: string, select: string, filters?: any) {
    let allData: any[] = [];
    let rangeStart = 0;
    const rangeStep = 1000;
    let hasMore = true;

    while (hasMore) {
      let query = supabase.from(table).select(select).range(rangeStart, rangeStart + rangeStep - 1);
      
      if (filters?.gte) query = query.gte(filters.column, filters.gte);
      if (filters?.lte) query = query.lte(filters.column, filters.lte);
      if (filters?.eq) query = query.eq(filters.eqColumn, filters.eqValue);

      const { data, error } = await query;
      if (error || !data || data.length === 0) {
        hasMore = false;
      } else {
        allData = [...allData, ...data];
        rangeStart += rangeStep;
        if (data.length < rangeStep) hasMore = false;
      }
    }
    return allData;
  }

  const loadStats = async () => {
    try {
      setLoading(true);
      const [m, transactions, reqAct] = await Promise.all([
        supabase.from('members').select('id', { count: 'exact', head: true }).eq('is_active', true),
        fetchAllData('transactions', 'type, amount'),
        fetchAllData('requests_activities', 'type, result_status')
      ]);

      const inc = transactions.filter(x => x.type === 'income').reduce((s, x) => s + Number(x.amount), 0);
      const exp = transactions.filter(x => x.type === 'expense').reduce((s, x) => s + Number(x.amount), 0);

      const requests = reqAct.filter(r => r.type === 'request');
      const activities = reqAct.filter(r => r.type === 'activity');
      const positiveReqs = requests.filter(r => r.result_status === 'positive');

      setStats({
        activeMembers: m.count || 0,
        totalIncome: inc,
        totalExpense: exp,
        totalBalance: inc - exp,
        totalRequests: requests.length,
        totalActivities: activities.length,
        positiveRequests: positiveReqs.length
      });
    } finally {
      setLoading(false);
    }
  };

  const generateReport = async () => {
    setReportLoading(true);
    try {
      const startOfMonth = `${reportDate.year}-${String(reportDate.month).padStart(2, '0')}-01`;
      const endOfMonth = new Date(reportDate.year, reportDate.month, 0).toISOString().split('T')[0];
      const startOfYear = `${reportDate.year}-01-01`;

      const [monthlyTransactions, yearlyTransactions, allTransactions, newMembers, allRequestsActivities] = await Promise.all([
        fetchAllData('transactions', 'type, amount, category_id, member_id, description, transaction_categories(name)', { column: 'transaction_date', gte: startOfMonth, lte: endOfMonth }),
        fetchAllData('transactions', 'type, amount, category_id, member_id, description, transaction_categories(name)', { column: 'transaction_date', gte: startOfYear, lte: endOfMonth }),
        fetchAllData('transactions', 'type, amount, category_id, member_id, description, transaction_categories(name)', { column: 'transaction_date', lte: endOfMonth }),
        fetchAllData('members', 'full_name', { column: 'registration_date', gte: startOfMonth, lte: endOfMonth }),
        fetchAllData('requests_activities', 'type, result_status', {})
      ]);

      const processData = (data: any[]) => {
        const res = { aidat: 0, bagis: 0, digerGelir: 0, sosyalYardim: 0, egitimYardim: 0, digerYardim: 0, sosyalKisiler: new Set(), egitimKisiler: new Set() };
        data.forEach(item => {
          const catName = (item.transaction_categories?.name || '').toLocaleLowerCase('tr-TR');
          const amt = Number(item.amount);
          const person = item.member_id || item.description || "Bilinmeyen";

          if (item.type === 'income') {
            if (catName.includes('aidat')) res.aidat += amt;
            else if (catName.includes('bağış')) res.bagis += amt;
            else res.digerGelir += amt;
          } else {
            if (catName.includes('sosyal')) { res.sosyalYardim += amt; res.sosyalKisiler.add(person); }
            else if (catName.includes('eğitim')) { res.egitimYardim += amt; res.egitimKisiler.add(person); }
            else res.digerYardim += amt;
          }
        });
        return res;
      };

      const allRequests = allRequestsActivities.filter((r: any) => r.type === 'request');
      const positiveReqs = allRequests.filter((r: any) => r.result_status === 'positive');

      setReportData({
        monthly: processData(monthlyTransactions),
        yearly: processData(yearlyTransactions),
        allTime: processData(allTransactions),
        newMembers: newMembers.map(m => m.full_name),
        requestStats: {
          total: allRequests.length,
          positive: positiveReqs.length,
          percentage: allRequests.length > 0 ? Math.round((positiveReqs.length / allRequests.length) * 100) : 0
        }
      });
    } finally {
      setReportLoading(false);
    }
  };

  const formatCurrency = (val: number) => val.toLocaleString('tr-TR', { minimumFractionDigits: 2 });

  return (
    <div className="space-y-8 animate-in fade-in duration-500 relative pb-20">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border-l-4 border-l-emerald-500">
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Toplam Gelir</p>
          <p className="text-2xl font-black text-emerald-600">{formatCurrency(stats.totalIncome)} TL</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border-l-4 border-l-rose-500">
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Toplam Gider</p>
          <p className="text-2xl font-black text-rose-600">{formatCurrency(stats.totalExpense)} TL</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border-l-4 border-l-blue-500">
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Net Kasa</p>
          <p className="text-2xl font-black text-slate-800">{formatCurrency(stats.totalBalance)} TL</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border-l-4 border-l-amber-500">
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Aktif Üye Sayısı</p>
          <p className="text-2xl font-black text-slate-800">{stats.activeMembers}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border-l-4 border-l-cyan-500">
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Talepler / Faaliyetler</p>
          <p className="text-2xl font-black text-slate-800">{stats.totalRequests + stats.totalActivities}</p>
          <p className="text-xs text-slate-400 mt-1">{stats.totalRequests} talep, {stats.totalActivities} faaliyet</p>
        </div>
      </div>

      <div className="fixed bottom-8 right-8 z-40">
        <button onClick={() => setShowReportModal(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-full shadow-lg transition-all font-bold">
          <FileText size={20} /> Aylık Faaliyet Raporu
        </button>
      </div>

      {showReportModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex justify-between items-center sticky top-0 bg-white z-10">
              <h3 className="text-xl font-bold flex items-center gap-2"><Calendar className="text-blue-600" /> Faaliyet Raporu Özeti</h3>
              <button onClick={() => {setShowReportModal(false); setReportData(null);}} className="p-2 hover:bg-slate-100 rounded-full"><X size={24} /></button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="flex gap-4">
                <select className="flex-1 p-3 border rounded-xl" value={reportDate.month} onChange={(e) => setReportDate({...reportDate, month: parseInt(e.target.value)})}>
                  {Array.from({length: 12}, (_, i) => <option key={i+1} value={i+1}>{i+1}. Ay</option>)}
                </select>
                <select className="flex-1 p-3 border rounded-xl" value={reportDate.year} onChange={(e) => setReportDate({...reportDate, year: parseInt(e.target.value)})}>
                  {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <button onClick={generateReport} disabled={reportLoading} className="bg-blue-600 text-white px-8 rounded-xl font-bold">{reportLoading ? 'Hesaplanıyor...' : 'Raporu Oluştur'}</button>
              </div>

              {reportData && (
                <div className="space-y-6">
                  {/* 1. AYILIK ÖZET */}
                  <div className="bg-blue-50 p-6 rounded-2xl text-slate-800 italic leading-relaxed border border-blue-100 shadow-sm">
                    <p className="font-semibold mb-2 not-italic text-blue-700">Dönem Özeti ({reportDate.month}/{reportDate.year})</p>
                    "Derneğimiz <span className="font-bold">{reportDate.month}/{reportDate.year}</span> döneminde 
                    <span className="font-bold"> {formatCurrency(reportData.monthly.aidat)} TL</span> aidat, 
                    <span className="font-bold"> {formatCurrency(reportData.monthly.bagis)} TL</span> bağış ve 
                    <span className="font-bold"> {formatCurrency(reportData.monthly.digerGelir)} TL</span> diğer olmak üzere toplamda 
                    <span className="font-bold"> {formatCurrency(reportData.monthly.aidat + reportData.monthly.bagis + reportData.monthly.digerGelir)} TL</span> gelir elde etti. 
                    Ayrıca aynı dönemde <span className="font-bold">{reportData.monthly.sosyalKisiler.size}</span> kişiye 
                    <span className="font-bold"> {formatCurrency(reportData.monthly.sosyalYardim)} TL</span> sosyal yardım, 
                    <span className="font-bold">{reportData.monthly.egitimKisiler.size}</span> kişiye 
                    <span className="font-bold"> {formatCurrency(reportData.monthly.egitimYardim)} TL</span> eğitim yardımı ve 
                    <span className="font-bold"> {formatCurrency(reportData.monthly.digerYardim)} TL</span> diğer olmak üzere toplam 
                    <span className="font-bold"> {reportData.monthly.sosyalKisiler.size + reportData.monthly.egitimKisiler.size}</span> kişiye yardımda bulundu."
                  </div>

                  {/* 2. YILLIK ÖZET */}
                  <div className="bg-emerald-50 p-6 rounded-2xl text-slate-800 italic leading-relaxed border border-emerald-100 shadow-sm">
                    <p className="font-semibold mb-2 not-italic text-emerald-700">Yıllık Gelişim ({reportDate.year})</p>
                    "Yıllık bazda baktığımızda, <span className="font-bold">{reportDate.year}</span> yılı başından itibaren toplam 
                    <span className="font-bold"> {formatCurrency(reportData.yearly.aidat + reportData.yearly.bagis + reportData.yearly.digerGelir)} TL</span> gelir elde edilmiş; 
                    toplam <span className="font-bold">{reportData.yearly.sosyalKisiler.size + reportData.yearly.egitimKisiler.size}</span> kişiye 
                    <span className="font-bold"> {formatCurrency(reportData.yearly.sosyalYardim + reportData.yearly.egitimYardim + reportData.yearly.digerYardim)} TL</span> yardım ulaştırılmıştır."
                  </div>

                  {/* 3. KURULUŞTAN BUGÜNE ÖZET */}
                  <div className="bg-slate-50 p-6 rounded-2xl text-slate-800 italic leading-relaxed border border-slate-200 shadow-sm">
                    <p className="font-semibold mb-2 not-italic text-slate-700">Kuruluştan Bugüne Genel Toplam</p>
                    "Derneğimizin kurulduğu günden bugüne kadar elde ettiği toplam gelir 
                    <span className="font-bold"> {formatCurrency(reportData.allTime.aidat + reportData.allTime.bagis + reportData.allTime.digerGelir)} TL</span> olmuş; 
                    yapılan tüm yardımların toplam tutarı <span className="font-bold"> {formatCurrency(reportData.allTime.sosyalYardim + reportData.allTime.egitimYardim + reportData.allTime.digerYardim)} TL</span>'ye ulaşmıştır. 
                    Bu süreçte toplam <span className="font-bold">{reportData.allTime.sosyalKisiler.size + reportData.allTime.egitimKisiler.size}</span> farklı ihtiyaç sahibine el uzatılmıştır."
                    {reportData.requestStats && reportData.requestStats.total > 0 && (
                      <p className="mt-3">
                        "Ayrıca bugüne kadar derneğimize toplam <span className="font-bold">{reportData.requestStats.total}</span> adet talep gelmiş ve bunların <span className="font-bold">{reportData.requestStats.positive}</span> tanesi (<span className="font-bold">%{reportData.requestStats.percentage}</span>) olumlu sonuçlanmıştır."
                      </p>
                    )}
                  </div>

                  {/* 4. ÜYELİK DURUMU */}
                  <div className="bg-amber-50 p-6 rounded-2xl text-slate-800 italic leading-relaxed border border-amber-100 shadow-sm">
                    <p className="font-semibold mb-2 not-italic text-amber-700">Üyelik Bilgileri</p>
                    "Bu ay aramıza katılan arkadaşlarımız <span className="font-bold">{reportData.newMembers.length > 0 ? reportData.newMembers.join(', ') : 'olmamıştır'}</span> ile birlikte toplam aktif üye sayımız <span className="font-bold">{stats.activeMembers}</span> olmuştur."
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}