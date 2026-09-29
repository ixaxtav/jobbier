import type { DocumentKind } from "@/db/schema";

export const DOCUMENT_KIND_LABEL: Record<DocumentKind, string> = {
  resume: "Résumé",
  cover_letter: "Cover letter",
  portfolio: "Portfolio",
  other: "Other",
};

export const DOCUMENT_KINDS = Object.keys(DOCUMENT_KIND_LABEL) as DocumentKind[];
