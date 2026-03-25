/// <reference types="vite/client" />
import { Tree } from '../model/Tree.js';
import type { Individual, Family } from '../model/types.js';

export class WikiTreeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WikiTreeError';
  }
}

interface WikiTreeSpouse {
  Id: string | number;
  marriage_date?: string;
  marriage_location?: string;
}

export interface WikiTreePerson {
  Id: number;
  Name?: string;
  FirstName: string;
  MiddleName?: string;
  LastNameAtBirth: string;
  Gender: 'Male' | 'Female' | '';
  BirthDate?: string;
  BirthLocation?: string;
  DeathDate?: string;
  DeathLocation?: string;
  Father?: number;
  Mother?: number;
  Spouses?: WikiTreeSpouse[];
}

// In dev, route through the Vite proxy (localhost has no CORS allowance from WikiTree).
// import.meta.env.DEV is statically replaced with `false` at build time, so production
// bundles always use the direct URL.
const WIKITREE_API = import.meta.env.DEV
  ? '/wikitree-proxy'
  : 'https://api.wikitree.com/api.php';

const indId = (n: number): string => `@W${n}@`;

const famId = (a: number, b: number): string => {
  const [lo, hi] = a < b ? [a, b] : [b, a];
  return `@WF${lo}_${hi}@`;
};

interface ParsedDate {
  date?: string;
  year?: number;
}

export function parseWikiDate(raw: string | undefined): ParsedDate {
  if (!raw) return {};
  // "0000-00-00" or empty
  if (!raw || raw === '0000-00-00' || raw.trim() === '') return {};

  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return {};

  const [, yearStr, monthStr, dayStr] = m;
  const year = parseInt(yearStr, 10);

  if (year === 0) return {};

  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  if (month === 0) {
    // Only year known
    return { date: yearStr, year };
  }

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthName = monthNames[month - 1];

  if (day === 0) {
    return { date: `${monthName} ${yearStr}`, year };
  }

  return { date: `${day} ${monthName} ${yearStr}`, year };
}

interface FamilyAccumulator {
  fatherId?: number;
  motherId?: number;
  childIds: number[];
}

