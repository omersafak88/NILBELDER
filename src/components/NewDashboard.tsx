import { useState, useEffect } from 'react';
import { List, X, FileText, Calendar, Users, ClipboardList, RefreshCw } from 'lucide-react';
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
      const { data, error } = await query;
      if (error || !data || data.length === 0) hasMore = false;
      else {
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
      setStats({
        activeMembers: m.count || 0,
        totalIncome: inc, totalExpense: exp, totalBalance: inc - exp,
        totalRequests: requests.length, totalActivities: activities.length,
        positiveRequests: requests.filter(r => r.result_status === 'positive').length
      });
    } finally { setLoading(false); }
  };

  const generateReport = async () => {
    setReportLoading(true);
    try {
      const startOfMonth = `${reportDate.year}-${String(reportDate.month).padStart(2, '0')}-01`;
      const endOfMonth = new Date(reportDate.year, reportDate.month, 0).toISOString().split('T')[0];
      const startOfYear = `${reportDate.year}-01-01`;

      const txSelect = 'type, amount, member_id, description, transaction_categories(name)';
      const [monthlyTransactions, yearlyTransactions, allTransactions, allMembers, newMembers, allRequestsActivities] = await Promise.all([
        fetchAllData('transactions', txSelect, { column: 'transaction_date', gte: startOfMonth, lte: endOfMonth }),
        fetchAllData('transactions', txSelect, { column: 'transaction_date', gte: startOfYear, lte: endOfMonth }),
        fetchAllData('transactions', txSelect, { column: 'transaction_date', lte: endOfMonth }),
        fetchAllData('members', 'id, full_name', {}),
        fetchAllData('members', 'full_name', { column: 'registration_date', gte: startOfMonth, lte: endOfMonth }),
        fetchAllData('requests_activities', 'type, result_status', {})
      ]);

      const memberMap = new Map<string, string>();
      allMembers.forEach((m: any) => memberMap.set(m.id, m.full_name));

      const processData = (data: any[]) => {
        const res = {
          aidat: 0, bagis: 0, digerGelir: 0, toplamGelir: 0,
          sosyalYardim: 0, egitimYardim: 0, digerYardim: 0, toplamGider: 0,
          kisiSet: new Set<string>()
        };

        data.forEach(item => {
          const catName = (item.transaction_categories?.name || '').toLocaleLowerCase('tr-TR');
          const amt = Number(item.amount);
          const person = item.member_id ? memberMap.get(item.member_id) : item.description;

          if (item.type === 'income') {
            res.toplamGelir += amt;
            if (catName.includes('aidat')) res.aidat += amt;
            else if (catName.includes('bağış') || catName.includes('bagis')) res.bagis += amt;
            else res.digerGelir += amt;
          } else {
            res.toplamGider += amt;
            if (person) res.kisiSet.add(person.toLocaleUpperCase('tr-TR'));
            if (catName.includes('sosyal')) res.sosyalYardim += amt;
            else if (catName.includes('eğitim') || catName.includes('egitim')) res.egitimYardim += amt;
            else res.digerYardim += amt;
          }
        });
        return res;
      };

      const allRequests = allRequestsActivities.filter((r: any) => r.type === 'request');
      setReportData({
        monthly: processData(monthlyTransactions),
        yearly: processData(yearlyTransactions),
        allTime: processData(allTransactions),
        newMembers: newMembers.map(m => m.full_name),
        requestStats: {
          total: allRequests.length,
          positive: allRequests.filter((r: any) => r.result_status === 'positive').length
        }
      });
    } finally { setReportLoading(false); }
  };

  const formatCurrency = (val: number) => val.toLocaleString('tr-TR', { minimumFractionDigits: 2 });

  return (
    <div className="space-y-8 p-4">
      {/* İstatistik Kartları */}
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
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Talepler</p>
          <p className="text-2xl font-black text-slate-800">{stats.totalRequests}</p>
        </div>
      </div>

      <div className="fixed bottom-8 right-8 z-40">
        <button onClick={() => setShowReportModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-full shadow-lg font-bold flex items-center gap-2">
          <FileText size={20} /> Faaliyet Raporu
        </button>
      </div>

      {showReportModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">Faaliyet Raporu Detayları</h3>
              <button onClick={() => setShowReportModal(false)}><X size={24} /></button>
            </div>

            <div className="flex gap-4 mb-6">
              <select className="flex-1 p-2 border rounded-lg" value={reportDate.month} onChange={(e) => setReportDate({...reportDate, month: parseInt(e.target.value)})}>
                {Array.from({length: 12}, (_, i) => <option key={i+1} value={i+1}>{i+1}. Ay</option>)}
              </select>
              <select className="flex-1 p-2 border rounded-lg" value={reportDate.year} onChange={(e) => setReportDate({...reportDate, year: parseInt(e.target.value)})}>
                {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <button onClick={generateReport} className="bg-blue-600 text-white px-6 rounded-lg font-bold">Raporu Oluştur</button>
            </div>

            {reportData && (
              <div className="space-y-6 text-sm leading-relaxed">
                {/* DÖNEMSEL BÖLÜM */}
                <div className="bg-blue-50 p-5 rounded-xl border border-blue-100">
                  <h4 className="font-bold text-blue-800 mb-2 border-b border-blue-200 pb-1">Dönem Özeti ({reportDate.month}/{reportDate.year})</h4>
                  <p>Derneğimiz bu dönemde <span className="font-bold">{formatCurrency(reportData.monthly.toplamGelir)} TL</span> toplam gelir elde etmiştir. Bu gelirin <strong>{formatCurrency(reportData.monthly.aidat)} TL</strong>'si aidat, <strong>{formatCurrency(reportData.monthly.bagis)} TL</strong>'si bağış ve <strong>{formatCurrency(reportData.monthly.digerGelir)} TL</strong>'si diğer gelirlerden oluşmaktadır.</p>
                  <p className="mt-2">Gider tarafında ise <strong>{reportData.monthly.kisiSet.size}</strong> kişiye toplam <strong>{formatCurrency(reportData.monthly.toplamGider)} TL</strong> yardım ulaştırılmıştır. (Sosyal: {formatCurrency(reportData.monthly.sosyalYardim)} TL, Eğitim: {formatCurrency(reportData.monthly.egitimYardim)} TL, Diğer: {formatCurrency(reportData.monthly.digerYardim)} TL)</p>
                </div>

                {/* YILLIK BÖLÜM */}
                <div className="bg-emerald-50 p-5 rounded-xl border border-emerald-100">
                  <h4 className="font-bold text-emerald-800 mb-2 border-b border-emerald-200 pb-1">Yıllık Gelişim ({reportDate.year})</h4>
                  <p>Yıl başından itibaren toplam <strong>{formatCurrency(reportData.yearly.toplamGelir)} TL</strong> gelir (Aidat: {formatCurrency(reportData.yearly.aidat)} TL, Bağış: {formatCurrency(reportData.yearly.bagis)} TL, Diğer: {formatCurrency(reportData.yearly.digerGelir)} TL) kaydedilmiştir.</p>
                  <p className="mt-2">Yıl boyu <strong>{reportData.yearly.kisiSet.size}</strong> kişiye toplam <strong>{formatCurrency(reportData.yearly.toplamGider)} TL</strong> destek sağlanmıştır. Bunun <strong>{formatCurrency(reportData.yearly.sosyalYardim)} TL</strong>'si sosyal, <strong>{formatCurrency(reportData.yearly.egitimYardim)} TL</strong>'si eğitim ve <strong>{formatCurrency(reportData.yearly.digerYardim)} TL</strong>'si diğer yardımlardır.</p>
                </div>

                {/* GENEL TOPLAM BÖLÜMÜ */}
                <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
                  <h4 className="font-bold text-slate-800 mb-2 border-b border-slate-300 pb-1">Kuruluştan Bugüne Genel Durum</h4>
                  <p>Kuruluştan bugüne dek elde edilen toplam gelir <strong>{formatCurrency(reportData.allTime.toplamGelir)} TL</strong> seviyesine ulaşmıştır. (Aidat Toplamı: {formatCurrency(reportData.allTime.aidat)} TL, Bağış Toplamı: {formatCurrency(reportData.allTime.bagis)} TL, Diğer: {formatCurrency(reportData.allTime.digerGelir)} TL)</p>
                  <p className="mt-2">Bugüne kadar <strong>{reportData.allTime.kisiSet.size}</strong> farklı kişiye toplam <strong>{formatCurrency(reportData.allTime.toplamGider)} TL</strong> tutarında yardım eli uzatılmıştır.</p>
                  <p className="mt-2 text-xs text-slate-500 italic">Toplamda {reportData.requestStats.total} yardım talebi alınmış, {reportData.requestStats.positive} talep olumlu karşılanmıştır.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}