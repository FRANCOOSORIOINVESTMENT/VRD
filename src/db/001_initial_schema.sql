-- ============================================================================
-- CRM PROGRAMA VIVIENDA RURAL DIGNA (VRD) — FRANCO OSORIO INVESTMENT S.A.S.
-- SCRIPT DE INSTALACIÓN COMPLETO DESDE CERO PARA SUPABASE (POSTGRESQL)
-- ============================================================================

-- 0. REINICIO LIMPIO DE TABLAS EXISTENTES (ORDEN INVERSO DE DEPENDENCIAS)
DROP TABLE IF EXISTS eventos_auditoria CASCADE;
DROP TABLE IF EXISTS cartas_salida CASCADE;
DROP TABLE IF EXISTS eventos_salida CASCADE;
DROP TABLE IF EXISTS tareas CASCADE;
DROP TABLE IF EXISTS notas_conversaciones CASCADE;
DROP TABLE IF EXISTS decisiones_fase CASCADE;
DROP TABLE IF EXISTS revisiones_humanas CASCADE;
DROP TABLE IF EXISTS evidencias_requisito CASCADE;
DROP TABLE IF EXISTS versiones_documento CASCADE;
DROP TABLE IF EXISTS documentos CASCADE;
DROP TABLE IF EXISTS requisitos_caso CASCADE;
DROP TABLE IF EXISTS plantillas_requisito CASCADE;
DROP TABLE IF EXISTS pausas_expediente CASCADE;
DROP TABLE IF EXISTS intervalos_fase CASCADE;
DROP TABLE IF EXISTS expedientes CASCADE;
DROP TABLE IF EXISTS predios CASCADE;
DROP TABLE IF EXISTS contactos_apoyo CASCADE;
DROP TABLE IF EXISTS interesados CASCADE;
DROP TABLE IF EXISTS integrantes_hogar CASCADE;
DROP TABLE IF EXISTS hogares CASCADE;
DROP TABLE IF EXISTS personas CASCADE;
DROP TABLE IF EXISTS catalogo_municipios CASCADE;
DROP TABLE IF EXISTS perfiles_usuario CASCADE;

-- 1. EXTENSIONES DEL SISTEMA
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "unaccent";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 2. TIPOS ENUMERADOS
DO $$ BEGIN
    CREATE TYPE rol_usuario AS ENUM ('administrador', 'supervisor', 'comercial', 'asistente', 'ingenieria');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE tipo_identificacion AS ENUM ('CC', 'CE', 'TI', 'RC', 'PAS');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE estado_expediente AS ENUM ('captacion', 'en_tramite', 'en_pausa_aporte', 'salida_definitiva', 'construccion_iniciada');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE estado_requisito AS ENUM ('pendiente_carga', 'recibido_revision', 'con_observaciones', 'aceptado');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE resultado_revision AS ENUM ('ACEPTADO', 'OBSERVADO');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE estado_carta AS ENUM ('pendiente_elaborar', 'pendiente_enviar', 'enviada');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 3. TABLA PERFILES DE USUARIO
CREATE TABLE perfiles_usuario (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_user_id UUID UNIQUE,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    nombre_completo VARCHAR(150) NOT NULL,
    rol rol_usuario NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT true,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    desactivado_en TIMESTAMPTZ,
    desactivado_por UUID REFERENCES perfiles_usuario(id)
);

-- 4. CATÁLOGO MUNICIPAL OFICIAL (DANE / CUNDINAMARCA)
CREATE TABLE catalogo_municipios (
    codigo_completo VARCHAR(5) PRIMARY KEY, -- 5 dígitos DPMPP (ej: 25899, 25175)
    departamento_codigo VARCHAR(2) NOT NULL DEFAULT '25',
    municipio_codigo VARCHAR(3) NOT NULL,
    departamento_nombre VARCHAR(100) NOT NULL DEFAULT 'Cundinamarca',
    municipio_nombre VARCHAR(100) NOT NULL,
    fuente VARCHAR(100) NOT NULL DEFAULT 'Codificación de Municipios por Departamento PDF',
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. PERSONAS E INTEGRANTES DEL HOGAR
CREATE TABLE personas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tipo_identificacion tipo_identificacion NOT NULL DEFAULT 'CC',
    numero_identificacion VARCHAR(30) NOT NULL,
    nombres VARCHAR(100) NOT NULL,
    primer_apellido VARCHAR(100) NOT NULL,
    segundo_apellido VARCHAR(100),
    telefono_principal VARCHAR(30),
    correo VARCHAR(255),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_persona_identificacion UNIQUE (tipo_identificacion, numero_identificacion)
);

