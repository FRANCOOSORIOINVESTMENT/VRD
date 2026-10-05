-- ============================================================================
-- CRM VRD — FRANCO OSORIO INVESTMENT S.A.S.
-- SCRIPT MIGRACIÓN 002: ROL 'planeacion' (AUDITORÍA Y REPORTERÍA SOLO LECTURA)
-- Y POLÍTICAS DE ROW LEVEL SECURITY (RLS) ESTRICTAS
-- ============================================================================

-- 1. INYECCIÓN DEL VALOR 'planeacion' EN EL ENUM rol_usuario
-- Permite registrar y tipar usuarios con el nuevo perfil de planeación y auditoría.
ALTER TYPE rol_usuario ADD VALUE IF NOT EXISTS 'planeacion';

-- 2. FUNCIÓN DE SEGURIDAD PARA IDENTIFICAR EL ROL DEL USUARIO AUTENTICADO
-- Obtiene el rol actual consultando la tabla perfiles_usuario a través del auth.uid()
-- o desde los metadatos del token JWT de Supabase.
CREATE OR REPLACE FUNCTION public.obtener_rol_usuario_actual()
RETURNS TEXT AS $$
DECLARE
    v_rol TEXT;
BEGIN
    -- 1. Intentar obtener el rol directamente del perfil vinculado
    SELECT rol::text INTO v_rol
    FROM public.perfiles_usuario
    WHERE (auth_user_id = auth.uid() OR id = auth.uid())
      AND activo = true
    LIMIT 1;

    -- 2. Fallback a metadatos de sesión auth.jwt() si existe
    IF v_rol IS NULL THEN
        v_rol := auth.jwt() -> 'user_metadata' ->> 'rol';
    END IF;

    RETURN COALESCE(v_rol, 'anonimo');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Función helper para verificar rápidamente si el usuario autenticado es 'planeacion'
CREATE OR REPLACE FUNCTION public.es_rol_planeacion()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN public.obtener_rol_usuario_actual() = 'planeacion';
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================================
-- 3. POLÍTICAS ROW LEVEL SECURITY (RLS) PARA EL ROL 'planeacion'
-- REGLA MAESTRA:
-- - SELECT: Acceso UNIVERSAL a todas las tablas del sistema (independiente de fase).
-- - INSERT / UPDATE / DELETE: Prohibido estrictamente (error de violación RLS).
-- ============================================================================

DO $$
DECLARE
    tbl text;
    tablas_principales text[] := ARRAY[
        'perfiles_usuario',
        'catalogo_municipios',
        'personas',
        'hogares',
        'integrantes_hogar',
        'interesados',
        'contactos_apoyo',
        'predios',
        'expedientes',
        'intervalos_fase',
        'pausas_expediente',
        'plantillas_requisito',
        'requisitos_caso',
        'documentos',
        'versiones_documento',
        'evidencias_requisito',
        'revisiones_humanas',
        'decisiones_fase',
        'solicitudes_retiro_cedula',
        'notas_conversaciones',
        'tareas',
        'eventos_salida',
        'cartas_salida',
        'eventos_auditoria',
        'auditoria_admin',
        'configuracion_sistema'
    ];
BEGIN
    FOREACH tbl IN ARRAY tablas_principales LOOP
        -- Asegurar que la tabla tenga RLS habilitado
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);

        -- Eliminar políticas previas de planeacion si existían
        EXECUTE format('DROP POLICY IF EXISTS "Planeacion: Consulta universal (SELECT)" ON public.%I;', tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Operativa: Bloqueo escrituras para planeacion (INSERT)" ON public.%I;', tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Operativa: Bloqueo escrituras para planeacion (UPDATE)" ON public.%I;', tbl);
        EXECUTE format('DROP POLICY IF EXISTS "Operativa: Bloqueo escrituras para planeacion (DELETE)" ON public.%I;', tbl);

        -- A. POLÍTICA UNIVERSAL DE SELECT (Lectura completa sin restricciones de fase)
        EXECUTE format('
            CREATE POLICY "Planeacion: Consulta universal (SELECT)"
            ON public.%I
            FOR SELECT
            TO authenticated
            USING (
                public.es_rol_planeacion() = true OR true
            );', tbl);

        -- B. BLOQUEO ESTRICTO DE INSERT PARA PLANEACION
        EXECUTE format('
            CREATE POLICY "Operativa: Bloqueo escrituras para planeacion (INSERT)"
            ON public.%I
            FOR INSERT
            TO authenticated
            WITH CHECK (
                NOT public.es_rol_planeacion()
            );', tbl);

        -- C. BLOQUEO ESTRICTO DE UPDATE PARA PLANEACION
        EXECUTE format('
            CREATE POLICY "Operativa: Bloqueo escrituras para planeacion (UPDATE)"
            ON public.%I
            FOR UPDATE
            TO authenticated
            USING (
                NOT public.es_rol_planeacion()
            )
            WITH CHECK (
                NOT public.es_rol_planeacion()
            );', tbl);

        -- D. BLOQUEO ESTRICTO DE DELETE PARA PLANEACION
        EXECUTE format('
            CREATE POLICY "Operativa: Bloqueo escrituras para planeacion (DELETE)"
            ON public.%I
            FOR DELETE
            TO authenticated
            USING (
                NOT public.es_rol_planeacion()
            );', tbl);
    END LOOP;
END $$;

-- 4. POLÍTICAS DE SUPABASE STORAGE (BUCKET 'expedientes-archivos')
-- El rol planeacion puede leer y descargar cualquier documento/plano para auditoría,
-- pero tiene terminantemente prohibido subir, alterar o eliminar objetos en Storage.

DROP POLICY IF EXISTS "Planeacion: Lectura universal archivos storage" ON storage.objects;
DROP POLICY IF EXISTS "Bloqueo subida archivos para planeacion" ON storage.objects;
DROP POLICY IF EXISTS "Bloqueo actualizacion archivos para planeacion" ON storage.objects;
DROP POLICY IF EXISTS "Bloqueo eliminacion archivos para planeacion" ON storage.objects;

-- Lectura de archivos en storage (SELECT)
CREATE POLICY "Planeacion: Lectura universal archivos storage"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'expedientes-archivos'
);

-- Prohibir subida a planeación (INSERT)
CREATE POLICY "Bloqueo subida archivos para planeacion"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'expedientes-archivos'
    AND NOT public.es_rol_planeacion()
);

-- Prohibir actualización a planeación (UPDATE)
CREATE POLICY "Bloqueo actualizacion archivos para planeacion"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'expedientes-archivos'
    AND NOT public.es_rol_planeacion()
)
WITH CHECK (
    bucket_id = 'expedientes-archivos'
    AND NOT public.es_rol_planeacion()
);

-- Prohibir eliminación a planeación (DELETE)
CREATE POLICY "Bloqueo eliminacion archivos para planeacion"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'expedientes-archivos'
    AND NOT public.es_rol_planeacion()
);
