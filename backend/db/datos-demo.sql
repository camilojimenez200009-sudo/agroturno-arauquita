-- AgroTurno Arauquita · Datos de demostración
-- Personas, ubicaciones y teléfonos inventados para pruebas; no corresponden a personas reales.
-- Carga productores, cuentas y solicitudes en todos los estados, con historial coherente,
-- para probar filtros, programación, reprogramación, transporte, seguimiento e historial.
-- Requisito: haber ejecutado la semilla (cuentas admin y coordinador y catálogo base).
-- Las cuentas nuevas reciben la misma contraseña que admin@agroturno.test.
-- Es idempotente: si ya se cargaron (historial con origen «datos de ejemplo»), no hace nada.

DO $$
DECLARE
  hoy        date := (now() AT TIME ZONE 'America/Bogota')::date;
  hash_demo  text;
  coord1     uuid;
  coord2     uuid;
  r          record;
  v_usuario  uuid;
  v_productor uuid;
  v_producto uuid;
  v_sol      uuid;
  v_prog     uuid;
  t0         timestamptz;
  t          timestamptz;
  f_disp     date;
  f_prog     date;
  f_prog_ini date;
BEGIN
  IF EXISTS (SELECT 1 FROM agroturno.historial_solicitudes WHERE detalle->>'origen' = 'datos de ejemplo') THEN
    RAISE NOTICE 'Los datos de demostración ya estaban cargados';
    RETURN;
  END IF;

  SELECT hash_contrasena INTO hash_demo FROM agroturno.usuarios WHERE correo = 'admin@agroturno.test';
  SELECT id INTO coord1 FROM agroturno.usuarios WHERE correo = 'coordinador@agroturno.test';
  IF hash_demo IS NULL OR coord1 IS NULL THEN
    RAISE EXCEPTION 'Primero ejecute la semilla (npm run db:semilla)';
  END IF;

  -- Nombres de los productores de la semilla
  UPDATE agroturno.usuarios SET nombre = 'Luis Alberto Mendoza' WHERE correo = 'productor.a@agroturno.test';
  UPDATE agroturno.usuarios SET nombre = 'Marta Cecilia Rojas' WHERE correo = 'productor.b@agroturno.test';
  UPDATE agroturno.productores p SET nombre_publico = u.nombre FROM agroturno.usuarios u
   WHERE p.usuario_id = u.id AND u.correo IN ('productor.a@agroturno.test', 'productor.b@agroturno.test');

  -- Segundo coordinador y una cuenta desactivada (para probar el bloqueo de acceso)
  INSERT INTO agroturno.usuarios (nombre, correo, hash_contrasena, rol)
  VALUES ('Coordinación turno tarde', 'coordinador2@agroturno.test', hash_demo, 'COORDINADOR')
  ON CONFLICT ((lower(correo))) DO NOTHING;
  SELECT id INTO coord2 FROM agroturno.usuarios WHERE correo = 'coordinador2@agroturno.test';

  INSERT INTO agroturno.usuarios (nombre, correo, hash_contrasena, rol, activo)
  VALUES ('Andrés Villamizar', 'inactivo@agroturno.test', hash_demo, 'COORDINADOR', false)
  ON CONFLICT ((lower(correo))) DO NOTHING;

  -- Producto inactivo: visible para el administrador, no seleccionable en solicitudes
  INSERT INTO agroturno.productos (nombre, unidades, unidad_defecto, activo)
  VALUES ('Arroz (retirado del catálogo)', '{bultos}', 'bultos', false)
  ON CONFLICT ((lower(nombre))) DO NOTHING;

  -- Productores adicionales (veredas de la Tabla 36 del documento maestro)
  FOR r IN SELECT * FROM (VALUES
    ('Hernán Galvis', 'productor.c@agroturno.test', 'Vereda Bocas del Juju', '3000000101'),
    ('Yolanda Castro', 'productor.d@agroturno.test', 'Vereda San Lorenzo', NULL),
    ('Ramiro Peña', 'productor.e@agroturno.test', 'Vereda El Oasis', '3000000102'),
    ('Diana Suárez', 'productor.f@agroturno.test', 'Vereda Puerto Rico', NULL),
    ('Óscar Bello', 'productor.g@agroturno.test', 'Vereda Filipinas', '3000000103')
  ) AS v(nombre, correo, vereda, telefono)
  LOOP
    INSERT INTO agroturno.usuarios (nombre, correo, hash_contrasena, rol)
    VALUES (r.nombre, r.correo, hash_demo, 'PRODUCTOR')
    ON CONFLICT ((lower(correo))) DO NOTHING;
    INSERT INTO agroturno.productores (usuario_id, nombre_publico, telefono, vereda)
    SELECT id, r.nombre, r.telefono, r.vereda FROM agroturno.usuarios WHERE correo = r.correo
    ON CONFLICT (usuario_id) DO NOTHING;
    INSERT INTO agroturno.auditoria_usuarios (actor_id, usuario_id, accion, detalle)
    SELECT a.id, u.id, 'ALTA', jsonb_build_object('rol', 'PRODUCTOR', 'origen', 'datos de ejemplo')
      FROM agroturno.usuarios u, agroturno.usuarios a
     WHERE u.correo = r.correo AND a.correo = 'admin@agroturno.test';
  END LOOP;

  -- Solicitudes. Columnas:
  -- correo, producto, cantidad, unidad, ubicación, lat, lon,
  -- días disponible (desde hoy), estado final, días programada (desde hoy), franja,
  -- transporte (contacto, teléfono, vehículo), días reprogramación (null = no), motivo,
  -- cantidad editada (null = sin edición), horas desde la creación, coordinador (1 o 2), notas
  FOR r IN SELECT * FROM (VALUES
    -- PENDIENTES
    ('productor.a@agroturno.test','Plátano',60,'racimos','Vereda La Reinera, entrada por el puente de madera',7.0412,-71.4655, 2,'PENDIENTE',NULL::int,NULL,NULL,NULL,NULL,NULL::int,NULL,NULL::numeric,6,1,'Racimos de primera, listos para corte'),
    ('productor.b@agroturno.test','Yuca',25,'bultos','Vereda El Troncal, kilómetro 4 sobre la vía',NULL,NULL, 1,'PENDIENTE',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,10,1,NULL),
    ('productor.c@agroturno.test','Cacao',180,'kilogramos','Vereda Bocas del Juju, junto a la cancha',7.0731,-71.3902, 3,'PENDIENTE',NULL,NULL,NULL,NULL,NULL,NULL,NULL,200,30,1,'Cacao seco y fermentado'),
    ('productor.d@agroturno.test','Maíz',40,'bultos','Vereda San Lorenzo, casa de techo verde frente a la escuela',NULL,NULL, 5,'PENDIENTE',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,4,1,'Acceso solo en camioneta'),
    ('productor.e@agroturno.test','Plátano',85,'racimos','Vereda El Oasis, finca al final del carreteable',6.9988,-71.5120, 4,'PENDIENTE',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,2,1,'Llamar antes de llegar'),
    ('productor.g@agroturno.test','Yuca',600,'kilogramos','Vereda Filipinas, punto de acopio comunitario',7.0105,-71.3511, 10,'PENDIENTE',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,20,1,NULL),
    -- PROGRAMADAS
    ('productor.b@agroturno.test','Plátano',70,'racimos','Vereda El Troncal, puerta azul junto a la tienda',7.0520,-71.4780, 1,'PROGRAMADA',2,'MANANA','Jorge Pabón','3000000201','Camión 350',NULL,NULL,NULL,48,1,NULL),
    ('productor.c@agroturno.test','Yuca',30,'bultos','Vereda Bocas del Juju, frente a la iglesia',NULL,NULL, 1,'PROGRAMADA',3,'TARDE','Wilson Ortega','3000000202','Turbo',2,'Aplazamiento de 24 h por lluvia y estado de la vía',NULL,60,1,'La vía se pone difícil con lluvia'),
    ('productor.d@agroturno.test','Cacao',250,'kilogramos','Vereda San Lorenzo, bodega de la asociación de cacaoteros',7.0890,-71.4300, 2,'PROGRAMADA',4,'JORNADA_COMPLETA',NULL,NULL,NULL,NULL,NULL,NULL,36,2,NULL),
    ('productor.e@agroturno.test','Maíz',55,'bultos','Vereda El Oasis, segunda entrada después del puente',NULL,NULL, 3,'PROGRAMADA',5,'MANANA','Fredy Quintero',NULL,'Camioneta doble cabina',4,'El transportador reportó daño en el vehículo',NULL,72,2,NULL),
    ('productor.g@agroturno.test','Plátano',120,'racimos','Vereda Filipinas, entrada principal',7.0201,-71.3650, 1,'PROGRAMADA',1,'TARDE','Jorge Pabón','3000000201','Camión 350',NULL,NULL,110,50,1,'Se pidió recoger antes de las 3 p. m.'),
    -- EN PROCESO
    ('productor.b@agroturno.test','Cacao',140,'kilogramos','Vereda El Troncal, finca al lado del jagüey',NULL,NULL, -1,'EN_PROCESO',0,'MANANA','Wilson Ortega','3000000202','Turbo',NULL,NULL,NULL,90,1,NULL),
    ('productor.f@agroturno.test','Plátano',90,'racimos','Vereda Puerto Rico, caseta comunal',7.0602,-71.5233, -2,'EN_PROCESO',0,'JORNADA_COMPLETA','Jorge Pabón','3000000201','Camión 350',1,'Se adelantó por disponibilidad del transporte',NULL,110,2,NULL),
    ('productor.c@agroturno.test','Maíz',35,'bultos','Vereda Bocas del Juju, al lado del puesto de salud',NULL,NULL, 0,'EN_PROCESO',0,'TARDE',NULL,NULL,NULL,NULL,NULL,NULL,30,1,NULL),
    ('productor.e@agroturno.test','Yuca',22,'bultos','Vereda El Oasis, casa de bahareque',NULL,NULL, -1,'EN_PROCESO',0,'MANANA','Fredy Quintero',NULL,'Camioneta doble cabina',NULL,NULL,NULL,70,2,NULL),
    -- COMPLETADAS
    ('productor.a@agroturno.test','Plátano',45,'racimos','Vereda La Reinera, punto de acopio veredal',7.0399,-71.4631, -6,'COMPLETADA',-5,'MANANA','Jorge Pabón','3000000201','Camión 350',NULL,NULL,NULL,200,1,NULL),
    ('productor.b@agroturno.test','Plátano',65,'racimos','Vereda El Troncal, kilómetro 3',NULL,NULL, -8,'COMPLETADA',-6,'TARDE','Wilson Ortega','3000000202','Turbo',-7,'Aplazamiento de 24 h por lluvia (caso O03)',NULL,260,2,NULL),
    ('productor.d@agroturno.test','Cacao',300,'kilogramos','Vereda San Lorenzo, bodega de la asociación de cacaoteros',NULL,NULL, -5,'COMPLETADA',-4,'JORNADA_COMPLETA','Fredy Quintero',NULL,'Camioneta doble cabina',NULL,NULL,NULL,170,1,NULL),
    ('productor.g@agroturno.test','Maíz',48,'bultos','Vereda Filipinas, punto de acopio comunitario',7.0110,-71.3520, -4,'COMPLETADA',-3,'MANANA',NULL,NULL,NULL,NULL,NULL,50,140,2,NULL),
    ('productor.c@agroturno.test','Yuca',28,'bultos','Vereda Bocas del Juju, frente a la iglesia',NULL,NULL, -3,'COMPLETADA',-2,'TARDE','Wilson Ortega','3000000202','Turbo',NULL,NULL,NULL,100,1,NULL)
  ) AS v(correo, producto, cantidad, unidad, ubicacion, lat, lon, d_disp, estado, d_prog, franja,
         t_nombre, t_tel, t_vehiculo, d_reprog, motivo, cant_editada, horas, coord, notas)
  LOOP
    SELECT u.id, p.id INTO v_usuario, v_productor
      FROM agroturno.usuarios u JOIN agroturno.productores p ON p.usuario_id = u.id WHERE u.correo = r.correo;
    SELECT id INTO v_producto FROM agroturno.productos WHERE nombre = r.producto;
    t0 := now() - make_interval(hours => r.horas);
    f_disp := hoy + r.d_disp;
    -- Si hubo reprogramación, la fecha inicial era la indicada en d_reprog y la final d_prog
    f_prog_ini := CASE WHEN r.d_reprog IS NOT NULL THEN hoy + r.d_reprog ELSE hoy + r.d_prog END;
    f_prog := hoy + r.d_prog;

    INSERT INTO agroturno.solicitudes (productor_id, producto_id, cantidad, unidad, ubicacion_texto, latitud, longitud,
                                       fecha_disponible, notas, estado, creado_por, creada_en, actualizada_en)
    VALUES (v_productor, v_producto, COALESCE(r.cant_editada, r.cantidad), r.unidad, r.ubicacion,
            r.lat, r.lon, f_disp, r.notas, r.estado, v_usuario, t0, now())
    RETURNING id INTO v_sol;

    INSERT INTO agroturno.historial_solicitudes (solicitud_id, usuario_id, accion, estado_nuevo, detalle, creado_en)
    VALUES (v_sol, v_usuario, 'CREACION', 'PENDIENTE',
            jsonb_build_object('cantidad', r.cantidad, 'unidad', r.unidad, 'fecha_disponible', f_disp, 'origen', 'datos de ejemplo'), t0);
    t := t0;

    IF r.cant_editada IS NOT NULL THEN
      t := t + interval '40 minutes';
      INSERT INTO agroturno.historial_solicitudes (solicitud_id, usuario_id, accion, estado_anterior, estado_nuevo, detalle, creado_en)
      VALUES (v_sol, v_usuario, 'EDICION', 'PENDIENTE', 'PENDIENTE',
              jsonb_build_object('cambios', jsonb_build_object('cantidad', jsonb_build_object('antes', r.cantidad, 'despues', r.cant_editada))), t);
    END IF;

    IF r.estado <> 'PENDIENTE' THEN
      t := t + interval '2 hours';
      INSERT INTO agroturno.programaciones (solicitud_id, fecha_programada, franja, coordinador_id, creada_en, actualizada_en)
      VALUES (v_sol, f_prog, r.franja, CASE WHEN r.coord = 2 THEN coord2 ELSE coord1 END, t, t)
      RETURNING id INTO v_prog;
      INSERT INTO agroturno.historial_solicitudes (solicitud_id, usuario_id, accion, estado_anterior, estado_nuevo, detalle, creado_en)
      VALUES (v_sol, CASE WHEN r.coord = 2 THEN coord2 ELSE coord1 END, 'PROGRAMACION', 'PENDIENTE', 'PROGRAMADA',
              jsonb_build_object('fecha_programada', f_prog_ini, 'franja', r.franja), t);

      IF r.t_nombre IS NOT NULL THEN
        t := t + interval '5 minutes';
        INSERT INTO agroturno.transportes (programacion_id, nombre_contacto, telefono, tipo_vehiculo, actualizado_en)
        VALUES (v_prog, r.t_nombre, r.t_tel, r.t_vehiculo, t);
        INSERT INTO agroturno.historial_solicitudes (solicitud_id, usuario_id, accion, detalle, creado_en)
        VALUES (v_sol, CASE WHEN r.coord = 2 THEN coord2 ELSE coord1 END, 'TRANSPORTE',
                jsonb_build_object('contacto', r.t_nombre, 'tipo_vehiculo', r.t_vehiculo, 'accion', 'asociado'), t);
      END IF;

      IF r.d_reprog IS NOT NULL THEN
        t := t + interval '6 hours';
        INSERT INTO agroturno.historial_solicitudes (solicitud_id, usuario_id, accion, estado_anterior, estado_nuevo, detalle, motivo, creado_en)
        VALUES (v_sol, CASE WHEN r.coord = 2 THEN coord2 ELSE coord1 END, 'REPROGRAMACION', 'PROGRAMADA', 'PROGRAMADA',
                jsonb_build_object('antes', jsonb_build_object('fecha_programada', f_prog_ini, 'franja', r.franja),
                                   'despues', jsonb_build_object('fecha_programada', f_prog, 'franja', r.franja)),
                r.motivo, t);
      END IF;
    END IF;

    IF r.estado IN ('EN_PROCESO', 'COMPLETADA') THEN
      t := GREATEST(t + interval '1 hour', LEAST(now() - interval '2 hours', (f_prog::timestamp + interval '7 hours') AT TIME ZONE 'America/Bogota'));
      INSERT INTO agroturno.historial_solicitudes (solicitud_id, usuario_id, accion, estado_anterior, estado_nuevo, creado_en)
      VALUES (v_sol, CASE WHEN r.coord = 2 THEN coord2 ELSE coord1 END, 'CAMBIO_ESTADO', 'PROGRAMADA', 'EN_PROCESO', t);
    END IF;

    IF r.estado = 'COMPLETADA' THEN
      t := LEAST(t + interval '5 hours', now() - interval '1 hour');
      INSERT INTO agroturno.historial_solicitudes (solicitud_id, usuario_id, accion, estado_anterior, estado_nuevo, motivo, creado_en)
      VALUES (v_sol, CASE WHEN r.coord = 2 THEN coord2 ELSE coord1 END, 'CAMBIO_ESTADO', 'EN_PROCESO', 'COMPLETADA',
              'Producto entregado en el punto de acopio', t);
    END IF;

    UPDATE agroturno.solicitudes SET actualizada_en = t WHERE id = v_sol;
  END LOOP;

  RAISE NOTICE 'Datos de demostración cargados';
END $$;
