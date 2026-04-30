import { useState, useEffect } from 'react';
import { X, FileText, Calendar, Users, ClipboardList, RefreshCw, Activity, MessageSquare, Download, Table as TableIcon, CheckCircle } from 'lucide-react';
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
        const pos = reqs.filter(x => x.result_status === 'positive').length;
        const perc = reqs.length > 0 ? Math.round((pos / reqs.length) * 100) : 0;
        return { tReq: reqs.length, pReq: pos, tAct: acts.length, perc: perc };
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

  const handlePrint = () => window.print();

  const formatCurrency = (val: number) => val.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-8 p-4 bg-slate-50 min-h-screen print:bg-white print:p-0">
      {/* İstatistik Kartları */}
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
          <p className="text-slate-500 text-xs font-bold uppercase tracking-tighter">Talepler / Faaliyetler</p>
          <p className="text-2xl font-black text-slate-800">{stats.totalRequests + stats.totalActivities}</p>
          <div className="flex gap-2 mt-1 text-[10px] font-bold uppercase">
             <span className="text-cyan-600 bg-cyan-50 px-1 rounded">{stats.totalRequests} TALEP</span>
             <span className="text-purple-600 bg-purple-50 px-1 rounded">{stats.totalActivities} FAALİYET</span>
          </div>
        </div>
      </div>

      <button onClick={() => setShowReportModal(true)} className="fixed bottom-8 right-8 z-40 bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-full shadow-2xl font-bold flex items-center gap-3 print:hidden transition-transform hover:scale-105">
        <FileText size={24} /> Detaylı Faaliyet Raporu
      </button>

      {showReportModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[60] flex items-center justify-center p-4 print:relative print:inset-auto print:bg-white print:p-0 print:block">
          <div className="bg-white rounded-3xl w-full max-w-5xl shadow-2xl max-h-[92vh] overflow-hidden flex flex-col print:shadow-none print:max-h-none print:rounded-none">
            {/* Modal Header */}
            <div className="p-6 border-b flex justify-between items-center bg-white print:hidden">
              <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-3">
                <div className="p-2 bg-blue-100 text-blue-600 rounded-xl"><ClipboardList /></div>
                Kurumsal Faaliyet Analizi
              </h3>
              <div className="flex items-center gap-2">
                {reportData && (
                  <button onClick={handlePrint} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-emerald-100 transition-all">
                    <Download size={18} /> PDF OLARAK İNDİR
                  </button>
                )}
                <button onClick={() => setShowReportModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={28} /></button>
              </div>
            </div>
            
            <div className="p-8 overflow-y-auto space-y-10 print:overflow-visible print:p-4">
              {/* Filtreler */}
              <div className="flex flex-wrap gap-4 bg-slate-50 p-5 rounded-2xl border border-slate-200 print:hidden">
                <div className="flex-1 min-w-[200px]">
                  <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Raporlama Periyodu</label>
                  <div className="flex gap-2">
                    <select className="flex-1 p-3 bg-white border rounded-xl font-semibold outline-none" value={reportDate.month} onChange={(e) => setReportDate({...reportDate, month: parseInt(e.target.value)})}>
                      {Array.from({length: 12}, (_, i) => <option key={i+1} value={i+1}>{i+1}. Ay</option>)}
                    </select>
                    <select className="flex-1 p-3 bg-white border rounded-xl font-semibold outline-none" value={reportDate.year} onChange={(e) => setReportDate({...reportDate, year: parseInt(e.target.value)})}>
                      {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                </div>
                <button onClick={generateReport} className="self-end px-12 py-3.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg transition-all">
                   {reportLoading ? 'Veriler İşleniyor...' : 'RAPORU OLUŞTUR'}
                </button>
              </div>

              {reportData && (
                <div className="space-y-10 animate-in slide-in-from-bottom-4 duration-500">
                  <div className="hidden print:block text-center border-b-4 border-slate-900 pb-6 mb-10">
                    <h1 className="text-4xl font-black uppercase tracking-tighter">NİL-BEL-DER FAALİYET RAPORU</h1>
                    <p className="text-xl font-bold text-slate-600 mt-2">Kümülatif Kesme Tarihi: {reportData.ceilingDate}</p>
                  </div>

                  {/* 1. DÖNEMSEL ANALİZ */}
                  <div className="bg-blue-50/40 border-2 border-blue-100 p-8 rounded-3xl relative">
                    <h4 className="text-blue-900 font-black text-lg mb-4 uppercase underline decoration-2 underline-offset-8 text-base">1. Dönemsel Faaliyet Özeti ({reportDate.month}/{reportDate.year})</h4>
                    <div className="space-y-4 text-slate-800 leading-relaxed italic text-base">
                      <p>Derneğimiz, <span className="font-bold">{reportDate.month}/{reportDate.year}</span> döneminde <span className="font-bold text-blue-700">{formatCurrency(reportData.monthly.fin.tGelir)} TL</span> toplam gelir elde etmiştir. Bu gelirin detayı; {formatCurrency(reportData.monthly.fin.aidat)} TL aidat, {formatCurrency(reportData.monthly.fin.bagis)} TL bağış ve {formatCurrency(reportData.monthly.fin.digerGelir)} TL diğer gelirler şeklindedir.</p>
                      <p>Aynı dönemde <strong>{reportData.monthly.fin.kSet.size}</strong> kişiye toplam <strong>{formatCurrency(reportData.monthly.fin.tGider)} TL</strong> yardım ulaştırılmıştır. (Sosyal: {formatCurrency(reportData.monthly.fin.sosyal)} TL, Eğitim: {formatCurrency(reportData.monthly.fin.egitim)} TL)</p>
                      <p className="not-italic font-bold bg-white/80 p-4 rounded-xl border border-blue-200 text-blue-800 shadow-sm text-sm">
                        <MessageSquare size={18} className="inline mr-2 mb-1" /> Saha Operasyonu: Bu ay {reportData.monthly.req.tReq} yardım talebi alınmış, {reportData.monthly.req.pReq} adedi olumlu sonuçlanarak {reportData.monthly.req.tAct} faaliyet icra edilmiştir. (Onay Oranı: %{reportData.monthly.req.perc})
                      </p>
                    </div>
                  </div>

                  {/* 2. YILLIK ANALİZ */}
                  <div className="bg-emerald-50/40 border-2 border-emerald-100 p-8 rounded-3xl">
                    <h4 className="text-emerald-900 font-black text-lg mb-4 uppercase underline decoration-2 underline-offset-8 text-base">2. Yıllık Kümülatif Analiz (01.01.{reportDate.year} - {reportData.ceilingDate})</h4>
                    <div className="space-y-4 text-slate-800 leading-relaxed italic text-base">
                      <p>Yıl başından rapor tarihine kadar toplam <strong>{formatCurrency(reportData.yearly.fin.tGelir)} TL</strong> gelir konsolide edilmiş; buna karşılık toplam <strong>{formatCurrency(reportData.yearly.fin.tGider)} TL</strong> harcama yapılmıştır.</p>
                      <p>Bu süreçte toplam <strong>{reportData.yearly.fin.kSet.size} benzersiz kişiye</strong> el uzatılmış, sosyal dayanışma faaliyetleri kapsamında {formatCurrency(reportData.yearly.fin.sosyal)} TL kaynak aktarılmıştır.</p>
                      <p className="not-italic font-bold bg-white/80 p-4 rounded-xl border border-emerald-200 text-emerald-800 shadow-sm text-sm">
                        <Activity size={18} className="inline mr-2 mb-1" /> Yıllık Performans: {reportDate.year} yılı başından itibaren toplam {reportData.yearly.req.tReq} talep dosyalanmış, bunlardan {reportData.yearly.req.pReq} adedi (%{reportData.yearly.req.perc}) onaylanarak {reportData.yearly.req.tAct} saha faaliyeti gerçekleştirilmiştir.
                      </p>
                    </div>
                  </div>

                  {/* 3. VERİ KARŞILAŞTIRMA TABLOSU */}
                  <div className="space-y-4">
                    <h4 className="text-slate-800 font-black text-lg uppercase flex items-center gap-2 text-base">
                      <TableIcon className="text-blue-600" /> 3. Detaylı Veri Karşılaştırma Tablosu
                    </h4>
                    <div className="overflow-hidden border-2 border-slate-200 rounded-2xl shadow-sm">
                      <table className="w-full text-left border-collapse bg-white">
                        <thead>
                          <tr className="bg-slate-900 text-white text-[11px] uppercase tracking-widest">
                            <th className="p-4 border-r border-slate-700">AÇIKLAMA / KALEM</th>
                            <th className="p-4 border-r border-slate-700 text-center">AYLIK ({reportDate.month})</th>
                            <th className="p-4 border-r border-slate-700 text-center">YILLIK ({reportDate.year})</th>
                            <th className="p-4 text-center">GENEL TOPLAM</th>
                          </tr>
                        </thead>
                        <tbody className="text-sm text-slate-700 font-medium">
                          <tr className="border-b bg-slate-50/50"><td className="p-3 font-bold text-slate-900 text-xs" colSpan={4}>GELİR KALEMLERİ</td></tr>
                          <tr className="border-b"><td className="p-3 pl-6">Üye Aidatları</td><td className="p-3 text-center">{formatCurrency(reportData.monthly.fin.aidat)}</td><td className="p-3 text-center">{formatCurrency(reportData.yearly.fin.aidat)}</td><td className="p-3 text-center">{formatCurrency(reportData.allTime.fin.aidat)}</td></tr>
                          <tr className="border-b"><td className="p-3 pl-6">Bağış Gelirleri</td><td className="p-3 text-center">{formatCurrency(reportData.monthly.fin.bagis)}</td><td className="p-3 text-center">{formatCurrency(reportData.yearly.fin.bagis)}</td><td className="p-3 text-center">{formatCurrency(reportData.allTime.fin.bagis)}</td></tr>
                          <tr className="border-b"><td className="p-3 pl-6">Diğer Gelirler</td><td className="p-3 text-center">{formatCurrency(reportData.monthly.fin.digerGelir)}</td><td className="p-3 text-center">{formatCurrency(reportData.yearly.fin.digerGelir)}</td><td className="p-3 text-center">{formatCurrency(reportData.allTime.fin.digerGelir)}</td></tr>
                          <tr className="bg-emerald-50 font-black text-emerald-900 border-b"><td className="p-3 pl-6">TOPLAM GELİR</td><td className="p-3 text-center">{formatCurrency(reportData.monthly.fin.tGelir)}</td><td className="p-3 text-center">{formatCurrency(reportData.yearly.fin.tGelir)}</td><td className="p-3 text-center">{formatCurrency(reportData.allTime.fin.tGelir)}</td></tr>
                          
                          <tr className="border-b bg-slate-50/50"><td className="p-3 font-bold text-slate-900 text-xs" colSpan={4}>GİDER VE YARDIM KALEMLERİ</td></tr>
                          <tr className="border-b"><td className="p-3 pl-6">Sosyal Yardımlar</td><td className="p-3 text-center">{formatCurrency(reportData.monthly.fin.sosyal)}</td><td className="p-3 text-center">{formatCurrency(reportData.yearly.fin.sosyal)}</td><td className="p-3 text-center">{formatCurrency(reportData.allTime.fin.sosyal)}</td></tr>
                          <tr className="border-b"><td className="p-3 pl-6">Eğitim Yardımları</td><td className="p-3 text-center">{formatCurrency(reportData.monthly.fin.egitim)}</td><td className="p-3 text-center">{formatCurrency(reportData.yearly.fin.egitim)}</td><td className="p-3 text-center">{formatCurrency(reportData.allTime.fin.egitim)}</td></tr>
                          <tr className="border-b"><td className="p-3 pl-6">Operasyonel Giderler</td><td className="p-3 text-center">{formatCurrency(reportData.monthly.fin.digerGider)}</td><td className="p-3 text-center">{formatCurrency(reportData.yearly.fin.digerGider)}</td><td className="p-3 text-center">{formatCurrency(reportData.allTime.fin.digerGider)}</td></tr>
                          <tr className="bg-rose-50 font-black text-rose-900 border-b"><td className="p-3 pl-6">TOPLAM GİDER</td><td className="p-3 text-center">{formatCurrency(reportData.monthly.fin.tGider)}</td><td className="p-3 text-center">{formatCurrency(reportData.yearly.fin.tGider)}</td><td className="p-3 text-center">{formatCurrency(reportData.allTime.fin.tGider)}</td></tr>
                          
                          <tr className="border-b bg-slate-50/50"><td className="p-3 font-bold text-slate-900 text-xs" colSpan={4}>OPERASYONEL VE PERFORMANS GÖSTERGELERİ</td></tr>
                          <tr className="border-b font-bold"><td className="p-3 pl-6">Yardım Yapılan Kişi Sayısı</td><td className="p-3 text-center">{reportData.monthly.fin.kSet.size}</td><td className="p-3 text-center text-emerald-700">{reportData.yearly.fin.kSet.size}</td><td className="p-3 text-center text-blue-700">{reportData.allTime.fin.kSet.size}</td></tr>
                          <tr className="border-b"><td className="p-3 pl-6">Gelen Talep Sayısı</td><td className="p-3 text-center">{reportData.monthly.req.tReq}</td><td className="p-3 text-center">{reportData.yearly.req.tReq}</td><td className="p-3 text-center">{reportData.allTime.req.tReq}</td></tr>
                          
                          {/* YENİ EKLENEN SATIRLAR: Olumlu Talep ve Yüzde */}
                          <tr className="border-b text-emerald-700"><td className="p-3 pl-6">Olumlu Sonuçlanan Talep</td><td className="p-3 text-center font-bold">{reportData.monthly.req.pReq}</td><td className="p-3 text-center font-bold">{reportData.yearly.req.pReq}</td><td className="p-3 text-center font-bold">{reportData.allTime.req.pReq}</td></tr>
                          <tr className="border-b text-blue-700 bg-blue-50/30"><td className="p-3 pl-6 uppercase text-[10px] font-black">Talep Karşılama Oranı (%)</td><td className="p-3 text-center font-black">%{reportData.monthly.req.perc}</td><td className="p-3 text-center font-black">%{reportData.yearly.req.perc}</td><td className="p-3 text-center font-black">%{reportData.allTime.req.perc}</td></tr>
                          
                          <tr><td className="p-3 pl-6">Tamamlanan Saha Faaliyetleri</td><td className="p-3 text-center">{reportData.monthly.req.tAct}</td><td className="p-3 text-center">{reportData.yearly.req.tAct}</td><td className="p-3 text-center">{reportData.allTime.req.tAct}</td></tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="bg-amber-50 border-2 border-amber-100 p-6 rounded-2xl italic text-slate-800 text-sm">
                    <p><strong>Üyelik Notu:</strong> Rapor tavan tarihi itibarıyla derneğimizin toplam aktif üye sayısı <span className="font-bold">{stats.activeMembers}</span> kişidir. İlgili dönemde aramıza katılan yeni üyeler: <span className="not-italic font-bold text-amber-900">{reportData.newMembers.length > 0 ? reportData.newMembers.join(', ') : 'Bulunmamaktadır'}</span>.</p>
                  </div>

                  <div className="hidden print:flex justify-between mt-20">
                    <div className="text-center w-48 border-t border-slate-900 pt-2 font-bold text-sm">Ömer ŞAFAK<br/>Dernek Başkanı</div>
                    <div className="text-center w-48 border-t border-slate-900 pt-2 font-bold text-sm">Mali Sekreter</div>
                    <div className="text-center w-48 border-t border-slate-900 pt-2 font-bold text-sm">Denetleme Kurulu</div>
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