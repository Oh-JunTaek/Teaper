export function selectGenerationEvidence<T extends { id: number }>(allReferences: T[], selectedReferenceRows: Array<{ question: { id: number } }>, selectedOfficialRows: Array<{ document: { id: number } }>) {
  const selectedReferenceIds = selectedReferenceRows.map(row => row.question.id);
  const selectedReferences = allReferences.filter(reference => selectedReferenceIds.includes(reference.id));
  return {
    references: selectedReferences.length ? selectedReferences : allReferences,
    officialDocumentIds: selectedOfficialRows.map(row => row.document.id),
    referenceQuestionIds: selectedReferences.map(reference => reference.id),
  };
}
