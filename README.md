# SQLSpread – User Documentation

## Overview

SQLSpread is a browser-based SQLite editor with a spreadsheet-like interface and an integrated SQL console.  
It runs fully in the browser using WebAssembly (sql.js).

---

## Features

- Open existing SQLite databases (`.sqlite`, `.db`, `.sqlite3`)
- Create new databases
- Edit data directly in a grid
- Create tables and views
- Built-in SQL console
- Export database and tables (CSV / Excel)
- Bulk operations (delete rows)
- Self-test system on startup

---

## Getting Started

### Deploy Docker container
docker run -d -p 127.0.0.1:8080:80 docker.io/syos/sqlspread:\<tag\>


### Open a Database

1. Click **Select file**
2. Choose a SQLite file

---

### Create a Database

1. Click **Create database**
2. Enter a name
3. A default table is created automatically

---

## User Interface

### Top Bar

| Element | Description |
|--------|------------|
| Select file | Load database |
| Create database | Create new database |
| SQL | Open SQL console |
| Save database | Download database |
| Bulk Actions | Apply actions to selected rows |

---

### Tabs

- Each table/view appears as a tab
- Actions per tab:
  - ⬇ Export
  - ✕ Delete

---

## Table Editing

### Edit Cells

- Click → edit
- Enter → save
- Esc → cancel
- Tab → next cell

---

### Data Types

| Type | Behavior |
|------|---------|
| INTEGER | Whole numbers |
| REAL | Decimal numbers |
| TEXT | Free text |
| BOOLEAN | Checkbox |

---

## Row Operations

### Add Row

- Available only for tables
- Disabled for:
  - Views
  - Tables starting with `ro_`

---

### Delete Rows

1. Select rows
2. Choose action
3. Click Apply

---

## Create Tables / Views

### Table

- Column name
- Type
- Default value
- Primary key
- Unique
- Auto increment

### View

- Name
- SQL SELECT statement

---

## SQL Console

Open via **SQL button**

### Commands

- `.schema`
- `.tables`
- `.views`
- `.indexes`
- `.triggers`
- `.info`

### SQL

- SELECT
- INSERT
- UPDATE
- DELETE
- CREATE
- DROP

---

## Export

### Database

- Click **Save database**
- File downloaded as `.sqlite`

### Table

- Export as CSV (Excel compatible)

---

## Limitations

- Views are read-only
- `ro_` tables are protected
- `inv_` columns are hidden
- No multi-user support

---

## Self-Test

Runs automatically on startup.

- `[ OK ]` → success
- `[ FAIL ]` → error

---

## Technical Notes

- Based on sql.js (SQLite WebAssembly)
- Runs in browser only

---

## Keyboard Shortcuts

| Action | Key |
|--------|-----|
| Save | Enter |
| Cancel | Esc |
| Next | Tab |
| Run SQL | Ctrl + Enter |

---

## Summary

SQLSpread is suitable for:

- Quick SQLite editing
- Debugging databases
- Lightweight administration

---
- Source : https://github.com/syos-cc/SQLSpread.git
- License : GPLv3 - https://github.com/syos-cc/SQLSpread/blob/main/LICENSE
- Note : This code was developed with support from AI tools.
