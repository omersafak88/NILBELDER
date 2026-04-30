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
        const res = { 
          aidat: 0, bagis: 0, digerGelir: 0, sosyal: 0, egitim: 0, digerGider: 0, tGelir: 0, tGider: 0, 
          sKSet: new Set<string>(), eKSet: new Set<string>() 
        };
        data.forEach(item => {
          const cat = (item.transaction_categories?.name || '').toLocaleLowerCase('tr-TR');
          const amt = Number(item.amount);
          const p = (item.member_id ? memberMap.get(item.member_id) : item.description)?.toLocaleUpperCase('tr-TR');
          
          if (item.type === 'income') {
            res.tGelir += amt;
            if (cat.includes('aidat')) res.aidat += amt; 
            else if (cat.includes('bağış') || cat.includes('bagis')) res.bagis += amt; 
            else res.digerGelir += amt;
          } else {
            res.tGider += amt;
            if (p) {
              if (cat.includes('sosyal')) { res.sosyal += amt; res.sKSet.add(p); }
              else if (cat.includes('eğitim') || cat.includes('egitim')) { res.egitim += amt; res.eKSet.add(p); }
              else { res.digerGider += amt; }
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

  const handlePrint = () => {
    // Yazdırma stili ekle
    const style = document.createElement('style');
    style.innerHTML = `
      @media print {
        body * { visibility: hidden; }
        #printable-area, #printable-area * { visibility: visible; }
        #printable-area { position: absolute; left: 0; top: 0; width: 100%; }
        .print-hidden { display: none !important; }
      }
    `;
    document.head.appendChild(style);
    window.print();
    document.head.removeChild(style);
  };

  const formatCurrency = (val: number) => val.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-8 p-4 bg-slate-50 min-h-screen print:bg-white">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 print:hidden">
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

      <button onClick={() => setShowReportModal(true)} className="fixed bottom-8 right-8 z-40 bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-full shadow-2xl font-bold flex items-center gap-3 print:hidden">
        <FileText size={24} /> Faaliyet Raporu
      </button>

      {showReportModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[60] flex items-center justify-center p-4 print:static print:p-0">
          <div id="printable-area" className="bg-white rounded-3xl w-full max-w-5xl shadow-2xl max-h-[92vh] overflow-hidden flex flex-col print:max-h-none print:shadow-none print:w-full">
            <div className="p-6 border-b flex justify-between items-center bg-white print:hidden">
              <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-3">
                <div className="p-2 bg-blue-100 text-blue-600 rounded-xl"><ClipboardList /></div>
                Kurumsal Rapor Sistemi
              </h3>
              <div className="flex items-center gap-2">
                {reportData && (
                  <button onClick={handlePrint} className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2">
                    <Download size={18} /> PDF OLARAK İNDİR
                  </button>
                )}
                <button onClick={() => setShowReportModal(false)} className="p-2 hover:bg-slate-100 rounded-full"><X size={28} /></button>
              </div>
            </div>
            
            <div className="p-8 overflow-y-auto space-y-10 print:overflow-visible print:p-0">
              <div className="flex flex-wrap gap-4 bg-slate-50 p-5 rounded-2xl border border-slate-200 print:hidden">
                <div className="flex-1 min-w-[200px]">
                  <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Periyot Seçin</label>
                  <div className="flex gap-2">
                    <select className="flex-1 p-3 bg-white border rounded-xl font-semibold outline-none" value={reportDate.month} onChange={(e) => setReportDate({...reportDate, month: parseInt(e.target.value)})}>
                      {Array.from({length: 12}, (_, i) => <option key={i+1} value={i+1}>{i+1}. Ay</option>)}
                    </select>
                    <select className="flex-1 p-3 bg-white border rounded-xl font-semibold outline-none" value={reportDate.year} onChange={(e) => setReportDate({...reportDate, year: parseInt(e.target.value)})}>
                      {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                </div>
                <button onClick={generateReport} className="self-end px-12 py-3.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg">
                   {reportLoading ? 'Hazırlanıyor...' : 'RAPORU OLUŞTUR'}
                </button>
              </div>

              {reportData && (
                <div className="space-y-10 print:space-y-8">
                  <div className="hidden print:block text-center border-b-4 border-slate-900 pb-6 mb-8" style={{ pageBreakAfter: 'avoid' }}>
                    <h1 className="text-3xl font-black uppercase">NİL-BEL-DER FAALİYET RAPORU</h1>
                    <p className="text-lg font-bold text-slate-600 mt-2">Rapor Kesme Tarihi: {reportData.ceilingDate}</p>
                  </div>

                  {/* 1. DÖNEMSEL ANALİZ */}
                  <div className="bg-blue-50/40 border-2 border-blue-100 p-8 rounded-3xl" style={{ pageBreakInside: 'avoid' }}>
                    <h4 className="text-blue-900 font-black text-lg mb-4 uppercase underline decoration-2 underline-offset-8">1. Dönemsel Faaliyet Özeti ({reportDate.month}/{reportDate.year})</h4>
                    <div className="space-y-4 text-slate-800 italic text-base">
                      <p>Derneğimiz, <span className="font-bold">{reportDate.month}/{reportDate.year}</span> döneminde <span className="font-bold text-blue-700">{formatCurrency(reportData.monthly.fin.tGelir)} TL</span> toplam gelir elde etmiştir. Bu tutarın {formatCurrency(reportData.monthly.fin.aidat)} TL'si aidat, {formatCurrency(reportData.monthly.fin.bagis)} TL'si bağış ve {formatCurrency(reportData.monthly.fin.digerGelir)} TL'si diğer kalemlerden oluşmaktadır.</p>
                      <p>Aynı dönemde <strong>{reportData.monthly.fin.sKSet.size + reportData.monthly.fin.eKSet.size}</strong> kişiye <strong>{formatCurrency(reportData.monthly.fin.sosyal + reportData.monthly.fin.egitim)} TL</strong> yardım ulaştırılmıştır.</p>
                      <div className="not-italic font-bold bg-white/80 p-4 rounded-xl border border-blue-200 text-blue-800 text-sm">
                        Detay: {reportData.monthly.fin.sKSet.size} kişiye sosyal yardım, {reportData.monthly.fin.eKSet.size} kişiye eğitim yardımı sağlanmıştır. Operasyonel giderler (EFT vb.) {formatCurrency(reportData.monthly.fin.digerGider)} TL'dir.
                        <div className="mt-2 text-blue-600 font-bold"><MessageSquare size={16} className="inline mr-1" /> {reportData.monthly.req.tReq} talep alınmış, {reportData.monthly.req.tAct} faaliyet tamamlanmıştır.</div>
                      </div>
                    </div>
                  </div>

                  {/* 2. YILLIK ANALİZ */}
                  <div className="bg-emerald-50/40 border-2 border-emerald-100 p-8 rounded-3xl" style={{ pageBreakInside: 'avoid' }}>
                    <h4 className="text-emerald-900 font-black text-lg mb-4 uppercase underline decoration-2 underline-offset-8">2. Yıllık Kümülatif Analiz (01.01.{reportDate.year} - {reportData.ceilingDate})</h4>
                    <div className="space-y-4 text-slate-800 italic text-base">
                      <p>Yıl başından rapor tarihine kadar toplam <strong>{formatCurrency(reportData.yearly.fin.tGelir)} TL</strong> gelir konsolide edilmiş; buna karşılık toplam <strong>{reportData.yearly.fin.sKSet.size + reportData.yearly.fin.eKSet.size} farklı bireye</strong> destek sağlanmıştır.</p>
                      <div className="not-italic font-bold bg-white/80 p-4 rounded-xl border border-emerald-200 text-emerald-800 text-sm">
                        Yıllık Dağılım: {reportData.yearly.fin.sKSet.size} kişi sosyal, {reportData.yearly.fin.eKSet.size} kişi eğitim yardımı almıştır.
                        <div className="mt-2 text-emerald-600 font-bold"><Activity size={16} className="inline mr-1" /> Toplam onaylanan talep: {reportData.yearly.req.pReq} (%{reportData.yearly.req.perc})</div>
                      </div>
                    </div>
                  </div>

                  {/* 3. VERİ KARŞILAŞTIRMA TABLOSU */}
                  <div className="space-y-4" style={{ pageBreakInside: 'avoid' }}>
                    <h4 className="text-slate-800 font-black text-lg uppercase flex items-center gap-2">
                      <TableIcon className="text-blue-600" /> 3. Karşılaştırmalı Veri Tablosu
                    </h4>
                    <div className="overflow-hidden border-2 border-slate-200 rounded-2xl">
                      <table className="w-full text-left border-collapse bg-white">
                        <thead>
                          <tr className="bg-slate-900 text-white text-[10px] uppercase">
                            <th className="p-4 border-r border-slate-700">AÇIKLAMA / KALEM</th>
                            <th className="p-4 border-r border-slate-700 text-center">AYLIK ({reportDate.month})</th>
                            <th className="p-4 border-r border-slate-700 text-center">YILLIK ({reportDate.year})</th>
                            <th className="p-4 text-center">TÜM ZAMANLAR</th>
                          </tr>
                        </thead>
                        <tbody className="text-xs text-slate-700 font-medium">
                          <tr className="bg-slate-50 font-bold border-b text-[10px]"><td className="p-2" colSpan={4}>GELİR KALEMLERİ (TL)</td></tr>
                          <tr className="border-b"><td className="p-2 pl-4">Üye Aidatları / Bağışlar</td><td className="p-2 text-center">{formatCurrency(reportData.monthly.fin.aidat)} / {formatCurrency(reportData.monthly.fin.bagis)}</td><td className="p-2 text-center">{formatCurrency(reportData.yearly.fin.aidat)} / {formatCurrency(reportData.yearly.fin.bagis)}</td><td className="p-2 text-center">{formatCurrency(reportData.allTime.fin.aidat)} / {formatCurrency(reportData.allTime.fin.bagis)}</td></tr>
                          <tr className="bg-emerald-50 font-black border-b"><td className="p-2 pl-4 uppercase">Toplam Gelir Hacmi</td><td className="p-2 text-center">{formatCurrency(reportData.monthly.fin.tGelir)}</td><td className="p-2 text-center">{formatCurrency(reportData.yearly.fin.tGelir)}</td><td className="p-2 text-center">{formatCurrency(reportData.allTime.fin.tGelir)}</td></tr>
                          
                          <tr className="bg-slate-50 font-bold border-b text-[10px]"><td className="p-2" colSpan={4}>YARDIM VE GİDERLER (TL)</td></tr>
                          <tr className="border-b"><td className="p-2 pl-4">Sosyal / Eğitim Yardımları</td><td className="p-2 text-center">{formatCurrency(reportData.monthly.fin.sosyal)} / {formatCurrency(reportData.monthly.fin.egitim)}</td><td className="p-2 text-center">{formatCurrency(reportData.yearly.fin.sosyal)} / {formatCurrency(reportData.yearly.fin.egitim)}</td><td className="p-2 text-center">{formatCurrency(reportData.allTime.fin.sosyal)} / {formatCurrency(reportData.allTime.fin.egitim)}</td></tr>
                          <tr className="bg-rose-50 font-black border-b"><td className="p-2 pl-4 uppercase">Toplam Gider Hacmi</td><td className="p-2 text-center">{formatCurrency(reportData.monthly.fin.tGider)}</td><td className="p-2 text-center">{formatCurrency(reportData.yearly.fin.tGider)}</td><td className="p-2 text-center">{formatCurrency(reportData.allTime.fin.tGider)}</td></tr>
                          
                          <tr className="bg-slate-50 font-bold border-b text-[10px]"><td className="p-2" colSpan={4}>YARDIM ALICI SAYILARI (BENZERSİZ)</td></tr>
                          <tr className="border-b"><td className="p-2 pl-4">Sosyal / Eğitim Alanlar</td><td className="p-2 text-center">{reportData.monthly.fin.sKSet.size} / {reportData.monthly.fin.eKSet.size}</td><td className="p-2 text-center font-bold text-blue-600">{reportData.yearly.fin.sKSet.size} / {reportData.yearly.fin.eKSet.size}</td><td className="p-2 text-center font-bold text-blue-800">{reportData.allTime.fin.sKSet.size} / {reportData.allTime.fin.eKSet.size}</td></tr>
                          <tr className="border-b bg-blue-50 font-black"><td className="p-2 pl-4 uppercase">Toplam Farklı Kişi</td><td className="p-2 text-center">{reportData.monthly.fin.sKSet.size + reportData.monthly.fin.eKSet.size}</td><td className="p-2 text-center">{reportData.yearly.fin.sKSet.size + reportData.yearly.fin.eKSet.size}</td><td className="p-2 text-center">{reportData.allTime.fin.sKSet.size + reportData.allTime.fin.eKSet.size}</td></tr>
                          
                          <tr className="bg-slate-50 font-bold border-b text-[10px]"><td className="p-2" colSpan={4}>PERFORMANS VE TALEPLER</td></tr>
                          <tr className="border-b"><td className="p-2 pl-4">Gelen Toplam Talep / Olumlu</td><td className="p-2 text-center">{reportData.monthly.req.tReq} / {reportData.monthly.req.pReq}</td><td className="p-2 text-center">{reportData.yearly.req.tReq} / {reportData.yearly.req.pReq}</td><td className="p-2 text-center">{reportData.allTime.req.tReq} / {reportData.allTime.req.pReq}</td></tr>
                          <tr className="border-b font-bold"><td className="p-2 pl-4 uppercase">Talep Karşılama Oranı</td><td className="p-2 text-center">%{reportData.monthly.req.perc}</td><td className="p-2 text-center">%{reportData.yearly.req.perc}</td><td className="p-2 text-center">%{reportData.allTime.req.perc}</td></tr>
                          <tr><td className="p-2 pl-4 uppercase">Saha Faaliyet Adedi</td><td className="p-2 text-center">{reportData.monthly.req.tAct}</td><td className="p-2 text-center">{reportData.yearly.req.tAct}</td><td className="p-2 text-center">{reportData.allTime.req.tAct}</td></tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* İmza Alanı */}
                  <div className="mt-12 border-t-2 border-slate-100 pt-6" style={{ pageBreakInside: 'avoid' }}>
                    <p className="text-[10px] italic text-slate-500 mb-8">NİL-BEL-DER Otomatik Raporlama Sistemi | {new Date().toLocaleDateString('tr-TR')}</p>
                    <div className="hidden print:flex justify-between px-8">
                      <div className="text-center w-48 border-t border-slate-900 pt-2 font-bold text-xs uppercase">Ömer ŞAFAK<br/>Dernek Başkanı</div>
                      <div className="text-center w-48 border-t border-slate-900 pt-2 font-bold text-xs uppercase">Mali Sekreter</div>
                      <div className="text-center w-48 border-t border-slate-900 pt-2 font-bold text-xs uppercase">Denetleme Kurulu</div>
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