# Plan de Solución: Corrección Integral de Carga de Archivos, Requisitos de Fase 1 y Sincronización Supabase

Plan de contingencia y corrección de fondo para resolver los problemas de confusión en la carga de archivos, alteración o desajuste de nombres, aparición de requisitos/espacios indebidos de cédulas para personas no registradas en el hogar, falta de actualización inmediata en el visor y fallas intermitentes en la sincronización con Supabase.

---

### Diagnóstico de Causas Raíz

A partir de la inspección detallada del código fuente (`server.ts`, `src/App.tsx`, `src/types.ts` y esquemas de base de datos) y de las respuestas del usuario, se identificaron cuatro causas estructurales:

1. **Requisitos Huérfanos y Discrepancias de Fase 1 (`F1-01`, `F1-02`, `F1-03`)**:
   - En `server.ts` (línea 320), la función `inicializarRequisitosFase1` creaba `F1-02` como "Escritura Pública", mientras que en la conversión del interesado (línea 2803) y en las plantillas oficiales se generaba `F1-02` como "Impuesto Predial Unificado". 
   - Cuando se agregaba un integrante familiar mientras el expediente estaba en Fase 1, el endpoint `/api/expedientes/:id/hogar/agregar-cedula` generaba dinámicamente un requisito `F1-03` para dicho integrante (o personas con IDs temporales), colisionando con el requisito `F1-03` exclusivo de la Cédula del Postulante Principal.
   - Si se eliminaban integrantes o se cancelaba su registro, el requisito en `mockDb.requisitosCaso` quedaba huérfano en memoria o en la base de datos, mostrándose como un espacio de archivo vacío o asignado a personas inexistentes.

2. **Inconsistencia al Reemplazar Archivos y Detección de Códigos**:
   - Al cargar un archivo en `/api/expedientes/:id/requisitos/:reqId/subir`, la búsqueda del requisito usaba expresiones regulares (`F\d+-\d+`) que, al recibir un ID compuesto o duplicado, podían asociar el archivo a otro requisito homónimo con diferente `personaId`, provocando que el documento "cambiara de nombre" o apareciera en la casilla equivocada.
   - En `App.tsx`, tras una carga exitosa, se dependía de una re-consulta asíncrona sin invalidación de caché reactiva inmediata para el modal visor, de modo que si el visor estaba abierto o se reabría, los datos en memoria del cliente aún tenían la URL o versión anterior.

3. **Fallas Intermitentes del Botón "Sincronizar"**:
   - Si el expediente no existía previamente en Supabase con su UUID canónico (o había sido creado localmente por fallas de RLS con la anon key), el comando `UPDATE` en Supabase afectaba 0 filas sin emitir un error explícito hacia el frontend.
   - Al no retornar confirmación clara y no recargar el detalle del expediente actualmente abierto (`expedienteSeleccionadoId`), la vista del usuario parecía congelada y no reflejaba ningún cambio visual.

---

### Decisiones Críticas Confirmadas

> [!IMPORTANT]
> **Decisiones acordadas según las respuestas del usuario:**
> - **Área focalizada**: Fase 1 (documentos del postulante y predio).
> - **Comportamiento ante personas no registradas**: Limpieza automática y preventiva de requisitos huérfanos o duplicados. Solo las personas activamente registradas en el hogar (y el postulante titular) pueden tener casilla de documento.
> - **Comportamiento del Visor**: Refresco inmediato atómico de la entidad de documento, con invalidación de caché (`?t=timestamp`) tanto en el cliente como en el backend.

---

### 1. Alcance y Objetivos de la Solución

```
┌────────────────────────────────────────────────────────────────────────┐
│                        ARQUITECTURA DE LA SOLUCIÓN                     │
└────────────────────────────────────────────────────────────────────────┘

 [Frontend / Usuario]
        │
        ├─► 1. Carga de Archivo (Fase 1: Tradición, Predial, Cédula Postulante)
        │        │
        │        ▼
 [API Express (server.ts)]
        │   • Sanitización previa: Purga de requisitos huérfanos F1
        │   • Búsqueda unívoca por ID exacto de requisito (no solo por regex)
        │   • Generación inmutable de versión con anti-caché timestamped
        │   • Persistencia garantizada en PostgreSQL (Supabase Admin)
        │        │
        │        ▼
 [Supabase PostgreSQL & Storage] ◄──── Sincronización bidireccional limpia
        │
        ▼
 [Refresco React Atómico (App.tsx)]
        │   • Actualización de estado del detalle del expediente en memoria
        │   • Limpieza de casillas huérfanas en la vista
        │   • Recarga instantánea del visor con la nueva URL y miniaturas
```

