export const DEFAULTS = {
  TAB: { visibility: 'visible', user_select: true },
  ROW: {
    height: '24px', min_height: '24px', max_height: '24px',
    background_color: '#ffffff', visibility: 'visible', user_select: true
  },
  COLUMN: {
    width: '120px', min_width: '40px', max_width: '500px',
    background_color: '#ffffff', visibility: 'visible', user_select: true
  },
  CELL: {
    padding: '2px 6px', border: '1px solid #d9d9d9', border_top: null, border_right: null,
    border_bottom: null, border_left: null, background_color: '#ffffff', box_shadow: 'none',
    text_align: 'left', vertical_align: 'middle', font: '14px Calibri, "Segoe UI", Arial, sans-serif',
    font_weight: 'normal', color: '#000000', white_space: 'nowrap', overflow: 'hidden',
    text_overflow: 'ellipsis', display: 'table-cell', visibility: 'visible', opacity: '1',
    cursor: 'cell', user_select: true, notice: ''
  }
};

export const CONFIG_UI_STATE_KEY = 'sqlspread.ui_state';

export const state = {
  SQL: null,
  db: null,
  workbook: new Map(),
  currentSheet: null,
  currentDbPath: null,
  currentDbName: 'database.sqlite',
  currentSelectedCellRef: null,
  currentFilterMenu: null,
  sheetSortState: new Map(),
  sheetFilterState: new Map(),
  undoStack: [],
  redoStack: []
};

export const dom = {
  statusEl: document.getElementById('status'),
  tabsEl: document.getElementById('tabs'),
  sheetWrapEl: document.getElementById('sheetWrap'),
  dbFileInput: document.getElementById('dbFile'),
  openDbLabel: document.getElementById('openDbLabel'),
  nameBox: document.getElementById('nameBox'),
  formulaBox: document.getElementById('formulaBox'),
  saveBtn: document.getElementById('saveBtn'),
  exportHtmlBtn: document.getElementById('exportHtmlBtn'),
  customTooltip: document.getElementById('customTooltip'),
  filterMenu: document.getElementById('filterMenu')
};

export function resetWorkbookState() {
  state.workbook = new Map();
  state.currentSheet = null;
  state.currentDbPath = null;
  state.currentSelectedCellRef = null;
  state.undoStack.length = 0;
  state.redoStack.length = 0;
}
