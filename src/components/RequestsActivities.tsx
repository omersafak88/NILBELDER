import { useState, useEffect } from 'react';
import {
  Plus, X, FileText, ClipboardList, CheckCircle2, XCircle,
  Pencil, Trash2, ChevronDown, Calendar, Filter, Search, Download
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface RequestActivity {
  id: string;
  type: 'request' | 'activity';
  description: string;
  result_status: 'positive' | 'negative' | null;
  result_description: string | null;
  event_date: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface Props {
  isAdmin: boolean;
  currentMemberId: string;
}

type FormData = {
  type: 'request' | 'activity';
  description: string;
  result_status: 'positive' | 'negative' | null;
  result_description: string;
  event_date: string;
};

const todayStr = () => new Date().toISOString().split('T')[0];

const emptyForm: FormData = {
  type: 'activity',
  description: '',
  result_status: null,
  result_description: '',
  event_date: todayStr(),
};

export default function RequestsActivities({ isAdmin, currentMemberId }: Props) {
  const [records, setRecords] = useState<RequestActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'request' | 'activity'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    loadRecords();
  }, []);

  const loadRecords = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('requests_activities')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRecords(data || []);
    } catch (err) {
      console.error('Kayıtlar yüklenirken hata:', err);
    } finally {
      setLoading(false);
    }
  };

  const openNew = () => {
    setForm({ ...emptyForm });
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (rec: RequestActivity) => {
    setForm({
      type: rec.type,
      description: rec.description,
      result_status: rec.result_status,
      result_description: rec.result_description || '',
      event_date: rec.event_date || todayStr(),
    });
    setEditingId(rec.id);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({ ...emptyForm });
  };

  const handleSave = async () => {
    if (!form.description.trim()) return;
    setSaving(true);
    try {
      const payload: any = {
        type: form.type,
        description: form.description.trim(),
        result_status: form.type === 'request' ? form.result_status : null,
        result_description: form.type === 'request' ? (form.result_description.trim() || null) : null,
        event_date: form.event_date || null,
      };

      if (editingId) {
        const { error } = await supabase
          .from('requests_activities')
          .update(payload)
          .eq('id', editingId);
        if (error) throw error;
      } else {
        payload.created_by = currentMemberId;
        const { error } = await supabase
          .from('requests_activities')
          .insert(payload);
        if (error) throw error;
      }

      closeForm();
      await loadRecords();
    } catch (err) {
      console.error('Kayıt hatası:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('requests_activities')
        .delete()
        .eq('id', id);
      if (error) throw error;
      setDeleteConfirm(null);
      await loadRecords();
    } catch (err) {
      console.error('Silme hatası:', err);
    }
  };

  const filtered = records.filter(r => {
    if (filterType !== 'all' && r.type !== filterType) return false;
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLocaleLowerCase('tr-TR');
    return (
      r.description.toLocaleLowerCase('tr-TR').includes(term) ||
      (r.result_description || '').toLocaleLowerCase('tr-TR').includes(term)
    );
  });

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });

  const exportAsHtml = () => {
    const requests = records.filter(r => r.type === 'request');
    const activities = records.filter(r => r.type === 'activity');
    const positiveCount = requests.filter(r => r.result_status === 'positive').length;
    const negativeCount = requests.filter(r => r.result_status === 'negative').length;
    const pendingCount = requests.filter(r => !r.result_status).length;

    const fmtDate = (d: string) =>
      new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });

    const html = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Talepler ve Faaliyetler Raporu</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; background: #f8fafc; color: #1e293b; line-height: 1.6; padding: 40px 24px; }
  .container { max-width: 900px; margin: 0 auto; }
  .header { text-align: center; margin-bottom: 48px; padding-bottom: 32px; border-bottom: 2px solid #e2e8f0; }
  .header h1 { font-size: 28px; font-weight: 800; color: #0f172a; margin-bottom: 8px; }
  .header p { font-size: 14px; color: #64748b; }
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 16px; margin-bottom: 48px; }
  .stat-card { background: white; border-radius: 12px; padding: 20px; text-align: center; border: 1px solid #e2e8f0; }
  .stat-card .number { font-size: 32px; font-weight: 800; }
  .stat-card .label { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; margin-top: 4px; }
  .stat-card.total .number { color: #0f172a; }
  .stat-card.positive .number { color: #059669; }
  .stat-card.negative .number { color: #dc2626; }
  .stat-card.pending .number { color: #d97706; }
  .stat-card.activity .number { color: #0891b2; }
  .section { margin-bottom: 48px; }
  .section-title { font-size: 20px; font-weight: 700; margin-bottom: 20px; padding-bottom: 12px; border-bottom: 2px solid #e2e8f0; display: flex; align-items: center; gap: 10px; }
  .section-title .icon { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 16px; }
  .section-title .icon.request { background: #fef3c7; }
  .section-title .icon.activity { background: #ccfbf1; }
  .record { background: white; border-radius: 12px; padding: 20px; margin-bottom: 12px; border: 1px solid #e2e8f0; page-break-inside: avoid; }
  .record-header { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; flex-wrap: wrap; }
  .badge { display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
  .badge.positive { background: #d1fae5; color: #065f46; }
  .badge.negative { background: #fee2e2; color: #991b1b; }
  .badge.pending { background: #fef3c7; color: #92400e; }
  .date { font-size: 12px; color: #94a3b8; }
  .record-body { font-size: 14px; color: #334155; white-space: pre-wrap; }
  .result-box { margin-top: 12px; padding: 12px 16px; background: #f8fafc; border-radius: 8px; border-left: 3px solid #cbd5e1; }
  .result-box .result-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; margin-bottom: 4px; }
  .result-box p { font-size: 13px; color: #475569; }
  .footer { text-align: center; padding-top: 32px; border-top: 1px solid #e2e8f0; margin-top: 48px; }
  .footer p { font-size: 12px; color: #94a3b8; }
  @media print { body { padding: 20px; background: white; } .stat-card, .record { box-shadow: none; border: 1px solid #e2e8f0; } }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>Talepler ve Faaliyetler Raporu</h1>
    <p>Rapor Tarihi: ${fmtDate(new Date().toISOString())}</p>
  </div>

  <div class="stats">
    <div class="stat-card total"><div class="number">${records.length}</div><div class="label">Toplam Kayit</div></div>
    <div class="stat-card activity"><div class="number">${activities.length}</div><div class="label">Faaliyet</div></div>
    <div class="stat-card total"><div class="number">${requests.length}</div><div class="label">Talep</div></div>
    <div class="stat-card positive"><div class="number">${positiveCount}</div><div class="label">Olumlu</div></div>
    <div class="stat-card negative"><div class="number">${negativeCount}</div><div class="label">Olumsuz</div></div>
    <div class="stat-card pending"><div class="number">${pendingCount}</div><div class="label">Beklemede</div></div>
  </div>

  ${requests.length > 0 ? `<div class="section">
    <div class="section-title"><span class="icon request">&#128203;</span> Talepler (${requests.length})</div>
    ${requests.map(r => `<div class="record">
      <div class="record-header">
        <span class="badge ${r.result_status === 'positive' ? 'positive' : r.result_status === 'negative' ? 'negative' : 'pending'}">${r.result_status === 'positive' ? 'Olumlu' : r.result_status === 'negative' ? 'Olumsuz' : 'Beklemede'}</span>
        <span class="date">${r.event_date ? fmtDate(r.event_date) : fmtDate(r.created_at)}</span>
      </div>
      <div class="record-body">${r.description.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
      ${r.result_description ? `<div class="result-box"><div class="result-label">Sonuc Aciklamasi</div><p>${r.result_description.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p></div>` : ''}
    </div>`).join('\n')}
  </div>` : ''}

  ${activities.length > 0 ? `<div class="section">
    <div class="section-title"><span class="icon activity">&#128221;</span> Faaliyetler (${activities.length})</div>
    ${activities.map(r => `<div class="record">
      <div class="record-header">
        <span class="date">${r.event_date ? fmtDate(r.event_date) : fmtDate(r.created_at)}</span>
      </div>
      <div class="record-body">${r.description.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
    </div>`).join('\n')}
  </div>` : ''}

  <div class="footer">
    <p>Bu rapor otomatik olarak olusturulmustur.</p>
  </div>
</div>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `talepler-faaliyetler-${new Date().toISOString().split('T')[0]}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-400">
        <XCircle size={48} className="mb-4" />
        <p className="text-lg font-semibold">Bu sayfaya erişim yetkiniz bulunmamaktadır.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Talepler / Faaliyetler</h2>
          <p className="text-sm text-slate-500 mt-1">Dernek talep ve faaliyetlerini buradan yonetebilirsiniz.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={exportAsHtml}
            disabled={records.length === 0}
            className="flex items-center gap-2 bg-slate-700 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-xl font-semibold text-sm shadow-md hover:shadow-lg transition-all"
          >
            <Download size={18} />
            HTML Olarak Indir
          </button>
          <button
            onClick={openNew}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-semibold text-sm shadow-md hover:shadow-lg transition-all"
          >
            <Plus size={18} />
            Yeni Kayıt
          </button>
        </div>
      </div>

      {/* Filter & Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-slate-400" />
          <div className="flex bg-white border border-slate-200 rounded-xl overflow-hidden">
            {(['all', 'activity', 'request'] as const).map(t => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`px-4 py-2 text-sm font-semibold transition-colors ${
                  filterType === t
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                {t === 'all' ? 'Tumu' : t === 'activity' ? 'Faaliyetler' : 'Talepler'}
              </button>
            ))}
          </div>
        </div>
        <div className="relative flex-1 w-full sm:max-w-xs">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Kayıtlarda ara..."
            className="w-full pl-10 pr-9 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <span className="text-xs text-slate-400 font-medium whitespace-nowrap">
          {filtered.length} kayıt
        </span>
      </div>

      {/* List */}
      {loading ? (
        <div className="py-16 text-center text-slate-400 animate-pulse">Yukleniyor...</div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center">
          <ClipboardList size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-400 font-medium">Henuz kayıt bulunmuyor.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(rec => (
            <div
              key={rec.id}
              className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
            >
              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={`mt-0.5 p-2 rounded-xl flex-shrink-0 ${
                      rec.type === 'activity'
                        ? 'bg-teal-50 text-teal-600'
                        : 'bg-amber-50 text-amber-600'
                    }`}>
                      {rec.type === 'activity' ? <FileText size={18} /> : <ClipboardList size={18} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                          rec.type === 'activity'
                            ? 'bg-teal-100 text-teal-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}>
                          {rec.type === 'activity' ? 'Faaliyet' : 'Talep'}
                        </span>
                        {rec.type === 'request' && rec.result_status && (
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                            rec.result_status === 'positive'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-rose-100 text-rose-700'
                          }`}>
                            {rec.result_status === 'positive' ? (
                              <><CheckCircle2 size={12} /> Olumlu</>
                            ) : (
                              <><XCircle size={12} /> Olumsuz</>
                            )}
                          </span>
                        )}
                        <span className="flex items-center gap-1 text-[11px] text-slate-400">
                          <Calendar size={11} />
                          {rec.event_date ? formatDate(rec.event_date) : formatDate(rec.created_at)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{rec.description}</p>
                      {rec.type === 'request' && rec.result_description && (
                        <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Sonuc Aciklamasi</p>
                          <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{rec.result_description}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => openEdit(rec)}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Pencil size={16} />
                    </button>
                    {deleteConfirm === rec.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDelete(rec.id)}
                          className="px-2.5 py-1.5 text-xs font-bold text-white bg-rose-500 hover:bg-rose-600 rounded-lg transition-colors"
                        >
                          Evet
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="px-2.5 py-1.5 text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                        >
                          Iptal
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(rec.id)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800">
                {editingId ? 'Kaydi Duzenle' : 'Yeni Kayıt Olustur'}
              </h3>
              <button onClick={closeForm} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Type Toggle */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tur</label>
                <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, type: 'activity', result_status: null, result_description: '' })}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                      form.type === 'activity'
                        ? 'bg-white text-teal-700 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <FileText size={16} />
                    Faaliyet
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, type: 'request' })}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                      form.type === 'request'
                        ? 'bg-white text-amber-700 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <ClipboardList size={16} />
                    Talep
                  </button>
                </div>
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Tarih</label>
                <div className="relative">
                  <Calendar size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="date"
                    value={form.event_date}
                    onChange={e => setForm({ ...form, event_date: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  {form.type === 'activity' ? 'Faaliyet Aciklamasi' : 'Talep Icerigi'}
                </label>
                <textarea
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  rows={4}
                  placeholder={form.type === 'activity' ? 'Faaliyet detaylarını yazınız...' : 'Talep detaylarını yazınız...'}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none transition-all"
                />
              </div>

              {/* Request-specific fields */}
              {form.type === 'request' && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Sonuc</label>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, result_status: 'positive' })}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                          form.result_status === 'positive'
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                            : 'border-slate-200 text-slate-400 hover:border-slate-300'
                        }`}
                      >
                        <CheckCircle2 size={18} />
                        Olumlu
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, result_status: 'negative' })}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                          form.result_status === 'negative'
                            ? 'border-rose-500 bg-rose-50 text-rose-700'
                            : 'border-slate-200 text-slate-400 hover:border-slate-300'
                        }`}
                      >
                        <XCircle size={18} />
                        Olumsuz
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Sonuc Aciklamasi</label>
                    <textarea
                      value={form.result_description}
                      onChange={e => setForm({ ...form, result_description: e.target.value })}
                      rows={3}
                      placeholder="Sonuca iliskin acıklama giriniz..."
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none transition-all"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-100">
              <button
                onClick={closeForm}
                className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Vazgec
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.description.trim()}
                className="px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-md hover:shadow-lg transition-all"
              >
                {saving ? 'Kaydediliyor...' : editingId ? 'Guncelle' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
