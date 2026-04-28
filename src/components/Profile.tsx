import { useState, useEffect } from 'react';
import { User, Lock, Save, Wallet } from 'lucide-react';
// Hata Düzeltildi: Sadece 'supabase' istemcisi içe aktarılıyor.
import { supabase } from '../lib/supabase';

interface Member {
  id: string;
  full_name: string;
  tc_id: string;
  birth_date: string;
  phone?: string;
  email?: string;
  registration_date: string;
}

interface ProfileProps {
  member: Member;
  onUpdate: () => void;
}

interface FinancialSummary {
  totalDues: number;
  paidDues: number;
  remainingDues: number;
  totalDonations: number;
  totalAid: number;
}

export default function Profile({ member, onUpdate }: ProfileProps) {
  const [activeTab, setActiveTab] = useState<'info' | 'financials' | 'password'>('info');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [financials, setFinancials] = useState<FinancialSummary>({
    totalDues: 0,
    paidDues: 0,
    remainingDues: 0,
    totalDonations: 0,
    totalAid: 0
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  useEffect(() => {
    // Sekme değiştiğinde hata ve başarı mesajlarını temizle
    setError('');
    setSuccess('');
    
    if (activeTab === 'financials') {
      fetchFinancials();
    }
  }, [activeTab, member.id]);

  const fetchFinancials = async () => {
    setLoading(true);
    setError('');
    
    try {
      // DÜZELTME 1: supabase istemcisi kullanılıyor
      const { data: transactions, error: fetchError } = await supabase 
        .from('transactions')
        // Supabase join syntax'i: categories tablosundan sadece 'name' sütununu getir
        .select('amount, type, category_id, transaction_categories(name)')
        .eq('member_id', member.id);
        
      if (fetchError) {
        console.error('Supabase İşlem Hatası:', fetchError);
        setError('Finansal veriler yüklenirken bir veritabanı hatası oluştu.');
        return;
      }
      
      if (!transactions || transactions.length === 0) {
        setFinancials({ totalDues: 0, paidDues: 0, remainingDues: 0, totalDonations: 0, totalAid: 0 });
        return;
      }
      
      let totalDues = 0;
      let paidDues = 0;
      let totalDonations = 0;
      let totalAid = 0;

      transactions.forEach((t: any) => {
        // Not: transaction_categories(name) yerine type kullanın
        const categoryName = t.transaction_categories?.name?.toLowerCase().trim() || '';

        // DuesManagement'ta artık `type` alanını kullanıyoruz.
        // Aidatlar (DuesManagement.tsx'e göre)
        // Aidat tahakkuku Dues tablosu üzerinden takip ediliyor,
        // Ancak bu fonksiyonda toplu bir özet sağlamak için sadece transactions tablosuna bakıyoruz.
        // Bu yapı, DuesManagement mantığıyla tam uyumlu olmayabilir, ancak transactions tablosundaki veriye dayanır.
        
        // Gelir işlemleri için
        if (t.type === 'income') {
          // Aidat kategorisi kontrolü
          if (categoryName.includes('aidat')) {
            paidDues += t.amount;
          } 
          // Bağış kategorisi kontrolü
          else if (categoryName.includes('bağış')) {
            totalDonations += t.amount;
          }
        } 
        // Gider işlemleri için
        else if (t.type === 'expense') {
          // Yardım kategorisi kontrolü (Aldığı yardım)
          if (categoryName.includes('yardım') || categoryName.includes('destek')) {
            totalAid += t.amount;
          }
        }
      });
      
      // Tahakkuk ve borç bilgisini Dues tablosundan çekmek daha doğru olur.
      const { data: duesData } = await supabase
          .from('dues')
          .select('amount, status')
          .eq('member_id', member.id);
          
      let totalAccrual = 0;
      let remainingDues = 0;
      
      duesData?.forEach(d => {
        totalAccrual += Number(d.amount);
        if (d.status === 'pending' || d.status === 'overdue') {
          remainingDues += Number(d.amount);
        }
      });

      setFinancials({
        totalDues: totalAccrual,
        paidDues: totalAccrual - remainingDues, // Ödenen = Toplam - Kalan
        remainingDues: remainingDues,
        totalDonations,
        totalAid
      });
    } catch (err) {
      console.error('Finansal veriler yüklenirken beklenmedik hata:', err);
      setError('Veriler yüklenirken beklenmedik bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };


  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('Yeni şifreler eşleşmiyor');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setError('Şifre en az 6 karakter olmalıdır');
      return;
    }

    setLoading(true);

    try {
      const bcrypt = await import('bcryptjs');

      // DÜZELTME 2: supabase istemcisi kullanılıyor ve password_hash çekiliyor
      const { data: memberData } = await supabase
        .from('members')
        .select('password_hash')
        .eq('id', member.id)
        .maybeSingle();

      if (!memberData?.password_hash) {
        setError('Mevcut şifre bulunamadı');
        setLoading(false);
        return;
      }

      const isValid = await bcrypt.compare(passwordData.currentPassword, memberData.password_hash);
      if (!isValid) {
        setError('Mevcut şifre yanlış');
        setLoading(false);
        return;
      }

      const hashedPassword = await bcrypt.hash(passwordData.newPassword, 10);

      // DÜZELTME 3: supabase istemcisi kullanılıyor
      const { error: updateError } = await supabase
        .from('members')
        .update({ password_hash: hashedPassword })
        .eq('id', member.id);

      if (updateError) {
        setError('Şifre güncellenirken hata oluştu');
      } else {
        setSuccess('Şifre başarıyla güncellendi');
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      }
    } catch (err) {
      setError('Bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };
  
  // ARAYÜZ KISMI (Değişiklik yok)
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-800">Profilim</h2>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          {success}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab('info')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 font-medium transition-colors ${
              activeTab === 'info' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <User className="w-4 h-4" />
            Kişisel Bilgiler
          </button>
          <button
            onClick={() => setActiveTab('financials')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 font-medium transition-colors ${
              activeTab === 'financials' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Wallet className="w-4 h-4" />
            Finansal Bilgiler
          </button>
          <button
            onClick={() => setActiveTab('password')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 font-medium transition-colors ${
              activeTab === 'password' ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Lock className="w-4 h-4" />
            Şifre Değiştir
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'info' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Ad Soyad</label>
                  <input
                    type="text"
                    value={member.full_name}
                    disabled
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">TC Kimlik No</label>
                  <input
                    type="text"
                    value={member.tc_id || 'Gizli'}
                    disabled
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Doğum Tarihi</label>
                  <input
                    type="text"
                    value={new Date(member.birth_date).toLocaleDateString('tr-TR')}
                    disabled
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Telefon</label>
                  <input
                    type="text"
                    value={member.phone || '-'}
                    disabled
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">E-posta</label>
                  <input
                    type="text"
                    value={member.email || '-'}
                    disabled
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Üyelik Tarihi</label>
                  <input
                    type="text"
                    value={new Date(member.registration_date).toLocaleDateString('tr-TR')}
                    disabled
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-600"
                  />
                </div>
              </div>
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-700">
                  Bilgilerinizi güncellemek için lütfen yönetici ile iletişime geçin.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'financials' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Finansal Özet</h3>
              {loading ? (
                <div className="text-center py-8 text-slate-600">Yükleniyor...</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-600 font-medium mb-1">Toplam Aidat Tahakkuku</p>
                    <p className="text-2xl font-bold text-blue-900">
                      {financials.totalDues.toLocaleString('tr-TR')} ₺
                    </p>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-sm text-green-600 font-medium mb-1">Ödenen Aidatlar</p>
                    <p className="text-2xl font-bold text-green-900">
                      {financials.paidDues.toLocaleString('tr-TR')} ₺
                    </p>
                  </div>
                  <div className={`border rounded-lg p-4 ${
                    financials.remainingDues > 0
                      ? 'bg-red-50 border-red-200'
                      : 'bg-slate-50 border-slate-200'
                  }`}>
                    <p className={`text-sm font-medium mb-1 ${
                      financials.remainingDues > 0 ? 'text-red-600' : 'text-slate-600'
                    }`}>
                      Kalan Aidat Borcu
                    </p>
                    <p className={`text-2xl font-bold ${
                      financials.remainingDues > 0 ? 'text-red-900' : 'text-slate-900'
                    }`}>
                      {financials.remainingDues.toLocaleString('tr-TR')} ₺
                    </p>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <p className="text-sm text-amber-600 font-medium mb-1">Toplam Bağışlar</p>
                    <p className="text-2xl font-bold text-amber-900">
                      {financials.totalDonations.toLocaleString('tr-TR')} ₺
                    </p>
                  </div>
                  <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
                    <p className="text-sm text-teal-600 font-medium mb-1">Aldığınız Yardımlar</p>
                    <p className="text-2xl font-bold text-teal-900">
                      {financials.totalAid.toLocaleString('tr-TR')} ₺
                    </p>
                  </div>
                </div>
              )}
              <div className="mt-4 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                <p className="text-sm text-slate-700">
                  Detaylı finansal hareketlerinizi görmek için "Finansal Bilgilerim" menüsünü kullanabilirsiniz.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'password' && (
            <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Mevcut Şifre</label>
                <input
                  type="password"
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Yeni Şifre</label>
                <input
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                  required
                  minLength={6}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Yeni Şifre (Tekrar)</label>
                <input
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
                  required
                  minLength={6}
                />
              </div>
              <button
                type="submit"
                className="flex items-center gap-2 px-6 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors"
              >
                <Save className="w-4 h-4" />
                Şifreyi Güncelle
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}