BEGIN;
INSERT INTO institutions (id, name, district, type, active)
VALUES ('m-038', 'Республика ўрта тиббиёт ва фармацевтика ходимлари малакасини ошириш ва уларни ихтисослаштириш маркази Бухоро филиали', 'Buxoro shahar', 'Malaka oshirish markazi', 1)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  district = EXCLUDED.district,
  type = EXCLUDED.type,
  active = 1;

INSERT INTO users (email, name, role, commission, active, password_hash, institution_id)
VALUES (
  'muassasa-038',
  'Республика ўрта тиббиёт ва фармацевтика ходимлари малакасини ошириш ва уларни ихтисослаштириш маркази Бухоро филиали',
  'institution',
  '',
  1,
  'scrypt$7eebb029deaa7f3c6205906ada4af39f$3d45cfde1050033a812eb0a04f69e6bf6ecaa9ccbad809571f45220d7a122439',
  'm-038'
)
ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  role = 'institution',
  commission = '',
  active = 1,
  institution_id = 'm-038',
  updated_at = NOW();
COMMIT;
