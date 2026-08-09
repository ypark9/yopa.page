#!/usr/bin/env python3
"""Export privacy-bounded, aggregate GA4 reports with read-only Data API calls."""

from __future__ import annotations

import argparse
import csv
import json
import os
from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path


PROPERTY_ENV = "YOPA_GA4_PROPERTY_ID"


@dataclass(frozen=True)
class ReportSpec:
    name: str
    dimensions: tuple[str, ...]
    metrics: tuple[str, ...]
    event_names: tuple[str, ...] = ()
    page_paths: tuple[str, ...] = ()
    contains: str = ""
    contains_field: str = "pagePath"
    allowed_hosts: tuple[str, ...] = ("www.yopa.page", "yopa.page")
    limit: int = 100


REPORTS = (
    ReportSpec(
        "acquisition",
        ("sessionDefaultChannelGroup", "landingPagePlusQueryString"),
        ("sessions", "activeUsers", "newUsers", "engagedSessions", "engagementRate", "averageSessionDuration"),
        limit=200,
    ),
    ReportSpec(
        "content_language",
        ("language", "pagePath", "pageTitle", "newVsReturning"),
        ("screenPageViews", "activeUsers", "engagedSessions", "engagementRate", "averageSessionDuration"),
        limit=500,
    ),
    ReportSpec(
        "atlas_discovery",
        ("pagePath", "pageReferrer"),
        ("screenPageViews", "activeUsers", "engagedSessions", "engagementRate"),
        contains="/explore/",
        contains_field="pageReferrer",
        limit=200,
    ),
    ReportSpec(
        "growth_funnel",
        ("eventName", "pagePath"),
        ("eventCount", "activeUsers"),
        event_names=("expedition_view", "expedition_start", "expedition_stop_complete", "expedition_complete", "dispatch_cta"),
        page_paths=("/dispatch/confirmed.html", "/ko/dispatch/confirmed.html"),
        limit=200,
    ),
)


def periods(today: date) -> dict[str, tuple[str, str]]:
    end = today - timedelta(days=1)
    current_start = end - timedelta(days=364)
    prior_end = current_start - timedelta(days=1)
    prior_start = prior_end - timedelta(days=364)
    return {
        "current": (current_start.isoformat(), end.isoformat()),
        "prior": (prior_start.isoformat(), prior_end.isoformat()),
    }


def response_rows(response) -> list[dict[str, str]]:
    dimensions = [header.name for header in response.dimension_headers]
    metrics = [header.name for header in response.metric_headers]
    rows = []
    for row in response.rows:
        values = [value.value for value in row.dimension_values] + [value.value for value in row.metric_values]
        rows.append(dict(zip(dimensions + metrics, values)))
    return rows


def build_filter(spec: ReportSpec, FilterExpression, Filter):
    expressions = []
    event_expressions = []
    if spec.event_names:
        event_expressions.append(FilterExpression(filter=Filter(field_name="eventName", in_list_filter=Filter.InListFilter(values=list(spec.event_names)))))
    if spec.page_paths:
        confirmation_view = FilterExpression(
            and_group={
                "expressions": [
                    FilterExpression(filter=Filter(field_name="eventName", in_list_filter=Filter.InListFilter(values=["page_view"]))),
                    FilterExpression(filter=Filter(field_name="pagePath", in_list_filter=Filter.InListFilter(values=list(spec.page_paths)))),
                ]
            }
        )
        event_expressions.append(confirmation_view)
    if len(event_expressions) == 1:
        expressions.append(event_expressions[0])
    elif event_expressions:
        expressions.append(FilterExpression(or_group={"expressions": event_expressions}))
    if spec.contains:
        expressions.append(FilterExpression(filter=Filter(field_name=spec.contains_field, string_filter=Filter.StringFilter(match_type=Filter.StringFilter.MatchType.CONTAINS, value=spec.contains, case_sensitive=False))))
    if spec.allowed_hosts:
        expressions.append(FilterExpression(filter=Filter(field_name="hostName", in_list_filter=Filter.InListFilter(values=list(spec.allowed_hosts), case_sensitive=False))))
    if not expressions:
        return None
    if len(expressions) == 1:
        return expressions[0]
    return FilterExpression(and_group={"expressions": expressions})


def run_reports(property_id: str, today: date) -> dict:
    try:
        from google.analytics.data_v1beta import BetaAnalyticsDataClient
        from google.analytics.data_v1beta.types import DateRange, Dimension, Filter, FilterExpression, Metric, RunReportRequest
    except ImportError as error:
        raise SystemExit("Install the optional analytics dependency: python3 -m pip install -r requirements-analytics.txt") from error

    client = BetaAnalyticsDataClient()
    result = {"generated_on": today.isoformat(), "property": "configured", "privacy": "aggregate-only", "reports": {}}
    for spec in REPORTS:
        result["reports"][spec.name] = {}
        for period_name, (start, end) in periods(today).items():
            request = RunReportRequest(
                property=f"properties/{property_id}",
                date_ranges=[DateRange(start_date=start, end_date=end)],
                dimensions=[Dimension(name=name) for name in spec.dimensions],
                metrics=[Metric(name=name) for name in spec.metrics],
                dimension_filter=build_filter(spec, FilterExpression, Filter),
                limit=spec.limit,
            )
            response = client.run_report(request)
            result["reports"][spec.name][period_name] = {
                "date_range": {"start": start, "end": end},
                "sampled": bool(getattr(getattr(response, "metadata", None), "sampling_metadatas", [])),
                "rows": response_rows(response),
            }
    return result


def write_outputs(payload: dict, output_dir: Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "baseline.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
    summary = ["# yopa.page GA4 aggregate baseline", "", f"Generated: {payload['generated_on']}", "", "No user identifiers or individual session timelines are included.", ""]
    for name, periods_data in payload["reports"].items():
        summary.extend([f"## {name.replace('_', ' ').title()}", ""])
        for period_name, report in periods_data.items():
            rows = report["rows"]
            summary.append(f"- {period_name}: {len(rows)} aggregate rows; sampled={str(report['sampled']).lower()}")
            csv_path = output_dir / f"{name}-{period_name}.csv"
            if rows:
                with csv_path.open("w", newline="") as stream:
                    writer = csv.DictWriter(stream, fieldnames=list(rows[0]))
                    writer.writeheader()
                    writer.writerows(rows)
            else:
                csv_path.unlink(missing_ok=True)
        summary.append("")
    (output_dir / "baseline.md").write_text("\n".join(summary) + "\n")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, required=True, help="Local directory for aggregate JSON, CSV, and Markdown")
    parser.add_argument("--as-of", type=date.fromisoformat, default=date.today(), help="Reproducible report date (YYYY-MM-DD)")
    args = parser.parse_args()
    property_id = os.environ.get(PROPERTY_ENV, "").strip()
    if not property_id.isdigit():
        parser.error(f"Set {PROPERTY_ENV} to the numeric GA4 property ID")
    write_outputs(run_reports(property_id, args.as_of), args.output_dir)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
