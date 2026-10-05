/**
 * Utilidad para conversión automática de imágenes (JPG, PNG, WEBP) a formato PDF estándar.
 * Genera una estructura PDF-1.4 válida con el stream de imagen incrustado.
 */

function generarPdfConJpeg(jpegBytes: Uint8Array, width: number, height: number): Blob {
  // Dimensiones estándar A4 en puntos (72 pt / pulgada: 595.28 x 841.89 pt)
  const pWidth = 595.28;
  const pHeight = 841.89;

  // Ajustar la imagen respetando proporciones dentro de los márgenes
  const margin = 28.35; // 1 cm de margen
  const maxW = pWidth - margin * 2;
  const maxH = pHeight - margin * 2;
  const scale = Math.min(maxW / width, maxH / height, 1);
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
    [
      partHeader,
      part1,
      part2,
      part3,
      part4H,
      jpegBytes,
      part4F,
      part5,
      partXref,
      partTrailer
    ],
    { type: "application/pdf" }
  );
}

/**
 * Convierte un archivo de imagen en un File de formato application/pdf
 */
export async function convertirImagenAPdf(file: File): Promise<File> {
  // Si ya es PDF o no es imagen, retornar tal cual
  const esImagen = file.type.startsWith("image/") || /\.(jpg|jpeg|png|webp|bmp|tiff)$/i.test(file.name);
  if (file.type === "application/pdf" || !esImagen) {
    return file;
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        // Escalar resoluciones desmedidas para prevenir colapsos de memoria en Canvas de navegadores móviles
        let origW = img.naturalWidth || img.width || 1200;
        let origH = img.naturalHeight || img.height || 1600;
        const MAX_DIM = 2048;

        if (origW > MAX_DIM || origH > MAX_DIM) {
          if (origW > origH) {
            origH = Math.round((origH * MAX_DIM) / origW);
            origW = MAX_DIM;
          } else {
            origW = Math.round((origW * MAX_DIM) / origH);
            origH = MAX_DIM;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = origW;
        canvas.height = origH;
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file);
              return;
            }
            const readerBlob = new FileReader();
            readerBlob.onload = () => {
              try {
                const arrayBuffer = readerBlob.result as ArrayBuffer;
                const uint8Array = new Uint8Array(arrayBuffer);
                const pdfBlob = generarPdfConJpeg(uint8Array, canvas.width, canvas.height);
                const nombreSinExt = file.name.replace(/\.[^/.]+$/, "");
                const nombrePdf = `${nombreSinExt}.pdf`;
                const pdfFile = new File([pdfBlob], nombrePdf, { type: "application/pdf" });
                resolve(pdfFile);
              } catch {
                resolve(file);
              }
            };
            readerBlob.onerror = () => resolve(file);
            readerBlob.readAsArrayBuffer(blob);
          },
          "image/jpeg",
          0.88
        );
      };
      img.onerror = () => resolve(file);
      img.src = reader.result as string;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}
