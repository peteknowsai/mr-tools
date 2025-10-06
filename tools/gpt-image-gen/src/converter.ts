import { writeFileSync } from "fs";
import { join, extname } from "path";

export class ImageConverter {
  /**
   * Convert base64 string to binary Uint8Array
   */
  static base64ToBinary(base64: string): Uint8Array {
    // Remove data URL prefix if present
    const cleanBase64 = base64.replace(/^data:image\/[a-z]+;base64,/, "");
    
    // Decode base64 to binary string
    const binaryString = atob(cleanBase64);
    
    // Convert to Uint8Array
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    return bytes;
  }

  /**
   * Detect image format from binary data
   */
  static detectFormat(data: Uint8Array): string {
    // Check magic bytes
    if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4E && data[3] === 0x47) {
      return "png";
    }
    if (data[0] === 0xFF && data[1] === 0xD8 && data[2] === 0xFF) {
      return "jpg";
    }
    if (data[8] === 0x57 && data[9] === 0x45 && data[10] === 0x42 && data[11] === 0x50) {
      return "webp";
    }
    
    // Default to PNG
    return "png";
  }

  /**
   * Save base64 image to file
   */
  static async saveBase64ToFile(
    base64: string,
    outputPath: string,
    format?: string
  ): Promise<{ path: string; size: number }> {
    const binaryData = this.base64ToBinary(base64);
    
    // Detect format if not specified
    if (!format) {
      format = this.detectFormat(binaryData);
    }
    
    // Ensure correct extension
    if (!outputPath.includes(".")) {
      outputPath += `.${format}`;
    } else if (extname(outputPath).slice(1) !== format) {
      // Replace extension if it doesn't match
      outputPath = outputPath.replace(/\.[^.]+$/, `.${format}`);
    }
    
    // Write file using Bun
    await Bun.write(outputPath, binaryData);
    
    return {
      path: outputPath,
      size: binaryData.length
    };
  }

  /**
   * Generate filename with timestamp
   */
  static generateFilename(
    prefix: string = "image",
    format: string = "png",
    index?: number
  ): string {
    const timestamp = new Date().toISOString()
      .replace(/[:.]/g, "-")
      .replace("T", "_")
      .slice(0, -5);
    
    const indexSuffix = index !== undefined ? `_${index}` : "";
    return `${prefix}_${timestamp}${indexSuffix}.${format}`;
  }

  /**
   * Format file size for display
   */
  static formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
}