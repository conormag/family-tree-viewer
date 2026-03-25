import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildTreeFromWikiTree, loadWikiTreeData, parseWikiDate, WikiTreeError } from '../../src/loaders/wikitree.js';
import type { WikiTreePerson } from '../../src/loaders/wikitree.js';

// ── parseWikiDate ────────────────────────────────────────────────────────────

describe('parseWikiDate', () => {
  it('parses full date', () => {
    expect(parseWikiDate('1850-06-15')).toEqual({ date: '15 Jun 1850', year: 1850 });
  });

  it('parses year+month only (day = 00)', () => {
    expect(parseWikiDate('1850-06-00')).toEqual({ date: 'Jun 1850', year: 1850 });
  });

  it('parses year only (month = 00)', () => {
    expect(parseWikiDate('1850-00-00')).toEqual({ date: '1850', year: 1850 });
  });

  it('returns empty for all-zero date', () => {
    expect(parseWikiDate('0000-00-00')).toEqual({});
  });

  it('returns empty for undefined', () => {
    expect(parseWikiDate(undefined)).toEqual({});
  });

  it('returns empty for empty string', () => {
    expect(parseWikiDate('')).toEqual({});
  });
});

// ── buildTreeFromWikiTree ────────────────────────────────────────────────────

const basePerson = (overrides: Partial<WikiTreePerson> = {}): WikiTreePerson => ({
  Id: 1,
  FirstName: 'George',
  LastNameAtBirth: 'Washington',
  Gender: 'Male',
  Father: 0,
  Mother: 0,
  ...overrides,
});

describe('buildTreeFromWikiTree — single person', () => {
  it('creates individual with correct id format', () => {
    const { tree } = buildTreeFromWikiTree({ '1': basePerson() });
    expect(tree.getIndividual('@W1@')).toBeDefined();
  });

  it('maps given name (includes MiddleName)', () => {
    const { tree } = buildTreeFromWikiTree({
      '1': basePerson({ MiddleName: 'Herbert' }),
    });
    expect(tree.getIndividual('@W1@')!.givenName).toBe('George Herbert');
  });

  it('maps surname', () => {
    const { tree } = buildTreeFromWikiTree({ '1': basePerson() });
    expect(tree.getIndividual('@W1@')!.surname).toBe('Washington');
  });

  it('maps sex Male→M', () => {
    const { tree } = buildTreeFromWikiTree({ '1': basePerson({ Gender: 'Male' }) });
    expect(tree.getIndividual('@W1@')!.sex).toBe('M');
  });

  it('maps sex Female→F', () => {
    const { tree } = buildTreeFromWikiTree({ '1': basePerson({ Id: 2, Gender: 'Female' }), });
    expect(tree.getIndividual('@W2@')!.sex).toBe('F');
  });

  it('maps sex unknown→U', () => {
    const { tree } = buildTreeFromWikiTree({ '1': basePerson({ Gender: '' }) });
    expect(tree.getIndividual('@W1@')!.sex).toBe('U');
  });

  it('parses birth date', () => {
    const { tree } = buildTreeFromWikiTree({
      '1': basePerson({ BirthDate: '1732-02-22', BirthLocation: 'Virginia' }),
    });
    const ind = tree.getIndividual('@W1@')!;
    expect(ind.birth?.date).toBe('22 Feb 1732');
    expect(ind.birth?.year).toBe(1732);
    expect(ind.birth?.place).toBe('Virginia');
  });

  it('parses death date', () => {
    const { tree } = buildTreeFromWikiTree({
      '1': basePerson({ DeathDate: '1799-12-14' }),
    });
    const ind = tree.getIndividual('@W1@')!;
    expect(ind.death?.date).toBe('14 Dec 1799');
    expect(ind.death?.year).toBe(1799);
  });

  it('returns rootId matching the individual', () => {
    const { rootId } = buildTreeFromWikiTree({ '1': basePerson() }, 1);
    expect(rootId).toBe('@W1@');
  });

  it('falls back to first individual when no rootNumericId given', () => {
    const { rootId } = buildTreeFromWikiTree({ '1': basePerson() });
    expect(rootId).toBe('@W1@');
  });
});

