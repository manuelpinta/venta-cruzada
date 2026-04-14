-- Identificador de empleado (login sin email visible): se guarda en perfil tras iniciar sesión.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS employee_number text;

COMMENT ON COLUMN public.profiles.employee_number IS 'Número o código de empleado (ej. pinta1); debe coincidir con la parte local del email en auth.users.';

CREATE UNIQUE INDEX IF NOT EXISTS profiles_employee_number_key
  ON public.profiles (employee_number)
  WHERE employee_number IS NOT NULL AND trim(employee_number) <> '';
