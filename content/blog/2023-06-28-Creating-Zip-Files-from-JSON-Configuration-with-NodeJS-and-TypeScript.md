---
title: Creating Zip Files from JSON Configuration with Node.js and TypeScript
date: 2023-07-03T01:25:00-04:00
lastmod: 2026-08-01
reviewed_at: 2026-08-01
author: Yoonsoo Park
description: "How to programmatically create ZIP archives from JSON configurations using Node.js and TypeScript."
categories:
  - TypeScript
tags:
  - TypeScript
  - JavaScript
  - Node.js
---

## Trust boundaries and archive paths

do not use this example with untrusted JSON. Constrain every resolved input to an approved root, reject missing files and symbolic-link escapes, generate relative archive entry names, use a unique output path, and await both archive and output-stream failures. The original synchronous sample is suitable only for small, trusted local input after those controls are added.


In this article, we'll explore a practical use case involving JSON parsing and file operations in Node.js and TypeScript. Specifically, we'll write a script to read a JSON configuration file, extract files and directories specified therein, and zip them into a single file.

## Prerequisites

Before we get started, make sure you have Node.js and TypeScript installed on your system. Also, you will need the `fs`, `path` and `archiver` libraries. If you haven't installed the `archiver` library yet, you can add it to your project using npm:

```shell
npm install archiver
```

## The Code

Let's look at the TypeScript script.

```typescript
import * as fs from 'fs';
import * as path from 'path';
import * as archiver from 'archiver';

function getAllFiles(root: string, dirPath: string, arrayOfFiles: string[] = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach(function(file) {
    const candidate = path.join(dirPath, file);
    const stat = fs.lstatSync(candidate);
    if (stat.isSymbolicLink()) {
      throw new Error(`Symbolic links are not allowed: ${candidate}`);
    }
    if (stat.isDirectory()) {
      arrayOfFiles = getAllFiles(root, candidate, arrayOfFiles);
    } else {
      arrayOfFiles.push(candidate);
    }
  });

  return arrayOfFiles;
}

function resolveInside(root: string, input: string): string {
  const resolved = path.resolve(root, input);
  const relative = path.relative(root, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Path escapes the approved root: ${input}`);
  }
  return resolved;
}

async function main() {
  const approvedRoot = path.resolve("input-files");
  const rawData = fs.readFileSync('input.json');
  const jsonData: unknown = JSON.parse(rawData.toString());

  if (
    typeof jsonData !== "object" ||
    jsonData === null ||
    !("configuration" in jsonData) ||
    typeof jsonData.configuration !== "object" ||
    jsonData.configuration === null
  ) {
    throw new Error("Invalid configuration object");
  }

  const output = fs.createWriteStream('output.zip');
  const archive = archiver('zip', {
    zlib: { level: 9 } // Sets the compression level.
  });

  output.on('close', () => console.log(archive.pointer() + ' total bytes'));
  archive.on('error', (err: any) => { throw err; });
  archive.pipe(output);

  for (const entries of Object.values(jsonData.configuration)) {
    if (!Array.isArray(entries) || !entries.every(value => typeof value === "string")) {
      throw new Error("Every configuration value must be an array of paths");
    }
    for (const configuredPath of entries) {
      const fileOrFolder = resolveInside(approvedRoot, configuredPath);
      const stat = fs.lstatSync(fileOrFolder);
      if (stat.isSymbolicLink()) throw new Error(`Symbolic links are not allowed: ${configuredPath}`);
      const isDirectory = stat.isDirectory();

      if (isDirectory) {
        const files = getAllFiles(approvedRoot, fileOrFolder);

        for(const file of files) {
          const filePath = path.resolve(file);
          archive.append(fs.createReadStream(filePath), {
            name: path.relative(approvedRoot, filePath),
          });
        }
      } else {
        archive.append(fs.createReadStream(fileOrFolder), {
          name: path.relative(approvedRoot, fileOrFolder),
        });
      }
    }
  }

  await archive.finalize();
}

main().catch(console.error);
```

## How it works

The script parses JSON as `unknown` and validates the expected object and path-array shape before using it. Each configured path is resolved relative to `input-files`; `resolveInside` rejects traversal outside that root.

It then creates a write stream for the output zip file and sets up the archiver to zip files.

```typescript
const output = fs.createWriteStream('output.zip');
const archive = archiver('zip', {
  zlib: { level: 9 } // Sets the compression level.
});

output.on('close', () => console.log(archive.pointer() + ' total bytes'));
archive.on('error',

(err: any) => { throw err; });
archive.pipe(output);
```

The traversal uses `lstat` and rejects symbolic links. Archive entry names come from `path.relative(approvedRoot, filePath)`, so they do not expose absolute host paths. The synchronous directory calls keep this local example compact; a service should use asynchronous traversal with bounded concurrency.

Once all files have been processed, it finalizes the archive, effectively creating the zip file.

```typescript
await archive.finalize();
```

Also listen for errors from both the archive and output streams in production, create the destination atomically, and apply file-count and size limits before accepting untrusted workloads.

## Conclusion

Node.js can automate archive creation, but filesystem input needs an explicit trust boundary. Before using this pattern outside a controlled local script, validate roots and entry names, handle stream failures, and test extraction with representative nested paths.

Remember to handle file and directory paths carefully and ensure that your script has appropriate permissions to read and write where necessary.