---

### 2. Especificación Técnica de Cambios

#### A. Unificación y Limpieza de Requisitos de Fase 1 (`server.ts`)
1. **Estandarización de `F1-01`, `F1-02` y `F1-03`**:
   - `F1-01`: Certificado de Tradición y Libertad (asociado al `predioId`).
   - `F1-02`: Impuesto Predial Unificado (asociado al `predioId`).
   - `F1-03`: Cédula del Postulante Principal (asociado exclusivamente al `postulante.id`).
2. **Función de Limpieza y Saneamiento Automático (`limpiarRequisitosHuerfanosExpediente`)**:
   - Al cargar el detalle (`GET /api/expedientes/:id`), al sincronizar (`/api/sync`) y antes de subir cualquier archivo:
     - Remover de Fase 1 cualquier requisito `F1-03` que no corresponda al ID del postulante titular actual.
     - Remover cualquier requisito con `personaId` que no figure en los integrantes del hogar (`exp.hogar.integrantes`).
     - Asegurar que no existan casillas duplicadas para el mismo código y persona.
3. **Control en `agregar-cedula`**:
   - Cuando se agrega un integrante al hogar en Fase 1, el requisito de cédula se debe crear bajo la nomenclatura de Fase 2 (`F2-04` o identificado como integrante secundario), para no sobreescribir ni duplicar el espacio de la cédula del titular en Fase 1.

#### B. Refresco Reactivo Inmediato del Visor y Estado de Archivo (`App.tsx`)
1. **Invalidación Activa de Caché**:
   - Actualizar el estado local de `detalleExp` directamente con la versión devuelta por el servidor (`201 Created` con el objeto `documento` y `versionActual`), sin esperar exclusivamente al re-fetch general.
   - Si el visor modal está abierto o si el usuario hace clic inmediatamente en "Ver", suministrar la URL con timestamp fresco para evitar que el navegador muestre una versión en caché.
2. **Despliegue Limpio de Casillas en Fase 1**:
   - En la vista de requisitos de Fase 1, garantizar que solo se rendericen exactamente los requisitos correspondientes a los documentos vigentes del predio y del titular, filtrando en el render cualquier elemento anómalo.

#### C. Robustecimiento del Botón de Sincronizar (`/api/sync` y `App.tsx`)
1. **Ejecución y Feedback Transparente**:
   - En `/api/sync`, asegurar que si el expediente seleccionado está abierto, la respuesta no solo devuelva el listado de expedientes sino que notifique la recarga del detalle activo.
   - En el frontend, `handleSincronizarManual` actualizará inmediatamente el detalle del expediente en pantalla mediante `cargarDetalleExpediente(expedienteSeleccionadoId)` garantizando que el usuario vea reflejada la última versión de sus archivos al instante.
   - Manejo de reintentos y mensajes explícitos en caso de que las políticas de RLS de Supabase requieran ajuste de credenciales.

---

### 3. Plan de Verificación

1. **Prueba de Creación y Carga en Fase 1**:
   - Crear un expediente desde un interesado o abrir uno existente en Fase 1.
   - Verificar que aparezcan estrictamente 3 casillas de Fase 1: Certificado de Tradición y Libertad, Impuesto Predial y Cédula del Postulante.
   - Subir archivos PDF a cada una de las 3 casillas y comprobar que:
     - El nombre del archivo se conserve fielmente.
     - El botón de visor abra de inmediato el documento correcto.
     - El estado cambie a "En Revisión" o "Recibido".
2. **Prueba de Integrantes del Hogar y Cédulas**:
   - Agregar un integrante familiar al hogar.
   - Verificar que no se cree un requisito huérfano ni se sobreescriba la cédula del titular en Fase 1.
   - Eliminar o tramitar el retiro de un integrante y corroborar que sus requisitos asociados se purguen completamente.
3. **Prueba de Sincronización con Supabase**:
   - Pulsar el botón **Sincronizar** en la barra superior.
   - Validar que la sincronización termine con estado de éxito, actualice la hora en pantalla y mantenga visible el expediente y sus archivos sin pérdida de información.
4. **Validación de Compilación**:
   - Ejecutar `compile_applet` para garantizar cero errores de TypeScript y empaquetado.
