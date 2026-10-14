# Reestructuración Integral de Fase 5: Vista Única y Checklist de 15 Documentos de Licenciamiento

Modernización y unificación de la Fase 5 (Trámite de Licencia de Construcción ante Curaduría / Planeación Municipal) para consolidar en una sola pantalla, sin navegaciones secundarias ni modales paso a paso, la carga, verificación y gestión de los 15 documentos oficiales exigidos, integrando la radicación oficial y el soporte técnico para archivos pesados.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> **Decisiones Confirmadas con el Usuario en Fase 1:**
> - **Memoria de Cantidades (Item 12)**: Se presenta en una sola fila compacta con dos zonas/botones independientes de carga claramente diferenciados (Versión Excel `.xlsx/.xls` y Versión PDF `.pdf`).
> - **Integración de Radicación Oficial**: Los campos de radicado oficial (Número de Radicado, Fecha, Entidad Municipal y Soporte) conviven directamente en la misma pantalla junto a la lista documental tipo checklist, eliminando pantallas intermedias.
> - **Archivos Técnicos Extensos (Item 14 - Estudio de Suelos >80 págs)**: Soporte técnico para archivos pesados sin límite rígido, con barra de progreso de carga en tiempo real y visor interno optimizado para paginación fluida.
> - **Restricción de Integridad de Datos**: Se preserva íntegra la información existente en las tablas de expedientes y base de datos, estructurando el catálogo de Fase 5 de forma compatible hacia atrás.

---

## 1. Overview & Core Concept

- **Qué hace**: Proporciona a los ingenieros civiles, supervisores y administradores un centro de control unificado para la Fase 5. En una sola vista tipo checklist, el equipo gestiona los 15 documentos técnicos y jurídicos requeridos para la radicación de la licencia de construcción, supervisa el cumplimiento obligatorio y registra los datos de radicación municipal y resolución final aprobatoria.
- **Público Objetivo**: Rol Ingeniería (gestor directo de la radicación y memorias técnicas), Rol Supervisor (auditoría técnica y validación documental) y Rol Administrador.
- **Valor Principal**: Elimina la dispersión en múltiples pantallas, modales complejos o redirecciones externas, permitiendo que la recolección, revisión y radicación municipal de la licencia se audite en un solo golpe de vista de alta densidad y precisión técnica.

---

## 2. User Experience & Visual Design

### A. Estructura de la Vista Única
La interfaz de Fase 5 se organiza en tres bloques complementarios desplegados verticalmente en una sola página fluida:

1. **Encabezado y Barra de Estado Unificada**:
   - Título del expediente y código visible (`DPMPP-CEDULA-APELLIDO`).
   - Estado oficial del trámite (Badge semántico: *Sin Radicar*, *Radicado — Pendiente Respuesta*, *Con Observaciones*, *Aprobada con Resolución*).
   - Barra de progreso global del checklist (ej. `12 de 15 documentos listos · 100% obligatorios`).
   - Botón de avance a Fase 6 condicionado a la aprobación y resolución de la licencia.

2. **Panel Integrado de Radicación y Seguimiento Municipal**:
   - Selector de Entidad Municipal (Curaduría o Secretaría de Planeación).
   - Entrada directa para Número de Radicado Oficial y Fecha de Radicación.
   - Zona para Número de Resolución Oficial y Fecha de Ejecutoria (cuando la licencia es aprobada).
   - Subsanaciones y observaciones históricas accesibles en línea en un panel colapsable sin salir de la vista.

3. **Checklist Central Unificado de 15 Documentos Oficiales**:
   - Cada fila cuenta con su número secuencial (01 a 15), nombre oficial, tipo de formato admitido, badge de obligatoriedad, estado de carga (*Pendiente*, *Cargado*, *Verificado*), botón de carga directa (o dropzone), botón de visualización rápida en visor interno, y botón de eliminación/reemplazo.
   - **Fila Especial 12 (Memoria de Cantidades)**: Tarjeta única con dos slots de carga lado a lado:
     - Slot A: Archivo Excel (`.xls`, `.xlsx`) con icono representativo verde y badge de cálculo.
     - Slot B: Archivo PDF (`.pdf`) con icono rojo y visualización de páginas.
   - **Fila Especial 14 (Estudio de Suelos)**: Componente con indicador de carga porcentual (`0%` a `100%`), cálculo de hash SHA-256 en cliente para archivos voluminosos y visor interno con memoria virtualizada.

### B. Jerarquía Visual y Paleta (60-30-10)
- **Fondo Neutro (60%)**: Slate ultra-claro (`#F8FAFC`) con contenedores blancos (`#FFFFFF`).
- **Superficies y Bordes (30%)**: Hairline borders `border-slate-200` y tipografía técnica `font-mono tabular-nums` para radicados, fechas y tamaños de archivo.
- **Acentos (10%)**: Azul institucional (`#2563EB`) para acciones de carga; Verde esmeralda (`#059669`) para estados aprobados/verificados; Ámbar (`#D97706`) para documentos obligatorios pendientes.

---

## 3. Key Product Decisions & Trade-Offs

- **Vista Única vs. Modales Paso a Paso**:
  - *Decisión*: Reemplazar los modales de apertura de radicación por controles directos en pantalla, manteniendo únicamente el Visor de Archivos en superposición para lectura inmersiva.
  - *Por qué*: Cumple la regla estricta de cero redirecciones y agiliza la labor de ingeniería cuando se cargan 15 archivos en una sola sesión de trabajo.
