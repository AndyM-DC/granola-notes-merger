import {
    App,
    Plugin,
    PluginSettingTab,
    Setting,
    TFile,
    Notice,
    Modal,
    FuzzySuggestModal
} from 'obsidian';

interface GranolaMergerSettings {
    defaultAction: 'menu' | 'copy' | 'save';
    separatorTemplate: string;
    filenameSuffix: string;
    autoOpenCombined: boolean;
}

const DEFAULT_SETTINGS: GranolaMergerSettings = {
    defaultAction: 'menu',
    separatorTemplate: '{{notes}}\n\n---\n# Transcript\n\n{{transcript}}',
    filenameSuffix: ' (Combined)',
    autoOpenCombined: true
};

/**
 * Extracts a readable message from a caught value of unknown type.
 */
function getErrorMessage(e: unknown): string {
    return e instanceof Error ? e.message : String(e);
}

export default class GranolaMergerPlugin extends Plugin {
    settings!: GranolaMergerSettings;

    async onload() {
        await this.loadSettings();

        // Add Ribbon Icon for quick UI trigger
        this.addRibbonIcon('document-merge', 'Merge Notes and Transcript', (_evt: MouseEvent) => {
            const activeFile = this.app.workspace.getActiveFile();
            if (activeFile) {
                const transcriptFile = this.resolveTranscriptFile(activeFile);
                new MergerMenuModal(this.app, this, activeFile, transcriptFile).open();
            } else {
                new Notice('Please open a meeting note first.');
            }
        });

        // Command 1: Open Interactive Merger Menu
        this.addCommand({
            id: 'open-merger-menu',
            name: 'Open Interactive Merger Menu',
            checkCallback: (checking: boolean) => {
                const activeFile = this.app.workspace.getActiveFile();
                if (activeFile) {
                    if (!checking) {
                        const transcriptFile = this.resolveTranscriptFile(activeFile);
                        new MergerMenuModal(this.app, this, activeFile, transcriptFile).open();
                    }
                    return true;
                }
                return false;
            }
        });

        // Command 2: Copy Notes and Transcript to Clipboard
        this.addCommand({
            id: 'copy-notes-transcript-clipboard',
            name: 'Copy Notes and Transcript to Clipboard',
            checkCallback: (checking: boolean) => {
                const activeFile = this.app.workspace.getActiveFile();
                if (activeFile) {
                    if (!checking) {
                        const transcriptFile = this.resolveTranscriptFile(activeFile);
                        if (transcriptFile) {
                            void this.copyCombinedToClipboard(activeFile, transcriptFile);
                        } else {
                            new Notice('No transcript found automatically. Please select it.');
                            new TranscriptSelectionModal(this.app, this, activeFile, (selectedFile) => {
                                void this.copyCombinedToClipboard(activeFile, selectedFile);
                            }).open();
                        }
                    }
                    return true;
                }
                return false;
            }
        });

        // Command 3: Create Combined Note
        this.addCommand({
            id: 'create-combined-note',
            name: 'Create Combined Note',
            checkCallback: (checking: boolean) => {
                const activeFile = this.app.workspace.getActiveFile();
                if (activeFile) {
                    if (!checking) {
                        const transcriptFile = this.resolveTranscriptFile(activeFile);
                        if (transcriptFile) {
                            void this.createCombinedNote(activeFile, transcriptFile);
                        } else {
                            new Notice('No transcript found automatically. Please select it.');
                            new TranscriptSelectionModal(this.app, this, activeFile, (selectedFile) => {
                                void this.createCombinedNote(activeFile, selectedFile);
                            }).open();
                        }
                    }
                    return true;
                }
                return false;
            }
        });

        // Register settings tab
        this.addSettingTab(new GranolaMergerSettingTab(this.app, this));
    }

    onunload() {
        // Cleanup if needed
    }

