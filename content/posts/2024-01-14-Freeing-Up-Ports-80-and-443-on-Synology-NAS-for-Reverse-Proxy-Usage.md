---
title: Freeing Up Ports 80 and 443 on Synology NAS for Reverse Proxy Usage
date: 2024-01-14
author: Yoonsoo Park
description: "Learn how to reconfigure Nginx on Synology NAS to free up ports 80 and 443 for reverse proxy usage with a simple Bash script."
categories:
  - Technology
  - Networking
  - Tutorials
tags:
  - Synology NAS
  - Nginx
  - Reverse Proxy
  - Bash Scripting
---

![Working on Synology](images/red-oni-synology.webp)

# Freeing Up Ports 80 and 443 on Synology NAS for Reverse Proxy Usage

## Introduction

For Synology NAS users looking to implement reverse proxies such as Traefik, Nginx Proxy Manager, or Caddy, the usage of ports 80 and 443 by default NAS services can be a hurdle. These ports, often occupied by the NAS via Nginx, are essential for reverse proxy operations. Fortunately, a Bash script can efficiently reconfigure Nginx, freeing up these crucial ports.

In this article, we explore a Bash script solution for modifying the default HTTP and HTTPS ports on Synology NAS, enabling the use of ports 80 and 443 for other applications.

## Understanding the Port Conflict

Synology NAS systems employ Nginx, a widespread web server, in their operating framework. Nginx, by default, listens on ports 80 (HTTP) and 443 (HTTPS). This default setting is suitable for regular operations but creates a conflict for reverse proxy servers that require these same ports.

## The Solution: A Bash Script

A Bash script offers a seamless solution to reconfigure the Nginx server on Synology NAS, reallocating ports 80 and 443 for alternate use. Here’s how the script functions:

### Script Breakdown

```bash
#! /bin/bash

# NGINX Ports - CUSTOMIZATION REQUIRED
DEFAULT_HTTP_PORT=80
DEFAULT_HTTPS_PORT=443
NEW_HTTP_PORT=81
NEW_HTTPS_PORT=444

# Modifying Nginx Configuration
sed -i "s/^\([ \t]\+listen[ \t]\+[]:[]*\)$DEFAULT_HTTP_PORT\([^0-9]\)/\1$NEW_HTTP_PORT\2/" /usr/syno/share/nginx/*.mustache
sed -i "s/^\([ \t]\+listen[ \t]\+[]:[]*\)$DEFAULT_HTTPS_PORT\([^0-9]\)/\1$NEW_HTTPS_PORT\2/" /usr/syno/share/nginx/*.mustache

# Restart Nginx to apply changes
synosystemctl restart nginx
```

### Key Aspects of the Script

1. **Customization**: Modify `NEW_HTTP_PORT` and `NEW_HTTPS_PORT` variables to designate alternative Nginx ports.
2. **Automated Editing**: Utilizes `sed` for replacing default ports in Nginx configuration files.
3. **Restart Nginx**: Finalizes with a command to restart Nginx, implementing the adjustments.

### Implementation Steps

1. **Create the Script**:
   - Copy and save the script on your Synology NAS with a `.sh` extension and execution permissions.
2. **Schedule the Script**:
   - Set it to run as `root` at boot through DSM’s Control Panel -> Task Scheduler.
3. **Run and Verify**:
   - Manually execute or reboot NAS for testing.
   - Confirm port changes with tools like `netstat`.

### Points to Remember

- **DSM Upgrades**: Synology's DSM updates may revert these configurations; hence, scheduling the script is vital.
- **Port Selection**: Choose unused ports on your NAS for the new settings.
- **Access Control**: Update firewall rules and port forwarding accordingly.

## Conclusion

This Bash script provides a straightforward and effective way for Synology NAS users to employ reverse proxies by reassigning the default HTTP and HTTPS ports used by Nginx. It's a practical solution for resolving port conflicts and enhancing the functionality of your NAS. When implementing this script, always ensure to follow network security best practices and check for any service conflicts with the new port assignments.

Adapting and verifying the script based on individual network configurations and Synology NAS models is recommended for optimal results. This approach not only solves the immediate port conflict issue but also opens up new possibilities for using your NAS for diverse applications, from hosting websites to running complex network services.

Cheers! 🍺
