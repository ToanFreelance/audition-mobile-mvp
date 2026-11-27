# Evidence before completion
Use before claiming status, commit, PR or review. Check what would prove claim; actually retrieve or execute; inspect output; report only what it proves.
- File/branch/commit: fetch exact ref and compare against expected parent/base. Verify changed files and content, no unrelated modifications.
- Test: exact command, executed SHA, assertion/log, exit status, failures. RED means intended regression failure; GREEN means same test passes, not all QA. Reuse verified same-SHA evidence without rerunning unrelated suites; source reasoning and build READY are not runtime QA.
- Review: exact request ID, phase/head/base, contributor exclusions, concrete evidence/verdict. Independent logical agent distinct from contributor; do not claim independent model. No approval if evidence incomplete.
- iPhone/real multiplayer: hardware/owner evidence required, deterministic test is not real multi-human proof.
Report GitHub READ/WRITE PASS/FAIL/NOT_ATTEMPTED/NOT_REQUIRED, artifact URL, exact SHA, actual tests and blockers. M1 Complete is branch only. No test/pass/merge claim from an agent's narrative.
