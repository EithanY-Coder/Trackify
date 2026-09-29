# graphify
- **graphify** (`.claude/skills/graphify/SKILL.md`) - any input to knowledge graph. Trigger: `/graphify`
When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

# taste-skill (from https://github.com/leonxlnx/taste-skill)
- **redesign-skill** (`.claude/skills/redesign-skill/SKILL.md`, install name `redesign-existing-projects`) - use this one for Trackify. Audits an *existing* UI (works with vanilla CSS, no framework assumed) and applies targeted premium-design fixes without breaking functionality - covers dashboards, sidebars, and data-heavy layouts directly.
- **taste-skill** (`.claude/skills/taste-skill/SKILL.md`, install name `design-taste-frontend`) - the flagship/general skill from the same repo. Its own scope note says it's for "landing pages, portfolios, and redesigns - not dashboards, not data tables, not multi-step product UI," which is most of Trackify's UI. Prefer `redesign-skill` for this project; keep this one for any marketing/landing-page-style work only.
