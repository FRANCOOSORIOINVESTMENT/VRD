-- ============================================================================
-- CRM PROGRAMA VIVIENDA RURAL DIGNA (VRD) — FRANCO OSORIO INVESTMENT S.A.S.
-- MIGRACIÓN INICIAL 001: ESQUEMA BASE, TABLAS RELACIONALES Y ROW LEVEL SECURITY
-- ============================================================================

-- Habilitar extensiones necesarias para búsqueda y UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "unaccent";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 1. TIPOS ENUMERADOS DEL SISTEMA
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

-- 2. TABLA PERFILES DE USUARIO (Vinculada a auth.users de Supabase)
CREATE TABLE IF NOT EXISTS perfiles_usuario (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_user_id UUID UNIQUE, -- Referencia a auth.users(id) de Supabase
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    nombre_completo VARCHAR(150) NOT NULL,
    rol rol_usuario NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT true,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    desactivado_en TIMESTAMPTZ,
    desactivado_por UUID REFERENCES perfiles_usuario(id)
);

-- 3. CATÁLOGO MUNICIPAL OFICIAL
CREATE TABLE IF NOT EXISTS catalogo_municipios (
    codigo_completo VARCHAR(5) PRIMARY KEY, -- 5 dígitos DPMPP (ej: 25151, 05001)
    departamento_codigo VARCHAR(2) NOT NULL,
    municipio_codigo VARCHAR(3) NOT NULL,
    departamento_nombre VARCHAR(100) NOT NULL,
    municipio_nombre VARCHAR(100) NOT NULL,
    fuente VARCHAR(100) NOT NULL DEFAULT 'Codificación de Municipios por Departamento PDF',
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. PERSONAS E INTEGRANTES
CREATE TABLE IF NOT EXISTS personas (
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

CREATE TABLE IF NOT EXISTS hogares (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    observaciones TEXT,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS integrantes_hogar (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hogar_id UUID NOT NULL REFERENCES hogares(id) ON DELETE CASCADE,
    persona_id UUID NOT NULL REFERENCES personas(id),
    parentesco VARCHAR(50) NOT NULL, -- 'postulante_principal', 'conyuge', 'hijo', etc.
    es_postulante_principal BOOLEAN NOT NULL DEFAULT false,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. INTERESADOS COMERCIALES (CAPTACIÓN PREVIA A DOCUMENTOS)
CREATE TABLE IF NOT EXISTS interesados (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre_contacto VARCHAR(150) NOT NULL,
    telefono VARCHAR(30) NOT NULL,
    tiene_whatsapp BOOLEAN DEFAULT false,
    correo VARCHAR(255),
    departamento_codigo VARCHAR(2),
    municipio_codigo VARCHAR(5) REFERENCES catalogo_municipios(codigo_completo),
    vereda VARCHAR(150),
    origen_contacto VARCHAR(100) DEFAULT 'llamada',
    resumen_necesidad TEXT,
    comercial_asignado_id UUID NOT NULL REFERENCES perfiles_usuario(id),
    estado_comercial VARCHAR(50) NOT NULL DEFAULT 'nuevo_contacto',
    convertido_a_expediente_id UUID,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contactos_apoyo (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    interesado_id UUID REFERENCES interesados(id) ON DELETE CASCADE,
    expediente_id UUID, -- Vinculado también cuando pasa a expediente
    nombre_completo VARCHAR(150) NOT NULL,
    relacion VARCHAR(100) NOT NULL, -- 'hijo', 'vecino', etc.
    telefono VARCHAR(30) NOT NULL,
    tiene_whatsapp BOOLEAN DEFAULT false,
    correo VARCHAR(255),
    preferencia_contacto TEXT,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. PREDIOS
CREATE TABLE IF NOT EXISTS predios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    departamento_codigo VARCHAR(2) NOT NULL,
    municipio_codigo VARCHAR(5) NOT NULL REFERENCES catalogo_municipios(codigo_completo),
    vereda VARCHAR(150),
    nombre_o_direccion VARCHAR(255),
    matricula_inmobiliaria VARCHAR(50),
    referencia_catastral VARCHAR(50),
    es_predio_vivienda_principal BOOLEAN NOT NULL DEFAULT true,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. EXPEDIENTE CENTRAL VRD
CREATE TABLE IF NOT EXISTS expedientes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- ID Interno estable inmutable
    interesado_origen_id UUID REFERENCES interesados(id),
    postulante_id UUID NOT NULL REFERENCES personas(id),
    hogar_id UUID NOT NULL REFERENCES hogares(id),
    predio_vivienda_id UUID NOT NULL REFERENCES predios(id),
    codigo_visible VARCHAR(100), -- DPMPP-CEDULA-APELLIDO
    estado_general estado_expediente NOT NULL DEFAULT 'en_tramite',
    comercial_origen_id UUID NOT NULL REFERENCES perfiles_usuario(id),
    responsable_general_id UUID NOT NULL REFERENCES perfiles_usuario(id),
    fecha_primer_contacto TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_ingreso_fase1 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fase_actual INT NOT NULL DEFAULT 1,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. FASES Y TRAZABILIDAD TEMPORAL
CREATE TABLE IF NOT EXISTS intervalos_fase (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    expediente_id UUID NOT NULL REFERENCES expedientes(id) ON DELETE CASCADE,
    fase INT NOT NULL CHECK (fase BETWEEN 1 AND 7),
    fecha_inicio TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_cierre TIMESTAMPTZ,
    cerrada_por UUID REFERENCES perfiles_usuario(id),
    resultado_cierre VARCHAR(50),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pausas_expediente (
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

-- 9. GESTIÓN DOCUMENTAL (4 NIVELES)
CREATE TABLE IF NOT EXISTS plantillas_requisito (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fase INT NOT NULL,
    codigo_requisito VARCHAR(20) UNIQUE NOT NULL, -- 'F1-01', 'F1-02', 'F1-03', etc.
    nombre VARCHAR(150) NOT NULL,
    descripcion TEXT,
    es_obligatorio BOOLEAN NOT NULL DEFAULT true,
    formato_esperado VARCHAR(30) NOT NULL DEFAULT 'PDF'
);

CREATE TABLE IF NOT EXISTS requisitos_caso (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    expediente_id UUID NOT NULL REFERENCES expedientes(id) ON DELETE CASCADE,
    plantilla_id UUID NOT NULL REFERENCES plantillas_requisito(id),
    fase INT NOT NULL,
    persona_id UUID REFERENCES personas(id), -- Opcional: solo si es de un integrante
    predio_id UUID REFERENCES predios(id),     -- Opcional: solo si es del predio
    estado estado_requisito NOT NULL DEFAULT 'pendiente_carga',
    es_adicional BOOLEAN NOT NULL DEFAULT false,
    motivo_adicional TEXT,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS documentos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    expediente_id UUID NOT NULL REFERENCES expedientes(id) ON DELETE CASCADE,
    titulo VARCHAR(150) NOT NULL,
    persona_id UUID REFERENCES personas(id),
    predio_id UUID REFERENCES predios(id),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS versiones_documento (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    documento_id UUID NOT NULL REFERENCES documentos(id) ON DELETE CASCADE,
    version_numero INT NOT NULL DEFAULT 1,
    storage_path VARCHAR(500) NOT NULL, -- Ruta inmutable en Supabase Storage privado
    nombre_archivo_original VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    tamano_bytes BIGINT NOT NULL,
    sha256_hash VARCHAR(64) NOT NULL,
    subido_por UUID NOT NULL REFERENCES perfiles_usuario(id),
    subido_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_doc_version UNIQUE (documento_id, version_numero)
);

-- Asociación de versiones a requisitos del caso (soporta reutilización sin heredar aprobación)
CREATE TABLE IF NOT EXISTS evidencias_requisito (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requisito_caso_id UUID NOT NULL REFERENCES requisitos_caso(id) ON DELETE CASCADE,
    version_documento_id UUID NOT NULL REFERENCES versiones_documento(id) ON DELETE CASCADE,
    vinculado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    vinculado_por UUID NOT NULL REFERENCES perfiles_usuario(id),
    CONSTRAINT uq_evidencia_requisito UNIQUE (requisito_caso_id, version_documento_id)
);

-- 10. REVISIÓN HUMANA Y DECISIONES DE FASE
CREATE TABLE IF NOT EXISTS revisiones_humanas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requisito_caso_id UUID NOT NULL REFERENCES requisitos_caso(id),
    version_documento_id UUID NOT NULL REFERENCES versiones_documento(id),
    supervisor_id UUID NOT NULL REFERENCES perfiles_usuario(id),
    ciclo_revision INT NOT NULL DEFAULT 1,
    resultado resultado_revision NOT NULL,
    observacion TEXT,
    fecha_revision TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS decisiones_fase (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    expediente_id UUID NOT NULL REFERENCES expedientes(id) ON DELETE CASCADE,
    fase INT NOT NULL,
    tipo_decision VARCHAR(50) NOT NULL, -- 'aprobacion_fase', 'devolucion_observada', 'salida_no_aptitud'
    supervisor_id UUID NOT NULL REFERENCES perfiles_usuario(id),
    asistente_asignado_id UUID REFERENCES perfiles_usuario(id), -- Obligatorio en aprobación de Fase 1
    motivo TEXT,
    fecha_decision TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. BITÁCORA, TAREAS, SALIDAS Y CARTAS
CREATE TABLE IF NOT EXISTS notas_conversaciones (
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

CREATE TABLE IF NOT EXISTS tareas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    expediente_id UUID NOT NULL REFERENCES expedientes(id) ON DELETE CASCADE,
    descripcion TEXT NOT NULL,
    asignado_a_id UUID NOT NULL REFERENCES perfiles_usuario(id),
    creado_por_id UUID NOT NULL REFERENCES perfiles_usuario(id),
    fecha_compromiso TIMESTAMPTZ,
    estado VARCHAR(30) NOT NULL DEFAULT 'pendiente', -- 'pendiente', 'realizada', 'cancelada'
    resultado TEXT,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cerrado_en TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS eventos_salida (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    expediente_id UUID NOT NULL REFERENCES expedientes(id) ON DELETE CASCADE,
    motivo VARCHAR(150) NOT NULL,
    fundamento TEXT NOT NULL,
    decidido_por UUID NOT NULL REFERENCES perfiles_usuario(id),
    fecha_salida TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fase_alcanzada INT NOT NULL
);

CREATE TABLE IF NOT EXISTS cartas_salida (
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

-- 12. AUDITORÍA INMUTABLE
CREATE TABLE IF NOT EXISTS eventos_auditoria (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    expediente_id UUID REFERENCES expedientes(id),
    usuario_id UUID REFERENCES perfiles_usuario(id),
    tipo_evento VARCHAR(100) NOT NULL,
    entidad_afectada VARCHAR(100) NOT NULL,
    detalles JSONB,
    fecha_evento TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. POLÍTICAS ROW LEVEL SECURITY (RLS)
ALTER TABLE perfiles_usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE expedientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE versiones_documento ENABLE ROW LEVEL SECURITY;
ALTER TABLE revisiones_humanas ENABLE ROW LEVEL SECURITY;

-- Política de lectura de perfiles: todos los usuarios autenticados pueden consultar nombres y roles
CREATE POLICY "Lectura de perfiles para autenticados" ON perfiles_usuario
    FOR SELECT TO authenticated USING (true);

-- Política de lectura de expedientes: consulta universal del estado
CREATE POLICY "Consulta general de expedientes para autenticados" ON expedientes
    FOR SELECT TO authenticated USING (true);

-- Política de modificación de expedientes por rol
CREATE POLICY "Comercial gestiona sus casos o Fase 1" ON expedientes
    FOR UPDATE TO authenticated
    USING (
        (auth.jwt()->>'rol' = 'comercial' AND comercial_origen_id = auth.uid()) OR
        auth.jwt()->>'rol' = 'administrador'
    );
