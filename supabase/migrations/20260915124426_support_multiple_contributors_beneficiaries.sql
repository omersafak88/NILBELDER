/*
  # Talep kayitlarinda birden fazla "Katki saglayan" ve "Katki saglanan" destegi

  1. Degisen Tablo
    - `requests_activities`
      - `contributors` (jsonb, default '[]') - Katki saglayan kisiler listesi. Her oge {"name": "...", "member_id": "uuid|null"} yapisindadir.
      - `beneficiaries` (jsonb, default '[]') - Katki saglanan kisiler listesi. Ayni yapida.

  2. Veri Aktarimi
    - Mevcut tekil `contributor_name`/`contributor_member_id` ve `beneficiary_name`/`beneficiary_member_id` degerleri yeni liste sutunlarina tasinir.
    - Eski sutunlar veri kaybini onlemek icin silinmez, sadece artik kullanilmaz.

  3. Guvenlik
    - Mevcut RLS politikalari yeni sutunlari da otomatik kapsar; yeni politika gerekmez.
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'requests_activities' AND column_name = 'contributors') THEN
    ALTER TABLE requests_activities ADD COLUMN contributors jsonb NOT NULL DEFAULT '[]'::jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'requests_activities' AND column_name = 'beneficiaries') THEN
    ALTER TABLE requests_activities ADD COLUMN beneficiaries jsonb NOT NULL DEFAULT '[]'::jsonb;
  END IF;
END $$;

UPDATE requests_activities
SET contributors = jsonb_build_array(jsonb_build_object('name', contributor_name, 'member_id', contributor_member_id))
WHERE contributor_name IS NOT NULL AND (contributors IS NULL OR contributors = '[]'::jsonb);

UPDATE requests_activities
SET beneficiaries = jsonb_build_array(jsonb_build_object('name', beneficiary_name, 'member_id', beneficiary_member_id))
WHERE beneficiary_name IS NOT NULL AND (beneficiaries IS NULL OR beneficiaries = '[]'::jsonb);
