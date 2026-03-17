export type FieldRequirement = 'mandatory' | 'recommended' | 'optional';

export type DomainKey = string;

export interface SchemaField {
  key: string;
  label: string;
  requirement: FieldRequirement;
  description?: string;
  usedByAgents: string[];
  impactIfMissing?: {
    blocked?: string[];
    degraded?: string[];
    restricted?: string[];
  };
  sourceRef?: { pdf: 'schema'; page?: number; note?: string };
}

export interface SchemaDomain {
  domainKey: DomainKey;
  label: string;
  fields: SchemaField[];
}

export interface SchemaCatalog {
  schemaVersion?: string;
  domains: SchemaDomain[];
}

export interface AgentDefinition {
  key: string;
  name: string;
  description: string;
  defaultInstructions: string;
  inputs?: string[];
  outputs?: string[];
  dependsOnDomains: DomainKey[];
  dependsOnFields: string[];
  emailCapabilities?: {
    needsRead: boolean;
    needsSend: boolean;
  };
  sourceRef?: { pdf: 'deck'; page?: number; note?: string };
}