    async loadSettings() {
        const data = (await this.loadData()) as Partial<GranolaMergerSettings> | null;
        this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    /**
     * Resolves the corresponding transcript file for a given active meeting note.
     */
    resolveTranscriptFile(activeFile: TFile): TFile | null {
        const cache = this.app.metadataCache.getFileCache(activeFile);

        // 1. Check YAML frontmatter for any key containing "transcript"
        if (cache?.frontmatter) {
            for (const key of Object.keys(cache.frontmatter)) {
                if (key.toLowerCase().includes('transcript')) {
                    const val: unknown = cache.frontmatter[key];
                    if (typeof val === 'string') {
                        // Clean wikilink formats like [[File]] or [[File|Display]]
                        const cleanVal = val.replace(/^\[\[/, '').replace(/\]\]$/, '').split('|')[0].trim();
                        const file = this.app.metadataCache.getFirstLinkpathDest(cleanVal, activeFile.path);
                        if (file) return file;
                    }
                }
            }
        }

        // 2. Check inline links/embeds in the document that contain "transcript"
        const allLinks = [...(cache?.links || []), ...(cache?.embeds || [])];
        for (const link of allLinks) {
            const targetPath = link.link;
            const displayText = link.displayText || '';
            if (targetPath.toLowerCase().includes('transcript') || displayText.toLowerCase().includes('transcript')) {
                const file = this.app.metadataCache.getFirstLinkpathDest(targetPath, activeFile.path);
                if (file) return file;
            }
        }

        // 3. Fallback: Search the entire vault for files sharing a prefix or suffix name
        const activeBaseName = activeFile.basename;
        const files = this.app.vault.getMarkdownFiles();

        const candidates = files.filter(f => {
            if (f.path === activeFile.path) return false;
            const name = f.basename.toLowerCase();
            const base = activeBaseName.toLowerCase();
            return (
                name.includes('transcript') &&
                (name.includes(base) || base.includes(name.replace('transcript', '').trim()))
            );
        });

        if (candidates.length > 0) {
            return candidates[0];
        }

        return null;
    }

    /**
     * Helper to merge notes and transcript using separator template.
     */
    mergeContent(notesContent: string, transcriptContent: string): string {
        return this.settings.separatorTemplate
            .replace('{{notes}}', notesContent)
            .replace('{{transcript}}', transcriptContent);
    }

    /**
     * Action A: Merge and copy combined content to clipboard.
     */
    async copyCombinedToClipboard(notesFile: TFile, transcriptFile: TFile) {
        try {
            const notesText = await this.app.vault.cachedRead(notesFile);
            const transcriptText = await this.app.vault.cachedRead(transcriptFile);

            const merged = this.mergeContent(notesText, transcriptText);

            await navigator.clipboard.writeText(merged);
            new Notice('Notes and Transcript merged and copied to clipboard!');
        } catch (e: unknown) {
            new Notice('Failed to copy to clipboard: ' + getErrorMessage(e));
            console.error(e);
        }
    }

    /**
     * Action B: Merge and create a new unified note file.
     */
    async createCombinedNote(notesFile: TFile, transcriptFile: TFile) {
        try {
            const notesText = await this.app.vault.cachedRead(notesFile);
            const transcriptText = await this.app.vault.cachedRead(transcriptFile);

            const mergedContent = this.mergeContent(notesText, transcriptText);

            const suffix = this.settings.filenameSuffix || ' (Combined)';
            const parentPath = notesFile.parent ? notesFile.parent.path : '';

            let newPath = '';
            if (parentPath === '/' || parentPath === '') {
                newPath = `${notesFile.basename}${suffix}.md`;
            } else {
                newPath = `${parentPath}/${notesFile.basename}${suffix}.md`;
            }

            let targetFile = this.app.vault.getAbstractFileByPath(newPath);
            if (targetFile instanceof TFile) {
                await this.app.vault.modify(targetFile, mergedContent);
            } else {
                targetFile = await this.app.vault.create(newPath, mergedContent);
            }

            if (targetFile instanceof TFile) {
                new Notice(`Combined note created: ${targetFile.name}`);
                if (this.settings.autoOpenCombined) {
                    const leaf = this.app.workspace.getLeaf(true);
                    await leaf.openFile(targetFile);
                }
            }
        } catch (e: unknown) {
            new Notice('Failed to create combined note: ' + getErrorMessage(e));
            console.error(e);
        }
    }
}

/**
 * Fuzzy Search Modal for selecting a transcript file when auto-detection fails or manual change is requested.
 */
class TranscriptSelectionModal extends FuzzySuggestModal<TFile> {
    plugin: GranolaMergerPlugin;
    activeFile: TFile;
    onSelect: (file: TFile) => void;

