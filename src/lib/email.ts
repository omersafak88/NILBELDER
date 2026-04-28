// project/src/lib/email.ts

/**
 * Brevo (Sendinblue) API kullanarak e-posta gönderir.
 * * ÖNEMLİ: .env dosyanızda API anahtarı VITE_BREVO_API_KEY olarak tanımlanmalıdır.
 * Ayrıca sender (gönderici) e-posta adresinin Brevo panelinde doğrulanmış olması gerekir.
 */
export const sendBrevoEmail = async (
  to: { email: string; name: string }[], 
  subject: string, 
  htmlContent: string
) => {
  const apiKey = import.meta.env.VITE_BREVO_API_KEY;

  if (!apiKey) {
    console.error('Brevo API anahtarı bulunamadı (.env dosyasındaki VITE_BREVO_API_KEY değişkenini kontrol edin)');
    throw new Error('E-posta servisi yapılandırılmamış.');
  }

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        // Gönderen e-posta adresi güncellendi
        // ÖNEMLİ: "omersafak88@gmail.com" adresinin Brevo panelinde "Senders & IP" kısmında doğrulanmış olması şarttır.
        sender: { name: "NİL-BEL-DER", email: "omersafak88@gmail.com" },
        to: to,
        subject: subject,
        htmlContent: htmlContent,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Brevo API Hatası Detayı:', data);
      throw new Error(data.message || 'E-posta gönderimi sırasında bir hata oluştu.');
    }

    return data;
  } catch (error: any) {
    console.error('E-posta gönderim hatası:', error.message);
    throw error;
  }
};