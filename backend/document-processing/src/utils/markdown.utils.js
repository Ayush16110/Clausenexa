const cleanMarkdown = (markdown) => {
    if (typeof markdown !== "string" || !markdown.trim()) {
        throw new Error("Invalid markdown");
    }

    return markdown
        .replace(/\r\n?/g, "\n")
        .replace(/[ \t]+$/gm, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
};

export { cleanMarkdown };
