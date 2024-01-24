---
title: Harnessing the Power of Watchtower for Docker -- Automated Updates Made Simple
date: 2024-01-22
author: Yoonsoo Park
description: "Explore the benefits of using Watchtower for your Docker containers, understand its advantages, and learn how to utilize cron scheduling for automated updates."
categories:
  - Docker
  - Containerization
  - DevOps
tags:
  - Watchtower
  - Docker
  - Automation
  - Cron
  - Container Management
ShowToc: true
TocOpen: true
---

![oni-docker](images/oni-docker-1.webp)

Managing Docker containers effectively is pivotal in the landscape of modern software development and deployment. Watchtower stands out as an indispensable tool, offering seamless automation for keeping your containers up-to-date. In this article, we dive into the essence of Watchtower, explore its advantages, and unravel the power of cron scheduling for orchestrating your container updates.

## Why You Need Watchtower for Your Docker Containers

In the dynamic world of Docker containers, staying abreast with the latest image updates is crucial for security, performance, and stability. Manually tracking and updating each container is not just tedious; it's also prone to human error. This is where Watchtower comes into play, transforming the update process by automating it.

### Automated Updates

Watchtower automates the process of monitoring and updating your Docker containers. It periodically checks for updated images, and if found, it gracefully restarts your containers with the new image, ensuring minimal downtime and maximum reliability.

### Consistent Environment

By ensuring your containers are always running the latest versions of images, Watchtower helps maintain a consistent and predictable environment, reducing the "it works on my machine" syndrome.

### Security Compliance

Regular updates mean that security patches and critical updates are applied promptly, reducing the vulnerability window and keeping your containers secure.

## Leveraging Cron for Scheduling Updates

One of Watchtower's powerful features is its ability to use cron expressions for scheduling update checks. This flexibility allows you to align update checks with maintenance windows, minimize disruption, and manage resource utilization effectively.

### Various Cron Use Cases

- **Every Day at a Specific Time:**
  - `0 3 * * *` - Update checks every day at 3 AM. Ideal for daily routine updates during off-peak hours.
- **Every Monday:**

  - `0 0 * * 1` - Weekly updates every Monday. Suitable for weekly maintenance tasks.

- **Every 2nd Day of the Month:**

  - `0 0 2 * *` - Ensures that updates are performed on the second day of each month, aligning with monthly administrative cycles.

- **Twice Per Month:**

  - `0 0 1,15 * *` - Performs updates on the 1st and the 15th of each month, balancing the update load.

- **Every Month:**
  - `0 0 1 * *` - Monthly updates on the first day of the month, keeping a consistent update schedule.

These are just a few examples of how cron expressions can be tailored to fit your specific operational requirements and preferences.

### Integrating Watchtower with Docker Compose in Synology with Container Manager

To incorporate Watchtower into your Docker environment, you can define it in your `docker-compose.yml` file. Here's an example configuration that uses Watchtower to monitor and update specified containers:

```yaml
services:
  watchtower:
    image: containrrr/watchtower:latest # Specifies the use of the latest Watchtower image.
    container_name: watchtower # Sets the name of the container to 'watchtower'.
    environment: # Environment variables for configuring Watchtower behavior.
      - TZ=America/New_York # Sets the timezone to 'America/New_York'. This can be different for your case.
      - WATCHTOWER_CLEANUP=true # Enables cleaning up old images after updating.
      - WATCHTOWER_INCLUDE_STOPPED=true # Includes stopped containers in the monitoring and updating process.
      - WATCHTOWER_REVIVE_STOPPED=false # Prevents restarting containers that were stopped.
      - WATCHTOWER_SCHEDULE=0 30 8 * * 1 # Sets the schedule for running Watchtower (every Monday at 8:30 AM).
    command: # Specifies which containers Watchtower should monitor and potentially update.
      - jellyseerr
      - prowlarr
      - radarr
      - sonarr
      - watchtower
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock # Mounts the Docker socket to allow Watchtower to interact with the Docker API.
    restart: unless-stopped # Configures the container to restart automatically unless it is explicitly stopped.
```

In this setup, Watchtower is configured to check for updates every Monday at 8:30 AM (Eastern Time). It will monitor the containers `jellyseerr`, `prowlarr`, `radarr`, `sonarr`, and `watchtower` itself, and will clean up old images after updating. The configuration ensures that stopped containers are included in the monitoring but prevents restarting containers that were stopped before the update.

## Wrapping it up 👏

Watchtower revolutionizes container management by automating the update process, ensuring that your Docker environments are secure, up-to-date, and consistent. The integration of cron scheduling adds an extra layer of precision and control, allowing updates to be seamlessly integrated into your operational workflows.

Cheers! 🍺
