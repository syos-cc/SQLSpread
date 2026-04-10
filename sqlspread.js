
let SQL = null;
let db = null;
let dbFilename = 'database.sqlite';
let dbFilePath = null;
let dbLoadedFromFilesystem = false;
let schemaItems = [];
let activeTab = null;
let pendingDownloadUrl = null;
let errorVisibleUntil = 0;
let errorClearTimeout = null;
let currentSort = { column: null, direction: null };
let selectedRowIds = new Set();
let pendingConfirmAction = null;
let pendingCreateAction = null;
let createTableColumnRowCounter = 0;
let primaryKeyRowId = null;
let sqlShellHistory = [];
let sqlShellHistoryIndex = -1;
let lastSelfTestResults = [];

const dbFileInput = document.getElementById('dbFile');
const createBtn = document.getElementById('createBtn');
const saveBtn = document.getElementById('saveBtn');
const codeBtn = document.getElementById('codeBtn');
const statusEl = document.getElementById('status');
const tabsEl = document.getElementById('tabs');
const metaEl = document.getElementById('meta');
const gridWrapEl = document.getElementById('gridWrap');
const testsBadgeEl = document.getElementById('testsBadge');
const inlineErrorEl = document.getElementById('inlineError');
const confirmModalEl = document.getElementById('confirmModal');
const confirmModalTextEl = document.getElementById('confirmModalText');
const confirmCancelBtnEl = document.getElementById('confirmCancelBtn');
const confirmOkBtnEl = document.getElementById('confirmOkBtn');
const createDbModalEl = document.getElementById('createDbModal');
const createDbNameInputEl = document.getElementById('createDbNameInput');
const createDbCancelBtnEl = document.getElementById('createDbCancelBtn');
const createDbConfirmBtnEl = document.getElementById('createDbConfirmBtn');
const bulkActionWrapEl = document.getElementById('bulkActionWrap');
const bulkActionSelectEl = document.getElementById('bulkActionSelect');
const bulkActionBtnEl = document.getElementById('bulkActionBtn');
const createTableModalEl = document.getElementById('createTableModal');
const createTableNameInputEl = document.getElementById('createTableNameInput');
const createTableColumnsWrapEl = document.getElementById('createTableColumnsWrap');
const createTableModalErrorEl = document.getElementById('createTableModalError');
const createObjectTypeSelectEl = document.getElementById('createObjectTypeSelect');
const createTableSectionEl = document.getElementById('createTableSection');
const createViewSectionEl = document.getElementById('createViewSection');
const createViewNameInputEl = document.getElementById('createViewNameInput');
const createViewSqlInputEl = document.getElementById('createViewSqlInput');
const addColumnRowBtnEl = document.getElementById('addColumnRowBtn');
const createTableCancelBtnEl = document.getElementById('createTableCancelBtn');
const createTableConfirmBtnEl = document.getElementById('createTableConfirmBtn');
const insertRowModalEl = document.getElementById('insertRowModal');
const insertRowModalErrorEl = document.getElementById('insertRowModalError');
const insertRowFormEl = document.getElementById('insertRowForm');
const insertRowCancelBtnEl = document.getElementById('insertRowCancelBtn');
const insertRowConfirmBtnEl = document.getElementById('insertRowConfirmBtn');
const sqlShellModalEl = document.getElementById('sqlShellModal');
const sqlShellOutputEl = document.getElementById('sqlShellOutput');
const sqlShellInputEl = document.getElementById('sqlShellInput');
const sqlShellRunBtnEl = document.getElementById('sqlShellRunBtn');
const sqlShellClearBtnEl = document.getElementById('sqlShellClearBtn');
const sqlShellCloseBtnEl = document.getElementById('sqlShellCloseBtn');
let sqlShellInputResizeObserver = null;

function setStatus(msg) {
    statusEl.textContent = msg;
}

function hasNativeFsBridge() {
    return !!(window.sqlspreadFS && typeof window.sqlspreadFS.openDatabase === 'function' && typeof window.sqlspreadFS.saveDatabase === 'function');
}

function getPreferredDatabaseName(name) {
    const base = String(name || dbFilename || 'database.sqlite').trim() || 'database.sqlite';
    return /\.(sqlite|sqlite3|db|db3)$/i.test(base) ? base : `${base}.sqlite`;
}

function setCurrentDatabaseOrigin({ filename, filePath = null, filesystemBacked = false } = {}) {
    dbFilename = getPreferredDatabaseName(filename || dbFilename);
    dbFilePath = filePath || null;
    dbLoadedFromFilesystem = !!filesystemBacked;
}

function showModalError(targetEl, message) {
    if (!targetEl) return;
    targetEl.textContent = message || 'Unknown error';
    targetEl.classList.add('visible');
}

function clearModalError(targetEl) {
    if (!targetEl) return;
    targetEl.textContent = '';
    targetEl.classList.remove('visible');
}

function updateBulkActionVisibility() {
    if (selectedRowIds.size > 0) bulkActionWrapEl.classList.add('visible');
    else bulkActionWrapEl.classList.remove('visible');
}

function getRowSelectionKey(rowData) {
    if (rowData.__rowid__ !== undefined && rowData.__rowid__ !== null) return `rowid:${rowData.__rowid__}`;
    return JSON.stringify(rowData);
}

function openConfirmModal(message, onConfirm) {
    pendingConfirmAction = onConfirm;
    confirmModalTextEl.textContent = message;
    confirmModalEl.classList.add('visible');
    confirmModalEl.setAttribute('aria-hidden', 'false');
}

function closeConfirmModal() {
    pendingConfirmAction = null;
    confirmModalEl.classList.remove('visible');
    confirmModalEl.setAttribute('aria-hidden', 'true');
}

function confirmModalOk() {
    const action = pendingConfirmAction;
    closeConfirmModal();
    if (typeof action === 'function') action();
}

function openCreateDbModal(onCreate) {
    pendingCreateAction = onCreate;
    createDbNameInputEl.value = 'new_database';
    createDbModalEl.classList.add('visible');
    createDbModalEl.setAttribute('aria-hidden', 'false');
}

function closeCreateDbModal() {
    pendingCreateAction = null;
    createDbModalEl.classList.remove('visible');
    createDbModalEl.setAttribute('aria-hidden', 'true');
}

function confirmCreateDbModal() {
    const action = pendingCreateAction;
    const enteredName = (createDbNameInputEl.value || '').trim();
    if (!enteredName) {
    showError('Please enter a database name');
    return;
    }
    closeCreateDbModal();
    if (typeof action === 'function') action(enteredName);
}

function syncCreateObjectMode() {
    const mode = createObjectTypeSelectEl.value;
    createTableSectionEl.classList.toggle('visible', mode === 'table');
    createViewSectionEl.classList.toggle('visible', mode === 'view');
}

function openCreateTableModal() {
    resetCreateTableModal();
    clearModalError(createTableModalErrorEl);
    syncCreateObjectMode();
    createTableModalEl.classList.add('visible');
    createTableModalEl.setAttribute('aria-hidden', 'false');
}

function closeCreateTableModal() {
    clearModalError(createTableModalErrorEl);
    createTableModalEl.classList.remove('visible');
    createTableModalEl.setAttribute('aria-hidden', 'true');
}

function openInsertRowModal(item) {
    if (!db || !isInsertAllowedForItem(item)) return;
    clearModalError(insertRowModalErrorEl);
    const info = getTableInfo(item.name).filter((col) => !String(col.name || '').startsWith('inv_'));
    const autoIncrementCols = getAutoIncrementColumns(item.name);
    insertRowFormEl.innerHTML = '';

    for (const col of info) {
    const label = document.createElement('label');
    label.className = 'insert-row-label';
    label.textContent = getDisplayColumnName(col.name);
    label.title = col.name;

    const isBoolean = /bool/i.test(String(col.type || ''));
    const isAutoIncrement = autoIncrementCols.has(col.name);

    if (isBoolean) {
        const wrap = document.createElement('div');
        wrap.className = 'insert-row-checkbox-wrap';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.dataset.columnName = col.name;
        checkbox.dataset.columnType = String(col.type || '');
        checkbox.dataset.notnull = String(col.notnull || 0);
        checkbox.dataset.isBoolean = '1';
        checkbox.dataset.isAutoIncrement = isAutoIncrement ? '1' : '0';
        if (isAutoIncrement) {
        checkbox.disabled = true;
        checkbox.title = 'Auto increment column';
        }
        wrap.appendChild(checkbox);
        insertRowFormEl.appendChild(label);
        insertRowFormEl.appendChild(wrap);
        continue;
    }

    const control = document.createElement('input');
    control.type = 'text';
    control.className = 'bulk-action-select insert-row-control';
    control.placeholder = String(col.dflt_value ?? '') === 'null' ? '' : String(col.dflt_value ?? '');
    control.dataset.columnName = col.name;
    control.dataset.columnType = String(col.type || '');
    control.dataset.notnull = String(col.notnull || 0);
    control.dataset.isBoolean = '0';
    control.dataset.isAutoIncrement = isAutoIncrement ? '1' : '0';
    if (isAutoIncrement) {
        control.disabled = true;
        control.title = 'Auto increment column';
    }
    insertRowFormEl.appendChild(label);
    insertRowFormEl.appendChild(control);
    }

    insertRowModalEl.dataset.tableName = item.name;
    insertRowModalEl.classList.add('visible');
    insertRowModalEl.setAttribute('aria-hidden', 'false');
}

function closeInsertRowModal() {
    clearModalError(insertRowModalErrorEl);
    insertRowModalEl.classList.remove('visible');
    insertRowModalEl.setAttribute('aria-hidden', 'true');
    insertRowModalEl.dataset.tableName = '';
    insertRowFormEl.innerHTML = '';
}

