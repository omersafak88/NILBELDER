import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Users, 
  HeartHandshake, 
  TrendingUp, 
  Calendar,
  RefreshCw,
  FileText
} from 'lucide-react';

interface DashboardStats {
  totalMembers: number;
  totalDonations: number;
  totalAids: number;
  uniqueAidedPeople: number; // Sorunlu olan kısım
}

const NewDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<'monthly' | 'yearly' | 'all'>('monthly');
  const [stats, setStats] = useState<DashboardStats>({
    totalMembers: 0,
    totalDonations: 0,
    totalAids: 0,
    uniqueAidedPeople: 0 // Başlangıç değeri 0 yapıldı
  });

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // 1. Toplam Üye Sayısı
      const { count: memberCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      // 2. Tarih Filtresi Oluşturma
      let dateFilter = new Date();
      if (range === 'monthly') {
        dateFilter.setMonth(dateFilter.getMonth() - 1);
      } else if (range === 'yearly') {
        dateFilter.setFullYear(dateFilter.getFullYear() - 1);
      }

      // 3. Yardımlar ve Bağışlar Sorgusu
      let aidQuery = supabase.from('yardim_kayitlari').select('id, miktar, tc_no', { count: 'exact' });
      let donationQuery = supabase.from('donations').select('amount', { count: 'exact' });

      // Eğer "Hepsi" seçili değilse tarih filtresi uygula
      if (range !== 'all') {
        aidQuery = aidQuery.gte('created_at', dateFilter.toISOString());
        donationQuery = donationQuery.gte('created_at', dateFilter.toISOString());
      }

      const { data: aids, count: aidCount } = await aidQuery;
      const { data: donations } = await donationQuery;

      // 4. Benzersiz Kişi Sayısını Hesaplama (Distinct Mantığı)
      // Sadece veriyi çekip length almak yerine veritabanındaki TC'leri tekilleştiriyoruz
      const uniquePeople = aids ? new Set(aids.map(item => item.tc_no)).size : 0;

      // 5. Toplam Tutar Hesaplamaları
      const totalDonationAmount = donations?.reduce((sum, item) => sum + (item.amount || 0), 0) || 0;

      setStats({
        totalMembers: memberCount || 0,
        totalDonations: totalDonationAmount,
        totalAids: aidCount || 0,
        uniqueAidedPeople: uniquePeople // Dinamik hesaplanan değer
      });

    } catch (error) {
      console.error('Veri çekme hatası:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [range]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Faaliyet Özeti</h2>
        <div className="flex gap-2">
          <select 
            value={range} 
            onChange={(e) => setRange(e.target.value as any)}
            className="bg-white border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="monthly">Son 1 Ay</option>
            <option value="yearly">Bu Yıl</option>
            <option value="all">Kuruluştan Bu Yana</option>
          </select>
          <button 
            onClick={fetchDashboardData}
            className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Üye Kartı */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
              <Users size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Toplam Üye</p>
              <h3 className="text-2xl font-bold">{stats.totalMembers}</h3>
            </div>
          </div>
        </div>

        {/* Yardım Yapılan Kişi Sayısı - DÜZELTİLEN KISIM */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-50 text-green-600 rounded-lg">
              <HeartHandshake size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Yardım Yapılan (Kişi)</p>
              <h3 className="text-2xl font-bold">{stats.uniqueAidedPeople}</h3>
            </div>
          </div>
        </div>

        {/* Toplam Yardım Sayısı */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
              <FileText size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Toplam Faaliyet</p>
              <h3 className="text-2xl font-bold">{stats.totalAids}</h3>
            </div>
          </div>
        </div>

        {/* Toplam Bağış Tutarı */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-orange-50 text-orange-600 rounded-lg">
              <TrendingUp size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Toplam Bağış</p>
              <h3 className="text-2xl font-bold">{stats.totalDonations.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}</h3>
            </div>
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}
    </div>
  );
};

export default NewDashboard;