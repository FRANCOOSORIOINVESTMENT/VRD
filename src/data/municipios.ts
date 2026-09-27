// CRM VRD — FRANCO OSORIO INVESTMENT S.A.S.
// Catálogo Municipal Oficial - Departamento de Cundinamarca (25)
// Estándar oficial DANE de 5 dígitos (2 departamento + 3 municipio)
// Ordenado alfabéticamente. Estructura extensible para futuros departamentos.

export interface MunicipioDANE {
  codigoCompleto: string; // 5 dígitos DPMPP
  departamentoCodigo: string; // 2 dígitos (ej: "25")
  municipioCodigo: string; // 3 dígitos (ej: "151")
  departamentoNombre: string;
  municipioNombre: string;
}

export interface DepartamentoConfig {
  codigo: string;
  nombre: string;
  activo: boolean; // Permitir al administrador habilitar nuevos departamentos
}

export const DEPARTAMENTOS_CONFIG: DepartamentoConfig[] = [
  { codigo: "25", nombre: "Cundinamarca", activo: true }
  // Estructura lista para que el administrador agregue otros departamentos en el futuro
];

// Listado oficial completo de los 116 municipios de Cundinamarca ordenados alfabéticamente
export const CATALOGO_MUNICIPIOS: MunicipioDANE[] = [
  { codigoCompleto: "25001", departamentoCodigo: "25", municipioCodigo: "001", departamentoNombre: "Cundinamarca", municipioNombre: "Agua de Dios" },
  { codigoCompleto: "25019", departamentoCodigo: "25", municipioCodigo: "019", departamentoNombre: "Cundinamarca", municipioNombre: "Albán" },
  { codigoCompleto: "25035", departamentoCodigo: "25", municipioCodigo: "035", departamentoNombre: "Cundinamarca", municipioNombre: "Anapoima" },
  { codigoCompleto: "25040", departamentoCodigo: "25", municipioCodigo: "040", departamentoNombre: "Cundinamarca", municipioNombre: "Anolaima" },
  { codigoCompleto: "25599", departamentoCodigo: "25", municipioCodigo: "599", departamentoNombre: "Cundinamarca", municipioNombre: "Apulo (Rafael Reyes)" },
  { codigoCompleto: "25053", departamentoCodigo: "25", municipioCodigo: "053", departamentoNombre: "Cundinamarca", municipioNombre: "Arbeláez" },
  { codigoCompleto: "25086", departamentoCodigo: "25", municipioCodigo: "086", departamentoNombre: "Cundinamarca", municipioNombre: "Beltrán" },
  { codigoCompleto: "25095", departamentoCodigo: "25", municipioCodigo: "095", departamentoNombre: "Cundinamarca", municipioNombre: "Bituima" },
  { codigoCompleto: "25099", departamentoCodigo: "25", municipioCodigo: "099", departamentoNombre: "Cundinamarca", municipioNombre: "Bojacá" },
  { codigoCompleto: "25120", departamentoCodigo: "25", municipioCodigo: "120", departamentoNombre: "Cundinamarca", municipioNombre: "Cabrera" },
  { codigoCompleto: "25123", departamentoCodigo: "25", municipioCodigo: "123", departamentoNombre: "Cundinamarca", municipioNombre: "Cachipay" },
  { codigoCompleto: "25126", departamentoCodigo: "25", municipioCodigo: "126", departamentoNombre: "Cundinamarca", municipioNombre: "Cajicá" },
  { codigoCompleto: "25148", departamentoCodigo: "25", municipioCodigo: "148", departamentoNombre: "Cundinamarca", municipioNombre: "Caparrapí" },
  { codigoCompleto: "25151", departamentoCodigo: "25", municipioCodigo: "151", departamentoNombre: "Cundinamarca", municipioNombre: "Cáqueza" },
  { codigoCompleto: "25154", departamentoCodigo: "25", municipioCodigo: "154", departamentoNombre: "Cundinamarca", municipioNombre: "Carmen de Carupa" },
  { codigoCompleto: "25168", departamentoCodigo: "25", municipioCodigo: "168", departamentoNombre: "Cundinamarca", municipioNombre: "Chaguaní" },
  { codigoCompleto: "25175", departamentoCodigo: "25", municipioCodigo: "175", departamentoNombre: "Cundinamarca", municipioNombre: "Chía" },
  { codigoCompleto: "25178", departamentoCodigo: "25", municipioCodigo: "178", departamentoNombre: "Cundinamarca", municipioNombre: "Chipaque" },
  { codigoCompleto: "25181", departamentoCodigo: "25", municipioCodigo: "181", departamentoNombre: "Cundinamarca", municipioNombre: "Choachí" },
  { codigoCompleto: "25183", departamentoCodigo: "25", municipioCodigo: "183", departamentoNombre: "Cundinamarca", municipioNombre: "Chocontá" },
  { codigoCompleto: "25200", departamentoCodigo: "25", municipioCodigo: "200", departamentoNombre: "Cundinamarca", municipioNombre: "Cogua" },
  { codigoCompleto: "25214", departamentoCodigo: "25", municipioCodigo: "214", departamentoNombre: "Cundinamarca", municipioNombre: "Cota" },
  { codigoCompleto: "25224", departamentoCodigo: "25", municipioCodigo: "224", departamentoNombre: "Cundinamarca", municipioNombre: "Cucunubá" },
  { codigoCompleto: "25245", departamentoCodigo: "25", municipioCodigo: "245", departamentoNombre: "Cundinamarca", municipioNombre: "El Colegio" },
  { codigoCompleto: "25258", departamentoCodigo: "25", municipioCodigo: "258", departamentoNombre: "Cundinamarca", municipioNombre: "El Peñón" },
  { codigoCompleto: "25260", departamentoCodigo: "25", municipioCodigo: "260", departamentoNombre: "Cundinamarca", municipioNombre: "El Rosal" },
  { codigoCompleto: "25269", departamentoCodigo: "25", municipioCodigo: "269", departamentoNombre: "Cundinamarca", municipioNombre: "Facatativá" },
  { codigoCompleto: "25279", departamentoCodigo: "25", municipioCodigo: "279", departamentoNombre: "Cundinamarca", municipioNombre: "Fómeque" },
  { codigoCompleto: "25281", departamentoCodigo: "25", municipioCodigo: "281", departamentoNombre: "Cundinamarca", municipioNombre: "Fosca" },
  { codigoCompleto: "25286", departamentoCodigo: "25", municipioCodigo: "286", departamentoNombre: "Cundinamarca", municipioNombre: "Funza" },
  { codigoCompleto: "25288", departamentoCodigo: "25", municipioCodigo: "288", departamentoNombre: "Cundinamarca", municipioNombre: "Fúquene" },
  { codigoCompleto: "25290", departamentoCodigo: "25", municipioCodigo: "290", departamentoNombre: "Cundinamarca", municipioNombre: "Fusagasugá" },
  { codigoCompleto: "25293", departamentoCodigo: "25", municipioCodigo: "293", departamentoNombre: "Cundinamarca", municipioNombre: "Gachalá" },
  { codigoCompleto: "25295", departamentoCodigo: "25", municipioCodigo: "295", departamentoNombre: "Cundinamarca", municipioNombre: "Gachancipá" },
  { codigoCompleto: "25297", departamentoCodigo: "25", municipioCodigo: "297", departamentoNombre: "Cundinamarca", municipioNombre: "Gachetá" },
  { codigoCompleto: "25299", departamentoCodigo: "25", municipioCodigo: "299", departamentoNombre: "Cundinamarca", municipioNombre: "Gama" },
  { codigoCompleto: "25307", departamentoCodigo: "25", municipioCodigo: "307", departamentoNombre: "Cundinamarca", municipioNombre: "Girardot" },
  { codigoCompleto: "25312", departamentoCodigo: "25", municipioCodigo: "312", departamentoNombre: "Cundinamarca", municipioNombre: "Granada" },
  { codigoCompleto: "25317", departamentoCodigo: "25", municipioCodigo: "317", departamentoNombre: "Cundinamarca", municipioNombre: "Guachetá" },
  { codigoCompleto: "25320", departamentoCodigo: "25", municipioCodigo: "320", departamentoNombre: "Cundinamarca", municipioNombre: "Guaduas" },
  { codigoCompleto: "25322", departamentoCodigo: "25", municipioCodigo: "322", departamentoNombre: "Cundinamarca", municipioNombre: "Guasca" },
  { codigoCompleto: "25324", departamentoCodigo: "25", municipioCodigo: "324", departamentoNombre: "Cundinamarca", municipioNombre: "Guataquí" },
  { codigoCompleto: "25326", departamentoCodigo: "25", municipioCodigo: "326", departamentoNombre: "Cundinamarca", municipioNombre: "Guatavita" },
  { codigoCompleto: "25328", departamentoCodigo: "25", municipioCodigo: "328", departamentoNombre: "Cundinamarca", municipioNombre: "Guayabal de Síquima" },
  { codigoCompleto: "25335", departamentoCodigo: "25", municipioCodigo: "335", departamentoNombre: "Cundinamarca", municipioNombre: "Guayabetal" },
  { codigoCompleto: "25339", departamentoCodigo: "25", municipioCodigo: "339", departamentoNombre: "Cundinamarca", municipioNombre: "Gutiérrez" },
  { codigoCompleto: "25368", departamentoCodigo: "25", municipioCodigo: "368", departamentoNombre: "Cundinamarca", municipioNombre: "Jerusalén" },
  { codigoCompleto: "25372", departamentoCodigo: "25", municipioCodigo: "372", departamentoNombre: "Cundinamarca", municipioNombre: "Junín" },
  { codigoCompleto: "25377", departamentoCodigo: "25", municipioCodigo: "377", departamentoNombre: "Cundinamarca", municipioNombre: "La Calera" },
  { codigoCompleto: "25386", departamentoCodigo: "25", municipioCodigo: "386", departamentoNombre: "Cundinamarca", municipioNombre: "La Mesa" },
  { codigoCompleto: "25394", departamentoCodigo: "25", municipioCodigo: "394", departamentoNombre: "Cundinamarca", municipioNombre: "La Palma" },
  { codigoCompleto: "25398", departamentoCodigo: "25", municipioCodigo: "398", departamentoNombre: "Cundinamarca", municipioNombre: "La Peña" },
  { codigoCompleto: "25402", departamentoCodigo: "25", municipioCodigo: "402", departamentoNombre: "Cundinamarca", municipioNombre: "La Vega" },
  { codigoCompleto: "25407", departamentoCodigo: "25", municipioCodigo: "407", departamentoNombre: "Cundinamarca", municipioNombre: "Lenguazaque" },
  { codigoCompleto: "25426", departamentoCodigo: "25", municipioCodigo: "426", departamentoNombre: "Cundinamarca", municipioNombre: "Machetá" },
  { codigoCompleto: "25430", departamentoCodigo: "25", municipioCodigo: "430", departamentoNombre: "Cundinamarca", municipioNombre: "Madrid" },
  { codigoCompleto: "25436", departamentoCodigo: "25", municipioCodigo: "436", departamentoNombre: "Cundinamarca", municipioNombre: "Manta" },
  { codigoCompleto: "25438", departamentoCodigo: "25", municipioCodigo: "438", departamentoNombre: "Cundinamarca", municipioNombre: "Medina" },
  { codigoCompleto: "25473", departamentoCodigo: "25", municipioCodigo: "473", departamentoNombre: "Cundinamarca", municipioNombre: "Mosquera" },
  { codigoCompleto: "25483", departamentoCodigo: "25", municipioCodigo: "483", departamentoNombre: "Cundinamarca", municipioNombre: "Nariño" },
  { codigoCompleto: "25486", departamentoCodigo: "25", municipioCodigo: "486", departamentoNombre: "Cundinamarca", municipioNombre: "Nemocón" },
  { codigoCompleto: "25488", departamentoCodigo: "25", municipioCodigo: "488", departamentoNombre: "Cundinamarca", municipioNombre: "Nilo" },
  { codigoCompleto: "25489", departamentoCodigo: "25", municipioCodigo: "489", departamentoNombre: "Cundinamarca", municipioNombre: "Nimaima" },
  { codigoCompleto: "25491", departamentoCodigo: "25", municipioCodigo: "491", departamentoNombre: "Cundinamarca", municipioNombre: "Nocaima" },
  { codigoCompleto: "25513", departamentoCodigo: "25", municipioCodigo: "513", departamentoNombre: "Cundinamarca", municipioNombre: "Pacho" },
  { codigoCompleto: "25518", departamentoCodigo: "25", municipioCodigo: "518", departamentoNombre: "Cundinamarca", municipioNombre: "Paime" },
  { codigoCompleto: "25524", departamentoCodigo: "25", municipioCodigo: "524", departamentoNombre: "Cundinamarca", municipioNombre: "Pandi" },
  { codigoCompleto: "25530", departamentoCodigo: "25", municipioCodigo: "530", departamentoNombre: "Cundinamarca", municipioNombre: "Paratebueno" },
  { codigoCompleto: "25535", departamentoCodigo: "25", municipioCodigo: "535", departamentoNombre: "Cundinamarca", municipioNombre: "Pasca" },
  { codigoCompleto: "25572", departamentoCodigo: "25", municipioCodigo: "572", departamentoNombre: "Cundinamarca", municipioNombre: "Puerto Salgar" },
  { codigoCompleto: "25580", departamentoCodigo: "25", municipioCodigo: "580", departamentoNombre: "Cundinamarca", municipioNombre: "Pulí" },
  { codigoCompleto: "25592", departamentoCodigo: "25", municipioCodigo: "592", departamentoNombre: "Cundinamarca", municipioNombre: "Quebradanegra" },
  { codigoCompleto: "25594", departamentoCodigo: "25", municipioCodigo: "594", departamentoNombre: "Cundinamarca", municipioNombre: "Quetame" },
  { codigoCompleto: "25596", departamentoCodigo: "25", municipioCodigo: "596", departamentoNombre: "Cundinamarca", municipioNombre: "Quipile" },
  { codigoCompleto: "25612", departamentoCodigo: "25", municipioCodigo: "612", departamentoNombre: "Cundinamarca", municipioNombre: "Ricaurte" },
  { codigoCompleto: "25645", departamentoCodigo: "25", municipioCodigo: "645", departamentoNombre: "Cundinamarca", municipioNombre: "San Antonio del Tequendama" },
  { codigoCompleto: "25649", departamentoCodigo: "25", municipioCodigo: "649", departamentoNombre: "Cundinamarca", municipioNombre: "San Bernardo" },
  { codigoCompleto: "25653", departamentoCodigo: "25", municipioCodigo: "653", departamentoNombre: "Cundinamarca", municipioNombre: "San Cayetano" },
  { codigoCompleto: "25658", departamentoCodigo: "25", municipioCodigo: "658", departamentoNombre: "Cundinamarca", municipioNombre: "San Francisco" },
  { codigoCompleto: "25662", departamentoCodigo: "25", municipioCodigo: "662", departamentoNombre: "Cundinamarca", municipioNombre: "San Juan de Rioseco" },
  { codigoCompleto: "25718", departamentoCodigo: "25", municipioCodigo: "718", departamentoNombre: "Cundinamarca", municipioNombre: "Sasaima" },
  { codigoCompleto: "25736", departamentoCodigo: "25", municipioCodigo: "736", departamentoNombre: "Cundinamarca", municipioNombre: "Sesquilé" },
  { codigoCompleto: "25740", departamentoCodigo: "25", municipioCodigo: "740", departamentoNombre: "Cundinamarca", municipioNombre: "Sibaté" },
  { codigoCompleto: "25743", departamentoCodigo: "25", municipioCodigo: "743", departamentoNombre: "Cundinamarca", municipioNombre: "Silvania" },
  { codigoCompleto: "25745", departamentoCodigo: "25", municipioCodigo: "745", departamentoNombre: "Cundinamarca", municipioNombre: "Simijaca" },
  { codigoCompleto: "25754", departamentoCodigo: "25", municipioCodigo: "754", departamentoNombre: "Cundinamarca", municipioNombre: "Soacha" },
  { codigoCompleto: "25758", departamentoCodigo: "25", municipioCodigo: "758", departamentoNombre: "Cundinamarca", municipioNombre: "Sopó" },
  { codigoCompleto: "25769", departamentoCodigo: "25", municipioCodigo: "769", departamentoNombre: "Cundinamarca", municipioNombre: "Subachoque" },
  { codigoCompleto: "25772", departamentoCodigo: "25", municipioCodigo: "772", departamentoNombre: "Cundinamarca", municipioNombre: "Suesca" },
  { codigoCompleto: "25777", departamentoCodigo: "25", municipioCodigo: "777", departamentoNombre: "Cundinamarca", municipioNombre: "Supatá" },
  { codigoCompleto: "25779", departamentoCodigo: "25", municipioCodigo: "779", departamentoNombre: "Cundinamarca", municipioNombre: "Susa" },
  { codigoCompleto: "25781", departamentoCodigo: "25", municipioCodigo: "781", departamentoNombre: "Cundinamarca", municipioNombre: "Sutatausa" },
  { codigoCompleto: "25785", departamentoCodigo: "25", municipioCodigo: "785", departamentoNombre: "Cundinamarca", municipioNombre: "Tabio" },
  { codigoCompleto: "25793", departamentoCodigo: "25", municipioCodigo: "793", departamentoNombre: "Cundinamarca", municipioNombre: "Tausa" },
  { codigoCompleto: "25797", departamentoCodigo: "25", municipioCodigo: "797", departamentoNombre: "Cundinamarca", municipioNombre: "Tena" },
  { codigoCompleto: "25799", departamentoCodigo: "25", municipioCodigo: "799", departamentoNombre: "Cundinamarca", municipioNombre: "Tenjo" },
  { codigoCompleto: "25805", departamentoCodigo: "25", municipioCodigo: "805", departamentoNombre: "Cundinamarca", municipioNombre: "Tibacuy" },
  { codigoCompleto: "25807", departamentoCodigo: "25", municipioCodigo: "807", departamentoNombre: "Cundinamarca", municipioNombre: "Tibirita" },
  { codigoCompleto: "25815", departamentoCodigo: "25", municipioCodigo: "815", departamentoNombre: "Cundinamarca", municipioNombre: "Tocaima" },
  { codigoCompleto: "25817", departamentoCodigo: "25", municipioCodigo: "817", departamentoNombre: "Cundinamarca", municipioNombre: "Tocancipá" },
  { codigoCompleto: "25823", departamentoCodigo: "25", municipioCodigo: "823", departamentoNombre: "Cundinamarca", municipioNombre: "Topaipí" },
  { codigoCompleto: "25839", departamentoCodigo: "25", municipioCodigo: "839", departamentoNombre: "Cundinamarca", municipioNombre: "Ubalá" },
  { codigoCompleto: "25841", departamentoCodigo: "25", municipioCodigo: "841", departamentoNombre: "Cundinamarca", municipioNombre: "Ubaque" },
  { codigoCompleto: "25843", departamentoCodigo: "25", municipioCodigo: "843", departamentoNombre: "Cundinamarca", municipioNombre: "Ubaté" },
  { codigoCompleto: "25845", departamentoCodigo: "25", municipioCodigo: "845", departamentoNombre: "Cundinamarca", municipioNombre: "Une" },
  { codigoCompleto: "25851", departamentoCodigo: "25", municipioCodigo: "851", departamentoNombre: "Cundinamarca", municipioNombre: "Útica" },
  { codigoCompleto: "25506", departamentoCodigo: "25", municipioCodigo: "506", departamentoNombre: "Cundinamarca", municipioNombre: "Venecia (Ospina Pérez)" },
  { codigoCompleto: "25862", departamentoCodigo: "25", municipioCodigo: "862", departamentoNombre: "Cundinamarca", municipioNombre: "Vergara" },
  { codigoCompleto: "25867", departamentoCodigo: "25", municipioCodigo: "867", departamentoNombre: "Cundinamarca", municipioNombre: "Vianí" },
  { codigoCompleto: "25871", departamentoCodigo: "25", municipioCodigo: "871", departamentoNombre: "Cundinamarca", municipioNombre: "Villagómez" },
  { codigoCompleto: "25873", departamentoCodigo: "25", municipioCodigo: "873", departamentoNombre: "Cundinamarca", municipioNombre: "Villapinzón" },
  { codigoCompleto: "25875", departamentoCodigo: "25", municipioCodigo: "875", departamentoNombre: "Cundinamarca", municipioNombre: "Villeta" },
  { codigoCompleto: "25878", departamentoCodigo: "25", municipioCodigo: "878", departamentoNombre: "Cundinamarca", municipioNombre: "Viotá" },
  { codigoCompleto: "25885", departamentoCodigo: "25", municipioCodigo: "885", departamentoNombre: "Cundinamarca", municipioNombre: "Yacopí" },
  { codigoCompleto: "25898", departamentoCodigo: "25", municipioCodigo: "898", departamentoNombre: "Cundinamarca", municipioNombre: "Zipacón" },
  { codigoCompleto: "25899", departamentoCodigo: "25", municipioCodigo: "899", departamentoNombre: "Cundinamarca", municipioNombre: "Zipaquirá" }
];

// Helper para buscar un municipio por código DANE de 5 dígitos
export function buscarMunicipioPorCodigo(codigoCompleto: string): MunicipioDANE | undefined {
  return CATALOGO_MUNICIPIOS.find((m) => m.codigoCompleto === codigoCompleto);
}

// Helper para formatear las opciones del dropdown según el estándar solicitado: "NOMBRE (Código DANE)"
export function getNombreMunicipioConCodigo(codigoCompleto: string): string {
  const muni = CATALOGO_MUNICIPIOS.find((m) => m.codigoCompleto === codigoCompleto);
  if (!muni) return `Municipio (${codigoCompleto})`;
  return `${muni.municipioNombre} (${muni.codigoCompleto})`;
}
