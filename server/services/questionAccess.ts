export function canAccessGeneratedQuestion(input: { viewerId: number; viewerRole: "teacher" | "admin"; creatorId: number }) {
  return input.viewerRole === "admin" || input.viewerId === input.creatorId;
}
