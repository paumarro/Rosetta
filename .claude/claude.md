

# Code style
- Destructure imports when possible (eg. import { foo } from 'bar')
- Always try to adher to modern coding standards. (I.e: use await instead of .then())
- Add error handling when necessary
- Make sure that the coding style is consistent with the rest of the source code.

# Workflow
- Never leave traces of AI tooling when Commiting or Pushing code. Always through the users account.
- Always write concise descriptive atomic commit messages following best practices.

## Commit Message Convention
Follow conventional commit format with scope when applicable:
- `feat(scope): description` - New features
- `fix(scope): description` - Bug fixes
- `docs: description` - Documentation changes
- `refactor(scope): description` - Code refactoring
- `test(scope): description` - Test changes
- `chore(scope): description` - Build/tooling changes

Examples from this project:
- `feat(backend-editor): update default diagram template with editor tutorial`
- `fix(frontend-editor): use location.href for NotFound navigation`
- `docs: add diagram data flow documentation`

**CRITICAL**: Never add AI-generated footers like "🤖 Generated with Claude Code" or "Co-Authored-By: Claude" to commits. 
