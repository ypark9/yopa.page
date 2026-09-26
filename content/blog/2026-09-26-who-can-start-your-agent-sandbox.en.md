---
title: "Who Is Allowed to Start Your Agent's Sandbox? Five Things I Found Testing the Control Plane"
date: 2026-09-26T09:00:00-04:00
author: Yoonsoo Park
description: "AWS published a reference design for self-hosted agent sandboxes on Lambda MicroVMs. The sandbox is the easy half. I tested the half around it, the part that decides who may start one: signature checks, retries, secrets, and what happens when the same webhook arrives 50 times at once. Five findings, three of which the reference design does not spell out."
categories:
  - AWS
  - AI Agents
  - Security
tags:
  - AI Agents
  - Security
  - Lambda
  - isolation
  - authorization
---

In July I wrote about [where agent-generated code should run](/blog/2026-07-02-where-to-run-agent-generated-code.html), and landed on Lambda MicroVMs, small virtual machines that each get their own kernel. That post answered "where". It skipped a harder question: once you have a sandbox, **who is allowed to start one, and with whose credentials?**

On 2026-09-18 AWS published a reference solution for exactly that, for self-hosted sandboxes behind Claude Managed Agents. The sandbox part is not the interesting part. The interesting part is the small system around it that decides whether to start a sandbox at all. People call that the control plane. I rebuilt its logic, tested it locally, and then tested the two parts that need real AWS.

In short, here is what I found:

1. Check the signature before **any** side effect, not just before the one that costs money.
2. When your own secret is missing, answer 500, not 401. A 401 makes a well-behaved sender stop retrying.
3. Sign the raw bytes, and put the timestamp inside the signature.
4. When the same webhook arrives 50 times at once, only a conditional write gives you exactly one sandbox. With a plain "check, then write", I got 9 to 21 sandboxes per burst.
5. Splitting secrets across two IAM roles holds. But SecureString with the default AWS key is **not** a second wall; a role with zero KMS permissions read the secret in plain text.

## The setup in one paragraph

When a session is ready, the agent platform sends a **webhook**, an HTTP request to your endpoint that says "session X is ready". A small Lambda function called the **launcher** receives it. The launcher checks that the request really came from the platform, using an **HMAC signature**: the platform and you share a secret, the platform hashes the request with that secret, and you hash it again and compare. If the two match, only someone holding the secret could have sent it. Then the launcher writes the event ID into a table so a retry of the same webhook does not start a second sandbox. That property is called **idempotency**: doing it twice has the same effect as doing it once. Only then does it start a MicroVM. Inside the MicroVM, a **worker** picks up the session and does the actual work.

Two secrets live in AWS Systems Manager **Parameter Store**, which is a key-value store for config and secrets: the webhook signing secret, which only the launcher needs, and the environment key the worker uses to talk to the platform.

## Finding 1: check the signature before any side effect

The reference design says the launcher verifies the signature first and returns 401 before any VM starts. I first read that as a cost rule: checking is free, a MicroVM is not.

Writing the tests showed a second reason. The launcher does two things after the check: it writes the event ID into the idempotency table, and it starts a sandbox. Suppose the table write happened before the signature check. Then anyone on the internet could send fake webhooks carrying the event IDs of real sessions. Nothing would launch, nothing would cost money, and the table would now say those events were already handled. When the real webhook arrives, the launcher answers "duplicate" and the session never starts.

So the test that matters is not "zero sandboxes on a bad signature". It is **zero writes to the table** on a bad signature. The order in my launcher, which the tests hold in place:

```python
def handle(self, body: bytes, headers: dict) -> Response:
    try:
        secret = self._load_signing_secret()              # 1. read the secret
    except ParameterNotFound as exc:
        return Response(Outcome.SECRET_UNAVAILABLE, ...)   #    500, see Finding 2

    failure = self._verify(body, headers, secret)          # 2-3. fresh? signed?
    if failure is not None:
        return failure                                     #    401, nothing written

    event = json.loads(body)
    if not self.idempotency.claim(event["event_id"]):      # 4. first write
        return Response(Outcome.DUPLICATE, ...)

    sandbox_id = self.fleet.launch(...)                    # 5. first thing that costs money
```

