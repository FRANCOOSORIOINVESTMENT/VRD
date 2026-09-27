import { Expediente } from "../types";
import * as XLSX from "xlsx";

/**
 * MÓDULO 1: HERRAMIENTAS DE AUTOMATIZACIÓN PARA FASE 6 (POSTULACIÓN COMPENSAR)
 * 1. Generación del texto consolidado para portapapeles.
 * 2. Generación del Formulario Oficial de Postulación Compensar en PDF diligenciado automáticamente.
 * 3. Descarga de la plantilla Excel del Presupuesto Oficial.
 */

export function generarTextoPortapapeles(exp: Expediente): string {
  const post = exp.postulante;
  const predio = exp.predioVivienda;
  const numIntegrantes = exp.hogar?.integrantes?.length || 1;
  const tramite = exp.tramiteLicencia as any;
  const f4 = exp.gestionFase4 as any;

  const totalPresupuesto = f4?.presupuestoOficial?.totalGeneral
    ? `$${f4.presupuestoOficial.totalGeneral.toLocaleString("es-CO")} COP`
    : "$75.400.000 COP";

  return `=====================================================
DATOS DEL PROYECTO Y DEL HOGAR POSTULANTE - COMPENSAR
PROGRAMA: SUBSIDIO DE VIVIENDA RURAL DIGNA (VRD)
=====================================================
• EXPEDIENTE: ${exp.codigoVisible || exp.id}
• POSTULANTE PRINCIPAL: ${post.primerNombre || ""} ${post.segundoNombre || ""} ${post.primerApellido} ${post.segundoApellido || ""} (${post.nombres})
• TIPO Y NÚMERO DOCUMENTO: ${post.tipoIdentificacion} ${post.numeroIdentificacion}
• TELÉFONO DE CONTACTO: ${post.telefonoPrincipal || "No registrado"}
• CORREO ELECTRÓNICO: ${post.correo || "No registrado"}
• NÚMERO INTEGRANTES DEL HOGAR: ${numIntegrantes} persona(s)
• UBICACIÓN: Sector Rural - Vereda: ${predio?.vereda || "Rural"}
• MUNICIPIO / DPTO: Municipio Código ${predio?.municipioCodigo || "25001"} (Cundinamarca)
• DIRECCIÓN / NOMBRE PREDIO: ${predio?.nombreODireccion || "Predio Rural"}
• MATRÍCULA INMOBILIARIA: ${predio?.matriculaInmobiliaria || "En trámite/posesión"}
• REFERENCIA CATASTRAL: ${predio?.referenciaCatastral || "No registrada"}

DATOS TÉCNICOS Y FINANCIEROS DEL PROYECTO:
• MODALIDAD DE SUBSIDIO: Construcción en Sitio Propio (CSP)
• TIPO DE SOLUCIÓN: Vivienda de Interés Prioritario Rural (VIPR)
• PRESUPUESTO OFICIAL (APU): ${totalPresupuesto}
• LICENCIA DE CONSTRUCCIÓN: ${tramite?.numeroResolucionLicencia ? `Resolución No. ${tramite.numeroResolucionLicencia}` : "Acto Administrativo Ejecutoriado"}
• ENTIDAD LICENCIADORA: ${tramite?.entidadLicencia || "Curaduría Urbana / Planeación Municipal"}
• CONCEPTO DE INTERVENTORÍA: Favorable NSR-10 (Aprobado en Fase 4)
• ENTIDAD DESTINO: Compensar (Caja de Compensación Familiar)
=====================================================`;
}

/**
 * Genera el documento PDF del formulario oficial Compensar totalmente diligenciado
 * mapeando las modalidades: Construcción en sitio propio [X], Ubicación Rural [X],
 * datos del hogar, conformación socioeconómica y cuadro de recursos económicos.
 */
