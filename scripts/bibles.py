#!/usr/bin/env python3
"""Package the bundled public-domain Bibles for the app.

Downloads the verse-per-line editions from eBible.org and writes
src-tauri/bibles/<id>.tsv.gz: one verse per line, "book<TAB>chapter<TAB>verse<TAB>text",
book being 1-66 in the Protestant order (both translations share those books).

    python3 scripts/bibles.py

- web: World English Bible (public domain; "World English Bible" is a
  trademark of eBible.org).
- kjv: King James Version, 1769 text (public domain except in the UK, where
  the Crown's letters patent cover it).
"""
import gzip
import io
import re
import sys
import urllib.request
import zipfile
from pathlib import Path

# eBible.org's book codes, in canonical order (1-66).
BOOKS = (
    "GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB PSA PRO ECC SOL ISA JER LAM "
    "EZE DAN HOS JOE AMO OBA JON MIC NAH HAB ZEP HAG ZEC MAL MAT MAR LUK JOH ACT ROM 1CO 2CO GAL EPH PHI "
    "COL 1TH 2TH 1TI 2TI TIT PHM HEB JAM 1PE 2PE 1JO 2JO 3JO JUD REV"
).split()
assert len(BOOKS) == 66
SOURCES = {"web": "eng-web", "kjv": "eng-kjv2006"}
LINE = re.compile(r"^(\S+) (\d+):(\d+) (.*)$")


def clean(text: str) -> str:
    text = text.replace("¶", "")
    # KJV's italics: [was] -> was, nested ones too ("[[but] ... also]").
    while (unwrapped := re.sub(r"\[([^\[\]]*)\]", r"\1", text)) != text:
        text = unwrapped
    return re.sub(r"\s+", " ", text).strip()


def main() -> None:
    out_dir = Path(__file__).resolve().parent.parent / "src-tauri" / "bibles"
    out_dir.mkdir(parents=True, exist_ok=True)
    for ident, name in SOURCES.items():
        url = f"https://ebible.org/Scriptures/{name}_vpl.zip"
        print(f"{ident}: {url}", file=sys.stderr)
        request = urllib.request.Request(url, headers={"User-Agent": "cellpresenter-bibles/1.0"})
        with urllib.request.urlopen(request) as res:
            archive = zipfile.ZipFile(io.BytesIO(res.read()))
        source = archive.read(f"{name}_vpl.txt").decode("utf-8-sig")
        rows = []
        for line in source.splitlines():
            m = LINE.match(line.strip())
            if not m or m.group(1) not in BOOKS:
                continue
            text = clean(m.group(4))
            if text:
                rows.append(f"{BOOKS.index(m.group(1)) + 1}\t{m.group(2)}\t{m.group(3)}\t{text}")
        data = ("\n".join(rows) + "\n").encode("utf-8")
        # mtime=0 keeps the file identical between runs.
        with gzip.GzipFile(out_dir / f"{ident}.tsv.gz", "wb", compresslevel=9, mtime=0) as f:
            f.write(data)
        print(f"{ident}: {len(rows)} verses", file=sys.stderr)


if __name__ == "__main__":
    main()