export function buildTreeFromWikiTree(
  persons: Record<string, WikiTreePerson>,
  rootNumericId?: number,
): { tree: Tree; rootId: string } {
  const tree = new Tree();

  // Pass 1: create Individual records
  for (const p of Object.values(persons)) {
    const givenName = [p.FirstName, p.MiddleName].filter(Boolean).join(' ');
    const sex = p.Gender === 'Male' ? 'M' : p.Gender === 'Female' ? 'F' : 'U';

    const birthParsed = parseWikiDate(p.BirthDate);
    const deathParsed = parseWikiDate(p.DeathDate);

    const ind: Individual = {
      id: indId(p.Id),
      givenName,
      surname: p.LastNameAtBirth,
      sex,
      events: [],
      notes: [],
      familiesAsSpouse: [],
      ...(birthParsed.date !== undefined || birthParsed.year !== undefined || p.BirthLocation
        ? {
            birth: {
              type: 'BIRT',
              ...(birthParsed.date !== undefined ? { date: birthParsed.date } : {}),
              ...(birthParsed.year !== undefined ? { year: birthParsed.year } : {}),
              ...(p.BirthLocation ? { place: p.BirthLocation } : {}),
            },
          }
        : {}),
      ...(deathParsed.date !== undefined || deathParsed.year !== undefined || p.DeathLocation
        ? {
            death: {
              type: 'DEAT',
              ...(deathParsed.date !== undefined ? { date: deathParsed.date } : {}),
              ...(deathParsed.year !== undefined ? { year: deathParsed.year } : {}),
              ...(p.DeathLocation ? { place: p.DeathLocation } : {}),
            },
          }
        : {}),
    };

    tree._setIndividual(ind);
  }

  // Pass 2: synthesise Family records from parent-child links
  const familyMap = new Map<string, FamilyAccumulator>();

  for (const p of Object.values(persons)) {
    const fatherId = p.Father && p.Father !== 0 ? p.Father : undefined;
    const motherId = p.Mother && p.Mother !== 0 ? p.Mother : undefined;

    if (!fatherId && !motherId) continue;

    // Use 0 as placeholder for unknown parent in the key
    const key = famId(fatherId ?? 0, motherId ?? 0);

    if (!familyMap.has(key)) {
      familyMap.set(key, {
        fatherId,
        motherId,
        childIds: [],
      });
    }
    const acc = familyMap.get(key)!;
    acc.childIds.push(p.Id);
  }

  for (const [key, acc] of familyMap) {
    // Look up marriage info from father's Spouses array
    let marriage: Family['marriage'];
    if (acc.fatherId && acc.motherId) {
      const father = persons[String(acc.fatherId)];
      if (father?.Spouses) {
        const spouseEntry = father.Spouses.find(
          s => String(s.Id) === String(acc.motherId),
        );
        if (spouseEntry) {
          const marriageParsed = parseWikiDate(spouseEntry.marriage_date);
          if (marriageParsed.date !== undefined || marriageParsed.year !== undefined || spouseEntry.marriage_location) {
            marriage = {
              type: 'MARR',
              ...(marriageParsed.date !== undefined ? { date: marriageParsed.date } : {}),
              ...(marriageParsed.year !== undefined ? { year: marriageParsed.year } : {}),
              ...(spouseEntry.marriage_location ? { place: spouseEntry.marriage_location } : {}),
            };
          }
        }
      }
    }

    const fam: Family = {
      id: key,
      childIds: acc.childIds.map(indId),
      ...(acc.fatherId ? { husbandId: indId(acc.fatherId) } : {}),
      ...(acc.motherId ? { wifeId: indId(acc.motherId) } : {}),
      ...(marriage ? { marriage } : {}),
    };

    tree._setFamily(fam);

    // Cross-link individuals
    for (const childNumId of acc.childIds) {
      const child = tree.getIndividual(indId(childNumId));
      if (child) child.familyAsChild = key;
    }

    if (acc.fatherId) {
      const father = tree.getIndividual(indId(acc.fatherId));
      if (father && !father.familiesAsSpouse.includes(key)) {
        father.familiesAsSpouse.push(key);
      }
    }

    if (acc.motherId) {
      const mother = tree.getIndividual(indId(acc.motherId));
      if (mother && !mother.familiesAsSpouse.includes(key)) {
        mother.familiesAsSpouse.push(key);
      }
    }
  }

  // Determine rootId
  const individuals = tree.getAllIndividuals();
  let rootId: string;
  if (rootNumericId !== undefined) {
    rootId = indId(rootNumericId);
  } else if (individuals.length > 0) {
    rootId = individuals[0].id;
  } else {
    rootId = '@W0@';
  }

  return { tree, rootId };
}

export async function loadWikiTreeData(
  key: string,
  depth = 3,
): Promise<{ tree: Tree; rootId: string }> {
  const fields = 'Id,Name,FirstName,MiddleName,LastNameAtBirth,Gender,BirthDate,BirthLocation,DeathDate,DeathLocation,Father,Mother,Spouses';
  const url = `${WIKITREE_API}?action=getPeople&keys=${encodeURIComponent(key)}&ancestors=${depth}&appid=family-tree-viewer&format=json&fields=${fields}`;

  let response: Response;
  try {
    response = await fetch(url);
  } catch (err) {
    throw new WikiTreeError(`Network error fetching WikiTree data: ${(err as Error).message}`);
  }

  if (!response.ok) {
    throw new WikiTreeError(`WikiTree API returned HTTP ${response.status}`);
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new WikiTreeError('WikiTree API returned invalid JSON');
  }

  if (!Array.isArray(data) || data.length < 1) {
    throw new WikiTreeError('Unexpected WikiTree API response shape');
  }

  const payload = data[0] as {
    status?: string;
    resultByKey?: Record<string, { status?: string; Id: number | null }>;
    people?: Record<string, WikiTreePerson>;
  };

  // Check if the requested key was found
  const keyResult = payload.resultByKey?.[key];
  if (!keyResult || keyResult.Id == null) {
    const msg = keyResult?.status ?? 'Profile not found';
    throw new WikiTreeError(`WikiTree: ${msg}`);
  }

  const people = payload.people;
  if (!people || typeof people !== 'object') {
    throw new WikiTreeError('WikiTree API response missing people');
  }

  return buildTreeFromWikiTree(people, keyResult.Id);
}
