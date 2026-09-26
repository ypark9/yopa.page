#!/usr/bin/env python3
"""Try all eight role/parameter combinations and print what AWS actually said.

This is the article's second item. It makes real AWS calls; it proves nothing
if run against mocks, which is exactly why the local fixture next door cannot
cover it.

    python3 verify_boundary.py <aws-profile>

Reads the OpenTofu outputs for role ARNs and parameter names, assumes each
role, and calls ssm:GetParameter for every parameter. Read-only: it creates
nothing and changes nothing.

Exit code 0 only if the two cross-reads on the String pair are denied AND the
two own-reads on the String pair succeed. The success half is not decoration.
A typo in a resource ARN denies everything, and a run that only checked for
denials would call that a pass.

The SecureString pair is measured and reported but not asserted. Whether the
AWS-managed alias/aws/ssm key adds a second boundary on top of the SSM policy
is the thing being found out, so predicting it here would defeat the point.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import time

TOFU = "tofu"


def tofu_output() -> dict:
    result = subprocess.run(
        [TOFU, "output", "-json"], capture_output=True, text=True
    )
    if result.returncode != 0:
        sys.exit(
            "could not read tofu outputs - run 'tofu apply' first.\n"
            + result.stderr.strip()
        )
    raw = json.loads(result.stdout)
    return {k: v["value"] for k, v in raw.items()}


def aws(args: list[str], profile: str, creds: dict | None = None) -> tuple[int, str]:
    env = None
    if creds:
        env = dict(os.environ)
        env.update(
            {
                "AWS_ACCESS_KEY_ID": creds["AccessKeyId"],
                "AWS_SECRET_ACCESS_KEY": creds["SecretAccessKey"],
                "AWS_SESSION_TOKEN": creds["SessionToken"],
            }
        )
        # Assumed-role credentials are passed explicitly, so the profile must
        # not also be applied or the CLI reverts to the profile's identity.
        env.pop("AWS_PROFILE", None)
        cmd = ["aws", *args]
    else:
        cmd = ["aws", *args, "--profile", profile]

    proc = subprocess.run(cmd, capture_output=True, text=True, env=env)
    return proc.returncode, (proc.stdout if proc.returncode == 0 else proc.stderr).strip()


def assume(role_arn: str, profile: str, region: str) -> dict:
    """Assume a role, retrying briefly for IAM's eventual consistency.

    A role created seconds ago frequently cannot be assumed yet. Without this
    retry the experiment reports a boundary failure that is really a race.
    """
    last = ""
    for attempt in range(10):
        code, out = aws(
            [
                "sts", "assume-role",
                "--role-arn", role_arn,
                "--role-session-name", "boundary-probe",
                "--duration-seconds", "900",
                "--region", region,
                "--output", "json",
            ],
            profile,
        )
        if code == 0:
            return json.loads(out)["Credentials"]
        last = out
        time.sleep(2 * (attempt + 1) / 2)
    sys.exit(f"could not assume {role_arn} after retries:\n{last}")


def classify(code: int, out: str) -> tuple[str, str]:
    """Collapse the CLI result into ALLOW / DENY / other, plus the reason.

    Distinguishing which service denied matters: an SSM policy denial and a
    KMS decrypt denial are two different boundaries wearing the same red.
    """
    if code == 0:
        return "ALLOW", ""
    if "AccessDeniedException" in out or "AccessDenied" in out:
        if "kms" in out.lower() or "Decrypt" in out:
            return "DENY", "kms"
        return "DENY", "ssm"
    if "ParameterNotFound" in out:
        return "NOT_FOUND", "parameter missing"
    return "ERROR", out.splitlines()[-1][:90] if out else "unknown"


def main() -> int:
    # The profile is a CLI argument rather than a tofu output on purpose.
    # `apply` may have run with environment credentials (see main.tf), and the
    # profile that applied is not necessarily the one that should verify.
    if len(sys.argv) < 2:
        sys.exit("usage: python3 verify_boundary.py <aws-profile>")
    profile = sys.argv[1]

    out = tofu_output()
    roles = out["roles"]
    params = out["parameters"]
    region = out["region"]

    print(f"account profile: {profile}   region: {region}\n")

    sessions = {name: assume(arn, profile, region) for name, arn in roles.items()}

    # (role, parameter) -> whether the role owns that parameter
    owned = {
        ("launcher", "launcher_plain"): True,
        ("launcher", "launcher_secure"): True,
        ("launcher", "worker_plain"): False,
        ("launcher", "worker_secure"): False,
        ("worker", "worker_plain"): True,
        ("worker", "worker_secure"): True,
        ("worker", "launcher_plain"): False,
        ("worker", "launcher_secure"): False,
    }

    header = f"{'role':<10} {'parameter':<18} {'own?':<6} {'result':<10} {'why':<12} expected"
    print(header)
    print("-" * len(header))

    failures = []
    for (role, param), is_own in owned.items():
        code, text = aws(
            [
                "ssm", "get-parameter",
                "--name", params[param],
                "--with-decryption",
                "--region", region,
                "--output", "json",
            ],
            profile,
            creds=sessions[role],
        )
        result, why = classify(code, text)

        plain = param.endswith("_plain")
        expected = ("ALLOW" if is_own else "DENY") if plain else "(measuring)"

        if plain and result != expected:
            failures.append(f"{role} -> {param}: expected {expected}, got {result} ({why})")

        print(
            f"{role:<10} {params[param].split('/')[-1]:<18} {'yes' if is_own else 'no':<6} "
            f"{result:<10} {why:<12} {expected}"
        )

    print()
    claim = "worker -> launcher_plain"
    print(f"The article's claim is the row '{claim}'. Everything else is context:")
    print("  - the two 'own? yes' String rows are the positive control;")
    print("    without them a denial could just be a broken ARN.")
    print("  - the SecureString rows are unasserted. Read the 'why' column:")
    print("    'ssm' means the parameter policy stopped it, 'kms' means the key did.")

    if failures:
        print("\nFAILED:")
        for f in failures:
            print(f"  {f}")
        return 1

    print("\nString pair behaved as the article's table describes.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
