# Thug Style Booking App

Aplicación de reservas para barbería con integración automática con Google Calendar.

## 🚀 Características

- **Reservas en tiempo real** con verificación de disponibilidad
- **Integración automática** con Google Calendar
- **Renovación automática** de tokens de Google
- **Panel de administración** para gestionar citas
- **Interfaz moderna** y responsive

## 🔧 Configuración

### 1. Variables de Entorno

Configura estas variables en tu proyecto de Supabase:

```bash
# Google OAuth
GOOGLE_CLIENT_ID=tu_google_client_id
GOOGLE_CLIENT_SECRET=tu_google_client_secret

# Supabase (ya configuradas por defecto)
VITE_SUPABASE_URL=tu_supabase_url
VITE_SUPABASE_ANON_KEY=tu_supabase_anon_key
```

### 2. Base de Datos

Ejecuta este SQL en tu base de datos de Supabase:

```sql
-- Tabla para tokens de usuario específico
CREATE TABLE public.google_auth_tokens (
  user_id uuid NOT NULL UNIQUE,
  token text,
  refresh_token text,
  id bigint NOT NULL DEFAULT nextval('google_auth_tokens_id_seq'::regclass),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT google_auth_tokens_pkey PRIMARY KEY (id),
  CONSTRAINT google_auth_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- Tabla para tokens globales del sistema
CREATE TABLE public.google_calendar_tokens (
  token text,
  refresh_token text,
  id integer NOT NULL DEFAULT 1 CHECK (id = 1),
  updated_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT google_calendar_tokens_pkey PRIMARY KEY (id)
);

-- Tabla para reservas
CREATE TABLE public.reservations (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  services ARRAY NOT NULL,
  date date NOT NULL,
  time text NOT NULL,
  customer_name text NOT NULL,
  phone text NOT NULL,
  email text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  status text DEFAULT 'confirmed'::text,
  CONSTRAINT reservations_pkey PRIMARY KEY (id)
);
```

### 3. Desplegar Función Edge

```bash
# Desde la raíz del proyecto
cd supabase/functions/store-google-token
chmod +x deploy.sh
./deploy.sh
```

O manualmente:

```bash
supabase functions deploy store-google-token
```

## 🔄 Renovación Automática de Tokens

El sistema incluye renovación automática de tokens de Google:

### ✅ Características:

- **Detección automática** de tokens expirados
- **Renovación transparente** usando refresh tokens
- **Actualización automática** en la base de datos
- **Verificación periódica** cada 15 minutos
- **Manejo de errores** robusto

### 🔧 Cómo Funciona:

1. **Almacenamiento**: Los tokens se guardan en la base de datos
2. **Verificación**: Cada 15 minutos se verifica el estado
3. **Renovación**: Si está expirado, usa refresh token para renovar
4. **Actualización**: Guarda el nuevo token automáticamente
5. **Continuidad**: Las operaciones continúan sin interrupción

### 📊 Estados del Token:

- `valid`: Token válido, renovación automática exitosa
- `reauth_required`: Refresh token expirado, requiere reautenticación
- `error`: Error en el proceso de renovación

## 🛠️ Desarrollo

### Instalar dependencias:

```bash
npm install
```

### Ejecutar en desarrollo:

```bash
npm run dev
```

### Construir para producción:

```bash
npm run build
```

## 📱 Uso

### Para Administradores:

1. Accede a `/admin`
2. Ingresa el código de acceso
3. Vincula tu cuenta de Google Calendar
4. Gestiona citas desde el panel

### Para Clientes:

1. Selecciona servicios
2. Elige fecha y horario disponible
3. Completa información de contacto
4. Confirma reserva

## 🔐 Seguridad

- **Autenticación** con Supabase Auth
- **Tokens seguros** almacenados en base de datos
- **Renovación automática** sin intervención manual
- **Verificación periódica** de estado de tokens

## 🐛 Solución de Problemas

### Token Expirado:
- El sistema detectará automáticamente y renovará
- Si falla, notificará para reautenticación manual

### Error de Conexión:
- Verifica variables de entorno
- Confirma que la función edge esté desplegada
- Revisa logs en Supabase Dashboard

## 📞 Soporte

Para problemas técnicos, revisa:
1. Logs de la función edge en Supabase
2. Estado de las variables de entorno
3. Configuración de Google OAuth
4. Estructura de la base de datos
