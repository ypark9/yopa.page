---
title: To move all items from a subfolder to its parent (top-level) folder in Synology with script
date: 2023-03-23T01:25:00-04:00
author: Yoonsoo Park
description: "Stop moving them manually. Let the script take care of it for you!"
categories:
  - Programming
  - Synology
tags:
  - Script
---

If you have a Synology NAS device and need to move all the files and folders within a sub-directory to the top directory, it can be done quickly with a simple script.

## Creating a New Bash Script File

```console
#!/bin/bash

# Set the target directory to search
rootdir="/volume1/target"

# Find all files in the root directory and its subdirectories
find "$rootdir" -type f | while read filename; do
  # Get the parent directory of the file
  parent_dir=$(dirname "$filename")
  # Move the file to the parent directory
  mv "$filename" "$rootdir"
done
```

P.S. Are you still moving files around like they're pieces on a chessboard? Come on, **time is precious!** Let's automate this thing and save some brainpower for the tough coding challenges. 😉 Cheers. 🍺
