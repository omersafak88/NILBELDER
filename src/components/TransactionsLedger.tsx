import { useState, useEffect } from 'react';
import { Plus, Upload, Trash2, X, Search, Edit2, Check, Download, Filter, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';
import * as XLSX from 'xlsx';

export default function TransactionsLedger() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>({});
  const [uploadPreview, setUploadPreview] = useState<any[]>([]);

  // Filtreleme State'leri
  const [filters, setFilters] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    type: 'all',
    categoryId: ''
  });

  const [formData, setFormData] = useState({
    type: 'income',
    category_id: '',
    amount: '',
    description: '',
    transaction_date: new Date().toISOString().split('T')[0],
    fullName: ''
  });

  // Sayfa yüklendiğinde sadece formlar için gerekli olan kategorileri ve üyeleri çekiyoruz
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    const { data: cats } = await supabase.from('transaction_categories').select('*').eq('is_active', true);
    const { data: mems } = await supabase.from('members').select('id, full_name');
    setCategories(cats || []);
    setMembers(mems || []);
  };

  // --- SINIRSIZ VE FİLTRELİ VERİ ÇEKME FONKSİYONU ---
  const fetchFilteredTransactions = async () => {
    setLoading(true);
    setError('');
    
    let allData: any[] = [];
    let from = 0;
    const step = 1000;
    let hasMore = true;

    try {
      while (hasMore) {
        let query = supabase
          .from('transactions')
          .select(`*, members (full_name), transaction_categories (name)`)
          .order('transaction_date', { ascending: false })
          .range(from, from + step - 1);

        // Filtreleme Uygula
        if (filters.startDate) query = query.gte('transaction_date', filters.startDate);
        if (filters.endDate) query = query.lte('transaction_date', filters.endDate);
        if (filters.type !== 'all') query = query.eq('type', filters.type);
        if (filters.categoryId) query = query.eq('category_id', filters.categoryId);

        const { data, error: err } = await query;
        
        if (err) throw err;

        if (data && data.length > 0) {
          allData = [...allData, ...data];
          from += step;
          // Eğer 1000'den az kayıt geldiyse çekilecek başka veri kalmamıştır
          if (data.length < step) hasMore = false;
        } else {
          hasMore = false;
        }
      }
      
      setTransactions(allData);
      
      if (allData.length === 0) {
        setError('Seçilen kriterlere uygun kayıt bulunamadı.');
      }
    } catch (err: any) {
      setError("Hata: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const userStr = localStorage.getItem('association_user');
      const currentUser = userStr ? JSON.parse(userStr) : null;
      const matchedMember = members.find(m => m.full_name.toLocaleLowerCase('tr-TR').trim() === formData.fullName.toLocaleLowerCase('tr-TR').trim());
      const finalDescription = matchedMember ? formData.description : `${formData.fullName}${formData.description ? ' - ' + formData.description : ''}`;

      const { error: insErr } = await supabase.from('transactions').insert([{
        transaction_date: formData.transaction_date,
        type: formData.type,
        category_id: formData.category_id,
        amount: parseFloat(formData.amount),
        description: finalDescription,
        member_id: matchedMember?.id || null,
        created_by: currentUser?.id
      }]);

      if (insErr) throw insErr;
      setShowAddForm(false);
      setFormData({ type: 'income', category_id: '', amount: '', description: '', transaction_date: new Date().toISOString().split('T')[0], fullName: '' });
      fetchFilteredTransactions();
    } catch (err: any) { setError(err.message); }
    setLoading(false);
  };

  const downloadTemplate = () => {
    const templateData = [{ "Tarih": "16.02.2026", "Tür": "Gelir", "Kategori": "Aidat", "Ad Soyad": "Ömer Şafak", "Tutar": 1000, "Açıklama": "Aidat" }];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Yükleme Şablonu");
    XLSX.writeFile(wb, "Dernek_Sablon.xlsx");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws);
        const processed = data.map((row: any) => {
          const rowName = (row['Ad Soyad'] || '').toString().trim();
          const matchedMember = members.find(m => m.full_name.toLocaleLowerCase('tr-TR').trim() === rowName.toLocaleLowerCase('tr-TR'));
          const cat = categories.find(c => c.name.toLocaleLowerCase('tr-TR').trim() === (row['Kategori'] || '').toString().trim().toLowerCase());
          return {
            transaction_date: row['Tarih'] instanceof Date ? row['Tarih'].toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            type: (row['Tür'] || 'Gelir').toLowerCase() === 'gider' ? 'expense' : 'income',
            category_id: cat?.id || '',
            amount: parseFloat(row['Tutar'] || 0),
            description: matchedMember ? (row['Açıklama'] || "") : `${rowName}${row['Açıklama'] ? ' - ' + row['Açıklama'] : ''}`,
            member_id: matchedMember?.id || null,
            member_name: rowName,
            isValid: !!cat && parseFloat(row['Tutar']) > 0
          };
        });
        setUploadPreview(processed);
      } catch (err) { setError("Excel okuma hatası."); }
    };
    reader.readAsBinaryString(file);
  };

  const saveUploadedData = async () => {
    setLoading(true);
    const userStr = localStorage.getItem('association_user');
    const currentUser = userStr ? JSON.parse(userStr) : null;
    let count = 0;
    for (const row of uploadPreview.filter(x => x.isValid)) {
      const { error: err } = await supabase.from('transactions').insert([{
        transaction_date: row.transaction_date,
        type: row.type,
        category_id: row.category_id,
        amount: row.amount,
        description: row.description,
        member_id: row.member_id,
        created_by: currentUser?.id
      }]);
      if (!err) count++;
    }
    alert(`${count} kayıt eklendi.`);
    setShowUploadForm(false);
    setUploadPreview([]);
    fetchFilteredTransactions();
    setLoading(false);
  };

  const startEdit = (t: any) => { setEditingId(t.id); setEditData({ ...t }); };
  const handleEditSave = async (id: string) => {
    const { error: updateErr } = await supabase.from('transactions').update({
      amount: parseFloat(editData.amount),
      description: editData.description,
      transaction_date: editData.transaction_date
    }).eq('id', id);
    if (!updateErr) { setEditingId(null); fetchFilteredTransactions(); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <h2 className="text-2xl font-bold text-slate-800">Gelir-Gider Kayıtları</h2>
        <div className="flex gap-2 w-full md:w-auto">
          <button onClick={() => { setShowUploadForm(true); setShowAddForm(false); }} className="bg-emerald-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 font-bold shadow-md hover:bg-emerald-700">
            <Upload size={18}/> Excel
          </button>
          <button onClick={() => { setShowAddForm(true); setShowUploadForm(false); }} className="bg-slate-800 text-white px-4 py-2 rounded-xl flex items-center gap-2 font-bold shadow-md hover:bg-slate-900">
            <Plus size={18}/> Yeni Kayıt
          </button>
        </div>
      </div>

      {/* FİLTRELEME ALANI */}
      <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-slate-800 font-bold mb-2">
          <Filter size={20} className="text-blue-600" />
          <h3>Sorgulama Paneli</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Başlangıç</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-2.5 text-slate-400" size={16} />
              <input type="date" className="pl-10 pr-4 py-2 border rounded-xl w-full text-sm" value={filters.startDate} onChange={e => setFilters({...filters, startDate: e.target.value})} />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Bitiş</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-2.5 text-slate-400" size={16} />
              <input type="date" className="pl-10 pr-4 py-2 border rounded-xl w-full text-sm" value={filters.endDate} onChange={e => setFilters({...filters, endDate: e.target.value})} />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Tür</label>
            <select className="w-full p-2 border rounded-xl text-sm" value={filters.type} onChange={e => setFilters({...filters, type: e.target.value, categoryId: ''})}>
              <option value="all">Hepsi</option>
              <option value="income">Gelir (+)</option>
              <option value="expense">Gider (-)</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Kategori</label>
            <select className="w-full p-2 border rounded-xl text-sm" value={filters.categoryId} onChange={e => setFilters({...filters, categoryId: e.target.value})}>
              <option value="">Tüm Kategoriler</option>
              {categories.filter(c => filters.type === 'all' ? true : c.type === filters.type).map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <button 
            onClick={fetchFilteredTransactions} 
            disabled={loading}
            className="bg-blue-600 text-white py-2.5 rounded-xl font-bold shadow-lg hover:bg-blue-700 flex items-center justify-center gap-2"
          >
            {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Search size={18} />}
            KAYITLARI GETİR
          </button>
        </div>
        {error && <div className="text-rose-600 text-xs font-bold bg-rose-50 p-2 rounded-lg">{error}</div>}
      </div>

      {showAddForm && (
        <div className="bg-white p-6 rounded-2xl border shadow-xl animate-in fade-in zoom-in duration-200">
          <div className="flex justify-between items-center mb-6 font-bold"><h3>Yeni Manuel Kayıt</h3><button onClick={() => setShowAddForm(false)}><X/></button></div>
          <form onSubmit={handleManualSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <input type="text" className="p-2 border rounded-xl font-bold bg-slate-50" placeholder="Ad Soyad (Zorunlu)" required value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} />
            <select className="p-2 border rounded-xl" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
              <option value="income">Gelir (+)</option><option value="expense">Gider (-)</option>
            </select>
            <select className="p-2 border rounded-xl" required value={formData.category_id} onChange={e => setFormData({...formData, category_id: e.target.value})}>
              <option value="">Kategori Seç...</option>
              {categories.filter(c => c.type === formData.type).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input type="date" className="p-2 border rounded-xl" value={formData.transaction_date} onChange={e => setFormData({...formData, transaction_date: e.target.value})} required />
            <input type="number" step="0.01" className="p-2 border rounded-xl text-right" placeholder="Tutar (₺)" required value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
            <input type="text" className="p-2 border rounded-xl" placeholder="Açıklama" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
            <button type="submit" disabled={loading} className="lg:col-span-3 bg-blue-600 text-white py-3 rounded-xl font-bold shadow-lg">
              {loading ? "Kaydediliyor..." : "Kaydet"}
            </button>
          </form>
        </div>
      )}

      {showUploadForm && (
        <div className="bg-white p-6 rounded-2xl border shadow-xl">
          <div className="flex justify-between items-center mb-6 font-bold"><h3>Excel Veri Yükle</h3><button onClick={() => setShowUploadForm(false)}><X/></button></div>
          {!uploadPreview.length ? (
            <div className="text-center space-y-4">
              <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} className="w-full p-12 border-2 border-dashed rounded-xl cursor-pointer hover:bg-slate-50 transition-colors" />
              <button onClick={downloadTemplate} className="flex items-center gap-2 mx-auto text-blue-600 font-bold hover:underline">
                <Download size={16}/> Örnek Excel Şablonu İndir
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="max-h-60 overflow-auto border rounded-xl text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 sticky top-0"><tr><th className="p-2">Tarih</th><th className="p-2">Ad Soyad</th><th className="p-2 text-right">Tutar</th></tr></thead>
                  <tbody>{uploadPreview.map((row, i) => (<tr key={i} className={!row.isValid ? "bg-rose-50" : ""}>
                    <td className="p-2">{row.transaction_date}</td><td className="p-2">{row.member_name}</td><td className="p-2 text-right font-bold">{row.amount} ₺</td>
                  </tr>))}</tbody>
                </table>
              </div>
              <button onClick={saveUploadedData} disabled={loading} className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold">Verileri Kaydet</button>
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 font-bold uppercase">
            <tr><th className="px-6 py-4">Tarih</th><th className="px-6 py-4">Kategori / Açıklama</th><th className="px-6 py-4">İsim (Üye/Dış)</th><th className="px-6 py-4 text-right">Tutar</th><th className="px-6 py-4 text-center">İşlem</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {transactions.length > 0 ? transactions.map(t => (
              <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4">
                  {editingId === t.id ? (
                    <input type="date" className="border rounded p-1 text-xs" value={editData.transaction_date} onChange={e => setEditData({...editData, transaction_date: e.target.value})}/>
                  ) : (new Date(t.transaction_date).toLocaleDateString('tr-TR'))}
                </td>
                <td className="px-6 py-4">
                  <div className="font-bold text-slate-800">{t.transaction_categories?.name}</div>
                  {editingId === t.id ? (
                    <input type="text" className="border rounded p-1 w-full text-xs" value={editData.description} onChange={e => setEditData({...editData, description: e.target.value})}/>
                  ) : (<div className="text-xs text-slate-400 italic line-clamp-1">{t.description || '-'}</div>)}
                </td>
                <td className="px-6 py-4 font-bold text-blue-700">{t.members?.full_name || "Dış Kayıt"}</td>
                <td className={`px-6 py-4 text-right font-black ${t.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {editingId === t.id ? (
                    <input type="number" className="border rounded p-1 w-24 text-right" value={editData.amount} onChange={e => setEditData({...editData, amount: e.target.value})}/>
                  ) : (`${t.type === 'income' ? '+' : '-'}${t.amount.toLocaleString('tr-TR')} ₺`)}
                </td>
                <td className="px-6 py-4 text-center">
                  <div className="flex justify-center gap-2">
                    {editingId === t.id ? (
                      <button onClick={() => handleEditSave(t.id)} className="text-emerald-600 hover:scale-110"><Check size={18}/></button>
                    ) : (
                      <button onClick={() => startEdit(t)} className="text-slate-400 hover:text-blue-600"><Edit2 size={16}/></button>
                    )}
                    <button onClick={async () => { if(confirm('Bu kayıt silinsin mi?')) { await supabase.from('transactions').delete().eq('id', t.id); fetchFilteredTransactions(); } }} className="text-slate-300 hover:text-rose-600">
                      <Trash2 size={16}/>
                    </button>
                  </div>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">Görüntülenecek kayıt yok. Lütfen yukarıdan tarih seçip "Kayıtları Getir" butonuna basınız.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}