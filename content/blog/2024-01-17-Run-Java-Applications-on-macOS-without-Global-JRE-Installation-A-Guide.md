---
title: Run Java Applications on macOS without Global JRE Installation
date: 2024-01-17
author: Yoonsoo Park
description: "Explore ways to run Java applications on macOS without the need for global JRE installation, focusing on Docker, portable JRE, and bundled JRE methods."
categories:
  - Java
  - macOS
tags:
  - Java
  - macOS
  - Docker
  - JRE
  - JDK
---

![oni-docker](images/oni-docker.webp)

## Introduction

Java's omnipresence in software development is unquestionable. Yet, installing Java Runtime Environment (JRE) or Java Development Kit (JDK) globally on macOS may invite version clashes or security risks. This guide delves into alternative strategies for executing Java applications (JAR files) on Mac, sidestepping the global JRE setup. We lay particular emphasis on Docker, a celebrated containerization technology.

## The Perils of Global JRE Installation

- **Version Conflicts:** Diverse Java applications may demand specific Java versions, clashing with a globally installed JRE.
- **Security Risks:** A leaner global software footprint reduces potential vulnerabilities.
- **Enhanced Portability and Isolation:** Containerization assures consistent application performance across varying systems.

## Method 1: Application-Enclosed JRE

Encapsulate a JRE within your Java application to dodge system-wide Java conflicts.

### Steps:

1. **Acquire a JRE** that aligns with your application's and macOS's architecture.
2. **Embed the JRE in your application's folder**.
3. **Forge a startup script** to designate the encapsulated JRE as `JAVA_HOME` and initiate your application.

## Method 2: Embracing Portable JRE

A portable JRE facilitates Java application execution sans system-wide Java installation.

### Steps:

1. **Procure a portable JRE** suitable for macOS.
2. **Unpack it** in a directory of your choice.
3. **Execute your JAR file** using the absolute path to the `java` command within the portable JRE's folder.

## Method 3: Docker Deployment (Preferred)

Docker offers application execution in insulated settings. Here's how to use Docker for your JAR file:

### 1. Docker Installation

Fetch Docker from the [official portal](https://www.docker.com/products/docker-desktop) and set it up on your Mac.

### 2. Java Application Preparation

Consolidate your JAR file and all necessary assets in a single folder.

### 3. Crafting a Dockerfile

In your project folder, craft a Dockerfile with these specifics:

```dockerfile
# Opt for an official Java runtime as the base image
FROM openjdk:23-slim

# Designate the working area in the container
WORKDIR /usr/app

# Transport current directory's contents into /usr/app in the container
COPY . /usr/app

# Render port 8080 accessible externally
EXPOSE 8080

# Execute the JAR file
ENTRYPOINT ["java", "-jar", "your-application.jar"]
```

Tweak the port and JAR file name as needed.

### 4. Docker Image Construction

In your terminal, within the project folder, execute:

```bash
docker build -t your-app-name .
```

### 5. Launching Your Application

Activate your application with:

```bash
docker run -p 8080:8080 your-app-name
```

Your Java application is now operational within a Docker container!

## Wrapping it up 👏

Employing macOS to run JAR files sans a global JRE installation is streamlined with the right toolkit. Whether you opt for a bundled JRE, a portable JRE, or Docker's robust containerization, each avenue offers distinct merits. Docker, in particular, is championed for contemporary, portable, and stable deployments. It eliminates the global JRE dependency while assuring an insulated, controlled application environment.

Cheers! 🍺
