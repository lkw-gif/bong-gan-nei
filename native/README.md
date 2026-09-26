# Local Word to PDF tool

Windows desktop helper for interactive use with an installed, licensed Microsoft Word.
No hosted Office automation or third-party conversion service is used.

Build on Windows using the installed .NET Framework compiler:

```powershell
.\scripts\build-word-tool.ps1
```

The website bundles the executable and this C# source in a downloadable ZIP.
The executable is unsigned. Respect device security policies; do not disable
protection to run it. Install the fonts used by the original document for faithful
layout.

Double-click the executable to choose multiple DOC/DOCX files and an output folder.
For local regression tests:

```text
Word-to-PDF.exe --output OUTPUT_FOLDER FIRST.docx SECOND.doc
```

Documents open read-only with macros disabled. Word's ExportAsFixedFormat creates
the PDF, keeping searchable text, layout, and pagination. Existing PDFs are never
overwritten. A uniquely named CSV report records successes and failures, and a
failed file does not stop the remaining batch. Exit code is 1 when any file fails.

Browser-only conversion is a separate, approximate DOCX renderer. It is not
equivalent to Microsoft Word export and may change fonts, line wrapping and pages.