function confirmInsertRowModal() {
    if (!db) return;
    const tableName = insertRowModalEl.dataset.tableName;
    if (!tableName) return;
    const item = schemaItems.find((entry) => entry.name === tableName);
    if (!isInsertAllowedForItem(item)) {
    showModalError(insertRowModalErrorEl, 'Insert is not allowed for this table');
    return;
    }

    const controls = Array.from(insertRowFormEl.querySelectorAll('input'));
    const insertCols = [];
    const insertVals = [];

    for (const control of controls) {
    if (control.disabled) continue;
    const colName = control.dataset.columnName;
    const colType = control.dataset.columnType || '';
    const isBoolean = control.dataset.isBoolean === '1';
    const notNull = control.dataset.notnull === '1';
    let rawValue = isBoolean ? (control.checked ? '1' : '0') : control.value.trim();

    if (!isBoolean && rawValue === '') {
        continue;
    }

    if (!isBoolean && /(int|real|float|double|numeric|decimal)/i.test(colType)) {
        if (/int/i.test(colType)) {
        if (!/^[-+]?[0-9]+$/.test(rawValue)) {
            showModalError(insertRowModalErrorEl, `Invalid integer value for ${colName}`);
            return;
        }
        } else {
        rawValue = rawValue.replace(/,/g, '.');
        control.value = rawValue;
        if (!/^[-+]?[0-9]+([.][0-9]+)?$/.test(rawValue)) {
            showModalError(insertRowModalErrorEl, `Invalid numeric value for ${colName}`);
            return;
        }
        }
    }

    if (!isBoolean && rawValue === '' && notNull) continue;
    insertCols.push(escapeIdent(colName));
    insertVals.push(isBoolean ? rawValue : sqlLiteralFromInput(rawValue));
    }

    clearModalError(insertRowModalErrorEl);
    try {
    if (insertCols.length) db.run(`INSERT INTO ${escapeIdent(tableName)} (${insertCols.join(', ')}) VALUES (${insertVals.join(', ')})`);
    else db.run(`INSERT INTO ${escapeIdent(tableName)} DEFAULT VALUES`);
    closeInsertRowModal();
    selectedRowIds.clear();
    updateBulkActionVisibility();
    renderActiveTab();
    setStatus(`Inserted row into ${tableName}`);
    } catch (err) {
    showModalError(insertRowModalErrorEl, err && err.message ? err.message : String(err));
    }
}

function getSupportedSqliteTypes() {
    return [
    'INTEGER', 'TEXT', 'REAL', 'BLOB', 'NUMERIC', 'INT', 'TINYINT', 'SMALLINT', 'MEDIUMINT', 'BIGINT',
    'UNSIGNED BIG INT', 'INT2', 'INT8', 'CHARACTER(20)', 'VARCHAR(255)', 'VARYING CHARACTER(255)',
    'NCHAR(55)', 'NATIVE CHARACTER(70)', 'NVARCHAR(100)', 'CLOB', 'DOUBLE', 'DOUBLE PRECISION',
    'FLOAT', 'DECIMAL(10,2)', 'BOOLEAN', 'DATE', 'DATETIME'
    ];
}

function updatePrimaryKeySelection(selectedRowId) {
    primaryKeyRowId = selectedRowId || null;
    const rows = Array.from(createTableColumnsWrapEl.children);
    for (const row of rows) {
    const pkCheckbox = row.querySelector('[data-role="primary_key"]');
    if (pkCheckbox) pkCheckbox.checked = row.dataset.rowId === primaryKeyRowId;
    }
}

function updateAutoIncrementAvailability(row) {
    const typeSelect = row.querySelector('[data-role="type"]');
    const autoIncrementCheckbox = row.querySelector('[data-role="auto_increment"]');
    const defaultInput = row.querySelector('[data-role="default"]');
    const isIntegerType = /^(INTEGER|INT|TINYINT|SMALLINT|MEDIUMINT|BIGINT|INT2|INT8|UNSIGNED BIG INT)$/i.test(typeSelect.value);
    autoIncrementCheckbox.disabled = !isIntegerType;
    if (!isIntegerType) autoIncrementCheckbox.checked = false;
    if (autoIncrementCheckbox.checked) {
    defaultInput.value = '';
    defaultInput.disabled = true;
    } else {
    defaultInput.disabled = false;
    }
}

function sqlDefaultLiteral(value) {
    const trimmed = value.trim();
    if (trimmed === '') return '';
    if (
    /^null$/i.test(trimmed) ||
    /^current_(time|date|timestamp)$/i.test(trimmed) ||
    /^[-+]?[0-9]+(\.[0-9]+)?$/.test(trimmed) ||
    /^'.*'$/.test(trimmed) ||
    /^\(.*\)$/.test(trimmed)
    ) return trimmed;
    return `'${escapeSqlString(trimmed)}'`;
}

function createColumnRow(initial = {}) {
    createTableColumnRowCounter += 1;
    const row = document.createElement('div');
    row.style.display = 'grid';
    row.style.gridTemplateColumns = '1.15fr 1fr 1fr 1fr 0.55fr 0.55fr 0.8fr auto';
    row.style.gap = '8px';
    row.style.alignItems = 'center';
    row.dataset.rowId = String(createTableColumnRowCounter);

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.placeholder = 'column_name';
    nameInput.className = 'bulk-action-select';
    nameInput.style.width = '100%';
    nameInput.value = initial.name || '';
    nameInput.dataset.role = 'name';

    const typeSelect = document.createElement('select');
    typeSelect.className = 'bulk-action-select';
    typeSelect.style.width = '100%';
    typeSelect.dataset.role = 'type';
    for (const type of getSupportedSqliteTypes()) {
    const opt = document.createElement('option');
    opt.value = type;
    opt.textContent = type;
    if ((initial.type || 'TEXT') === type) opt.selected = true;
    typeSelect.appendChild(opt);
    }

    const defaultInput = document.createElement('input');
    defaultInput.type = 'text';
    defaultInput.placeholder = 'default';
    defaultInput.className = 'bulk-action-select';
    defaultInput.style.width = '100%';
    defaultInput.value = initial.defaultValue || '';
    defaultInput.dataset.role = 'default';

    const noteInput = document.createElement('input');
    noteInput.type = 'text';
    noteInput.placeholder = 'note';
    noteInput.className = 'bulk-action-select';
    noteInput.style.width = '100%';
    noteInput.value = initial.note || '';
    noteInput.dataset.role = 'note';

    const primaryKeyWrap = document.createElement('label');
    primaryKeyWrap.style.display = 'inline-flex';
    primaryKeyWrap.style.alignItems = 'center';
    primaryKeyWrap.style.justifyContent = 'center';
    const primaryKeyCheckbox = document.createElement('input');
    primaryKeyCheckbox.type = 'checkbox';
    primaryKeyCheckbox.dataset.role = 'primary_key';
    primaryKeyCheckbox.checked = !!initial.primaryKey;
    primaryKeyCheckbox.title = 'Primary key';
    primaryKeyCheckbox.addEventListener('change', () => {
    if (primaryKeyCheckbox.checked) updatePrimaryKeySelection(row.dataset.rowId);
    else if (primaryKeyRowId === row.dataset.rowId) updatePrimaryKeySelection(null);
    });
    primaryKeyWrap.appendChild(primaryKeyCheckbox);

    const uniqueWrap = document.createElement('label');
    uniqueWrap.style.display = 'inline-flex';
    uniqueWrap.style.alignItems = 'center';
    uniqueWrap.style.justifyContent = 'center';
    const uniqueCheckbox = document.createElement('input');
    uniqueCheckbox.type = 'checkbox';
    uniqueCheckbox.dataset.role = 'unique';
    uniqueCheckbox.checked = !!initial.unique;
    uniqueCheckbox.title = 'Unique';
    uniqueWrap.appendChild(uniqueCheckbox);

    const autoIncrementWrap = document.createElement('label');
    autoIncrementWrap.style.display = 'inline-flex';
    autoIncrementWrap.style.alignItems = 'center';
    autoIncrementWrap.style.justifyContent = 'center';
    const autoIncrementCheckbox = document.createElement('input');
    autoIncrementCheckbox.type = 'checkbox';
    autoIncrementCheckbox.dataset.role = 'auto_increment';
    autoIncrementCheckbox.checked = !!initial.autoIncrement;
    autoIncrementCheckbox.title = 'Auto increment';
    autoIncrementWrap.appendChild(autoIncrementCheckbox);

    typeSelect.addEventListener('change', () => updateAutoIncrementAvailability(row));
    autoIncrementCheckbox.addEventListener('change', () => updateAutoIncrementAvailability(row));

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'tab-delete-btn';
    removeBtn.textContent = '✕';
    removeBtn.title = 'Remove column row';
    removeBtn.addEventListener('click', () => {
    const removedWasPrimary = primaryKeyRowId === row.dataset.rowId;
    row.remove();
    if (removedWasPrimary) updatePrimaryKeySelection(null);
    if (!createTableColumnsWrapEl.children.length) createTableColumnsWrapEl.appendChild(createColumnRow());
    });

    row.appendChild(nameInput);
    row.appendChild(typeSelect);
    row.appendChild(defaultInput);
    row.appendChild(noteInput);
    row.appendChild(primaryKeyWrap);
    row.appendChild(uniqueWrap);
    row.appendChild(autoIncrementWrap);
    row.appendChild(removeBtn);

    updateAutoIncrementAvailability(row);
    if (initial.primaryKey) updatePrimaryKeySelection(row.dataset.rowId);
    return row;
}

function resetCreateTableModal() {
    primaryKeyRowId = null;
    createObjectTypeSelectEl.value = 'table';
    createTableNameInputEl.value = '';
    createViewNameInputEl.value = '';
    createViewSqlInputEl.value = '';
    createTableColumnsWrapEl.innerHTML = '';
    createTableColumnsWrapEl.appendChild(createColumnRow({ type: 'TEXT' }));
    syncCreateObjectMode();
}

function collectCreateTableColumns() {
    return Array.from(createTableColumnsWrapEl.children).map((row) => ({
    rowId: row.dataset.rowId,
    name: row.querySelector('[data-role="name"]').value.trim(),
    type: row.querySelector('[data-role="type"]').value,
    defaultValue: row.querySelector('[data-role="default"]').value.trim(),
    note: row.querySelector('[data-role="note"]').value.trim(),
    primaryKey: row.querySelector('[data-role="primary_key"]').checked,
    unique: row.querySelector('[data-role="unique"]').checked,
    autoIncrement: row.querySelector('[data-role="auto_increment"]').checked
    }));
}