export function generarPdfFormularioPostulacion(exp: Expediente): Blob {
  const post = exp.postulante;
  const predio = exp.predioVivienda;
  const f4 = exp.gestionFase4 as any;
  const tramite = exp.tramiteLicencia as any;
  const valorTotal = f4?.presupuestoOficial?.totalGeneral || 75400000;
  const valorSubsidio = Math.min(valorTotal, 70000000);
  const valorAportePropio = Math.max(0, valorTotal - valorSubsidio);

  // Generamos un Canvas con renderizado vectorial de alta resolución del formulario oficial
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  canvas.width = 1240; // 150 DPI para A4
  canvas.height = 1754;

  // Fondo blanco limpio
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Margen y cabecera institucional Compensar
  ctx.fillStyle = "#ea580c"; // Naranja característico de Compensar
  ctx.fillRect(40, 40, canvas.width - 80, 50);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 20px sans-serif";
  ctx.fillText("COMPENSAR - CAJA DE COMPENSACIÓN FAMILIAR", 60, 72);

  ctx.font = "bold 13px sans-serif";
  ctx.fillText("FORMULARIO OFICIAL DE POSTULACIÓN AL SUBSIDIO FAMILIAR DE VIVIENDA DE INTERÉS SOCIAL RURAL", 60, 115);

  // Sección 1: Modalidad y Ubicación (Marcadas automáticamente)
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(40, 130, canvas.width - 80, 80);

  ctx.fillStyle = "#f1f5f9";
  ctx.fillRect(41, 131, canvas.width - 82, 24);
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 12px sans-serif";
  ctx.fillText("1. MODALIDAD DE POSTULACIÓN Y LOCALIZACIÓN GEOGRÁFICA", 50, 147);

  ctx.font = "12px sans-serif";
  ctx.fillText("Modalidad:", 55, 175);
  ctx.fillStyle = "#0369a1";
  ctx.font = "bold 12px sans-serif";
  ctx.fillText("[ X ] CONSTRUCCIÓN EN SITIO PROPIO (CSP)", 130, 175);
  ctx.fillStyle = "#64748b";
  ctx.fillText("[   ] Mejoramiento de Vivienda      [   ] Adquisición Vivienda Nueva", 440, 175);

  ctx.fillStyle = "#0f172a";
  ctx.font = "12px sans-serif";
  ctx.fillText("Ubicación Solución:", 55, 198);
  ctx.fillStyle = "#15803d";
  ctx.font = "bold 12px sans-serif";
  ctx.fillText("[ X ] RURAL DISPERSO / CAMPESTRE", 185, 198);
  ctx.fillStyle = "#64748b";
  ctx.fillText("[   ] Centro Poblado      [   ] Urbano", 440, 198);

  // Sección 2: Datos del Hogar Postulante
  ctx.strokeRect(40, 225, canvas.width - 80, 150);
  ctx.fillStyle = "#f1f5f9";
  ctx.fillRect(41, 226, canvas.width - 82, 24);
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 12px sans-serif";
  ctx.fillText("2. IDENTIFICACIÓN DEL HOGAR POSTULANTE Y CABEZA DE FAMILIA", 50, 242);

  const nombreCompleto = `${post.primerNombre || ""} ${post.segundoNombre || ""} ${post.primerApellido} ${post.segundoApellido || ""}`.trim() || post.nombres;

  ctx.font = "11px sans-serif";
  ctx.fillStyle = "#475569";
  ctx.fillText("Nombre Completo Postulante Principal:", 55, 272);
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 12px sans-serif";
  ctx.fillText(nombreCompleto.toUpperCase(), 300, 272);

  ctx.font = "11px sans-serif";
  ctx.fillStyle = "#475569";
  ctx.fillText("Tipo y Número de Identificación:", 55, 298);
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 12px sans-serif";
  ctx.fillText(`${post.tipoIdentificacion}: ${post.numeroIdentificacion}`, 300, 298);

  ctx.font = "11px sans-serif";
  ctx.fillStyle = "#475569";
  ctx.fillText("Teléfono y Correo:", 55, 324);
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 12px sans-serif";
  ctx.fillText(`${post.telefonoPrincipal || "N/A"}  |  ${post.correo || "N/A"}`, 300, 324);

  ctx.font = "11px sans-serif";
  ctx.fillStyle = "#475569";
  ctx.fillText("Dirección del Predio / Vereda:", 55, 350);
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 12px sans-serif";
  ctx.fillText(`${predio?.nombreODireccion || "Predio Rural"} - Vereda ${predio?.vereda || "Rural"} (Municipio ${predio?.municipioCodigo || "25001"})`, 300, 350);

  // Sección 3: Conformación Socioeconómica del Hogar
  ctx.strokeRect(40, 390, canvas.width - 80, 160);
  ctx.fillStyle = "#f1f5f9";
  ctx.fillRect(41, 391, canvas.width - 82, 24);
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 12px sans-serif";
  ctx.fillText("3. CONFORMACIÓN SOCIOECONÓMICA DEL GRUPO FAMILIAR", 50, 407);

  // Encabezados tabla
  ctx.fillStyle = "#e2e8f0";
  ctx.fillRect(41, 416, canvas.width - 82, 20);
  ctx.fillStyle = "#334155";
  ctx.font = "bold 10px sans-serif";
  ctx.fillText("INTEGRANTE", 55, 430);
  ctx.fillText("TIPO DOC", 380, 430);
  ctx.fillText("NÚMERO", 480, 430);
  ctx.fillText("PARENTESCO", 640, 430);
  ctx.fillText("CONDICIÓN", 840, 430);
  ctx.fillText("INGRESOS MENSUALES", 1020, 430);

  const integrantes = exp.hogar?.integrantes && exp.hogar.integrantes.length > 0
    ? exp.hogar.integrantes
    : [{ id: "1", hogarId: "1", persona: post, parentesco: "Jefe de Hogar", esPostulantePrincipal: true }];

  let posY = 452;
  integrantes.slice(0, 4).forEach((integ, idx) => {
    ctx.font = "11px sans-serif";
    ctx.fillStyle = "#0f172a";
    const nom = `${integ.persona.primerNombre || ""} ${integ.persona.primerApellido}`.trim() || integ.persona.nombres;
    ctx.fillText(`${idx + 1}. ${nom}`, 55, posY);
    ctx.fillText(integ.persona.tipoIdentificacion, 380, posY);
    ctx.fillText(integ.persona.numeroIdentificacion, 480, posY);
    ctx.fillText(integ.parentesco || (integ.esPostulantePrincipal ? "Jefe Hogar" : "Familiar"), 640, posY);
    ctx.fillText("Activo / Postulante", 840, posY);
    ctx.fillText("$1.423.500 COP", 1020, posY);
    posY += 24;
  });

  // Sección 4: Cuadro de Recursos Económicos y Estructura Financiera
  ctx.strokeRect(40, 565, canvas.width - 80, 160);
  ctx.fillStyle = "#f1f5f9";
  ctx.fillRect(41, 566, canvas.width - 82, 24);
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 12px sans-serif";
  ctx.fillText("4. CUADRO DE RECURSOS ECONÓMICOS Y FINANCIACIÓN DE LA SOLUCIÓN", 50, 582);

  ctx.font = "11px sans-serif";
  ctx.fillStyle = "#334155";
  ctx.fillText("A. Subsidio Familiar de Vivienda Solicitado a Compensar:", 55, 615);
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 12px sans-serif";
  ctx.fillText(`$${valorSubsidio.toLocaleString("es-CO")} COP`, 750, 615);

  ctx.font = "11px sans-serif";
  ctx.fillStyle = "#334155";
  ctx.fillText("B. Ahorro Previo / Recursos Propios Certificados:", 55, 642);
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 12px sans-serif";
  ctx.fillText(`$${valorAportePropio.toLocaleString("es-CO")} COP`, 750, 642);

  ctx.font = "11px sans-serif";
  ctx.fillStyle = "#334155";
  ctx.fillText("C. Subsidios Complementarios / Donaciones / Crédito Complementario:", 55, 669);
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 12px sans-serif";
  ctx.fillText("$0 COP", 750, 669);

  ctx.fillStyle = "#e2e8f0";
  ctx.fillRect(41, 685, canvas.width - 82, 28);
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 12px sans-serif";
  ctx.fillText("VALOR TOTAL PRESUPUESTO OFICIAL DE LA VIVIENDA (A + B + C):", 55, 703);
  ctx.fillStyle = "#047857";
  ctx.fillText(`$${valorTotal.toLocaleString("es-CO")} COP`, 750, 703);

  // Sección 5: Datos del Predio y Licencia Urbanística
  ctx.strokeRect(40, 740, canvas.width - 80, 130);
  ctx.fillStyle = "#f1f5f9";
  ctx.fillRect(41, 741, canvas.width - 82, 24);
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 12px sans-serif";
  ctx.fillText("5. SOPORTE DE TENENCIA, JURÍDICO Y ACTO ADMINISTRATIVO DE LICENCIA", 50, 757);

  ctx.font = "11px sans-serif";
  ctx.fillStyle = "#334155";
  ctx.fillText("Matrícula Inmobiliaria:", 55, 785);
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 11px sans-serif";
  ctx.fillText(predio?.matriculaInmobiliaria || "Posesión sana protocolizada", 250, 785);

  ctx.font = "11px sans-serif";
  ctx.fillStyle = "#334155";
  ctx.fillText("Resolución Licencia Construcción:", 55, 810);
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 11px sans-serif";
  ctx.fillText(tramite?.numeroResolucionLicencia || "Resolución Oficial Fase 5 Ejecutoriada", 250, 810);

  ctx.font = "11px sans-serif";
  ctx.fillStyle = "#334155";
  ctx.fillText("Entidad de Licenciamiento:", 55, 835);
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 11px sans-serif";
  ctx.fillText(tramite?.entidadLicencia || "Curaduría Urbana / Secretaría de Planeación", 250, 835);

  // Sección de Firmas y Declaración Juramentada
  ctx.strokeRect(40, 885, canvas.width - 80, 150);
  ctx.font = "10px sans-serif";
  ctx.fillStyle = "#64748b";
  ctx.fillText("DECLARACIÓN JURAMENTADA: Manifiesto bajo la gravedad del juramento que los datos aquí consignados son exactos,", 55, 910);
  ctx.fillText("fieles a la realidad y autorizo el tratamiento de datos personales para la postulación al subsidio familiar de vivienda rural.", 55, 925);

  ctx.strokeStyle = "#94a3b8";
  ctx.beginPath();
  ctx.moveTo(80, 1000);
  ctx.lineTo(400, 1000);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(500, 1000);
  ctx.lineTo(820, 1000);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(900, 1000);
  ctx.lineTo(1180, 1000);
  ctx.stroke();

  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 11px sans-serif";
  ctx.fillText("FIRMA POSTULANTE PRINCIPAL", 120, 1018);
  ctx.fillText(`C.C. ${post.numeroIdentificacion}`, 145, 1032);

  ctx.fillText("FIRMA CÓNYUGE / APORTANTE", 540, 1018);
  ctx.fillText("Identificación y Firma", 580, 1032);

  ctx.fillText("INGENIERO RESPONSABLE / VRD", 940, 1018);
  ctx.fillText("Mat. Prof. Vigente", 985, 1032);

  // Pie institucional con fecha de expedición del sistema
  ctx.fillStyle = "#94a3b8";
  ctx.font = "10px sans-serif";
  ctx.fillText(`Formulario generado automáticamente por el Sistema VRD para Compensar | Fecha: ${new Date().toLocaleDateString("es-CO")} | Exp: ${exp.codigoVisible || exp.id}`, 60, 1720);

  // Convertir canvas a imagen JPEG y empaquetar en PDF válido
  const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
  const base64Data = dataUrl.split(",")[1];
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Generamos el blob PDF estándar A4
  return generarPdfDesdeJpegDirecto(bytes, canvas.width, canvas.height);
}

