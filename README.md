# Sistema de Turnos — Consultorio de Psicología

App completa para gestión de turnos con:
- Registro/login de pacientes (email o Google)
- Panel de pacientes: ver turnos, reservar, subir comprobante, mensajes
- Panel de psicóloga: calendario, gestión de solicitudes, chat con pacientes
- WhatsApp automático al confirmar turno
- Supabase como backend

---

## PASO 1 — Configurar Supabase

1. Entrá a [supabase.com](https://supabase.com) → tu proyecto
2. Andá a **SQL Editor**
3. Copiá y ejecutá todo el contenido de `supabase-setup.sql`
4. En **Authentication → Providers**, habilitá **Google** si querés login con Google
5. Copiá tu **Project URL** y **anon public key** (Settings → API)

---

## PASO 2 — Configurar la app

Editá el archivo `js/config.js` y reemplazá:

```js
const SUPABASE_URL  = 'https://TU_PROYECTO.supabase.co';
const SUPABASE_ANON_KEY = 'TU_ANON_KEY';
const ADMIN_EMAIL   = 'tu-email-de-psicologa@gmail.com';
```

**Importante:** el `ADMIN_EMAIL` es el email con el que la psicóloga va a ingresar. Ese email también debe estar en las políticas RLS del SQL (buscar `psicologa@email.com` en el SQL y reemplazarlo por el tuyo).

---

## PASO 3 — Crear cuenta de la psicóloga

1. Andá a la app en el panel de Supabase → Authentication → Users
2. Creá un usuario con el email de la psicóloga
3. O registrate normalmente por la app en `admin.html`

---

## PASO 4 — Subir a Netlify

**Opción A (más simple):**
1. Entrá a [netlify.com](https://netlify.com)
2. Arrastrá toda esta carpeta al área de deploy
3. ¡Listo!

**Opción B (con GitHub):**
1. Subí la carpeta a un repo de GitHub
2. En Netlify → "Import from Git" → conectá el repo
3. Deploy automático en cada cambio

---

## PASO 5 — Configurar datos de pago y horarios

1. Ingresá al panel de psicóloga (`/admin.html`)
2. Andá a **Configuración**
3. Cargá tu CBU, Alias, nombre del titular
4. Cargá tu número de WhatsApp (con código de país sin +, ej: `5491165432100`)
5. Marcá los horarios que ofrecés
6. Guardá

---

## PASO 6 — Activar Realtime en Supabase

1. Supabase Dashboard → **Database → Replication**
2. Activar las tablas `turnos` y `mensajes` para realtime

---

## FLUJO DE UN TURNO

```
Paciente se registra
    ↓
Elige fecha y horario disponible
    ↓
Sube comprobante de pago ($40.000)
    ↓
Estado: "Comprobante enviado"
    ↓
Psicóloga ve el comprobante en su panel
    ↓
Psicóloga confirma el turno
    ↓
Estado: "Confirmado"
    ↓
Se abre WhatsApp para avisar al paciente (y a la psicóloga)
```

---

## ESTRUCTURA DE ARCHIVOS

```
turnos-psi/
├── index.html          → Landing + login/registro paciente
├── paciente.html       → Panel del paciente
├── admin.html          → Panel de la psicóloga
├── css/
│   └── main.css        → Todos los estilos
├── js/
│   ├── config.js       → ⚠️ EDITÁ ESTO con tus credenciales
│   ├── auth.js         → Login, registro, sesiones
│   ├── paciente.js     → Lógica del panel paciente
│   └── admin.js        → Lógica del panel psicóloga
├── supabase-setup.sql  → Script SQL para Supabase
└── netlify.toml        → Config de Netlify
```
