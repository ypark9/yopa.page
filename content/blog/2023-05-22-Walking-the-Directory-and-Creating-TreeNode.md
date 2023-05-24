---
title: Walking the Directory and Creating a TreeNode
date: 2023-05-22T01:25:00-04:00
author: Yoonsoo Park
description: "Walking the Directory and Creating a TreeNode in Node.js"
categories:
  - Node.js
tags:
  - Directory Traversal
---


# Walking the Directory and Creating a TreeNode in Node.js

In this article, we will be exploring how to navigate or walk through a file directory in Node.js, creating a `TreeNode` for each file or subdirectory we encounter. This will involve using Node's built-in `fs` (file system) and `path` modules, as well as the `crypto` module for hashing file contents. 

First, let's begin by creating an `interface` for our file metadata:

```typescript
interface FileMetadata {
    path: string;
    isDirectory: boolean;
    hash?: string;
}
```

Here, our `FileMetadata` interface defines three properties: `path` (the file or directory path), `isDirectory` (a boolean indicating if the path is a directory), and `hash` (a string representing a file hash, which will be optional since directories won't have a hash).

Next, we create a `TreeNode` class:

```typescript
class TreeNode {
    metadata: FileMetadata;
    children: TreeNode[];

    constructor(metadata: FileMetadata, children: TreeNode[] = []) {
        this.metadata = metadata;
        this.children = children;
    }

    print(level: number = 0): void {
        console.log(' '.repeat(level * 2) + (this.metadata.isDirectory ? 'Dir: ' : 'File: ') + this.metadata.path);
        for (let child of this.children) {
            child.print(level + 1);
        }
    }
}
```

The `TreeNode` class represents a node in our tree structure. Each node contains metadata (of type `FileMetadata`) and an array of child nodes (`children`). The `print` method allows us to print the path of the node and its children, with indentation to represent the depth in the tree.

We'll need a method to hash a file's content. For this, we use Node.js's built-in `crypto` module:

```typescript
function hashFile(file: string): string {
    const fileBuffer = fs.readFileSync(file);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
}
```

The `hashFile` function reads a file synchronously into a buffer, then uses `crypto.createHash` to create a SHA-256 hash, which is updated with the file content buffer. The digest is then returned as a hexadecimal string.

Finally, we create the `walkDir` function:

```typescript
function walkDir(dir: string): TreeNode {
    const dirent = fs.lstatSync(dir);
    if (dirent.isDirectory()) {
        const children = fs.readdirSync(dir).map(name => walkDir(path.join(dir, name)));
        return new TreeNode({ path: dir, isDirectory: true }, children);
    } else {
        return new TreeNode({ path: dir, isDirectory: false, hash: hashFile(dir) });
    }
}
```

The `walkDir` function synchronously gets the status of the input directory (`dir`). If it's a directory, it reads the directory's contents and recursively walks each entry, creating a `TreeNode` for each one. If the input `dir` is a file, it creates a `TreeNode` for the file, computing and storing the file's hash.

With the use of these Node.js methods and our defined `TreeNode` class, we can efficiently traverse a file directory, create a tree-like structure for it, and obtain the hash of each file. This is particularly useful when you need to track the state of files in a directory, for example in a version control system.


Cheers! 🍺
