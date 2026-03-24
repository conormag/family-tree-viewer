export type Sex = 'M' | 'F' | 'U';

export interface EventRecord {
  type: string;
  date?: string;    // raw GEDCOM date string
  year?: number;    // extracted integer year
  place?: string;
}

export interface Individual {
  id: string;                   // "@I1@"
  givenName: string;
  surname: string;
  sex: Sex;
  birth?: EventRecord;
  death?: EventRecord;
  events: EventRecord[];        // other life events
  notes: string[];
  familyAsChild?: string;       // FAM id
  familiesAsSpouse: string[];   // FAM ids
}

export interface Family {
  id: string;                   // "@F1@"
  husbandId?: string;
  wifeId?: string;
  childIds: string[];
  marriage?: EventRecord;
}
