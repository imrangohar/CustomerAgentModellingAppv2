import { schemaCatalog } from '@/lib/schemaCatalog';

export const getDomainHeaders = (domainKey: string, includeOptional = false): string[] => {
  const domain = schemaCatalog.find((item) => item.domainKey === domainKey);
  if (!domain) return [];

  return domain.fields
    .filter((field) => includeOptional || field.requirement !== 'optional')
    .map((field) => field.key);
};

export const createTemplateCsv = (domainKey: string, includeOptional = false): string => {
  const headers = getDomainHeaders(domainKey, includeOptional);
  return `${headers.join(',')}\n`;
};
