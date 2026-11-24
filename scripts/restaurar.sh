#!/usr/bin/env bash
# T16 · Restaura un respaldo en una base de destino y compara conteos con el origen.
# Uso: ORIGEN_URL=postgres://... DESTINO_URL=postgres://... ./scripts/restaurar.sh archivo.dump
# El destino debe ser una base distinta (por ejemplo agroturno_restaurada); se recrea el esquema.
set -euo pipefail
archivo="${1:?Indica el archivo .dump}"
: "${ORIGEN_URL:?Define ORIGEN_URL}"
: "${DESTINO_URL:?Define DESTINO_URL}"
psql "$DESTINO_URL" -q -c 'DROP SCHEMA IF EXISTS agroturno CASCADE'
pg_restore --dbname="$DESTINO_URL" --no-owner --no-privileges "$archivo"
consulta="SELECT 'usuarios', count(*) FROM agroturno.usuarios UNION ALL
SELECT 'productos', count(*) FROM agroturno.productos UNION ALL
SELECT 'solicitudes', count(*) FROM agroturno.solicitudes UNION ALL
SELECT 'programaciones', count(*) FROM agroturno.programaciones UNION ALL
SELECT 'historial', count(*) FROM agroturno.historial_solicitudes ORDER BY 1"
diff <(psql "$ORIGEN_URL" -At -c "$consulta") <(psql "$DESTINO_URL" -At -c "$consulta") \
  && { echo "Restauración verificada: los conteos coinciden"; psql "$DESTINO_URL" -At -c "$consulta"; } \
  || { echo "Los conteos NO coinciden"; exit 1; }
