# Curriculum research pack — status: PARTIAL (primary sources not readable)

This folder was meant to be built from the Telangana government's own documents (SCERT
textbooks, FLN/Tholimettu handbooks, learning-outcome brochures, CCE documents) read page by
page. **That was not possible in this session**, and this pack says so rather than filling the
gaps from memory:

- The session's outbound network policy refused every source host: `drive.usercontent.google.com`,
  `drive.google.com`, `scert.telangana.gov.in`, `manabadi.co.in`, `byjus.com`/`cdn1.byjus.com`,
  `tsboardsolutions.in`, `aglasem.com`, `teachersbadi.in`, `tsteachers.in`, `paatashaala.in`,
  `teachersbuzz.in`, `youtube.com`, `ncert.nic.in`, `education.gov.in` (HTTP 403 at the proxy;
  WebFetch could not resolve them either). See `SOURCES.md`.
- The Google Drive connector can **see** the Class 1 English FLN book
  (`1st FLN Eng Class 2024-25.pdf`, id `1QsfjTsYaFF6UzQ-zMWqpZAQXV6Eg0pX_`, 92,165,033 bytes, owner
  `ebooksscert@gmail.com`), but refuses downloads over 10 MB and returns no text for it (it is a
  scan). **Not one page of the Class 1 book was read.**
- The only channel that worked was web search, which returns short summaries of pages with
  their URLs. Everything below comes from those summaries. Each fact is tagged:
  - **[S-official]**: the summary quotes an official (scert.telangana.gov.in, ncert, pib, education.gov.in) URL
  - **[S-secondary]**: the summary quotes a teacher blog or aggregator (teachersbadi, paatashaala, etc.)
  - **[GAP]**: needed, not found. Nothing is invented to fill it.

Verbatim quotes are only those the search summaries reproduced. Anything marked [S-secondary]
must be checked against the official document before it goes into the app.

## To finish this research

Allow these hosts in the environment's network settings (cloud environment menu → Edit →
Network access → Allowed domains; see https://code.claude.com/docs/en/cloud-environments#network-access)
and re-run the task: `scert.telangana.gov.in`, `drive.usercontent.google.com`, `drive.google.com`,
`ncert.nic.in`, `education.gov.in`, `dsel.education.gov.in`, `pib.gov.in`, plus the teacher sites if
period plans are wanted (`teachersbadi.in`, `paatashaala.in`, `paatasaala.in`, `tsteachers.in`,
`teachersbuzz.in`, `guruvu.in`). Alternatively, upload the PDFs (split under 10 MB each) to the repo's
scratch area or to Drive.

## Files

| File | Content | Status |
|---|---|---|
| `00-curriculum-philosophy.md` | SCF-2011, NEP/NCF-FS, NIPUN, Tholimettu approach | partial, secondary |
| `01-class1-english.md` | Class 1 English | **mostly GAP**; only the older 2019-20 book's unit list |
| `02-fln-classes-1-5.md` | Tholimettu structure, period steps, assessments | partial |
| `03-classes-6-10.md` | CCE, SSC paper pattern | partial, sources conflict |
| `04-question-and-activity-types.md` | activity types seen in the summaries | partial |
| `05-teacher-workflow.md` | teacher's year/week/day | partial |
| `data/*.json` | machine-readable form of the above, with `verified` flags | partial |
| `SOURCES.md` | every URL, readability, blocked hosts | complete for this session |