Steps 1 to 3 have no side effects. Step 4 is the first write. Step 5 is the first cost.

## Finding 2: a missing secret is a 500, not a 401

What should the launcher answer when it cannot read its own signing secret? Maybe someone renamed the parameter, or the role lost permission.

401 is tempting, because the request did not get authenticated. But 401 means "your signature is wrong" to the sender. A well-behaved sender that keeps getting 401 decides its deliveries are being rejected, and stops retrying. So a mistake in **your** config quietly throws away real sessions, and your logs say "unauthorized" the whole time.

The right answer is 500, "my fault, please retry", because that is what happened. There is also a third way to get this wrong, the worst one: the lookup returns nothing, the comparison runs against an empty secret, and every request passes. It needs its own test.

## Finding 3: sign the raw bytes, and put the timestamp inside

Two ways to write a signature check that passes your own tests and fails in real life:

- **Parse the body, then turn it back into text, then hash it.** Your own tests pass, because your tests produce JSON the same way. A real sender that puts spaces differently produces different bytes, and every real delivery fails. Hash the bytes exactly as they arrived.
- **Sign only the body, and send the timestamp as a separate header.** Then anyone who captures one real delivery can change the timestamp header and replay it forever. The timestamp has to be part of what gets signed. My launcher signs `"{timestamp}.{body}"` and refuses anything older than 300 seconds.

One small warning. My signature format is a common one, but I made it up; I did not take it from the platform's webhook docs. Check your sender's real format before you copy any of this.

I checked the test suite the hard way: I broke the launcher on purpose in ten different ways (skipped the signature check, moved the table write before the check, answered 401 for a missing secret, hashed a re-serialized body, left the timestamp outside the signature, and so on), one at a time. The 38 tests caught all ten. An eleventh change got through: replacing `hmac.compare_digest` with a plain `==`. `compare_digest` takes the same time whether the first character or the last one is wrong, so an attacker cannot learn the secret by timing your answers. No behavior test can see that difference. You check it by reading the line.

## Finding 4: 50 copies at once, and only one sandbox

Webhooks get retried. A retry that starts a second sandbox for the same session doubles the cost, and two workers may fight over the same session. The reference design keys on the webhook's event ID, using the idempotency utility from Powertools for AWS Lambda (a helper library AWS maintains) with a DynamoDB table behind it.

My local tests covered retries one after another, including a cold start, where the Lambda starts fresh and loses anything in memory. What they could not cover is copies arriving **at the same moment**. That depends on DynamoDB, not on my code. So I tested it against a real table: 50 threads, the same new event ID, all released at the same instant, 20 rounds, three ways of claiming the ID. "Launch" was just a counter; nothing started.

| How the launcher claims the event ID | Sandboxes per burst of 50 | Rounds with exactly one |
| --- | --- | --- |
| Read the table, then write if not there | 9 to 21 | 0 / 20 |
| One write with `attribute_not_exists(id)` | 1 | 20 / 20 |
| Powertools `@idempotent_function` | 1 | 20 / 20 |

The first row is the control. It proves the test can fail: with the same harness, the same table, and the same 50 threads, a non-atomic claim let 9 to 21 copies through every time. (I added a 10 ms pause between the read and the write, the kind of gap a real launcher has, to make the race easy to see.) The second row is the DynamoDB feature that fixes it: a conditional write, where DynamoDB checks and writes in one step, so only one caller can win. Powertools uses the same thing underneath.

One thing I did not expect. Under Powertools, most of the 49 losers do not get a friendly "duplicate". 946 out of 1,000 got an exception, `IdempotencyAlreadyInProgressError`, because the first call was still running. If your launcher lets that exception escape, the sender sees a server error for a delivery that is being handled just fine. It will retry, and the retry gets the stored result (every late retry in my test did), but your error rate and your alarms count every one as a failure. Catch that exception and answer with a status your sender treats as "try later".

