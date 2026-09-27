import { describe, it } from "node:test";
import assert from "node:assert";
import { calcularCodigoVisible } from "../types";
import { CATALOGO_MUNICIPIOS, buscarMunicipioPorCodigo } from "../data/municipios";

describe("CRM VRD - Pruebas Unitarias del Núcleo y Reglas de Negocio", () => {
  it("Código visible normaliza correctamente mayúsculas, acentos, Ñ y apellidos compuestos", () => {
    // Caso 1: FRANCO con tildes y diacríticos
    const cod1 = calcularCodigoVisible("25151", "75097530", "Fránco");
    assert.strictEqual(cod1, "25151-75097530-FRANCO");

    // Caso 2: Apellido con Ñ (debe convertirse en N)
    const cod2 = calcularCodigoVisible("05001", "1018945612", "Peña");
    assert.strictEqual(cod2, "05001-1018945612-PENA");

    // Caso 3: Apellido compuesto con espacios (DE LA ROSA -> DELAROSA)
    const cod3 = calcularCodigoVisible("25841", "52489632", "De La Rosa");
    assert.strictEqual(cod3, "25841-52489632-DELAROSA");

    // Caso 4: Conservación estricta de ceros iniciales en municipio de 5 dígitos (05001)
    const cod4 = calcularCodigoVisible("05001", "43058912", "Gómez");
    assert.strictEqual(cod4, "05001-43058912-GOMEZ");
  });

  it("Catálogo municipal conserva códigos oficiales de 5 dígitos de Cundinamarca (116 municipios)", () => {
    const aguadedios = buscarMunicipioPorCodigo("25001");
    assert.ok(aguadedios, "Agua de Dios debe existir con código 25001");
    assert.strictEqual(aguadedios?.codigoCompleto, "25001");
    assert.strictEqual(aguadedios?.departamentoCodigo, "25");

    const caqueza = buscarMunicipioPorCodigo("25151");
    assert.ok(caqueza, "Cáqueza debe existir con código 25151");
    assert.strictEqual(caqueza?.municipioNombre, "Cáqueza");
    assert.strictEqual(CATALOGO_MUNICIPIOS.length, 116, "Deben existir exactamente 116 municipios");
  });

  it("Validación de vigencia de 90 días calendario para Certificado de Tradición", () => {
    function esCertificadoVigente(fechaExpedicionISO: string, fechaEvaluacionISO: string): boolean {
      const msDia = 1000 * 60 * 60 * 24;
      const fExp = new Date(fechaExpedicionISO).getTime();
      const fEval = new Date(fechaEvaluacionISO).getTime();
      const dias = Math.floor((fEval - fExp) / msDia);
      return dias <= 90;
    }

    const fechaEval = "2026-09-04T10:00:00Z";
    // Exactamente 90 días antes
    const fecha90Dias = new Date(new Date(fechaEval).getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
    assert.strictEqual(esCertificadoVigente(fecha90Dias, fechaEval), true, "Día 90 debe ser válido");

    // 91 días antes
    const fecha91Dias = new Date(new Date(fechaEval).getTime() - 91 * 24 * 60 * 60 * 1000).toISOString();
    assert.strictEqual(esCertificadoVigente(fecha91Dias, fechaEval), false, "Día 91 debe ser inválido");
  });

  it("Normalización de nombres en 4 campos (mayúsculas, sin tildes, diacríticos removidos)", async () => {
    const { normalizarTextoNombre, construirNombreCompleto } = await import("../utils/normalizacion.js");

    assert.strictEqual(normalizarTextoNombre("María José"), "MARIA JOSE");
    assert.strictEqual(normalizarTextoNombre("Peña"), "PENA");
    assert.strictEqual(normalizarTextoNombre("  Óscar   Andrés "), "OSCAR ANDRES");
    assert.strictEqual(normalizarTextoNombre(""), "");

    const nombreCompleto = construirNombreCompleto("María", "José", "Gómez", "Peña");
    assert.strictEqual(nombreCompleto, "MARIA JOSE GOMEZ PENA");

    const sinSegundoNombre = construirNombreCompleto("Juan", undefined, "Pérez", undefined);
    assert.strictEqual(sinSegundoNombre, "JUAN PEREZ");
  });
});
