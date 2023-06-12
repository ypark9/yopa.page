---
title: AWS-SQS-Queue
date: 2023-06-12T01:25:00-04:00
author: Yoonsoo Park
description: "AWS-SQS-Queue: Why-You-Need-to-Use-It-and-Real-Life-Examples"
categories:
  - AWS
tags:
  - SQS
---

Amazon Web Services (AWS) offers a multitude of services to cater to the different needs of businesses and developers. One such service is Amazon Simple Queue Service (SQS), a fully managed message queuing service that enables you to decouple and scale microservices, distributed systems, and serverless applications. In this article, we'll explore the reasons to use AWS SQS and illustrate its utility with a real-life example.

## Why Use AWS SQS?

SQS offers several compelling reasons that make it an attractive choice for managing messages in a distributed environment:

### 1. **Effortless Scaling**

SQS enables you to scale your applications without worrying about the underlying infrastructure. As your workload grows, SQS can seamlessly handle the increased message volume. No need for manual intervention or additional configuration.

### 2. **Reliability**

SQS guarantees the delivery of your messages. In case of any processing failures, the messages are not lost; instead, they return to the queue and can be processed again.

### 3. **Security**

SQS leverages AWS's robust security measures. It supports encryption to keep your data secure at rest and in transit. You can also control access to your queues using AWS Identity and Access Management (IAM).

### 4. **Cost-Effective**

With SQS, you pay only for what you use. There's no upfront cost, and you don't have to maintain any messaging software or hardware.

<details>
  <summary>**Some key features and aspects of SQS**</summary>

  1. **Types of Queues**: SQS offers two types of message queues. Standard queues offer maximum throughput, best-effort ordering, and at-least-once delivery. On the other hand, FIFO (First-In-First-Out) queues are designed to ensure that the order of messages is strictly preserved and a message is delivered once and remains available until a consumer processes and deletes it.

  2. **Message Retention**: SQS retains messages for a certain period until a consumer deletes them. The message retention period can be from 1 minute to 14 days. The default retention period is 4 days.

  3. **Dead Letter Queues**: SQS supports Dead Letter Queues (DLQ), which are used to sideline and isolate messages that can't be processed (consumed) successfully. DLQs can help you troubleshoot and handle message failures.

  4. **Delay Queues**: SQS allows you to postpone the delivery of new messages to a queue for a number of seconds, up to 900 seconds (15 minutes). If you create a delay queue, any messages that you send to the queue remain invisible to consumers for the duration of the delay period.

  5. **Long Polling**: SQS supports long polling, which is a way to retrieve messages from your SQS queues. While the regular short polling returns immediately, even if the message queue being polled is empty, long polling doesn't return a response until a message arrives in the message queue, or the long poll times out.

  6. **Batch Actions**: SQS allows you to send, delete, or change the visibility of multiple messages in a single action, reducing the cost of performing individual actions.

  7. **Integration with Other AWS Services**: SQS integrates seamlessly with other AWS services like Lambda, EC2, SNS (Simple Notification Service), and CloudWatch, providing a complete solution for application integration.

  8. **Cost**: You pay only for what you use, and there are no minimum fees. Pricing is based on the number of API calls made, the data transfer, and optional features like data transfer out of AWS.
  
</details>

## Real-Life Example: E-commerce Order Processing

Consider an e-commerce platform where numerous transactions occur simultaneously. Each transaction may involve several steps: validating the order, charging the customer, updating inventory, and notifying the customer. 

If we were to build this system without a message queue, we could potentially lose information if any single step fails or takes too long, leading to a poor customer experience. 

With AWS SQS, each transaction can be broken down into individual messages and placed in a queue. Different microservices, like Order Validation, Payment Processing, Inventory Update, and Notification Service, can then pick up and process these messages asynchronously.

In this scenario, even if the Payment Processing service goes down, the messages would remain in the queue until they are processed. This ensures no order is lost due to temporary service outages. 

Additionally, if there's a sudden surge in orders during a sales event, SQS can effortlessly handle the increased load, ensuring smooth operation.

---

In conclusion, AWS SQS is a robust, secure, and scalable solution for managing messages in distributed systems. It allows developers to focus on building functionalities rather than worrying about message delivery and system infrastructure. Whether you're working on a small project or managing a large-scale distributed system, AWS SQS could be an essential tool in your toolkit.

Cheers! 🍺
