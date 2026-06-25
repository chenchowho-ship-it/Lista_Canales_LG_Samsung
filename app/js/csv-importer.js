/**
 * CSV Importer — Parse and map CSV data to channel entries.
 */

const CSVImporter = (() => {

  /**
   * Parse a CSV string into rows and detect headers.
   * @param {string} csvText - Raw CSV content
   * @param {string} delimiter - Column delimiter (auto-detected if omitted)
   * @returns {Object} { headers: string[], rows: string[][] }
   */
  function parse(csvText, delimiter) {
    if (!delimiter) {
      delimiter = detectDelimiter(csvText);
    }

    const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length === 0) return { headers: [], rows: [] };

    const headers = parseLine(lines[0], delimiter);
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
      const row = parseLine(lines[i], delimiter);
      if (row.length > 0 && row.some(cell => cell.trim() !== '')) {
        rows.push(row);
      }
    }

    return { headers, rows };
  }

  /**
   * Parse a single CSV line handling quoted fields.
   */
  function parseLine(line, delimiter) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (inQuotes) {
        if (char === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          current += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === delimiter) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
    }

    result.push(current.trim());
    return result;
  }

  /**
   * Auto-detect the delimiter used in the CSV.
   */
  function detectDelimiter(csvText) {
    const firstLine = csvText.split(/\r?\n/)[0] || '';
    const counts = {
      ',': (firstLine.match(/,/g) || []).length,
      ';': (firstLine.match(/;/g) || []).length,
      '\t': (firstLine.match(/\t/g) || []).length,
      '|': (firstLine.match(/\|/g) || []).length
    };

    let maxDelim = ',';
    let maxCount = 0;
    for (const [delim, count] of Object.entries(counts)) {
      if (count > maxCount) {
        maxCount = count;
        maxDelim = delim;
      }
    }

    return maxDelim;
  }

  /**
   * Map parsed CSV rows to channel objects using a column mapping.
   * @param {Object} parsed - { headers, rows } from parse()
   * @param {Object} mapping - Maps target fields to CSV header indices
   * @param {string} platform - "samsung" or "lg"
   * @param {string} channelType - "IP" or "RF"
   * @returns {Array} Array of channel objects
   */
  function mapToChannels(parsed, mapping, platform, channelType) {
    const channels = [];

    for (const row of parsed.rows) {
      const ch = {};

      for (const [field, colIndex] of Object.entries(mapping)) {
        if (colIndex !== null && colIndex !== undefined && colIndex >= 0 && colIndex < row.length) {
          ch[field] = row[colIndex];
        }
      }

      // Extraer automáticamente el número del canal si está en la misma celda que el nombre (ej. "1101 Azteca uno")
      // Esto maneja el caso donde mapean la columna combinada a 'name', a 'channelNumber' o a ambos.
      const combinedS = ch.name || ch.channelNumber || '';
      if (combinedS) {
        const match = combinedS.match(/^(\d+)[-\s]+(.*)$/);
        if (match) {
          if (!ch.channelNumber || ch.channelNumber === combinedS) ch.channelNumber = match[1];
          if (!ch.name || ch.name === combinedS) ch.name = match[2].trim();
        }
      }

      // Lo mismo para los campos de LG (logicalChannel y label)
      const combinedL = ch.label || ch.logicalChannel || '';
      if (combinedL) {
        const match = combinedL.match(/^(\d+)[-\s]+(.*)$/);
        if (match) {
          if (!ch.logicalChannel || ch.logicalChannel === combinedL) ch.logicalChannel = match[1];
          if (!ch.label || ch.label === combinedL) ch.label = match[2].trim();
        }
      }

      // Combinar IP y Puerto si el usuario mapeó la columna "Puerto"
      if (ch.url && ch.port) {
        let cleanUrl = ch.url.toString().trim();
        let cleanPort = ch.port.toString().trim();
        // Solo combinar si la IP no tiene ya un puerto incluido
        if (!cleanUrl.includes(':' + cleanPort)) {
          // Si ya tiene algún puerto (ej. 1.1.1.1:2000) lo dejamos, si no, se lo agregamos
          if (!/:\d+$/.test(cleanUrl)) {
            ch.url = `${cleanUrl}:${cleanPort}`;
          }
        }
        delete ch.port; // Eliminamos la propiedad para que no se use por separado
      }

      // Forzar prefijo udp:// si es una URL/IP de IPTV y no lo tiene
      if (ch.url && typeof ch.url === 'string') {
        let cleanUrl = ch.url.trim();
        if (!/^[a-zA-Z]+:\/\//.test(cleanUrl)) {
          cleanUrl = 'udp://' + cleanUrl;
        }
        ch.url = cleanUrl;
      }

      if (platform === 'lg') {
        ch.streamType = channelType === 'IP' ? 'IP' : 'Cable';
        ch.listingID = '';
        ch.icon = '';
        ch.enabled = 'true';
        ch.startChannel = 'false';
        ch.osd = 'false';
        ch.mediaType = '1';
        ch.encrypted = 'false';
        if (channelType === 'IP') {
          ch.ipType = 'UDP';
        }
      }

      channels.push(ch);
    }

    return channels;
  }

  /**
   * Try to auto-map CSV headers to known fields.
   * @param {Array} headers - CSV column headers
   * @param {string} platform - "samsung" or "lg"
   * @param {string} channelType - "IP" or "RF"
   * @returns {Object} Suggested mapping { fieldName: headerIndex }
   */
  function autoMap(headers, platform, channelType) {
    const mapping = {};
    const normalized = headers.map(h => h.toLowerCase().replace(/\s*\(opcional\)$/i, '').trim());

    // Common patterns
    const patterns = {
      channelNumber: [/^no\.?\s*canal$/i, /^(canal|channel)\s*(number|num|nr|#|no\.?)?$/i, /^(numero|número)\s*de\s*canal$/i, /^(numero|número)$/i, /^(logical|logico|lógico)$/i, /^(major\s*nr|majornr)$/i, /^#$/],
      name: [/^(nombre|name|label|canal\s*name|channel\s*name)$/i, /^(etiqueta)$/i],
      label: [/^(nombre|name|label|canal\s*name|channel\s*name)$/i, /^(etiqueta)$/i],
      url: [/^(ip|url|stream|multicast|direccion|dirección|ip\s*address)$/i, /^(udp|rtp)$/i],
      port: [/^(puerto|port|ip\s*port)$/i],
      serviceId: [/^(srv_id|service\s*id|sid|service|prog\s*#)$/i],
      iconUrl: [/^(icon|icono|ícono|icon\s*url|url\s*del\s*[ií]cono|channel\s*logo)$/i],
      major: [/^(major|physical|fisico|físico|mayor)$/i, /^(ptc)$/i, /^major\s*\(canal\s*f[ií]sico\)$/i],
      minor: [/^(minor|program|programa|menor)$/i, /^minor\s*\(programa\)$/i],
      atsc3: [/^(atsc\s*3\.0|atsc3|atsc)$/i],
      plpId: [/^(plp\s*id|plpid)$/i],
      sourceAddress: [/^(source\s*address|source|src\s*ip|ip\s*origen|direccion\s*origen)$/i],
      osd: [/^(osd|on\s*screen\s*display)$/i],
      blankVideo: [/^(blank\s*video|blank|pantalla\s*negra)$/i],
      zones: [/^(zones|restricted\s*from\s*zones|zonas|zonas\s*restringidas)$/i],
      ipType: [/^(tipo\s*ip|ip\s*type)$/i],
      rf: [/^(rf|ptc|frecuencia)$/i],
      category: [/^(categor[ií]a|category|genre|genero|género)$/i],
      encrypted: [/^(encrypted|encriptado|cifrado)$/i],
      enabled: [/^(enabled|habilitado|activo|active)$/i]
    };

    for (const [field, regexList] of Object.entries(patterns)) {
      for (let i = 0; i < normalized.length; i++) {
        for (const regex of regexList) {
          if (regex.test(headers[i])) {
            mapping[field] = i;
            break;
          }
        }
        if (mapping[field] !== undefined) break;
      }
    }

    return mapping;
  }

  /**
   * Get the required and optional fields for a platform/type combo.
   */
  function getFieldDefinitions(platform, channelType) {
    if (platform === 'samsung') {
      if (channelType === 'IP') {
        return {
          required: ['channelNumber', 'name', 'url', 'port'],
          optional: ['iconUrl']
        };
      } else {
        return {
          required: ['channelNumber', 'name'],
          optional: ['serviceId', 'iconUrl']
        };
      }
    } else {
      if (channelType === 'RF') {
        return {
          required: ['channelNumber', 'label', 'major', 'minor'],
          optional: ['category']
        };
      } else {
        return {
          required: ['channelNumber', 'label', 'url', 'port'],
          optional: ['category']
        };
      }
    }
  }

  /**
   * Get human-readable field labels in Spanish.
   */
  function getFieldLabels(platform, channelType) {
    if (platform === 'lg' && channelType === 'RF') {
      return {
        channelNumber: 'No. Canal',
        label: 'Nombre',
        category: 'Category',
        major: 'Mayor',
        minor: 'Menor'
      };
    } else if (platform === 'lg' && channelType === 'IP') {
      return {
        channelNumber: 'No. Canal',
        label: 'Nombre',
        url: 'IP',
        port: 'Puerto',
        category: 'Category'
      };
    }

    return {
      channelNumber: 'Número de Canal',
      name: 'Nombre',
      url: 'IP',
      sourceAddress: 'IP de Origen',
      serviceId: 'Service ID',
      iconUrl: 'URL del Ícono',
      major: 'Mayor',
      minor: 'Menor',
      atsc3: 'ATSC 3.0',
      plpId: 'PLP ID',
      osd: 'OSD',
      blankVideo: 'Video en Negro',
      zones: 'Zonas Restringidas',
      category: 'Categoría',
      encrypted: 'Encriptado',
      enabled: 'Habilitado',
      streamType: 'Tipo de Stream',
      mediaType: 'Tipo de Media',
      ipType: 'Tipo IP',
      port: 'Puerto',
      rf: 'RF'
    };
  }

  /**
   * Parse an Excel file (ArrayBuffer) into rows and detect headers.
   * Uses SheetJS (XLSX) library which must be loaded before this module.
   * @param {ArrayBuffer} buffer - File contents as ArrayBuffer
   * @param {number} sheetIndex - Which sheet to read (0 = first)
   * @returns {Object} { headers: string[], rows: string[][], sheetNames: string[] }
   */
  function parseExcel(buffer, sheetIndex = 0) {
    if (typeof XLSX === 'undefined') {
      throw new Error('La librería SheetJS (XLSX) no está cargada.');
    }

    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetNames = workbook.SheetNames;

    if (sheetIndex >= sheetNames.length) {
      throw new Error(`La hoja ${sheetIndex + 1} no existe. El archivo tiene ${sheetNames.length} hoja(s).`);
    }

    const sheet = workbook.Sheets[sheetNames[sheetIndex]];
    // Convert to array-of-arrays; raw:false gives formatted strings
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });

    if (!data || data.length === 0) {
      return { headers: [], rows: [], sheetNames };
    }

    const headers = data[0].map(h => String(h).trim());
    const rows = data.slice(1)
      .map(row => row.map(cell => String(cell ?? '').trim()))
      .filter(row => row.some(cell => cell !== ''));

    return { headers, rows, sheetNames };
  }

  return { parse, parseExcel, mapToChannels, autoMap, getFieldDefinitions, getFieldLabels };

})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CSVImporter;
}