describe('buildTreeFromWikiTree — parent + child', () => {
  const father: WikiTreePerson = { Id: 10, FirstName: 'Augustine', LastNameAtBirth: 'Washington', Gender: 'Male', Father: 0, Mother: 0 };
  const mother: WikiTreePerson = { Id: 11, FirstName: 'Mary', LastNameAtBirth: 'Ball', Gender: 'Female', Father: 0, Mother: 0 };
  const child: WikiTreePerson = { Id: 1, FirstName: 'George', LastNameAtBirth: 'Washington', Gender: 'Male', Father: 10, Mother: 11 };

  it('synthesises a family record', () => {
    const { tree } = buildTreeFromWikiTree({ '1': child, '10': father, '11': mother });
    const families = tree.getAllFamilies();
    expect(families).toHaveLength(1);
  });

  it('family has correct husbandId and wifeId', () => {
    const { tree } = buildTreeFromWikiTree({ '1': child, '10': father, '11': mother });
    const fam = tree.getAllFamilies()[0];
    expect(fam.husbandId).toBe('@W10@');
    expect(fam.wifeId).toBe('@W11@');
  });

  it('child has familyAsChild set', () => {
    const { tree } = buildTreeFromWikiTree({ '1': child, '10': father, '11': mother });
    const c = tree.getIndividual('@W1@')!;
    expect(c.familyAsChild).toBeDefined();
    expect(c.familyAsChild).toBe(tree.getAllFamilies()[0].id);
  });

  it('parents have familiesAsSpouse cross-linked', () => {
    const { tree } = buildTreeFromWikiTree({ '1': child, '10': father, '11': mother });
    const famId = tree.getAllFamilies()[0].id;
    expect(tree.getIndividual('@W10@')!.familiesAsSpouse).toContain(famId);
    expect(tree.getIndividual('@W11@')!.familiesAsSpouse).toContain(famId);
  });

  it('family childIds contains the child', () => {
    const { tree } = buildTreeFromWikiTree({ '1': child, '10': father, '11': mother });
    const fam = tree.getAllFamilies()[0];
    expect(fam.childIds).toContain('@W1@');
  });
});

describe('buildTreeFromWikiTree — two siblings', () => {
  const father: WikiTreePerson = { Id: 10, FirstName: 'Dad', LastNameAtBirth: 'Smith', Gender: 'Male', Father: 0, Mother: 0 };
  const child1: WikiTreePerson = { Id: 1, FirstName: 'Alice', LastNameAtBirth: 'Smith', Gender: 'Female', Father: 10, Mother: 0 };
  const child2: WikiTreePerson = { Id: 2, FirstName: 'Bob', LastNameAtBirth: 'Smith', Gender: 'Male', Father: 10, Mother: 0 };

  it('creates only one family for two siblings', () => {
    const { tree } = buildTreeFromWikiTree({ '1': child1, '2': child2, '10': father });
    expect(tree.getAllFamilies()).toHaveLength(1);
  });

  it('family has two children', () => {
    const { tree } = buildTreeFromWikiTree({ '1': child1, '2': child2, '10': father });
    const fam = tree.getAllFamilies()[0];
    expect(fam.childIds).toHaveLength(2);
  });
});

describe('buildTreeFromWikiTree — single parent', () => {
  const father: WikiTreePerson = { Id: 10, FirstName: 'Dad', LastNameAtBirth: 'Jones', Gender: 'Male', Father: 0, Mother: 0 };
  const child: WikiTreePerson = { Id: 1, FirstName: 'Kid', LastNameAtBirth: 'Jones', Gender: 'Male', Father: 10, Mother: 0 };

  it('creates family with only husbandId when mother is 0', () => {
    const { tree } = buildTreeFromWikiTree({ '1': child, '10': father });
    const fam = tree.getAllFamilies()[0];
    expect(fam.husbandId).toBe('@W10@');
    expect(fam.wifeId).toBeUndefined();
  });
});

// ── loadWikiTreeData ─────────────────────────────────────────────────────────

function makeOkResponse(ancestors: Record<string, WikiTreePerson>) {
  return {
    ok: true,
    json: async () => [{ status: 'OK' }, { ancestors }],
  } as unknown as Response;
}

function makeErrorResponse(status: string) {
  return {
    ok: true,
    json: async () => [{ status }, {}],
  } as unknown as Response;
}

function makeHttpError(code: number) {
  return {
    ok: false,
    status: code,
  } as unknown as Response;
}

describe('loadWikiTreeData', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns tree and rootId for valid response', async () => {
    const george: WikiTreePerson = { Id: 1, Name: 'Washington-1', FirstName: 'George', LastNameAtBirth: 'Washington', Gender: 'Male', Father: 0, Mother: 0 };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeOkResponse({ '1': george })));

    const { tree, rootId } = await loadWikiTreeData('Washington-1');
    expect(tree.getIndividual('@W1@')).toBeDefined();
    expect(rootId).toBe('@W1@');
  });

  it('throws WikiTreeError on HTTP error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeHttpError(503)));
    await expect(loadWikiTreeData('Washington-1')).rejects.toThrow(WikiTreeError);
  });

  it('throws WikiTreeError when status is not OK', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(makeErrorResponse('Error')));
    await expect(loadWikiTreeData('Washington-1')).rejects.toThrow(WikiTreeError);
  });

  it('throws WikiTreeError on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Failed to fetch')));
    await expect(loadWikiTreeData('Washington-1')).rejects.toThrow(WikiTreeError);
  });

  it('includes depth in the API request URL', async () => {
    const george: WikiTreePerson = { Id: 1, Name: 'Washington-1', FirstName: 'George', LastNameAtBirth: 'Washington', Gender: 'Male', Father: 0, Mother: 0 };
    const fetchMock = vi.fn().mockResolvedValue(makeOkResponse({ '1': george }));
    vi.stubGlobal('fetch', fetchMock);

    await loadWikiTreeData('Washington-1', 4);
    const url: string = fetchMock.mock.calls[0][0];
    expect(url).toContain('depth=4');
  });
});