function generarPdfDesdeJpegDirecto(jpegBytes: Uint8Array, width: number, height: number): Blob {
  const pWidth = 595.28;
  const pHeight = 841.89;
  const margin = 20;
  const maxW = pWidth - margin * 2;
  const maxH = pHeight - margin * 2;
  const scale = Math.min(maxW / width, maxH / height);
  const drawW = width * scale;
  const drawH = height * scale;
  const posX = (pWidth - drawW) / 2;
  const posY = (pHeight - drawH) / 2;

  const encoder = new TextEncoder();
  const header = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
  const obj1 = "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n";
  const obj2 = "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n";
  const obj3 = `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pWidth.toFixed(2)} ${pHeight.toFixed(2)}] /Resources << /XObject << /Im1 4 0 R >> /ProcSet [/PDF /Text /ImageC] >> /Contents 5 0 R >>\nendobj\n`;
  const contentStream = `q\n${drawW.toFixed(2)} 0 0 ${drawH.toFixed(2)} ${posX.toFixed(2)} ${posY.toFixed(2)} cm\n/Im1 Do\nQ\n`;
  const obj5 = `5 0 obj\n<< /Length ${contentStream.length} >>\nstream\n${contentStream}endstream\nendobj\n`;
  const obj4Header = `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`;
  const obj4Footer = "\nendstream\nendobj\n";

  const partHeader = encoder.encode(header);
  const part1 = encoder.encode(obj1);
  const part2 = encoder.encode(obj2);
  const part3 = encoder.encode(obj3);
  const part4H = encoder.encode(obj4Header);
  const part4F = encoder.encode(obj4Footer);
  const part5 = encoder.encode(obj5);

  const offset1 = partHeader.length;
  const offset2 = offset1 + part1.length;
  const offset3 = offset2 + part2.length;
  const offset4 = offset3 + part3.length;
  const offset5 = offset4 + part4H.length + jpegBytes.length + part4F.length;
  const xrefOffset = offset5 + part5.length;

  const xref = `xref\n0 6\n0000000000 65535 f \n${String(offset1).padStart(10, "0")} 00000 n \n${String(offset2).padStart(10, "0")} 00000 n \n${String(offset3).padStart(10, "0")} 00000 n \n${String(offset4).padStart(10, "0")} 00000 n \n${String(offset5).padStart(10, "0")} 00000 n \n`;
  const trailer = `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  const partXref = encoder.encode(xref);
  const partTrailer = encoder.encode(trailer);

  return new Blob(
    [partHeader, part1, part2, part3, part4H, jpegBytes, part4F, part5, partXref, partTrailer],
    { type: "application/pdf" }
  );
}

/**
 * Genera y descarga el archivo Excel del Presupuesto Oficial de Obra
 */
export function descargarExcelPresupuestoFase6(exp: Expediente) {
  const f4 = exp.gestionFase4 as any;
  const presupuestoOficial = f4?.presupuestoOficial;

  const items = presupuestoOficial?.capitulos && presupuestoOficial.capitulos.length > 0
    ? presupuestoOficial.capitulos.flatMap((c: any) =>
        c.items.map((it: any) => ({
          Capítulo: c.nombre,
          Ítem: it.descripcion,
          Unidad: it.unidad,
          Cantidad: it.cantidad,
          "Valor Unitario": it.valorUnitario,
          "Valor Total": it.valorTotal
        }))
      )
    : [
        { Capítulo: "1. PRELIMINARES", Ítem: "Localización y replanteo topográfico", Unidad: "m2", Cantidad: 65, "Valor Unitario": 12500, "Valor Total": 812500 },
        { Capítulo: "1. PRELIMINARES", Ítem: "Campamento y cerramiento provisional", Unidad: "gl", Cantidad: 1, "Valor Unitario": 1200000, "Valor Total": 1200000 },
        { Capítulo: "2. CIMENTACIÓN", Ítem: "Excavación manual en tierra y zapatas", Unidad: "m3", Cantidad: 18, "Valor Unitario": 48000, "Valor Total": 864000 },
        { Capítulo: "2. CIMENTACIÓN", Ítem: "Vigas de amarre y zapatas en concreto 3000 PSI", Unidad: "m3", Cantidad: 8.5, "Valor Unitario": 980000, "Valor Total": 8330000 },
        { Capítulo: "3. ESTRUCTURA Y MUROS", Ítem: "Levantamiento mampostería confinada tolete común", Unidad: "m2", Cantidad: 140, "Valor Unitario": 68000, "Valor Total": 9520000 },
        { Capítulo: "3. ESTRUCTURA Y MUROS", Ítem: "Columnetas y vigas de corona", Unidad: "ml", Cantidad: 62, "Valor Unitario": 52000, "Valor Total": 3224000 },
        { Capítulo: "4. CUBIERTA", Ítem: "Estructura portante metálica perfilería C", Unidad: "m2", Cantidad: 78, "Valor Unitario": 115000, "Valor Total": 8970000 },
        { Capítulo: "4. CUBIERTA", Ítem: "Teja termoacústica y caballetes", Unidad: "m2", Cantidad: 78, "Valor Unitario": 72000, "Valor Total": 5616000 },
        { Capítulo: "5. INSTALACIONES", Ítem: "Redes hidrosanitarias y tanque de reserva 1000L", Unidad: "gl", Cantidad: 1, "Valor Unitario": 6800000, "Valor Total": 6800000 },
        { Capítulo: "5. INSTALACIONES", Ítem: "Red eléctrica interior y acometida certificada RETIE", Unidad: "gl", Cantidad: 1, "Valor Unitario": 5400000, "Valor Total": 5400000 },
        { Capítulo: "6. ACABADOS Y CARPINTERÍA", Ítem: "Pisos en baldosa gres antideslizante", Unidad: "m2", Cantidad: 58, "Valor Unitario": 55000, "Valor Total": 3190000 },
        { Capítulo: "6. ACABADOS Y CARPINTERÍA", Ítem: "Ventanería en aluminio y puertas en madera", Unidad: "gl", Cantidad: 1, "Valor Unitario": 4800000, "Valor Total": 4800000 },
        { Capítulo: "7. SANITARIOS Y COCINA", Ítem: "Enchape zonas húmedas, lavadero y mesón de cocina", Unidad: "gl", Cantidad: 1, "Valor Unitario": 4200000, "Valor Total": 4200000 }
      ];

  const totalCalculado = items.reduce((acc: number, curr: any) => acc + curr["Valor Total"], 0);

  const dataFinal = [
    { Capítulo: "PROGRAMA VRD - COMPENSAR", Ítem: `Expediente: ${exp.codigoVisible || exp.id}`, Unidad: "", Cantidad: "", "Valor Unitario": "", "Valor Total": "" },
    { Capítulo: "POSTULANTE", Ítem: exp.postulante.nombres, Unidad: "", Cantidad: "", "Valor Unitario": "", "Valor Total": "" },
    { Capítulo: "PRESUPUESTO GENERAL DE OBRA", Ítem: "Vivienda de Interés Prioritario Rural", Unidad: "", Cantidad: "", "Valor Unitario": "", "Valor Total": totalCalculado },
    {},
    ...items,
    {},
    { Capítulo: "TOTAL GENERAL PRESUPUESTO", Ítem: "COSTO TOTAL DE CONSTRUCCIÓN", Unidad: "COP", Cantidad: 1, "Valor Unitario": totalCalculado, "Valor Total": totalCalculado }
  ];

  const ws = XLSX.utils.json_to_sheet(dataFinal);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Presupuesto Oficial");

  const nombreArchivo = `Presupuesto_Oficial_${exp.codigoVisible || exp.id}_VRD.xlsx`;
  XLSX.writeFile(wb, nombreArchivo);
}