- **Modelo de Memoria de Cantidades con Doble Archivo**:
  - *Decisión*: Almacenar `soporteExcel` y `soportePdf` en la estructura de datos del documento 12, requiriendo ambos para considerar el item completado.
  - *Por qué*: Las curadurías y Compensar exigen simultáneamente la hoja de cálculo editable para auditoría de fórmulas y el PDF firmado por el profesional para validez legal.
- **Manejo de Archivos Pesados (>80 páginas)**:
  - *Decisión*: Endpoint multipart optimizado en Express con streaming directo hacia almacenamiento Supabase Storage / mock persistente, evitando límites de payload JSON `base64`.

---

## 4. Technical Architecture & Data Strategy

### Diagrama del Sistema y Jerarquía de Componentes

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Fase5SeguimientoLicencia                        │
│                           (Vista Única)                                │
├────────────────────────────────────────────────────────────────────────┤
│ 1. Header & Progress Bar                                               │
│    [Badge Estado]  [Progreso: X/15]  [Botón: Avanzar a Fase 6]         │
├────────────────────────────────────────────────────────────────────────┤
│ 2. Panel de Radicación Municipal (Inline)                              │
│    [Entidad Curaduría] [No. Radicado] [Fecha] [No. Resolución]         │
├────────────────────────────────────────────────────────────────────────┤
│ 3. Checklist Documental Unificado (15 Items)                           │
│    ┌──────────────────────────────────────────────────────────────┐    │
│    │ 01. Solicitud Licencia de Construcción (PDF)                 │    │
│    │ 02. Certificado de Tradición y Libertad (PDF)                │    │
│    │ 03. Formulario Único Nacional - FUN (PDF)                    │    │
│    │ 04. Poder (PDF)                                              │    │
│    │ 05. Certificación No Afectación Redes Eléctricas (PDF)        │    │
│    │ 06. Memorial Responsabilidad Diseño Arquitectónico (PDF)     │    │
│    │ 07. Memorial Responsabilidad Diseño Estructural (PDF)        │    │
│    │ 08. Memorial Responsabilidad Elementos No Estructurales (PDF) │    │
│    │ 09. Paquete Arquitecto Diseñador (PDF/Zip)                   │    │
│    │ 10. Paquete Constructor Responsable (PDF/Zip)                │    │
│    │ 11. Memoria de Cálculo Estructural (PDF)                     │    │
│    │ 12. Memoria de Cantidades [Slot Excel .xlsx] [Slot PDF .pdf] │    │
│    │ 13. Anexo 1 - Investigación Mínima (PDF)                     │    │
│    │ 14. Anexo 2 - Estudio de Suelos (>80 págs / Progreso)        │    │
│    │ 15. Anexo 3 - Informe Técnico de Cargas y Vientos (PDF)      │    │
│    └──────────────────────────────────────────────────────────────┘    │
│ 4. Historial y Observaciones de Subsanación (Colapsable Inline)        │
└────────────────────────────────────────────────────────────────────────┘
```

### Estructura de Datos (TypeScript & Backend)

1. **Catálogo Oficial de 15 Documentos (`src/types.ts`)**:
   - `SOLICITUD_LICENCIA`
   - `CERTIFICADO_TRADICION`
   - `FUN`
   - `PODER`
   - `CERTIFICACION_REDES_ELECTRICAS`
   - `MEMORIAL_DISENO_ARQUITECTONICO`
   - `MEMORIAL_DISENO_ESTRUCTURAL`
   - `MEMORIAL_ELEMENTOS_NO_ESTRUCTURALES`
   - `PAQUETE_ARQUITECTO`
   - `PAQUETE_CONSTRUCTOR`
   - `MEMORIA_CALCULO_ESTRUCTURAL`
   - `MEMORIA_CANTIDADES` (con `soporte` y `soporteSecundario` para Excel + PDF)
   - `ANEXO_1_INVESTIGACION_MINIMA`
   - `ANEXO_2_ESTUDIO_SUELOS`
   - `ANEXO_3_CARGAS_VIENTOS`

2. **Rutas y Endpoints en `server.ts`**:
   - `GET /api/expedientes/:id/fase5/documentos`: Obtiene la lista completa de los 15 documentos con sus estados y archivos cargados.
   - `POST /api/expedientes/:id/fase5/documentos/:docId/cargar`: Endpoint multipart para cargar archivos individuales (soporta PDF, Zip, Excel, Docx) con barra de progreso.
   - `DELETE /api/expedientes/:id/fase5/documentos/:docId`: Permite eliminar o reemplazar un archivo específico.
   - `POST /api/expedientes/:id/fase5/radicacion-inline`: Guarda inmediatamente número de radicado, entidad y fecha sin modales.
   - `POST /api/expedientes/:id/fase5/resolucion-inline`: Guarda número de resolución y vigencia para habilitar Fase 6.

---

## 5. Plan de Verificación y Criterios de Aceptación

1. **Prueba de Carga en Pantalla Única**: Verificar que los 15 documentos carguen en una sola tabla/checklist continuo sin abrir ventanas secundarias ni pestañas intermedias.
2. **Prueba de Memoria de Cantidades**: Confirmar que el item 12 exija y permita cargar tanto el archivo Excel como el PDF de manera independiente y que ambos se puedan inspeccionar en el visor.
3. **Prueba de Archivo Pesado (Estudio de Suelos)**: Cargar un documento extenso y validar la respuesta del indicador de progreso.
4. **Verificación de Compilación y Calidad**: Ejecutar `lint_applet` y `compile_applet` asegurando cero errores de tipos TypeScript.