    constructor(app: App, plugin: GranolaMergerPlugin, activeFile: TFile, onSelect: (file: TFile) => void) {
        super(app);
        this.plugin = plugin;
        this.activeFile = activeFile;
        this.onSelect = onSelect;
        this.setPlaceholder("Search and select a transcript file...");
    }

    getItems(): TFile[] {
        const files = this.app.vault.getMarkdownFiles();
        const activeBase = this.activeFile.basename.toLowerCase();

        // Sort files to put candidates first
        return files
            .filter(f => f.path !== this.activeFile.path)
            .sort((a, b) => {
                const nameA = a.basename.toLowerCase();
                const nameB = b.basename.toLowerCase();

                let scoreA = 0;
                let scoreB = 0;

                if (nameA.includes('transcript')) scoreA += 5;
                if (nameB.includes('transcript')) scoreB += 5;

                if (nameA.includes(activeBase) || activeBase.includes(nameA.replace('transcript', '').trim())) scoreA += 10;
                if (nameB.includes(activeBase) || activeBase.includes(nameB.replace('transcript', '').trim())) scoreB += 10;

                return scoreB - scoreA;
            });
    }

    getItemText(item: TFile): string {
        return `${item.basename} (${item.path})`;
    }

    onChooseItem(item: TFile, _evt: MouseEvent | KeyboardEvent): void {
        this.onSelect(item);
    }
}

/**
 * Custom Modal interface for interactive notes merging.
 */
class MergerMenuModal extends Modal {
    plugin: GranolaMergerPlugin;
    activeFile: TFile;
    transcriptFile: TFile | null;

    constructor(app: App, plugin: GranolaMergerPlugin, activeFile: TFile, transcriptFile: TFile | null) {
        super(app);
        this.plugin = plugin;
        this.activeFile = activeFile;
        this.transcriptFile = transcriptFile;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("granola-merger-modal");

        // Header
        const headerEl = contentEl.createDiv({ cls: "granola-merger-header" });
        headerEl.createEl("h2", { text: "Merge Notes and Transcript", cls: "granola-merger-title" });
        headerEl.createDiv({ text: "Quickly combine meeting notes and transcripts for easy pasting or archiving.", cls: "granola-merger-subtitle" });

        // Status Container
        const statusContainer = contentEl.createDiv({ cls: "granola-merger-status-container" });

        // Card 1: Notes
        const notesCard = statusContainer.createDiv({ cls: "granola-merger-card" });
        notesCard.createDiv({ text: "Active Note File", cls: "granola-merger-card-title" });
        notesCard.createDiv({ text: this.activeFile.basename + ".md", cls: "granola-merger-card-value" });

        // Card 2: Transcript
        const transcriptCard = statusContainer.createDiv({ cls: "granola-merger-card" });
        transcriptCard.createDiv({ text: "Linked Transcript File", cls: "granola-merger-card-title" });
        const transcriptValEl = transcriptCard.createDiv({ cls: "granola-merger-card-value" });
        if (this.transcriptFile) {
            transcriptValEl.setText(this.transcriptFile.basename + ".md");
        } else {
            transcriptValEl.createSpan({ text: "No transcript file detected automatically.", cls: "granola-merger-card-error" });
        }

        // Action Grid
        const actionGrid = contentEl.createDiv({ cls: "granola-merger-action-grid" });

        // Copy Button
        const copyBtn = actionGrid.createEl("button", {
            cls: "granola-merger-btn granola-merger-btn-primary",
            text: "Copy to Clipboard"
        });
        if (!this.transcriptFile) {
            copyBtn.disabled = true;
            copyBtn.addClass("granola-merger-btn-disabled");
        } else {
            copyBtn.addEventListener("click", () => {
                if (this.transcriptFile) {
                    void this.plugin.copyCombinedToClipboard(this.activeFile, this.transcriptFile).then(() => {
                        this.close();
                    });
                }
            });
        }

        // Save Button
        const saveBtn = actionGrid.createEl("button", {
            cls: "granola-merger-btn granola-merger-btn-primary",
            text: "Create Combined Note"
        });
        if (!this.transcriptFile) {
            saveBtn.disabled = true;
            saveBtn.addClass("granola-merger-btn-disabled");
        } else {
            saveBtn.addEventListener("click", () => {
                if (this.transcriptFile) {
                    void this.plugin.createCombinedNote(this.activeFile, this.transcriptFile).then(() => {
                        this.close();
                    });
                }
            });
        }

        // Change Transcript Button
        const changeBtn = actionGrid.createEl("button", {
            cls: "granola-merger-btn granola-merger-btn-secondary granola-merger-btn-full",
            text: "Select / Change Transcript File"
        });
        changeBtn.addEventListener("click", () => {
            this.close();
            new TranscriptSelectionModal(this.app, this.plugin, this.activeFile, (selectedFile) => {
                new MergerMenuModal(this.app, this.plugin, this.activeFile, selectedFile).open();
            }).open();
        });

        // Live Preview Box
        const previewHeader = contentEl.createDiv({ cls: "granola-merger-preview-header" });
        previewHeader.createSpan({ text: "Live Preview of Combined Markdown" });
        const previewBox = contentEl.createDiv({ cls: "granola-merger-preview-box", text: "Loading preview..." });

        void this.loadPreview(previewBox);
    }

