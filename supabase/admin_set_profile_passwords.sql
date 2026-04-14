-- Ejecuta después de la migración 20260414110000_profiles_password_hash.sql
-- para crear o rotar passwords de usuarios en profiles.

-- Un usuario:
select public.set_profile_password('9000', 'Pass');

-- Varios usuarios:
select public.set_profile_password('9001', 'TuPasswordTemporal2');
select public.set_profile_password('9002', 'TuPasswordTemporal3');

-- Verificación (no muestra password, solo si quedó configurado):
select
  employee_number,
  country_code,
  role,
  (password_hash is not null and password_salt is not null) as password_configurada
from public.profiles
order by employee_number;

-- Prueba de login (debe regresar 1 fila):
select * from public.app_login_simple('9000', 'Pass');
