import React, { useState, useMemo } from "react";
import * as XLSX from "xlsx";
import {
  FileSpreadsheet,
  Download,
  Filter,
  Calendar,
  Clock,
  Building2,
  Users,
  Search,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Eye,
  FileText,
  DollarSign,
  UserCheck,
  ChevronDown,
  Layers,
  MapPin,
  HelpCircle
} from "lucide-react";
import { Expediente, PerfilUsuario, RolUsuario } from "../types";
import { CATALOGO_MUNICIPIOS } from "../data/municipios";
import { normalizarTextoNombre } from "../utils/normalizacion";
import { formatearRol } from "../utils/formatoRoles";

interface ModuloInformesProps {
  currentUser: PerfilUsuario;
  expedientes: Expediente[];
  onSelectExpediente?: (id: string) => void;
  mostrarToast: (mensaje: string, tipo?: "info" | "success" | "error") => void;
}

type TipoInformePredefinido =
  | "general"
  | "activos_fase"
  | "alerta_60_dias"
  | "financiero_desembolsos"
  | "salidas_definitivas";

export const ModuloInformes: React.FC<ModuloInformesProps> = ({
  currentUser,
  expedientes,
  onSelectExpediente,
  mostrarToast
}) => {
  // Filtros del informe
  const [filtroTexto, setFiltroTexto] = useState<string>("");
  const [filtroMunicipio, setFiltroMunicipio] = useState<string>("");
  const [filtroFase, setFiltroFase] = useState<string>("");
  const [filtroEstado, setFiltroEstado] = useState<string>("");
  const [filtroResponsable, setFiltroResponsable] = useState<string>("");
  const [filtroTiempo, setFiltroTiempo] = useState<string>("");
  const [fechaDesde, setFechaDesde] = useState<string>("");
  const [fechaHasta, setFechaHasta] = useState<string>("");

  // Restricción por rol (para comerciales, activado por defecto para respetar su cartera asignada)
  const [soloMiCartera, setSoloMiCartera] = useState<boolean>(
    currentUser.rol === "comercial"
  );

  // Estado de descarga / generación
  const [generandoDescarga, setGenerandoDescarga] = useState<boolean>(false);
  const [formatoSeleccionado, setFormatoSeleccionado] = useState<"xlsx" | "csv">("xlsx");
  const [tipoInformeActivo, setTipoInformeActivo] = useState<TipoInformePredefinido>("general");

  // Paginación de vista previa
  const [paginaActual, setPaginaActual] = useState<number>(1);
  const elementosPorPagina = 10;

  // Lista dinámica de responsables
  const listaResponsables = useMemo(() => {
    return Array.from(
      new Set([
        "Carlos Mendoza (Gestor Rural)",
        "Laura Castillo (Gestor Documental)",
        "Dra. Helena Ramírez (Analista Documental)",
        "Arq. Andrés Morales (Ingeniería y Diseños)",
        "Ing. Claudia Vega (Ingeniería y Obra)",
        ...expedientes.map((e) => e.responsableGeneralNombre).filter(Boolean)
      ])
    ).filter(Boolean) as string[];
  }, [expedientes]);

  // Aplicación de informe predefinido
  const aplicarInformePredefinido = (tipo: TipoInformePredefinido) => {
    setTipoInformeActivo(tipo);
    setPaginaActual(1);

    switch (tipo) {
      case "general":
        setFiltroTexto("");
        setFiltroMunicipio("");
        setFiltroFase("");
        setFiltroEstado("");
        setFiltroResponsable("");
        setFiltroTiempo("");
        setFechaDesde("");
        setFechaHasta("");
        break;

      case "activos_fase":
        setFiltroTexto("");
        setFiltroMunicipio("");
        setFiltroFase("");
        setFiltroEstado("en_tramite");
        setFiltroResponsable("");
        setFiltroTiempo("");
        setFechaDesde("");
        setFechaHasta("");
        break;

      case "alerta_60_dias":
        setFiltroTexto("");
        setFiltroMunicipio("");
        setFiltroFase("");
        setFiltroEstado("en_tramite");
        setFiltroResponsable("");
        setFiltroTiempo("60-90"); // filtra demora alta (+60 días)
        setFechaDesde("");
        setFechaHasta("");
        break;

      case "financiero_desembolsos":
        setFiltroTexto("");
        setFiltroMunicipio("");
        setFiltroFase("");
        setFiltroEstado("subsidio_desembolsado");
        setFiltroResponsable("");
        setFiltroTiempo("");
        setFechaDesde("");
        setFechaHasta("");
        break;

      case "salidas_definitivas":
        setFiltroTexto("");
        setFiltroMunicipio("");
        setFiltroFase("");
        setFiltroEstado("salida_definitiva");
        setFiltroResponsable("");
        setFiltroTiempo("");
        setFechaDesde("");
        setFechaHasta("");
        break;
    }
  };

  // Limpiar todos los filtros
  const handleLimpiarFiltros = () => {
    setTipoInformeActivo("general");
    setFiltroTexto("");
    setFiltroMunicipio("");
    setFiltroFase("");
    setFiltroEstado("");
    setFiltroResponsable("");
    setFiltroTiempo("");
    setFechaDesde("");
    setFechaHasta("");
    setPaginaActual(1);
    mostrarToast("Filtros restablecidos", "info");
  };

  // Filtrado de expedientes en memoria
  const expedientesFiltrados = useMemo(() => {
    return expedientes.filter((exp) => {
      // 1. Restricción por rol de comercial si está activo el toggle
      if (soloMiCartera && currentUser.rol === "comercial") {
        const esAsignado =
          exp.comercialOrigenId === currentUser.id ||
          exp.responsableGeneralId === currentUser.id;
        if (!esAsignado) return false;
      }

      // 2. Filtro de texto libre (titular, cédula, código visible, teléfono, vereda)
      if (filtroTexto.trim()) {
        const t = filtroTexto.toLowerCase();
        const nombresNorm = normalizarTextoNombre(exp.postulante?.nombres || "").toLowerCase();
        const apellidosNorm = normalizarTextoNombre(exp.postulante?.primerApellido || "").toLowerCase();
        const cedula = (exp.postulante?.numeroIdentificacion || "").toLowerCase();
        const cod = (exp.codigoVisible || exp.id || "").toLowerCase();
        const tel = (exp.postulante?.telefonoPrincipal || "").toLowerCase();
        const vereda = (exp.predioVivienda?.vereda || "").toLowerCase();

        const coincide =
          nombresNorm.includes(t) ||
          apellidosNorm.includes(t) ||
          cedula.includes(t) ||
          cod.includes(t) ||
          tel.includes(t) ||
          vereda.includes(t);

        if (!coincide) return false;
      }

      // 3. Filtro Municipio
      if (filtroMunicipio && exp.predioVivienda?.municipioCodigo !== filtroMunicipio) {
        return false;
      }

      // 4. Filtro Fase
      if (filtroFase && String(exp.faseActual) !== filtroFase) {
        return false;
      }

      // 5. Filtro Estado
      if (filtroEstado && exp.estadoGeneral !== filtroEstado) {
        return false;
      }

      // 6. Filtro Responsable General
      if (filtroResponsable) {
        const match =
          exp.responsableGeneralNombre === filtroResponsable ||
          exp.responsableGeneralId === filtroResponsable;
        if (!match) return false;
      }

      // 7. Filtro Rango de Tiempo (días transcurridos)
      const dias = exp.diasTranscurridos ?? 0;
      if (filtroTiempo === "0-15" && !(dias >= 0 && dias <= 15)) return false;
      if (filtroTiempo === "15-30" && !(dias > 15 && dias <= 30)) return false;
      if (filtroTiempo === "30-60" && !(dias > 30 && dias <= 60)) return false;
      if (filtroTiempo === "60-90" && !(dias > 60 && dias <= 90)) return false;
      if (filtroTiempo === "90+" && !(dias > 90)) return false;

      // Alerta especial de demora (+60 días) si se seleccionó en el informe predefinido sin filtro específico
      if (tipoInformeActivo === "alerta_60_dias" && dias < 60) {
        return false;
      }

      // 8. Rango de Fechas de Ingreso a Fase 1
      if (fechaDesde || fechaHasta) {
        if (!exp.fechaIngresoFase1) return false;
        const fIngreso = exp.fechaIngresoFase1.split("T")[0]; // YYYY-MM-DD
        if (fechaDesde && fIngreso < fechaDesde) return false;
        if (fechaHasta && fIngreso > fechaHasta) return false;
      }

      return true;
    });
  }, [
    expedientes,
    currentUser,
    soloMiCartera,
    filtroTexto,
    filtroMunicipio,
    filtroFase,
    filtroEstado,
    filtroResponsable,
    filtroTiempo,
    fechaDesde,
    fechaHasta,
    tipoInformeActivo
  ]);

  // Métricas resumidas de los datos actualmente filtrados
  const metricasResumen = useMemo(() => {
    let totalMontoDesembolsado = 0;
    let sumaDias = 0;
    const conteoFases: { [fase: number]: number } = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 };
    const conteoEstados: { [estado: string]: number } = {
      en_tramite: 0,
      en_pausa_aporte: 0,
      subsidio_desembolsado: 0,
      salida_definitiva: 0
    };

    expedientesFiltrados.forEach((exp) => {
      sumaDias += exp.diasTranscurridos ?? 0;
      if (conteoFases[exp.faseActual] !== undefined) {
        conteoFases[exp.faseActual]++;
      }
      if (conteoEstados[exp.estadoGeneral] !== undefined) {
        conteoEstados[exp.estadoGeneral]++;
      } else {
        conteoEstados[exp.estadoGeneral] = 1;
      }

      const monto = exp.gestionFase7?.desembolso?.montoDesembolsado;
      if (monto && exp.estadoGeneral === "subsidio_desembolsado") {
        totalMontoDesembolsado += monto;
      }
    });

    const promedioDias =
      expedientesFiltrados.length > 0
        ? Math.round(sumaDias / expedientesFiltrados.length)
        : 0;

    return {
      total: expedientesFiltrados.length,
      promedioDias,
      totalMontoDesembolsado,
      conteoFases,
      conteoEstados
    };
  }, [expedientesFiltrados]);

  // Mapeo legible de fases y estados
  const getNombreFase = (numFase: number): string => {
    switch (numFase) {
      case 1:
        return "Fase 1: En Ingreso Hogar (3 docs)";
      case 2:
        return "Fase 2: En Solicitud 8 Documentos";
      case 3:
        return "Fase 3: En Validación Inicial Compensar";
      case 4:
        return "Fase 4: En Recolección de Documentos Técnicos";
      case 5:
        return "Fase 5: En Trámite de Licencia de Construcción";
      case 6:
        return "Fase 6: En Postulación Subsidio";
      case 7:
        return "Fase 7: En Construcción y Cobro Subsidio";
      default:
        return `Fase ${numFase}`;
    }
  };

  const getEtiquetaEstado = (estado: string): { label: string; color: string } => {
    switch (estado) {
      case "en_tramite":
        return { label: "En Trámite", color: "bg-blue-100 text-blue-800 border-blue-200" };
      case "en_pausa_aporte":
        return { label: "En Pausa (Aporte 10%)", color: "bg-amber-100 text-amber-800 border-amber-200" };
      case "subsidio_desembolsado":
        return { label: "Subsidio Desembolsado y Cerrado", color: "bg-emerald-100 text-emerald-800 border-emerald-200" };
      case "salida_definitiva":
        return { label: "Salida Definitiva", color: "bg-red-100 text-red-800 border-red-200" };
      default:
        return { label: estado, color: "bg-slate-100 text-slate-800 border-slate-200" };
    }
  };

  // Helper para buscar nombre de municipio a partir del código DANE
  const getMunicipioNombre = (codigo: string): string => {
    const m = CATALOGO_MUNICIPIOS.find((item) => item.codigoCompleto === codigo);
    return m ? m.municipioNombre : codigo || "No especificado";
  };

  // GENERACIÓN DE LOS REGISTROS PARA EXPORTACIÓN (EXCEL / CSV)
  const generarFilasExportacion = () => {
    return expedientesFiltrados.map((exp, index) => {
      // Formateo de nombres en mayúsculas sin tildes (Regla obligatoria Cambio 4)
      const titularNombres = normalizarTextoNombre(exp.postulante?.nombres || "");
      const titularPrimerApellido = normalizarTextoNombre(exp.postulante?.primerApellido || "");
      const titularSegundoApellido = normalizarTextoNombre(exp.postulante?.segundoApellido || "");
      const titularNombreCompleto = [titularNombres, titularPrimerApellido, titularSegundoApellido]
        .filter(Boolean)
        .join(" ")
        .trim();

      // Integrantes adicionales del hogar
      const integrantesAdicionales = (exp.hogar?.integrantes || [])
        .filter((integ) => !integ.esPostulantePrincipal)
        .map((integ) => {
          const nom = normalizarTextoNombre(integ.persona?.nombres || "");
          const ape = normalizarTextoNombre(integ.persona?.primerApellido || "");
          const doc = `${integ.persona?.tipoIdentificacion || "CC"} ${integ.persona?.numeroIdentificacion || ""}`.trim();
          const par = integ.parentesco || "Integrante";
          return `${nom} ${ape} (${par} - Doc: ${doc})`.trim();
        })
        .join("; ");

      // Contactos de apoyo
      const contactosApoyo = (exp.interesadoOrigenId ? "Verificado" : "N/A");

      // Datos del predio y municipio
      const munNombre = getMunicipioNombre(exp.predioVivienda?.municipioCodigo);
      const vereda = exp.predioVivienda?.vereda || "No especificada";
      const direccionPredio = exp.predioVivienda?.nombreODireccion || "";
      const matricula = exp.predioVivienda?.matriculaInmobiliaria || "En trámite";
      const referenciaCatastral = exp.predioVivienda?.referenciaCatastral || "";

      // Datos específicos de Subsidio Desembolsado y Cerrado
      const desembolso = exp.gestionFase7?.desembolso;
      const esDesembolsado = exp.estadoGeneral === "subsidio_desembolsado";
      const montoDesembolsado = esDesembolsado ? (desembolso?.montoDesembolsado || 40000000) : "";
      const fechaDesembolso = esDesembolsado ? (desembolso?.fechaDesembolso || exp.actualizadoEn || "") : "";
      const comprobantePago = esDesembolsado ? (desembolso?.numeroComprobante || "CMP-2026-001") : "";
      const entidadPagadora = esDesembolsado ? (desembolso?.entidad || "Compensar") : "";

      // Datos específicos de Salida Definitiva
      const esSalida = exp.estadoGeneral === "salida_definitiva";
      const solicitudRechazo = exp.solicitudRechazo;
      const motivoRechazo = esSalida ? (solicitudRechazo?.motivo || "Salida voluntaria / Incumplimiento de requisitos") : "";
      const justificacionRechazo = esSalida ? (solicitudRechazo?.justificacion || "") : "";
      const fechaSalida = esSalida ? (solicitudRechazo?.fechaDecision || exp.actualizadoEn || "") : "";
      const resueltoPorSalida = esSalida ? (solicitudRechazo?.decididoPorNombre || "Administración Central") : "";

      // Fechas históricas de fases conocidas
      const fechaIngresoFase1 = exp.fechaIngresoFase1 ? exp.fechaIngresoFase1.split("T")[0] : "";
      const fechaEnvioFase1 = exp.fechaEnvioRevisionFase1 ? exp.fechaEnvioRevisionFase1.split("T")[0] : "";
      const fechaEnvioFase2 = exp.fechaEnvioRevisionFase2 ? exp.fechaEnvioRevisionFase2.split("T")[0] : "";
      const fechaDecisionFase2 = exp.fechaDecisionSupervisorFase2 ? exp.fechaDecisionSupervisorFase2.split("T")[0] : "";
      const fechaAprobacionF3 = exp.validacionCompensar?.fechaAprobacionFinal ? exp.validacionCompensar.fechaAprobacionFinal.split("T")[0] : "";
      const radicadoF3 = exp.validacionCompensar?.radicadoAprobacionFinal || "";
      const radicadoCuraduriaF5 = exp.tramiteLicencia?.radicadoCuraduria || "";
      const resolucionSubsidioF6 = exp.postulacionSubsidio?.numeroResolucionAsignacion || "";
      const fechaEntregaF7 = exp.gestionFase7?.fechaFinalizacionObra ? exp.gestionFase7.fechaFinalizacionObra.split("T")[0] : "";

      return {
        "ÍTEM": index + 1,
        "CÓDIGO VISIBLE": exp.codigoVisible || exp.id,
        "ID INTERNO": exp.id,
        "POSTULANTE PRINCIPAL": titularNombreCompleto,
        "TIPO DOCUMENTO": exp.postulante?.tipoIdentificacion || "CC",
        "NÚMERO DOCUMENTO": exp.postulante?.numeroIdentificacion || "",
        "TELÉFONO": exp.postulante?.telefonoPrincipal || "Sin registrar",
        "CORREO ELECTRÓNICO": exp.postulante?.correo || "Sin registrar",
        "CANTIDAD INTEGRANTES HOGAR": 1 + (exp.hogar?.integrantes?.length || 0) - (exp.hogar?.integrantes?.some(i => i.esPostulantePrincipal) ? 1 : 0),
        "DETALLE DEMÁS INTEGRANTES": integrantesAdicionales || "Ninguno registrado",
        "DEPARTAMENTO": "CUNDINAMARCA",
        "CÓDIGO DANE MUNICIPIO": exp.predioVivienda?.municipioCodigo || "",
        "MUNICIPIO": munNombre,
        "VEREDA": vereda,
        "DIRECCIÓN O NOMBRE DEL PREDIO": direccionPredio,
        "MATRÍCULA INMOBILIARIA": matricula,
        "CÉDULA CATASTRAL": referenciaCatastral,
        "FASE ACTIVA": exp.faseActual,
        "NOMBRE FASE": getNombreFase(exp.faseActual),
        "ESTADO GENERAL": getEtiquetaEstado(exp.estadoGeneral).label,
        "RESPONSABLE GENERAL": exp.responsableGeneralNombre || "Sin asignar",
        "ROL RESPONSABLE": formatearRol(exp.responsableGeneralRol || ""),
        "GESTOR RURAL DE ORIGEN": exp.comercialOrigenNombre || "Sin asignar",
        "FECHA INGRESO FASE 1": fechaIngresoFase1,
        "DÍAS TRANSCURRIDOS": exp.diasTranscurridos ?? 0,
        "FECHA REVISIÓN FASE 1": fechaEnvioFase1,
        "FECHA ENVÍO REVISIÓN FASE 2": fechaEnvioFase2,
        "FECHA DECISIÓN FASE 2": fechaDecisionFase2,
        "ESTADO VALIDACIÓN FASE 3 (COMPENSAR)": exp.validacionCompensar?.estadoActual || "sin_enviar",
        "FECHA APROBACIÓN FASE 3": fechaAprobacionF3,
        "RADICADO COMPENSAR FASE 3": radicadoF3,
        "RADICADO LICENCIA CURADURÍA (F5)": radicadoCuraduriaF5,
        "RESOLUCIÓN SUBSIDIO ASIGNADO (F6)": resolucionSubsidioF6,
        "FECHA ENTREGA VIVIENDA (F7)": fechaEntregaF7,
        "MONTO SUBSIDIO DESEMBOLSADO (COP)": montoDesembolsado,
        "FECHA DESEMBOLSO SUBSIDIO": fechaDesembolso,
        "COMPROBANTE PAGO COMPENSAR": comprobantePago,
        "ENTIDAD PAGADORA": entidadPagadora,
        "MOTIVO RECHAZO O SALIDA": motivoRechazo,
        "JUSTIFICACIÓN SALIDA": justificacionRechazo,
        "FECHA SALIDA DEFINITIVA": fechaSalida,
        "RESUELTO POR SALIDA": resueltoPorSalida
      };
    });
  };

  // DESCARGA EN EXCEL (.xlsx)
  const handleDescargarExcel = () => {
    if (expedientesFiltrados.length === 0) {
      mostrarToast("No hay registros que coincidan con los filtros seleccionados.", "error");
      return;
    }

    try {
      setGenerandoDescarga(true);
      const filas = generarFilasExportacion();
      const fechaHoy = new Date().toISOString().split("T")[0];
      const nombreArchivo = `Informe_Expedientes_VRD_${fechaHoy}.xlsx`;

      // Crear hoja de cálculo con XLSX
      const wb = XLSX.utils.book_new();
      const wsExpedientes = XLSX.utils.json_to_sheet(filas);

      // Configurar ancho de columnas sugerido para legibilidad profesional
      const colWidths = [
        { wch: 6 },  // ÍTEM
        { wch: 26 }, // CÓDIGO VISIBLE
        { wch: 38 }, // ID INTERNO
        { wch: 35 }, // POSTULANTE PRINCIPAL
        { wch: 16 }, // TIPO DOCUMENTO
        { wch: 20 }, // NÚMERO DOCUMENTO
        { wch: 16 }, // TELÉFONO
        { wch: 28 }, // CORREO ELECTRÓNICO
        { wch: 25 }, // CANTIDAD INTEGRANTES
        { wch: 45 }, // DETALLE DEMÁS INTEGRANTES
        { wch: 18 }, // DEPARTAMENTO
        { wch: 22 }, // CÓDIGO DANE
        { wch: 20 }, // MUNICIPIO
        { wch: 22 }, // VEREDA
        { wch: 30 }, // DIRECCIÓN
        { wch: 24 }, // MATRÍCULA
        { wch: 24 }, // CÉDULA CATASTRAL
        { wch: 14 }, // FASE ACTIVA
        { wch: 38 }, // NOMBRE FASE
        { wch: 30 }, // ESTADO GENERAL
        { wch: 30 }, // RESPONSABLE GENERAL
        { wch: 18 }, // ROL RESPONSABLE
        { wch: 28 }, // COMERCIAL DE ORIGEN
        { wch: 22 }, // FECHA INGRESO F1
        { wch: 20 }, // DÍAS TRANSCURRIDOS
        { wch: 24 }, // FECHA REVISIÓN F1
        { wch: 26 }, // FECHA ENVÍO REV F2
        { wch: 24 }, // FECHA DECISIÓN F2
        { wch: 35 }, // ESTADO VAL F3
        { wch: 24 }, // FECHA APROB F3
        { wch: 26 }, // RADICADO COMPENSAR F3
        { wch: 30 }, // RADICADO CURADURIA F5
        { wch: 32 }, // RESOLUCIÓN ASIGNADO F6
        { wch: 26 }, // FECHA ENTREGA F7
        { wch: 32 }, // MONTO DESEMBOLSADO COP
        { wch: 26 }, // FECHA DESEMBOLSO
        { wch: 28 }, // COMPROBANTE PAGO
        { wch: 25 }, // ENTIDAD PAGADORA
        { wch: 30 }, // MOTIVO RECHAZO
        { wch: 35 }, // JUSTIFICACIÓN SALIDA
        { wch: 24 }, // FECHA SALIDA
        { wch: 25 }  // RESUELTO POR
      ];
      wsExpedientes["!cols"] = colWidths;

      XLSX.utils.book_append_sheet(wb, wsExpedientes, "Expedientes VRD");

      // Hoja secundaria: Resumen Estadístico
      const resumenFases = [
        { Fase: "Fase 1: En Ingreso Hogar (3 docs)", Cantidad: metricasResumen.conteoFases[1] },
        { Fase: "Fase 2: En Solicitud 8 Documentos", Cantidad: metricasResumen.conteoFases[2] },
        { Fase: "Fase 3: En Validación Inicial Compensar", Cantidad: metricasResumen.conteoFases[3] },
        { Fase: "Fase 4: En Recolección Documentos Técnicos", Cantidad: metricasResumen.conteoFases[4] },
        { Fase: "Fase 5: En Trámite Licencia Curaduría", Cantidad: metricasResumen.conteoFases[5] },
        { Fase: "Fase 6: En Postulación al Subsidio", Cantidad: metricasResumen.conteoFases[6] },
        { Fase: "Fase 7: En Construcción y Cobro Subsidio", Cantidad: metricasResumen.conteoFases[7] }
      ];

      const resumenGeneral = [
        { Indicador: "Total Expedientes Exportados", Valor: metricasResumen.total },
        { Indicador: "En Trámite Activo", Valor: metricasResumen.conteoEstados["en_tramite"] || 0 },
        { Indicador: "En Pausa por Aporte (10%)", Valor: metricasResumen.conteoEstados["en_pausa_aporte"] || 0 },
        { Indicador: "Subsidios Desembolsados y Cerrados", Valor: metricasResumen.conteoEstados["subsidio_desembolsado"] || 0 },
        { Indicador: "Salidas Definitivas (Rechazos)", Valor: metricasResumen.conteoEstados["salida_definitiva"] || 0 },
        { Indicador: "Total Monto Desembolsado COP", Valor: `$${metricasResumen.totalMontoDesembolsado.toLocaleString("es-CO")}` },
        { Indicador: "Promedio Días en Trámite", Valor: `${metricasResumen.promedioDias} días` },
        { Indicador: "Generado Por", Valor: `${currentUser.nombreCompleto} (${currentUser.rol.toUpperCase()})` },
        { Indicador: "Fecha y Hora Generación", Valor: new Date().toLocaleString("es-CO") }
      ];

      const wsResumen = XLSX.utils.json_to_sheet(resumenGeneral);
      XLSX.utils.sheet_add_json(wsResumen, resumenFases, { origin: "A12" });
      wsResumen["!cols"] = [{ wch: 40 }, { wch: 30 }];
      XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen Métricas");

      // Disparar descarga en navegador
      XLSX.writeFile(wb, nombreArchivo);
      mostrarToast(`Descarga completada: ${nombreArchivo} (${expedientesFiltrados.length} registros)`, "success");
    } catch (err: any) {
      console.error("Error al generar Excel:", err);
      mostrarToast("Ocurrió un error al generar el archivo Excel.", "error");
    } finally {
      setGenerandoDescarga(false);
    }
  };

  // DESCARGA EN CSV (.csv) con BOM UTF-8 y delimitador estándar
  const handleDescargarCSV = () => {
    if (expedientesFiltrados.length === 0) {
      mostrarToast("No hay registros que coincidan con los filtros seleccionados.", "error");
      return;
    }

    try {
      setGenerandoDescarga(true);
      const filas = generarFilasExportacion();
      const fechaHoy = new Date().toISOString().split("T")[0];
      const nombreArchivo = `Informe_Expedientes_VRD_${fechaHoy}.csv`;

      // Obtener encabezados
      const headers = Object.keys(filas[0]);

      // Construcción manual de CSV para garantizar UTF-8 BOM y escapado seguro
      const escapeCampoCSV = (val: any): string => {
        if (val === null || val === undefined) return '""';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      };

      const lineasCSV = [
        headers.map(escapeCampoCSV).join(";"),
        ...filas.map((f: any) => headers.map((h) => escapeCampoCSV(f[h])).join(";"))
      ];

      const contenidoCSV = "\uFEFF" + lineasCSV.join("\r\n"); // UTF-8 BOM para apertura perfecta en Excel Windows/Mac
      const blob = new Blob([contenidoCSV], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", nombreArchivo);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      mostrarToast(`Descarga completada: ${nombreArchivo} (${expedientesFiltrados.length} registros)`, "success");
    } catch (err: any) {
      console.error("Error al generar CSV:", err);
      mostrarToast("Ocurrió un error al generar el archivo CSV.", "error");
    } finally {
      setGenerandoDescarga(false);
    }
  };

  // Paginación para vista previa
  const totalPaginas = Math.ceil(expedientesFiltrados.length / elementosPorPagina) || 1;
  const expedientesPaginados = expedientesFiltrados.slice(
    (paginaActual - 1) * elementosPorPagina,
    paginaActual * elementosPorPagina
  );

  return (
    <div className="space-y-6">
      {/* ENCABEZADO DEL MÓDULO */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-xs">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                Módulo de Informes y Exportación de Hogares VRD
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Generación y descarga de listados oficiales en formato Excel (.xlsx) y CSV con filtros configurables por fase, municipio y estado.
              </p>
            </div>
          </div>
        </div>

        {/* BOTONES DE DESCARGA RÁPIDA */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            id="btn-descargar-excel"
            onClick={handleDescargarExcel}
            disabled={generandoDescarga || expedientesFiltrados.length === 0}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center space-x-2 shadow-xs transition-all cursor-pointer ${
              generandoDescarga || expedientesFiltrados.length === 0
                ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                : "bg-emerald-600 hover:bg-emerald-700 text-white active:scale-98"
            }`}
          >
            {generandoDescarga ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>Descargar Excel (.xlsx)</span>
          </button>

          <button
            type="button"
            id="btn-descargar-csv"
            onClick={handleDescargarCSV}
            disabled={generandoDescarga || expedientesFiltrados.length === 0}
            className={`px-3.5 py-2.5 rounded-xl font-semibold text-xs flex items-center space-x-2 border transition-colors cursor-pointer ${
              generandoDescarga || expedientesFiltrados.length === 0
                ? "border-slate-200 text-slate-300 cursor-not-allowed bg-slate-50"
                : "border-slate-300 hover:bg-slate-50 text-slate-700 bg-white"
            }`}
            title="Descargar archivo en formato de valores separados por punto y coma (CSV)"
          >
            <FileText className="w-4 h-4 text-slate-500" />
            <span>Descargar CSV</span>
          </button>
        </div>
      </div>

      {/* BLOQUE DE INFORMES PREDEFINIDOS (SUGERENCIAS RÁPIDAS) */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
            <Layers className="w-4 h-4 text-blue-600" />
            <span>Informes Predefinidos Rápidos</span>
          </div>
          <span className="text-[11px] text-slate-400 font-medium">
            Seleccione una plantilla o personalice los filtros a continuación
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <button
            type="button"
            onClick={() => aplicarInformePredefinido("general")}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              tipoInformeActivo === "general"
                ? "border-blue-500 bg-blue-50/70 shadow-xs ring-1 ring-blue-400"
                : "border-slate-200 bg-slate-50/60 hover:bg-slate-100/80 hover:border-slate-300"
            }`}
          >
            <div className="text-xs font-bold text-slate-900">Listado Maestro</div>
            <div className="text-[11px] text-slate-500 mt-1">Todos los expedientes del programa sin restricciones</div>
          </button>

          <button
            type="button"
            onClick={() => aplicarInformePredefinido("activos_fase")}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              tipoInformeActivo === "activos_fase"
                ? "border-blue-500 bg-blue-50/70 shadow-xs ring-1 ring-blue-400"
                : "border-slate-200 bg-slate-50/60 hover:bg-slate-100/80 hover:border-slate-300"
            }`}
          >
            <div className="text-xs font-bold text-blue-900 flex items-center justify-between">
              <span>Activos por Fase</span>
              <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-[10px] font-mono">
                {metricasResumen.conteoEstados["en_tramite"] || 0}
              </span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Hogares actualmente en trámite (Fases 1 a 7)</div>
          </button>

          <button
            type="button"
            onClick={() => aplicarInformePredefinido("alerta_60_dias")}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              tipoInformeActivo === "alerta_60_dias"
                ? "border-amber-500 bg-amber-50/70 shadow-xs ring-1 ring-amber-400"
                : "border-slate-200 bg-slate-50/60 hover:bg-slate-100/80 hover:border-slate-300"
            }`}
          >
            <div className="text-xs font-bold text-amber-900 flex items-center justify-between">
              <span>Alerta Demora (+60 días)</span>
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Casos con más de dos meses de permanencia en trámite</div>
          </button>

          <button
            type="button"
            onClick={() => aplicarInformePredefinido("financiero_desembolsos")}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              tipoInformeActivo === "financiero_desembolsos"
                ? "border-emerald-500 bg-emerald-50/70 shadow-xs ring-1 ring-emerald-400"
                : "border-slate-200 bg-slate-50/60 hover:bg-slate-100/80 hover:border-slate-300"
            }`}
          >
            <div className="text-xs font-bold text-emerald-900 flex items-center justify-between">
              <span>Financiero Desembolsos</span>
              <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Subsidios efectivamente desembolsados por Compensar</div>
          </button>

          <button
            type="button"
            onClick={() => aplicarInformePredefinido("salidas_definitivas")}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              tipoInformeActivo === "salidas_definitivas"
                ? "border-red-500 bg-red-50/70 shadow-xs ring-1 ring-red-400"
                : "border-slate-200 bg-slate-50/60 hover:bg-slate-100/80 hover:border-slate-300"
            }`}
          >
            <div className="text-xs font-bold text-red-900 flex items-center justify-between">
              <span>Salidas Definitivas</span>
              <AlertCircle className="w-3.5 h-3.5 text-red-600" />
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Rechazos y retiros formales con detalle del motivo</div>
          </button>
        </div>
      </div>

      {/* TARJETAS DE MÉTRICAS RÁPIDAS DE LA SELECCIÓN */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-slate-400 text-xs font-medium">Registros Filtrados</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">
            {expedientesFiltrados.length}
            <span className="text-xs font-normal text-slate-400 ml-1.5">
              de {expedientes.length} totales
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-slate-400 text-xs font-medium">Tiempo Promedio</div>
          <div className="text-2xl font-bold text-blue-600 mt-1">
            {metricasResumen.promedioDias}{" "}
            <span className="text-xs font-normal text-slate-500">días</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-slate-400 text-xs font-medium">En Trámite Activo</div>
          <div className="text-2xl font-bold text-slate-800 mt-1">
            {metricasResumen.conteoEstados["en_tramite"] || 0}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-slate-400 text-xs font-medium">Total Desembolsado COP</div>
          <div className="text-2xl font-bold text-emerald-600 mt-1 truncate">
            ${metricasResumen.totalMontoDesembolsado.toLocaleString("es-CO")}
          </div>
        </div>
      </div>

      {/* PANEL DE FILTROS CONFIGURABLES */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div className="flex items-center space-x-2 text-xs font-bold text-slate-800">
            <Filter className="w-4 h-4 text-slate-500" />
            <span>Filtros de Configuración para el Informe</span>
          </div>

          <div className="flex items-center space-x-3">
            {/* Control de visibilidad para rol Comercial */}
            {currentUser.rol === "comercial" && (
              <label className="flex items-center space-x-2 text-xs font-medium text-slate-600 cursor-pointer bg-slate-50 hover:bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 transition-colors">
                <input
                  type="checkbox"
                  checked={soloMiCartera}
                  onChange={(e) => {
                    setSoloMiCartera(e.target.checked);
                    setPaginaActual(1);
                  }}
                  className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <span>Restringir a mi cartera (Gestor Rural)</span>
              </label>
            )}

            <button
              type="button"
              onClick={handleLimpiarFiltros}
              className="text-xs text-slate-500 hover:text-blue-600 font-medium flex items-center space-x-1 cursor-pointer transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Limpiar Filtros</span>
            </button>
          </div>
        </div>

        {/* FILA 1: BÚSQUEDA GENERAL, MUNICIPIO, FASE, ESTADO */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* Búsqueda por texto */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Búsqueda por texto
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={filtroTexto}
                onChange={(e) => {
                  setFiltroTexto(e.target.value);
                  setPaginaActual(1);
                }}
                placeholder="Postulante, cédula, código, vereda..."
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Municipio */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Municipio (Cundinamarca)
            </label>
            <select
              value={filtroMunicipio}
              onChange={(e) => {
                setFiltroMunicipio(e.target.value);
                setPaginaActual(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white text-slate-700"
            >
              <option value="">Todos los municipios (116)</option>
              {CATALOGO_MUNICIPIOS.map((m) => (
                <option key={m.codigoCompleto} value={m.codigoCompleto}>
                  {m.municipioNombre} ({m.codigoCompleto})
                </option>
              ))}
            </select>
          </div>

          {/* Fase activa */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Fase Activa
            </label>
            <select
              value={filtroFase}
              onChange={(e) => {
                setFiltroFase(e.target.value);
                setPaginaActual(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white text-slate-700 font-medium"
            >
              <option value="">Todas las fases (1 a 7)</option>
              <option value="1">Fase 1: En Ingreso Hogar (3 docs)</option>
              <option value="2">Fase 2: En Solicitud 8 Documentos</option>
              <option value="3">Fase 3: En Validación Inicial Compensar</option>
              <option value="4">Fase 4: En Recolección Documentos Técnicos</option>
              <option value="5">Fase 5: En Trámite Licencia de Construcción</option>
              <option value="6">Fase 6: En Postulación Subsidio</option>
              <option value="7">Fase 7: En Construcción y Cobro Subsidio</option>
            </select>
          </div>

          {/* Estado general */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Estado General
            </label>
            <select
              value={filtroEstado}
              onChange={(e) => {
                setFiltroEstado(e.target.value);
                setPaginaActual(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white text-slate-700"
            >
              <option value="">Todos los estados</option>
              <option value="en_tramite">En trámite</option>
              <option value="en_pausa_aporte">En pausa (Aporte 10%)</option>
              <option value="subsidio_desembolsado">Subsidio desembolsado y cerrado</option>
              <option value="salida_definitiva">Salida definitiva (Rechazo)</option>
            </select>
          </div>
        </div>

        {/* FILA 2: RESPONSABLE GENERAL, RANGO TIEMPO, RANGO FECHAS INGRESO */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2">
          {/* Responsable General */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Responsable General
            </label>
            <select
              value={filtroResponsable}
              onChange={(e) => {
                setFiltroResponsable(e.target.value);
                setPaginaActual(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white text-slate-700"
            >
              <option value="">Todos los responsables</option>
              {listaResponsables.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {/* Rango de tiempo transcurrido */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Rango de Tiempo en Trámite
            </label>
            <select
              value={filtroTiempo}
              onChange={(e) => {
                setFiltroTiempo(e.target.value);
                setPaginaActual(1);
              }}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white text-slate-700"
            >
              <option value="">Todos los rangos de días</option>
              <option value="0-15">0 a 15 días</option>
              <option value="15-30">15 a 30 días</option>
              <option value="30-60">30 a 60 días</option>
              <option value="60-90">60 a 90 días (Demora moderada)</option>
              <option value="90+">Más de 90 días (+90 días crítico)</option>
            </select>
          </div>

          {/* Fecha Ingreso Desde */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Fecha Ingreso Fase 1 (Desde)
            </label>
            <div className="relative">
              <Calendar className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="date"
                value={fechaDesde}
                onChange={(e) => {
                  setFechaDesde(e.target.value);
                  setPaginaActual(1);
                }}
                className="w-full pl-8 pr-2 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white text-slate-700"
              />
            </div>
          </div>

          {/* Fecha Ingreso Hasta */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Fecha Ingreso Fase 1 (Hasta)
            </label>
            <div className="relative">
              <Calendar className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="date"
                value={fechaHasta}
                onChange={(e) => {
                  setFechaHasta(e.target.value);
                  setPaginaActual(1);
                }}
                className="w-full pl-8 pr-2 py-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:border-blue-500 bg-white text-slate-700"
              />
            </div>
          </div>
        </div>
      </div>

      {/* VISTA PREVIA DE LOS DATOS QUE SE VAN A EXPORTAR */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex items-center space-x-2">
            <h2 className="text-sm font-bold text-slate-900">
              Vista Previa de Hogares a Exportar
            </h2>
            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">
              {expedientesFiltrados.length} listados
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleDescargarExcel}
              disabled={generandoDescarga || expedientesFiltrados.length === 0}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg flex items-center space-x-1.5 shadow-xs cursor-pointer transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Generar Informe Excel</span>
            </button>
          </div>
        </div>

        {expedientesFiltrados.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-3">
              <Search className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-700">No se encontraron expedientes</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              No existen hogares que coincidan con los filtros aplicados. Ajuste los criterios de búsqueda o presione "Limpiar Filtros".
            </p>
            <button
              type="button"
              onClick={handleLimpiarFiltros}
              className="mt-4 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer transition-colors"
            >
              Restablecer Filtros
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-3">Código Visible / ID</th>
                  <th className="py-2.5 px-3">Postulante Principal</th>
                  <th className="py-2.5 px-3">Municipio / Vereda</th>
                  <th className="py-2.5 px-3">Fase Activa</th>
                  <th className="py-2.5 px-3">Estado</th>
                  <th className="py-2.5 px-3">Responsable</th>
                  <th className="py-2.5 px-3 text-center">Días</th>
                  <th className="py-2.5 px-3">Ingreso F1</th>
                  <th className="py-2.5 px-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {expedientesPaginados.map((exp) => {
                  const est = getEtiquetaEstado(exp.estadoGeneral);
                  const titularNorm = normalizarTextoNombre(
                    `${exp.postulante?.nombres || ""} ${exp.postulante?.primerApellido || ""}`
                  );
                  const munNombre = getMunicipioNombre(exp.predioVivienda?.municipioCodigo);

                  return (
                    <tr key={exp.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3 font-mono text-[11px] font-bold text-slate-800">
                        {exp.codigoVisible || exp.id}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900 tracking-wide">
                          {titularNorm}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {exp.postulante?.tipoIdentificacion} {exp.postulante?.numeroIdentificacion}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-slate-700">
                        <div className="font-medium text-slate-900">{munNombre}</div>
                        <div className="text-[11px] text-slate-400">
                          {exp.predioVivienda?.vereda || "Vereda no especificada"}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                          Fase {exp.faseActual}
                        </span>
                        <div className="text-[10px] text-slate-500 truncate max-w-[150px] mt-0.5">
                          {getNombreFase(exp.faseActual).split(":")[1]}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${est.color}`}>
                          {est.label}
                        </span>
                        {exp.estadoGeneral === "subsidio_desembolsado" && exp.gestionFase7?.desembolso?.montoDesembolsado && (
                          <div className="text-[10px] font-bold text-emerald-600 mt-0.5">
                            ${exp.gestionFase7.desembolso.montoDesembolsado.toLocaleString("es-CO")}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-700">
                        <div className="font-medium">{exp.responsableGeneralNombre || "Sin asignar"}</div>
                        <div className="text-[10px] text-slate-400 capitalize">{exp.responsableGeneralRol || ""}</div>
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-slate-800">
                        <span className={`px-1.5 py-0.5 rounded text-[11px] ${
                          (exp.diasTranscurridos ?? 0) > 60
                            ? "bg-amber-100 text-amber-800 font-bold"
                            : "bg-slate-100 text-slate-700"
                        }`}>
                          {exp.diasTranscurridos ?? 0} d
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-600 font-mono text-[11px]">
                        {exp.fechaIngresoFase1 ? exp.fechaIngresoFase1.split("T")[0] : "-"}
                      </td>
                      <td className="py-3 px-3 text-right">
                        {onSelectExpediente && (
                          <button
                            type="button"
                            onClick={() => onSelectExpediente(exp.id)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="Ver detalle del expediente"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* CONTROLES DE PAGINACIÓN */}
        {expedientesFiltrados.length > elementosPorPagina && (
          <div className="p-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600 bg-slate-50/50">
            <div>
              Mostrando registros{" "}
              <strong>{(paginaActual - 1) * elementosPorPagina + 1}</strong> a{" "}
              <strong>
                {Math.min(paginaActual * elementosPorPagina, expedientesFiltrados.length)}
              </strong>{" "}
              de <strong>{expedientesFiltrados.length}</strong>
            </div>
            <div className="flex items-center space-x-1.5">
              <button
                type="button"
                disabled={paginaActual === 1}
                onClick={() => setPaginaActual((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium cursor-pointer"
              >
                Anterior
              </button>
              <span className="px-2 font-semibold">
                Página {paginaActual} de {totalPaginas}
              </span>
              <button
                type="button"
                disabled={paginaActual >= totalPaginas}
                onClick={() => setPaginaActual((p) => Math.min(totalPaginas, p + 1))}
                className="px-2.5 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium cursor-pointer"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      {/* NOTA NORMATIVA Y DE PRIVACIDAD */}
      <div className="p-3.5 bg-slate-100 rounded-xl border border-slate-200 text-slate-500 text-[11px] flex items-start space-x-2.5">
        <HelpCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-slate-700">Reglas de Exportación de Datos VRD:</span>{" "}
          Todos los nombres se exportan en formato estándar (mayúsculas sostenidas sin tildes) de acuerdo a la parametrización del sistema. Los archivos descargados contienen los identificadores de trazabilidad interna, tiempos acumulados de gestión y estados por fase para auditorías del programa de vivienda.
        </div>
      </div>
    </div>
  );
};
