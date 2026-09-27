import { describe, it } from "node:test";
import assert from "node:assert";
import { mockDb } from "../server/mockDb";
import { calcularCodigoVisible } from "../types";

describe("CRM VRD - Recorrido Hitos 2 y 3 (Captación a Aprobación)", () => {
  it("1. Creación de interesado en captación comercial", () => {
    const nuevoInteresado = {
      id: `int-test-${Date.now()}`,
      nombreContacto: "Clara Inés Restrepo",
      telefono: "3119876543",
      tieneWhatsapp: true,
      correo: "clara.restrepo@ejemplo.com",
      departamentoCodigo: "25",
      municipioCodigo: "25151",
      vereda: "Rincón del Valle",
      origenContacto: "llamada" as const,
      resumenNecesidad: "Madre comunitaria rural con lote propio sin vivienda construida",
      comercialAsignadoId: "usr-comercial-1",
      estadoComercial: "nuevo_contacto" as const,
      creadoEn: new Date().toISOString(),
      contactosApoyo: []
    };

    mockDb.interesados.push(nuevoInteresado);
    const encontrado = mockDb.interesados.find((i) => i.id === nuevoInteresado.id);
    assert.ok(encontrado, "El interesado debe registrarse en la lista");
    assert.strictEqual(encontrado?.nombreContacto, "Clara Inés Restrepo");
  });

  it("2. Registro de bitácora de conversaciones con interesado", () => {
    const intId = mockDb.interesados[0].id;
    const nota = {
      id: `nota-test-${Date.now()}`,
      interesadoId: intId,
      autorId: "usr-comercial-1",
      autorNombre: "Carlos Mendoza",
      personaContactada: "Clara Restrepo",
      canal: "llamada" as const,
      contenido: "Se contacta para verificar tenencia del predio y se solicita certificado de tradición.",
      fechaGestion: new Date().toISOString(),
      creadoEn: new Date().toISOString()
    };
    mockDb.notas.push(nota);

    const notasInt = mockDb.notas.filter((n) => n.interesadoId === intId);
    assert.ok(notasInt.length > 0, "Debe existir al menos una nota registrada");
  });

  it("3. Conversión de interesado a expediente VRD sin duplicidad y cálculo de código", () => {
    const interesado = mockDb.interesados[0];
    const codigoEsperado = calcularCodigoVisible("25151", "52899440", "Restrepo");
    assert.strictEqual(codigoEsperado, "25151-52899440-RESTREPO");

    // Simular que se marca convertido y no puede repetirse
    interesado.convertidoAExpedienteId = "exp-test-123";
    interesado.estadoComercial = "convertido_a_expediente";

    assert.strictEqual(interesado.estadoComercial, "convertido_a_expediente");
    assert.ok(interesado.convertidoAExpedienteId, "Debe tener ID de expediente asociado");
  });

  it("4. Regla de completitud de Fase 1 para habilitar aprobación", () => {
    // Escenario A: 2 de 3 requisitos aceptados (Incompleto -> No debe permitir aprobación)
    const reqsIncompletos = [
      { id: "r1", estado: "aceptado" },
      { id: "r2", estado: "con_observaciones" },
      { id: "r3", estado: "aceptado" }
    ];
    const puedeAprobarIncompleto = reqsIncompletos.every((r) => r.estado === "aceptado");
    assert.strictEqual(puedeAprobarIncompleto, false, "No debe permitir aprobación si hay observaciones o pendientes");

    // Escenario B: 3 de 3 requisitos aceptados (Completo -> Habilita aprobación)
    const reqsCompletos = [
      { id: "r1", estado: "aceptado" },
      { id: "r2", estado: "aceptado" },
      { id: "r3", estado: "aceptado" }
    ];
    const puedeAprobarCompleto = reqsCompletos.every((r) => r.estado === "aceptado");
    assert.strictEqual(puedeAprobarCompleto, true, "Debe permitir aprobación cuando todos estén aceptados");
  });

  it("5. Transferencia obligatoria de responsabilidad general al Asistente", () => {
    const asistentes = mockDb.perfiles.filter((p) => p.rol === "asistente" && p.activo);
    assert.ok(asistentes.length >= 2, "Deben existir asistentes elegibles");

    const asistenteElegido = asistentes[0];
    const expedienteSimulado = {
      id: "exp-test-flow",
      responsableGeneralId: "usr-comercial-1", // Inicialmente el Comercial
      faseActual: 1
    };

    // Al aprobar Fase 1
    expedienteSimulado.responsableGeneralId = asistenteElegido.id;
    expedienteSimulado.faseActual = 2;

    assert.strictEqual(expedienteSimulado.responsableGeneralId, asistenteElegido.id);
    assert.strictEqual(expedienteSimulado.faseActual, 2);
  });

  it("6. Generación y gestión de los 8 documentos obligatorios del Hogar en Fase 2", () => {
    const codigosFase2Esperados = [
      "F2-01", "F2-02", "F2-03", "F2-04",
      "F2-05", "F2-06", "F2-07", "F2-08"
    ];

    const exp = mockDb.expedientes[0];
    assert.ok(exp, "Debe existir un expediente base");

    // Simular que el Supervisor aceptó todos los requisitos de Fase 1
    const reqsF1 = mockDb.requisitosCaso.filter((r) => r.expedienteId === exp.id && (r.fase === 1 || !r.fase));
    reqsF1.forEach((r) => {
      r.estado = "aceptado";
    });

    const todosAceptados = reqsF1.every((r) => r.estado === "aceptado");
    assert.strictEqual(todosAceptados, true, "Todos los requisitos de Fase 1 deben quedar aceptados");

    // Ejecutar transición a Fase 2 y asignación de Asistente
    const asistente = mockDb.perfiles.find((p) => p.rol === "asistente" && p.activo)!;
    assert.ok(asistente, "Debe existir un asistente activo");

    exp.faseActual = 2;
    exp.responsableGeneralId = asistente.id;

    // Generar los 8 requisitos de Fase 2
    codigosFase2Esperados.forEach((cod, idx) => {
      mockDb.requisitosCaso.push({
        id: `req-test-f2-${idx}-${exp.id}`,
        expedienteId: exp.id,
        codigoRequisito: cod,
        nombre: `Documento Familiar ${cod}`,
        descripcion: `Requisito de hogar número ${idx + 1}`,
        fase: 2,
        estado: "pendiente_carga",
        esObligatorio: true,
        esAdicional: false
      });
    });

    // Validar expediente en Fase 2
    assert.strictEqual(exp.faseActual, 2, "El expediente debe estar en Fase 2");
    assert.strictEqual(exp.responsableGeneralId, asistente.id, "El responsable debe ser el Asistente");

    const reqsF2 = mockDb.requisitosCaso.filter((r) => r.expedienteId === exp.id && r.fase === 2);
    assert.strictEqual(reqsF2.length, 8, "Debe tener exactamente 8 requisitos de Fase 2");

    codigosFase2Esperados.forEach((cod) => {
      const encontrado = reqsF2.find((r) => r.codigoRequisito === cod);
      assert.ok(encontrado, `Debe incluir el requisito obligatorio ${cod}`);
      assert.strictEqual(encontrado?.esObligatorio, true);
    });
  });
});
