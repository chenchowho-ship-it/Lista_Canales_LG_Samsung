/**
 * App.js — Main application logic for the Channel List Generator.
 * Manages state, UI rendering, user interactions, and local storage.
 */

const App = (() => {

  // ── State ──
  let lists = {
    samsung: { IP: [], RF: [] },
    lg: { IP: [], RF: [] }
  };

  let state = {
    platform: 'samsung',     // 'samsung' | 'lg'
    channelType: 'IP',       // 'IP' | 'RF'
    selectedRows: new Set(),
    editingCell: null,
    dragSourceIndex: null
  };

  Object.defineProperty(state, 'channels', {
    get: function() { return lists[this.platform][this.channelType]; },
    set: function(val) { lists[this.platform][this.channelType] = val; }
  });

  // ── DOM Refs ──
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // ── Init ──
  function init() {
    bindPlatformSwitcher();
    bindTypeTabs();
    bindToolbarButtons();
    bindModalEvents();
    bindFileImport();
    bindCSVImport();
    loadFromStorage();
    render();
  }

  // ── Platform Switcher ──
  function bindPlatformSwitcher() {
    $$('.platform-switcher__btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = btn.dataset.platform;
        if (p === state.platform) return;
        state.platform = p;
        state.channelType = p === 'samsung' ? 'IP' : 'RF';
        state.selectedRows.clear();
        updateBrandClass();
        updateTypeTabs();
        render();
        saveToStorage();
      });
    });
  }

  function updateBrandClass() {
    document.body.classList.remove('brand-samsung', 'brand-lg');
    document.body.classList.add(`brand-${state.platform}`);
    $$('.platform-switcher__btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.platform === state.platform);
    });
    // Update logo
    const logo = $('.header__logo');
    if (logo) {
      logo.textContent = state.platform === 'samsung' ? 'S' : 'L';
    }
    
    // Update subtitle
    const subtitle = $('#header-subtitle');
    if (subtitle) {
      subtitle.textContent = state.platform === 'samsung' 
        ? 'Genera listas de canales para LYNK Cloud' 
        : 'Genera listas de canales para ProCentric';
    }

    // Toggle USB Export button
    const btnExportUsb = $('#btn-export-usb');
    if (btnExportUsb) {
      btnExportUsb.style.display = state.platform === 'samsung' ? 'inline-block' : 'none';
    }
  }

  // ── Type Tabs ──
  function bindTypeTabs() {
    $$('.type-tabs__btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const t = btn.dataset.type;
        if (t === state.channelType) return;
        state.channelType = t;
        
        if (state.platform === 'samsung' && t === 'RF') {
          showToast('El modo RF / Cable para Samsung LYNK Cloud aún se encuentra en desarrollo.', 'warning');
        }

        state.selectedRows.clear();
        updateTypeTabs();
        render();
        saveToStorage();
      });
    });
  }

  function updateTypeTabs() {
    $$('.type-tabs__btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.type === state.channelType);
    });
  }

  // ── Toolbar Buttons ──
  function bindToolbarButtons() {
    $('#btn-add-channel')?.addEventListener('click', openAddModal);
    $('#btn-delete-selected')?.addEventListener('click', deleteSelected);
    $('#btn-import-file')?.addEventListener('click', () => $('#file-input')?.click());
    $('#btn-import-csv')?.addEventListener('click', () => openCSVModal());
    $('#btn-download-template')?.addEventListener('click', downloadExcelTemplate);
    $('#btn-batch-edit')?.addEventListener('click', openBatchModal);
    $('#btn-audit')?.addEventListener('click', auditChannels);
    $('#btn-export')?.addEventListener('click', openExportModal);
    $('#btn-confirm-export')?.addEventListener('click', confirmExport);
    $('#btn-select-all')?.addEventListener('click', toggleSelectAll);
  }

  // ── Excel Template Generator ──
  function downloadExcelTemplate() {
    if (typeof XLSX === 'undefined') {
      showToast('Librería XLSX no cargada. Revisa tu conexión a internet.', 'error');
      return;
    }

    const defs = CSVImporter.getFieldDefinitions(state.platform, state.channelType);
    const requiredKeys = defs.required || [];
    const optionalKeys = defs.optional || [];
    const allKeys = [...requiredKeys, ...optionalKeys];
    
    // Obtener los nombres amigables (ej: "channelNumber" -> "Número de Canal")
    const labels = CSVImporter.getFieldLabels(state.platform, state.channelType);
    const humanHeaders = allKeys.map(k => {
      let title = labels[k] || k;
      if (optionalKeys.includes(k)) {
        title += ' (Opcional)';
      }
      return title;
    });

    // Crear la hoja de cálculo
    const worksheet = XLSX.utils.aoa_to_sheet([humanHeaders]);
    
    // Dar un poco de ancho a las columnas
    const colWidths = humanHeaders.map(h => ({ wch: Math.max(h.length, 15) }));
    worksheet['!cols'] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Plantilla");

    // Nombre dinámico (ej: Plantilla_Samsung_IP.xlsx)
    const platName = state.platform === 'samsung' ? 'Samsung' : 'LG';
    const typeName = state.channelType;
    const fileName = `Plantilla_${platName}_${typeName}.xlsx`;

    XLSX.writeFile(workbook, fileName);
    showToast(`Plantilla descargada: ${fileName}`, 'success');
  }

  // ── Render Table ──
  function render() {
    updateBrandClass();
    updateTypeTabs();
    renderTable();
    updateChannelCount();
    updateStatusBar();
    updateDeleteBtnState();
  }

  function renderTable() {
    const tableWrapper = $('#table-wrapper');
    if (!tableWrapper) return;

    if (state.channels.length === 0) {
      tableWrapper.innerHTML = renderEmptyState();
      return;
    }

    const columns = getColumns();
    let html = '<table class="data-table" id="data-table">';
    html += '<thead><tr>';
    html += '<th style="width:40px"><input type="checkbox" class="row-checkbox" id="select-all-cb"></th>';
    html += '<th style="width:36px"></th>'; // drag handle
    columns.forEach(col => {
      const tooltipHTML = col.title ? ` <span class="info-tooltip info-tooltip-bottom" data-tooltip="${col.title}">i</span>` : '';
      html += `<th>${col.label}${tooltipHTML}</th>`;
    });
    html += '<th style="width:80px">Acciones</th>';
    html += '</tr></thead>';
    html += '<tbody>';

    state.channels.forEach((ch, idx) => {
      const selected = state.selectedRows.has(idx) ? 'selected' : '';
      html += `<tr class="${selected}" data-index="${idx}">`;
      html += `<td><input type="checkbox" class="row-checkbox" data-index="${idx}" ${state.selectedRows.has(idx) ? 'checked' : ''}></td>`;
      html += `<td><span class="drag-handle" title="Arrastrar para reordenar">⠿</span></td>`;
      columns.forEach(col => {
        const value = ch[col.field] || '';
        const textContent = escapeHtml(String(value));
        const isBooleanCol = ['enabled', 'startChannel', 'osd', 'encrypted', 'blankVideo'].includes(col.field);

        if (isBooleanCol) {
          html += `<td data-field="${col.field}" data-index="${idx}">`;
          html += `<select class="table-select-inline" data-field="${col.field}" data-index="${idx}">
            <option value="true" ${value === 'true' ? 'selected' : ''}>true</option>
            <option value="false" ${value === 'false' ? 'selected' : ''}>false</option>
          </select>`;
          html += `</td>`;
        } else {
          html += `<td contenteditable="true" data-field="${col.field}" data-index="${idx}">`;
          if (col.field === 'iconUrl' && value.trim()) {
            html += `<img src="${escapeHtml(value.trim())}" class="channel-icon-preview" onerror="this.style.display='none'" style="margin-right:8px;vertical-align:middle;">`;
          }
          html += `${textContent}</td>`;
        }
      });
      html += `<td>
        <div class="row-actions">
          <button class="row-actions__btn" title="Duplicar" data-action="duplicate" data-index="${idx}">📋</button>
          <button class="row-actions__btn row-actions__btn--delete" title="Eliminar" data-action="delete" data-index="${idx}">🗑️</button>
        </div>
      </td>`;
      html += '</tr>';
    });

    html += '</tbody></table>';
    tableWrapper.innerHTML = html;

    // Bind table events
    bindTableEvents();
  }

  function getColumns() {
    if (state.platform === 'samsung') {
      if (state.channelType === 'IP') {
        return [
          { field: 'channelNumber', label: 'Nº Canal' },
          { field: 'name', label: 'Nombre' },
          { field: 'url', label: 'URL Multicast' },
          { field: 'serviceId', label: 'Service ID' },
          { field: 'iconUrl', label: 'URL Ícono' }
        ];
      } else {
        return [
          { field: 'channelNumber', label: 'Nº Canal' },
          { field: 'name', label: 'Nombre' },
          { field: 'serviceId', label: 'Service ID' }
        ];
      }
    } else { // LG
      if (state.channelType === 'RF') {
        return [
          { field: 'channelNumber', label: 'No. Canal', title: 'Ingresa el numero correspondiente a su canal' },
          { field: 'label', label: 'Nombre', title: 'Ingresar nombre del canal emitido' },
          { field: 'category', label: 'Category', title: 'Categoría del canal' },
          { field: 'major', label: 'Mayor', title: 'Numero mayor de frecuencia' },
          { field: 'minor', label: 'Menor', title: 'Numero menor de frecuencia' },
          { field: 'streamType', label: 'Stream Type' },
          { field: 'listingID', label: 'Listing ID' },
          { field: 'icon', label: 'Icon' },
          { field: 'enabled', label: 'Enabled' },
          { field: 'startChannel', label: 'Start Channel' },
          { field: 'osd', label: 'OSD' },
          { field: 'mediaType', label: 'Media Type' },
          { field: 'encrypted', label: 'Encrypted' }
        ];
      } else {
        return [
          { field: 'channelNumber', label: 'No. Canal', title: 'Ingresa el numero correspondiente a su canal' },
          { field: 'label', label: 'Nombre', title: 'Ingresar nombre del canal emitido' },
          { field: 'category', label: 'Category', title: 'Categoría del canal' },
          { field: 'url', label: 'URL Multicast', title: 'IP o URL del canal IP' },
          { field: 'streamType', label: 'Stream Type' },
          { field: 'listingID', label: 'Listing ID' },
          { field: 'icon', label: 'Icon' },
          { field: 'enabled', label: 'Enabled' },
          { field: 'startChannel', label: 'Start Channel' },
          { field: 'osd', label: 'OSD' },
          { field: 'mediaType', label: 'Media Type' },
          { field: 'encrypted', label: 'Encrypted' },
          { field: 'ipType', label: 'IP Type' }
        ];
      }
    }
  }

  function renderEmptyState() {
    const platformName = state.platform === 'samsung' ? 'Samsung LYNK Cloud' : 'LG ProCentric Direct';
    const typeLabel = state.channelType === 'IP' ? 'IPTV' : 'RF';
    return `
      <div class="empty-state">
        <div class="empty-state__icon">📡</div>
        <div class="empty-state__title">Sin canales ${typeLabel}</div>
        <div class="empty-state__desc">
          Agrega canales manualmente, importa un archivo ${state.platform === 'samsung' ? '.json' : '.xml'} existente,
          o importa desde un CSV / Excel para comenzar a generar tu lista para ${platformName}.
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center">
          <button class="btn btn--primary" onclick="App.openAddModal()">
            <span class="icon">➕</span> Agregar Canal
          </button>
          <button class="btn" onclick="document.getElementById('file-input').click()">
            <span class="icon">📂</span> Importar Archivo
          </button>
          <button class="btn" onclick="App.openCSVModal()">
            <span class="icon">📄</span> Importar CSV / Excel
          </button>
        </div>
      </div>
    `;
  }

  // ── Table Events ──
  function bindTableEvents() {
    const table = $('#data-table');
    if (!table) return;

    // Checkbox events
    table.querySelectorAll('.row-checkbox').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const idx = parseInt(e.target.dataset.index);
        if (e.target.id === 'select-all-cb') {
          toggleSelectAll();
          return;
        }
        if (e.target.checked) {
          state.selectedRows.add(idx);
        } else {
          state.selectedRows.delete(idx);
        }
        updateRowSelection();
        updateDeleteBtnState();
      });
    });

    // Row action buttons
    table.querySelectorAll('.row-actions__btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = btn.dataset.action;
        const idx = parseInt(btn.dataset.index);
        if (action === 'delete') {
          state.channels.splice(idx, 1);
          state.selectedRows.clear();
          render();
          saveToStorage();
          showToast('Canal eliminado', 'success');
        } else if (action === 'duplicate') {
          const clone = JSON.parse(JSON.stringify(state.channels[idx]));
          const num = parseInt(clone.channelNumber || 0) + 1;
          clone.channelNumber = String(num);
          if (clone.serviceId) clone.serviceId = String(num);
          state.channels.splice(idx + 1, 0, clone);
          render();
          saveToStorage();
          showToast('Canal duplicado', 'success');
        }
      });
    });

    // Cell editing
    table.querySelectorAll('[contenteditable]').forEach(cell => {
      cell.addEventListener('blur', () => {
        const idx = parseInt(cell.parentElement.dataset.index);
        const field = cell.dataset.field;
        if (state.channels[idx]) {
          let val = cell.innerText.trim();
          
          // Auto-fix URL prefixes on manual table edit
          if (field === 'url' && val !== '') {
            if (!/^[a-zA-Z]+:\/\//.test(val)) {
              val = 'udp://' + val;
              cell.innerText = val;
            }
          }

          state.channels[idx][field] = val;
          saveToStorage();
        }
      });
      // Handle Enter key
      cell.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          cell.blur();
          // Move to next cell if possible
          const nextCell = cell.nextElementSibling;
          if (nextCell && nextCell.hasAttribute('contenteditable')) {
            nextCell.focus();
          }
        }
      });
    }); // end cell editing

    // Boolean dropdown editing
    table.querySelectorAll('.table-select-inline').forEach(select => {
      select.addEventListener('change', (e) => {
        const idx = parseInt(select.dataset.index);
        const field = select.dataset.field;
        if (state.channels[idx]) {
          if (state.platform === 'lg' && field === 'startChannel' && select.value === 'true') {
            // Uncheck all other channels
            if (lists.lg.IP) lists.lg.IP.forEach(ch => ch.startChannel = 'false');
            if (lists.lg.RF) lists.lg.RF.forEach(ch => ch.startChannel = 'false');
            
            state.channels[idx][field] = 'true';
            saveToStorage();
            render();
            showToast('Canal configurado como inicio. Los demás fueron deshabilitados.', 'info');
          } else {
            state.channels[idx][field] = select.value;
            saveToStorage();
          }
        }
      });
    });

    // Drag and drop
    const rows = table.querySelectorAll('tbody tr');
    rows.forEach(row => {
      const handle = row.querySelector('.drag-handle');
      if (handle) {
        handle.addEventListener('mousedown', () => {
          row.setAttribute('draggable', 'true');
        });
        handle.addEventListener('mouseup', () => {
          row.removeAttribute('draggable');
        });
        handle.addEventListener('mouseleave', () => {
          row.removeAttribute('draggable');
        });
      }

      row.addEventListener('dragstart', (e) => {
        if (!row.hasAttribute('draggable')) {
          e.preventDefault();
          return;
        }
        state.dragSourceIndex = parseInt(row.dataset.index);
        row.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });

      row.addEventListener('dragend', () => {
        row.classList.remove('dragging');
        rows.forEach(r => r.classList.remove('drag-over'));
      });

      row.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const targetRow = e.target.closest('tr');
        if (targetRow && targetRow !== row) {
          targetRow.classList.add('drag-over');
        }
      });

      row.addEventListener('dragleave', (e) => {
        const targetRow = e.target.closest('tr');
        if (targetRow) {
          targetRow.classList.remove('drag-over');
        }
      });

      row.addEventListener('drop', (e) => {
        e.preventDefault();
        const targetRow = e.target.closest('tr');
        if (targetRow) {
          targetRow.classList.remove('drag-over');
          const targetIndex = parseInt(targetRow.dataset.index);
          if (state.dragSourceIndex !== targetIndex && !isNaN(state.dragSourceIndex)) {
            const movedItem = state.channels.splice(state.dragSourceIndex, 1)[0];
            state.channels.splice(targetIndex, 0, movedItem);
            saveToStorage();
            render();
          }
        }
      });
    });
  }

  function updateRowSelection() {
    $$('#data-table tbody tr').forEach(row => {
      const idx = parseInt(row.dataset.index);
      row.classList.toggle('selected', state.selectedRows.has(idx));
    });
  }

  function updateDeleteBtnState() {
    const delBtn = $('#btn-delete-selected');
    const batchBtn = $('#btn-batch-edit');
    const hasSelection = state.selectedRows.size > 0;
    
    if (delBtn) {
      delBtn.disabled = !hasSelection;
      delBtn.style.opacity = hasSelection ? '1' : '0.4';
    }
    if (batchBtn) {
      if (state.platform === 'samsung') {
        batchBtn.style.display = 'none';
      } else {
        batchBtn.style.display = '';
        batchBtn.disabled = !hasSelection;
        batchBtn.style.opacity = hasSelection ? '1' : '0.4';
      }
    }
  }

  function toggleSelectAll() {
    if (state.selectedRows.size === state.channels.length) {
      state.selectedRows.clear();
    } else {
      state.channels.forEach((_, i) => state.selectedRows.add(i));
    }
    render();
  }

  function updateChannelCount() {
    const el = $('#channel-count');
    if (el) el.textContent = state.channels.length;
  }

  function updateStatusBar() {
    const platformEl = $('#status-platform');
    const typeEl = $('#status-type');
    const formatEl = $('#status-format');

    if (platformEl) {
      platformEl.textContent = state.platform === 'samsung' ? 'Samsung LYNK Cloud' : 'LG ProCentric Direct';
    }
    if (typeEl) {
      typeEl.textContent = state.channelType === 'IP' ? 'IPTV' : 'RF / Cable';
    }
    if (formatEl) {
      formatEl.textContent = state.platform === 'samsung' ? '.json' : '.xml';
    }
  }

  // ── Add Channel Modal ──
  function openAddModal() {
    const modal = $('#modal-add');
    if (!modal) return;

    // Build form fields based on current context
    const body = modal.querySelector('.modal__body');
    body.innerHTML = renderAddForm();
    modal.closest('.modal-overlay').classList.add('active');

    // Auto-suggest next channel number
    const lastCh = state.channels[state.channels.length - 1];
    const nextNum = lastCh ? parseInt(lastCh.channelNumber || 0) + 1 : 1;
    const numInput = body.querySelector('[name="channelNumber"]');
    if (numInput) numInput.value = nextNum;

    // Auto-suggest next URL for Samsung IP
    if (state.platform === 'samsung' && state.channelType === 'IP' && lastCh && lastCh.url) {
      const urlInput = body.querySelector('[name="url"]');
      if (urlInput) {
        urlInput.value = suggestNextUrl(lastCh.url);
      }
    }

    // Auto-fill service ID for Samsung
    if (state.platform === 'samsung') {
      const srvInput = body.querySelector('[name="serviceId"]');
      if (srvInput) srvInput.value = String(nextNum);
      // Sync serviceId with channelNumber
      if (numInput) {
        numInput.addEventListener('input', () => {
          if (srvInput) srvInput.value = numInput.value;
        });
      }
    }
  }

  function renderAddForm() {
    let html = '';

    if (state.platform === 'samsung') {
      html += `
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Número de Canal *</label>
            <input class="form-input" name="channelNumber" type="number" min="0" placeholder="Ej: 1101" required>
          </div>
          <div class="form-group">
            <label class="form-label">Nombre del Canal *</label>
            <input class="form-input" name="name" type="text" maxlength="15" placeholder="Ej: ESPN HD" required>
            <div class="form-hint">Máximo 15 caracteres</div>
          </div>
        </div>
      `;
      if (state.channelType === 'IP') {
        html += `
          <div class="form-group">
            <label class="form-label">URL Multicast *</label>
            <input class="form-input" name="url" type="text" placeholder="udp://239.220.101.1:5001" required>
          </div>
        `;
      }
      html += `
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Service ID</label>
            <input class="form-input" name="serviceId" type="text" placeholder="Auto">
          </div>
          <div class="form-group">
            <label class="form-label">URL Ícono</label>
            <input class="form-input" name="iconUrl" type="text" placeholder="Opcional">
          </div>
        </div>
      `;
    } else { // LG
      if (state.channelType === 'RF') {
        html += `
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">No. Canal * <span class="info-tooltip" data-tooltip="Ingresa el numero correspondiente a su canal">i</span></label>
              <input class="form-input" name="channelNumber" type="number" min="1" max="999" placeholder="Ej: 3" required>
            </div>
            <div class="form-group">
              <label class="form-label">Nombre <span class="info-tooltip" data-tooltip="Ingresar nombre del canal emitido">i</span></label>
              <input class="form-input" name="label" type="text" placeholder="Ej: ESPN">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Mayor * <span class="info-tooltip" data-tooltip="Numero mayor de frecuencia">i</span></label>
              <input class="form-input" name="major" type="number" min="1" placeholder="Ej: 40" required>
            </div>
            <div class="form-group">
              <label class="form-label">Menor * <span class="info-tooltip" data-tooltip="Numero menor de frecuencia">i</span></label>
              <input class="form-input" name="minor" type="number" min="0" placeholder="Ej: 1" required>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Categoría <span class="info-tooltip" data-tooltip="Categoría del canal">i</span></label>
              <select class="form-select" name="category">
                <option value="General">General</option>
                <option value="News">Noticias</option>
                <option value="Sports">Deportes</option>
                <option value="Movies">Películas</option>
                <option value="Kids">Infantil</option>
                <option value="Music">Música</option>
                <option value="Entertainment">Entretenimiento</option>
                <option value="Documentary">Documentales</option>
              </select>
            </div>
          </div>
        `;
      } else {
        html += `
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">No. Canal * <span class="info-tooltip" data-tooltip="Ingresa el numero correspondiente a su canal">i</span></label>
              <input class="form-input" name="channelNumber" type="number" min="1" max="999" placeholder="Ej: 3" required>
            </div>
            <div class="form-group">
              <label class="form-label">Nombre <span class="info-tooltip" data-tooltip="Ingresar nombre del canal emitido">i</span></label>
              <input class="form-input" name="label" type="text" placeholder="Ej: ESPN">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">URL Multicast * <span class="info-tooltip" data-tooltip="IP o URL del canal IP">i</span></label>
              <input class="form-input" name="url" type="text" placeholder="udp://239.x.x.x:port" required>
            </div>
            <div class="form-group">
              <label class="form-label">Categoría <span class="info-tooltip" data-tooltip="Categoría del canal">i</span></label>
              <select class="form-select" name="category">
                <option value="General">General</option>
                <option value="News">Noticias</option>
                <option value="Sports">Deportes</option>
                <option value="Movies">Películas</option>
                <option value="Kids">Infantil</option>
                <option value="Music">Música</option>
                <option value="Entertainment">Entretenimiento</option>
                <option value="Documentary">Documentales</option>
              </select>
            </div>
          </div>
        `;
      }
    }

    return html;
  }

  function addChannelFromModal() {
    const modal = $('#modal-add');
    if (!modal) return;

    const body = modal.querySelector('.modal__body');
    const inputs = body.querySelectorAll('input, select');
    const ch = {};

    inputs.forEach(input => {
      if (input.type === 'checkbox') {
        ch[input.name] = input.checked ? 'true' : 'false';
      } else {
        ch[input.name] = input.value;
      }
    });

    // Ensure channelNumber exists
    if (!ch.channelNumber) ch.channelNumber = ch.logicalChannel || '0';
    if (!ch.serviceId && state.platform === 'samsung') ch.serviceId = ch.channelNumber;

    if (state.platform === 'lg') {
      ch.streamType = state.channelType === 'IP' ? 'IP' : 'Cable';
      ch.listingID = '';
      ch.icon = '';
      ch.enabled = 'true';
      ch.startChannel = 'false';
      ch.osd = 'false';
      ch.mediaType = '1';
      ch.encrypted = 'false';
      if (state.channelType === 'IP') {
        ch.ipType = 'UDP';
      }
    }

    // Validate
    const validator = state.platform === 'samsung' ? SamsungGenerator : LGGenerator;
    const errors = validator.validate(ch, state.channelType);

    if (errors.length > 0) {
      showToast(errors[0], 'error');
      return;
    }

    state.channels.push(ch);
    closeModal('modal-add');
    render();
    saveToStorage();
    showToast('Canal agregado correctamente', 'success');
  }

  function suggestNextUrl(lastUrl) {
    // Try to increment the last octet and port
    const match = lastUrl.match(/^(udp:\/\/\d+\.\d+\.\d+\.)(\d+):(\d+)$/);
    if (match) {
      const base = match[1];
      const lastOctet = parseInt(match[2]) + 1;
      const lastPort = parseInt(match[3]) + 1;
      return `${base}${lastOctet}:${lastPort}`;
    }
    return lastUrl;
  }

  // ── Delete Selected ──
  function deleteSelected() {
    if (state.selectedRows.size === 0) return;

    const indices = Array.from(state.selectedRows).sort((a, b) => b - a);
    indices.forEach(idx => state.channels.splice(idx, 1));
    state.selectedRows.clear();
    render();
    saveToStorage();
    showToast(`${indices.length} canal(es) eliminado(s)`, 'success');
  }

  // ── Export ──
  function openExportModal() {
    const ipList = lists[state.platform]?.IP || [];
    const rfList = lists[state.platform]?.RF || [];

    if (ipList.length === 0 && rfList.length === 0) {
      showToast('No hay canales para exportar en esta plataforma', 'warning');
      return;
    }

    const filenameGroup = $('#export-filename-group');
    if (filenameGroup) {
      filenameGroup.style.display = state.platform === 'lg' ? 'block' : 'none';
    }

    const currentLabel = $('#export-current-label');
    if (currentLabel) {
      currentLabel.textContent = `Solo la pestaña actual (${state.channelType === 'IP' ? 'IPTV' : 'RF / Cable'})`;
    }
    
    $('#modal-export-overlay').classList.add('active');
  }

  function confirmExport() {
    $('#modal-export-overlay').classList.remove('active');

    const modeNode = document.querySelector('input[name="export-mode"]:checked');
    const mode = modeNode ? modeNode.value : 'current';
    
    const ipList = lists[state.platform]?.IP || [];
    const rfList = lists[state.platform]?.RF || [];

    let allChannels = [];
    if (mode === 'both') {
      allChannels = [
        ...ipList.map(c => ({...c, _type: 'IP'})),
        ...rfList.map(c => ({...c, _type: 'RF'}))
      ];
    } else {
      // current
      const currentList = lists[state.platform]?.[state.channelType] || [];
      allChannels = currentList.map(c => ({...c, _type: state.channelType}));
    }

    if (allChannels.length === 0) {
      showToast('No hay canales seleccionados para exportar', 'warning');
      return;
    }

    if (state.platform === 'lg') {
      const startCount = allChannels.filter(c => c.startChannel === 'true').length;
      if (startCount !== 1) {
        showToast(`Error: Debes seleccionar exactamente 1 canal como "Start Channel" (actualmente hay ${startCount}).`, 'error');
        return;
      }
    }

    const config = {
      profile: 'ATSC',
      channelType: state.channelType, // Fallback
      adType: 'Digital',
      locale: 'ATSC'
    };

    let filename = undefined;
    if (state.platform === 'lg') {
      let customName = $('#export-filename')?.value?.trim();
      if (!customName) customName = 'GlobalChannelMap_Custom';
      filename = `${customName}.xml`;
    }

    FileImporter.exportFile(allChannels, state.platform, config, filename);
    showToast(`Archivo exportado exitosamente`, 'success');
  }

  // ── File Import ──
  function bindFileImport() {
    const fileInput = $('#file-input');
    if (!fileInput) return;

    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const result = await FileImporter.importFile(file);
        state.platform = result.platform;
        state.channelType = result.channelType;
        
        lists[state.platform] = { IP: [], RF: [] };
        result.channels.forEach(c => {
          const t = c._type || result.channelType;
          if (lists[state.platform][t]) {
            lists[state.platform][t].push(c);
          }
        });
        
        state.selectedRows.clear();
        render();
        saveToStorage();
        showToast(`${result.channels.length} canales importados desde ${file.name}`, 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }

      fileInput.value = '';
    });
  }

  // ── CSV Import Modal ──
  let csvParsedData = null;

  function openCSVModal() {
    const modal = $('#modal-csv');
    if (!modal) return;

    const body = modal.querySelector('.modal__body');
    body.innerHTML = renderCSVImportForm();
    modal.closest('.modal-overlay').classList.add('active');
    bindCSVDropZone();
  }

  function renderCSVImportForm() {
    return `
      <div class="csv-drop-zone" id="csv-drop-zone">
        <div class="csv-drop-zone__icon">📊</div>
        <div class="csv-drop-zone__text">Arrastra un archivo Excel o CSV aquí, o haz clic para seleccionar</div>
        <div class="csv-drop-zone__hint">Soporta .xlsx, .xls, .csv (separador automático: coma, punto y coma, tab)</div>
        <input type="file" id="csv-file-input" accept=".xlsx,.xls,.xlsb,.ods,.csv,.txt" style="display:none">
      </div>
      <div id="csv-paste-section">
        <div class="form-group">
          <label class="form-label">O pega los datos CSV aquí:</label>
          <textarea class="form-input" id="csv-paste" rows="6" placeholder="Pega aquí el contenido CSV..."></textarea>
        </div>
        <button class="btn btn--primary btn--sm" id="btn-parse-csv" style="margin-top:8px">
          Procesar texto
        </button>
      </div>
      <div id="csv-mapping-section" class="hidden"></div>
      <div id="csv-preview-section" class="hidden"></div>
    `;
  }

  function bindCSVDropZone() {
    const zone = $('#csv-drop-zone');
    const input = $('#csv-file-input');
    const pasteBtn = $('#btn-parse-csv');
    const pasteArea = $('#csv-paste');

    if (zone && input) {
      zone.addEventListener('click', () => input.click());

      zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        zone.classList.add('drag-active');
      });

      zone.addEventListener('dragleave', () => {
        zone.classList.remove('drag-active');
      });

      zone.addEventListener('drop', async (e) => {
        e.preventDefault();
        zone.classList.remove('drag-active');
        const file = e.dataTransfer.files[0];
        if (file) await processCSVFile(file);
      });

      input.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) await processCSVFile(file);
      });
    }

    if (pasteBtn && pasteArea) {
      pasteBtn.addEventListener('click', () => {
        const text = pasteArea.value.trim();
        if (text) {
          processCSVText(text);
        } else {
          showToast('Pega contenido CSV primero', 'warning');
        }
      });
    }
  }

  async function processCSVFile(file) {
    try {
      const parsed = await FileImporter.importSpreadsheet(file);
      handleCSVParsed(parsed);
    } catch (err) {
      showToast('Error al procesar el archivo: ' + err.message, 'error');
    }
  }

  function processCSVText(text) {
    try {
      const parsed = CSVImporter.parse(text);
      handleCSVParsed(parsed);
    } catch (err) {
      showToast('Error al procesar el texto: ' + err.message, 'error');
    }
  }

  function handleCSVParsed(parsed) {
    if (!parsed.headers.length || !parsed.rows.length) {
      showToast('El archivo no contiene datos válidos', 'error');
      return;
    }

    csvParsedData = parsed;

    // Auto-map columns
    const autoMapping = CSVImporter.autoMap(parsed.headers, state.platform, state.channelType);
    const fieldDefs = CSVImporter.getFieldDefinitions(state.platform, state.channelType);
    const labels = CSVImporter.getFieldLabels(state.platform, state.channelType);
    const allFields = [...fieldDefs.required, ...fieldDefs.optional];

    // Render mapping UI
    const mappingSection = $('#csv-mapping-section');
    if (mappingSection) {
      let html = '<h4 style="margin:16px 0 12px;font-size:0.9rem;color:var(--text-secondary)">Mapeo de Columnas</h4>';
      html += '<div class="column-mapper">';

      allFields.forEach(field => {
        const isRequired = fieldDefs.required.includes(field);
        html += `
          <div class="form-group">
            <label class="form-label">${labels[field] || field} ${isRequired ? '*' : ''}</label>
            <select class="form-select" id="map-${field}">
              <option value="-1">— No mapear —</option>
              ${parsed.headers.map((h, i) =>
                `<option value="${i}" ${autoMapping[field] === i ? 'selected' : ''}>${h}</option>`
              ).join('')}
            </select>
          </div>
        `;
      });

      html += '</div>';

      if (state.channelType === 'IP') {
        html += `
          <div class="form-group" style="margin-top: 15px; max-width: 300px;">
            <label class="form-label" style="color: var(--accent-primary);">Fuerza Tipo IP Globalmente (Opcional)</label>
            <select class="form-select" id="csv-global-iptype">
              <option value="">-- Automático (por defecto) --</option>
              <option value="UDP">UDP</option>
              <option value="TCP">TCP</option>
            </select>
            <div class="form-hint" style="margin-top:4px;">Aplica este protocolo a todos los canales importados.</div>
          </div>
        `;
      }

      if (state.platform === 'lg') {
        html += `
          <div class="form-row" style="margin-top: 15px;">
            <div class="form-group">
              <label class="form-label" style="color: var(--accent-primary);">Encriptado (Global)</label>
              <select class="form-select" id="csv-global-encrypted">
                <option value="false">false</option>
                <option value="true">true</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" style="color: var(--accent-primary);">Habilitado (Global)</label>
              <select class="form-select" id="csv-global-enabled">
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            </div>
          </div>
        `;
      }

      html += `<button class="btn btn--primary" id="btn-apply-mapping" style="margin-top:16px">
        Importar ${parsed.rows.length} canal(es)
      </button>`;
      mappingSection.innerHTML = html;
      mappingSection.classList.remove('hidden');

      // Bind apply
      $('#btn-apply-mapping')?.addEventListener('click', applyCSVMapping);
    }

    // Render preview
    const previewSection = $('#csv-preview-section');
    if (previewSection) {
      let html = '<h4 style="margin:16px 0 8px;font-size:0.9rem;color:var(--text-secondary)">Vista Previa (primeras 10 filas)</h4>';
      html += '<div class="csv-preview"><table>';
      html += '<thead><tr>';
      parsed.headers.forEach(h => html += `<th>${escapeHtml(h)}</th>`);
      html += '</tr></thead><tbody>';
      parsed.rows.slice(0, 10).forEach(row => {
        html += '<tr>';
        row.forEach(cell => html += `<td>${escapeHtml(cell)}</td>`);
        html += '</tr>';
      });
      html += '</tbody></table></div>';
      previewSection.innerHTML = html;
      previewSection.classList.remove('hidden');
    }
  }

  function applyCSVMapping() {
    if (!csvParsedData) return;

    const fieldDefs = CSVImporter.getFieldDefinitions(state.platform, state.channelType);
    const allFields = [...fieldDefs.required, ...fieldDefs.optional];
    const mapping = {};

    allFields.forEach(field => {
      const select = $(`#map-${field}`);
      if (select) {
        const val = parseInt(select.value);
        if (val >= 0) mapping[field] = val;
      }
    });

    // Check required fields
    for (const req of fieldDefs.required) {
      if (mapping[req] === undefined) {
        const labels = CSVImporter.getFieldLabels();
        showToast(`Debes mapear el campo requerido: ${labels[req] || req}`, 'error');
        return;
      }
    }

    const imported = CSVImporter.mapToChannels(csvParsedData, mapping, state.platform, state.channelType);

    // Aplicar Tipo IP global si el usuario lo seleccionó
    const globalIpType = $('#csv-global-iptype')?.value;
    if (globalIpType && state.channelType === 'IP') {
      imported.forEach(ch => {
        ch.ipType = globalIpType;
        if (ch.url && typeof ch.url === 'string') {
          ch.url = ch.url.replace(/^[a-zA-Z]+:\/\//i, `${globalIpType.toLowerCase()}://`);
        }
      });
    }

    // Aplicar Encriptado y Habilitado globales para LG
    const globalEncrypted = $('#csv-global-encrypted')?.value;
    const globalEnabled = $('#csv-global-enabled')?.value;
    if (state.platform === 'lg') {
      imported.forEach(ch => {
        if (globalEncrypted) ch.encrypted = globalEncrypted;
        if (globalEnabled) ch.enabled = globalEnabled;
      });
    }

    // Ensure serviceId for Samsung if not mapped
    if (state.platform === 'samsung') {
      imported.forEach(ch => {
        if (!ch.serviceId) ch.serviceId = String(ch.channelNumber || '');
      });
    }

    state.channels = [...state.channels, ...imported];
    csvParsedData = null;
    closeModal('modal-csv');
    render();
    saveToStorage();
    showToast(`${imported.length} canal(es) importados desde CSV`, 'success');
  }

  function bindCSVImport() {
    // Handled dynamically in openCSVModal
  }

  // ── Modal Helpers ──
  function bindModalEvents() {
    // Close buttons
    $$('.modal__close').forEach(btn => {
      btn.addEventListener('click', () => {
        const overlay = btn.closest('.modal-overlay');
        overlay?.classList.remove('active');
      });
    });

    // Overlay click to close
    $$('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.classList.remove('active');
      });
    });

    // Add channel confirm
    $('#btn-confirm-add')?.addEventListener('click', addChannelFromModal);

    // Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        $$('.modal-overlay.active').forEach(o => o.classList.remove('active'));
      }
    });
  }

  function closeModal(modalId) {
    const modal = $(`#${modalId}`);
    if (modal) {
      modal.closest('.modal-overlay')?.classList.remove('active');
    }
  }

  // ── Batch Edit ──
  function openBatchModal() {
    if (state.selectedRows.size === 0) return;
    const modal = $('#modal-batch');
    if (!modal) return;
    
    const body = modal.querySelector('.modal__body');
    let html = `
      <p style="margin-bottom:15px; font-size:0.9rem; color:var(--text-secondary)">
        Se aplicarán los siguientes cambios a los <strong>${state.selectedRows.size}</strong> canales seleccionados. Deja en blanco las opciones que no deseas modificar.
      </p>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Desplazar Números de Canal (Ej. +100 o -5)</label>
          <input class="form-input" id="batch-offset" type="number" placeholder="+ / -">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Cambiar Categoría</label>
          <select class="form-select" id="batch-category">
            <option value="">-- Sin Cambio --</option>
            <option value="General">General</option>
            <option value="News">Noticias</option>
            <option value="Sports">Deportes</option>
            <option value="Movies">Películas</option>
            <option value="Kids">Infantil</option>
            <option value="Music">Música</option>
            <option value="Entertainment">Entretenimiento</option>
            <option value="Documentary">Documentales</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Estado (Habilitado)</label>
          <select class="form-select" id="batch-enabled">
            <option value="">-- Sin Cambio --</option>
            <option value="true">Habilitado</option>
            <option value="false">Deshabilitado</option>
          </select>
        </div>
      </div>
    `;
    body.innerHTML = html;
    
    $('#btn-confirm-batch').onclick = applyBatchEdit;
    modal.closest('.modal-overlay').classList.add('active');
  }

  function applyBatchEdit() {
    const offsetVal = $('#batch-offset').value;
    const categoryVal = $('#batch-category').value;
    const enabledVal = $('#batch-enabled').value;
    
    let modified = 0;
    
    state.channels.forEach((ch, idx) => {
      if (state.selectedRows.has(idx)) {
        let changed = false;
        
        if (offsetVal) {
          const num = parseInt(ch.channelNumber || ch.logicalChannel || 0);
          if (!isNaN(num)) {
            const newNum = String(num + parseInt(offsetVal));
            if (ch.channelNumber !== undefined) ch.channelNumber = newNum;
            if (ch.logicalChannel !== undefined) ch.logicalChannel = newNum;
            changed = true;
          }
        }
        
        if (categoryVal) {
          ch.category = categoryVal;
          changed = true;
        }
        
        if (enabledVal) {
          ch.enabled = enabledVal;
          changed = true;
        }
        
        if (changed) modified++;
      }
    });
    
    if (modified > 0) {
      render();
      saveToStorage();
      showToast(`Se modificaron ${modified} canales exitosamente`, 'success');
    }
    
    closeModal('modal-batch');
  }

  // ── Audit ──
  function auditChannels() {
    const issues = [];
    const numMap = new Map();
    const urlMap = new Map();
    
    state.channels.forEach((ch, idx) => {
      const num = ch.channelNumber || ch.logicalChannel || '';
      const name = ch.name || ch.label || '';
      const url = ch.url || '';
      
      // Check missing names
      if (!name.trim()) {
        issues.push({ type: 'warning', msg: `Fila ${idx + 1}: El canal no tiene nombre.` });
      }
      
      // Check duplicates number
      if (num) {
        if (numMap.has(num)) {
          issues.push({ type: 'error', msg: `Fila ${idx + 1} y ${numMap.get(num)}: Comparten el mismo número de canal (${num}).` });
        } else {
          numMap.set(num, idx + 1);
        }
      } else {
        issues.push({ type: 'error', msg: `Fila ${idx + 1}: No tiene número de canal asignado.` });
      }
      
      // Check URLs for IP channels
      if (state.channelType === 'IP') {
        if (!url.trim()) {
          issues.push({ type: 'error', msg: `Fila ${idx + 1} (${name || num}): No tiene URL Multicast asignada.` });
        } else {
          if (urlMap.has(url)) {
             issues.push({ type: 'warning', msg: `Fila ${idx + 1} y ${urlMap.get(url)}: Comparten la misma URL (${url}).` });
          } else {
             urlMap.set(url, idx + 1);
          }
        }
      }
    });
    
    renderAuditModal(issues);
  }

  function renderAuditModal(issues) {
    const modal = $('#modal-audit');
    if (!modal) return;
    
    const body = modal.querySelector('.modal__body');
    let html = '';
    
    if (issues.length === 0) {
      html = `
        <div class="empty-state" style="padding: 20px 0;">
          <div class="empty-state__icon" style="font-size:3rem">🎉</div>
          <div class="empty-state__title">¡Todo se ve perfecto!</div>
          <div class="empty-state__desc">No se encontraron conflictos ni errores en la lista actual de ${state.channels.length} canales.</div>
        </div>
      `;
    } else {
      const errors = issues.filter(i => i.type === 'error').length;
      const warnings = issues.filter(i => i.type === 'warning').length;
      
      html = `
        <p style="margin-bottom:15px; font-size:0.95rem;">
          Se detectaron <strong>${errors} errores</strong> y <strong>${warnings} advertencias</strong>.
        </p>
        <div class="audit-list">
      `;
      issues.forEach(i => {
        const icon = i.type === 'error' ? '❌' : '⚠️';
        html += `<div class="audit-item audit-item--${i.type}">
          <div>${icon}</div>
          <div>${escapeHtml(i.msg)}</div>
        </div>`;
      });
      html += `</div>`;
    }
    
    body.innerHTML = html;
    modal.closest('.modal-overlay').classList.add('active');
  }

  // ── Toast Notifications ──
  function showToast(message, type = 'info') {
    const container = $('#toast-container');
    if (!container) return;

    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.innerHTML = `
      <span class="toast__icon">${icons[type] || icons.info}</span>
      <span class="toast__message">${escapeHtml(message)}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('removing');
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // ── Local Storage ──
  function saveToStorage() {
    try {
      const data = {
        platform: state.platform,
        channelType: state.channelType,
        lists: lists
      };
      localStorage.setItem('channelGenerator_state', JSON.stringify(data));
    } catch (e) {
      // Storage full or unavailable
    }
  }

  function loadFromStorage() {
    try {
      const raw = localStorage.getItem('channelGenerator_state');
      if (raw) {
        const data = JSON.parse(raw);
        state.platform = data.platform || 'samsung';
        state.channelType = data.channelType || 'IP';
        if (data.lists) {
          lists = data.lists;
        } else if (data.channels) {
          // Backward compatibility
          lists[state.platform][state.channelType] = data.channels;
        }
      }
    } catch (e) {
      // Corrupted data
    }
  }

  // ── Utilities ──
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ── Public API ──
  return {
    init,
    openAddModal,
    openCSVModal,
    showToast
  };

})();

// Boot
document.addEventListener('DOMContentLoaded', App.init);