## Finding 5: two roles, two secrets, and SecureString is not a second wall

The reference design gives each part access to only the secret it needs:

| Part | Can read |
| --- | --- |
| Launcher | the webhook signing secret |
| Worker | the environment key |

The launcher passes the worker the **name** of the environment key parameter, not its value. So the launcher never touches the worker's secret, and the worker never touches the launcher's. The rule I take from this for any agent platform: a component should be able to read as many secrets as it has jobs. The launcher has one job, deciding whether a webhook is real. If it also holds the worker's key, a bug in the launcher becomes a bug in the worker's identity.

I tested that the split actually holds. The first version of this post said that test needed the whole platform running. It did not. The claim is about IAM and Parameter Store, so two roles and four parameters were enough, and both are free. Each role got permission to read only its own parameters, and then each role tried to read every parameter:

| | Launcher's secret | Worker's key |
| --- | --- | --- |
| **Launcher role** | allowed | **denied** |
| **Worker role** | **denied** | allowed |

The "allowed" cells matter as much as the "denied" ones. One typo in a resource name denies everything, and a test that only looked for denials would call that a pass.

Then the finding I did not expect. I ran the table twice, once with plain String parameters and once with **SecureString**, the encrypted type. I thought the AWS-managed encryption key (`alias/aws/ssm`) might act as a second lock, so a role would need both Parameter Store permission and KMS (Key Management Service) permission. It does not.

Neither role had any KMS permission at all. AWS confirmed it:

```
$ aws kms describe-key --key-id alias/aws/ssm        # as the worker role
AccessDeniedException ... is not authorized to perform: kms:DescribeKey
```

And the same role, reading its own SecureString:

```
$ aws ssm get-parameter --name .../worker/environment-key-secure --with-decryption
SecureString    inert-fixture-value-worker-secure
```

Plain text, with zero KMS permissions. The reason is in the AWS-managed key's own policy. It lets anyone in the account decrypt, as long as the request comes through Parameter Store (the condition is called `kms:ViaService`). So Parameter Store permission alone is enough.

That is the same condition I recommended in my [AgentCore Identity post](/blog/2026-07-30-agentcore-identity-private-key-jwt.html), from the other side. There, `kms:ViaService` narrows who can use a key you own. Here, on a key AWS owns, it is what makes the key open to anyone who can reach the parameter.

So, with the default key, SecureString gives you encryption at rest and an audit trail. It does **not** give you a second permission check. If you have been counting it as a second layer behind your Parameter Store policy, you have one layer. A customer-managed key with its own key policy would change that. I have not tested one.

## The design choices I did not test

These come from the reference design. I think they are right, but I did not measure them.

**Webhook or poller.** A MicroVM has an **idle policy**: after a quiet period with no incoming traffic, it pauses the VM to save money, and wakes it when traffic arrives.

- Webhook, one incoming request per session. Pro: it fits the idle policy; the VM starts for the session, the worker exits, the VM pauses and then ends. Con: you now run an endpoint, a launcher, and a table.
- A worker inside the sandbox that keeps asking the queue for work. Pro: simpler, no endpoint. Con: between sessions nothing comes in, so the idle policy pauses the VM under the worker and the loop breaks. Turning the idle policy off fixes that by paying for a VM that does nothing.

**The edge is not the gate.** The design puts AWS WAF, a web application firewall, in front, with managed rule sets, which are rule groups AWS maintains for common attacks and bad bots. I wrote about what those rules catch in the [WAF for AgentCore Gateway post](/blog/2026-07-02-waf-for-agentcore-gateway.html). API Gateway also rejects badly shaped requests. Both cut noise. Neither one knows the signing secret, so neither one can tell a real webhook from a fake one. The signature check in the launcher is the only thing that decides.

