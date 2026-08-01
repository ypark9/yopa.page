---
title: Walking the Directory and Creating a TreeNode
date: 2023-05-24T01:25:00-04:00
lastmod: 2026-08-01
reviewed_at: 2026-08-01
author: Yoonsoo Park
description: "Walking the Directory and Creating a TreeNode in Node.js"
categories:
  - Node.js
tags:
  - Node.js
  - TypeScript
  - File System
---

## A non-blocking traversal for new code

For new code, prefer `fs.promises.readdir(path, { withFileTypes: true })` so traversal does not block the event loop or call `stat` for every entry. Decide explicitly how to handle symbolic links, permission errors, cycles, and paths that disappear during traversal.


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
async function hashFile(file: string): Promise<string> {
    const fileBuffer = await fs.promises.readFile(file);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
}
```

The `hashFile` function reads a file without blocking the event loop, then computes a SHA-256 digest. For very large files, use a stream instead of buffering the entire file.

Finally, we create the `walkDir` function:

```typescript
async function walkDir(currentPath: string): Promise<TreeNode> {
    const stat = await fs.promises.lstat(currentPath);
    if (stat.isSymbolicLink()) {
        throw new Error(`Symbolic links are not followed: ${currentPath}`);
    }
    if (!stat.isDirectory()) {
        return new TreeNode({
            path: currentPath,
            isDirectory: false,
            hash: await hashFile(currentPath),
        });
    }

    const entries = await fs.promises.readdir(currentPath, { withFileTypes: true });
    const children = await Promise.all(
        entries.map(entry => walkDir(path.join(currentPath, entry.name)))
    );
    return new TreeNode({ path: currentPath, isDirectory: true }, children);
}
```

The traversal rejects symbolic links instead of following them outside the requested tree or entering a cycle. Decide whether permission and disappearance errors should stop the walk or be represented in the result. `Promise.all` can open too many files in a very large tree, so production crawlers should add a concurrency limit.

This produces a useful tree for a controlled directory. It is not a replacement for a version-control object model: files can change during the walk, metadata is platform-dependent, and a stable snapshot requires additional consistency rules.
