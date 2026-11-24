// Crea cuentas ficticias de prueba y el catálogo inicial de productos.
// Uso: npm run db:semilla            -> cuentas y catálogo
//      npm run db:semilla -- --ejemplos -> además, tres solicitudes ficticias
// La contraseña de las cuentas se toma de SEMILLA_CONTRASENA y nunca se guarda en el repositorio.
import { cerrarPool, transaccion } from '../src/db/pool';
import { hashContrasena } from '../src/services/sesiones';
import { hoyEnBogota, sumarDias } from '../src/utils/fechas';

const contrasena = process.env.SEMILLA_CONTRASENA;
if (!contrasena || contrasena.length < 10) {
  console.error('Define SEMILLA_CONTRASENA (mínimo 10 caracteres) en backend/.env');
  process.exit(1);
}

// Datos completamente ficticios. Veredas tomadas del diagnóstico (Tabla 36 del documento maestro).
const CUENTAS = [
  { nombre: 'Administración AgroTurno', correo: 'admin@agroturno.test', rol: 'ADMINISTRADOR' },
  { nombre: 'Coordinación de prueba', correo: 'coordinador@agroturno.test', rol: 'COORDINADOR' },
  { nombre: 'Productor A (ficticio)', correo: 'productor.a@agroturno.test', rol: 'PRODUCTOR', vereda: 'Vereda La Reinera' },
  { nombre: 'Productor B (ficticio)', correo: 'productor.b@agroturno.test', rol: 'PRODUCTOR', vereda: 'Vereda El Troncal' },
] as const;

// Productos más frecuentes en el diagnóstico (Tabla 34): plátano, cacao, yuca y maíz
const PRODUCTOS = [
  { nombre: 'Plátano', unidades: ['racimos', 'kilogramos'], defecto: 'racimos' },
  { nombre: 'Cacao', unidades: ['kilogramos', 'bultos'], defecto: 'kilogramos' },
  { nombre: 'Yuca', unidades: ['bultos', 'kilogramos'], defecto: 'bultos' },
  { nombre: 'Maíz', unidades: ['bultos', 'kilogramos'], defecto: 'bultos' },
];

async function main() {
  const hash = await hashContrasena(contrasena!);
  const conEjemplos = process.argv.includes('--ejemplos');

  await transaccion(async (db) => {
    for (const p of PRODUCTOS) {
      await db.query(
        `INSERT INTO productos (nombre, unidades, unidad_defecto) VALUES ($1, $2, $3)
         ON CONFLICT ((lower(nombre))) DO NOTHING`,
        [p.nombre, p.unidades, p.defecto],
      );
    }
    for (const c of CUENTAS) {
      const { rows } = await db.query<{ id: string }>(
        `INSERT INTO usuarios (nombre, correo, hash_contrasena, rol) VALUES ($1, $2, $3, $4)
         ON CONFLICT ((lower(correo))) DO UPDATE SET hash_contrasena = EXCLUDED.hash_contrasena, activo = true
         RETURNING id`,
        [c.nombre, c.correo, hash, c.rol],
      );
      if (c.rol === 'PRODUCTOR') {
        await db.query(
          `INSERT INTO productores (usuario_id, nombre_publico, vereda) VALUES ($1, $2, $3)
           ON CONFLICT (usuario_id) DO NOTHING`,
          [rows[0].id, c.nombre, c.vereda],
        );
      }
    }

    if (conEjemplos) {
      const { rows: existentes } = await db.query('SELECT 1 FROM solicitudes LIMIT 1');
      if (existentes.length) {
        console.log('Ya hay solicitudes: no se agregan ejemplos.');
        return;
      }
      const hoy = hoyEnBogota();
      const ejemplos = [
        { correo: 'productor.a@agroturno.test', producto: 'Plátano', cantidad: 45, unidad: 'racimos', ubicacion: 'Vereda La Reinera, punto de acopio junto a la escuela (dato ficticio)', dias: 2 },
        { correo: 'productor.a@agroturno.test', producto: 'Cacao', cantidad: 120, unidad: 'kilogramos', ubicacion: 'Vereda La Reinera, finca de prueba, entrada por el puente (dato ficticio)', dias: 4 },
        { correo: 'productor.b@agroturno.test', producto: 'Yuca', cantidad: 18, unidad: 'bultos', ubicacion: 'Vereda El Troncal, kilómetro 3 sobre la vía principal (dato ficticio)', dias: 3 },
      ];
      for (const e of ejemplos) {
        const { rows } = await db.query<{ id: string; usuario_id: string; productor_id: string; producto_id: string }>(
          `SELECT u.id AS usuario_id, p.id AS productor_id, pr.id AS producto_id
             FROM usuarios u JOIN productores p ON p.usuario_id = u.id, productos pr
            WHERE u.correo = $1 AND pr.nombre = $2`,
          [e.correo, e.producto],
        );
        const ref = rows[0];
        const s = await db.query<{ id: string }>(
          `INSERT INTO solicitudes (productor_id, producto_id, cantidad, unidad, ubicacion_texto, fecha_disponible, creado_por)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
          [ref.productor_id, ref.producto_id, e.cantidad, e.unidad, e.ubicacion, sumarDias(hoy, e.dias), ref.usuario_id],
        );
        await db.query(
          `INSERT INTO historial_solicitudes (solicitud_id, usuario_id, accion, estado_nuevo, detalle)
           VALUES ($1, $2, 'CREACION', 'PENDIENTE', $3)`,
          [s.rows[0].id, ref.usuario_id, { cantidad: e.cantidad, unidad: e.unidad, origen: 'datos de ejemplo' }],
        );
      }
    }
  });

  console.log('Datos de prueba listos:');
  for (const c of CUENTAS) console.log(`  ${c.rol.padEnd(14)} ${c.correo}`);
  console.log('  Contraseña: la definida en SEMILLA_CONTRASENA');
}

main()
  .catch((error) => {
    console.error('Error en la semilla:', error.message);
    process.exitCode = 1;
  })
  .finally(() => cerrarPool());