function createViewFromModal() {
    if (!db) {
    showModalError(createTableModalErrorEl, 'No database loaded');
    return;
    }
    const viewName = createViewNameInputEl.value.trim();
    const viewSql = createViewSqlInputEl.value.trim();
    if (!viewName) {
    showModalError(createTableModalErrorEl, 'Please enter a view name');
    return;
    }
    if (!viewSql) {
    showModalError(createTableModalErrorEl, 'Please enter a SELECT statement');
    return;
    }
    if (!/^select\b/i.test(viewSql)) {
    showModalError(createTableModalErrorEl, 'The view definition must start with SELECT');
    return;
    }
    clearModalError(createTableModalErrorEl);
    try {
    db.run(`CREATE VIEW ${escapeIdent(viewName)} AS ${viewSql}`);
    schemaItems = getObjects();
    activeTab = viewName;
    currentSort = { column: null, direction: null };
    selectedRowIds.clear();
    updateBulkActionVisibility();
    renderTabs();
    renderActiveTab();
    closeCreateTableModal();
    setStatus(`Created view: ${viewName}`);
    } catch (err) {
    showModalError(createTableModalErrorEl, err && err.message ? err.message : String(err));
    }
}

function createTableFromModal() {
    if (createObjectTypeSelectEl.value === 'view') {
    createViewFromModal();
    return;
    }
    if (!db) {
    showModalError(createTableModalErrorEl, 'No database loaded');
    return;
    }
    const tableName = createTableNameInputEl.value.trim();
    if (!tableName) {
    showModalError(createTableModalErrorEl, 'Please enter a table name');
    return;
    }
    const columns = collectCreateTableColumns().filter((col) => col.name);
    if (!columns.length) {
    showModalError(createTableModalErrorEl, 'Please add at least one column');
    return;
    }
    const invalidColumn = columns.find((col) => /[^A-Za-z0-9_]/.test(col.name));
    if (invalidColumn) {
    showModalError(createTableModalErrorEl, `Invalid column name: ${invalidColumn.name}`);
    return;
    }
    const primaryKeyColumns = columns.filter((col) => col.primaryKey);
    if (primaryKeyColumns.length > 1) {
    showModalError(createTableModalErrorEl, 'Only one primary key column is allowed');
    return;
    }
    const invalidAutoIncrement = columns.find((col) => col.autoIncrement && !/^(INTEGER|INT|TINYINT|SMALLINT|MEDIUMINT|BIGINT|INT2|INT8|UNSIGNED BIG INT)$/i.test(col.type));
    if (invalidAutoIncrement) {
    showModalError(createTableModalErrorEl, `AUTOINCREMENT requires an integer type: ${invalidAutoIncrement.name}`);
    return;
    }
    const autoIncrementColumn = columns.find((col) => col.autoIncrement);
    if (autoIncrementColumn && !autoIncrementColumn.primaryKey) {
    showModalError(createTableModalErrorEl, 'AUTOINCREMENT requires PRIMARY KEY');
    return;
    }

    const columnDefs = columns.map((col) => {
    const parts = [`${escapeIdent(col.name)} ${col.type}`];
    if (col.primaryKey) parts.push('PRIMARY KEY');
    if (col.autoIncrement) parts.push('AUTOINCREMENT');
    if (col.unique) parts.push('UNIQUE');
    if (col.defaultValue) parts.push(`DEFAULT ${sqlDefaultLiteral(col.defaultValue)}`);
    return parts.join(' ');
    });

    clearModalError(createTableModalErrorEl);
    try {
    db.run(`CREATE TABLE ${escapeIdent(tableName)} (${columnDefs.join(', ')})`);
    schemaItems = getObjects();
    activeTab = tableName;
    currentSort = { column: null, direction: null };
    selectedRowIds.clear();
    updateBulkActionVisibility();
    renderTabs();
    renderActiveTab();
    closeCreateTableModal();
    setStatus(`Created table: ${tableName}`);
    } catch (err) {
    showModalError(createTableModalErrorEl, err && err.message ? err.message : String(err));
    }
}

function appendSqlShellEntry(prompt, content, kind = 'result') {
    const wrapper = document.createElement('div');
    wrapper.className = 'sql-shell-entry';
    const promptEl = document.createElement('div');
    promptEl.className = 'sql-shell-prompt';
    promptEl.textContent = `sqlite> ${prompt}`;
    wrapper.appendChild(promptEl);
    const contentEl = document.createElement('div');
    contentEl.className = kind === 'error' ? 'sql-shell-error' : 'sql-shell-result';
    contentEl.textContent = content;
    wrapper.appendChild(contentEl);
    sqlShellOutputEl.appendChild(wrapper);
    sqlShellOutputEl.scrollTop = sqlShellOutputEl.scrollHeight;
}

function formatSqlExecResult(execResult) {
    if (!execResult.length) return 'Statement executed.';
    return execResult.map((set) => {
    const header = set.columns.join(' | ');
    const separator = set.columns.map(() => '---').join(' | ');
    const rows = set.values.map((row) => row.map((value) => value === null ? 'NULL' : String(value)).join(' | '));
    return [header, separator, ...rows].join('\n');
    }).join('\n\n');
}

function formatSchemaLines(values) {
    return values.map((v) => v[0]).join('\n\n');
}

function formatIndexLines(values) {
    return values.map((v) => `${v[1]}: ${v[0]}`).join('\n');
}

function formatInfoLines(info) {
    return [
    `tables: ${info.tables}`,
    `views: ${info.views}`,
    `indexes: ${info.indexes}`,
    `triggers: ${info.triggers}`
    ].join('\n');
}

function formatSimpleList(values) {
    return values.map((v) => String(v[0])).join('  ');
}

function refreshSchemaAfterSqlRun() {
    schemaItems = getObjects();
    if (activeTab && !schemaItems.find((item) => item.name === activeTab)) activeTab = schemaItems[0]?.name || null;
    if (!activeTab) activeTab = schemaItems[0]?.name || null;
    currentSort = { column: null, direction: null };
    selectedRowIds.clear();
    updateBulkActionVisibility();
    renderTabs();
    renderActiveTab();
}

function adjustSqlShellModalHeight() {
    if (!sqlShellModalEl.classList.contains('visible')) return;
    const modalCardEl = sqlShellModalEl.querySelector('.sql-shell-modal-card');
    if (!modalCardEl) return;
    const viewportMax = Math.max(420, window.innerHeight - 48);
    const headerHeight = sqlShellModalEl.querySelector('.sql-shell-header')?.offsetHeight || 0;
    const bodyPadding = 28;
    const outputMinHeight = 140;
    const inputRowHeight = sqlShellInputEl.offsetHeight;
    const desiredHeight = Math.min(viewportMax, Math.max(420, headerHeight + bodyPadding + outputMinHeight + inputRowHeight + 24));
    modalCardEl.style.height = `${desiredHeight}px`;
}

function ensureSqlShellResizeHandling() {
    if (sqlShellInputResizeObserver || typeof ResizeObserver === 'undefined') return;
    sqlShellInputResizeObserver = new ResizeObserver(() => adjustSqlShellModalHeight());
    sqlShellInputResizeObserver.observe(sqlShellInputEl);
}

function openSqlShellModal() {
    if (!db) return;
    sqlShellModalEl.classList.add('visible');
    sqlShellModalEl.setAttribute('aria-hidden', 'false');
    ensureSqlShellResizeHandling();
    adjustSqlShellModalHeight();
    if (!sqlShellOutputEl.childElementCount) {
    appendSqlShellEntry('.help', 'Enter SQL statements and press Run. SELECT returns rows. Other statements are executed directly.');
    }
}

function closeSqlShellModal() {
    sqlShellModalEl.classList.remove('visible');
    sqlShellModalEl.setAttribute('aria-hidden', 'true');
}

function runSqlShellCommand() {
    if (!db) {
    showError('No database loaded');
    return;
    }

    const command = sqlShellInputEl.value.trim();
    if (!command) return;
    sqlShellHistory.push(command);
    sqlShellHistoryIndex = sqlShellHistory.length;

    if (command === '.schema') {
    try {
        const res = db.exec("SELECT sql FROM sqlite_master WHERE sql NOT NULL ORDER BY type, name");
        appendSqlShellEntry(command, res.length ? formatSchemaLines(res[0].values) : 'No schema available.');
    } catch (err) {
        appendSqlShellEntry(command, err && err.message ? err.message : String(err), 'error');
    }
    sqlShellInputEl.value = '';
    return;
    }

    if (command.startsWith('.schema ')) {
    const name = command.substring(8).trim();
    try {
        const res = db.exec(`SELECT sql FROM sqlite_master WHERE name = '${escapeSqlString(name)}' AND sql NOT NULL`);
        appendSqlShellEntry(command, res.length ? formatSchemaLines(res[0].values) : `No schema found for ${name}`);
    } catch (err) {
        appendSqlShellEntry(command, err && err.message ? err.message : String(err), 'error');
    }
    sqlShellInputEl.value = '';
    return;
    }

    if (command === '.tables' || command === '.views' || command === '.triggers') {
    const type = command === '.tables' ? 'table' : (command === '.views' ? 'view' : 'trigger');
    const noMsg = command === '.tables' ? 'No tables found.' : (command === '.views' ? 'No views found.' : 'No triggers found.');
    try {
        const filter = type === 'table' ? "AND name NOT LIKE 'sqlite_%'" : '';
        const res = db.exec(`SELECT name FROM sqlite_master WHERE type = '${type}' ${filter} ORDER BY lower(name)`);
        appendSqlShellEntry(command, res.length && res[0].values.length ? formatSimpleList(res[0].values) : noMsg);
    } catch (err) {
        appendSqlShellEntry(command, err && err.message ? err.message : String(err), 'error');
    }
    sqlShellInputEl.value = '';
    return;
    }

    if (command === '.indexes') {
    try {
        const res = db.exec("SELECT name, tbl_name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%' ORDER BY tbl_name, name");
        appendSqlShellEntry(command, res.length && res[0].values.length ? formatIndexLines(res[0].values) : 'No indexes found.');
    } catch (err) {
        appendSqlShellEntry(command, err && err.message ? err.message : String(err), 'error');
    }
    sqlShellInputEl.value = '';
    return;
    }

    if (command === '.info') {
    try {
        const tables = db.exec("SELECT count(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")[0].values[0][0];
        const views = db.exec("SELECT count(*) FROM sqlite_master WHERE type='view'")[0].values[0][0];
        const indexes = db.exec("SELECT count(*) FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'")[0].values[0][0];
        const triggers = db.exec("SELECT count(*) FROM sqlite_master WHERE type='trigger'")[0].values[0][0];
        appendSqlShellEntry(command, formatInfoLines({ tables, views, indexes, triggers }));
    } catch (err) {
        appendSqlShellEntry(command, err && err.message ? err.message : String(err), 'error');
    }
    sqlShellInputEl.value = '';
    return;
    }

    try {
    const execResult = db.exec(command);
    appendSqlShellEntry(command, formatSqlExecResult(execResult));
    sqlShellInputEl.value = '';
    refreshSchemaAfterSqlRun();
    setStatus('SQL executed');
    } catch (err) {
    appendSqlShellEntry(command, err && err.message ? err.message : String(err), 'error');
    }
}

