/**
 * File Importer — Import existing .json (Samsung) and .xml (LG) files.
 */

const FileImporter = (() => {

  /**
   * Read a file selected by the user and return its contents.
   * @param {File} file - File object from input or drag-drop
   * @returns {Promise<{content: string, name: string, extension: string}>}
   */
  function readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      const name = file.name;
      const extension = name.split('.').pop().toLowerCase();

      reader.onload = () => {
        resolve({
          content: reader.result,
          name: name,
          extension: extension
        });
      };

      reader.onerror = () => {
        reject(new Error(`Error al leer el archivo: ${file.name}`));
      };

      reader.readAsText(file, 'UTF-8');
    });
  }

  /**
   * Detect the platform from file content/extension.
   * @param {string} content - File content
   * @param {string} extension - File extension
   * @returns {string} "samsung" or "lg" or "unknown"
   */
  function detectPlatform(content, extension) {
    if (extension === 'json') {
      try {
        const data = JSON.parse(content);
        if (data._Profiles || data.Version) {
          return 'samsung';
        }
      } catch (e) {
        // Not valid JSON
      }
    }

    if (extension === 'xml') {
      if (content.includes('<Channels') || content.includes('<Channel')) {
        return 'lg';
      }
    }

    return 'unknown';
  }

  /**
   * Import a file and return parsed channels + config.
   * @param {File} file - File object
   * @returns {Promise<{platform: string, channels: Array, config: Object, channelType: string}>}
   */
  async function importFile(file) {
    const { content, name, extension } = await readFile(file);
    const platform = detectPlatform(content, extension);

    if (platform === 'samsung') {
      const result = SamsungGenerator.parse(content);
      return {
        platform: 'samsung',
        channels: result.channels,
        config: result.config,
        channelType: result.config.channelType || 'IP'
      };
    }

    if (platform === 'lg') {
      const result = LGGenerator.parse(content);
      return {
        platform: 'lg',
        channels: result.channels,
        config: result.config,
        channelType: result.config.channelType || 'RF'
      };
    }

    throw new Error(`Formato de archivo no reconocido: .${extension}. Usa archivos .json (Samsung) o .xml (LG).`);
  }

  /**
   * Import a CSV or Excel file and return parsed data for column mapping.
   * Automatically detects format by extension.
   * @param {File} file - CSV or Excel file
   * @returns {Promise<Object>} { headers: string[], rows: string[][], sheetNames?: string[] }
   */
  async function importSpreadsheet(file) {
    const name = file.name;
    const extension = name.split('.').pop().toLowerCase();

    if (extension === 'xlsx' || extension === 'xls' || extension === 'xlsb' || extension === 'ods') {
      // Read as ArrayBuffer for SheetJS
      const buffer = await readFileAsArrayBuffer(file);
      return CSVImporter.parseExcel(buffer);
    } else {
      // Default: treat as CSV/text
      const { content } = await readFile(file);
      return CSVImporter.parse(content);
    }
  }

  /**
   * Read a file as ArrayBuffer (needed for Excel parsing).
   * @param {File} file
   * @returns {Promise<ArrayBuffer>}
   */
  function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(new Uint8Array(reader.result));
      reader.onerror = () => reject(new Error(`Error al leer el archivo: ${file.name}`));
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Trigger a file download in the browser.
   * @param {string} content - File content
   * @param {string} filename - Download filename
   * @param {string} mimeType - MIME type
   */
  function downloadFile(content, filename, mimeType) {
    // Soporte para navegadores basados en versiones antiguas de Edge/IE
    if (window.navigator && window.navigator.msSaveOrOpenBlob) {
      const blob = new Blob([content], { type: mimeType });
      window.navigator.msSaveOrOpenBlob(blob, filename);
      return;
    }

    // Usar Data URI en lugar de Blob URI. Esto asegura que el navegador respete el atributo 'download'
    // incluso si sus políticas de seguridad bloquean descargas de objetos blob locales.
    const encoded = encodeURIComponent(content);
    const dataUri = `data:${mimeType};charset=utf-8,${encoded}`;
    
    const link = document.createElement('a');
    link.style.display = 'none';
    link.href = dataUri;
    link.download = filename;
    document.body.appendChild(link);
    
    link.click();
    
    document.body.removeChild(link);
  }

  /**
   * Export channels to the appropriate format and trigger download.
   * @param {Array} channels - Channel array
   * @param {string} platform - "samsung" or "lg"
   * @param {Object} config - Platform config
   * @param {string} filename - Optional filename
   */
  function exportFile(channels, platform, config, filename) {
    if (platform === 'samsung') {
      const json = SamsungGenerator.generate(channels, config);
      const fname = filename || 'hotel.json';
      downloadFile(json, fname, 'application/json');
    } else if (platform === 'lg') {
      const xml = LGGenerator.generate(channels, config);
      const fname = filename || 'LISTA_CANALES.xml';
      downloadFile(xml, fname, 'application/xml');
    }
  }

  return { readFile, detectPlatform, importFile, importSpreadsheet, downloadFile, exportFile };

})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = FileImporter;
}
