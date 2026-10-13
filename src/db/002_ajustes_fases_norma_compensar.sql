-- ============================================================================
-- CRM VIVIENDA RURAL DIGNA — FRANCO OSORIO INVESTMENT S.A.S.
-- MIGRACIÓN 002: AJUSTES EN PLANTILLAS DE REQUISITOS (NORMA COMPENSAR)
-- Y ORDEN ESTRICTO DE 28 DOCUMENTOS PARA FASE 6 (POSTULACIÓN)
-- ============================================================================

-- 1. ELIMINACIÓN DE FICHA SOCIOECONÓMICA Y SISBÉN IV EN FASE 1
-- Según directriz Compensar, no se exige Ficha de Caracterización Socioeconómica ni Sisbén IV.
DELETE FROM plantillas_requisito 
WHERE fase = 1 AND (
    codigo_requisito = 'F1-03' 
    OR LOWER(nombre) LIKE '%sisbén%' 
    OR LOWER(nombre) LIKE '%sisben%' 
    OR LOWER(nombre) LIKE '%caracterización%'
    OR LOWER(nombre) LIKE '%caracterizacion%'
);

-- 2. SEPARACIÓN EN FASE 1: TRADICIÓN Y LIBERTAD vs ESCRITURA PÚBLICA
-- Actualizar F1-01 para ser exclusivamente Certificado de Tradición y Libertad
UPDATE plantillas_requisito
SET 
    codigo_requisito = 'F1-01',
    nombre = 'Certificado de Tradición y Libertad',
    descripcion = 'Certificado de matrícula inmobiliaria expedido por la ORIP con vigencia no mayor a 90 días calendario respecto a la revisión. Debe registrar el folio de matrícula.',
    orden = 1,
    orientacion_tecnica = 'Verificar que el predio no cuente con embargos, hipotecas activas ni gravámenes que limiten la titulación.'
WHERE codigo_requisito = 'F1-01' OR (fase = 1 AND LOWER(nombre) LIKE '%tradición%');

-- Insertar o actualizar F1-02 como Escritura Pública independiente
INSERT INTO plantillas_requisito (fase, codigo_requisito, nombre, descripcion, es_obligatorio, formato_esperado, orden, orientacion_tecnica)
VALUES (
    1, 
    'F1-02', 
    'Escritura Pública', 
    'Copia de la escritura pública del predio, resolución administrativa de adjudicación o título de sana posesión debidamente protocolizado con número y fecha correspondiente.', 
    true, 
    'PDF', 
    2, 
    'Debe estar completamente separado del Certificado de Tradición y Libertad. Verificar número de escritura, notaría y fecha.'
)
ON CONFLICT (codigo_requisito) DO UPDATE 
SET 
    nombre = EXCLUDED.nombre,
    descripcion = EXCLUDED.descripcion,
    orden = EXCLUDED.orden,
    orientacion_tecnica = EXCLUDED.orientacion_tecnica;

-- Ajustar F1-03 Impuesto Predial y F1-04 Cédula del Titular en Fase 1
INSERT INTO plantillas_requisito (fase, codigo_requisito, nombre, descripcion, es_obligatorio, formato_esperado, orden, orientacion_tecnica)
VALUES 
(
    1, 
    'F1-03', 
    'Impuesto Predial Unificado', 
    'Último recibo o paz y salvo del impuesto predial unificado correspondiente a la vigencia del año en curso.', 
    true, 
    'PDF', 
    3, 
    'Vigencia del año en curso. Aceptado pagado o con acuerdo de pago.'
),
(
    1, 
    'F1-04', 
    'Cédula de Ciudadanía del Postulante', 
    'Fotocopia legible por ambas caras al 150% del documento de identidad del postulante titular.', 
    true, 
    'PDF', 
    4, 
    'Verificar plena coincidencia con las bases de datos de Registraduría.'
)
ON CONFLICT (codigo_requisito) DO UPDATE 
SET 
    nombre = EXCLUDED.nombre,
    descripcion = EXCLUDED.descripcion,
    orden = EXCLUDED.orden,
    orientacion_tecnica = EXCLUDED.orientacion_tecnica;

-- 3. SEPARACIÓN EN FASE 2: DISPONIBILIDAD DE AGUA vs DISPONIBILIDAD DE ENERGÍA
INSERT INTO plantillas_requisito (fase, codigo_requisito, nombre, descripcion, es_obligatorio, formato_esperado, orden, orientacion_tecnica)
VALUES 
(
    2, 
    'F2-09', 
    'Certificado de Disponibilidad de Agua', 
    'Certificación o factura de disponibilidad del servicio público de acueducto o agua veredal, expedida por la empresa prestadora o Junta Administradora con vigencia no superior a 90 días.', 
    true, 
    'PDF', 
    9, 
    'Completamente separado del recibo de energía. Vigencia máxima 90 días.'
),
(
    2, 
    'F2-10', 
    'Certificado de Disponibilidad de Energía', 
    'Constancia de disponibilidad del servicio de energía eléctrica o factura reciente del operador de red con vigencia no superior a 90 días.', 
    true, 
    'PDF', 
    10, 
    'Completamente separado del recibo de agua. Vigencia máxima 90 días.'
)
ON CONFLICT (codigo_requisito) DO UPDATE 
SET 
    nombre = EXCLUDED.nombre,
    descripcion = EXCLUDED.descripcion,
    orden = EXCLUDED.orden,
    orientacion_tecnica = EXCLUDED.orientacion_tecnica;