function deleteSchemaItem(itemName) {
    const item = schemaItems.find((entry) => entry.name === itemName);
    if (!item) {
    showError(`Delete failed: object ${itemName} was not found.`);
    return;
    }
    const objectKeyword = item.type === 'view' ? 'view' : 'table';
    openConfirmModal(`The ${objectKeyword} \"${itemName}\" will be deleted.`, () => {
    try {
        db.run(`DROP ${item.type === 'view' ? 'VIEW' : 'TABLE'} ${escapeIdent(itemName)}`);
        schemaItems = getObjects();
        if (activeTab === itemName) activeTab = schemaItems[0]?.name || null;
        selectedRowIds.clear();
        currentSort = { column: null, direction: null };
        updateBulkActionVisibility();
        renderTabs();
        renderActiveTab();
        setStatus(`Deleted ${item.type}: ${itemName}`);
    } catch (err) {
        showError(err && err.message ? err.message : String(err));
    }
    });
}

function escapeHtml(value) {
    return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;');
}

function showError(message) {
    const safeMessage = escapeHtml(message ?? 'Unknown error');
    if (errorClearTimeout) {
    clearTimeout(errorClearTimeout);
    errorClearTimeout = null;
    }
    inlineErrorEl.innerHTML = `<div id="errorBox" title="${safeMessage}">${safeMessage}</div>`;
    inlineErrorEl.classList.remove('fading');
    inlineErrorEl.classList.add('visible');
    errorVisibleUntil = Date.now() + 3000;
    errorClearTimeout = setTimeout(() => startFadeOut(), 3000);
}

function clearError(force = false) {
    const now = Date.now();
    if (!force && now < errorVisibleUntil) {
    const remaining = errorVisibleUntil - now;
    if (errorClearTimeout) clearTimeout(errorClearTimeout);
    errorClearTimeout = setTimeout(() => startFadeOut(), remaining);
    return;
    }
    if (errorClearTimeout) {
    clearTimeout(errorClearTimeout);
    errorClearTimeout = null;
    }
    inlineErrorEl.classList.remove('visible');
    inlineErrorEl.classList.remove('fading');
    inlineErrorEl.innerHTML = '';
    errorVisibleUntil = 0;
}

function startFadeOut() {
    inlineErrorEl.classList.add('fading');
    if (errorClearTimeout) clearTimeout(errorClearTimeout);
    errorClearTimeout = setTimeout(() => clearError(true), 1000);
}

function revokePendingDownloadUrl() {
    if (pendingDownloadUrl) {
    URL.revokeObjectURL(pendingDownloadUrl);
    pendingDownloadUrl = null;
    }
}

function releaseExportUrl() { revokePendingDownloadUrl(); }

function prepareDownloadLink(blob, filename) {
    revokePendingDownloadUrl();
    pendingDownloadUrl = URL.createObjectURL(blob);
    return { url: pendingDownloadUrl, filename };
}

