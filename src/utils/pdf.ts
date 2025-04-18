
import { PDFDocument } from 'pdf-lib';
import { ApiError } from './errors';

/**
 * Convert an image buffer to PDF
 */
export async function convertImageToPdf(
  imageBuffer: ArrayBuffer,
  mimeType: string
): Promise<Uint8Array> {
  try {
    const pdfDoc = await PDFDocument.create();
    
    let img;
    if (mimeType === 'image/png') {
      img = await pdfDoc.embedPng(imageBuffer);
    } else if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
      img = await pdfDoc.embedJpg(imageBuffer);
    } else {
      throw new ApiError(400, `Unsupported image format: ${mimeType}`);
    }
    
    // Create a page with the same dimensions as the image
    const page = pdfDoc.addPage([img.width, img.height]);
    
    // Draw the image on the page
    page.drawImage(img, {
      x: 0,
      y: 0,
      width: img.width,
      height: img.height,
    });
    
    // Serialize the PDF to bytes
    return await pdfDoc.save();
  } catch (error) {
    console.error('PDF conversion error:', error);
    throw new ApiError(500, 'Failed to convert image to PDF');
  }
}

/**
 * Verify if a buffer is a valid PDF
 */
export async function isValidPDF(buffer: ArrayBuffer): Promise<boolean> {
  try {
    await PDFDocument.load(buffer);
    return true;
  } catch (error) {
    return false;
  }
}
