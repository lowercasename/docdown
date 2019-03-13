# DocDown

An Electron menu bar application which takes Markdown files, filters them through a Zotero bibliography file, a CSL file, and a reference .docx file, and exports a Word document with embedded citations and styles.

DocDown is essentially a wrapper for the process elaborated in [this blog post](https://raphaelkabo.com/blog/posts/markdown-to-word/).

It's ideal if you're already using Markdown and Zotero or get excited about tweaking Word styles, and it's definitely overkill if you just need to convert some Markdown files into some Word files - there are much better utilities out there to do that.

## Requirements

DocDown is a cross-platform app, but has only been tested on macOS - chances are it won't work properly on Windows or Linux.

For DocDown to work, you need to supply:

- A Zotero .bib file (instructions to create one are in the blog post linked above)
- A CSL file (ditto - they all live [here](https://www.zotero.org/styles))
- A reference .docx file (an example is available from the blog post)

The good news is that DocDown comes bundled with a few common CSL files and a few simple Word reference files, so you only need to supply your own .bib file.

You can _optionally_ supply your own, locally installed, copy of Pandoc (at least version 2.0) and pandoc-citeproc, but DocDown comes with bundled binaries of both.

## Installing

A MacOS binary is available from the [releases section in this repository](https://github.com/lowercasename/docdown/releases).

## Building from source

Download this repository onto your computer and go into it:

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
