import { useState, useEffect } from 'react';
import { X, FileText, Calendar, Users, ClipboardList, RefreshCw, Activity, MessageSquare, Download, Table as TableIcon } from 'lucide-react';
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
      const lastDayOfMonth = new Date(reportDate.year, reportDate.month, 0).getDate();
      const ceilingDate = `${reportDate.year}-${String(reportDate.month).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;
      const startOfMonth = `${reportDate.year}-${String(reportDate.month).padStart(2, '0')}-01`;
      const startOfYear = `${reportDate.year}-01-01`;

      const txSelect = 'type, amount, member_id, description, transaction_date, transaction_categories(name)';
      const [monthlyTx, yearlyTx, allTimeTx, monthlyReqAct, yearlyReqAct, allTimeReqAct, allMembers, newMembers] = await Promise.all([
        fetchAllData('transactions', txSelect, { column: 'transaction_date', gte: startOfMonth, lte: ceilingDate }),
        fetchAllData('transactions', txSelect, { column: 'transaction_date', gte: startOfYear, lte: ceilingDate }),
        fetchAllData('transactions', txSelect, { column: 'transaction_date', lte: ceilingDate }),
        fetchAllData('requests_activities', '*', { column: 'event_date', gte: startOfMonth, lte: ceilingDate }),
        fetchAllData('requests_activities', '*', { column: 'event_date', gte: startOfYear, lte: ceilingDate }),
        fetchAllData('requests_activities', '*', { column: 'event_date', lte: ceilingDate }),
        fetchAllData('members', 'id, full_name', {}),
        fetchAllData('members', 'full_name', { column: 'registration_date', gte: startOfMonth, lte: ceilingDate })
      ]);

      const memberMap = new Map<string, string>();
      allMembers.forEach((m: any) => memberMap.set(m.id, m.full_name));

      const processFinancials = (data: any[]) => {
        const res = { aidat: 0, bagis: 0, digerGelir: 0, sosyal: 0, egitim: 0, digerGider: 0, tGelir: 0, tGider: 0, sKSet: new Set<string>(), eKSet: new Set<string>() };
        data.forEach(item => {
          const cat = (item.transaction_categories?.name || '').toLocaleLowerCase('tr-TR');
          const amt = Number(item.amount);
          const p = (item.member_id ? memberMap.get(item.member_id) : item.description)?.toLocaleUpperCase('tr-TR');
          if (item.type === 'income') {
            res.tGelir += amt;
            if (cat.includes('aidat')) res.aidat += amt; else if (cat.includes('bağış') || cat.includes('bagis')) res.bagis += amt; else res.digerGelir += amt;
          } else {
            res.tGider += amt;
            if (p) {
              if (cat.includes('sosyal')) { res.sosyal += amt; res.sKSet.add(p); }
              else if (cat.includes('eğitim') || cat.includes('egitim')) { res.egitim += amt; res.eKSet.add(p); }
              else res.digerGider += amt;
            }
          }
        });
        return res;
      };

      const processReqs = (data: any[]) => {
        const reqs = data.filter(x => x.type === 'request');
        const pos = reqs.filter(x => x.result_status === 'positive').length;
        return { tReq: reqs.length, pReq: pos, tAct: data.filter(x => x.type === 'activity').length, perc: reqs.length > 0 ? Math.round((pos / reqs.length) * 100) : 0 };
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

  const downloadHTMLReport = () => {
    const reportElement = document.getElementById('report-content');
    if (!reportElement) return;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>NİL-BEL-DER Faaliyet Raporu</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          body { padding: 40px; background: white; font-family: sans-serif; }
          .report-container { max-width: 1000px; margin: 0 auto; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px; }
          th, td { border: 1px solid #e2e8f0; padding: 10px; text-align: left; }
          .bg-slate-900 { background-color: #0f172a !important; color: white !important; }
          .bg-slate-100 { background-color: #f1f5f9 !important; }
          .bg-emerald-50 { background-color: #ecfdf5 !important; }
          .bg-rose-50 { background-color: #fff1f2 !important; }
          .font-bold { font-weight: 700; }
        </style>
      </head>
      <body>
        <div class="report-container">
          ${reportElement.innerHTML}
          <div style="margin-top: 80px; display: flex; justify-content: space-between; font-weight: bold; font-size: 14px;">
            <div style="text-align: center; width: 220px; border-top: 2px solid black; padding-top: 8px;">Ömer ŞAFAK<br>Dernek Başkanı</div>
            <div style="text-align: center; width: 220px; border-top: 2px solid black; padding-top: 8px;">Mali Sekreter</div>
            <div style="text-align: center; width: 220px; border-top: 2px solid black; padding-top: 8px;">Denetleme Kurulu</div>
          </div>
        </div>
      </body>
      </html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `NILBELDER_Rapor_${reportDate.month}_${reportDate.year}.html`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const formatCurrency = (val: number) => val.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-8 p-4 bg-slate-50 min-h-screen">
      {/* Dashboard Stat Kartları */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
        {[
          { label: 'Toplam Gelir', val: `${formatCurrency(stats.totalIncome)} TL`, color: 'border-l-emerald-500', text: 'text-emerald-600' },
          { label: 'Toplam Gider', val: `${formatCurrency(stats.totalExpense)} TL`, color: 'border-l-rose-500', text: 'text-rose-600' },
          { label: 'Net Kasa', val: `${formatCurrency(stats.totalBalance)} TL`, color: 'border-l-blue-500', text: 'text-slate-800' },
          { label: 'Aktif Üyeler', val: stats.activeMembers, color: 'border-l-amber-500', text: 'text-slate-800' },
        ].map((item, i) => (
          <div key={i} className={`bg-white p-6 rounded-2xl shadow-sm border-l-4 ${item.color}`}>
            <p className="text-slate-500 text-xs font-bold uppercase">{item.label}</p>
            <p className={`text-2xl font-black ${item.text}`}>{item.val}</p>
          </div>
        ))}
        <div className="bg-white p-6 rounded-2xl shadow-sm border-l-4 border-l-cyan-500">
          <p className="text-slate-500 text-xs font-bold uppercase tracking-tight">Talepler / Faaliyetler</p>
          <p className="text-2xl font-black text-slate-800">{stats.totalRequests + stats.totalActivities}</p>
          <div className="flex gap-2 mt-1 text-[10px] font-bold uppercase">
             <span className="text-cyan-600 bg-cyan-50 px-1 rounded">{stats.totalRequests} TALEP</span>
             <span className="text-purple-600 bg-purple-50 px-1 rounded">{stats.totalActivities} FAALİYET</span>
          </div>
        </div>
      </div>

      <button onClick={() => setShowReportModal(true)} className="fixed bottom-8 right-8 bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-full shadow-2xl font-bold flex items-center gap-3 transition-transform hover:scale-105">
        <FileText size={24} /> Faaliyet Raporu Oluştur
      </button>

      {showReportModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-5xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
            <div className="p-6 border-b flex justify-between items-center bg-white">
              <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-3">
                <div className="p-2 bg-blue-100 text-blue-600 rounded-xl"><ClipboardList /></div>
                Kurumsal Faaliyet Analizi
              </h3>
              <div className="flex items-center gap-2">
                {reportData && (
                  <button onClick={downloadHTMLReport} className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg transition-all active:scale-95">
                    <Download size={18} /> RAPORU İNDİR (HTML)
                  </button>
                )}
                <button onClick={() => setShowReportModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={28} /></button>
              </div>
            </div>
            
            <div className="p-8 overflow-y-auto space-y-10">
              <div className="flex gap-4 bg-slate-50 p-5 rounded-2xl border border-slate-200">
                <div className="flex-1 min-w-[200px]">
                  <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Dönem Seçimi</label>
                  <div className="flex gap-2 mt-1">
                    <select className="flex-1 p-3 bg-white border rounded-xl font-semibold outline-none focus:ring-2 focus:ring-blue-500" value={reportDate.month} onChange={(e) => setReportDate({...reportDate, month: parseInt(e.target.value)})}>
                      {Array.from({length: 12}, (_, i) => <option key={i+1} value={i+1}>{i+1}. Ay (Ocak-Aralık)</option>)}
                    </select>
                    <select className="flex-1 p-3 bg-white border rounded-xl font-semibold outline-none focus:ring-2 focus:ring-blue-500" value={reportDate.year} onChange={(e) => setReportDate({...reportDate, year: parseInt(e.target.value)})}>
                      {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                </div>
                <button onClick={generateReport} className="self-end px-12 py-3.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all active:scale-95">
                   {reportLoading ? 'Derleniyor...' : 'VERİLERİ ANALİZ ET'}
                </button>
              </div>

              {reportData && (
                <div id="report-content" className="space-y-10">
                  <div className="text-center border-b-4 border-slate-900 pb-6 mb-8">
                    <h1 className="text-3xl font-black uppercase tracking-tight">NİL-BEL-DER FAALİYET RAPORU</h1>
                    <p className="text-lg font-bold text-slate-600 mt-1">Rapor Tarihi: {reportData.ceilingDate}</p>
                  </div>

                  {/* Metin Analizleri */}
                  <div className="bg-blue-50 border-2 border-blue-100 p-8 rounded-3xl space-y-4 text-slate-800 italic">
                    <h4 className="text-blue-900 font-black not-italic uppercase underline underline-offset-4 decoration-2">1. Dönemsel Özet ({reportDate.month}/{reportDate.year})</h4>
                    <p>Derneğimiz ilgili dönemde <strong>{formatCurrency(reportData.monthly.fin.tGelir)} TL</strong> toplam gelir elde etmiştir. (Aidat: {formatCurrency(reportData.monthly.fin.aidat)} TL, Bağış: {formatCurrency(reportData.monthly.fin.bagis)} TL)</p>
                    <p>Bu ay <strong>{reportData.monthly.fin.sKSet.size + reportData.monthly.fin.eKSet.size}</strong> kişiye toplam <strong>{formatCurrency(reportData.monthly.fin.sosyal + reportData.monthly.fin.egitim)} TL</strong> tutarında yardım ulaştırılmıştır.</p>
                  </div>

                  <div className="bg-emerald-50 border-2 border-emerald-100 p-8 rounded-3xl space-y-4 text-slate-800 italic">
                    <h4 className="text-emerald-900 font-black not-italic uppercase underline underline-offset-4 decoration-2">2. Yıllık Kümülatif (01.01.{reportDate.year} - {reportData.ceilingDate})</h4>
                    <p>Yıl başından rapor tarihine kadar <strong>{formatCurrency(reportData.yearly.fin.tGelir)} TL</strong> gelir kaydedilmiş, <strong>{reportData.yearly.fin.sKSet.size + reportData.yearly.fin.eKSet.size}</strong> farklı kişiye destek sağlanmıştır.</p>
                  </div>

                  {/* 3. VERİ KARŞILAŞTIRMA TABLOSU */}
                  <div className="space-y-4">
                    <h4 className="text-slate-800 font-black uppercase flex items-center gap-2 px-2 text-lg"><TableIcon size={24} className="text-blue-600"/> 3. Karşılaştırmalı Veri Tablosu</h4>
                    <div className="border-2 border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-900 text-white uppercase text-[11px] tracking-widest">
                            <th className="p-4 border-r border-slate-700">AÇIKLAMA / KALEM</th>
                            <th className="p-4 border-r border-slate-700 text-center">AYLIK ({reportDate.month})</th>
                            <th className="p-4 border-r border-slate-700 text-center">YILLIK ({reportDate.year})</th>
                            <th className="p-4 text-center">TÜM ZAMANLAR</th>
                          </tr>
                        </thead>
                        <tbody className="text-sm text-slate-700 font-medium italic">
                          <tr className="bg-slate-100 font-bold border-b not-italic text-[11px]"><td className="p-2" colSpan={4}>GELİR KALEMLERİ</td></tr>
                          <tr className="border-b"><td className="p-3 pl-6">Üye Aidatları (TL)</td><td className="p-3 text-center">{formatCurrency(reportData.monthly.fin.aidat)}</td><td className="p-3 text-center">{formatCurrency(reportData.yearly.fin.aidat)}</td><td className="p-3 text-center">{formatCurrency(reportData.allTime.fin.aidat)}</td></tr>
                          <tr className="border-b"><td className="p-3 pl-6">Bağış Gelirleri (TL)</td><td className="p-3 text-center">{formatCurrency(reportData.monthly.fin.bagis)}</td><td className="p-3 text-center">{formatCurrency(reportData.yearly.fin.bagis)}</td><td className="p-3 text-center">{formatCurrency(reportData.allTime.fin.bagis)}</td></tr>
                          <tr className="border-b"><td className="p-3 pl-6">Diğer Gelirler (TL)</td><td className="p-3 text-center">{formatCurrency(reportData.monthly.fin.digerGelir)}</td><td className="p-3 text-center">{formatCurrency(reportData.yearly.fin.digerGelir)}</td><td className="p-3 text-center">{formatCurrency(reportData.allTime.fin.digerGelir)}</td></tr>
                          {/* Toplam Gelir Satırı */}
                          <tr className="bg-emerald-50 font-black border-b not-italic text-emerald-900"><td className="p-3 pl-6 uppercase">TOPLAM GELİR</td><td className="p-3 text-center">{formatCurrency(reportData.monthly.fin.tGelir)}</td><td className="p-3 text-center">{formatCurrency(reportData.yearly.fin.tGelir)}</td><td className="p-3 text-center">{formatCurrency(reportData.allTime.fin.tGelir)}</td></tr>
                          
                          <tr className="bg-slate-100 font-bold border-b not-italic text-[11px]"><td className="p-2" colSpan={4}>GİDER VE YARDIM KALEMLERİ</td></tr>
                          <tr className="border-b"><td className="p-3 pl-6">Sosyal Yardımlar (TL)</td><td className="p-3 text-center">{formatCurrency(reportData.monthly.fin.sosyal)}</td><td className="p-3 text-center">{formatCurrency(reportData.yearly.fin.sosyal)}</td><td className="p-3 text-center">{formatCurrency(reportData.allTime.fin.sosyal)}</td></tr>
                          <tr className="border-b"><td className="p-3 pl-6">Eğitim Yardımları (TL)</td><td className="p-3 text-center">{formatCurrency(reportData.monthly.fin.egitim)}</td><td className="p-3 text-center">{formatCurrency(reportData.yearly.fin.egitim)}</td><td className="p-3 text-center">{formatCurrency(reportData.allTime.fin.egitim)}</td></tr>
                          <tr className="border-b"><td className="p-3 pl-6">EFT / Banka Masrafları (TL)</td><td className="p-3 text-center">{formatCurrency(reportData.monthly.fin.digerGider)}</td><td className="p-3 text-center">{formatCurrency(reportData.yearly.fin.digerGider)}</td><td className="p-3 text-center">{formatCurrency(reportData.allTime.fin.digerGider)}</td></tr>
                          {/* Toplam Gider Satırı */}
                          <tr className="bg-rose-50 font-black border-b not-italic text-rose-900"><td className="p-3 pl-6 uppercase">TOPLAM GİDER</td><td className="p-3 text-center">{formatCurrency(reportData.monthly.fin.tGider)}</td><td className="p-3 text-center">{formatCurrency(reportData.yearly.fin.tGider)}</td><td className="p-3 text-center">{formatCurrency(reportData.allTime.fin.tGider)}</td></tr>
                          
                          <tr className="bg-slate-100 font-bold border-b not-italic text-[11px]"><td className="p-2" colSpan={4}>PERFORMANS VE OPERASYON</td></tr>
                          <tr className="border-b"><td className="p-3 pl-6 font-bold not-italic">Farklı Kişi Sayısı</td><td className="p-3 text-center">{reportData.monthly.fin.sKSet.size + reportData.monthly.fin.eKSet.size}</td><td className="p-3 text-center">{reportData.yearly.fin.sKSet.size + reportData.yearly.fin.eKSet.size}</td><td className="p-3 text-center">{reportData.allTime.fin.sKSet.size + reportData.allTime.fin.eKSet.size}</td></tr>
                          <tr className="border-b"><td className="p-3 pl-6">Gelen Toplam Talep / Olumlu</td><td className="p-3 text-center">{reportData.monthly.req.tReq} / {reportData.monthly.req.pReq}</td><td className="p-3 text-center">{reportData.yearly.req.tReq} / {reportData.yearly.req.pReq}</td><td className="p-3 text-center">{reportData.allTime.req.tReq} / {reportData.allTime.req.pReq}</td></tr>
                          <tr><td className="p-3 pl-6 font-bold not-italic text-blue-700">Talep Karşılama Oranı</td><td className="p-3 text-center font-bold">%{reportData.monthly.req.perc}</td><td className="p-3 text-center font-bold">%{reportData.yearly.req.perc}</td><td className="p-3 text-center font-bold">%{reportData.allTime.req.perc}</td></tr>
                        </tbody>
                      </table>
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