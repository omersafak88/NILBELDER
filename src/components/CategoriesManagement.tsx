import { useState, useEffect } from 'react';
import { Tags, Plus, Edit2, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface CategoriesManagementProps {
  isAdmin: boolean;
}

interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  is_active: boolean;
}

export default function CategoriesManagement({ isAdmin }: CategoriesManagementProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [error, setError] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');

  const [formData, setFormData] = useState({
    name: '',
    type: 'income' as 'income' | 'expense'
  });

  useEffect(() => {
    loadCategories();
  }, [filterType]);

  const loadCategories = async () => {
    setLoading(true);
    let query = supabase
      .from('transaction_categories')
      .select('*')
      .order('type')
      .order('name');

    if (filterType !== 'all') {
      query = query.eq('type', filterType);
    }

    const { data, error } = await query;

    if (data) {
      setCategories(data);
    }
    if (error) {
      setError('Kategoriler yüklenirken hata oluştu');
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (editingCategory) {
      const { error } = await supabase
        .from('transaction_categories')
        .update({
          name: formData.name,
          type: formData.type
        })
        .eq('id', editingCategory.id);

      if (error) {
        setError('Kategori güncellenirken hata oluştu');
      } else {
        setShowAddForm(false);
        setEditingCategory(null);
        resetForm();
        loadCategories();
      }
    } else {
      const { error } = await supabase
        .from('transaction_categories')
        .insert([{
          name: formData.name,
          type: formData.type,
          is_active: true
        }]);

      if (error) {
        setError('Kategori eklenirken hata oluştu');
      } else {
        setShowAddForm(false);
        resetForm();
        loadCategories();
      }
    }
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      type: category.type
    });
    setShowAddForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu kategoriyi silmek istediğinizden emin misiniz?')) {
      return;
    }

    const { error } = await supabase
      .from('transaction_categories')
      .update({ is_active: false })
      .eq('id', id);

    if (error) {
      setError('Kategori silinirken hata oluştu');
    } else {
      loadCategories();
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'income'
    });
    setEditingCategory(null);
  };

  if (!isAdmin) {
    return (
      <div className="text-center py-12">
        <Tags className="w-16 h-16 text-slate-300 mx-auto mb-4" />
        <p className="text-slate-600">Bu sayfaya erişim yetkiniz bulunmamaktadır.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Tags className="w-8 h-8 text-slate-700" />
          <h2 className="text-2xl font-bold text-slate-800">Gelir/Gider Kategorileri</h2>
        </div>

        <button
          onClick={() => {
            resetForm();
            setShowAddForm(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Yeni Kategori
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {showAddForm && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-xl font-semibold mb-4">
            {editingCategory ? 'Kategori Düzenle' : 'Yeni Kategori Ekle'}
          </h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Kategori Adı *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tip *</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as 'income' | 'expense' })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                required
              >
                <option value="income">Gelir</option>
                <option value="expense">Gider</option>
              </select>
            </div>
            <div className="col-span-2 flex gap-3">
              <button
                type="submit"
                className="px-6 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors"
              >
                {editingCategory ? 'Güncelle' : 'Ekle'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  resetForm();
                }}
                className="px-6 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors"
              >
                İptal
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex gap-2 mb-4">
          {(['all', 'income', 'expense'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilterType(f)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filterType === f
                  ? 'bg-slate-800 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {f === 'all' ? 'Tümü' : f === 'income' ? 'Gelir' : 'Gider'}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-4 font-semibold text-slate-700">Kategori Adı</th>
                <th className="text-left py-3 px-4 font-semibold text-slate-700">Tip</th>
                <th className="text-left py-3 px-4 font-semibold text-slate-700">Durum</th>
                <th className="text-center py-3 px-4 font-semibold text-slate-700">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-slate-500">
                    Yükleniyor...
                  </td>
                </tr>
              ) : categories.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-slate-500">
                    Kategori bulunamadı
                  </td>
                </tr>
              ) : (
                categories.map((category) => (
                  <tr key={category.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 px-4 font-medium">{category.name}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        category.type === 'income'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {category.type === 'income' ? 'Gelir' : 'Gider'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        category.is_active
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {category.is_active ? 'Aktif' : 'Pasif'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleEdit(category)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Düzenle"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {category.is_active && (
                          <button
                            onClick={() => handleDelete(category.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Sil"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
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
