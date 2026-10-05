-- ============================================================================
-- CRM PROGRAMA VIVIENDA RURAL DIGNA (VRD) — FRANCO OSORIO INVESTMENT S.A.S.
-- SCRIPT DE INSTALACIÓN COMPLETO Y DEFINITIVO DESDE CERO (SUPABASE POSTGRESQL)
-- ============================================================================
-- Este script crea todas las tablas, tipos enumerados, funciones, disparadores,
-- políticas de seguridad RLS idempotentes, bucket de Storage y semillas iniciales
-- (usuarios con contraseñas cifradas en bcrypt, municipios, requisitos F1 a F7 y expediente demo).
-- ============================================================================

-- 0. REINICIO LIMPIO DE TABLAS EXISTENTES (ORDEN INVERSO DE DEPENDENCIAS)
DROP TABLE IF EXISTS auditoria_admin CASCADE;
DROP TABLE IF EXISTS configuracion_sistema CASCADE;
DROP TABLE IF EXISTS solicitudes_retiro_cedula CASCADE;
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
    CREATE TYPE rol_usuario AS ENUM ('administrador', 'supervisor', 'comercial', 'asistente', 'ingenieria', 'planeacion');
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

-- 3. FUNCIÓN REUTILIZABLE PARA ACTUALIZAR TIMESTAMPS
CREATE OR REPLACE FUNCTION actualizar_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.actualizado_en = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 4. TABLA PERFILES DE USUARIO (CON SOPORTE BCRYPT Y CONTROL DE CONTRASEÑA)
-- ============================================================================
CREATE TABLE perfiles_usuario (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_user_id UUID UNIQUE,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    nombre_completo VARCHAR(150) NOT NULL,
    rol rol_usuario NOT NULL,
    password_hash VARCHAR(255) NOT NULL DEFAULT '$2b$10$R7Ln7bHfwo31wfJtcsos4uhsG/41vfYkftg1GdnBpFku/Uht74jNO',
    requiere_cambio_password BOOLEAN NOT NULL DEFAULT false,
    activo BOOLEAN NOT NULL DEFAULT true,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    desactivado_en TIMESTAMPTZ,
    desactivado_por UUID REFERENCES perfiles_usuario(id)
);

