BEGIN;

INSERT INTO institutions (id, name, district, type, active)
VALUES ('m-038', 'Республика ўрта тиббиёт ва фармацевтика ходимлари малакасини ошириш ва уларни ихтисослаштириш маркази Бухоро филиали', 'Buxoro shahar', 'Malaka oshirish markazi', 1)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  district = EXCLUDED.district,
  type = EXCLUDED.type,
  active = 1;

INSERT INTO users (email, name, role, commission, active, password_hash, institution_id)
VALUES ('admin', 'Super Admin', 'admin', '', 1, 'scrypt$d5ed91fd393b9035eec60eed391eeccc$3ab2dab316335db27e3e714d16c37f9cb60b683468b1fee97cb3d301a011f96c', '')
ON CONFLICT (email) DO UPDATE SET
  name = 'Super Admin',
  role = 'admin',
  commission = '',
  active = 1,
  password_hash = EXCLUDED.password_hash,
  institution_id = '',
  updated_at = NOW();

INSERT INTO users (email, name, role, commission, active, password_hash, institution_id)
VALUES ('muassasa-038', 'Республика ўрта тиббиёт ва фармацевтика ходимлари малакасини ошириш ва уларни ихтисослаштириш маркази Бухоро филиали', 'institution', '', 1, 'scrypt$76b1191a8aee86d02ff9553a3cd182a8$b3f518dd459a73eb1d7eb1fef584c47837de68e75d146c720ae3680add084d1d', 'm-038')
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  role = 'institution',
  commission = '',
  active = 1,
  password_hash = EXCLUDED.password_hash,
  institution_id = 'm-038',
  updated_at = NOW();

COMMIT;
