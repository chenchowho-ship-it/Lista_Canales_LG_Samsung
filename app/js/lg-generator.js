/**
 * LG ProCentric Direct — XML Channel List Generator
 * Generates the exact XML structure expected by ProCentric Direct.
 */

const LGGenerator = (() => {

  /**
   * Generate the full XML string for LG ProCentric Direct.
   * @param {Array} channels - Array of channel objects
   * @param {Object} config - Configuration options
   * @param {string} config.locale - "ATSC" (default)
   * @param {string} config.channelType - "RF" or "IP"
   * @returns {string} XML string
   */
  function generate(channels, config = {}) {
    const locale = config.locale || 'ATSC';
    const channelType = config.channelType || 'RF';

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += `  <Channels locale="${escapeXml(locale)}" >\n`;

    for (const ch of channels) {
      const type = ch._type || config.channelType;
      if (type === 'RF') {
        xml += buildRFChannel(ch);
      } else {
        xml += buildIPChannel(ch);
      }
    }

    xml += '  </Channels>\n';
    return xml;
  }

  /**
   * Build an RF-ATSC channel block.
   */
  function buildRFChannel(ch) {
    const logical = ch.logicalChannel || ch.channelNumber || '1';
    const major = ch.major || '0';
    const minor = ch.minor || '0';
    const category = ch.category || 'General';
    const label = ch.label || ch.name || '';
    
    // Booleans from UI
    const enabled = ch.enabled !== undefined ? ch.enabled : 'true';
    const startChannel = ch.startChannel || 'false';
    const osd = ch.osd || 'false';
    const encrypted = ch.encrypted || 'false';
    // Statics
    const streamType = ch.streamType || 'Cable';
    const mediaType = ch.mediaType || '1';

    let block = '';
    block += `    <Channel type="RF-ATSC">\n`;
    block += `    <LogicalData logicalChannel="${escapeXml(String(logical))}"`;
    block += ` streamType="${escapeXml(streamType)}"`;
    block += ` listingID=""`;
    block += ` icon=""`;
    block += ` label="${escapeXml(label)}"`;
    block += ` enabled="${escapeXml(String(enabled))}"`;
    block += ` startChannel="${escapeXml(String(startChannel))}"`;
    block += ` osd="${escapeXml(String(osd))}"`;
    block += ` mediaType="${escapeXml(String(mediaType))}"`;
    block += ` encrypted="${escapeXml(String(encrypted))}"`;
    block += ` category="${escapeXml(category)}"`;
    block += ` />\n`;
    block += `    <ATSCData major="${escapeXml(String(major))}" minor="${escapeXml(String(minor))}" />\n`;
    block += `  </Channel>\n`;

    return block;
  }

  /**
   * Build an IP channel block.
   */
  function buildIPChannel(ch) {
    const logical = ch.logicalChannel || ch.channelNumber || '1';
    const label = ch.label || ch.name || '';
    const category = ch.category || 'None';
    let ipAddr = ch.ipAddr || '';
    let ipPort = ch.ipPort || '';
    
    // Fallback: parse from URL if ipAddr is missing but url exists
    const url = ch.url || '';
    if (!ipAddr && url) {
      let cleanUrl = url.replace('udp://', '').replace('rtp://', '').replace('@', '');
      if (cleanUrl.includes(':')) {
        const parts = cleanUrl.split(':');
        ipAddr = parts[0];
        ipPort = parts[1];
      } else {
        ipAddr = cleanUrl;
      }
    }
    
    // Booleans from UI
    const enabled = ch.enabled !== undefined ? ch.enabled : 'true';
    const startChannel = ch.startChannel || 'false';
    const osd = ch.osd || 'undefined';
    const encrypted = ch.encrypted || 'false';
    // Statics
    const streamType = 'UDP';
    const mediaType = ch.mediaType || '1';
    const program = logical;

    let block = '';
    block += `    <Channel type="IP">\n`;
    block += `      <LogicalData logicalChannel="${escapeXml(String(logical))}"`;
    block += ` streamType="${escapeXml(streamType)}"`;
    block += ` listingID=""`;
    block += ` icon=""`;
    block += ` label="${escapeXml(label)}"`;
    block += ` enabled="${escapeXml(String(enabled))}"`;
    block += ` startChannel="${escapeXml(String(startChannel))}"`;
    block += ` osd="${escapeXml(String(osd))}"`;
    block += ` mediaType="${escapeXml(String(mediaType))}"`;
    block += ` encrypted="${escapeXml(String(encrypted))}"`;
    block += ` category="${escapeXml(category)}"`;
    block += ` />\n`;
    block += `      <IPData ipAddr="${escapeXml(ipAddr)}"`;
    block += ` ipPort="${escapeXml(ipPort)}"`;
    block += ` program="${escapeXml(String(program))}"`;
    block += ` pcrPid="" videoPid="" audioPid=""`;
    block += ` videoType="AUTO-DETECT" audioType="AUTO-DETECT"`;
    block += ` />\n`;
    block += `    </Channel>\n`;

    return block;
  }

  /**
   * Parse an existing LG XML file and extract channels.
   * @param {string} xmlString - Raw XML content
   * @returns {Object} { channels: Array, config: Object }
   */
  function parse(xmlString) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'text/xml');
    const channels = [];

    const root = doc.querySelector('Channels');
    const locale = root ? root.getAttribute('locale') || 'ATSC' : 'ATSC';

    const channelElements = doc.querySelectorAll('Channel');
    let detectedType = 'RF';

    channelElements.forEach(el => {
      const type = el.getAttribute('type') || 'RF-ATSC';
      const logicalData = el.querySelector('LogicalData');
      const atscData = el.querySelector('ATSCData');
      const ipData = el.querySelector('IPData');

      const ch = {
        channelNumber: logicalData ? logicalData.getAttribute('logicalChannel') || '' : '',
        logicalChannel: logicalData ? logicalData.getAttribute('logicalChannel') || '' : '',
        streamType: logicalData ? logicalData.getAttribute('streamType') || 'Cable' : 'Cable',
        listingID: logicalData ? logicalData.getAttribute('listingID') || '' : '',
        icon: logicalData ? logicalData.getAttribute('icon') || '' : '',
        name: logicalData ? logicalData.getAttribute('label') || '' : '',
        label: logicalData ? logicalData.getAttribute('label') || '' : '',
        enabled: logicalData ? logicalData.getAttribute('enabled') || 'true' : 'true',
        startChannel: logicalData ? logicalData.getAttribute('startChannel') || 'false' : 'false',
        osd: logicalData ? logicalData.getAttribute('osd') || 'false' : 'false',
        blankVideo: logicalData ? logicalData.getAttribute('blankVideo') || 'false' : 'false',
        zones: logicalData ? logicalData.getAttribute('zones') || '' : '',
        mediaType: logicalData ? logicalData.getAttribute('mediaType') || '1' : '1',
        encrypted: logicalData ? logicalData.getAttribute('encrypted') || 'false' : 'false',
        category: logicalData ? logicalData.getAttribute('category') || 'General' : 'General',
        _type: type === 'RF-ATSC' ? 'RF' : 'IP'
      };

      if ((type === 'RF-ATSC' || type === 'RF-ATSC3') && atscData) {
        detectedType = 'RF';
        ch.major = atscData.getAttribute('major') || '0';
        ch.minor = atscData.getAttribute('minor') || '0';
        ch.rf = atscData.getAttribute('ptc') || '';
        if (type === 'RF-ATSC3') {
          ch.atsc3 = 'true';
          ch.plpId = atscData.getAttribute('plpId') || '0';
        }
      } else if (type === 'IP' && ipData) {
        detectedType = 'IP';
        const urlAttr = ipData.getAttribute('url');
        const ipAddr = ipData.getAttribute('ipAddr');
        const ipPort = ipData.getAttribute('ipPort');
        
        ch.ipAddr = ipAddr || '';
        ch.ipPort = ipPort || '';
        
        if (ipAddr) {
           ch.url = ipPort ? `${ipAddr}:${ipPort}` : ipAddr;
        } else {
           ch.url = urlAttr || '';
        }
        
        ch.ipType = ipData.getAttribute('ipType') || 'UDP';
      }
      
      channels.push(ch);
    });

    return {
      channels,
      config: { locale, channelType: detectedType }
    };
  }

  /**
   * Validate a channel entry for LG format.
   * @returns {Array} Array of error messages (empty if valid)
   */
  function validate(channel, channelType) {
    const errors = [];
    const num = parseInt(channel.channelNumber || channel.logicalChannel, 10);

    if (isNaN(num) || num < 1 || num > 999) {
      errors.push('Canal lógico inválido (debe ser 1-999)');
    }

    if (channelType === 'RF') {
      const major = parseInt(channel.major, 10);
      const minor = parseInt(channel.minor, 10);
      if (isNaN(major) || major < 1) errors.push('Major inválido');
      if (isNaN(minor) || minor < 0) errors.push('Minor inválido');
    }

    if (channelType === 'IP') {
      if (!channel.url || !channel.url.match(/^(udp|rtp|http|https):\/\/.+/i)) {
        errors.push('IP inválida');
      }
    }

    return errors;
  }

  /**
   * Escape special XML characters.
   */
  function escapeXml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  return { generate, parse, validate };

})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = LGGenerator;
}
