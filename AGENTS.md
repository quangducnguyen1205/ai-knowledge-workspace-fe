# Project3 frontend agent entrypoint

Read the central [Project3 engineering skill](https://github.com/quangducnguyen1205/ai-knowledge-workspace/blob/main/ai-guidance/skills/project3-engineering/SKILL.md)
and the [v1 final baseline](https://github.com/quangducnguyen1205/ai-knowledge-workspace/blob/project3-submission-v1/docs/submission/project3-final-baseline.md)
before editing. This repository owns browser presentation, routing, upload interaction,
lifecycle polling presentation, search, assistant interaction and citation navigation.
Browser calls Spring only.

Before frontend work, read the central
[change-safety](https://github.com/quangducnguyen1205/ai-knowledge-workspace/blob/main/ai-guidance/skills/project3-engineering/checklists/change-safety.md)
and [frontend-feature-ownership](https://github.com/quangducnguyen1205/ai-knowledge-workspace/blob/main/ai-guidance/skills/project3-engineering/checklists/frontend-feature-ownership.md);
read [runtime-validation](https://github.com/quangducnguyen1205/ai-knowledge-workspace/blob/main/ai-guidance/skills/project3-engineering/checklists/runtime-validation.md)
for browser work.

Canonical checks are:

```text
pnpm test
pnpm typecheck
pnpm build
```

Keep `app` shell/routing, feature workflow ownership and neutral shared/lib boundaries
clear. Automatic indexing is normal; manual Index transcript is recovery at
`TRANSCRIPT_READY`. Preserve routes, API shapes, auth defaults and citation behavior.

Inspect `git status` first, work on `main`, commit locally after validation, never stage
private notes or generated output, and never start browser/runtime services or push without
explicit authorization.
