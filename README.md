# DocDown

An Electron menu bar application which takes Markdown files, filters them through a Zotero bibliography file, a CSL file, and a reference .docx file, and exports a Word document with embedded citations and styles.

It's ideal if you're already using Markdown and Zotero or get excited about tweaking Word styles, and it's definitely overkill if you just need to convert some Markdown files into some Word files - there are much better utilities out there to do that.

## Requirements

**For a detailed guide to setting up your system to work with DocDown, [head to the wiki](https://github.com/lowercasename/docdown/wiki/Initial-setup).**

DocDown is a cross-platform app, but has only been tested on macOS - chances are it won't work properly on Windows or Linux.

DocDown requires:

- Zotero, with the [Better BibTeX plugin](https://github.com/retorquere/zotero-better-bibtex) installed
- A Zotero Better-CSL-json (recommended), Better-CSL-yaml (recommended), or .bib file, (you will need Better BibTeX to generate these; instructions to set one up are in the blog post linked above)

DocDown comes bundled with a few common CSL files and a few simple Word reference files, but you can optionally supply:

- A CSL file (refer to the blog post for help - they all live [here](https://www.zotero.org/styles))
- Your own reference .docx file (an example is available to download from the blog post, and there are instructions there for styling your own)

Even _more_ optionally, you can supply:

- Your own, locally installed, copy of Pandoc (at least version 2.0) and pandoc-citeproc, but DocDown comes with bundled binaries of both.

## Installing

See [the wiki](https://github.com/lowercasename/docdown/wiki/Installation) for installation instructions. 

## Building from source

Download this repository onto your computer and switch to the resulting directory:

```
git clone git@github.com:lowercasename/docdown.git
cd docdown/
```

Install the dependencies:

```
npm install
```

Package the app with electron-packager:

```
npm run dist
```
