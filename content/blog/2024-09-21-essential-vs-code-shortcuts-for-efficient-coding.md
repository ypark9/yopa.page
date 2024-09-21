---
title: Essential VS Code Shortcuts for Efficient Coding
date: 2024-09-21
author: Yoonsoo Park
description: Boost your productivity with these essential VS Code shortcuts that every developer should know.
categories:
  - Development Tools
  - Productivity
tags:
  - VS Code
  - Shortcuts
  - Coding Tips
---

> Boost your productivity with these cool VS Code shortcuts that every developer should know.

[Visual Studio Code Keyboard Shortcuts Reference](https://code.visualstudio.com/docs/getstarted/keybindings)

As developers, we're always obsessed with ways to streamline our workflow and boost productivity. Visual Studio Code (VS Code) offers numerous shortcuts to help us code more efficiently. In this article, we'll explore some cool VS Code shortcuts that can significantly improve your coding experience.

## Quick Reference Table

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

By mastering these shortcuts, you'll be able to navigate, edit, and manage your code more efficiently in VS Code. Remember, this allows you to work smarter but also other devs see you as a "pro". wink wink.

Cheers! 🍺
