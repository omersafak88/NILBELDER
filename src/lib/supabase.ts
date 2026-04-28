// project/src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase çevre değişkenleri eksik. Lütfen .env dosyasını kontrol edin.');
}

/**
 * Supabase istemcisini "Secret Key" başlığı ile oluşturur.
 * Bu başlık, SQL tarafındaki RLS politikaları tarafından kontrol edilerek
 * 401 hatalarının aşılmasını sağlar.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    headers: {
      'x-app-secret': 'Bursa2016'
    }
  }
});

/**
 * Üye Tablosu Veri Yapısı
 */
export interface Member {
  id: string;
  full_name: string;
  username: string;       // Giriş için kullanılan kullanıcı adı
  password_hash: string;  // Bcrypt ile hashlenmiş şifre
  tc_id: string;
  birth_date: string;
  phone?: string;
  email?: string;
  is_active: boolean;
  registration_date: string;
  created_at: string;
  updated_at: string;
}

export interface Due {
  id: string;
  member_id: string;
  amount: number;
  period_year: number;
  period_month: number;
  due_date: string;
  paid_date?: string;
  status: 'pending' | 'paid' | 'overdue';
  notes?: string;
  is_bulk_accrued?: boolean;
  accrual_date?: string;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  type: 'income' | 'expense';
  category_id: string;
  amount: number;
  description: string;
  transaction_date: string;
  member_id?: string;
  due_id?: string;
  receipt_number?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface IncomeType {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  image_url?: string;
  is_active: boolean;
  is_pinned?: boolean;
  pinned_at?: string;
  pinned_by?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface AdminUser {
  id: string;
  member_id: string;
  role: 'admin' | 'treasurer' | 'secretary';
  created_at: string;
}

/**
 * Uygulama genelinde oturum bilgilerini temsil eden tip.
 */
export interface AuthSession {
  member: Member;
  isAdmin: boolean;
  adminRole?: 'admin' | 'treasurer' | 'secretary';
}

// project/src/lib/supabase.ts

export const fetchAllFromTable = async (tableName: string, query: string = '*') => {
  let allData: any[] = [];
  let from = 0;
  const step = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from(tableName)
      .select(query)
      .range(from, from + step - 1);

    if (error) break;
    if (!data || data.length === 0) {
      hasMore = false;
    } else {
      allData = [...allData, ...data];
      from += step;
      if (data.length < step) hasMore = false;
    }
  }
  return allData;
};