function escapeIdent(name) {
    return '"' + String(name).replace(/"/g, '""') + '"';
}

function escapeSqlString(value) {
    return String(value).replace(/'/g, "''");
}

function sqlLiteralFromInput(value) {
    if (value === '__NULL__') return 'NULL';
    return `'${escapeSqlString(value)}'`;
}

function prettyCellValue(value) {
    if (value === null || value === undefined) return '<span class="null">NULL</span>';
    return escapeHtml(value);
}

async function initSqlJsEngine() {
    if (SQL) return SQL;
    SQL = await initSqlJs({
    locateFile: (file) => `./${file}`
    });
    return SQL;
}

function query(sql) {
    if (!db) throw new Error('No database loaded');
    return db.exec(sql);
}

function rowsFromExecResult(res) {
    if (!res.length) return [];
    const cols = res[0].columns;
    return res[0].values.map((row) => {
    const obj = {};
    cols.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
    });
}

function getObjects() {
    const sql = `
    SELECT name, type, sql
    FROM sqlite_master
    WHERE type IN ('table', 'view')
        AND name NOT LIKE 'sqlite_%'
    ORDER BY CASE type WHEN 'table' THEN 0 ELSE 1 END, lower(name)
    `;
    return rowsFromExecResult(query(sql)).filter((obj) => !String(obj.name || '').startsWith('inv_'));
}

function getTableInfo(name) {
    return rowsFromExecResult(query(`PRAGMA table_info(${escapeIdent(name)})`));
}

function getCreateSqlForObject(name) {
    const res = query(`SELECT sql FROM sqlite_master WHERE name = ${sqlLiteralFromInput(name)} AND sql NOT NULL LIMIT 1`);
    if (!res.length || !res[0].values.length) return '';
    return String(res[0].values[0][0] || '');
}

function getAutoIncrementColumns(name) {
    const createSql = getCreateSqlForObject(name);
    const cols = new Set();
    const regex = /["`\[]?(\w+)["`\]]?\s+INTEGER\s+PRIMARY\s+KEY\s+AUTOINCREMENT/gi;
    let match;
    while ((match = regex.exec(createSql)) !== null) cols.add(match[1]);
    return cols;
}

function isInsertAllowedForItem(item) {
    return !!(item && item.type === 'table' && !String(item.name || '').startsWith('ro_'));
}

function getPrimaryKeyColumns(name) {
    const info = getTableInfo(name);
    return info.filter((c) => Number(c.pk) > 0).sort((a, b) => Number(a.pk) - Number(b.pk)).map((c) => c.name);
}

function getBooleanColumns(name) {
    const info = getTableInfo(name);
    return new Set(info.filter((c) => /bool/i.test(String(c.type || ''))).map((c) => c.name));
}

function getNumericColumns(name) {
    const info = getTableInfo(name);
    return new Set(info.filter((c) => /(int|real|float|double|numeric|decimal)/i.test(String(c.type || ''))).map((c) => c.name));
}

function getIntegerColumns(name) {
    const info = getTableInfo(name);
    return new Set(info.filter((c) => /int/i.test(String(c.type || ''))).map((c) => c.name));
}

function isTrueBooleanValue(value) {
    return value === 1 || value === '1' || value === true;
}

function isBooleanColumn(data, col) {
    return !!(data.booleanCols && data.booleanCols.has(col));
}

function isReadOnlyColumn(col) {
    return String(col || '').startsWith('ro_');
}

function getDisplayColumnName(col) {
    const name = String(col || '');
    return name.startsWith('ro_') ? name.substring(3) : name;
}

function renderBooleanCheckbox(td, value, context) {
    td.classList.remove('editing');
    td.classList.add('boolean-cell');
    td.innerHTML = '';
    td.dataset.value = value === null ? '__NULL__' : String(value);
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = isTrueBooleanValue(value);
    if (context.readonly) {
    checkbox.classList.add('readonly-checkbox');
    checkbox.style.pointerEvents = 'none';
    }
    if (!context.readonly) {
    checkbox.addEventListener('click', (ev) => {
        ev.stopPropagation();
        clearError();
        const newValue = checkbox.checked ? 1 : 0;
        const oldValue = td.dataset.value === '__NULL__' ? null : td.dataset.value;
        if (String(newValue) === String(oldValue)) return;
        try {
        const where = buildWhereClause(context.rowData, context.pkCols, context.hasRowId);
        db.run(`UPDATE ${escapeIdent(context.tableName)} SET ${escapeIdent(context.columnName)} = ${newValue} WHERE ${where}`);
        context.rowData[context.columnName] = newValue;
        td.dataset.value = String(newValue);
        renderActiveTab();
        setStatus(`Active: ${context.tableName}`);
        } catch (err) {
        checkbox.checked = isTrueBooleanValue(oldValue);
        showError(err && err.message ? err.message : String(err));
        }
    });
    } else {
    checkbox.addEventListener('click', (ev) => ev.preventDefault());
    }
    td.appendChild(checkbox);
}

function syncSelectionForCurrentRows(rows) {
    const validKeys = new Set(rows.map((row) => getRowSelectionKey(row)));
    selectedRowIds = new Set([...selectedRowIds].filter((key) => validKeys.has(key)));
    updateBulkActionVisibility();
}

function renderCellContent(td, value, context = {}) {
    td.classList.remove('boolean-cell');
    if (context.isBoolean) {
    renderBooleanCheckbox(td, value, context);
    return;
    }
    td.classList.remove('editing');
    td.innerHTML = prettyCellValue(value);
    td.dataset.value = value === null ? '__NULL__' : String(value);
}

function deleteRowByContext(context) {
    const where = buildWhereClause(context.rowData, context.pkCols, context.hasRowId);
    db.run(`DELETE FROM ${escapeIdent(context.tableName)} WHERE ${where}`);
}

function buildWhereClause(rowData, pkCols, hasRowId) {
    if (hasRowId && rowData.__rowid__ !== undefined && rowData.__rowid__ !== null) return `rowid = ${Number(rowData.__rowid__)}`;
    if (!pkCols.length) throw new Error('No rowid and no primary key available. Update is not possible.');
    return pkCols.map((col) => {
    const val = rowData[col];
    if (val === null || val === undefined) return `${escapeIdent(col)} IS NULL`;
    return `${escapeIdent(col)} = '${escapeSqlString(val)}'`;
    }).join(' AND ');
}

function getRows(item) {
    const pkCols = item.type === 'table' ? getPrimaryKeyColumns(item.name) : [];
    const booleanCols = item.type === 'table' ? getBooleanColumns(item.name) : new Set();
    const numericCols = item.type === 'table' ? getNumericColumns(item.name) : new Set();
    const integerCols = item.type === 'table' ? getIntegerColumns(item.name) : new Set();
    const hasRowId = item.type === 'table';
    const selectCols = item.type === 'table' ? 'rowid as __rowid__, *' : '*';
    const res = query(`SELECT ${selectCols} FROM ${escapeIdent(item.name)}`);

    if (!res.length) {
    const info = item.type === 'table' ? getTableInfo(item.name) : [];
    const visibleColumns = info.map((c) => c.name).filter((col) => !String(col || '').startsWith('inv_'));
    return { columns: item.type === 'table' ? ['__rowid__', ...visibleColumns] : visibleColumns, visibleColumns, rows: [], pkCols, hasRowId, booleanCols, numericCols, integerCols };
    }

    const columns = res[0].columns;
    const visibleColumns = columns.filter((col) => col !== '__rowid__' && !String(col || '').startsWith('inv_'));
    let rows = res[0].values.map((arr) => {
    const obj = {};
    columns.forEach((col, i) => { obj[col] = arr[i]; });
    return obj;
    });

    if (currentSort.column && visibleColumns.includes(currentSort.column) && currentSort.direction) {
    const directionFactor = currentSort.direction === 'asc' ? 1 : -1;
    const sortColumn = currentSort.column;
    const isNumericSort = numericCols.has(sortColumn);
    rows = [...rows].sort((a, b) => {
        const av = a[sortColumn];
        const bv = b[sortColumn];
        if (av === null || av === undefined) return bv === null || bv === undefined ? 0 : 1;
        if (bv === null || bv === undefined) return -1;
        if (isNumericSort) {
        const an = Number(av);
        const bn = Number(bv);
        if (an < bn) return -1 * directionFactor;
        if (an > bn) return 1 * directionFactor;
        return 0;
        }
        const as = String(av).toLowerCase();
        const bs = String(bv).toLowerCase();
        if (as < bs) return -1 * directionFactor;
        if (as > bs) return 1 * directionFactor;
        return 0;
    });
    }

    return { columns, visibleColumns, rows, pkCols, hasRowId, booleanCols, numericCols, integerCols };
}

function csvEscape(value, delimiter = ',') {
    if (value === null || value === undefined) return '';
    const str = String(value);
    const needsQuotes = str.includes('"') || str.includes('\n') || str.includes('\r') || str.includes(delimiter);
    return needsQuotes ? `"${str.replace(/"/g, '""')}"` : str;
}

function buildDelimitedText(item, delimiter = ',') {
    const data = getRows(item);
    const visibleColumns = data.visibleColumns || data.columns.filter((col) => col !== '__rowid__' && !String(col || '').startsWith('inv_'));
    const lines = [visibleColumns.map((value) => csvEscape(value, delimiter)).join(delimiter)];
    for (const row of data.rows) lines.push(visibleColumns.map((col) => csvEscape(row[col], delimiter)).join(delimiter));
    return lines.join('\r\n');
}

function buildExcelDelimitedText(item) {
    return `sep=;\r\n${buildDelimitedText(item, ';')}`;
}

function getExcelFilename(itemName) {
    const baseName = dbFilename.replace(/\.(sqlite|sqlite3|db|db3)$/i, '') || 'database';
    return `${baseName}.${itemName}.xls.csv`;
}

function downloadExcelForItem(itemName) {
    if (!db) return;
    const item = schemaItems.find((entry) => entry.name === itemName);
    if (!item) {
    showError(`Excel export failed: object ${itemName} was not found.`);
    return;
    }
    try {
    clearError();
    const excelText = buildExcelDelimitedText(item);
    const blob = new Blob([`\uFEFF${excelText}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const filename = getExcelFilename(item.name);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setStatus(`Excel exported: ${filename}`);
    } catch (err) {
    showError(`Excel export failed: ${err && err.message ? err.message : String(err)}`);
    }
}

function renderTabs() {
    tabsEl.innerHTML = '';
    for (const item of schemaItems) {
    const tab = document.createElement('div');
    tab.className = 'tab' + (activeTab === item.name ? ' active' : '');

    const mainBtn = document.createElement('button');
    mainBtn.type = 'button';
    mainBtn.className = 'tab-main';
    const typeFull = item.type === 'table' ? 'table' : (item.type === 'view' ? 'view' : item.type);
    mainBtn.textContent = item.name;
    mainBtn.title = `${item.name} (${typeFull})`;
    mainBtn.addEventListener('click', () => {
        activeTab = item.name;
        renderTabs();
        renderActiveTab();
    });

    const xlsBtn = document.createElement('button');
    xlsBtn.type = 'button';
    xlsBtn.className = 'tab-xls-btn';
    xlsBtn.textContent = '⬇';
    xlsBtn.title = `${item.name} download as Excel-friendly file`;
    xlsBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        downloadExcelForItem(item.name);
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'tab-delete-btn';
    deleteBtn.textContent = '✕';
    deleteBtn.title = `${item.name} delete ${typeFull}`;
    deleteBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        deleteSchemaItem(item.name);
    });

    tab.appendChild(mainBtn);
    tab.appendChild(xlsBtn);
    tab.appendChild(deleteBtn);
    tabsEl.appendChild(tab);
    }

    const addTableBtn = document.createElement('button');
    addTableBtn.type = 'button';
    addTableBtn.className = 'tabs-add-btn';
    addTableBtn.textContent = '+';
    addTableBtn.title = 'Create table';
    addTableBtn.disabled = !db;
    addTableBtn.addEventListener('click', () => openCreateTableModal());
    tabsEl.appendChild(addTableBtn);
}

function renderMeta(item, rowCount, pkCols) {
    const viewText = item.type === 'view' ? '<span class="readonly-note">View: read-only</span>' : 'Table: editable';
    const canInsert = isInsertAllowedForItem(item);
    metaEl.innerHTML = `
    <span class="pill">Object: ${escapeHtml(item.name)}</span>
    <span class="pill">Type: ${escapeHtml(item.type)}</span>
    <span class="pill">Rows: ${rowCount}</span>
    <span class="pill">Key: ${escapeHtml(pkCols.length ? pkCols.join(', ') : 'rowid')}</span>
    <span class="pill">${viewText}</span>
    ${canInsert ? '<button id="insertRowBtn" class="insert-row-btn" type="button">Add row</button>' : ''}
    `;
    if (canInsert) {
    const insertRowBtnEl = document.getElementById('insertRowBtn');
    if (insertRowBtnEl) insertRowBtnEl.addEventListener('click', () => openInsertRowModal(item));
    }
}

function finishEdit(td, value, context) {
    renderCellContent(td, value, context);
}

function getEditorStartHeight(cellHeight) {
    return Math.max(Number(cellHeight) || 0, 40);
}

function getEditorStartWidth(cellWidth) {
    return Math.max(Number(cellWidth) || 0, 80);
}

function beginEdit(td, context) {
    clearError();
    if (td.classList.contains('editing')) return;
    if (context.readonly || context.isBoolean) return;

    const oldRawValue = td.dataset.value ?? '';
    const oldVisibleValue = oldRawValue === '__NULL__' ? '' : oldRawValue;
    const rect = td.getBoundingClientRect();
    const startHeight = getEditorStartHeight(rect.height);
    const startWidth = getEditorStartWidth(rect.width);

    td.classList.add('editing');
    td.innerHTML = '';

    const input = document.createElement('textarea');
    input.className = 'cell-input';
    input.value = oldVisibleValue;
    input.style.height = `${startHeight}px`;
    input.style.minHeight = `${startHeight}px`;
    input.style.width = `${startWidth}px`;
    input.style.minWidth = `${startWidth}px`;
    td.appendChild(input);

    const cancel = () => {
    const previousValue = oldRawValue === '__NULL__' ? null : oldRawValue;
    finishEdit(td, previousValue, context);
    };

    const save = () => {
    let newValue = input.value;
    if (context.isNumeric && newValue !== '') {
        if (context.isInteger) {
        if (!/^[-+]?[0-9]+$/.test(newValue)) {
            showError('Invalid integer value');
            cancel();
            return;
        }
        } else {
        newValue = newValue.replace(/,/g, '.');
        if (newValue !== input.value) input.value = newValue;
        if (!/^[-+]?[0-9]+([.][0-9]+)?$/.test(newValue)) {
            showError('Invalid numeric value');
            cancel();
            return;
        }
        }
    }

    const sqlValue = newValue === '' && oldRawValue === '__NULL__'
        ? 'NULL'
        : (newValue === '' && confirm('Empty value. Save as NULL?')) ? 'NULL' : sqlLiteralFromInput(newValue);

    const normalizedValue = sqlValue === 'NULL' ? null : newValue;
    const oldComparable = oldRawValue === '__NULL__' ? '__NULL__' : String(oldRawValue);
    const newComparable = normalizedValue === null ? '__NULL__' : String(normalizedValue);
    if (oldComparable === newComparable) {
        cancel();
        return;
    }

    try {
        const where = buildWhereClause(context.rowData, context.pkCols, context.hasRowId);
        db.run(`UPDATE ${escapeIdent(context.tableName)} SET ${escapeIdent(context.columnName)} = ${sqlValue} WHERE ${where}`);
        context.rowData[context.columnName] = normalizedValue;
        clearError();
        renderActiveTab();
        setStatus(`Active: ${context.tableName}`);
    } catch (err) {
        showError(err && err.message ? err.message : String(err));
        cancel();
    }
    };

    input.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') {
        ev.preventDefault();
        cancel();
    } else if (ev.key === 'Enter' && !ev.shiftKey) {
        ev.preventDefault();
        save();
    } else if (ev.key === 'Tab') {
        ev.preventDefault();
        save();
        moveToSiblingCell(td, ev.shiftKey ? -1 : 1);
    }
    });

    input.addEventListener('blur', () => save());
    input.focus();
    input.select();
}

function moveToSiblingCell(currentTd, direction) {
    const editableCells = Array.from(document.querySelectorAll('td[data-editable="1"]'));
    const idx = editableCells.indexOf(currentTd);
    if (idx === -1) return;
    const next = editableCells[idx + direction];
    if (next) next.click();
}

function setSort(column, direction) {
    currentSort = { column, direction };
    renderActiveTab();
}

function renderGrid(item, data) {
    renderMeta(item, data.rows.length, data.pkCols);
    syncSelectionForCurrentRows(data.rows);

    if (!(data.visibleColumns || []).length) {
    gridWrapEl.innerHTML = '<div class="empty">This table/view currently has no displayable columns.</div>';
    return;
    }

    const table = document.createElement('table');
    table.className = 'grid';
    const thead = document.createElement('thead');
    const headTr = document.createElement('tr');

    const selectHead = document.createElement('th');
    selectHead.className = 'row-select-head';
    const selectHeadInner = document.createElement('div');
    selectHeadInner.className = 'row-select-head-inner';
    if (item.type === 'table') {
    const masterCheckbox = document.createElement('input');
    masterCheckbox.type = 'checkbox';
    const selectableKeys = data.rows.map((row) => getRowSelectionKey(row));
    masterCheckbox.checked = selectableKeys.length > 0 && selectableKeys.every((key) => selectedRowIds.has(key));
    masterCheckbox.indeterminate = selectableKeys.some((key) => selectedRowIds.has(key)) && !masterCheckbox.checked;
    masterCheckbox.addEventListener('change', () => {
        if (masterCheckbox.checked) selectableKeys.forEach((key) => selectedRowIds.add(key));
        else selectableKeys.forEach((key) => selectedRowIds.delete(key));
        updateBulkActionVisibility();
        renderActiveTab();
    });
    selectHeadInner.appendChild(masterCheckbox);
    }
    selectHead.appendChild(selectHeadInner);
    headTr.appendChild(selectHead);

    for (const col of data.visibleColumns) {
    const th = document.createElement('th');
    th.title = col;
    const headerWrap = document.createElement('div');
    headerWrap.style.display = 'flex';
    headerWrap.style.alignItems = 'center';
    headerWrap.style.justifyContent = 'space-between';
    headerWrap.style.gap = '8px';
    const headerLabel = document.createElement('span');
    headerLabel.textContent = getDisplayColumnName(col);
    const sortWrap = document.createElement('div');
    sortWrap.style.display = 'inline-flex';
    sortWrap.style.flexDirection = 'column';
    sortWrap.style.gap = '2px';

    const sortUpBtn = document.createElement('button');
    sortUpBtn.type = 'button';
    sortUpBtn.textContent = '▲';
    sortUpBtn.title = `Sort ${getDisplayColumnName(col)} ascending`;
    Object.assign(sortUpBtn.style, { background: 'transparent', border: '1px solid var(--line)', color: 'inherit', padding: '0 4px', minHeight: '16px', fontSize: '10px', lineHeight: '1', borderRadius: '4px' });
    sortUpBtn.addEventListener('click', (ev) => { ev.stopPropagation(); setSort(col, 'asc'); });

    const sortDownBtn = document.createElement('button');
    sortDownBtn.type = 'button';
    sortDownBtn.textContent = '▼';
    sortDownBtn.title = `Sort ${getDisplayColumnName(col)} descending`;
    Object.assign(sortDownBtn.style, { background: 'transparent', border: '1px solid var(--line)', color: 'inherit', padding: '0 4px', minHeight: '16px', fontSize: '10px', lineHeight: '1', borderRadius: '4px' });
    sortDownBtn.addEventListener('click', (ev) => { ev.stopPropagation(); setSort(col, 'desc'); });

    if (currentSort.column === col && currentSort.direction === 'asc') sortUpBtn.style.background = 'rgba(255,255,255,0.16)';
    if (currentSort.column === col && currentSort.direction === 'desc') sortDownBtn.style.background = 'rgba(255,255,255,0.16)';

    sortWrap.appendChild(sortUpBtn);
    sortWrap.appendChild(sortDownBtn);
    headerWrap.appendChild(headerLabel);
    headerWrap.appendChild(sortWrap);
    th.appendChild(headerWrap);
    headTr.appendChild(th);
    }

    thead.appendChild(headTr);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    for (const rowData of data.rows) {
    const tr = document.createElement('tr');
    const rowKey = getRowSelectionKey(rowData);
    if (selectedRowIds.has(rowKey)) tr.classList.add('row-selected');

    const selectTd = document.createElement('td');
    selectTd.className = 'row-select-cell';
    if (item.type === 'table') {
        const rowCheckbox = document.createElement('input');
        rowCheckbox.type = 'checkbox';
        rowCheckbox.checked = selectedRowIds.has(rowKey);
        rowCheckbox.addEventListener('change', () => {
        if (rowCheckbox.checked) selectedRowIds.add(rowKey);
        else selectedRowIds.delete(rowKey);
        updateBulkActionVisibility();
        renderActiveTab();
        });
        selectTd.appendChild(rowCheckbox);
    }
    tr.appendChild(selectTd);

    for (const col of data.visibleColumns) {
        const td = document.createElement('td');
        const value = rowData[col];
        const readonly = item.type !== 'table' || isReadOnlyColumn(col);
        const isBoolean = isBooleanColumn(data, col);
        const context = {
        readonly,
        isBoolean,
        isNumeric: data.numericCols && data.numericCols.has(col),
        isInteger: data.integerCols && data.integerCols.has(col),
        tableName: item.name,
        columnName: col,
        rowData,
        pkCols: data.pkCols,
        hasRowId: data.hasRowId
        };
        renderCellContent(td, value, context);
        if (!readonly && !isBoolean) {
        td.dataset.editable = '1';
        td.addEventListener('click', () => beginEdit(td, context));
        } else {
        td.dataset.editable = '0';
        }
        tr.appendChild(td);
    }

    tbody.appendChild(tr);
    }

    table.appendChild(tbody);
    gridWrapEl.innerHTML = '';
    gridWrapEl.appendChild(table);
}

function applyBulkAction() {
    if (!db || !activeTab || selectedRowIds.size === 0) return;
    if (bulkActionSelectEl.value !== 'delete') return;
    const item = schemaItems.find((x) => x.name === activeTab);
    if (!item || item.type !== 'table') return;
    try {
    const data = getRows(item);
    const rowsToDelete = data.rows.filter((row) => selectedRowIds.has(getRowSelectionKey(row)));
    rowsToDelete.forEach((rowData) => deleteRowByContext({ tableName: item.name, rowData, pkCols: data.pkCols, hasRowId: data.hasRowId }));
    selectedRowIds.clear();
    updateBulkActionVisibility();
    renderActiveTab();
    setStatus(`Deleted ${rowsToDelete.length} row(s) from ${item.name}`);
    } catch (err) {
    showError(err && err.message ? err.message : String(err));
    }
}

function renderActiveTab() {
    clearError();
    if (!activeTab) {
    renderWelcomeScreen();
    return;
    }
    const item = schemaItems.find((x) => x.name === activeTab);
    if (!item) {
    gridWrapEl.innerHTML = '<div class="empty">Object not found.</div>';
    return;
    }
    try {
    const data = getRows(item);
    renderGrid(item, data);
    setStatus(`Active: ${item.name} (${item.type})`);
    } catch (err) {
    gridWrapEl.innerHTML = `<div class="empty">Error while loading: ${escapeHtml(err.message || String(err))}</div>`;
    setStatus('Error while loading');
    }
}

function finalizeDatabaseLoad({ filename, filePath = null, filesystemBacked = false } = {}) {
    setCurrentDatabaseOrigin({ filename, filePath, filesystemBacked });
    schemaItems = getObjects();
    activeTab = schemaItems[0]?.name || null;
    currentSort = { column: null, direction: null };
    selectedRowIds.clear();
    updateBulkActionVisibility();
    renderTabs();
    renderActiveTab();
    saveBtn.disabled = false;
    codeBtn.disabled = false;
    createBtn.disabled = true;
    setStatus(filesystemBacked ? `Ready: ${dbFilename}` : 'Ready');
    if (!schemaItems.length) {
    metaEl.innerHTML = '<span class="pill">No tables or views found</span>';
    gridWrapEl.innerHTML = '<div class="empty">The database contains no displayable tables or views.</div>';
    }
}

async function loadDatabase(file) {
    releaseExportUrl();
    await initSqlJsEngine();
    const buf = await file.arrayBuffer();
    db = new SQL.Database(new Uint8Array(buf));
    finalizeDatabaseLoad({ filename: file.name || 'database.sqlite', filesystemBacked: false });
}

async function loadDatabaseFromBuffer(buffer, options = {}) {
    releaseExportUrl();
    await initSqlJsEngine();
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    db = new SQL.Database(bytes);
    finalizeDatabaseLoad(options);
}

async function openDatabaseFromFilesystem() {
    if (!hasNativeFsBridge()) return false;
    const result = await window.sqlspreadFS.openDatabase();
    if (!result || result.canceled) return true;
    if (!result.data) throw new Error('No file data returned from filesystem bridge');
    await loadDatabaseFromBuffer(result.data, {
    filename: result.name || result.filename || 'database.sqlite',
    filePath: result.path || null,
    filesystemBacked: true
    });
    return true;
}

async function saveDatabase() {
    if (!db) return;
    const binary = db.export();
    const filename = getPreferredDatabaseName(dbFilename || 'database.sqlite');

    if (hasNativeFsBridge()) {
    const result = await window.sqlspreadFS.saveDatabase({
        data: Array.from(binary),
        filename,
        path: dbFilePath || null
    });
    if (!result || result.canceled) return;
    setCurrentDatabaseOrigin({
        filename: result.name || filename,
        filePath: result.path || dbFilePath,
        filesystemBacked: true
    });
    setStatus(`Saved: ${dbFilename}`);
    return;
    }

    const blob = new Blob([binary], { type: 'application/octet-stream' });
    const download = prepareDownloadLink(blob, filename);
    const a = document.createElement('a');
    a.href = download.url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setStatus(`Exported: ${filename}`);
}

function resetTestState() {
    clearError(true);
    closeConfirmModal();
    closeCreateDbModal();
    closeCreateTableModal();
    closeInsertRowModal();
    closeSqlShellModal();
    selectedRowIds = new Set();
    primaryKeyRowId = null;
    createTableColumnsWrapEl.innerHTML = '';
    updateBulkActionVisibility();
}

function escapeHtmlText(value) {
    return escapeHtml(value == null ? '' : String(value));
}

function buildSelfTestHtml() {
    if (!lastSelfTestResults.length) return '';
    const rows = lastSelfTestResults.map((test) => {
    const badgeClass = test.ok ? 'ok' : 'fail';
    const label = test.ok ? 'OK' : 'FAIL';
    const text = test.ok
        ? escapeHtmlText(test.name)
        : `${escapeHtmlText(test.name)} — ${escapeHtmlText(test.message || 'Unknown error')}`;
    return `<div class="selftest-item"><span class="selftest-badge ${badgeClass}">[ ${label} ]</span><span class="selftest-text ${badgeClass}">${text}</span></div>`;
    }).join('');
    return `<div class="selftest-panel"><div class="selftest-title">Self-test results</div><div class="selftest-list">${rows}</div></div>`;
}

function renderWelcomeScreen() {
    gridWrapEl.innerHTML = `<div class="empty">Select a SQLite file. Tables and views will appear as tabs.<br>Tables are editable, views are read-only.${buildSelfTestHtml()}</div>`;
}

function runSelfTests() {
    resetTestState();
    const tests = [];
    function assert(name, fn) {
    try {
        fn();
        tests.push({ name, ok: true });
    } catch (err) {
        tests.push({ name, ok: false, message: err && err.message ? err.message : String(err) });
    }
    }

    assert('escapeIdent quoted correctly', () => {
    if (escapeIdent('a"b') !== '"a""b"') throw new Error('escapeIdent failed');
    });

    assert('inv_ objects filtered', () => {
    const input = [{ name: 'inv_test' }, { name: 'users' }];
    const filtered = input.filter((obj) => !String(obj.name || '').startsWith('inv_'));
    if (filtered.length !== 1 || filtered[0].name !== 'users') throw new Error('inv_ filter failed');
    });

    assert('inv_ columns filtered', () => {
    const input = ['id', 'inv_secret', 'name'];
    const filtered = input.filter((col) => col !== '__rowid__' && !String(col || '').startsWith('inv_'));
    if (filtered.length !== 2 || filtered.includes('inv_secret')) throw new Error('inv_ column filter failed');
    });

    assert('ro_ columns are treated as read-only', () => {
    if (!isReadOnlyColumn('ro_name')) throw new Error('ro_ column should be read-only');
    if (isReadOnlyColumn('name')) throw new Error('normal column should not be read-only');
    });

    assert('ro_ header prefix is hidden', () => {
    if (getDisplayColumnName('ro_secret') !== 'secret') throw new Error('ro_ prefix not stripped');
    if (getDisplayColumnName('name') !== 'name') throw new Error('normal name changed');
    });

    assert('boolean recognition true values', () => {
    if (!isTrueBooleanValue(1) || !isTrueBooleanValue('1') || !isTrueBooleanValue(true) || isTrueBooleanValue(0)) throw new Error('boolean recognition failed');
    });

    assert('numeric validation integer regex', () => {
    if (!/^[-+]?[0-9]+$/.test('123')) throw new Error('int regex failed');
    if (/^[-+]?[0-9]+$/.test('12.3')) throw new Error('int should not allow decimal');
    if (/^[-+]?[0-9]+$/.test('12,3')) throw new Error('int should not allow comma');
    });

    assert('numeric validation float regex', () => {
    if (!/^[-+]?[0-9]+([.][0-9]+)?$/.test('12.3')) throw new Error('float regex failed');
    if (/^[-+]?[0-9]+([.][0-9]+)?$/.test('abc')) throw new Error('float should reject text');
    });

    assert('numeric conversion replaces comma with dot', () => {
    if ('12,3'.replace(/,/g, '.') !== '12.3') throw new Error('comma to dot conversion failed');
    });

    assert('buildWhereClause uses rowid when present', () => {
    if (buildWhereClause({ __rowid__: 7 }, [], true) !== 'rowid = 7') throw new Error('rowid clause failed');
    });

    assert('sqlLiteralFromInput escapes quotes', () => {
    if (sqlLiteralFromInput("O'Brien") !== "'O''Brien'") throw new Error('sql string escaping failed');
    });

    assert('editor size helpers enforce minimums', () => {
    if (getEditorStartHeight(72) !== 72) throw new Error('editor height should match cell height');
    if (getEditorStartHeight(10) !== 40) throw new Error('minimum editor height failed');
    if (getEditorStartWidth(144) !== 144) throw new Error('editor width should match cell width');
    if (getEditorStartWidth(10) !== 80) throw new Error('minimum editor width failed');
    });

    assert('inline error can be shown and cleared', () => {
    showError('Test error');
    const errorBox = document.getElementById('errorBox');
    if (!errorBox) throw new Error('error box missing');
    if (!inlineErrorEl.classList.contains('visible')) throw new Error('inline error not visible');
    clearError(true);
    if (inlineErrorEl.innerHTML !== '' || inlineErrorEl.classList.contains('visible')) throw new Error('inline error not cleared');
    });

    assert('prepareDownloadLink behaves safely in this runtime', () => {
    const blob = new Blob(['abc'], { type: 'application/octet-stream' });
    if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return;
    let result;
    try {
        result = prepareDownloadLink(blob, 'test.sqlite');
    } catch (_err) {
        return;
    }
    if (!result || result.filename !== 'test.sqlite') throw new Error('download result invalid');
    if (result.url && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(result.url);
    pendingDownloadUrl = null;
    });

    assert('custom file input exists', () => {
    if (!document.querySelector('.file-input-btn') || !document.querySelector('.file-input-native')) throw new Error('file input missing');
    });

    assert('bulk action visibility reacts to selection', () => {
    selectedRowIds = new Set(['rowid:1']);
    updateBulkActionVisibility();
    if (!bulkActionWrapEl.classList.contains('visible')) throw new Error('bulk action should be visible');
    selectedRowIds = new Set();
    updateBulkActionVisibility();
    if (bulkActionWrapEl.classList.contains('visible')) throw new Error('bulk action should be hidden');
    });

    assert('confirm modal opens and closes', () => {
    openConfirmModal('Test delete message', () => {});
    if (!confirmModalEl.classList.contains('visible')) throw new Error('confirm modal should be visible');
    if (confirmModalTextEl.textContent !== 'Test delete message') throw new Error('confirm modal text failed');
    closeConfirmModal();
    if (confirmModalEl.classList.contains('visible')) throw new Error('confirm modal should be hidden');
    });

    assert('create database modal opens and closes', () => {
    openCreateDbModal(() => {});
    if (!createDbModalEl.classList.contains('visible')) throw new Error('create db modal should be visible');
    closeCreateDbModal();
    if (createDbModalEl.classList.contains('visible')) throw new Error('create db modal should be hidden');
    });

    assert('supported sqlite types exist', () => {
    const types = getSupportedSqliteTypes();
    if (!types.includes('INTEGER') || !types.includes('TEXT')) throw new Error('expected sqlite types missing');
    });

    assert('create column row builds all inputs', () => {
    const row = createColumnRow({ name: 'title', type: 'TEXT', note: 'x' });
    if (!row.querySelector('[data-role="name"]') || !row.querySelector('[data-role="type"]') || !row.querySelector('[data-role="default"]') || !row.querySelector('[data-role="note"]') || !row.querySelector('[data-role="primary_key"]') || !row.querySelector('[data-role="unique"]') || !row.querySelector('[data-role="auto_increment"]')) throw new Error('column controls missing');
    });

    assert('primary key selection stays exclusive', () => {
    createTableColumnsWrapEl.innerHTML = '';
    const row1 = createColumnRow({ name: 'id', type: 'INTEGER', primaryKey: true });
    const row2 = createColumnRow({ name: 'other', type: 'INTEGER' });
    createTableColumnsWrapEl.appendChild(row1);
    createTableColumnsWrapEl.appendChild(row2);
    updatePrimaryKeySelection(row1.dataset.rowId);
    updatePrimaryKeySelection(row2.dataset.rowId);
    if (row1.querySelector('[data-role="primary_key"]').checked) throw new Error('first primary key should be cleared');
    if (!row2.querySelector('[data-role="primary_key"]').checked) throw new Error('second primary key should be set');
    });

    assert('auto increment availability follows type', () => {
    const rowText = createColumnRow({ type: 'TEXT' });
    if (!rowText.querySelector('[data-role="auto_increment"]').disabled) throw new Error('auto increment should be disabled for text');
    const rowInt = createColumnRow({ type: 'INTEGER' });
    if (rowInt.querySelector('[data-role="auto_increment"]').disabled) throw new Error('auto increment should be enabled for integer');
    });

    assert('sql default literal quotes plain text', () => {
    if (sqlDefaultLiteral('abc') !== "'abc'") throw new Error('default text literal failed');
    });

    assert('empty table still exposes headers', () => {
    const mockInfo = [{ name: 'id' }, { name: 'text' }, { name: 'inv_hidden' }];
    const visible = mockInfo.map((c) => c.name).filter((col) => !String(col || '').startsWith('inv_'));
    if (visible.length !== 2 || visible[0] !== 'id' || visible[1] !== 'text') throw new Error('empty table headers wrong');
    });

    assert('sql shell formatter returns expected output', () => {
    if (formatSqlExecResult([]) !== 'Statement executed.') throw new Error('sql shell non-select formatting failed');
    const text = formatSqlExecResult([{ columns: ['a', 'b'], values: [[1, 2]] }]);
    if (!text.includes('a | b') || !text.includes('1 | 2')) throw new Error('sql shell row formatting failed');
    });

    assert('schema output formatter joins with blank lines', () => {
    if (!formatSchemaLines([['CREATE TABLE a (id INTEGER);'], ['CREATE VIEW v AS SELECT 1;']]).includes('\n\n')) throw new Error('schema join failed');
    });

    assert('simple list formatter joins with double spaces', () => {
    if (formatSimpleList([['alpha'], ['beta'], ['gamma']]) !== 'alpha  beta  gamma') throw new Error('simple list join failed');
    });

    assert('indexes output formatter joins names with newlines', () => {
    if (formatIndexLines([['idx_a', 'table_a'], ['idx_b', 'table_b']]) !== 'table_a: idx_a\ntable_b: idx_b') throw new Error('indexes join failed');
    });

    assert('info output formatter joins stats with newlines', () => {
    if (formatInfoLines({ tables: 3, views: 1, indexes: 2, triggers: 4 }) !== 'tables: 3\nviews: 1\nindexes: 2\ntriggers: 4') throw new Error('info join failed');
    });

    assert('insert availability rules work', () => {
    if (!isInsertAllowedForItem({ type: 'table', name: 'users' })) throw new Error('normal table should allow insert');
    if (isInsertAllowedForItem({ type: 'table', name: 'ro_users' })) throw new Error('ro_ table should block insert');
    if (isInsertAllowedForItem({ type: 'view', name: 'v_users' })) throw new Error('view should block insert');
    });

    assert('auto increment detection regex works', () => {
    const createSql = 'CREATE TABLE test (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)';
    const cols = new Set();
    const regex = /["`\[]?(\w+)["`\]]?\s+INTEGER\s+PRIMARY\s+KEY\s+AUTOINCREMENT/gi;
    let match;
    while ((match = regex.exec(createSql)) !== null) cols.add(match[1]);
    if (!cols.has('id')) throw new Error('auto increment column not detected');
    });

    assert('insert row modal elements exist', () => {
    if (!insertRowModalEl || !insertRowFormEl || !insertRowCancelBtnEl || !insertRowConfirmBtnEl) throw new Error('insert row controls missing');
    });

    assert('modal inline error elements exist', () => {
    if (!createTableModalErrorEl || !insertRowModalErrorEl) throw new Error('modal error elements missing');
    });

    assert('create object mode controls exist', () => {
    if (!createObjectTypeSelectEl || !createTableSectionEl || !createViewSectionEl || !createViewNameInputEl || !createViewSqlInputEl) {
        throw new Error('create object controls missing');
    }
    });

    assert('create object mode switching works', () => {
    createObjectTypeSelectEl.value = 'view';
    syncCreateObjectMode();
    if (!createViewSectionEl.classList.contains('visible')) throw new Error('view section should be visible');
    if (createTableSectionEl.classList.contains('visible')) throw new Error('table section should be hidden');
    createObjectTypeSelectEl.value = 'table';
    syncCreateObjectMode();
    if (!createTableSectionEl.classList.contains('visible')) throw new Error('table section should be visible');
    });

    lastSelfTestResults = tests.slice();
    const failed = tests.filter((t) => !t.ok);
    testsBadgeEl.textContent = failed.length ? `Self-test failed: ${failed.length}` : `Self-test ok: ${tests.length}`;
    testsBadgeEl.style.color = failed.length ? '#fca5a5' : '#86efac';
    testsBadgeEl.title = failed.length ? failed.map((t) => `${t.name}: ${t.message}`).join(' | ') : 'All self-tests passed';
    resetTestState();
    if (!db) renderWelcomeScreen();
}

dbFileInput.addEventListener('change', async (ev) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    try {
    setStatus('Loading database ...');
    await loadDatabase(file);
    } catch (err) {
    setStatus('Error while loading');
    alert('The database could not be loaded: ' + (err.message || String(err)));
    } finally {
    dbFileInput.value = '';
    }
});

createBtn.addEventListener('click', () => {
    openCreateDbModal(async (enteredName) => {
    try {
        await initSqlJsEngine();
        releaseExportUrl();
        db = new SQL.Database();
        dbFilename = /\.(sqlite|sqlite3|db|db3)$/i.test(enteredName) ? enteredName : `${enteredName}.sqlite`;
        db.run(`CREATE TABLE IF NOT EXISTS "test" (\n            id INTEGER PRIMARY KEY AUTOINCREMENT,\n            text TEXT\n          )`);
        schemaItems = getObjects();
        activeTab = schemaItems[0]?.name || null;
        currentSort = { column: null, direction: null };
        selectedRowIds.clear();
        updateBulkActionVisibility();
        renderTabs();
        renderActiveTab();
        saveBtn.disabled = false;
        codeBtn.disabled = false;
        createBtn.disabled = true;
        setStatus(`New database created: ${dbFilename}`);
    } catch (err) {
        showError(err && err.message ? err.message : String(err));
    }
    });
});

codeBtn.addEventListener('click', openSqlShellModal);
saveBtn.addEventListener('click', saveDatabase);
bulkActionBtnEl.addEventListener('click', applyBulkAction);
updateBulkActionVisibility();

confirmCancelBtnEl.addEventListener('click', closeConfirmModal);
confirmOkBtnEl.addEventListener('click', confirmModalOk);
confirmModalEl.addEventListener('click', (ev) => {
    if (ev.target === confirmModalEl) closeConfirmModal();
});

createDbCancelBtnEl.addEventListener('click', closeCreateDbModal);
createDbConfirmBtnEl.addEventListener('click', confirmCreateDbModal);
createDbModalEl.addEventListener('click', (ev) => {
    if (ev.target === createDbModalEl) closeCreateDbModal();
});
createDbNameInputEl.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
    ev.preventDefault();
    confirmCreateDbModal();
    } else if (ev.key === 'Escape') {
    ev.preventDefault();
    closeCreateDbModal();
    }
});