-- 4. ESPECIFICACIÓN TÉCNICA OBLIGATORIA PARA PLANOS DEL PROYECTO (FASES 4 Y 6)
UPDATE plantillas_requisito
SET 
    descripcion = 'Juego técnico integral de planos del proyecto. NOTA OBLIGATORIA: El paquete se conforma obligatoriamente de: 1. Planos estructurales, 2. Planos arquitectónicos, 3. Plano de implantación, 4. Planos eléctricos y 5. Planos hidrosanitarios.',
    orientacion_tecnica = 'Se debe validar la inclusión de los 5 tipos de planos técnicos: estructurales, arquitectónicos, implantación, eléctricos e hidrosanitarios.'
WHERE (fase IN (4, 5, 6) AND LOWER(nombre) LIKE '%planos%');

-- 5. CATÁLOGO SECUENCIAL ESTRICTO DE LOS 28 DOCUMENTOS PARA FASE 6 (POSTULACIÓN COMPENSAR)
-- Borrar anteriores plantillas de Fase 6 para imponer el orden oficial 1 a 28
DELETE FROM plantillas_requisito WHERE fase = 6;

INSERT INTO plantillas_requisito (fase, codigo_requisito, nombre, descripcion, es_obligatorio, formato_esperado, orden, orientacion_tecnica) VALUES
(6, 'F6-01', 'Datos del proyecto ANEXO DOC', 'Ficha y anexo técnico con los datos consolidados del proyecto de vivienda rural.', true, 'PDF', 1, 'Documento inicial oficial del proyecto.'),
(6, 'F6-02', 'Formulario de postulación diligenciado', 'Formulario oficial de postulación al subsidio familiar suscrito por el hogar con firma y huella.', true, 'PDF', 2, 'Verificar firmas y huellas de todos los integrantes mayores de edad.'),
(6, 'F6-03', 'Documentos de identidad del grupo familiar', 'Cédulas de ciudadanía al 150%, tarjetas de identidad y registros civiles de los integrantes del hogar.', true, 'PDF', 3, 'Legibilidad al 100% por ambas caras.'),
(6, 'F6-04', 'Certificado de ingresos o certificado laboral', 'Certificación laboral vigente (no mayor a 30 días) o colillas de nómina para asalariados.', true, 'PDF', 4, 'Indica cargo, salario, antigüedad y tipo de vinculación.'),
(6, 'F6-05', 'Paquete Contador (independientes: antecedentes, cédula y tarjeta profesional)', 'Certificación de ingresos suscrita por contador público con antecedentes vigentes y tarjeta profesional.', true, 'PDF', 5, 'Para independientes. Certificado de la JCC vigente.'),
(6, 'F6-06', 'Constancia de independientes', 'Declaración formal o extrajuicio de la actividad comercial o agropecuaria independiente.', true, 'PDF', 6, 'Acredita actividad económica lícita.'),
(6, 'F6-07', 'Certificado de ahorro (cesantías, preaprobado, aprobado, CDT, subsidios complementarios, cuenta bancaria con saldo)', 'Certificación bancaria que acredite disponibilidad del recurso de cierre financiero y aporte del hogar.', true, 'PDF', 7, 'Cuenta inmovilizada o saldo disponible.'),
(6, 'F6-08', 'Documento civil (registro civil matrimonio, extrajuicio)', 'Acreditación del estado civil del hogar (registro civil de matrimonio o unión marital de hecho).', true, 'PDF', 8, 'Acredita conformación del hogar.'),
(6, 'F6-09', 'Certificado de tradición y libertad (con número de matrícula)', 'Certificado de tradición y libertad con número de matrícula inmobiliaria expedido dentro de los 90 días.', true, 'PDF', 9, 'Vigencia menor a 90 días. Matrícula visible.'),
(6, 'F6-10', 'Escritura, Resolución o sana posesión (con número o fecha correspondiente)', 'Título de propiedad, escritura pública, resolución de adjudicación o sana posesión. SEPARADO DE TRADICIÓN.', true, 'PDF', 10, 'Debe quedar en archivo separado de tradición y libertad.'),
(6, 'F6-11', 'Impuesto predial (año en curso)', 'Comprobante de pago o paz y salvo del impuesto predial unificado de la vigencia del año en curso.', true, 'PDF', 11, 'Vigencia obligatoria del año en curso.'),
(6, 'F6-12', 'Presupuesto (PDF firmado)', 'Presupuesto consolidado oficial de obra firmado en PDF por el profesional competente.', true, 'PDF', 12, 'Verificar firma y matrícula profesional.'),
(6, 'F6-13', 'Memoria de cantidades', 'Desglose detallado de cantidades de obra y cómputos métricos por capítulos constructivos.', true, 'PDF', 13, 'Cálculo de materiales y unidades.'),
(6, 'F6-14', 'Especificaciones técnicas', 'Manual de especificaciones constructivas y calidades de materiales según NSR-10.', true, 'PDF', 14, 'Detalle constructivo de acabados y estructura.'),
(6, 'F6-15', 'Acta y registro fotográfico', 'Registro fotográfico nítido y acta técnica de inspección del terreno y linderos del predio.', true, 'PDF', 15, 'Fotografías a color de entorno y lote.'),
(6, 'F6-16', 'Planos de intervención (Sellados)', 'Planos de intervención en predio debidamente sellados por la autoridad municipal o curaduría.', true, 'PDF', 16, 'Sellos oficiales legibles.'),
(6, 'F6-17', 'Licencia de construcción (con número de resolución)', 'Acto administrativo de otorgamiento de la licencia urbanística con número de resolución y constancia de ejecutoria.', true, 'PDF', 17, 'Resolución municipal ejecutoriada.'),
(6, 'F6-18', 'Planos aprobados', 'Juego de planos aprobados. NOTA OBLIGATORIA: Deben incluir: estructurales, arquitectónicos, implantación, eléctricos e hidrosanitarios.', true, 'PDF', 18, 'Paquete de 5 especialidades de planos.'),
(6, 'F6-19', 'Nomenclatura (vigencia año en curso)', 'Certificado oficial de nomenclatura expedido por la alcaldía municipal con vigencia del año en curso.', true, 'PDF', 19, 'Vigencia año en curso.'),
(6, 'F6-20', 'Certificado de uso de suelo individual (vigencia año en curso)', 'Concepto de uso del suelo expedido por planeación municipal con vigencia del año en curso.', true, 'PDF', 20, 'Vigencia año en curso.'),
(6, 'F6-21', 'Certificado de riesgo individual (vigencia año en curso)', 'Certificación de no riesgo ni amenaza no mitigable expedida en el año en curso.', true, 'PDF', 21, 'Vigencia año en curso.'),
(6, 'F6-22', 'Certificado de No habitabilidad o demolición objeto de postulación (Si aplica)', 'Dictamen técnico de inhabitabilidad de la vivienda actual o autorización de demolición (si aplica).', false, 'PDF', 22, 'Aplica para sustitución o predio en riesgo.'),
(6, 'F6-23', 'Formato de transporte (expedido por nuestra interventoría)', 'Certificación oficial de transporte y acarreo de materiales expedida por nuestra interventoría.', true, 'PDF', 23, 'Firma de la interventoría técnica.'),
(6, 'F6-24', 'Contrato', 'Contrato de obra o mandato suscrito entre el hogar postulante y el constructor / operador.', true, 'PDF', 24, 'Firmado por las partes.'),
(6, 'F6-25', 'Servicios públicos (vigencia no superior a 90 días)', 'Disponibilidad de agua y energía con vigencia no superior a 90 días (archivos separados).', true, 'PDF', 25, 'Vigencia no superior a 90 días.'),
(6, 'F6-26', 'Arraigo (si lo requiere)', 'Certificado de arraigo y permanencia en el territorio rural (si es requerido por el municipio).', false, 'PDF', 26, 'Expedido por alcaldía o junta comunal.'),
(6, 'F6-27', 'Excel presupuesto', 'Archivo en formato de hoja de cálculo Excel (.xlsx) con el presupuesto detallado y análisis de precios unitarios.', true, 'XLSX', 27, 'Archivo nativo en Excel con fórmulas.'),
(6, 'F6-28', 'Anexo (CONSTANCIA)', 'Constancia final institucional y anexo de cierre documental para entrega ante Compensar.', true, 'PDF', 28, 'Constancia de radicación formal.');

-- 6. AUDITORÍA
INSERT INTO auditoria_admin (admin_id, admin_nombre, accion, detalle, categoria)
SELECT 
    id, 
    nombre_completo, 
    'MIGRACION_NORMA_COMPENSAR_FASE6', 
    'Actualización de plantillas de requisitos según norma Compensar: supresión Sisbén, separación Tradición/Escritura y Agua/Energía, y fijación estricta de 28 documentos en Fase 6.',
    'configuracion'
FROM perfiles_usuario
WHERE rol = 'administrador'
LIMIT 1;
