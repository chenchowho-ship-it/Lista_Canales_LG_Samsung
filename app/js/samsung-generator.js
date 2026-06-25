/**
 * Samsung LYNK Cloud — JSON Channel List Generator
 * Generates the exact JSON structure expected by the LYNK Cloud platform.
 */

const SamsungGenerator = (() => {

  /**
   * Generate the full JSON structure for Samsung LYNK Cloud.
   * @param {Array} channels - Array of channel objects
   * @param {Object} config - Configuration options
   * @param {string} config.profile - "ATSC" (default)
   * @param {string} config.channelType - "IP" or "RF"
   * @param {string} config.adType - "Digital" or "Analog"
   * @returns {string} JSON string
   */
  function generate(channels, config = {}) {
    const profile = config.profile || 'ATSC';
    const adType = config.adType || 'Digital';

    const ipChannels = channels.filter(ch => (ch._type || config.channelType || 'IP') === 'IP');
    const rfChannels = channels.filter(ch => (ch._type || config.channelType || 'IP') === 'RF');

    const channelTypesArray = [];

    if (ipChannels.length > 0) {
      channelTypesArray.push({
        ChannelType: 'IP',
        _AD_Types: [{
          AD_Type: adType,
          _Channels: [{
            CH_ID: buildChannelId('IP', adType, profile),
            PTC: 0,
            _Services: ipChannels.map(ch => buildService(ch, 'IP'))
          }]
        }]
      });
    }

    if (rfChannels.length > 0) {
      channelTypesArray.push({
        ChannelType: 'RF',
        _AD_Types: [{
          AD_Type: adType,
          _Channels: [{
            CH_ID: buildChannelId('RF', adType, profile),
            PTC: 0,
            _Services: rfChannels.map(ch => buildService(ch, 'RF'))
          }]
        }]
      });
    }

    const structure = {
      Version: '1.0.0',
      _Profiles: [{
        Profile: profile,
        _ChannelTypes: channelTypesArray
      }]
    };

    return JSON.stringify(structure, null, 2);
  }

  /**
   * Build a single service entry for a channel.
   */
  function buildService(ch, channelType) {
    const service = {
      DRM: "",
      MajorNr: parseInt(ch.channelNumber, 10),
      Name: truncateName(ch.name || ''),
      SRV_ID: String(ch.channelNumber),
      ServiceType: 65535,
      Url: ch.url || ''
    };

    if (ch.iconUrl && ch.iconUrl.trim() !== '') {
      service._Icons = [{ Url: ch.iconUrl.trim() }];
    }

    return service;
  }

  /**
   * Build the CH_ID string.
   */
  function buildChannelId(channelType, adType, profile) {
    const typeCode = channelType === 'IP' ? 'IP' : 'RF';
    const adCode = adType === 'Digital' ? 'D' : 'A';
    return `${typeCode}:${adCode}:N_0:0:${profile}`;
  }

  /**
   * Truncate channel name to 15 characters (Samsung limitation).
   */
  function truncateName(name) {
    return name.length > 15 ? name.substring(0, 15) : name;
  }

  /**
   * Parse an existing Samsung JSON file and extract channels.
   * @param {string} jsonString - Raw JSON content
   * @returns {Object} { channels: Array, config: Object }
   */
  function parse(jsonString) {
    const data = JSON.parse(jsonString);
    const channels = [];
    let config = { profile: 'ATSC', channelType: 'IP', adType: 'Digital' };

    if (data._Profiles && data._Profiles.length > 0) {
      const prof = data._Profiles[0];
      config.profile = prof.Profile || 'ATSC';

      if (prof._ChannelTypes && prof._ChannelTypes.length > 0) {
        // Iterate over all channel types (IP and RF could be present)
        for (const ct of prof._ChannelTypes) {
          const type = ct.ChannelType || 'IP';
          config.channelType = type; // Last one wins, but that's fine

          if (ct._AD_Types && ct._AD_Types.length > 0) {
            const adt = ct._AD_Types[0];
            config.adType = adt.AD_Type || 'Digital';

            if (adt._Channels && adt._Channels.length > 0) {
              for (const chGroup of adt._Channels) {
                if (chGroup._Services) {
                  for (const svc of chGroup._Services) {
                    channels.push({
                      _type: type,
                      channelNumber: svc.MajorNr || 0,
                      name: svc.Name || '',
                      url: svc.Url || '',
                      serviceId: svc.SRV_ID || '',
                      iconUrl: (svc._Icons && svc._Icons[0]) ? svc._Icons[0].Url : ''
                    });
                  }
                }
              }
            }
          }
        }
      }
    }

    return { channels, config };
  }

  /**
   * Validate a channel entry for Samsung format.
   * @returns {Array} Array of error messages (empty if valid)
   */
  function validate(channel, channelType) {
    const errors = [];
    const num = parseInt(channel.channelNumber, 10);

    if (isNaN(num) || num < 0) {
      errors.push('Número de canal inválido');
    }

    if (!channel.name || channel.name.trim() === '') {
      errors.push('El nombre del canal es requerido');
    }

    if (channelType === 'IP') {
      if (!channel.url || !channel.url.match(/^(udp|rtp|http|https):\/\/.+/i)) {
        errors.push('IP inválida (debe comenzar con udp://, rtp://, http:// o https://)');
      }
    }

    return errors;
  }

  return { generate, parse, validate };

})();

// Export for module use if available
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SamsungGenerator;
}
