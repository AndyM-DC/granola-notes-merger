# Granola Notes and Transcript Merger

Seamlessly merge and copy/save Granola AI meeting notes and transcripts in your Obsidian vault.

This plugin is designed for users of **Granola AI** who want to keep their synthesized meeting notes and raw transcripts together. It automates finding the matching transcript file, merging them using a custom template, and either copying the combined text to the clipboard or creating a unified file inside Obsidian.

## ✨ Features

- 🔍 **Automatic Transcript Discovery**: Automatically matches meeting notes to transcripts by scanning frontmatter properties, document wikilinks, embedded notes, or by performing vault-wide file prefix lookups.
- 🎨 **Visual Dashboard Modal**: A modern, interactive pop-up featuring an asynchronous live preview of your merged note, quick action buttons, and direct clipboards copy/save commands.
- 📋 **One-Click Clipboard Copying**: Concatenates notes and transcripts and copies them straight to your clipboard, perfect for pasting into Word, Slack, or email.
- ✍️ **Unified Archive Notes**: Creates unified `.md` files in your vault (e.g., `Meeting Title (Combined).md`) and opens them immediately in a new tab.
- 🚀 **Fuzzy Finder Fallback**: If a transcript cannot be resolved automatically, a searchable fuzzy suggest picker opens to let you select the target file.
- ⚙️ **Customizable Templates**: Fully customizable divider templates inside the settings menu.

## 🛠️ Usage

Once installed, there are three main ways to trigger the plugin:

1. **Ribbon Icon**: Click the document-merge icon (overlapping sheets) on the left sidebar to open the interactive dashboard.
2. **Command Palette**: Press `Ctrl + P` (or `Cmd + P` on Mac) and search for:
   - `Granola Notes and Transcript Merger: Open Interactive Merger Menu`
   - `Granola Notes and Transcript Merger: Copy Notes and Transcript to Clipboard`
   - `Granola Notes and Transcript Merger: Create Combined Note`
3. **Fully Automated Mode**: Go to Settings > Granola Notes and Transcript Merger, set the **Default Action** to *Directly Copy* or *Directly Create Note*, and map it to a hotkey for single-keystroke execution.

## 🚀 Installation

### Community Directory (Recommended)
Search for **Granola Notes and Transcript Merger** in Obsidian's **Settings > Community Plugins > Browse** and click install.

### Manual Installation
1. Go to the [Releases](https://github.com/AndyM-DC/granola-notes-merger/releases) page and download `main.js`, `manifest.json`, and `styles.css`.
2. Move these three files to your vault's plugin directory: `<vault>/.obsidian/plugins/granola-notes-merger/`.
3. Reload plugins and enable it in Obsidian settings.

## 📄 License

This project is licensed under the [MIT License](LICENSE).
