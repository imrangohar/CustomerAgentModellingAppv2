import { agentCatalog } from '@/lib/agentCatalog';
import { schemaCatalog } from '@/lib/schemaCatalog';
import type { FieldRequirement, SchemaField } from '@/lib/catalogTypes';
import { ReadinessStatus, UploadedDomainData } from '@/types/onboarding';

const normalize = (value: string): string => value.trim().toLowerCase();

const uploadedByDomain = (uploaded: UploadedDomainData[]): Map<string, Set<string>> => {
  const map = new Map<string, Set<string>>();
  for (const domainData of uploaded) {
    map.set(domainData.domainId, new Set(domainData.headers.map(normalize)));
  }
  return map;
};

export interface MissingFieldInfo {
  domainKey: string;
  domainLabel: string;
  fieldKey: string;
  label: string;
  requirement: FieldRequirement;
  impactNotes: string[];
}

export interface AgentReadiness {
  agentKey: string;
  status: ReadinessStatus;
  missingMandatory: MissingFieldInfo[];
  missingRecommended: MissingFieldInfo[];
  missingOptional: MissingFieldInfo[];
  presentMandatoryCount: number;
  presentRecommendedCount: number;
  totals: {
    mandatory: number;
    recommended: number;
    optional: number;
  };
  notes: string[];
}

export interface AgentRequirements {
  agentKey: string;
  mandatory: MissingFieldInfo[];
  recommended: MissingFieldInfo[];
  optional: MissingFieldInfo[];
}

let warningsPrinted = false;

const validateCatalogMappings = (
  uploaded: UploadedDomainData[],
  uiDomainKeys?: string[]
): void => {
  if (warningsPrinted) return;
  warningsPrinted = true;

  const agentKeySet = new Set(agentCatalog.map((agent) => agent.key));
  for (const domain of schemaCatalog) {
    for (const field of domain.fields) {
      for (const usedAgent of field.usedByAgents) {
        if (!agentKeySet.has(usedAgent)) {
          console.warn(
            `[readinessEngine] Unknown agentKey in schema: ${usedAgent} (domain=${domain.domainKey}, field=${field.key})`
          );
        }
      }
    }
  }

  if (uiDomainKeys && uiDomainKeys.length > 0) {
    const uiSet = new Set(uiDomainKeys);
    for (const domain of schemaCatalog) {
      if (!uiSet.has(domain.domainKey)) {
        console.warn(
          `[readinessEngine] Schema domainKey is not in UI mapping list: ${domain.domainKey}`
        );
      }
    }
  }

  const schemaDomainSet = new Set(schemaCatalog.map((domain) => domain.domainKey));
  for (const upload of uploaded) {
    if (!schemaDomainSet.has(upload.domainId)) {
      console.warn(`[readinessEngine] Uploaded coverage references unknown domain: ${upload.domainId}`);
    }
  }
};

const impactsForMissing = (field: SchemaField): string[] => [
  ...(field.impactIfMissing?.blocked ?? []),
  ...(field.impactIfMissing?.degraded ?? []),
  ...(field.impactIfMissing?.restricted ?? []),
];

const fieldInfoForAgent = (agentKey: string): AgentRequirements => {
  const mandatory: MissingFieldInfo[] = [];
  const recommended: MissingFieldInfo[] = [];
  const optional: MissingFieldInfo[] = [];

  for (const domain of schemaCatalog) {
    for (const field of domain.fields) {
      if (!field.usedByAgents.includes(agentKey)) continue;
      const item: MissingFieldInfo = {
        domainKey: domain.domainKey,
        domainLabel: domain.label,
        fieldKey: field.key,
        label: field.label,
        requirement: field.requirement,
        impactNotes: impactsForMissing(field),
      };
      if (field.requirement === 'mandatory') mandatory.push(item);
      else if (field.requirement === 'recommended') recommended.push(item);
      else optional.push(item);
    }
  }

  return { agentKey, mandatory, recommended, optional };
};

