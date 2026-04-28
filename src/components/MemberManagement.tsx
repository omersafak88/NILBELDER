// project/src/components/MemberManagement.tsx
import React, { useState, useEffect } from 'react';
import { Users, Plus, Edit2, Trash2, CheckCircle, XCircle, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Member } from '../lib/supabase';

interface MemberManagementProps {
  isAdmin: boolean;
}

export default function MemberManagement({ isAdmin }: MemberManagementProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    full_name: '',
    tc_id: '',
    birth_date: '',
    phone: '',
    email: '',
    is_active: true
  });

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('members')
      .select('*')
      .order('full_name');

    if (data) setMembers(data);
    if (error) setError('Üyeler yüklenirken bir hata oluştu.');
    setLoading(false);
  };

  const handleEdit = (member: Member) => {
    setEditingMember(member);
    setFormData({
      full_name: member.full_name,
      tc_id: member.tc_id || '', // NULL ise boş string yapıyoruz (Hata önleyici)
      birth_date: member.birth_date,
      phone: member.phone || '',
      email: member.email || '',
      is_active: member.is_active
    });
    setShowAddForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Kayıt öncesi veri hazırlığı
    const dataToSave = {
      full_name: formData.full_name,
      // Eğer TC No boşsa veritabanına NULL olarak gönderiyoruz
      tc_id: formData.tc_id.trim() === '' ? null : formData.tc_id,
      birth_date: formData.birth_date,
      phone: formData.phone.trim() === '' ? null : formData.phone,
      email: formData.email.trim() === '' ? null : formData.email,
      is_active: formData.is_active,
      updated_at: new Date().toISOString()
    };

    const { error: saveError } = editingMember
      ? await supabase.from('members').update(dataToSave).eq('id', editingMember.id)
      : await supabase.from('members').insert([dataToSave]);

    if (saveError) {
      setError('Kayıt sırasında hata: ' + saveError.message);
    } else {
      setShowAddForm(false);
      resetForm();
      loadMembers();
    }
  };

  const resetForm = () => {
    setFormData({ full_name: '', tc_id: '', birth_date: '', phone: '', email: '', is_active: true });
    setEditingMember(null);
  };

  const filteredMembers = members.filter(m =>
    m.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.phone?.includes(searchTerm)
  );

  if (!isAdmin) {
    return <div className="p-8 text-center text-slate-500">Bu sayfayı görüntüleme yetkiniz yok.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Users className="w-8 h-8 text-slate-700" />
          <h2 className="text-2xl font-bold text-slate-800">Üye Yönetimi</h2>
        </div>
        <button
          onClick={() => { resetForm(); setShowAddForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={20} /> Yeni Üye Ekle
        </button>
      </div>

      {showAddForm && (
        <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200 animate-in slide-in-from-top duration-300">
          <h3 className="text-lg font-bold mb-4">{editingMember ? 'Üye Düzenle' : 'Yeni Üye'}</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Ad Soyad *</label>
              <input type="text" required className="w-full p-2.5 border rounded-lg" value={formData.full_name} onChange={e => setFormData({ ...formData, full_name: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">T.C. No (Opsiyonel)</label>
              <input type="text" maxLength={11} className="w-full p-2.5 border rounded-lg" value={formData.tc_id} onChange={e => setFormData({ ...formData, tc_id: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Doğum Tarihi *</label>
              <input type="date" required className="w-full p-2.5 border rounded-lg" value={formData.birth_date} onChange={e => setFormData({ ...formData, birth_date: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Telefon</label>
              <input type="text" className="w-full p-2.5 border rounded-lg" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">E-posta</label>
              <input type="email" className="w-full p-2.5 border rounded-lg" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={formData.is_active} onChange={e => setFormData({ ...formData, is_active: e.target.checked })} className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-slate-700">Hesap Aktif</span>
              </label>
            </div>
            <div className="lg:col-span-3 flex justify-end gap-3 mt-2">
              <button type="button" onClick={() => setShowAddForm(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">İptal</button>
              <button type="submit" className="px-6 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700">Kaydet</button>
            </div>
          </form>
          {error && <p className="mt-4 text-sm text-red-600 font-medium">{error}</p>}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Üye adı veya telefon ile ara..."
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Üye Bilgileri</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase">Durum</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase text-center">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={3} className="px-6 py-12 text-center text-slate-400">Yükleniyor...</td></tr>
              ) : filteredMembers.length === 0 ? (
                <tr><td colSpan={3} className="px-6 py-12 text-center text-slate-400">Üye bulunamadı.</td></tr>
              ) : (
                filteredMembers.map(member => (
                  <tr key={member.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-800">{member.full_name}</div>
                      <div className="text-xs text-slate-500 flex flex-col">
                        <span>{member.phone || 'Telefon yok'}</span>
                        <span>{member.email || 'E-posta yok'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {member.is_active ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                          <CheckCircle size={12} /> Aktif
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                          <XCircle size={12} /> Pasif
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => handleEdit(member)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                          <Edit2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}