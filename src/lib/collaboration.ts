import { Assignment, Question } from '@/types/policyOnboarding';

export function createToken(): string {
  return `${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

export function buildShareLink(baseUrl: string, assignment: Assignment): string {
  const url = new URL('/collaboration/respond', baseUrl);
  url.searchParams.set('assignmentId', assignment.id);
  url.searchParams.set('token', assignment.token);
  return url.toString();
}

export function buildAssignmentEmailText(baseUrl: string, assignment: Assignment, question?: Question): string {
  const link = buildShareLink(baseUrl, assignment);
  return `Subject: AP Onboarding Input Needed - ${question?.title || assignment.policyKey}\n\nHi ${assignment.assignee.name},\n\nPlease provide your input for:\n${question?.title || assignment.policyKey}\n\nMessage from controller:\n${assignment.message}\n\nRespond here:\n${link}\n\nDue: ${assignment.dueDate ? new Date(assignment.dueDate).toLocaleDateString() : 'Not set'}\n\nThanks.`;
}

export function buildMailto(baseUrl: string, assignment: Assignment, question?: Question): string {
  const subject = encodeURIComponent(`AP Onboarding Input Needed - ${question?.title || assignment.policyKey}`);
  const body = encodeURIComponent(buildAssignmentEmailText(baseUrl, assignment, question));
  return `mailto:${assignment.assignee.email}?subject=${subject}&body=${body}`;
}
