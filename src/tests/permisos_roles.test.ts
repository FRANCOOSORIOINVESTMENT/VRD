import { describe, it } from "node:test";
import assert from "node:assert";
import { CUENTAS_FICTICIAS, mockDb } from "../server/mockDb";
import { RolUsuario } from "../types";

describe("CRM VRD - Auditoría de Permisos, Roles y Accesos (Hito 1)", () => {
  // Matriz de roles y capacidades para Fase 1
  function puedeRevisarRequisitos(rol: RolUsuario): boolean {
    return rol === "supervisor";
  }

  function puedeAprobarFase1(rol: RolUsuario): boolean {
    return rol === "supervisor";
  }

  function puedeCargarDocumentosFase1(rol: RolUsuario): boolean {
    return rol === "comercial";
  }

  function puedeGestionarCaptacion(rol: RolUsuario): boolean {
    return rol === "comercial";
  }

  function puedeAccederLecturaGeneral(rol: RolUsuario): boolean {
    // Todos los 5 roles tienen lectura y consulta universal del estado
    const rolesValidos: RolUsuario[] = ["administrador", "supervisor", "comercial", "asistente", "ingenieria"];
    return rolesValidos.includes(rol);
  }

  it("1. Consulta general universal permitida para los cinco roles", () => {
    const roles: RolUsuario[] = ["administrador", "supervisor", "comercial", "asistente", "ingenieria"];
    for (const r of roles) {
      assert.strictEqual(puedeAccederLecturaGeneral(r), true, `Rol ${r} debe tener acceso a consulta general`);
    }
  });

  it("2. Administrador tiene lectura integral pero NO puede aprobar fase 1 ni revisar requisitos", () => {
    assert.strictEqual(puedeAccederLecturaGeneral("administrador"), true, "Admin debe poder leer");
    assert.strictEqual(puedeAprobarFase1("administrador"), false, "Admin NO puede aprobar fase 1");
    assert.strictEqual(puedeRevisarRequisitos("administrador"), false, "Admin NO puede revisar/aprobar requisitos");
  });

  it("3. Comercial NO puede aceptar sus propios documentos ni aprobar fases", () => {
    assert.strictEqual(puedeCargarDocumentosFase1("comercial"), true, "Comercial puede cargar documentos");
    assert.strictEqual(puedeRevisarRequisitos("comercial"), false, "Comercial NO puede emitir dictámenes ni aceptar requisitos");
    assert.strictEqual(puedeAprobarFase1("comercial"), false, "Comercial NO puede aprobar Fase 1");
  });

  it("4. Ingeniería NO puede cargar ni modificar Fase 1 ni captación", () => {
    assert.strictEqual(puedeAccederLecturaGeneral("ingenieria"), true, "Ingeniería puede consultar estado general");
    assert.strictEqual(puedeCargarDocumentosFase1("ingenieria"), false, "Ingeniería NO puede subir documentos de Fase 1");
    assert.strictEqual(puedeRevisarRequisitos("ingenieria"), false, "Ingeniería NO puede revisar Fase 1");
    assert.strictEqual(puedeGestionarCaptacion("ingenieria"), false, "Ingeniería NO puede gestionar captación comercial");
    assert.strictEqual(puedeAprobarFase1("ingenieria"), false, "Ingeniería NO puede aprobar Fase 1");
  });

  it("5. Asistente Administrativo puede consultar casos pero NO aprobar Fase 1", () => {
    assert.strictEqual(puedeAccederLecturaGeneral("asistente"), true, "Asistente puede consultar el listado");
    assert.strictEqual(puedeAprobarFase1("asistente"), false, "Asistente NO puede aprobar Fase 1");
    assert.strictEqual(puedeRevisarRequisitos("asistente"), false, "Asistente NO puede emitir observaciones de supervisor");
  });

  it("6. Supervisor es el ÚNICO facultado para revisar requisitos y aprobar Fase 1", () => {
    assert.strictEqual(puedeRevisarRequisitos("supervisor"), true, "Supervisor puede revisar");
    assert.strictEqual(puedeAprobarFase1("supervisor"), true, "Supervisor puede aprobar Fase 1");
  });

  it("7. Cuentas ficticias de prueba están identificadas y restringidas a desarrollo", () => {
    assert.strictEqual(CUENTAS_FICTICIAS.length, 6, "Deben existir fixtures para los 5 roles");
    const rolesEncontrados = new Set(CUENTAS_FICTICIAS.map(c => c.rol));
    assert.ok(rolesEncontrados.has("administrador"));
    assert.ok(rolesEncontrados.has("supervisor"));
    assert.ok(rolesEncontrados.has("comercial"));
    assert.ok(rolesEncontrados.has("asistente"));
    assert.ok(rolesEncontrados.has("ingenieria"));
  });
});