**Remove a secret instead of guarding it.** If the platform is reached through the AWS-hosted Claude endpoint instead of the first-party API, the worker's role can sign requests with SigV4, AWS's standard way of signing requests with IAM credentials. Then there is no environment key to store or rotate at all. The reference design recommends this for production. A secret you do not have is better than one you guard well.

**Growing a running sandbox.** A running MicroVM can grow to four times its starting CPU and memory without being restarted. A session that starts small and hits a heavy job halfway through does not have to lose its workspace.

## When not to build this

- Build it yourself. Pro: you control the network, where secrets live, and who reviews each part. Con: you now operate a launcher, a table, an endpoint, and the tests for all of them.
- Use the managed path. Pro: much less to run. Con: you accept the platform's isolation, identity, and audit as they are.

The honest test is whether you need something the platform will not do: credentials that never leave your VPC, network rules you define, or a review of every component. If not, the managed path is smaller. And a single-team tool with three users does not need a launcher, an idempotency table, and a WAF. The reference solution is a reference, not a minimum.

## What I still have not run

- **The sandbox itself.** Nothing here proves that a running MicroVM runs as the role I tested, and the whole secret split depends on that. A deployment that gives the worker a different role, or extra credentials some other way, would pass every check above and still be wrong. This part really does need the platform.
- **The reference solution's own code.** My launcher is a rebuild from the design, and my roles are mine. I showed that the design works, not that the sample repository is wired that way.
- **An organization.** One account, no service control policies (SCPs, the org-level rules that can block actions in every account), no permission boundaries.
- **A load test.** The race test is 50 threads from one laptop, not production traffic.

The code for all three experiments is in [experiments/sandbox-launcher](https://github.com/ypark9/yopa.page/tree/main/experiments/sandbox-launcher): the local suite, the IAM test, and the race test.

## What to do

If you run a sandbox fleet, answer four questions this week:

1. What checks that a "start a sandbox" request is real, and does that check run before **any** write, not just before anything that costs money?
2. What does your launcher answer when its own secret is missing?
3. If the same trigger arrives 50 times in the same second, how many sandboxes start? Is the claim a single conditional write?
4. Which components can read the credential the workload uses? If more than one, why? And if you use SecureString with the default key, do you know it adds no second permission check?

A "no" or "I think so" on any of these is your next design review.

## Related posts

- [Where agent-generated code should run](/blog/2026-07-02-where-to-run-agent-generated-code.html): the compute choice this post builds on.
- [WAF for AgentCore Gateway](/blog/2026-07-02-waf-for-agentcore-gateway.html): what the edge rules catch, and what they do not.
- [AgentCore Identity without a shared client secret](/blog/2026-07-30-agentcore-identity-private-key-jwt.html): `kms:ViaService` used on purpose.
- [Zero-trust agent systems on AWS](/blog/2026-08-01-zero-trust-agent-systems-on-aws.html): one identity per component.
- [How AgentCore runtime instances changed the sizing decision](/blog/2026-08-06-agentcore-runtime-instances.html).
- [Your agent's refusal only covers the rules you wrote down](/blog/2026-09-26-where-should-agent-refusals-live.html): the same "check first, act later" idea, for tool calls.

## Sources

- AWS Compute Blog, [Running self-hosted AI agent sandboxes with AWS Lambda MicroVMs](https://aws.amazon.com/blogs/compute/running-self-hosted-ai-agent-sandboxes-with-aws-lambda-microvms/), September 18, 2026.
- Reference solution, [aws-samples/sample-lambda-microvm-claude-managed-agents](https://github.com/aws-samples/sample-lambda-microvm-claude-managed-agents).
- Lambda MicroVM documentation, [launching and idle policy](https://docs.aws.amazon.com/lambda/latest/dg/microvms-launching.html) and [images and snapshots](https://docs.aws.amazon.com/lambda/latest/dg/microvms-images-snapshots.html).

The local suite and the IAM test ran on 2026-09-23 (IAM in a separate test account). The race test ran on 2026-09-26 against one DynamoDB table, for under a cent. The webhook-or-poller, edge, SigV4, and scale-up sections are my reading of the reference design, not measurements.
