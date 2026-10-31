#!/usr/bin/env bash
#
# M7: Postgres backup for the Weyro database.
#
# Usage:
#   ./scripts/backup-db.sh [output-dir]
#
# Environment (or set in cron):
#   DB_CONTAINER (default weyro_postgres — use weyro_postgres_prod for prod compose)
#   POSTGRES_USER (default weyro), POSTGRES_DB (default weyro_db)
#
# Restore notes:
#   Custom-format dumps restore with:
#     docker exec -i <container> pg_restore -U weyro -d weyro_db --clean --if-exists < backup.dump
#   For a plain SQL dump (PG_SUFFIX=sql):
#     docker exec -i <container> psql -U weyro -d weyro_db < backup.sql
#
set -euo pipefail

CONTAINER="${DB_CONTAINER:-weyro_postgres}"
DB_USER="${POSTGRES_USER:-weyro}"
DB_NAME="${POSTGRES_DB:-weyro_db}"
OUT_DIR="${1:-./backups}"
STAMP="$(date +%Y%m%d_%H%M%S)"
OUT_FILE="${OUT_DIR}/weyro_db_${STAMP}.dump"

mkdir -p "${OUT_DIR}"

echo "Backing up ${DB_NAME} from container ${CONTAINER} → ${OUT_FILE}"
docker exec "${CONTAINER}" pg_dump -U "${DB_USER}" -Fc "${DB_NAME}" > "${OUT_FILE}"

SIZE=$(du -h "${OUT_FILE}" | cut -f1)
echo "Done: ${OUT_FILE} (${SIZE})"

# Retention: keep the 14 most recent backups, delete older ones.
ls -1t "${OUT_DIR}"/weyro_db_*.dump 2>/dev/null | tail -n +15 | xargs -r rm -f
echo "Retention: kept the 14 most recent backups."
