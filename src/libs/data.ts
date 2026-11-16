import { SharedArray } from 'k6/data';

const splitCsvLine = (line: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
};

export const parseCsv = <T extends Record<string, string>>(csvText: string): T[] => {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) {
    return [];
  }

  const headers = splitCsvLine(lines[0]);
  const rows: T[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = splitCsvLine(lines[i]);
    const record: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      record[headers[j]] = values[j] ?? '';
    }
    rows.push(record as T);
  }

  return rows;
};

export const loadCsvData = <T extends Record<string, string>>(
  name: string,
  filePath: string
): T[] => {
  return new SharedArray<T>(name, () => {
    const raw = open(filePath);
    return parseCsv<T>(raw);
  });
};

export const loadJsonData = <T>(name: string, filePath: string): T[] => {
  return new SharedArray<T>(name, () => {
    const raw = open(filePath);
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      throw new Error(`JSON data file '${filePath}' must contain a top-level array.`);
    }
    return parsed as T[];
  });
};

export const DataGenerator = {
  randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },

  randomString(length = 8): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let out = '';
    for (let i = 0; i < length; i++) {
      out += chars[Math.floor(Math.random() * chars.length)];
    }
    return out;
  },

  randomEmail(domain = 'example.com'): string {
    return `user.${DataGenerator.randomString(8)}@${domain}`;
  },

  pickRandom<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new Error('Cannot pick random item from an empty array.');
    }
    return items[Math.floor(Math.random() * items.length)];
  },

  uuid(): string {
    const hex = (): string => Math.floor(Math.random() * 16).toString(16);
    const segment = (len: number): string => Array.from({ length: len }, hex).join('');
    return `${segment(8)}-${segment(4)}-4${segment(3)}-${segment(4)}-${segment(12)}`;
  },
};
