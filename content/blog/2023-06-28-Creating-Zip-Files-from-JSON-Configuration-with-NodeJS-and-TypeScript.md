---
title: Creating Zip Files from JSON Configuration with Node.js and TypeScript
date: 2023-07-03T01:25:00-04:00
author: Yoonsoo Park
description: ""
categories:
  - TypeScript
tags:
  - zip
---


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

function getAllFiles(dirPath: string, arrayOfFiles: string[] = []) {
  const files = fs.readdirSync(dirPath)

  files.forEach(function(file) {
    if (fs.statSync(dirPath + "/" + file).isDirectory()) {
      arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles)
    } else {
      arrayOfFiles.push(path.join(dirPath, "/", file))
    }
  })

  return arrayOfFiles
}

async function main() {
  const rawData = fs.readFileSync('input.json');
  const jsonData = JSON.parse(rawData.toString());

  if (!jsonData.configuration) {
    console.log('No configuration object found in JSON');
    return;
  }

  const output = fs.createWriteStream('output.zip');
  const archive = archiver('zip', {
    zlib: { level: 9 } // Sets the compression level.
  });

  output.on('close', () => console.log(archive.pointer() + ' total bytes'));
  archive.on('error', (err: any) => { throw err; });
  archive.pipe(output);

  for (const key in jsonData.configuration) {
    for (const fileOrFolder of jsonData.configuration[key]) {
      const isDirectory = fs.lstatSync(fileOrFolder).isDirectory();

      if (isDirectory) {
        const files = getAllFiles(fileOrFolder);

        for(const file of files) {
          const filePath = path.resolve(file);
          const fileDirName = path.dirname(file);
          archive.append(fs.createReadStream(filePath), { name: path.join(fileDirName, path.basename(file)) });
        }
      } else {
        archive.append(fs.createReadStream(fileOrFolder), { name: fileOrFolder });
      }
    }
  }

  await archive.finalize();
}

main().catch(console.error);
```

## How it works

The script begins by reading a JSON file, parsing its contents, and checking for a `configuration` property.

```typescript
const rawData = fs.readFileSync('input.json');
const jsonData = JSON.parse(rawData.toString());

if (!jsonData.configuration) {
  console.log('No configuration object found in JSON');
  return;
}
```

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

Next, the script loops over the keys in the `configuration` object. For each file or folder path, it checks if the path points to a directory. If it does, it retrieves all files under the directory recursively using the `getAllFiles` function.

```typescript
for (const key in jsonData.configuration) {
  for (const fileOrFolder of jsonData.configuration[key]) {
    const isDirectory = fs.lstatSync(fileOrFolder).isDirectory();

    if (isDirectory) {
      const files = getAllFiles(fileOrFolder);

      for(const file of files) {
        const filePath = path.resolve(file);
        const fileDirName = path.dirname(file);
        archive.append(fs.createReadStream(filePath), { name: path.join(fileDirName, path.basename(file)) });
      }
    } else {
      archive.append(fs.createReadStream(fileOrFolder), { name: fileOrFolder });
    }
  }
}
```

Once all files have been processed, it finalizes the archive, effectively creating the zip file.

```typescript
await archive.finalize();
```

And that's it! With this script, you can easily generate zip files based on configurations in a JSON file.

## Conclusion

Node.js and TypeScript offer a powerful platform for handling file operations and processing JSON. The ability to read directories, read and write files, and even create zip archives opens up a world of possibilities for data processing and manipulation. With these tools in your toolkit, you can automate many manual tasks and streamline your data workflows.

Remember to handle file and directory paths carefully and ensure that your script has appropriate permissions to read and write where necessary.

Cheers! 🍺
