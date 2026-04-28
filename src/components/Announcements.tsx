// project/src/components/Announcements.tsx
import { useState, useEffect } from 'react';
import { Bell, Plus, Trash2, Megaphone, Calendar, User, Pin } from 'lucide-react';
import { supabase, Announcement, Member } from '../lib/supabase';

interface AnnouncementsProps {
  isAdmin: boolean;
  currentMemberId?: string;
}

export default function Announcements({ isAdmin, currentMemberId }: AnnouncementsProps) {
  const [announcements, setAnnouncements] = useState<(Announcement & { creator?: Member })[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({ title: '', content: '' });

  useEffect(() => { 
    loadAnnouncements(); 
  }, []);

  const loadAnnouncements = async () => {
    setLoading(true);
    // Duyuruları getiren ve oluşturan üye bilgisini 'creator' olarak bağlayan sorgu
    const { data, error } = await supabase
      .from('announcements')
      .select('*, creator:members!announcements_created_by_fkey(full_name)')
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });

    if (data) {
      setAnnouncements(data.map(a => ({ ...a, creator: a.creator as unknown as Member })));
    }
    if (error) {
      setError('Duyurular yüklenirken bir hata oluştu: ' + error.message);
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu duyuruyu silmek istediğinizden emin misiniz?')) return;
    
    const { error } = await supabase.from('announcements').delete().eq('id', id);
    
    if (error) {
      setError('Silme işlemi başarısız: ' + error.message);
    } else {
      loadAnnouncements();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.title || !formData.content) {
      setError('Lütfen tüm alanları doldurun.');
      return;
    }

    const { error } = await supabase.from('announcements').insert([{
      title: formData.title,
      content: formData.content,
      created_by: currentMemberId,
      is_active: true
    }]);

    if (error) {
      setError('Duyuru yayınlanırken hata oluştu: ' + error.message);
    } else { 
      setShowAddForm(false); 
      setFormData({ title: '', content: '' }); 
      loadAnnouncements(); 
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Başlık ve Ekleme Butonu */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-slate-800 text-white rounded-2xl shadow-lg">
            <Bell size={24} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800">Duyurular</h2>
        </div>
        {isAdmin && (
          <button 
            onClick={() => setShowAddForm(!showAddForm)} 
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-md"
          >
            <Plus size={20} /> Yeni Duyuru
          </button>
        )}
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl text-sm font-medium">
          {error}
        </div>
      )}

      {/* Yeni Duyuru Formu (Sadece Admin) */}
      {showAddForm && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 animate-in slide-in-from-top duration-300">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Yeni Duyuru Oluştur</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input 
              type="text" 
              placeholder="Duyuru Başlığı" 
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-medium" 
              value={formData.title} 
              onChange={e => setFormData({...formData, title: e.target.value})} 
              required 
            />
            <textarea 
              placeholder="Duyuru metnini buraya yazın..." 
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none min-h-[150px]" 
              rows={4} 
              value={formData.content} 
              onChange={e => setFormData({...formData, content: e.target.value})} 
              required 
            />
            <div className="flex justify-end gap-3">
              <button 
                type="button" 
                onClick={() => setShowAddForm(false)} 
                className="px-6 py-2.5 text-slate-500 font-bold hover:bg-slate-50 rounded-xl"
              >
                İptal
              </button>
              <button 
                type="submit" 
                className="px-8 py-2.5 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-900 transition-all"
              >
                Yayınla
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Duyuru Listesi */}
      <div className="grid gap-6">
        {loading ? (
          <div className="text-center py-12 text-slate-400 font-medium">Duyurular yükleniyor...</div>
        ) : announcements.length === 0 ? (
          <div className="bg-white p-12 rounded-3xl border border-dashed border-slate-200 text-center">
            <Megaphone className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-500 font-medium">Henüz yayınlanmış bir duyuru bulunmuyor.</p>
          </div>
        ) : (
          announcements.map((a) => (
            <div key={a.id} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 hover:shadow-md transition-all group">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-black text-slate-800">{a.title}</h3>
                  {a.is_pinned && <Pin className="w-4 h-4 text-blue-500 fill-blue-500" />}
                </div>
                {isAdmin && (
                  <button 
                    onClick={() => handleDelete(a.id)} 
                    className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all" 
                    title="Sil"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
              
              <div className="flex flex-wrap gap-4 text-xs font-bold text-slate-400 mb-6 uppercase tracking-wider">
                <div className="flex items-center gap-1.5">
                  <User size={14} className="text-slate-300" />
                  {a.creator?.full_name || 'Yönetim'}
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar size={14} className="text-slate-300" />
                  {new Date(a.created_at).toLocaleDateString('tr-TR')}
                </div>
              </div>

              <div className="text-slate-600 leading-relaxed whitespace-pre-wrap border-l-4 border-slate-100 pl-4">
                {a.content}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}