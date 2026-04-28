import bcrypt from 'bcryptjs'; 
import { supabase } from './supabase';
import { sendBrevoEmail } from './email';

/**
 * Kullanıcı girişi - Hashlenmiş şifre doğrulaması ile
 */
export async function signIn(phone: string, password: string) {
  try {
    // 1. Adım: Kullanıcıyı çek (Burada password_hash sütununu da çekmelisiniz)
    const { data: member, error: memberError } = await supabase
      .from('members')
      .select('id, full_name, is_activated, role, phone, email, birth_date, tc_id, registration_date, password_hash') // password_hash eklendi
      .eq('phone', phone)
      .single();

    if (memberError || !member) throw new Error('Kullanıcı bulunamadı.');

    // 2. Adım: ŞİFRE DOĞRULAMA (Eksik olan kısım burasıydı)
    // Veritabanındaki hashlenmiş şifre ile girilen şifreyi karşılaştırıyoruz
    const isPasswordValid = await bcrypt.compare(password, member.password_hash);
    
    if (!isPasswordValid) {
      throw new Error('Hatalı şifre girdiniz.');
    }

    // 3. Adım: Aktivasyon kontrolü (Güvenlik için önemli)
    if (!member.is_activated) {
      throw new Error('Hesabınız henüz aktive edilmemiş.');
    }

    // 4. Adım: Oturum verisini hazırla
    const userData = {
      id: member.id,
      full_name: member.full_name,
      role: member.role || 'member',
      phone: member.phone,
      email: member.email,
      birth_date: member.birth_date,
      tc_id: member.tc_id,
      registration_date: member.registration_date
    };

    // Oturum bilgilerini sakla
    localStorage.setItem('association_user', JSON.stringify(userData));
    return { user: userData, error: null };

  } catch (error: any) {
    return { user: null, error: error.message };
  }
}

/**
 * Hesap Aktivasyonu
 */
/**
 * Hesap Aktivasyonu
 */
export async function activateAccount(tcId: string, phone: string, password: string) {
  try {
    // HATA BURADAYDI: 'tc_no' yerine 'tc_id' kullanılmalı
    const { data: member, error: findError } = await supabase
      .from('members')
      .select('id')
      .eq('tc_id', tcId) // Sütun adını tc_id olarak düzelttik
      .eq('phone', phone)
      .single();

    if (findError || !member) {
      throw new Error('Girdiğiniz bilgiler kayıtlarımızla eşleşmedi veya zaten aktif bir hesap olabilir.');
    }

    // RPC çağrısı: p_member_id ve p_password parametreleri veritabanındaki fonksiyonla eşleşmeli
    const { error: updateError } = await supabase.rpc('secure_activate_member', {
      p_member_id: member.id,
      p_password: password
    });
    
    if (updateError) {
      console.error("Aktivasyon Hatası:", updateError.message);
      throw new Error('Aktivasyon işlemi sırasında bir hata oluştu: ' + updateError.message);
    }

    return { success: true, error: null };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Şifre Sıfırlama
 */
export async function resetPassword(email: string) {
  try {
    // 1. Üyeyi e-posta ile kontrol et
    const { data: member, error: findError } = await supabase
      .from('members')
      .select('id, full_name, email')
      .eq('email', email.trim())
      .maybeSingle();

    if (findError || !member) throw new Error('Bu e-posta adresine ait bir kayıt bulunamadı.');

    // 2. Geçici şifre oluştur
    const tempPassword = Math.random().toString(36).slice(-6);

    // 3. Yeni e-posta odaklı RPC'yi çağır
    const { data: isSuccess, error: rpcError } = await supabase.rpc('rpc_reset_member_password', {
      p_email: email.trim(),
      p_new_password: tempPassword
    });

    if (rpcError || !isSuccess) throw new Error('Şifre güncellenemedi.');

    // 4. E-posta gönder (Brevo)
    await sendBrevoEmail(
      [{ email: member.email, name: member.full_name }],
      "Şifre Sıfırlama - NİL-BEL-DER",
      `
      <div style="font-family: sans-serif; padding: 20px;">
        <h2 style="color: #2563eb;">Sayın ${member.full_name},</h2>
        <p>Talebiniz üzerine geçici şifreniz oluşturulmuştur:</p>
        <div style="background: #f1f5f9; padding: 20px; border-radius: 12px; font-size: 24px; font-weight: bold; text-align: center; color: #2563eb; margin: 20px 0;">
          ${tempPassword}
        </div>
        <p>Lütfen bu şifre ile giriş yaptıktan sonra profilinizden şifrenizi güncelleyin.</p>
      </div>
      `
    );

    return { success: true, error: null };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Mevcut oturumu getir (App.tsx'in aradığı fonksiyon)
 */
export function getSession() {
  const userStr = localStorage.getItem('association_user');
  if (!userStr) return null;
  try {
    const user = JSON.parse(userStr);
    return { user, ...user }; 
  } catch (e) {
    return null;
  }
}

/**
 * Oturumu kapat
 */
export function signOut() {
  localStorage.removeItem('association_user');
  window.location.href = '/login';
}