-- ============================================================================
-- 5. CATÁLOGO MUNICIPAL OFICIAL (DANE / CUNDINAMARCA)
-- ============================================================================
CREATE TABLE catalogo_municipios (
    codigo_completo VARCHAR(5) PRIMARY KEY, -- 5 dígitos DPMPP (ej: 25899, 25175)
    departamento_codigo VARCHAR(2) NOT NULL DEFAULT '25',
    municipio_codigo VARCHAR(3) NOT NULL,
    departamento_nombre VARCHAR(100) NOT NULL DEFAULT 'Cundinamarca',
    municipio_nombre VARCHAR(100) NOT NULL,
    fuente VARCHAR(100) NOT NULL DEFAULT 'Codificación Oficial DANE Cundinamarca',
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 6. PERSONAS E INTEGRANTES DEL HOGAR
-- ============================================================================
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
    retiro_pendiente BOOLEAN NOT NULL DEFAULT false,
    solicitud_retiro_id UUID,
    motivo_retiro_pendiente TEXT,
    ultimo_rechazo_retiro TEXT,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 7. INTERESADOS COMERCIALES (CAPTACIÓN)
-- ============================================================================
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

-- ============================================================================
-- 8. PREDIOS RURALES
-- ============================================================================
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

-- ============================================================================
-- 9. EXPEDIENTES CENTRALES VRD (FASES 1 A 7 Y CONTROL INTEGRAL)
-- ============================================================================
CREATE TABLE expedientes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    interesado_origen_id UUID REFERENCES interesados(id),
    postulante_id UUID NOT NULL REFERENCES personas(id),
    hogar_id UUID NOT NULL REFERENCES hogares(id),
    predio_vivienda_id UUID NOT NULL REFERENCES predios(id),
    codigo_visible VARCHAR(100) UNIQUE NOT NULL, -- DPMPP-CEDULA-APELLIDO
    estado_general estado_expediente NOT NULL DEFAULT 'en_tramite',
    comercial_origen_id UUID NOT NULL REFERENCES perfiles_usuario(id),
    responsable_general_id UUID NOT NULL REFERENCES perfiles_usuario(id),
    asistente_asignado_id UUID REFERENCES perfiles_usuario(id),
    fase_actual INT NOT NULL DEFAULT 1 CHECK (fase_actual BETWEEN 1 AND 7),
    bloqueado_por_revision BOOLEAN NOT NULL DEFAULT false,
    fase_en_revision INT,
    motivo_devolucion_fase TEXT,
    revision_fases JSONB NOT NULL DEFAULT '{}'::jsonb,
    estado_fase1 VARCHAR(30) NOT NULL DEFAULT 'en_preparacion',
    estado_fase2 VARCHAR(30) NOT NULL DEFAULT 'en_preparacion',
    observacion_devolucion_fase2 TEXT,
    fecha_primer_contacto TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_ingreso_fase1 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    validacion_compensar JSONB,     -- Fase 3: Validación y radicado Compensar
    gestion_fase4 JSONB,           -- Fase 4: 3 Frentes Técnicos y Presupuesto
    tramite_licencia JSONB,        -- Fase 5: Seguimiento Licencia Curaduría/Planeación
    postulacion_subsidio JSONB,    -- Fase 6: Carga formal subsidio, subsanación y resolución
    gestion_fase7 JSONB,           -- Fase 7: Obras, documentos de cierre y desembolso
    solicitud_rechazo JSONB,       -- Solicitud transversal de salida/rechazo
    historial_solicitudes_rechazo JSONB DEFAULT '[]'::jsonb,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_actualizar_expedientes
BEFORE UPDATE ON expedientes
FOR EACH ROW EXECUTE FUNCTION actualizar_timestamp();

-- ============================================================================
-- 10. TRAZABILIDAD TEMPORAL, INTERVALOS Y PAUSAS
-- ============================================================================
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

-- ============================================================================
-- 11. GESTIÓN DOCUMENTAL Y REQUISITOS (FASES 1 A 7)
-- ============================================================================
CREATE TABLE plantillas_requisito (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fase INT NOT NULL CHECK (fase BETWEEN 1 AND 7),
    codigo_requisito VARCHAR(20) UNIQUE NOT NULL, -- 'F1-01', 'F2-01', etc.
    nombre VARCHAR(150) NOT NULL,
    descripcion TEXT,
    es_obligatorio BOOLEAN NOT NULL DEFAULT true,
    formato_esperado VARCHAR(30) NOT NULL DEFAULT 'PDF',
    orden INT NOT NULL DEFAULT 1,
    orientacion_tecnica TEXT,
    activo BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE requisitos_caso (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    expediente_id UUID NOT NULL REFERENCES expedientes(id) ON DELETE CASCADE,
    plantilla_id UUID REFERENCES plantillas_requisito(id),
    codigo_requisito VARCHAR(20) NOT NULL,
    nombre VARCHAR(150) NOT NULL,
    descripcion TEXT,
    fase INT NOT NULL CHECK (fase BETWEEN 1 AND 7),
    persona_id UUID REFERENCES personas(id),
    predio_id UUID REFERENCES predios(id),
    estado estado_requisito NOT NULL DEFAULT 'pendiente_carga',
    es_obligatorio BOOLEAN NOT NULL DEFAULT true,
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
    url_publica VARCHAR(500),
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

-- ============================================================================
-- 12. REVISIONES HUMANAS Y DECISIONES
-- ============================================================================
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

-- ============================================================================
-- 13. SOLICITUDES DE RETIRO DE CÉDULA DEL HOGAR
-- ============================================================================
CREATE TABLE solicitudes_retiro_cedula (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    expediente_id UUID NOT NULL REFERENCES expedientes(id) ON DELETE CASCADE,
    integrante_id UUID NOT NULL,
    persona_id UUID NOT NULL REFERENCES personas(id),
    parentesco VARCHAR(50) NOT NULL,
    solicitado_por_id UUID NOT NULL REFERENCES perfiles_usuario(id),
    motivo_solicitud TEXT NOT NULL,
    fecha_solicitud TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    estado VARCHAR(30) NOT NULL DEFAULT 'pendiente', -- 'pendiente', 'autorizada', 'rechazada'
    resuelto_por_id UUID REFERENCES perfiles_usuario(id),
    fecha_resolucion TIMESTAMPTZ,
    motivo_rechazo TEXT,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 14. GESTIÓN OPERATIVA: NOTAS, TAREAS, SALIDAS Y AUDITORÍA
-- ============================================================================
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

CREATE TABLE auditoria_admin (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fecha TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    admin_id UUID NOT NULL REFERENCES perfiles_usuario(id),
    admin_nombre VARCHAR(150) NOT NULL,
    accion VARCHAR(100) NOT NULL,
    detalle TEXT NOT NULL,
    categoria VARCHAR(50) NOT NULL DEFAULT 'sistema',
    datos_adicionales JSONB
);

CREATE TABLE configuracion_sistema (
    id VARCHAR(50) PRIMARY KEY DEFAULT 'config_principal',
    datos JSONB NOT NULL,
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_por UUID REFERENCES perfiles_usuario(id)
);

-- ============================================================================
-- 15. SEMILLA DE DATOS INICIALES (USUARIOS, MUNICIPIOS, PLANTILLAS F1 A F7)
-- ============================================================================

-- 15.1 Cuentas de usuario iniciales con hash bcrypt de 'crm2026*'
INSERT INTO perfiles_usuario (id, username, email, nombre_completo, rol, password_hash, requiere_cambio_password, activo) VALUES
('757ef367-c0bd-480a-b294-d5fef041f39c', 'comercial.franco', 'comercial.prueba@franco.co', 'Carlos Mendoza (Gestor Rural)', 'comercial', '$2b$10$R7Ln7bHfwo31wfJtcsos4uhsG/41vfYkftg1GdnBpFku/Uht74jNO', false, true),
('f00564c8-adb3-46d2-b154-837b9e7386aa', 'supervisor.franco', 'supervisor.prueba@franco.co', 'Dra. Helena Ramírez (Analista Documental)', 'supervisor', '$2b$10$R7Ln7bHfwo31wfJtcsos4uhsG/41vfYkftg1GdnBpFku/Uht74jNO', false, true),
('ee12d5e6-34cf-4de5-b11a-f256ddde4be2', 'asistente.franco', 'asistente.prueba@franco.co', 'Laura Castillo (Gestor Documental)', 'asistente', '$2b$10$R7Ln7bHfwo31wfJtcsos4uhsG/41vfYkftg1GdnBpFku/Uht74jNO', false, true),
('887088b1-570e-4404-ac23-84c5a8ccb6da', 'asistente.andres', 'asistente.andres@franco.co', 'Andrés Gil (Gestor Documental II)', 'asistente', '$2b$10$R7Ln7bHfwo31wfJtcsos4uhsG/41vfYkftg1GdnBpFku/Uht74jNO', false, true),
('73e7181a-02ea-49a9-afaa-7c58e7097a24', 'ingenieria.franco', 'ingenieria.prueba@franco.co', 'Ing. Roberto Salazar (Coordinador Técnico)', 'ingenieria', '$2b$10$R7Ln7bHfwo31wfJtcsos4uhsG/41vfYkftg1GdnBpFku/Uht74jNO', false, true),
('a49c95b6-75da-48cb-a827-0cf4957e8c3b', 'admin.franco', 'admin.prueba@franco.co', 'Administrador de Sistemas', 'administrador', '$2b$10$R7Ln7bHfwo31wfJtcsos4uhsG/41vfYkftg1GdnBpFku/Uht74jNO', false, true)
ON CONFLICT (username) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    nombre_completo = EXCLUDED.nombre_completo,
    rol = EXCLUDED.rol,
    activo = true;

-- 15.2 Catálogo de Municipios Oficiales de Cundinamarca (116 Municipios DANE)
INSERT INTO catalogo_municipios (codigo_completo, departamento_codigo, municipio_codigo, departamento_nombre, municipio_nombre) VALUES
('25001', '25', '001', 'Cundinamarca', 'Agua de Dios'),
('25019', '25', '019', 'Cundinamarca', 'Albán'),
('25035', '25', '035', 'Cundinamarca', 'Anapoima'),
('25040', '25', '040', 'Cundinamarca', 'Anolaima'),
('25599', '25', '599', 'Cundinamarca', 'Apulo (Rafael Reyes)'),
('25053', '25', '053', 'Cundinamarca', 'Arbeláez'),
('25086', '25', '086', 'Cundinamarca', 'Beltrán'),
('25095', '25', '095', 'Cundinamarca', 'Bituima'),
('25099', '25', '099', 'Cundinamarca', 'Bojacá'),
('25120', '25', '120', 'Cundinamarca', 'Cabrera'),
('25123', '25', '123', 'Cundinamarca', 'Cachipay'),
('25126', '25', '126', 'Cundinamarca', 'Cajicá'),
('25148', '25', '148', 'Cundinamarca', 'Caparrapí'),
('25151', '25', '151', 'Cundinamarca', 'Cáqueza'),
('25154', '25', '154', 'Cundinamarca', 'Carmen de Carupa'),
('25168', '25', '168', 'Cundinamarca', 'Chaguaní'),
('25175', '25', '175', 'Cundinamarca', 'Chía'),
('25178', '25', '178', 'Cundinamarca', 'Chipaque'),
('25181', '25', '181', 'Cundinamarca', 'Choachí'),
('25183', '25', '183', 'Cundinamarca', 'Chocontá'),
('25200', '25', '200', 'Cundinamarca', 'Cogua'),
('25214', '25', '214', 'Cundinamarca', 'Cota'),
('25224', '25', '224', 'Cundinamarca', 'Cucunubá'),
('25245', '25', '245', 'Cundinamarca', 'El Colegio'),
('25258', '25', '258', 'Cundinamarca', 'El Peñón'),
('25260', '25', '260', 'Cundinamarca', 'El Rosal'),
('25269', '25', '269', 'Cundinamarca', 'Facatativá'),
('25279', '25', '279', 'Cundinamarca', 'Fómeque'),
('25281', '25', '281', 'Cundinamarca', 'Fosca'),
('25286', '25', '286', 'Cundinamarca', 'Funza'),
('25288', '25', '288', 'Cundinamarca', 'Fúquene'),
('25290', '25', '290', 'Cundinamarca', 'Fusagasugá'),
('25293', '25', '293', 'Cundinamarca', 'Gachalá'),
('25295', '25', '295', 'Cundinamarca', 'Gachancipá'),
('25297', '25', '297', 'Cundinamarca', 'Gachetá'),
('25299', '25', '299', 'Cundinamarca', 'Gama'),
('25307', '25', '307', 'Cundinamarca', 'Girardot'),
('25312', '25', '312', 'Cundinamarca', 'Granada'),
('25317', '25', '317', 'Cundinamarca', 'Guachetá'),
('25320', '25', '320', 'Cundinamarca', 'Guaduas'),
('25322', '25', '322', 'Cundinamarca', 'Guasca'),
('25324', '25', '324', 'Cundinamarca', 'Guataquí'),
('25326', '25', '326', 'Cundinamarca', 'Guatavita'),
('25328', '25', '328', 'Cundinamarca', 'Guayabal de Síquima'),
('25335', '25', '335', 'Cundinamarca', 'Guayabetal'),
('25339', '25', '339', 'Cundinamarca', 'Gutiérrez'),
('25368', '25', '368', 'Cundinamarca', 'Jerusalén'),
('25372', '25', '372', 'Cundinamarca', 'Junín'),
('25377', '25', '377', 'Cundinamarca', 'La Calera'),
('25386', '25', '386', 'Cundinamarca', 'La Mesa'),
('25394', '25', '394', 'Cundinamarca', 'La Palma'),
('25398', '25', '398', 'Cundinamarca', 'La Peña'),
('25402', '25', '402', 'Cundinamarca', 'La Vega'),
('25407', '25', '407', 'Cundinamarca', 'Lenguazaque'),
('25426', '25', '426', 'Cundinamarca', 'Machetá'),
('25430', '25', '430', 'Cundinamarca', 'Madrid'),
('25436', '25', '436', 'Cundinamarca', 'Manta'),
('25438', '25', '438', 'Cundinamarca', 'Medina'),
('25473', '25', '473', 'Cundinamarca', 'Mosquera'),
('25483', '25', '483', 'Cundinamarca', 'Nariño'),
('25486', '25', '486', 'Cundinamarca', 'Nemocón'),
('25488', '25', '488', 'Cundinamarca', 'Nilo'),
('25489', '25', '489', 'Cundinamarca', 'Nimaima'),
('25491', '25', '491', 'Cundinamarca', 'Nocaima'),
('25513', '25', '513', 'Cundinamarca', 'Pacho'),
('25518', '25', '518', 'Cundinamarca', 'Paime'),
('25524', '25', '524', 'Cundinamarca', 'Pandi'),
('25530', '25', '530', 'Cundinamarca', 'Paratebueno'),
('25535', '25', '535', 'Cundinamarca', 'Pasca'),
('25572', '25', '572', 'Cundinamarca', 'Puerto Salgar'),
('25580', '25', '580', 'Cundinamarca', 'Pulí'),
('25592', '25', '592', 'Cundinamarca', 'Quebradanegra'),
('25594', '25', '594', 'Cundinamarca', 'Quetame'),
('25596', '25', '596', 'Cundinamarca', 'Quipile'),
('25612', '25', '612', 'Cundinamarca', 'Ricaurte'),
('25645', '25', '645', 'Cundinamarca', 'San Antonio del Tequendama'),
('25649', '25', '649', 'Cundinamarca', 'San Bernardo'),
('25653', '25', '653', 'Cundinamarca', 'San Cayetano'),
('25658', '25', '658', 'Cundinamarca', 'San Francisco'),
('25662', '25', '662', 'Cundinamarca', 'San Juan de Rioseco'),
('25718', '25', '718', 'Cundinamarca', 'Sasaima'),
('25736', '25', '736', 'Cundinamarca', 'Sesquilé'),
('25740', '25', '740', 'Cundinamarca', 'Sibaté'),
('25743', '25', '743', 'Cundinamarca', 'Silvania'),
('25745', '25', '745', 'Cundinamarca', 'Simijaca'),
('25754', '25', '754', 'Cundinamarca', 'Soacha'),
('25758', '25', '758', 'Cundinamarca', 'Sopó'),
('25769', '25', '769', 'Cundinamarca', 'Subachoque'),
('25772', '25', '772', 'Cundinamarca', 'Suesca'),
('25777', '25', '777', 'Cundinamarca', 'Supatá'),
('25779', '25', '779', 'Cundinamarca', 'Susa'),
('25781', '25', '781', 'Cundinamarca', 'Sutatausa'),
('25785', '25', '785', 'Cundinamarca', 'Tabio'),
('25793', '25', '793', 'Cundinamarca', 'Tausa'),
('25797', '25', '797', 'Cundinamarca', 'Tena'),
('25799', '25', '799', 'Cundinamarca', 'Tenjo'),
('25805', '25', '805', 'Cundinamarca', 'Tibacuy'),
('25807', '25', '807', 'Cundinamarca', 'Tibirita'),
('25815', '25', '815', 'Cundinamarca', 'Tocaima'),
('25817', '25', '817', 'Cundinamarca', 'Tocancipá'),
('25823', '25', '823', 'Cundinamarca', 'Topaipí'),
('25839', '25', '839', 'Cundinamarca', 'Ubalá'),
('25841', '25', '841', 'Cundinamarca', 'Ubaque'),
('25843', '25', '843', 'Cundinamarca', 'Ubaté'),
('25845', '25', '845', 'Cundinamarca', 'Une'),
('25851', '25', '851', 'Cundinamarca', 'Útica'),
('25506', '25', '506', 'Cundinamarca', 'Venecia (Ospina Pérez)'),
('25862', '25', '862', 'Cundinamarca', 'Vergara'),
('25867', '25', '867', 'Cundinamarca', 'Vianí'),
('25871', '25', '871', 'Cundinamarca', 'Villagómez'),
('25873', '25', '873', 'Cundinamarca', 'Villapinzón'),
('25875', '25', '875', 'Cundinamarca', 'Villeta'),
('25878', '25', '878', 'Cundinamarca', 'Viotá'),
('25885', '25', '885', 'Cundinamarca', 'Yacopí'),
('25898', '25', '898', 'Cundinamarca', 'Zipacón'),
('25899', '25', '899', 'Cundinamarca', 'Zipaquirá')
ON CONFLICT (codigo_completo) DO NOTHING;

-- 15.3 Plantillas de Requisitos Maestros (Fases 1 a 7)
INSERT INTO plantillas_requisito (fase, codigo_requisito, nombre, descripcion, es_obligatorio, formato_esperado, orden, orientacion_tecnica) VALUES
-- Fase 1
(1, 'F1-01', 'Cédula de Ciudadanía del Titular', 'Fotocopia legible por ambas caras al 150% del documento de identidad del postulante titular.', true, 'PDF', 1, 'Verificar vigencia y concordancia con bases de datos de Registraduría.'),
(1, 'F1-02', 'Certificado de Tradición y Libertad / Escritura', 'Certificado de matrícula inmobiliaria con expedición no mayor a 30 días o escritura pública que demuestre posesión o propiedad.', true, 'PDF', 2, 'El predio no debe poseer embargos, hipotecas ni gravámenes que limiten la titulación.'),
(1, 'F1-03', 'Certificado de Afiliación a Compensar o Sisbén', 'Constancia de afiliación activa a la Caja de Compensación Compensar o ficha técnica de clasificación Sisbén IV.', true, 'PDF', 3, 'Para caja de compensación se requiere encontrarse en estado activo cotizante o beneficiario.'),
-- Fase 2
(2, 'F2-01', 'Documentos de Identidad del Grupo Familiar', 'Cédulas de ciudadanía, tarjetas de identidad o registros civiles de todos los integrantes del hogar postulante.', true, 'PDF', 1, 'Revisar legibilidad de fechas de nacimiento y firmas.'),
(2, 'F2-02', 'Certificado de Ingresos del Hogar', 'Certificados laborales, colillas de pago o certificado de ingresos suscrito ante contador público.', true, 'PDF', 2, 'Ingresos totales del hogar no superiores a 4 SMMLV.'),
(2, 'F2-03', 'Registro Civil de Matrimonio o Declaración de Unión Marital', 'Acreditación del estado civil de la pareja postulante o declaración extrajuicio de convivencia.', true, 'PDF', 3, 'Convivencia demostrable mínima según marco normativo.'),
(2, 'F2-04', 'Declaración Juramentada de No Posesión de Otra Vivienda', 'Manifestación formal bajo gravedad de juramento de no ser propietarios de ningún otro inmueble en el territorio nacional.', true, 'PDF', 4, 'Firmada ante notario o juez de paz.'),
(2, 'F2-05', 'Certificado de Discapacidad (si aplica)', 'Dictamen médico o certificación RLCPD emitida por EPS o Secretaría de Salud.', false, 'PDF', 5, 'Opcional según condición médica del hogar.'),
(2, 'F2-06', 'Certificación de Cuenta Bancaria / Ahorro Programado', 'Certificación bancaria que acredite disponibilidad del aporte o recursos complementarios.', true, 'PDF', 6, 'Cuenta habilitada para desembolso del 10%.'),
(2, 'F2-07', 'Certificado de Residencia Rural Municipal', 'Constancia de arraigo y permanencia en la zona rural expedida por la alcaldía municipal o inspección de policía.', true, 'PDF', 7, 'Antigüedad mínima de residencia certificada.'),
(2, 'F2-08', 'Formato de Consentimiento Informado y Habeas Data', 'Autorización expresa para consulta en centrales de riesgo y tratamiento de información personal.', true, 'PDF', 8, 'Firmada por todos los miembros mayores de edad.'),
(2, 'F2-11', 'Registro Fotográfico del Predio Rural', 'Mínimo 6 fotografías a color del predio (vías de acceso, linderos, topografía y entorno).', true, 'JPG', 9, 'Subir fotografías georreferenciadas legibles.'),
-- Fase 3
(3, 'F3-01', 'Oficio Remisorio para Concepto de Viabilidad Inicial', 'Carta formal de presentación y remisión suscrita por Franco Osorio Investment ante Compensar.', true, 'PDF', 1, 'Documento de radicación formal.'),
(3, 'F3-02', 'Formulario Único Radicado Compensar', 'Formulario con sello oficial de radicación y número de expediente asignado por la Caja.', true, 'PDF', 2, 'Verificar consecutivo radicado.'),
(3, 'F3-03', 'Concepto Técnico y Jurídico Favorable Compensar', 'Oficio de aprobación inicial emitido por el comité técnico de vivienda de Compensar.', true, 'PDF', 3, 'Aval para formular proyectos.'),
-- Fase 4
(4, 'F4-01', 'Levantamiento Topográfico y Planimetría Predial', 'Plano georreferenciado con coordenadas MAGNA-SIRGAS, curvas de nivel y polígono del lote.', true, 'PDF', 1, 'Firmado por topógrafo matriculado.'),
(4, 'F4-02', 'Estudio Geotécnico y Mecánica de Suelos', 'Informe geotécnico con sondeos, capacidad portante y recomendaciones de cimentación según NSR-10.', true, 'PDF', 2, 'Firmado por ingeniero civil especialista.'),
(4, 'F4-03', 'Planos Arquitectónicos y Distribución Espacial', 'Plantas, cortes, fachadas y detalles constructivos firmados por arquitecto matriculado.', true, 'PDF', 3, 'Cumplimiento de habitabilidad rural.'),
(4, 'F4-04', 'Cálculo Estructural y Memorias NSR-10', 'Memorias de cálculo sismorresistente con especificaciones de refuerzo y concreto bajo normativa NSR-10.', true, 'PDF', 4, 'Firma y matrícula estructural.'),
(4, 'F4-05', 'Planos Hidrosanitarios y Sistema Séptico', 'Diseño de redes de suministro de agua potable, desagües y pozo séptico rural con campo de infiltración.', true, 'PDF', 5, 'Cumplimiento RAS rural.'),
(4, 'F4-06', 'Diseño Eléctrico RETIE y Cuadro de Cargas', 'Planos eléctricos de iluminación, tomacorrientes y sistema de puesta a tierra certificado por ingeniero electricista.', true, 'PDF', 6, 'Cumplimiento norma RETIE.'),
-- Fase 5
(5, 'F5-01', 'Presupuesto Oficial y APU Detallado', 'Análisis de Precios Unitarios regionalizado Cundinamarca y presupuesto oficial de obra.', true, 'PDF', 1, 'Precios unitarios vigentes.'),
(5, 'F5-02', 'Formulario Único Nacional para Solicitud de Licencia', 'Formulario debidamente diligenciado y radicado ante planeación municipal o curaduría.', true, 'PDF', 2, 'Modalidad obra nueva rural.'),
(5, 'F5-03', 'Radicado Oficial ante Planeación Municipal o Curaduría', 'Acta formal de radicación con número consecutivo de expediente municipal.', true, 'PDF', 3, 'Acta de radicación formal.'),
(5, 'F5-04', 'Valla de Trámite o Notificación Vecinal', 'Constancia fotográfica de fijación de la valla informativa del trámite de licencia en el predio.', true, 'PDF', 4, 'Registro fotográfico fehaciente.'),
(5, 'F5-05', 'Acto Administrativo de Licencia de Construcción Ejecutoriada', 'Resolución de otorgamiento de la licencia con constancia de ejecutoria legal.', true, 'PDF', 5, 'Licencia en firme y vigente.'),
-- Fase 6
(6, 'F6-01', 'Formulario de Postulación al Subsidio Familiar de Vivienda Rural', 'Formulario oficial de postulación suscrito por los miembros del hogar con firma y huella.', true, 'PDF', 1, 'Formato oficial de Compensar.'),
(6, 'F6-02', 'Certificación de Cierre Financiero y Aporte del 10%', 'Documento que acredita la conformación de los recursos totales (subsidio + aporte propio o municipal).', true, 'PDF', 2, 'Disponibilidad de fondos.'),
(6, 'F6-03', 'Certificado de Elegibilidad Emitido por Entidad Evaluadora', 'Certificación de cumplimiento integral de los requisitos normativos del programa.', true, 'PDF', 3, 'Evaluación integral aprobada.'),
(6, 'F6-04', 'Carta de Asignación y Resolución de Subsidio Compensar', 'Resolución formal de asignación de recursos del subsidio expedida por Compensar.', true, 'PDF', 4, 'Número y fecha de resolución oficial.'),
-- Fase 7
(7, 'F7-01', 'Acta de Recibo a Satisfacción de Vivienda', 'Firma formal de recepción de la vivienda terminada al 100% por el beneficiario y la supervisión técnica.', true, 'PDF', 1, 'Firma conjunta con beneficiario.'),
(7, 'F7-02', 'Certificación de Habitabilidad y Servicios', 'Constancia técnica de servicios públicos domiciliarios activos y plenas condiciones higiénico-sanitarias.', true, 'PDF', 2, 'Servicios básicos funcionales.'),
(7, 'F7-03', 'Registro Fotográfico de Entrega de Llaves', 'Acto solemne de entrega de llaves al hogar beneficiario con evidencia fotográfica en alta resolución.', true, 'JPG', 3, 'Registro fotográfico oficial.'),
(7, 'F7-04', 'Acta de Liquidación y Archivo Documental', 'Liquidación contractual y financiera de la obra, paz y salvo final y consolidación documental definitiva.', true, 'PDF', 4, 'Cierre técnico y financiero.')
ON CONFLICT (codigo_requisito) DO UPDATE SET
    nombre = EXCLUDED.nombre,
    descripcion = EXCLUDED.descripcion,
    es_obligatorio = EXCLUDED.es_obligatorio,
    formato_esperado = EXCLUDED.formato_esperado,
    orden = EXCLUDED.orden,
    orientacion_tecnica = EXCLUDED.orientacion_tecnica;

-- ============================================================================
-- 16. POLÍTICAS DE ROW LEVEL SECURITY (RLS) UNIVERSALES E IDEMPOTENTES
-- ============================================================================
-- Habilita RLS en todas las tablas del esquema 'public' y otorga permisos completos
-- tanto para el rol de servicio administrativo (service_role) como para 'anon' y 'authenticated'.
DO $$ 
DECLARE 
    tabla record;
BEGIN 
    FOR tabla IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tabla.tablename);
        EXECUTE format('DROP POLICY IF EXISTS "Acceso total CRM VRD" ON public.%I;', tabla.tablename);
        EXECUTE format('
            CREATE POLICY "Acceso total CRM VRD" 
            ON public.%I 
            FOR ALL 
            TO anon, authenticated 
            USING (true) 
            WITH CHECK (true);', tabla.tablename);
    END LOOP; 
END $$;

-- ============================================================================
-- 17. CONFIGURACIÓN DEL BUCKET Y POLÍTICAS DE ALMACENAMIENTO (SUPABASE STORAGE)
-- ============================================================================

-- Crear / actualizar el bucket 'expedientes-archivos' con 25MB y tipos autorizados
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'expedientes-archivos',
    'expedientes-archivos',
    true,
    26214400, -- 25 MB
    ARRAY['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 26214400,
    allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

-- Políticas de acceso para Supabase Storage
DROP POLICY IF EXISTS "Acceso total lectura expedientes-archivos" ON storage.objects;
DROP POLICY IF EXISTS "Acceso total subida expedientes-archivos" ON storage.objects;
DROP POLICY IF EXISTS "Acceso total actualizacion expedientes-archivos" ON storage.objects;
DROP POLICY IF EXISTS "Acceso total eliminacion expedientes-archivos" ON storage.objects;

CREATE POLICY "Acceso total lectura expedientes-archivos"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'expedientes-archivos');

CREATE POLICY "Acceso total subida expedientes-archivos"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'expedientes-archivos');

CREATE POLICY "Acceso total actualizacion expedientes-archivos"
ON storage.objects FOR UPDATE
TO anon, authenticated
USING (bucket_id = 'expedientes-archivos')
WITH CHECK (bucket_id = 'expedientes-archivos');

CREATE POLICY "Acceso total eliminacion expedientes-archivos"
ON storage.objects FOR DELETE
TO anon, authenticated
USING (bucket_id = 'expedientes-archivos');

-- ============================================================================
-- FIN DEL SCRIPT DE INSTALACIÓN — CRM VIVIENDA RURAL DIGNA (VRD)
-- ============================================================================
