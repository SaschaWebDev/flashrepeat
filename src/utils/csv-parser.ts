interface CsvRow {
  front: string;
  back: string;
}

type CsvResult =
  | { ok: true; rows: CsvRow[] }
  | { ok: false; error: string };

export function parseCsvFlashcards(text: string): CsvResult {
  // Strip BOM
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }

  const rows = parseCsvRows(text);

  if (rows.length === 0) {
    return { ok: false, error: 'File is empty' };
  }

  // Auto-detect header
  let dataRows = rows;
  const first = rows[0];
  if (first.length >= 2) {
    const col0 = first[0].toLowerCase().trim();
    const col1 = first[1].toLowerCase().trim();
    const isHeader =
      (col0 === 'question' && col1 === 'answer') ||
      (col0 === 'front' && col1 === 'back');
    if (isHeader) {
      dataRows = rows.slice(1);
    }
  }

  // Use first two columns, filter empty rows, trim
  const parsed: CsvRow[] = [];
  for (const row of dataRows) {
    if (row.length < 2) continue;
    const front = row[0].trim();
    const back = row[1].trim();
    if (front === '' && back === '') continue;
    parsed.push({ front, back });
  }

  if (parsed.length === 0) {
    return { ok: false, error: 'No data rows found in CSV' };
  }

  if (parsed.length > 500) {
    return { ok: false, error: 'CSV exceeds 500 row limit' };
  }

  return { ok: true, rows: parsed };
}

/** RFC 4180 state-machine CSV parser */
function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          // Escaped quote
          field += '"';
          i += 2;
        } else {
          // End of quoted field
          inQuotes = false;
          i++;
        }
      } else {
        field += ch;
        i++;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
      } else if (ch === ',') {
        currentRow.push(field);
        field = '';
        i++;
      } else if (ch === '\r') {
        // Handle \r\n or bare \r
        currentRow.push(field);
        field = '';
        rows.push(currentRow);
        currentRow = [];
        i++;
        if (i < text.length && text[i] === '\n') {
          i++;
        }
      } else if (ch === '\n') {
        currentRow.push(field);
        field = '';
        rows.push(currentRow);
        currentRow = [];
        i++;
      } else {
        field += ch;
        i++;
      }
    }
  }

  // Push last field/row
  if (field !== '' || currentRow.length > 0) {
    currentRow.push(field);
    rows.push(currentRow);
  }

  return rows;
}