CREATE TABLE hogares (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    observaciones TEXT,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE integrantes_hogar (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hogar_id UUID NOT NULL REFERENCES hogares(id) ON DELETE CASCADE,
    persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE RESTRICT,
    parentesco VARCHAR(50) NOT NULL,
    es_postulante_principal BOOLEAN NOT NULL DEFAULT false,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. INTERESADOS COMERCIALES (CAPTACIÓN)
CREATE TABLE interesados (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre_contacto VARCHAR(150) NOT NULL,
    telefono VARCHAR(30) NOT NULL,
    tiene_whatsapp BOOLEAN DEFAULT false,
    correo VARCHAR(255),
    departamento_codigo VARCHAR(2) DEFAULT '25',
    municipio_codigo VARCHAR(5) REFERENCES catalogo_municipios(codigo_completo),
    vereda VARCHAR(150),
    origen_contacto VARCHAR(100) DEFAULT 'llamada',
    resumen_necesidad TEXT,
    comercial_asignado_id UUID NOT NULL REFERENCES perfiles_usuario(id),
    estado_comercial VARCHAR(50) NOT NULL DEFAULT 'nuevo_contacto',
    convertido_a_expediente_id UUID,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE contactos_apoyo (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    interesado_id UUID REFERENCES interesados(id) ON DELETE CASCADE,
    expediente_id UUID,
    nombre_completo VARCHAR(150) NOT NULL,
    relacion VARCHAR(100) NOT NULL,
    telefono VARCHAR(30) NOT NULL,
    tiene_whatsapp BOOLEAN DEFAULT false,
    correo VARCHAR(255),
    preferencia_contacto TEXT,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. PREDIOS
CREATE TABLE predios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    departamento_codigo VARCHAR(2) NOT NULL DEFAULT '25',
    municipio_codigo VARCHAR(5) NOT NULL REFERENCES catalogo_municipios(codigo_completo),
    vereda VARCHAR(150),
    nombre_o_direccion VARCHAR(255),
    matricula_inmobiliaria VARCHAR(50),
    referencia_catastral VARCHAR(50),
    es_predio_vivienda_principal BOOLEAN NOT NULL DEFAULT true,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. EXPEDIENTES CENTRALES VRD
CREATE TABLE expedientes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    interesado_origen_id UUID REFERENCES interesados(id),
    postulante_id UUID NOT NULL REFERENCES personas(id),
    hogar_id UUID NOT NULL REFERENCES hogares(id),
    predio_vivienda_id UUID NOT NULL REFERENCES predios(id),
    codigo_visible VARCHAR(100) NOT NULL, -- DPMPP-CEDULA-APELLIDO
    estado_general estado_expediente NOT NULL DEFAULT 'en_tramite',
    comercial_origen_id UUID NOT NULL REFERENCES perfiles_usuario(id),
    responsable_general_id UUID NOT NULL REFERENCES perfiles_usuario(id),
    fecha_primer_contacto TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_ingreso_fase1 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fase_actual INT NOT NULL DEFAULT 1 CHECK (fase_actual BETWEEN 1 AND 7),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. TRAZABILIDAD TEMPORAL Y PAUSAS
CREATE TABLE intervalos_fase (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    expediente_id UUID NOT NULL REFERENCES expedientes(id) ON DELETE CASCADE,
    fase INT NOT NULL CHECK (fase BETWEEN 1 AND 7),
    fecha_inicio TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_cierre TIMESTAMPTZ,
    cerrada_por UUID REFERENCES perfiles_usuario(id),
    resultado_cierre VARCHAR(50),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE pausas_expediente (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    expediente_id UUID NOT NULL REFERENCES expedientes(id) ON DELETE CASCADE,
    motivo VARCHAR(100) NOT NULL DEFAULT 'falta_aporte_10_porciento',
    detalles TEXT,
    fecha_inicio TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_fin TIMESTAMPTZ,
    registrada_por UUID NOT NULL REFERENCES perfiles_usuario(id),
    reactivada_por UUID REFERENCES perfiles_usuario(id),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. GESTIÓN DOCUMENTAL
CREATE TABLE plantillas_requisito (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fase INT NOT NULL CHECK (fase BETWEEN 1 AND 7),
    codigo_requisito VARCHAR(20) UNIQUE NOT NULL, -- 'F1-01', 'F1-02', etc.
    nombre VARCHAR(150) NOT NULL,
    descripcion TEXT,
    es_obligatorio BOOLEAN NOT NULL DEFAULT true,
    formato_esperado VARCHAR(30) NOT NULL DEFAULT 'PDF'
);

CREATE TABLE requisitos_caso (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    expediente_id UUID NOT NULL REFERENCES expedientes(id) ON DELETE CASCADE,
    plantilla_id UUID NOT NULL REFERENCES plantillas_requisito(id),
    fase INT NOT NULL CHECK (fase BETWEEN 1 AND 7),
    persona_id UUID REFERENCES personas(id),
    predio_id UUID REFERENCES predios(id),
    estado estado_requisito NOT NULL DEFAULT 'pendiente_carga',
    es_adicional BOOLEAN NOT NULL DEFAULT false,
    motivo_adicional TEXT,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE documentos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    expediente_id UUID NOT NULL REFERENCES expedientes(id) ON DELETE CASCADE,
    titulo VARCHAR(150) NOT NULL,
    persona_id UUID REFERENCES personas(id),
    predio_id UUID REFERENCES predios(id),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE versiones_documento (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    documento_id UUID NOT NULL REFERENCES documentos(id) ON DELETE CASCADE,
    version_numero INT NOT NULL DEFAULT 1,
    storage_path VARCHAR(500) NOT NULL,
    nombre_archivo_original VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    tamano_bytes BIGINT NOT NULL,
    sha256_hash VARCHAR(64) NOT NULL,
    subido_por UUID NOT NULL REFERENCES perfiles_usuario(id),
    subido_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_doc_version UNIQUE (documento_id, version_numero)
);

CREATE TABLE evidencias_requisito (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requisito_caso_id UUID NOT NULL REFERENCES requisitos_caso(id) ON DELETE CASCADE,
    version_documento_id UUID NOT NULL REFERENCES versiones_documento(id) ON DELETE CASCADE,
    vinculado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    vinculado_por UUID NOT NULL REFERENCES perfiles_usuario(id),
    CONSTRAINT uq_evidencia_requisito UNIQUE (requisito_caso_id, version_documento_id)
);

-- 11. REVISIONES HUMANAS Y DECISIONES DE FASE
CREATE TABLE revisiones_humanas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requisito_caso_id UUID NOT NULL REFERENCES requisitos_caso(id) ON DELETE CASCADE,
    version_documento_id UUID NOT NULL REFERENCES versiones_documento(id) ON DELETE CASCADE,
    supervisor_id UUID NOT NULL REFERENCES perfiles_usuario(id),
    ciclo_revision INT NOT NULL DEFAULT 1,
    resultado resultado_revision NOT NULL,
    observacion TEXT,
    fecha_revision TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE decisiones_fase (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    expediente_id UUID NOT NULL REFERENCES expedientes(id) ON DELETE CASCADE,
    fase INT NOT NULL CHECK (fase BETWEEN 1 AND 7),
    tipo_decision VARCHAR(50) NOT NULL,
    supervisor_id UUID NOT NULL REFERENCES perfiles_usuario(id),
    asistente_asignado_id UUID REFERENCES perfiles_usuario(id),
    motivo TEXT,
    fecha_decision TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. GESTIÓN OPERATIVA (NOTAS, TAREAS, SALIDAS, AUDITORÍA)
CREATE TABLE notas_conversaciones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    expediente_id UUID REFERENCES expedientes(id) ON DELETE CASCADE,
    interesado_id UUID REFERENCES interesados(id) ON DELETE CASCADE,
    autor_id UUID NOT NULL REFERENCES perfiles_usuario(id),
    persona_contactada VARCHAR(150),
    canal VARCHAR(50) NOT NULL DEFAULT 'llamada',
    contenido TEXT NOT NULL,
    fecha_gestion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE tareas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    expediente_id UUID NOT NULL REFERENCES expedientes(id) ON DELETE CASCADE,
    descripcion TEXT NOT NULL,
    asignado_a_id UUID NOT NULL REFERENCES perfiles_usuario(id),
    creado_por_id UUID NOT NULL REFERENCES perfiles_usuario(id),
    fecha_compromiso TIMESTAMPTZ,
    estado VARCHAR(30) NOT NULL DEFAULT 'pendiente',
    resultado TEXT,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cerrado_en TIMESTAMPTZ
);

CREATE TABLE eventos_salida (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    expediente_id UUID NOT NULL REFERENCES expedientes(id) ON DELETE CASCADE,
    motivo VARCHAR(150) NOT NULL,
    fundamento TEXT NOT NULL,
    decidido_por UUID NOT NULL REFERENCES perfiles_usuario(id),
    fecha_salida TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fase_alcanzada INT NOT NULL
);

CREATE TABLE cartas_salida (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    evento_salida_id UUID NOT NULL REFERENCES eventos_salida(id) ON DELETE CASCADE,
    comercial_id UUID NOT NULL REFERENCES perfiles_usuario(id),
    estado_carta estado_carta NOT NULL DEFAULT 'pendiente_elaborar',
    version_carta_id UUID REFERENCES versiones_documento(id),
    fecha_envio TIMESTAMPTZ,
    canal_envio VARCHAR(100),
    constancia_envio_url VARCHAR(500),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE eventos_auditoria (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    expediente_id UUID REFERENCES expedientes(id) ON DELETE SET NULL,
    usuario_id UUID REFERENCES perfiles_usuario(id) ON DELETE SET NULL,
    tipo_evento VARCHAR(100) NOT NULL,
    entidad_afectada VARCHAR(100) NOT NULL,
    detalles JSONB,
    fecha_evento TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 13. SEMILLA DE DATOS INICIALES (USUARIOS, MUNICIPIOS, PLANTILLAS)
-- ============================================================================

-- Cuentas de usuario iniciales
INSERT INTO perfiles_usuario (username, email, nombre_completo, rol, activo) VALUES
('comercial.franco', 'comercial.prueba@franco.co', 'Carlos Mendoza (Gestor Rural)', 'comercial', true),
('supervisor.franco', 'supervisor.prueba@franco.co', 'Dra. Helena Ramírez (Analista Documental)', 'supervisor', true),
('asistente.franco', 'asistente.prueba@franco.co', 'Laura Castillo (Gestor Documental)', 'asistente', true),
('asistente.andres', 'asistente.andres@franco.co', 'Andrés Gil (Gestor Documental II)', 'asistente', true),
('ingenieria.franco', 'ingenieria.prueba@franco.co', 'Ing. Roberto Salazar (Coordinador Técnico)', 'ingenieria', true),
('admin.franco', 'admin.prueba@franco.co', 'Administrador de Sistemas', 'administrador', true)
ON CONFLICT (username) DO NOTHING;

-- Municipios oficiales de Cundinamarca
INSERT INTO catalogo_municipios (codigo_completo, departamento_codigo, municipio_codigo, departamento_nombre, municipio_nombre) VALUES
('25899', '25', '899', 'Cundinamarca', 'Zipaquirá'),
('25200', '25', '200', 'Cundinamarca', 'Cogua'),
('25486', '25', '486', 'Cundinamarca', 'Nemocón'),
('25785', '25', '785', 'Cundinamarca', 'Tabio'),
('25799', '25', '799', 'Cundinamarca', 'Tenjo'),
('25295', '25', '295', 'Cundinamarca', 'Gachancipá'),
('25817', '25', '817', 'Cundinamarca', 'Tocancipá'),
('25175', '25', '175', 'Cundinamarca', 'Chía'),
('25126', '25', '126', 'Cundinamarca', 'Cajicá'),
('25758', '25', '758', 'Cundinamarca', 'Sopó'),
('25769', '25', '769', 'Cundinamarca', 'Subachoque'),
('25513', '25', '513', 'Cundinamarca', 'Pacho'),
('25867', '25', '867', 'Cundinamarca', 'Villapinzón'),
('25154', '25', '154', 'Cundinamarca', 'Chocontá'),
('25843', '25', '843', 'Cundinamarca', 'Villa de San Diego de Ubaté')
ON CONFLICT (codigo_completo) DO NOTHING;

-- Plantillas maestras de requisitos de Fase 1 y Fase 2
INSERT INTO plantillas_requisito (fase, codigo_requisito, nombre, descripcion, es_obligatorio, formato_esperado) VALUES
(1, 'F1-01', 'Cédula de Ciudadanía del Postulante Principal', 'Fotocopia legible por ambas caras ampliada al 150%', true, 'PDF'),
(1, 'F1-02', 'Certificado de Tradición y Libertad', 'Vigencia no mayor a 30 días, folio completo y legible', true, 'PDF'),
(1, 'F1-03', 'Recibo o Paz y Salvo del Impuesto Predial', 'Año gravable en curso pagado o certificación de paz y salvo municipal', true, 'PDF'),
(2, 'F2-01', 'Certificado de Tradición y Libertad Actualizado', 'Folio matriz o segregado con vigencia < 30 días', true, 'PDF'),
(2, 'F2-02', 'Escritura Pública o Título de Adquisición', 'Copia completa de la escritura o resolución de adjudicación', true, 'PDF'),
(2, 'F2-03', 'Paz y Salvo de Impuesto Predial Vigente', 'Paz y salvo municipal vigente a la fecha', true, 'PDF'),
(2, 'F2-04', 'Cédulas de Ciudadanía de Integrantes Mayores', 'Copia de documentos de identidad de todo el núcleo familiar', true, 'PDF'),
(2, 'F2-05', 'Registros Civiles de Nacimiento o Matrimonio', 'Acreditación de parentesco según aplique', true, 'PDF'),
(2, 'F2-06', 'Declaración Juramentada de No Posesión de Otra Vivienda', 'Firmada ante notario o juez de paz', true, 'PDF'),
(2, 'F2-07', 'Certificado de Ingresos Familiares', 'Acreditación de ingresos no superiores a 4 SMMLV', true, 'PDF'),
(2, 'F2-08', 'Certificación de Cuenta de Ahorro / Cesantías', 'Certificación bancaria para el aporte del 10%', true, 'PDF'),
(2, 'F2-09', 'Carta de Autorización y Tratamiento de Datos', 'Formato firmado por los miembros del hogar', true, 'PDF'),
(2, 'F2-10', 'Formulario de Inscripción y Postulación Oficial', 'Formulario del programa completamente diligenciado', true, 'PDF'),
(2, 'F2-11', 'Certificado de Residencia Rural Expedido por Alcaldía', 'Constancia de arraigo rural en la vereda correspondiente', true, 'PDF')
ON CONFLICT (codigo_requisito) DO NOTHING;

-- ============================================================================
-- 14. SEGURIDAD Y ROW LEVEL SECURITY (RLS) UNIFICADO E IDEMPOTENTE
-- ============================================================================

DO $$ 
DECLARE 
    tabla record;
BEGIN 
    FOR tabla IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
    LOOP
        -- Habilitar RLS en cada tabla
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tabla.tablename);

        -- Limpiar cualquier política anterior para garantizar cero errores
        EXECUTE format('DROP POLICY IF EXISTS "Acceso total CRM VRD" ON public.%I;', tabla.tablename);
        EXECUTE format('DROP POLICY IF EXISTS "Acceso total para usuarios autenticados" ON public.%I;', tabla.tablename);
        EXECUTE format('DROP POLICY IF EXISTS "Acceso para clave anon" ON public.%I;', tabla.tablename);
        EXECUTE format('DROP POLICY IF EXISTS "Lectura de perfiles para autenticados" ON public.%I;', tabla.tablename);
        EXECUTE format('DROP POLICY IF EXISTS "Consulta general de expedientes para autenticados" ON public.%I;', tabla.tablename);
        EXECUTE format('DROP POLICY IF EXISTS "Comercial gestiona sus casos o Fase 1" ON public.%I;', tabla.tablename);

        -- Crear política universal para anon y authenticated
        EXECUTE format('
            CREATE POLICY "Acceso total CRM VRD" 
            ON public.%I 
            FOR ALL 
            TO anon, authenticated 
            USING (true) 
            WITH CHECK (true);', tabla.tablename);
    END LOOP; 
END $$;
