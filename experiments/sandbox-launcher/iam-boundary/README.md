# Can the worker role read the launcher's parameter?

The second of the two things named in
[Who Is Allowed to Start Your Agent's Sandbox?](../../../content/blog/2026-09-26-who-can-start-your-agent-sandbox.en.md)
under "What I have not run":

> I would need one end-to-end session to confirm that the worker's role really
> cannot read the launcher's parameter. [...] it needs an account and the
> platform's self-hosted environment configured, so it is a decision with a
> cost, not a task.

The article bundled two separate things there. The *claim* is about IAM and
SSM; the *platform* is what the article assumed you would need to observe it.
You do not. Four parameters, two roles, eight calls — no MicroVM, no reference
solution deployed, no Claude Managed Agents environment. SSM Standard
parameters and IAM roles are both free, so the run cost nothing.

That reframing is the main thing this directory demonstrates. The rest is the
measurement.

## Result

Run 2026-09-23 in a separate test account, `us-east-1`.

| role | parameter | owns it? | result | denied by |
| --- | --- | --- | --- | --- |
| launcher | launcher signing-secret (String) | yes | ALLOW | |
| launcher | launcher signing-secret (SecureString) | yes | ALLOW | |
| launcher | worker environment-key (String) | no | **DENY** | ssm |
| launcher | worker environment-key (SecureString) | no | **DENY** | ssm |
| worker | worker environment-key (String) | yes | ALLOW | |
| worker | worker environment-key (SecureString) | yes | ALLOW | |
| worker | **launcher signing-secret (String)** | no | **DENY** | ssm |
| worker | launcher signing-secret (SecureString) | no | **DENY** | ssm |

Row 7 is the article's claim. The verbatim response:

```
An error occurred (AccessDeniedException) when calling the GetParameter
operation: User: arn:aws:sts::123456789012:assumed-role/
<worker-role>/<session> is not authorized to perform:
ssm:GetParameter on resource: arn:aws:ssm:us-east-1:123456789012:parameter/
sandbox-launcher-exp/launcher/signing-secret-plain because no identity-based
policy allows the ssm:GetParameter action
```

**Verdict: the credential split in the article's Decision 3 table holds when
expressed as ARN-scoped identity policies.** Each role reads its own parameter
and is refused the other's, by AWS, not by a mock.

The four ALLOW rows are the positive control and are not decoration. A typo in
a resource ARN denies everything, and a run that only looked for denials would
score that as a pass.

## The unasserted half, which is where the finding is

The SecureString pair was measured rather than predicted, because whether the
AWS-managed `alias/aws/ssm` key adds a *second* boundary on top of the SSM
policy is not obvious. It does not.

Neither role was granted any KMS permission. Confirmed from AWS's side, not
from the Terraform:

```
$ aws kms describe-key --key-id alias/aws/ssm          # as the worker role
AccessDeniedException ... is not authorized to perform: kms:DescribeKey
... because no identity-based policy allows the kms:DescribeKey action
```

And yet, as that same role:

```
$ aws ssm get-parameter --name .../worker/environment-key-secure --with-decryption
SecureString    inert-fixture-value-worker-secure        # plaintext
```

A role with zero KMS permissions read a SecureString back decrypted. The
AWS-managed key's policy grants decrypt to the account conditioned on
`kms:ViaService: ssm.<region>.amazonaws.com`, so `ssm:GetParameter` alone is
sufficient and KMS is never a gate.

Correspondingly, every cross-read denial above is attributed to `ssm`. KMS was
not consulted at any point — including on the SecureString rows, which failed
at the SSM policy before decryption was ever reached.

**So: choosing SecureString over String with the default key buys encryption at
rest and an audit trail. It does not buy a second authorization boundary.** A
customer-managed key with its own key policy would; that is a different
experiment and is not run here.

## What this still does not prove

1. **The roles are mine, not the reference solution's.** This shows the
   policy *shape* in the article's table works. It does not show that
   `aws-samples/sample-lambda-microvm-claude-managed-agents` wires its roles
   this way.

2. **No sandbox ran.** The article said "one end-to-end session", and this is
   not one. Nothing here proves that a *running* MicroVM executes under the
   role that was tested, which is the assumption the whole boundary rests on.
   A deployment that hands the worker a different role, or additional
   credentials by another path, would pass this test and still be wrong.

3. **One account, no organization controls.** No SCPs, no permission
   boundaries, no resource policies. A real environment can be more
   restrictive than this and, through a separate grant, less.

4. **`--with-decryption` only.** `ssm:GetParameters` (plural),
   `GetParametersByPath`, and parameter-store-backed environment injection are
   distinct actions. The policies here name only `ssm:GetParameter`.

## Running it

```bash
cd experiments/sandbox-launcher/iam-boundary

tofu init
tofu plan -out=boundary.tfplan
../../../scripts/check-plan-safety.sh boundary.tfplan   # create-only
tofu apply boundary.tfplan

python3 verify_boundary.py <your-profile>   # read-only; prints the table above

tofu destroy
```

`verify_boundary.py` exits non-zero if the String pair departs from the
expected ALLOW/DENY, so it is usable as a regression check.

### Credentials

`apply` and `destroy` need IAM write permission, and the test profile I used
cannot provide it. Its credential helper wraps a long-lived key in
`sts:GetSessionToken` without MFA, and those session credentials cannot call
the IAM API at all — reads elsewhere work fine, which makes this confusing the
first time. Hence `profile = var.profile != "" ? var.profile : null` in
`main.tf`: pass `-var 'profile='` and export `AWS_ACCESS_KEY_ID` /
`AWS_SECRET_ACCESS_KEY` directly for those two commands only.

`plan` and `verify_boundary.py` need no such thing — they use
`sts:GetCallerIdentity`, `sts:AssumeRole` and `ssm:GetParameter`, all of which
the profile allows.

## Scope

Eight resources, all prefixed `sandbox-launcher-exp` and tagged
`Lifecycle=disposable`. Local state in this directory, deliberately not part of
`terraform/env/{global,prod}` — nothing here touches the blog's infrastructure.

The parameter values are inert strings (`inert-fixture-value-*`). Nothing
stored here is a credential for anything.
