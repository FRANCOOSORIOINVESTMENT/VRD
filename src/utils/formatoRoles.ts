/**
 * Mapeo y formateo de roles oficiales de la base de datos Supabase
 * Rol oficial base: supervisor -> Supervisor
 * Comercial -> Gestor Rural
 * Asistente Administrativo -> Gestor Documental
 * Ingeniería -> Ingeniería
 * Planeación -> Planeación y Auditoría
 * Administrador -> Administrador
 */

export function formatearRol(rol?: string): string {
  if (!rol) return "";
  const r = rol.toLowerCase().trim();
  if (
    r === "supervisor" ||
    r === "supervisora" ||
    r === "supervisor jurídico" ||
    r === "supervisora jurídica" ||
    r === "analista documental" ||
    r === "analista" ||
    r === "juridico"
  ) {
    return "Supervisor";
  }
  if (r === "comercial" || r === "gestor_rural" || r === "gestor rural") return "Gestor Rural";
  if (r === "asistente" || r === "gestor_documental" || r === "gestor documental" || r === "asistente administrativo" || r === "asistente adm." || r === "asistente adm") return "Gestor Documental";
  if (r === "ingenieria" || r === "ingeniería") return "Ingeniería";
  if (r === "planeacion" || r === "planeación") return "Planeación y Auditoría";
  if (r === "administrador" || r === "admin") return "Administrador";
  return rol;
}

export function formatearNombreUsuario(nombre?: string): string {
  if (!nombre) return "";
  return nombre
    .replace(/\(Comercial\)/gi, "(Gestor Rural)")
    .replace(/\(Asistente Administrativo II\)/gi, "(Gestor Documental II)")
    .replace(/\(Asistente Adm\. II\)/gi, "(Gestor Documental II)")
    .replace(/\(Asistente Administrativo\)/gi, "(Gestor Documental)")
    .replace(/\(Asistente Adm\.\)/gi, "(Gestor Documental)")
    .replace(/\(Asistente\)/gi, "(Gestor Documental)")
    .replace(/\(Supervisora Jurídica\)/gi, "(Supervisor)")
    .replace(/\(Supervisor Jurídico\)/gi, "(Supervisor)")
    .replace(/\(Supervisor Jur\.\)/gi, "(Supervisor)")
    .replace(/\(Analista Documental\)/gi, "(Supervisor)");
}
