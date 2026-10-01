import React from "react";
import { Expediente, RequisitoCaso } from "../types";
import { resolverNombreMunicipio, NOMBRES_FASES, ETIQUETAS_ESTADOS } from "../utils/exportarReportes";
import { Building2, Printer, X, CheckSquare, Square, Calendar, MapPin, User, Home, Shield, FileText } from "lucide-react";

interface FichaTecnicaImprimibleProps {
  expediente: Expediente;
  requisitos?: RequisitoCaso[];
  onCerrar?: () => void;
}

export const FichaTecnicaImprimible: React.FC<FichaTecnicaImprimibleProps> = ({
  expediente,
  requisitos = [],
  onCerrar
}) => {
  const post = expediente.postulante || ({} as any);
  const pred = expediente.predioVivienda || ({} as any);
  const hogar = expediente.hogar || { integrantes: [] };
  const fechaHoy = new Date().toLocaleDateString("es-CO", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });

  const nombrePostulante =
    post.nombres ||
    `${post.primerNombre || ""} ${post.segundoNombre || ""} ${post.primerApellido || ""} ${post.segundoApellido || ""}`.trim() ||
    "Postulante No Registrado";

  // Requisitos clave del programa para el checklist oficial de la ficha
  const checklistClave = [
    { codigo: "F1-01", nombre: "Certificado de Tradición y Libertad (vigencia < 90 días)" },
    { codigo: "F1-02", nombre: "Impuesto Predial Unificado (año en curso)" },
    { codigo: "F1-03", nombre: "Cédula de Ciudadanía del Postulante Principal" },
    { codigo: "F2-04", nombre: "Cédulas de Ciudadanía / Identidad de Integrantes del Hogar" },
    { codigo: "F2-08", nombre: "Certificación de Cuenta Bancaria / Aporte del 10%" },
    { codigo: "F3-01", nombre: "Concepto Favorable de Viabilidad de Lote y Visita de Campo" },
    { codigo: "F4-01", nombre: "Planos Arquitectónicos y Estructurales (NSR-10)" },
    { codigo: "F4-02", nombre: "Estudio Geotécnico / Mecánica de Suelos" },
    { codigo: "F5-01", nombre: "Acto de Radicación y Licencia de Construcción (Curaduría / Planeación)" },
    { codigo: "F6-01", nombre: "Formulario Oficial y Postulación Subsidio Compensar / MinVivienda" }
  ];

  const handleImprimir = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex justify-center p-2 sm:p-6 print:p-0 print:bg-white print:static print:overflow-visible">
      {/* Estilos específicos de impresión */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #ficha-imprimible-root, #ficha-imprimible-root * {
            visibility: visible;
          }
          #ficha-imprimible-root {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 0;
            background: white !important;
            color: black !important;
          }
          .no-print {
            display: none !important;
          }
          .page-break-inside-avoid {
            page-break-inside: avoid;
            break-inside: avoid;
          }
          @page {
            size: letter portrait;
            margin: 1.2cm;
          }
        }
      `}</style>

      <div
        id="ficha-imprimible-root"
        className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col print:shadow-none print:border-none print:max-w-none print:rounded-none"
      >
        {/* Barra superior de controles en pantalla (oculta al imprimir) */}
        <div className="no-print bg-slate-900 text-white px-6 py-3 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <Printer className="w-5 h-5 text-blue-400" />
            <span className="text-xs font-bold uppercase tracking-wider">
              Vista Previa de Impresión • Ficha Técnica Oficial VRD
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleImprimir}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center space-x-2 shadow-xs transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir / Guardar como PDF</span>
            </button>
            {onCerrar && (
              <button
                type="button"
                onClick={onCerrar}
                className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                title="Cerrar vista previa"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* HOJA IMPRIMIBLE DE LA FICHA TÉCNICA (FORMATO CARTA A4)                    */}
        {/* ========================================================================= */}
        <div className="p-8 sm:p-10 space-y-6 text-slate-900 bg-white print:p-0">
          {/* CABECERA INSTITUCIONAL */}
          <div className="border-b-2 border-slate-900 pb-4 flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-slate-900 text-white rounded-xl print:bg-black">
                <Building2 className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-black tracking-tight text-slate-900 uppercase">
                  FRANCO OSORIO INVESTMENT S.A.S.
                </h1>
                <p className="text-xs font-bold text-blue-700 uppercase tracking-wider print:text-black">
                  PROGRAMA VIVIENDA RURAL DIGNA (VRD)
                </p>
                <p className="text-[10px] text-slate-500 font-medium">
                  Acompañamiento Técnico, Jurídico y Social para Vivienda en Sitio Propio
                </p>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                CÓDIGO DE EXPEDIENTE
              </span>
              <span className="font-mono text-base font-black text-slate-900 bg-slate-100 px-2.5 py-1 rounded border border-slate-300 inline-block mt-0.5 print:border-black">
                {expediente.codigoVisible || expediente.id}
              </span>
              <p className="text-[10px] text-slate-500 mt-1">
                Emisión: <strong>{fechaHoy}</strong>
              </p>
            </div>
          </div>

          {/* ESTADO DEL TRÁMITE Y FASE ACTIVA */}
          <div className="grid grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 print:border-slate-400">
            <div>
              <span className="text-[9px] font-bold uppercase text-slate-500 block">Fase Operativa Actual</span>
              <span className="text-xs font-black text-blue-900 print:text-black">
                {NOMBRES_FASES[expediente.faseActual] || `Fase ${expediente.faseActual}`}
              </span>
            </div>
            <div>
              <span className="text-[9px] font-bold uppercase text-slate-500 block">Estado General</span>
              <span className="text-xs font-bold text-slate-900">
                {ETIQUETAS_ESTADOS[expediente.estadoGeneral] || expediente.estadoGeneral}
              </span>
            </div>
            <div>
              <span className="text-[9px] font-bold uppercase text-slate-500 block">Días en Trámite</span>
              <span className="text-xs font-bold text-slate-900">
                {expediente.diasTranscurridos ?? 0} días transcurridos
              </span>
            </div>
          </div>

          {/* SECCIÓN 1: DATOS DEL POSTULANTE PRINCIPAL (TITULAR) */}
          <div className="page-break-inside-avoid">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 bg-slate-100 px-3 py-1 rounded mb-2.5 flex items-center space-x-1.5 border-l-4 border-blue-600 print:border-black">
              <User className="w-3.5 h-3.5 text-blue-600 print:text-black" />
              <span>1. Identificación del Postulante Principal</span>
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs p-1">
              <div>
                <span className="text-[10px] text-slate-500 font-semibold block">Nombre Completo:</span>
                <span className="font-bold text-slate-900 uppercase">{nombrePostulante}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-semibold block">Documento:</span>
                <span className="font-mono font-bold text-slate-900">
                  {post.tipoIdentificacion || "CC"} {post.numeroIdentificacion || "N/A"}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-semibold block">Teléfono de Contacto:</span>
                <span className="font-medium text-slate-800">{post.telefonoPrincipal || "Sin registrar"}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-semibold block">Correo Electrónico:</span>
                <span className="font-medium text-slate-800">{post.correo || "No registrado"}</span>
              </div>
            </div>
          </div>

          {/* SECCIÓN 2: DATOS DEL PREDIO Y LOCALIZACIÓN GEOGRÁFICA */}
          <div className="page-break-inside-avoid">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 bg-slate-100 px-3 py-1 rounded mb-2.5 flex items-center space-x-1.5 border-l-4 border-blue-600 print:border-black">
              <MapPin className="w-3.5 h-3.5 text-blue-600 print:text-black" />
              <span>2. Localización y Datos del Predio Rural</span>
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs p-1">
              <div>
                <span className="text-[10px] text-slate-500 font-semibold block">Departamento / Municipio:</span>
                <span className="font-bold text-slate-900">
                  CUNDINAMARCA • {resolverNombreMunicipio(pred.municipioCodigo)} ({pred.municipioCodigo || "25899"})
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-semibold block">Vereda / Sector:</span>
                <span className="font-bold text-slate-900">{pred.vereda || "Rural"}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-semibold block">Nombre / Dirección Predio:</span>
                <span className="font-medium text-slate-800">{pred.nombreODireccion || "Lote rural"}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-semibold block">Matrícula Inmobiliaria:</span>
                <span className="font-mono font-medium text-slate-800">
                  {pred.matriculaInmobiliaria || "En verificación documental"}
                </span>
              </div>
            </div>
          </div>

          {/* SECCIÓN 3: CONFORMACIÓN DEL HOGAR POSTULANTE */}
          <div className="page-break-inside-avoid">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 bg-slate-100 px-3 py-1 rounded mb-2.5 flex items-center justify-between border-l-4 border-blue-600 print:border-black">
              <span className="flex items-center space-x-1.5">
                <Home className="w-3.5 h-3.5 text-blue-600 print:text-black" />
                <span>3. Conformación del Núcleo Familiar (Hogar)</span>
              </span>
              <span className="text-[10px] font-normal text-slate-500">
                Total Integrantes: {hogar.integrantes?.length || 1}
              </span>
            </h2>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[10px] font-bold text-slate-600 uppercase border-b border-slate-200">
                  <tr>
                    <th className="py-1.5 px-3">#</th>
                    <th className="py-1.5 px-3">Nombre Completo</th>
                    <th className="py-1.5 px-3">Identificación</th>
                    <th className="py-1.5 px-3">Parentesco Declarado</th>
                    <th className="py-1.5 px-3">Rol en el Trámite</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {hogar.integrantes && hogar.integrantes.length > 0 ? (
                    hogar.integrantes.map((int: any, idx: number) => {
                      const per = int.persona || {};
                      const nomInt = per.nombres || `${per.primerNombre || ''} ${per.primerApellido || ''}`.trim() || "Integrante";
                      return (
                        <tr key={int.id || idx}>
                          <td className="py-1 px-3 text-[11px] text-slate-400">{idx + 1}</td>
                          <td className="py-1 px-3 font-semibold text-slate-800 uppercase">{nomInt}</td>
                          <td className="py-1 px-3 font-mono text-slate-600">
                            {per.tipoIdentificacion || "CC"} {per.numeroIdentificacion || "N/A"}
                          </td>
                          <td className="py-1 px-3 text-slate-700 capitalize">{int.parentesco || "Familiar"}</td>
                          <td className="py-1 px-3 font-bold text-[10px]">
                            {int.esPostulantePrincipal ? (
                              <span className="text-blue-700 print:text-black">POSTULANTE TITULAR</span>
                            ) : (
                              <span className="text-slate-500">Beneficiario Hogar</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-2 px-3 text-center text-slate-500 italic">
                        Solo figura el postulante principal registrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* SECCIÓN 4: CHECKLIST OFICIAL DE DOCUMENTACIÓN Y REQUISITOS */}
          <div className="page-break-inside-avoid">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 bg-slate-100 px-3 py-1 rounded mb-2.5 flex items-center space-x-1.5 border-l-4 border-blue-600 print:border-black">
              <FileText className="w-3.5 h-3.5 text-blue-600 print:text-black" />
              <span>4. Estado de Requisitos y Checklist Documental</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {checklistClave.map((item) => {
                // Verificar si el requisito existe en el expediente y está aceptado
                const reqEncontrado = requisitos.find((r) => r.codigoRequisito === item.codigo);
                const estaAceptado = reqEncontrado?.estado === "aceptado";

                return (
                  <div
                    key={item.codigo}
                    className="flex items-start space-x-2 p-1.5 rounded border border-slate-100 bg-slate-50/50 print:bg-white print:border-slate-200"
                  >
                    {estaAceptado ? (
                      <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5 print:text-black" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-300 shrink-0 mt-0.5 print:text-slate-400" />
                    )}
                    <div className="leading-tight">
                      <span className="font-mono font-bold text-[10px] text-slate-500 mr-1.5">
                        [{item.codigo}]
                      </span>
                      <span className={`text-[11px] ${estaAceptado ? "font-bold text-slate-900" : "text-slate-600"}`}>
                        {item.nombre}
                      </span>
                      {estaAceptado && (
                        <span className="text-[9px] text-emerald-700 font-bold ml-1 print:text-black">
                          (APROBADO)
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECCIÓN 5: EQUIPO RESPONSABLE Y TRAZABILIDAD */}
          <div className="page-break-inside-avoid bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs flex justify-between">
            <div>
              <span className="text-[9px] font-bold uppercase text-slate-500 block">Gestor Comercial Asignado</span>
              <span className="font-bold text-slate-800">{expediente.comercialOrigenNombre || "Gestor Rural"}</span>
            </div>
            <div>
              <span className="text-[9px] font-bold uppercase text-slate-500 block">Responsable General / Analista</span>
              <span className="font-bold text-slate-800">{expediente.responsableGeneralNombre || "Dra. Helena Ramírez"}</span>
            </div>
            <div>
              <span className="text-[9px] font-bold uppercase text-slate-500 block">Fecha de Registro Oficial</span>
              <span className="font-bold text-slate-800">
                {expediente.fechaIngresoFase1 ? new Date(expediente.fechaIngresoFase1).toLocaleDateString("es-CO") : "N/A"}
              </span>
            </div>
          </div>

          {/* SECCIÓN 6: BLOQUE DE FIRMAS INSTITUCIONALES */}
          <div className="page-break-inside-avoid pt-10">
            <div className="grid grid-cols-3 gap-6 text-center text-xs">
              <div>
                <div className="border-t border-slate-900 pt-2 mx-4 print:border-black">
                  <p className="font-bold text-slate-900 uppercase text-[11px]">{nombrePostulante}</p>
                  <p className="text-[10px] text-slate-500">
                    C.C. {post.numeroIdentificacion || "____________________"}
                  </p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">
                    Postulante Titular / Propietario
                  </p>
                </div>
              </div>

              <div>
                <div className="border-t border-slate-900 pt-2 mx-4 print:border-black">
                  <p className="font-bold text-slate-900 uppercase text-[11px]">
                    {expediente.comercialOrigenNombre || "Gestor Comercial"}
                  </p>
                  <p className="text-[10px] text-slate-500">Gestor de Captación y Enlace</p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">
                    Franco Osorio Investment S.A.S.
                  </p>
                </div>
              </div>

              <div>
                <div className="border-t border-slate-900 pt-2 mx-4 print:border-black">
                  <p className="font-bold text-slate-900 uppercase text-[11px]">
                    {expediente.responsableGeneralNombre || "Supervisor Técnico"}
                  </p>
                  <p className="text-[10px] text-slate-500">Revisión y Aprobación Documental</p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">
                    Supervisión Programa VRD
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* PIE DE PÁGINA */}
          <div className="border-t border-slate-200 pt-3 text-center text-[9px] text-slate-400 print:text-slate-600">
            Ficha técnica generada por el sistema CRM/ERP VRD • Franco Osorio Investment S.A.S. • Documento válido para trámites ante Cajas de Compensación y Curadurías Urbanas.
          </div>
        </div>
      </div>
    </div>
  );
};

export default FichaTecnicaImprimible;
