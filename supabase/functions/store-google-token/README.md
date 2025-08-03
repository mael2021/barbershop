# Store Google Token Function

Esta función edge maneja el almacenamiento, recuperación y renovación automática de tokens de Google Calendar.

## Variables de Entorno Requeridas

Configura estas variables en tu proyecto de Supabase:

```bash
GOOGLE_CLIENT_ID=tu_google_client_id
GOOGLE_CLIENT_SECRET=tu_google_client_secret
```

## Funcionalidades

### 1. Almacenamiento de Tokens (`action: "store"`)
- Guarda access token y refresh token en la base de datos
- Soporta tokens específicos de usuario y globales

### 2. Recuperación con Renovación Automática (`action: "retrieve"`)
- Obtiene el token válido
- Renueva automáticamente si está expirado
- Actualiza la base de datos con el nuevo token

### 3. Verificación de Estado (`action: "check_token_status"`)
- Verifica si el token está válido
- Renueva automáticamente si es necesario
- Retorna estado del token

### 4. Obtener Eventos (`action: "get_events"`)
- Obtiene eventos del calendario
- Usa token renovado automáticamente
- Maneja errores de autenticación

### 5. Crear Eventos (`action: "create_event"`)
- Crea eventos en Google Calendar
- Usa token renovado automáticamente
- Maneja errores de autenticación

## Renovación Automática

La función incluye renovación automática de tokens:

1. **Detección de Expiración**: Verifica si el token JWT está expirado
2. **Renovación**: Usa el refresh token para obtener nuevo access token
3. **Actualización**: Guarda el nuevo token en la base de datos
4. **Continuidad**: Retorna el token válido para uso inmediato

## Manejo de Errores

- `REAUTH_REQUIRED`: Refresh token expirado, requiere reautenticación
- `ADMIN_REAUTH_REQUIRED`: Error específico para admin, requiere reautenticación
- `No tokens found`: No hay tokens almacenados

## Despliegue

```bash
# Desde la raíz del proyecto
supabase functions deploy store-google-token
```

## Uso

```typescript
// Ejemplo de uso
const response = await fetch(`${SUPABASE_URL}/functions/v1/store-google-token`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.access_token}`,
  },
  body: JSON.stringify({
    action: "retrieve", // Obtiene token con renovación automática
  }),
});
``` 