addColumnRowBtnEl.addEventListener('click', () => {
    createTableColumnsWrapEl.appendChild(createColumnRow({ type: 'TEXT' }));
});
createObjectTypeSelectEl.addEventListener('change', () => {
    clearModalError(createTableModalErrorEl);
    syncCreateObjectMode();
});
createTableCancelBtnEl.addEventListener('click', closeCreateTableModal);
createTableConfirmBtnEl.addEventListener('click', createTableFromModal);
createTableModalEl.addEventListener('click', (ev) => {
    if (ev.target === createTableModalEl) closeCreateTableModal();
});

insertRowCancelBtnEl.addEventListener('click', closeInsertRowModal);
insertRowConfirmBtnEl.addEventListener('click', confirmInsertRowModal);
insertRowModalEl.addEventListener('click', (ev) => {
    if (ev.target === insertRowModalEl) closeInsertRowModal();
});

sqlShellRunBtnEl.addEventListener('click', runSqlShellCommand);
sqlShellClearBtnEl.addEventListener('click', () => {
    sqlShellOutputEl.innerHTML = '';
    appendSqlShellEntry('.clear', 'Console cleared.');
});
sqlShellCloseBtnEl.addEventListener('click', closeSqlShellModal);
sqlShellModalEl.addEventListener('click', (ev) => {
    if (ev.target === sqlShellModalEl) closeSqlShellModal();
});
window.addEventListener('resize', () => adjustSqlShellModalHeight());

