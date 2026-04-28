/*
  # Aidat Otomatik Mahsup Trigger

  1. Changes
    - Aidat kategorisinde gelir işlemi eklendiğinde otomatik mahsup fonksiyonu eklenir
    - En eski bekleyen tahakkukları otomatik olarak mahsup eder
    - Ödeme tutarı tahakkuk tutarından büyükse, kalan tutarla diğer tahakkukları mahsup eder

  2. Security
    - Fonksiyon SECURITY DEFINER olarak çalışır
    - Sadece transaction insert trigger tarafından çağrılır
*/

-- Otomatik mahsup fonksiyonu
CREATE OR REPLACE FUNCTION auto_offset_dues_on_payment()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_aidat_category_id uuid;
  v_pending_due record;
  v_remaining_amount numeric;
BEGIN
  -- Sadece gelir işlemleri için çalış
  IF NEW.type != 'income' THEN
    RETURN NEW;
  END IF;

  -- Aidat kategorisi ID'sini bul
  SELECT id INTO v_aidat_category_id
  FROM transaction_categories
  WHERE name = 'Aidat' AND type = 'income'
  LIMIT 1;

  -- Eğer bu bir aidat ödemesi değilse, çık
  IF NEW.category_id != v_aidat_category_id THEN
    RETURN NEW;
  END IF;

  -- Üye ID'si yoksa çık
  IF NEW.member_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Kalan ödeme tutarı
  v_remaining_amount := NEW.amount;

  -- En eski bekleyen tahakkukları bul ve mahsup et
  FOR v_pending_due IN
    SELECT id, amount
    FROM dues
    WHERE member_id = NEW.member_id
      AND status = 'pending'
    ORDER BY due_date ASC, created_at ASC
  LOOP
    -- Eğer kalan tutar 0 veya daha azsa, dur
    IF v_remaining_amount <= 0 THEN
      EXIT;
    END IF;

    -- Eğer kalan tutar tahakkuk tutarından büyük veya eşitse, tam mahsup et
    IF v_remaining_amount >= v_pending_due.amount THEN
      UPDATE dues
      SET status = 'paid',
          paid_date = CURRENT_DATE,
          updated_at = now()
      WHERE id = v_pending_due.id;

      v_remaining_amount := v_remaining_amount - v_pending_due.amount;
    ELSE
      -- Kısmi ödeme durumunda döngüden çık
      -- Not: Şu an kısmi ödeme desteği yok, bu durum için gelecekte özellik eklenebilir
      EXIT;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Mevcut trigger'ı kaldır (varsa)
DROP TRIGGER IF EXISTS trigger_auto_offset_dues ON transactions;

-- Yeni trigger ekle
CREATE TRIGGER trigger_auto_offset_dues
  AFTER INSERT ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION auto_offset_dues_on_payment();