# Conventions

## Folder Naming
- Agent folders: lowercase, hyphen-separated under `agents/` (e.g., `backend-developer`)

## File Naming
- Agent config: `AGENT.md` per agent
- Skills: `skills/SKILL_NAME.md` (UPPER_SNAKE_CASE)
- Outputs: `YYYY-MM-DD_agent-name_description.md`
- Journal entries: `YYYY-MM-DD_HHMM.md` in `journal/entries/`

## Agent Structure Checklist
- [ ] Goals: measurable KPIs with baselines and targets
- [ ] Skills: each serves at least one goal
- [ ] Heartbeat: scheduled cycle with decision tree
- [ ] Rules: CAN/CANNOT lists and handoff rules
- [ ] Memory: empty template (memory is earned from data)
- [ ] Registered in `AGENT_REGISTRY.md`

## Information Flow
- `knowledge/` → static, read-only for agents (humans update)
- `journal/entries/` → read-write for agents (shared communication)
- `MEMORY.md` → private per agent
- `outputs/` → append-only, always new dated files

## Language
- All content written inside agent files (RULES.md, MEMORY.md, AGENT.md, outputs/, journal/entries/) must be in **English only**

## Key Principles
- One skill per cycle
- Every skill must serve at least one goal
- Weekly review is mandatory
- Agents communicate through journal, not directly