    async loadPreview(previewBox: HTMLElement) {
        try {
            const notesText = await this.app.vault.cachedRead(this.activeFile);
            let transcriptText = "";
            if (this.transcriptFile) {
                transcriptText = await this.app.vault.cachedRead(this.transcriptFile);
            } else {
                transcriptText = "_[No transcript content. Please select a transcript file.]_";
            }

            const merged = this.plugin.mergeContent(notesText, transcriptText);
            previewBox.setText(merged);
        } catch (e: unknown) {
            previewBox.setText("Error loading preview: " + getErrorMessage(e));
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

/**
 * Plugin settings page.
 */
class GranolaMergerSettingTab extends PluginSettingTab {
    plugin: GranolaMergerPlugin;

    constructor(app: App, plugin: GranolaMergerPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        new Setting(containerEl)
            .setName("Granola Notes and Transcript Merger settings")
            .setHeading();

        new Setting(containerEl)
            .setName("Default Action")
            .setDesc("Choose what happens when you run the merger command directly on an active note.")
            .addDropdown(dropdown => dropdown
                .addOption("menu", "Show Interactive Merger Menu")
                .addOption("copy", "Directly Copy Combined to Clipboard")
                .addOption("save", "Directly Create Combined Note")
                .setValue(this.plugin.settings.defaultAction)
                .onChange(async (value: string) => {
                    this.plugin.settings.defaultAction = value as 'menu' | 'copy' | 'save';
                    await this.plugin.saveSettings();
                })
            );

        new Setting(containerEl)
            .setName("Combined Note Filename Suffix")
            .setDesc("The suffix added to the note name when creating a combined note file.")
            .addText(text => text
                .setPlaceholder(" (Combined)")
                .setValue(this.plugin.settings.filenameSuffix)
                .onChange(async (value) => {
                    this.plugin.settings.filenameSuffix = value;
                    await this.plugin.saveSettings();
                })
            );

        new Setting(containerEl)
            .setName("Auto-Open Combined Note")
            .setDesc("Automatically open the newly created combined note file in a new tab.")
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.autoOpenCombined)
                .onChange(async (value) => {
                    this.plugin.settings.autoOpenCombined = value;
                    await this.plugin.saveSettings();
                })
            );

        new Setting(containerEl)
            .setName("Separator and Combination Template")
            .setDesc("Customize the format of the merged document. Use {{notes}} and {{transcript}} as placeholders.")
            .addTextArea(text => text
                .setPlaceholder("{{notes}}\n\n---\n# Transcript\n\n{{transcript}}")
                .setValue(this.plugin.settings.separatorTemplate)
                .onChange(async (value) => {
                    this.plugin.settings.separatorTemplate = value;
                    await this.plugin.saveSettings();
                })
            );
    }
}
