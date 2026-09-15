/*
  # Talep kayitlarina "Katki saglayan" ve "Katki saglanan" bilgileri eklenmesi

  1. Degisen Tablo
    - `requests_activities`
      - `contributor_member_id` (uuid, nullable) - Katki saglayan kisi eger dernek uyesi ise ilgili uye kaydina baglanti
      - `contributor_name` (text, nullable) - Katki saglayan kisinin adi (uye olmayabilir, serbest metin)
      - `beneficiary_member_id` (uuid, nullable) - Katki saglanan kisi eger dernek uyesi ise ilgili uye kaydina baglanti
      - `beneficiary_name` (text, nullable) - Katki saglanan kisinin adi (uye olmayabilir, serbest metin)

  2. Guvenlik
    - Tablo uzerindeki mevcut RLS politikalari yeni sutunlari da otomatik kapsar; yeni politika gerekmez.

  3. Notlar
    1. Uye silinirse baglanti NULL yapilir (ON DELETE SET NULL), isim metni korunur.
    2. Raporlamayi hizlandirmak icin katki saglayan/saglanan uye kimlik sutunlarina indeks eklenir.
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'requests_activities' AND column_name = 'contributor_member_id') THEN
    ALTER TABLE requests_activities ADD COLUMN contributor_member_id uuid REFERENCES members(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'requests_activities' AND column_name = 'contributor_name') THEN
    ALTER TABLE requests_activities ADD COLUMN contributor_name text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'requests_activities' AND column_name = 'beneficiary_member_id') THEN
    ALTER TABLE requests_activities ADD COLUMN beneficiary_member_id uuid REFERENCES members(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'requests_activities' AND column_name = 'beneficiary_name') THEN
    ALTER TABLE requests_activities ADD COLUMN beneficiary_name text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ra_contributor_member ON requests_activities(contributor_member_id);
CREATE INDEX IF NOT EXISTS idx_ra_beneficiary_member ON requests_activities(beneficiary_member_id);
