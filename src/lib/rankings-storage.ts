import type {
  RankingBoardState,
  RankingTemplateVersion,
} from "./rankings";

const TEMPLATE_KEY = "scenthub-ranking-templates-v1";
const DRAFT_PREFIX = "scenthub-ranking-draft:";

export function loadTemplates(): RankingTemplateVersion[] {
  return readJson<RankingTemplateVersion[]>(TEMPLATE_KEY) ?? [];
}

export function saveTemplate(template: RankingTemplateVersion): void {
  const templates = loadTemplates();
  const next = [
    template,
    ...templates.filter((entry) => entry.templateId !== template.templateId),
  ].slice(0, 20);
  localStorage.setItem(TEMPLATE_KEY, JSON.stringify(next));
}

export function loadTemplate(
  templateId: string,
): RankingTemplateVersion | null {
  return (
    loadTemplates().find((template) => template.templateId === templateId) ??
    null
  );
}

export function loadDraft(templateId: string): RankingBoardState | null {
  return readJson<RankingBoardState>(`${DRAFT_PREFIX}${templateId}`);
}

export function saveDraft(board: RankingBoardState): void {
  localStorage.setItem(
    `${DRAFT_PREFIX}${board.templateId}`,
    JSON.stringify(board),
  );
}

function readJson<T>(key: string): T | null {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : null;
  } catch {
    return null;
  }
}
