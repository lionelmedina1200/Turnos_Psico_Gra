-- =====================================================
--  SUPABASE SETUP — Ejecutá esto en el SQL Editor
--  de tu proyecto de Supabase
-- =====================================================

-- 1. TABLA DE PACIENTES
create table if not exists pacientes (
  id         uuid default gen_random_uuid() primary key,
  user_id    uuid references auth.users(id) on delete cascade,
  nombre     text not null,
  tel        text,
  email      text,
  created_at timestamptz default now()
);

-- 2. TABLA DE TURNOS
create table if not exists turnos (
  id               uuid default gen_random_uuid() primary key,
  paciente_id      uuid references auth.users(id) on delete cascade,
  paciente_nombre  text,
  paciente_tel     text,
  fecha            date not null,
  hora             text not null,
  motivo           text,
  estado           text default 'pendiente_pago'
                   check (estado in ('pendiente_pago','pago_enviado','confirmado','cancelado')),
  comprobante_url  text,
  created_at       timestamptz default now()
);

-- 3. TABLA DE MENSAJES
create table if not exists mensajes (
  id          uuid default gen_random_uuid() primary key,
  paciente_id uuid references auth.users(id) on delete cascade,
  remitente   text check (remitente in ('paciente','psicologa')),
  contenido   text not null,
  leido       boolean default false,
  created_at  timestamptz default now()
);

-- 4. TABLA DE CONFIG (una sola fila)
create table if not exists config (
  id              int primary key default 1,
  cbu             text,
  alias           text,
  titular         text,
  wsp_psicologa   text,
  horarios        text[] default array['08:00','09:00','10:00','11:00','12:00','14:00','15:00','16:00','17:00']
);

-- Insertar fila de config vacía
insert into config (id) values (1) on conflict (id) do nothing;

-- =====================================================
--  ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Habilitar RLS en todas las tablas
alter table pacientes enable row level security;
alter table turnos enable row level security;
alter table mensajes enable row level security;
alter table config enable row level security;

-- PACIENTES: cada usuario ve solo su propio perfil
create policy "pacientes_own" on pacientes
  for all using (auth.uid() = user_id);

-- TURNOS: paciente ve los suyos; psicóloga ve todos
-- Reemplazá 'psicologa@email.com' con tu email real
create policy "turnos_paciente" on turnos
  for all using (
    auth.uid() = paciente_id
    or
    auth.email() = 'psicologa@email.com'
  );

-- MENSAJES: paciente ve los suyos; psicóloga ve todos
create policy "mensajes_paciente" on mensajes
  for all using (
    auth.uid() = paciente_id
    or
    auth.email() = 'psicologa@email.com'
  );

-- CONFIG: lectura pública (para mostrar CBU a pacientes), escritura solo psicóloga
create policy "config_read" on config
  for select using (true);

create policy "config_write" on config
  for all using (auth.email() = 'psicologa@email.com');

-- =====================================================
--  STORAGE BUCKET PARA COMPROBANTES
-- =====================================================
-- Ejecutá esto también (o hacelo manualmente en Storage > New Bucket):

insert into storage.buckets (id, name, public)
  values ('comprobantes', 'comprobantes', true)
  on conflict (id) do nothing;

-- Política: cualquier usuario autenticado puede subir, psicóloga puede ver todo
create policy "comprobantes_upload" on storage.objects
  for insert with check (bucket_id = 'comprobantes' and auth.role() = 'authenticated');

create policy "comprobantes_read" on storage.objects
  for select using (bucket_id = 'comprobantes');

-- =====================================================
--  REALTIME (activar en Supabase Dashboard)
-- =====================================================
-- En Supabase Dashboard → Database → Replication
-- Activar "supabase_realtime" para las tablas:
--   turnos, mensajes
-- =====================================================
