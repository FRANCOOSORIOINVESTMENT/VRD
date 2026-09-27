/**
 * Mapeo y formateo de nomenclatura operativa de roles (CAMBIO 2)
 * Comercial -> Gestor Rural
 * Asistente Administrativo -> Gestor Documental
 * Supervisor / Supervisora Jurídica -> Analista Documental
 * Ingeniería -> Ingeniería
 */

export function formatearRol(rol?: string): string {
  if (!rol) return "";
  const r = rol.toLowerCase().trim();
  if (r === "comercial") return "Gestor Rural";
  if (r === "asistente" || r === "asistente administrativo" || r === "asistente adm." || r === "asistente adm") return "Gestor Documental";
  if (r === "supervisor" || r === "supervisora" || r === "supervisora jurídica" || r === "supervisora juridica" || r === "supervisor jurídico" || r === "supervisor juridico" || r === "supervisor jur." || r === "supervisor jur") return "Analista Documental";
  if (r === "ingenieria" || r === "ingeniería") return "Ingeniería";
  if (r === "administrador") return "Administrador";
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
    .replace(/\(Supervisora Jurídica\)/gi, "(Analista Documental)")
    .replace(/\(Supervisor Jurídico\)/gi, "(Analista Documental)")
    .replace(/\(Supervisor Jur\.\)/gi, "(Analista Documental)")
    .replace(/\(Supervisora\)/gi, "(Analista Documental)")
    .replace(/\(Supervisor\)/gi, "(Analista Documental)");
}
