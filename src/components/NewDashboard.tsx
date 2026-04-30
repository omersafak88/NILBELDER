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
          .report-container { max-width: 900px; margin: 0 auto; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #e2e8f0; padding: 12px; text-align: left; }
          .bg-slate-900 { background-color: #0f172a !important; color: white !important; }
          .bg-blue-50 { background-color: #eff6ff !important; }
          .bg-emerald-50 { background-color: #ecfdf5 !important; }
          .bg-rose-50 { background-color: #fff1f2 !important; }
          @media print { .no-print { display: none; } }
        </style>
      </head>
      <body>
        <div class="report-container">
          ${reportElement.innerHTML}
          <div style="margin-top: 50px; display: flex; justify-content: space-between;">
            <div style="text-align: center; width: 200px; border-top: 1px solid black; pt: 10px;">Ömer ŞAFAK<br>Dernek Başkanı</div>
            <div style="text-align: center; width: 200px; border-top: 1px solid black; pt: 10px;">Mali Sekreter</div>
          </div>
        </div>
      </body>
      </html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Nilbelder_Rapor_${reportDate.month}_${reportDate.year}.html`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const formatCurrency = (val: number) => val.toLocaleString('tr-TR', { minimumFractionDigits: 2 });

  return (
    <div className="space-y-8 p-4 bg-slate-50 min-h-screen">
      {/* Dashboard Kartları */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
        {[
          { label: 'Toplam Gelir', val: `${formatCurrency(stats.totalIncome)} TL`, color: 'border-l-emerald-500', text: 'text-emerald-600' },
          { label: 'Toplam Gider', val: `${formatCurrency(stats.totalExpense)} TL`, color: 'border-l-rose-500', text: 'text-rose-600' },
          { label: 'Net Bakiye', val: `${formatCurrency(stats.totalBalance)} TL`, color: 'border-l-blue-500', text: 'text-slate-800' },
          { label: 'Aktif Üyeler', val: stats.activeMembers, color: 'border-l-amber-500', text: 'text-slate-800' },
        ].map((item, i) => (
          <div key={i} className={`bg-white p-6 rounded-2xl shadow-sm border-l-4 ${item.color}`}>
            <p className="text-slate-500 text-xs font-bold uppercase">{item.label}</p>
            <p className={`text-2xl font-black ${item.text}`}>{item.val}</p>
          </div>
        ))}
        <div className="bg-white p-6 rounded-2xl shadow-sm border-l-4 border-l-cyan-500">
          <p className="text-slate-500 text-xs font-bold uppercase">Talepler / Faaliyetler</p>
          <p className="text-2xl font-black text-slate-800">{stats.totalRequests + stats.totalActivities}</p>
          <div className="flex gap-2 mt-1 text-[10px] font-bold uppercase">
             <span className="text-cyan-600 bg-cyan-50 px-1 rounded">{stats.totalRequests} TALEP</span>
             <span className="text-purple-600 bg-purple-50 px-1 rounded">{stats.totalActivities} FAALİYET</span>
          </div>
        </div>
      </div>

      <button onClick={() => setShowReportModal(true)} className="fixed bottom-8 right-8 bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-full shadow-2xl font-bold flex items-center gap-3">
        <FileText size={24} /> Faaliyet Raporu Oluştur
      </button>

      {showReportModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-5xl shadow-2xl max-h-[92vh] flex flex-col">
            <div className="p-6 border-b flex justify-between items-center">
              <h3 className="text-2xl font-black text-slate-800 uppercase">Kurumsal Faaliyet Analizi</h3>
              <div className="flex gap-2">
                {reportData && (
                  <button onClick={downloadHTMLReport} className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl text-sm font-bold flex items-center gap-2">
                    <Download size={18} /> RAPORU İNDİR (HTML)
                  </button>
                )}
                <button onClick={() => setShowReportModal(false)} className="p-2 hover:bg-slate-100 rounded-full"><X size={28} /></button>
              </div>
            </div>
            
            <div className="p-8 overflow-y-auto space-y-10">
              <div className="flex gap-4 bg-slate-50 p-5 rounded-2xl border border-slate-200">
                <select className="flex-1 p-3 bg-white border rounded-xl font-semibold" value={reportDate.month} onChange={(e) => setReportDate({...reportDate, month: parseInt(e.target.value)})}>
                  {Array.from({length: 12}, (_, i) => <option key={i+1} value={i+1}>{i+1}. Ay</option>)}
                </select>
                <select className="flex-1 p-3 bg-white border rounded-xl font-semibold" value={reportDate.year} onChange={(e) => setReportDate({...reportDate, year: parseInt(e.target.value)})}>
                  {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <button onClick={generateReport} className="px-10 bg-blue-600 text-white rounded-xl font-bold">VERİLERİ DERLE</button>
              </div>

              {reportData && (
                <div id="report-content" className="space-y-10">
                  <div className="text-center border-b-4 border-slate-900 pb-6">
                    <h1 className="text-3xl font-black uppercase">NİL-BEL-DER FAALİYET RAPORU</h1>
                    <p className="text-lg font-bold text-slate-600 mt-1">Kesme Tarihi: {reportData.ceilingDate}</p>
                  </div>

                  <div className="bg-blue-50 border-2 border-blue-100 p-8 rounded-3xl space-y-4 text-slate-800 italic">
                    <h4 className="text-blue-900 font-black not-italic uppercase underline">1. Dönemsel Özet ({reportDate.month}/{reportDate.year})</h4>
                    <p>Derneğimiz ilgili dönemde <strong>{formatCurrency(reportData.monthly.fin.tGelir)} TL</strong> gelir elde etmiştir. (Aidat: {formatCurrency(reportData.monthly.fin.aidat)} TL, Bağış: {formatCurrency(reportData.monthly.fin.bagis)} TL)</p>
                    <p>Bu ay <strong>{reportData.monthly.fin.sKSet.size + reportData.monthly.fin.eKSet.size}</strong> kişiye toplam <strong>{formatCurrency(reportData.monthly.fin.sosyal + reportData.monthly.fin.egitim)} TL</strong> yardım yapılmıştır.</p>
                  </div>

                  <div className="bg-emerald-50 border-2 border-emerald-100 p-8 rounded-3xl space-y-4 text-slate-800 italic">
                    <h4 className="text-emerald-900 font-black not-italic uppercase underline">2. Yıllık Kümülatif (01.01.{reportDate.year} - {reportData.ceilingDate})</h4>
                    <p>Yıl başından itibaren <strong>{formatCurrency(reportData.yearly.fin.tGelir)} TL</strong> gelir kaydedilmiş, <strong>{reportData.yearly.fin.sKSet.size + reportData.yearly.fin.eKSet.size}</strong> farklı kişiye destek ulaştırılmıştır.</p>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-slate-800 font-black uppercase flex items-center gap-2 px-2"><TableIcon size={20}/> 3. Karşılaştırmalı Veri Tablosu</h4>
                    <table className="w-full text-sm border-2 border-slate-200">
                      <tr className="bg-slate-900 text-white uppercase text-[10px]">
                        <th className="p-3">AÇIKLAMA</th><th className="p-3 text-center">AYLIK</th><th className="p-3 text-center">YILLIK</th><th className="p-3 text-center">TÜM ZAMANLAR</th>
                      </tr>
                      <tr><td className="p-2 font-bold bg-slate-100" colSpan={4}>FİNANSAL VERİLER (TL)</td></tr>
                      <tr><td className="p-2 pl-4">Toplam Gelir</td><td className="p-2 text-center">{formatCurrency(reportData.monthly.fin.tGelir)}</td><td className="p-2 text-center">{formatCurrency(reportData.yearly.fin.tGelir)}</td><td className="p-2 text-center">{formatCurrency(reportData.allTime.fin.tGelir)}</td></tr>
                      <tr><td className="p-2 pl-4">Toplam Gider</td><td className="p-2 text-center">{formatCurrency(reportData.monthly.fin.tGider)}</td><td className="p-2 text-center">{formatCurrency(reportData.yearly.fin.tGider)}</td><td className="p-2 text-center">{formatCurrency(reportData.allTime.fin.tGider)}</td></tr>
                      <tr><td className="p-2 font-bold bg-slate-100" colSpan={4}>YARDIM ALICI SAYILARI (BENZERSİZ)</td></tr>
                      <tr><td className="p-2 pl-4">Sosyal Yardım Alan</td><td className="p-2 text-center">{reportData.monthly.fin.sKSet.size}</td><td className="p-2 text-center">{reportData.yearly.fin.sKSet.size}</td><td className="p-2 text-center">{reportData.allTime.fin.sKSet.size}</td></tr>
                      <tr><td className="p-2 pl-4">Eğitim Yardımı Alan</td><td className="p-2 text-center">{reportData.monthly.fin.eKSet.size}</td><td className="p-2 text-center">{reportData.yearly.fin.eKSet.size}</td><td className="p-2 text-center">{reportData.allTime.fin.eKSet.size}</td></tr>
                      <tr><td className="p-2 font-bold bg-slate-100" colSpan={4}>OPERASYONEL VERİLER</td></tr>
                      <tr><td className="p-2 pl-4">Gelen Talep / Olumlu</td><td className="p-2 text-center">{reportData.monthly.req.tReq} / {reportData.monthly.req.pReq}</td><td className="p-2 text-center">{reportData.yearly.req.tReq} / {reportData.yearly.req.pReq}</td><td className="p-2 text-center">{reportData.allTime.req.tReq} / {reportData.allTime.req.pReq}</td></tr>
                      <tr><td className="p-2 pl-4">Onay Oranı (%)</td><td className="p-2 text-center">%{reportData.monthly.req.perc}</td><td className="p-2 text-center">%{reportData.yearly.req.perc}</td><td className="p-2 text-center">%{reportData.allTime.req.perc}</td></tr>
                    </table>
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