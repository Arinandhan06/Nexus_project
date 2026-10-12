import React, { useState } from "react";
import Editor from "@monaco-editor/react";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

export default function CodeEditor({
  language = "python",
  value = "",
  onChange,
  readOnly = false,
  height = "100%",
  className = "",
}) {
  const [fontSize, setFontSize] = useState(14);

  const handleEditorWillMount = (monaco) => {
    // Define the custom "nexus-dark" sci-fi theme
    monaco.editor.defineTheme("nexus-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "64748b", fontStyle: "italic" },
        { token: "keyword", foreground: "22d3ee", fontStyle: "bold" },
        { token: "identifier", foreground: "f1f5f9" },
        { token: "string", foreground: "34d399" },
        { token: "number", foreground: "f59e0b" },
        { token: "delimiter", foreground: "94a3b8" },
        { token: "type", foreground: "38bdf8" },
      ],
      colors: {
        "editor.background": "#030712",
        "editor.foreground": "#f1f5f9",
        "editorCursor.foreground": "#22d3ee",
        "editor.lineHighlightBackground": "#0f172a80",
        "editorLineNumber.foreground": "#475569",
        "editorLineNumber.activeForeground": "#22d3ee",
        "editor.selectionBackground": "#22d3ee33",
        "editor.inactiveSelectionBackground": "#22d3ee1a",
      },
    });
  };

  const handleEditorDidMount = (editor) => {
    // Enable Shift+Alt+F format shortcut
    editor.addCommand(
      // KeyMod.Shift | KeyMod.Alt | KeyCode.KeyF
      1024 | 512 | 36,
      () => {
        const action = editor.getAction("editor.action.formatDocument");
        if (action) action.run();
      }
    );
  };

  return (
    <div className={`relative flex flex-col w-full h-full bg-[#030712] overflow-hidden ${className}`}>
      {/* Top micro-bar for font-size controls */}
      <div className="h-7 px-3 bg-[#080d1a] border-b border-zinc-800/80 flex items-center justify-between text-xs text-zinc-400 select-none shrink-0 font-mono">
        <span className="text-[11px] uppercase tracking-wider text-cyan-400/80">
          {language} // nexus-dark
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-zinc-500">Font: {fontSize}px</span>
          <button
            type="button"
            onClick={() => setFontSize((s) => Math.max(11, s - 1))}
            className="p-1 hover:text-cyan-400 transition-colors"
            title="Decrease font size"
          >
            <ZoomOut size={12} />
          </button>
          <button
            type="button"
            onClick={() => setFontSize((s) => Math.min(22, s + 1))}
            className="p-1 hover:text-cyan-400 transition-colors"
            title="Increase font size"
          >
            <ZoomIn size={12} />
          </button>
          <button
            type="button"
            onClick={() => setFontSize(14)}
            className="p-1 hover:text-cyan-400 transition-colors"
            title="Reset font size"
          >
            <RotateCcw size={11} />
          </button>
        </div>
      </div>

      {/* Monaco Editor Container */}
      <div className="flex-1 w-full h-full relative min-h-0">
        <Editor
          height={height}
          width="100%"
          language={language}
          theme="nexus-dark"
          value={value}
          onChange={onChange}
          beforeMount={handleEditorWillMount}
          onMount={handleEditorDidMount}
          options={{
            readOnly,
            minimap: { enabled: false },
            fontSize,
            fontFamily: "'Fira Code', 'JetBrains Mono', Consolas, monospace",
            fontLigatures: true,
            scrollBeyondLastLine: false,
            padding: { top: 12, bottom: 12 },
            automaticLayout: true,
            tabSize: 4,
            cursorBlinking: "smooth",
            cursorSmoothCaretAnimation: "on",
            renderLineHighlight: "all",
            quickSuggestions: { other: true, comments: false, strings: true },
            formatOnPaste: true,
            formatOnType: true,
          }}
          loading={
            <div className="flex items-center justify-center h-full w-full text-cyan-400 font-mono text-xs gap-2 bg-[#030712]">
              <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
              <span>Loading Monaco Kernel...</span>
            </div>
          }
        />
      </div>
    </div>
  );
}
