const generateDocumentStorageKey = (contractId, documentId) => {
    return `contracts/${contractId}/documents/${documentId}/original.pdf`;
};

export { generateDocumentStorageKey };
