import { useState, useEffect } from 'react';
import { List, X, FileText, Calendar, Users, ClipboardList, RefreshCw, Activity, MessageSquare } from 'lucide-react';
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
      setStats({
        activeMembers: m.count || 0,
        totalIncome: inc, totalExpense: exp, totalBalance: inc - exp,
        totalRequests: reqAct.filter(r => r.type === 'request').length,
        totalActivities: reqAct.filter(r => r.type === 'activity').length,
        positiveRequests: reqAct.filter(r => r.type === 'request' && r.result_status === 'positive').length
      });
    } finally { setLoading(false); }
  };

  const generateReport = async () => {
    setReportLoading(true);
    try {
      // Tarih Kriterleri: Seçilen ayın son günü "Tavan Tarih" (lte) olacak
      const lastDayOfMonth = new Date(reportDate.year, reportDate.month, 0).getDate();
      const ceilingDate = `${reportDate.year}-${String(reportDate.month).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;
      const startOfMonth = `${reportDate.year}-${String(reportDate.month).padStart(2, '0')}-01`;
      const startOfYear = `${reportDate.year}-01-01`;

      const txSelect = 'type, amount, member_id, description, transaction_date, transaction_categories(name)';
      const [monthlyTx, yearlyTx, allTimeTx, monthlyReqAct, yearlyReqAct, allTimeReqAct, allMembers, newMembers] = await Promise.all([
        fetchAllData('transactions', txSelect, { column: 'transaction_date', gte: startOfMonth, lte: ceilingDate }),
        fetchAllData('transactions', txSelect, { column: 'transaction_date', gte: startOfYear, lte: ceilingDate }),
        fetchAllData('transactions', txSelect, { column: 'transaction_date', lte: ceilingDate }),
        fetchAllData('requests_activities', '*', { column: 'created_at', gte: startOfMonth, lte: ceilingDate }),
        fetchAllData('requests_activities', '*', { column: 'created_at', gte: startOfYear, lte: ceilingDate }),
        fetchAllData('requests_activities', '*', { column: 'created_at', lte: ceilingDate }),
        fetchAllData('members', 'id, full_name', {}),
        fetchAllData('members', 'full_name', { column: 'registration_date', gte: startOfMonth, lte: ceilingDate })
      ]);

      const memberMap = new Map<string, string>();
      allMembers.forEach((m: any) => memberMap.set(m.id, m.full_name));

      const processFinancials = (data: any[]) => {
        const res = { aidat: 0, bagis: 0, digerGelir: 0, sosyal: 0, egitim: 0, digerGider: 0, tGelir: 0, tGider: 0, kSet: new Set<string>() };
        data.forEach(item => {
          const cat = (item.transaction_categories?.name || '').toLocaleLowerCase('tr-TR');
          const amt = Number(item.amount);
          const p = item.member_id ? memberMap.get(item.member_id) : item.description;
          if (item.type === 'income') {
            res.tGelir += amt;
            if (cat.includes('aidat')) res.aidat += amt; else if (cat.includes('bağış') || cat.includes('bagis')) res.bagis += amt; else res.digerGelir += amt;
          } else {
            res.tGider += amt;
            if (p) res.kSet.add(p.toLocaleUpperCase('tr-TR'));
            if (cat.includes('sosyal')) res.sosyal += amt; else if (cat.includes('eğitim') || cat.includes('egitim')) res.egitim += amt; else res.digerGider += amt;
          }
        });
        return res;
      };

      const processReqs = (data: any[]) => {
        const reqs = data.filter(x => x.type === 'request');
        const acts = data.filter(x => x.type === 'activity');
        return { 
          tReq: reqs.length, 
          pReq: reqs.filter(x => x.result_status === 'positive').length, 
          tAct: acts.length 
        };
      };

      setReportData({
        monthly: { fin: processFinancials(monthlyTx), req: processReqs(monthlyReqAct) },
        yearly: { fin: processFinancials(yearlyTx), req: processReqs(yearlyReqAct) },
        allTime: { fin: processFinancials(allTimeTx), req: processReqs(allTimeReqAct) },
        newMembers: newMembers.map(m => m.full_name),
        ceilingDate: ceilingDate.split('-').reverse().join('.')
      });
    } finally { setReportLoading(false); }
  };

  const formatCurrency = (val: number) => val.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-8 p-4 bg-slate-50 min-h-screen">
      {/* 5'li İstatistik Kartları */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border-l-4 border-l-emerald-500">
          <p className="text-slate-500 text-xs font-bold uppercase">Toplam Gelir</p>
          <p className="text-2xl font-black text-emerald-600">{formatCurrency(stats.totalIncome)} TL</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border-l-4 border-l-rose-500">
          <p className="text-slate-500 text-xs font-bold uppercase">Toplam Gider</p>
          <p className="text-2xl font-black text-rose-600">{formatCurrency(stats.totalExpense)} TL</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border-l-4 border-l-blue-500">
          <p className="text-slate-500 text-xs font-bold uppercase">Kasa Bakiyesi</p>
          <p className="text-2xl font-black text-slate-800">{formatCurrency(stats.totalBalance)} TL</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border-l-4 border-l-amber-500">
          <p className="text-slate-500 text-xs font-bold uppercase">Aktif Üyeler</p>
          <p className="text-2xl font-black text-slate-800">{stats.activeMembers}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border-l-4 border-l-cyan-500">
          <p className="text-slate-500 text-xs font-bold uppercase tracking-tighter">Talepler / Faaliyetler</p>
          <p className="text-2xl font-black text-slate-800">{stats.totalRequests + stats.totalActivities}</p>
          <div className="flex gap-2 mt-1 text-[10px] font-bold uppercase">
             <span className="text-cyan-600 bg-cyan-50 px-1 rounded">{stats.totalRequests} TALEP</span>
             <span className="text-purple-600 bg-purple-50 px-1 rounded">{stats.totalActivities} FAALİYET</span>
          </div>
        </div>
      </div>

      <button onClick={() => setShowReportModal(true)} className="fixed bottom-8 right-8 z-40 bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-full shadow-2xl font-bold flex items-center gap-3 transition-transform hover:scale-105">
        <FileText size={24} /> Detaylı Faaliyet Raporu
      </button>

      {showReportModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-5xl shadow-2xl max-h-[92vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b flex justify-between items-center bg-white">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 text-blue-600 rounded-xl"><ClipboardList /></div>
                <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Kurumsal Faaliyet Analizi</h3>
              </div>
              <button onClick={() => setShowReportModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={28} /></button>
            </div>
            
            <div className="p-8 overflow-y-auto space-y-8">
              <div className="flex flex-wrap gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div className="flex-1 min-w-[200px]">
                  <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Rapor Ayı</label>
                  <select className="w-full p-3 bg-white border rounded-xl font-semibold" value={reportDate.month} onChange={(e) => setReportDate({...reportDate, month: parseInt(e.target.value)})}>
                    {Array.from({length: 12}, (_, i) => <option key={i+1} value={i+1}>{i+1}. Ay (Ocak-Aralık)</option>)}
                  </select>
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Rapor Yılı</label>
                  <select className="w-full p-3 bg-white border rounded-xl font-semibold" value={reportDate.year} onChange={(e) => setReportDate({...reportDate, year: parseInt(e.target.value)})}>
                    {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <button onClick={generateReport} className="self-end px-10 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200">
                   {reportLoading ? 'Analiz Ediliyor...' : 'Verileri Derle'}
                </button>
              </div>

              {reportData && (
                <div className="space-y-8 pb-10">
                  {/* 1. DÖNEMSEL ANALİZ */}
                  <div className="bg-blue-50/50 border border-blue-100 p-8 rounded-3xl shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10 text-blue-600"><Calendar size={80} /></div>
                    <h4 className="text-blue-900 font-black text-lg mb-4 flex items-center gap-2 uppercase underline decoration-2 underline-offset-8">Dönem Verileri ({reportDate.month}/{reportDate.year})</h4>
                    <div className="space-y-4 text-slate-700 leading-relaxed italic">
                      <p>Derneğimiz, <span className="font-bold">{reportDate.month}/{reportDate.year}</span> vergilendirme/faaliyet döneminde <span className="font-bold text-blue-700 text-lg">{formatCurrency(reportData.monthly.fin.tGelir)} TL</span> toplam gelir kaydetmiştir. Gelir dağılımı; <strong>{formatCurrency(reportData.monthly.fin.aidat)} TL</strong> aidat, <strong>{formatCurrency(reportData.monthly.fin.bagis)} TL</strong> bağış ve <strong>{formatCurrency(reportData.monthly.fin.digerGelir)} TL</strong> yan gelirlerden oluşmaktadır.</p>
                      <p>Operasyonel harcamalarda ise <strong>{reportData.monthly.fin.kSet.size}</strong> kişiye toplam <strong>{formatCurrency(reportData.monthly.fin.tGider)} TL</strong> destek sağlanmıştır. Sosyal yardımlara <strong>{formatCurrency(reportData.monthly.fin.sosyal)} TL</strong>, eğitim desteklerine <strong>{formatCurrency(reportData.monthly.fin.egitim)} TL</strong> ayrılmıştır.</p>
                      <p className="not-italic font-bold bg-white/60 p-3 rounded-lg border border-blue-200 inline-block text-blue-800">
                        <MessageSquare size={16} className="inline mr-2" /> Bu ay toplam {reportData.monthly.req.tReq} yardım talebi işleme alınmış, bunlardan {reportData.monthly.req.pReq} tanesi olumlu sonuçlanarak {reportData.monthly.req.tAct} adet saha faaliyeti gerçekleştirilmiştir.
                      </p>
                    </div>
                  </div>

                  {/* 2. YILLIK ANALİZ (Tarih Kısıtlamalı) */}
                  <div className="bg-emerald-50/50 border border-emerald-100 p-8 rounded-3xl shadow-sm relative">
                    <h4 className="text-emerald-900 font-black text-lg mb-4 flex items-center gap-2 uppercase underline decoration-2 underline-offset-8 text-lg">Yıllık Kümülatif ({reportData.ceilingDate} İtibarıyla)</h4>
                    <div className="space-y-4 text-slate-700 leading-relaxed italic">
                      <p>01.01.{reportDate.year} tarihinden <span className="font-bold text-emerald-700">{reportData.ceilingDate}</span> tarihine kadar geçen sürede toplam <strong>{formatCurrency(reportData.yearly.fin.tGelir)} TL</strong> gelir (Aidat: {formatCurrency(reportData.yearly.fin.aidat)} TL, Bağış: {formatCurrency(reportData.yearly.fin.bagis)} TL) konsolide edilmiştir.</p>
                      <p>Yıl genelinde <strong>{reportData.yearly.fin.kSet.size}</strong> ihtiyaç sahibine ulaşılmış, toplam <strong>{formatCurrency(reportData.yearly.fin.tGider)} TL</strong> (Sosyal: {formatCurrency(reportData.yearly.fin.sosyal)} TL, Eğitim: {formatCurrency(reportData.yearly.fin.egitim)} TL) kaynak aktarımı yapılmıştır.</p>
                      <p className="not-italic font-bold bg-emerald-100/50 p-3 rounded-lg border border-emerald-200 inline-block text-emerald-800">
                        <Activity size={16} className="inline mr-2" /> Yıl boyu derlenen {reportData.yearly.req.tReq} talebin {reportData.yearly.req.pReq} adedi onaylanmış ve süreçler {reportData.yearly.req.tAct} faaliyetle tamamlanmıştır.
                      </p>
                    </div>
                  </div>

                  {/* 3. KURULUŞTAN BUGÜNE (Tarih Kısıtlamalı) */}
                  <div className="bg-slate-800 p-8 rounded-3xl shadow-xl text-white relative">
                    <h4 className="text-blue-400 font-black text-lg mb-4 uppercase tracking-widest border-b border-slate-700 pb-2">Kurumsal Tarihçe Özeti ({reportData.ceilingDate} Sonu)</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 italic opacity-90">
                      <div>
                        <p className="mb-4">Kuruluştan belirtilen tarihe dek toplam gelir hacmi <span className="text-emerald-400 font-bold text-lg">{formatCurrency(reportData.allTime.fin.tGelir)} TL</span> olarak gerçekleşmiştir. Bu süreçte aidat kaleminden {formatCurrency(reportData.allTime.fin.aidat)} TL gelir toplanmıştır.</p>
                        <p>Toplam gider tutarı ise <span className="text-rose-400 font-bold text-lg">{formatCurrency(reportData.allTime.fin.tGider)} TL</span> olmuştur.</p>
                      </div>
                      <div className="bg-slate-700/50 p-5 rounded-2xl border border-slate-600 not-italic">
                        <p className="font-bold text-blue-300 mb-2">OPERASYONEL GENEL TOPLAM:</p>
                        <ul className="space-y-2 text-sm">
                          <li className="flex justify-between border-b border-slate-600 pb-1"><span>Farklı Yardım Alıcısı:</span> <span className="font-bold">{reportData.allTime.fin.kSet.size} Kişi</span></li>
                          <li className="flex justify-between border-b border-slate-600 pb-1"><span>Toplam Talep Kaydı:</span> <span className="font-bold">{reportData.allTime.req.tReq} Adet</span></li>
                          <li className="flex justify-between border-b border-slate-600 pb-1"><span>Onaylanan Talepler:</span> <span className="font-bold text-emerald-400">{reportData.allTime.req.pReq} Adet</span></li>
                          <li className="flex justify-between"><span>Gerçekleşen Faaliyetler:</span> <span className="font-bold text-blue-300">{reportData.allTime.req.tAct} Adet</span></li>
                        </ul>
                      </div>
                    </div>
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