export const getAgentRequirements = (agentKey: string): AgentRequirements => {
  return fieldInfoForAgent(agentKey);
};

export const computeAgentReadiness = (
  uploaded: UploadedDomainData[],
  options?: { uiDomainKeys?: string[] }
): AgentReadiness[] => {
  validateCatalogMappings(uploaded, options?.uiDomainKeys);

  const headersMap = uploadedByDomain(uploaded);

  return agentCatalog.map((agent) => {
    const missingMandatory: MissingFieldInfo[] = [];
    const missingRecommended: MissingFieldInfo[] = [];
    const missingOptional: MissingFieldInfo[] = [];
    const notes: string[] = [];

    let presentMandatoryCount = 0;
    let presentRecommendedCount = 0;
    let totalMandatory = 0;
    let totalRecommended = 0;
    let totalOptional = 0;

    for (const domain of schemaCatalog) {
      const headers = headersMap.get(domain.domainKey) ?? new Set<string>();
      for (const field of domain.fields) {
        if (!field.usedByAgents.includes(agent.key)) continue;

        const available = headers.has(normalize(field.key));

        if (field.requirement === 'mandatory') {
          totalMandatory += 1;
          if (available) {
            presentMandatoryCount += 1;
          }
        } else if (field.requirement === 'recommended') {
          totalRecommended += 1;
          if (available) {
            presentRecommendedCount += 1;
          }
        } else {
          totalOptional += 1;
        }

        if (available) continue;

        const missingInfo: MissingFieldInfo = {
          domainKey: domain.domainKey,
          domainLabel: domain.label,
          fieldKey: field.key,
          label: field.label,
          requirement: field.requirement,
          impactNotes: impactsForMissing(field),
        };

        notes.push(...missingInfo.impactNotes);

        if (field.requirement === 'mandatory') {
          missingMandatory.push(missingInfo);
        } else if (field.requirement === 'recommended') {
          missingRecommended.push(missingInfo);
        } else {
          missingOptional.push(missingInfo);
        }
      }
    }

    let status: ReadinessStatus = 'ready';
    if (missingMandatory.length > 0) {
      status = 'blocked';
    } else if (missingRecommended.length > 0) {
      status = 'degraded';
    }

    return {
      agentKey: agent.key,
      status,
      missingMandatory,
      missingRecommended,
      missingOptional,
      presentMandatoryCount,
      presentRecommendedCount,
      totals: {
        mandatory: totalMandatory,
        recommended: totalRecommended,
        optional: totalOptional,
      },
      notes: Array.from(new Set(notes)),
    };
  });
};

export const computeDomainCoverage = (domainKey: string, uploaded: UploadedDomainData[]) => {
  const domain = schemaCatalog.find((item) => item.domainKey === domainKey);
  if (!domain) return null;

  const domainData = uploaded.find((item) => item.domainId === domainKey);
  const headers = new Set((domainData?.headers ?? []).map(normalize));

  return domain.fields.map((field) => ({
    ...field,
    present: headers.has(normalize(field.key)),
  }));
};

export const computeAgentDomainCellStatus = (
  agentKey: string,
  domainKey: string,
  uploaded: UploadedDomainData[]
): ReadinessStatus | 'na' => {
  const domain = schemaCatalog.find((item) => item.domainKey === domainKey);
  if (!domain) return 'na';

  const relevantFields = domain.fields.filter((field) => field.usedByAgents.includes(agentKey));
  if (relevantFields.length === 0) return 'na';

  const headers = new Set(
    (uploaded.find((item) => item.domainId === domainKey)?.headers ?? []).map(normalize)
  );

  const hasMissingMandatory = relevantFields.some(
    (field) => field.requirement === 'mandatory' && !headers.has(normalize(field.key))
  );
  if (hasMissingMandatory) return 'blocked';

  const hasMissingRecommended = relevantFields.some(
    (field) => field.requirement === 'recommended' && !headers.has(normalize(field.key))
  );
  if (hasMissingRecommended) return 'degraded';

  return 'ready';
};
