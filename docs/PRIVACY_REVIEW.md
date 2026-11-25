# Repository privacy review

Reviewed: 2026-11-25.

The review checked tracked working files, the Git index, and 122 historical file versions reachable from the local Git references. Common credential patterns included private keys, GitHub tokens, AWS access keys, Google API keys, Slack tokens, credential-bearing URLs, and quoted credential assignments. Additional index checks covered OpenAI-style keys, npm tokens, JWTs, and sensitive filenames.

No credentials or private keys were detected. No tracked environment files, exported notes, or PDFs were found. These were pattern-based checks, not a guarantee that all sensitive information is absent. Untracked and ignored local files, remote-only references, release attachments, and GitHub discussions were outside the review.

## Findings and cleanup

- IDE project files contained relative environment paths but no detected secrets. Remove `.idea/` from the index while retaining local files; ignore `.idea/` and `.venv/` to prevent future inclusion.
- The README named a course used for historical print validation. Replace the course name with a generic sample-note description while preserving the validation results.
- Some existing commits expose a personal institutional email in author and committer metadata. Do not reproduce that address here. Use the repository owner's existing GitHub noreply identity for future local commits. Existing commit metadata remains unchanged; removing it requires a separately coordinated history rewrite and cannot remove copies others already possess.

## Before publishing

- Inspect the staged diff and file list, including generated bundles, for credentials, personal paths, private notes, and exported content.
- Keep local configuration, environment files, and exports out of version control. Ignoring a file does not remove previously tracked copies or historical versions.
- Use synthetic fixtures and generic dataset descriptions in public tests and documentation.
- Check commit author and committer email addresses before pushing.
- If a real credential is discovered, revoke or rotate it; deleting the file alone is insufficient.

This review covers repository disclosure. Generated print previews intentionally include selected note text and embedded attachments, and reports include note paths and warnings. Review those exports separately before sharing them.
