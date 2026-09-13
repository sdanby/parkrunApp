"""
Simple ENEX (Evernote export) processor.

Usage:
  python evernote.py --enex inbox.enex --list --limit 50
  python evernote.py --enex inbox.enex --to-csv notes.csv --limit 200
  python evernote.py --enex inbox.enex --query "keyword" --show-first 5

This script does NOT require the Evernote SDK. It uses BeautifulSoup to convert ENML to text.

Dependencies:
  pip install beautifulsoup4 lxml

Notes:
  - ENEX files can be large. This uses iterative parsing to avoid loading the whole tree.
  - Never commit your exports to public repos if they contain private data.
"""

import argparse
import csv
import sys
import xml.etree.ElementTree as ET
from bs4 import BeautifulSoup


def enml_to_text(enml):
    if not enml:
        return ''
    # enml is a string which contains <en-note>...</en-note>
    # BeautifulSoup with lxml handles it well
    soup = BeautifulSoup(enml, 'lxml')
    en_note = soup.find('en-note')
    if en_note:
        return en_note.get_text(separator='\n').strip()
    # fallback: return all text
    return soup.get_text(separator='\n').strip()


def iter_notes_from_enex(path):
    """Yield dicts: {'title', 'content', 'created', 'updated', 'tags'} from ENEX file."""
    # Use iterative parsing to avoid huge memory usage
    context = ET.iterparse(path, events=("end",))
    for event, elem in context:
        if elem.tag == 'note':
            title_el = elem.find('title')
            title = title_el.text if title_el is not None else ''
            content_el = elem.find('content')
            content = content_el.text if content_el is not None else ''
            created_el = elem.find('created')
            created = created_el.text if created_el is not None else ''
            updated_el = elem.find('updated')
            updated = updated_el.text if updated_el is not None else ''
            tags = [t.text for t in elem.findall('tag') if t is not None and t.text]
            guid_el = elem.find('note-attributes/guid')
            guid = guid_el.text if guid_el is not None else None

            text = enml_to_text(content)
            yield {'guid': guid, 'title': title or '', 'content': text, 'created': created, 'updated': updated, 'tags': tags}
            # free memory for this element
            elem.clear()
            # Also clear its parents to keep memory low (if present)
            parent = elem.getparent() if hasattr(elem, 'getparent') else None
            if parent is not None:
                try:
                    while parent is not None:
                        parent.clear()
                        parent = parent.getparent()
                except Exception:
                    pass


def write_csv(notes_iter, out_path, limit=None):
    with open(out_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=['guid', 'title', 'created', 'updated', 'tags', 'content'])
        writer.writeheader()
        n = 0
        for note in notes_iter:
            writer.writerow({
                'guid': note.get('guid'),
                'title': note.get('title'),
                'created': note.get('created'),
                'updated': note.get('updated'),
                'tags': ';'.join(note.get('tags', [])),
                'content': note.get('content')
            })
            n += 1
            if limit and n >= limit:
                break
    return n


def list_notes(notes_iter, limit=None, show_first=3):
    n = 0
    for note in notes_iter:
        n += 1
        print('---')
        print('Title:', note.get('title'))
        print('Created:', note.get('created'))
        print('Tags:', ','.join(note.get('tags', [])))
        snippet = note.get('content', '')[:400].replace('\n', '\n')
        print(snippet)
        if show_first:
            show_first -= 1
        if limit and n >= limit:
            break
    print(f'Printed {n} notes')
    return n


def find_notes_matching(notes_iter, query, limit=None):
    q = query.lower()
    n = 0
    for note in notes_iter:
        text = (note.get('title', '') + '\n' + note.get('content', '')).lower()
        if q in text:
            n += 1
            yield note
            if limit and n >= limit:
                break


def main(argv=None):
    p = argparse.ArgumentParser()
    p.add_argument('--enex', required=True, help='Path to ENEX export file')
    p.add_argument('--list', action='store_true', help='Print notes (titles + snippet)')
    p.add_argument('--to-csv', help='Write notes to CSV')
    p.add_argument('--limit', type=int, help='Limit number of notes to process')
    p.add_argument('--query', help='Filter notes by keyword (title or content)')
    p.add_argument('--show-first', type=int, default=3, help='Number of notes to fully show when listing')
    args = p.parse_args(argv)

    path = args.enex

    if args.query:
        notes_iter = iter_notes_from_enex(path)
        matched = find_notes_matching(notes_iter, args.query, limit=args.limit)
        if args.to_csv:
            cnt = write_csv(matched, args.to_csv, limit=args.limit)
            print(f'Wrote {cnt} matching notes to {args.to_csv}')
            return
        else:
            cnt = list_notes(matched, limit=args.limit, show_first=args.show_first)
            return

    # no query
    notes_iter = iter_notes_from_enex(path)
    if args.to_csv:
        cnt = write_csv(notes_iter, args.to_csv, limit=args.limit)
        print(f'Wrote {cnt} notes to {args.to_csv}')
        return
    if args.list:
        cnt = list_notes(notes_iter, limit=args.limit, show_first=args.show_first)
        return
    print('No action specified. Use --list or --to-csv or --query')


if __name__ == '__main__':
    main()
