#!/usr/bin/env bash
# T16 · Crea un respaldo del esquema agroturno con pg_dump (formato personalizado).
# Uso: DATABASE_URL_ADMIN=postgres://... ./scripts/respaldo.sh [carpeta]
set -euo pipefail
: "${DATABASE_URL_ADMIN:?Define DATABASE_URL_ADMIN (conexión con privilegios de propietario)}"
carpeta="${1:-respaldos}"
mkdir -p "$carpeta"
archivo="$carpeta/agroturno-$(date -u +%Y%m%dT%H%M%SZ).dump"
pg_dump "$DATABASE_URL_ADMIN" --schema=agroturno --format=custom --no-owner --no-privileges --file="$archivo"
echo "Respaldo creado: $archivo"
pg_restore --list "$archivo" | grep -c "TABLE DATA" | xargs -I{} echo "Tablas con datos en el respaldo: {}"
