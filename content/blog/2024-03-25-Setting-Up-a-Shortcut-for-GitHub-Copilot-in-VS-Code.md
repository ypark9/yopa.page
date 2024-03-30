---
title: Setting Up a Shortcut for GitHub Copilot in VS Code
title-with-dash: Setting-Up-a-Shortcut-for-GitHub-Copilot-in-VS-Code
date: 2024-03-25
author: Yoonsoo Park
description: "Learn how to configure a keyboard shortcut in VS Code to quickly access the GitHub Copilot chat panel."
categories:
  - Programming
  - VS Code
tags:
  - VS Code
  - GitHub Copilot
  - Keyboard Shortcuts
---

GitHub Copilot has become an indispensable tool for many developers, offering AI-powered code suggestions that streamline the coding process. I believe it is the most advantaced AI code assitant at this point. However, constantly navigating through menus to access Copilot can disrupt your workflow. This tutorial will guide you through setting up a keyboard shortcut in Visual Studio Code (VS Code) to quickly open the GitHub Copilot chat panel.

### Step-by-Step Guide to Setting Up Your Shortcut

1. **Open the Command Palette in VS Code**  
   Start by opening the Command Palette, which is the hub for accessing various commands in VS Code. You can open it by pressing `Cmd + Shift + P` on your keyboard.

2. **Access Keyboard Shortcuts File**  
   In the Command Palette, type `keyboard shortcuts json`. This will bring up a list of options related to keyboard shortcuts. Select `Preference: Open Keyboard Shortcuts (JSON)` from the list. This action opens the `keybindings.json` file where you can define custom keyboard shortcuts.

3. **Edit the JSON File**  
   In the `keybindings.json` file, you will define the shortcut for the GitHub Copilot chat panel. Insert the following code snippet:

   ```json
   {
       "key": "ctrl+alt+cmd+c",
       "command": "workbench.panel.chat.view.copilot.focus",
       "when": "editorFocus"
   },
   {
       // Move focus back to the Editor
       "key": "ctrl+alt+cmd+c",
       "command": "workbench.action.focusActiveEditorGroup",
       "when": "!editorFocus"
   }
   ```

   This configuration sets up `Ctrl + Alt + Command + C` as the shortcut to toggle the GitHub Copilot chat panel. The first part focuses on the Copilot chat panel when the editor is focused, and the second part returns focus to the editor if the Copilot panel is focused.

4. **Save and Test Your Shortcut**  
   After adding the code, save your `keybindings.json` file. Test the new shortcut by pressing `Ctrl + Alt + Command + C` in the editor. If everything is set up correctly, you should be able to toggle the GitHub Copilot chat panel with this shortcut.

### Wrapping it up 👏

By following these simple steps, you've successfully configured a custom keyboard shortcut in VS Code to enhance your productivity with GitHub Copilot. This shortcut allows you to swiftly access the Copilot chat panel without navigating through the interface, letting you focus more on coding. Happy coding, and enjoy the efficiency boost!

Cheers! 🍺
