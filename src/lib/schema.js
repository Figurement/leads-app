/**
 * Central schema for the leads-app data model.
 *
 * ALL field additions or removals should start here. After updating this file,
 * check each location listed under "Where fields are consumed" below.
 *
 * --- Data flow overview ---
 * 1. CSV on GitHub (leads.csv, companies.csv) is the persistence layer.
 * 2. github.js fetchCSV/saveCSV reads/writes CSV ↔ JS objects.
 * 3. App.jsx holds leads[] and companies{} in React state.
 * 4. Components read lead/company objects; DetailModal writes back via onSave.
 *
 * --- Where lead fields are consumed ---
 *   AddModal.jsx        – single-lead form + bulk import preview table
 *   DetailModal.jsx     – edit form (left column)
 *   PipelineBoard.jsx   – card display + search filter
 *   MailMergeModal.jsx  – email selection + CSV/TSV export columns
 *   LeadsTableView.jsx  – spreadsheet column definitions
 *   App.jsx             – handleAdd (create), bulk upsert matching, duplicatesSet
 *
 * --- Where company fields are consumed ---
 *   CompanyManager.jsx  – table columns + inline edit
 *   DetailModal.jsx     – company sidebar (right of lead fields)
 *   PipelineBoard.jsx   – Employees for enterprise badge + size sort
 *   LeadsTableView.jsx  – Employees column (scope: 'company')
 *   App.jsx             – handleAdd (create company), handleEnrichNewLeads
 *
 * --- Key conventions ---
 *   - Boolean fields (Beta, Trial) are stored as the STRINGS 'true'/'false' in
 *     CSV and in React state. Use toBool() from utils.jsx to read them.
 *   - Dates (Next Date) use DD/MM/YYYY strings. Use parseDateStr/formatDateStr.
 *   - History is a JSON array serialised as a string in CSV.
 *     Each entry: { date: ISO string, type: 'user'|'lead'|'note', content: string }
 *   - Employees on companies is parsed as a number by PapaParse dynamicTyping.
 *   - calculatedDays is a runtime-only field, never written to CSV.
 *   - PersonalEmail is a separate CSV column from Email (work email).
 */

// ---------------------------------------------------------------------------
// Lead field definitions
// ---------------------------------------------------------------------------

/**
 * Canonical list of lead fields.
 *
 * `csv: true`  → persisted to leads.csv (included in bulk import/export)
 * `csv: false` → runtime-only, computed in App.jsx after load
 * `required`   → must be non-empty for a valid lead row
 */
export const LEAD_FIELDS = {
  // Identity
  id:              { csv: true,  type: 'string',  label: 'ID',              required: false, generated: true },
  Name:            { csv: true,  type: 'string',  label: 'Name',            required: true },
  Title:           { csv: true,  type: 'string',  label: 'Title',           required: false },
  Company:         { csv: true,  type: 'string',  label: 'Company',         required: true },

  // Contact
  Email:           { csv: true,  type: 'string',  label: 'Work Email',      required: false },
  PersonalEmail:   { csv: true,  type: 'string',  label: 'Personal Email',  required: false },
  Phone:           { csv: true,  type: 'string',  label: 'Phone',           required: false },
  LinkedIn:        { csv: true,  type: 'string',  label: 'LinkedIn',        required: false },

  // Location
  City:            { csv: true,  type: 'string',  label: 'City',            required: false },
  Country:         { csv: true,  type: 'string',  label: 'Country',         required: false },

  // Pipeline
  Stage:           { csv: true,  type: 'stage',   label: 'Stage',           required: false },
  Owner:           { csv: true,  type: 'string',  label: 'Owner',           required: false },
  'Next Date':     { csv: true,  type: 'date',    label: 'Next Date',       required: false },
  'Next Action':   { csv: true,  type: 'string',  label: 'Next Action',     required: false },

  // Status flags — stored as 'true'/'false' strings
  Beta:            { csv: true,  type: 'bool',    label: 'Beta',            required: false },
  Trial:           { csv: true,  type: 'bool',    label: 'Trial',           required: false },

  // Activity
  History:         { csv: true,  type: 'json',    label: 'History',         required: false },
  Notes:           { csv: true,  type: 'string',  label: 'Notes',           required: false },

  // Runtime (never saved to CSV)
  calculatedDays:  { csv: false, type: 'number',  label: 'Days Since Activity', required: false },
};

// ---------------------------------------------------------------------------
// Company field definitions
// ---------------------------------------------------------------------------

export const COMPANY_FIELDS = {
  Company:   { csv: true, type: 'string', label: 'Company',   required: true },
  Category:  { csv: true, type: 'string', label: 'Category',  required: false },
  Url:       { csv: true, type: 'string', label: 'Website',   required: false },
  City:      { csv: true, type: 'string', label: 'City',      required: false },
  Country:   { csv: true, type: 'string', label: 'Country',   required: false },
  Employees: { csv: true, type: 'number', label: 'Employees', required: false },
  Software:  { csv: true, type: 'string', label: 'Software',  required: false },
};

// ---------------------------------------------------------------------------
// Derived constants — keep in sync automatically
// ---------------------------------------------------------------------------

/** All CSV-persisted lead field keys, in column order for bulk import/export. */
export const LEAD_CSV_COLUMNS = Object.keys(LEAD_FIELDS).filter(k => LEAD_FIELDS[k].csv);

/** Same list used as fallback column order when bulk-pasting without headers. */
export const LEAD_BULK_FALLBACK_ORDER = LEAD_CSV_COLUMNS;

/**
 * Maps common CSV header variations to canonical field names.
 * Used by AddModal bulk import to normalize pasted spreadsheet headers.
 * Keys must be lowercase with spaces replaced by underscores.
 */
export const HEADER_ALIASES = {
  // Name
  name: 'Name',
  full_name: 'Name',
  fullname: 'Name',
  // Title
  title: 'Title',
  role: 'Title',
  job_title: 'Title',
  // Company
  company: 'Company',
  organization: 'Company',
  organisation: 'Company',
  // Email
  email: 'Email',
  work_email: 'Email',
  workemail: 'Email',
  // Personal Email
  personal_email: 'PersonalEmail',
  personalemail: 'PersonalEmail',
  private_email: 'PersonalEmail',
  // Phone
  phone: 'Phone',
  telephone: 'Phone',
  // LinkedIn
  linkedin: 'LinkedIn',
  linkedin_url: 'LinkedIn',
  // Location
  city: 'City',
  country: 'Country',
  // Pipeline
  owner: 'Owner',
  stage: 'Stage',
  // Notes
  notes: 'Notes',
  note: 'Notes',
  comments: 'Notes',
  comment: 'Notes',
  // Flags
  beta: 'Beta',
  trial: 'Trial',
  // ID
  id: 'id',
};

/**
 * Build an empty lead object with every CSV field initialised to ''.
 * Useful for form state initialisation and new lead creation.
 */
export const createEmptyLead = () => {
  const lead = {};
  for (const [key, def] of Object.entries(LEAD_FIELDS)) {
    if (def.csv) lead[key] = '';
  }
  return lead;
};

/**
 * Build an empty company object with every CSV field initialised to ''.
 */
export const createEmptyCompany = (companyName = '') => {
  const company = {};
  for (const [key] of Object.entries(COMPANY_FIELDS)) {
    company[key] = '';
  }
  company.Company = companyName;
  return company;
};
