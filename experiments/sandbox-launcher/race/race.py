"""Does exactly one launch win when the same webhook arrives many times at once?

Three arms, each fires N threads at the same event ID, released together by a barrier:

  check_then_set  GetItem, then PutItem with no condition   (negative control: should let >1 win)
  conditional     PutItem with attribute_not_exists(id)      (the DynamoDB primitive)
  powertools      @idempotent_function + DynamoDBPersistenceLayer (what the reference solution uses)

"Launch" is a local counter. Nothing is started. The only AWS calls are DynamoDB item
reads/writes on one table.

  python race.py --table T --rounds 20 --threads 50 [--arms a,b,c]
"""
import argparse, json, threading, time, uuid, collections
import boto3
from botocore.exceptions import ClientError

def fire(n, fn):
    """Run fn(i) in n threads released at the same moment. Return list of results."""
    bar = threading.Barrier(n)
    out = [None] * n
    def w(i):
        bar.wait()
        try:
            out[i] = fn(i)
        except Exception as e:  # recorded, never raised
            out[i] = "EXC:" + type(e).__name__
    ts = [threading.Thread(target=w, args=(i,)) for i in range(n)]
    [t.start() for t in ts]; [t.join() for t in ts]
    return out

def arm_check_then_set(ddb, table, eid, n):
    launches = []
    lock = threading.Lock()
    def f(i):
        r = ddb.get_item(TableName=table, Key={"id": {"S": eid}}, ConsistentRead=True)
        if "Item" in r:
            return "duplicate"
        time.sleep(0.01)  # the gap a real launcher has between check and write
        ddb.put_item(TableName=table, Item={"id": {"S": eid}, "by": {"N": str(i)}})
        with lock: launches.append(i)
        return "launched"
    res = fire(n, f)
    return len(launches), collections.Counter(res)

def arm_conditional(ddb, table, eid, n):
    launches = []
    lock = threading.Lock()
    def f(i):
        try:
            ddb.put_item(TableName=table, Item={"id": {"S": eid}, "by": {"N": str(i)}},
                         ConditionExpression="attribute_not_exists(id)")
        except ClientError as e:
            if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
                return "duplicate"
            raise
        with lock: launches.append(i)
        return "launched"
    res = fire(n, f)
    return len(launches), collections.Counter(res)

def make_powertools(table, region):
    from aws_lambda_powertools.utilities.idempotency import (
        DynamoDBPersistenceLayer, IdempotencyConfig, idempotent_function)
    layer = DynamoDBPersistenceLayer(table_name=table, boto3_session=boto3.Session(region_name=region))
    cfg = IdempotencyConfig(event_key_jmespath="event_id", expires_after_seconds=3600)
    launches = []
    lock = threading.Lock()

    @idempotent_function(data_keyword_argument="event", persistence_store=layer, config=cfg)
    def launch(event):
        time.sleep(0.2)  # a launch takes time; the others arrive while it is "in progress"
        with lock: launches.append(event["event_id"])
        return {"sandbox": "sbx-" + event["event_id"][:8]}
    return launch, launches

def arm_powertools(launch, launches, eid, n):
    before = len(launches)
    res = fire(n, lambda i: (lambda r: "returned" if isinstance(r, dict) else str(r))(launch(event={"event_id": eid})))
    c = collections.Counter(res)
    # A late retry, after the first launch finished: should get the stored result, no new launch.
    try:
        late = launch(event={"event_id": eid})
        c["late_retry_returned_stored"] += 1 if isinstance(late, dict) else 0
    except Exception as e:
        c["late_retry_EXC:" + type(e).__name__] += 1
    return len(launches) - before, c

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--table", required=True)
    ap.add_argument("--region", default="us-east-1")
    ap.add_argument("--rounds", type=int, default=20)
    ap.add_argument("--threads", type=int, default=50)
    ap.add_argument("--arms", default="check_then_set,conditional,powertools")
    ap.add_argument("--out", default="race_results.jsonl")
    a = ap.parse_args()
    ddb = boto3.client("dynamodb", region_name=a.region)
    arms = a.arms.split(",")
    pt = make_powertools(a.table, a.region) if "powertools" in arms else None
    with open(a.out, "a") as f:
        for arm in arms:
            for r in range(a.rounds):
                eid = f"{arm}-{uuid.uuid4()}"
                if arm == "check_then_set":
                    wins, c = arm_check_then_set(ddb, a.table, eid, a.threads)
                elif arm == "conditional":
                    wins, c = arm_conditional(ddb, a.table, eid, a.threads)
                else:
                    wins, c = arm_powertools(pt[0], pt[1], eid, a.threads)
                rec = {"arm": arm, "round": r, "threads": a.threads, "launches": wins, "outcomes": dict(c)}
                f.write(json.dumps(rec) + "\n"); f.flush()
                print(arm, r, "launches", wins, dict(c), flush=True)

if __name__ == "__main__":
    main()
