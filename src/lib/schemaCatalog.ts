import schemaFromExcel from '../../data/schema_from_excel.json';
import type { SchemaCatalog, SchemaDomain } from '@/lib/catalogTypes';
import { generatedSchemaCatalog } from '@/lib/schemaCatalog.generated';

const schemaOverrides: Partial<Record<string, Partial<SchemaDomain>>> = {};

const fallbackCatalog: SchemaCatalog = {
  schemaVersion: undefined,
  domains: generatedSchemaCatalog,
};

const importedCatalog = schemaFromExcel as Partial<SchemaCatalog> & {
  domains?: SchemaDomain[];
  importedAt?: string;
};

const baseCatalog: SchemaCatalog =
  importedCatalog && Array.isArray(importedCatalog.domains) && importedCatalog.domains.length > 0
    ? {
        schemaVersion: importedCatalog.schemaVersion,
        domains: importedCatalog.domains,
      }
    : fallbackCatalog;

export const schemaVersion = baseCatalog.schemaVersion;

export const schemaCatalog: SchemaDomain[] = baseCatalog.domains.map((domain) => {
  const override = schemaOverrides[domain.domainKey];
  return {
    ...domain,
    ...override,
    fields: override?.fields ? override.fields : domain.fields,
  };
});

export type {
  SchemaCatalog,
  SchemaDomain,
  SchemaField,
  FieldRequirement,
  DomainKey,
} from '@/lib/catalogTypes';
