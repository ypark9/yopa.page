---
title: Useful VS Code Shortcuts for Everyday Editing
date: 2024-09-21
lastmod: 2026-08-01
reviewed_at: 2026-08-01
author: Yoonsoo Park
description: A practical reference for common VS Code navigation, editing, and search shortcuts.
categories:
  - Development Tools
  - Productivity
tags:
  - VS Code
  - IDE
  - CLI
---

This reference lists common bindings; verify each one in the Keyboard Shortcuts editor for your operating system and keymap.

[Visual Studio Code Keyboard Shortcuts Reference](https://code.visualstudio.com/docs/getstarted/keybindings)

As developers, we're always obsessed with ways to streamline our workflow and boost productivity. Visual Studio Code (VS Code) offers numerous shortcuts to help us code more efficiently. In this article, we'll explore some cool VS Code shortcuts that can significantly improve your coding experience.

## Quick Reference Table

Bindings vary by operating system, keymap extension, and user configuration. Use VS Code's Keyboard Shortcuts editor as the source of truth and inspect conflicts before changing a binding.

| Function                              | Mac                             | Windows/Linux                  |
| ------------------------------------- | ------------------------------- | ------------------------------ |
| Jump to Matching Bracket              | Cmd + Shift + \                 | Ctrl + Shift + \               |
| Scroll Without Moving Cursor          | Ctrl + Fn + Up/Down Arrow       | Ctrl + Up/Down Arrow           |
| Show/Hide Terminal                    | Cmd + J                         | Ctrl + J                       |
| Expand/Shrink Selection               | Ctrl + Shift + Left/Right Arrow | Shift + Alt + Left/Right Arrow |
| Change Tab                            | Cmd + Opt + Left/Right Arrow    | Ctrl + PgUp/PgDn               |
| Find Symbol                           | Cmd + T                         | Ctrl + T                       |
| Multi-Cursor (select next occurrence) | Cmd + D                         | Ctrl + D                       |
| Multi-Cursor (add above/below)        | Cmd + Option + Up/Down Arrow    | Ctrl + Alt + Up/Down Arrow     |
| Quick File Navigation                 | Cmd + P                         | Ctrl + P                       |
| Toggle Line Comment                   | Cmd + /                         | Ctrl + /                       |
| Rename Symbol                         | F2                              | F2                             |
| Open Command Palette                  | Cmd + Shift + P                 | Ctrl + Shift + P               |

## Detailed Explanations

1. **Jump to Matching Bracket**

   - Mac: Cmd + Shift + \
   - Windows/Linux: Ctrl + Shift + \

   Quickly navigate between opening and closing brackets in nested code structures.

2. **Jump Multiple Lines Vertically** (Custom shortcut)

   - Requires configuration in `keybindings.json`:

   ```json
   {
       "key": "ctrl+up",
       "command": "cursorMove",
       "args": {
           "to": "up",
           "by": "line",
           "value": 10
       },
       "when": "editorTextFocus"
   },
   {
       "key": "ctrl+down",
       "command": "cursorMove",
       "args": {
           "to": "down",
           "by": "line",
           "value": 10
       },
       "when": "editorTextFocus"
   },
   ```

   Move the cursor 10 lines up or down at once for faster navigation in large files.

3. **Scroll Without Moving the Cursor**

   - Mac: Ctrl + Fn + Up Arrow / Down Arrow
   - Windows/Linux: Ctrl + Up Arrow / Down Arrow

   Scroll through your code while keeping your cursor in the same position.

4. **Show/Hide Terminal**

   - Mac: Cmd + J
   - Windows/Linux: Ctrl + J

   Quickly toggle the integrated terminal for running commands.

5. **Expand/Shrink Selection**

   - Mac: Ctrl + Shift + Left Arrow / Right Arrow
   - Windows/Linux: Shift + Alt + Left Arrow / Right Arrow

   Expand or shrink your selection based on code structure.

6. **Change Tab**

   - Mac: Cmd + Opt + Left / Right Arrow
   - Windows/Linux: Ctrl + PgUp / PgDn

   Quickly switch between open tabs in your editor.

7. **Find Symbol**

   - Mac: Cmd + T
   - Windows/Linux: Ctrl + T

   Find classes, functions, or properties anywhere in your current editor session with fuzzy search.

8. **Multi-Cursor Editing**

   - Select next occurrence:
     - Mac: Cmd + D
     - Windows/Linux: Ctrl + D
   - Add cursor above/below:
     - Mac: Cmd + Option + Up Arrow / Down Arrow
     - Windows/Linux: Ctrl + Alt + Up Arrow / Down Arrow

   Edit multiple occurrences of text simultaneously.

9. **Quick File Navigation**

   - Mac: Cmd + P
   - Windows/Linux: Ctrl + P

   Open files in your project by typing part of the file name.

10. **Toggle Line Comment**

    - Mac: Cmd + /
    - Windows/Linux: Ctrl + /

    Quickly comment or uncomment lines of code.

11. **Rename Symbol**

    - Mac/Windows/Linux: F2

    Rename variables, functions, or classes across your entire project.

12. **Open Command Palette**

    - Mac: Cmd + Shift + P
    - Windows/Linux: Ctrl + Shift + P

    Access all of VS Code's commands quickly.

Use the shortcuts that remove friction from repeated work. There is no benefit in memorizing bindings that do not fit the way you edit or that conflict with accessibility needs.
