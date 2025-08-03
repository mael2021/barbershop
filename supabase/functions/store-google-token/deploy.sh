#!/bin/bash

# Script de despliegue para la función store-google-token

echo "🚀 Desplegando función store-google-token..."

# Verificar que estás en el directorio correcto
if [ ! -f "index.ts" ]; then
    echo "❌ Error: No se encontró index.ts. Asegúrate de estar en el directorio correcto."
    exit 1
fi

# Desplegar la función
supabase functions deploy store-google-token

if [ $? -eq 0 ]; then
    echo "✅ Función desplegada exitosamente!"
    echo ""
    echo "📋 Próximos pasos:"
    echo "1. Configura las variables de entorno en Supabase Dashboard:"
    echo "   - GOOGLE_CLIENT_ID"
    echo "   - GOOGLE_CLIENT_SECRET"
    echo ""
    echo "2. Verifica que las tablas estén creadas:"
    echo "   - google_auth_tokens"
    echo "   - google_calendar_tokens"
    echo ""
    echo "3. Prueba la función desde tu aplicación"
else
    echo "❌ Error al desplegar la función"
    exit 1
fi 