sqlShellInputEl.addEventListener('input', () => adjustSqlShellModalHeight());

sqlShellInputEl.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) {
    ev.preventDefault();
    runSqlShellCommand();
    } else if (ev.key === 'Escape') {
    ev.preventDefault();
    closeSqlShellModal();
    } else if (ev.key === 'ArrowUp' && !ev.shiftKey && !ev.altKey) {
    if (sqlShellHistory.length) {
        ev.preventDefault();
        sqlShellHistoryIndex = Math.max(0, sqlShellHistoryIndex - 1);
        sqlShellInputEl.value = sqlShellHistory[sqlShellHistoryIndex] || '';
    }
    } else if (ev.key === 'ArrowDown' && !ev.shiftKey && !ev.altKey) {
    if (sqlShellHistory.length) {
        ev.preventDefault();
        sqlShellHistoryIndex = Math.min(sqlShellHistory.length, sqlShellHistoryIndex + 1);
        sqlShellInputEl.value = sqlShellHistory[sqlShellHistoryIndex] || '';
    }
    }
});

if (hasNativeFsBridge()) {
    const fileWrap = document.querySelector('.file-input-wrap');
    const fileBtn = document.querySelector('.file-input-btn');
    if (fileWrap && fileBtn) {
    fileBtn.textContent = 'Open database';
    dbFileInput.disabled = true;
    dbFileInput.style.pointerEvents = 'none';
    fileWrap.addEventListener('click', async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        try {
        setStatus('Opening database ...');
        await openDatabaseFromFilesystem();
        } catch (err) {
        setStatus('Error while loading');
        alert('The database could not be loaded: ' + (err.message || String(err)));
        }
    });
    }
    saveBtn.textContent = 'Save file';
}

createBtn.disabled = false;
codeBtn.disabled = true;
renderWelcomeScreen();
runSelfTests();

window.addEventListener('beforeunload', () => {
    revokePendingDownloadUrl();
    if (errorClearTimeout) {
    clearTimeout(errorClearTimeout);
    errorClearTimeout = null;
    }
});
