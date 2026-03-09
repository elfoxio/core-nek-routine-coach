from __future__ import annotations
import json
import math
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path


def parse_dt(s: str | None):
    if not isinstance(s, str):
        return None
    s = s.strip()
    if len(s) >= 6 and s[-3] == ':' and s[-6] in '+-':
        s = s[:-3] + s[-2:]
    for fmt in ('%Y-%m-%d %H:%M:%S %z', '%Y-%m-%d %H:%M:%S', '%Y-%m-%dT%H:%M:%S%z', '%Y-%m-%dT%H:%M:%S'):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            pass
    return None


def to_float(v):
    if isinstance(v, (int, float)):
        return float(v)
    if isinstance(v, str):
        try:
            return float(v)
        except ValueError:
            return None
    return None


def avg(arr):
    return sum(arr) / len(arr) if arr else None


def corr(a: dict[str, float], b: dict[str, float]):
    k = sorted(set(a) & set(b))
    if len(k) < 3:
        return None
    x = [a[i] for i in k]
    y = [b[i] for i in k]
    mx = avg(x)
    my = avg(y)
    num = sum((i - mx) * (j - my) for i, j in zip(x, y))
    den = math.sqrt(sum((i - mx) ** 2 for i in x) * sum((j - my) ** 2 for j in y))
    if den == 0:
        return None
    return {'r': num / den, 'n': len(k)}


def main():
    if len(sys.argv) < 2:
        print('Gebruik: python3 health-analysis/export_dashboard_payload.py <HealthAutoExport.json>')
        raise SystemExit(1)

    src = Path(sys.argv[1]).expanduser().resolve()
    if not src.exists():
        print(f'Bestand niet gevonden: {src}')
        raise SystemExit(1)

    out = Path.cwd() / 'health-analysis' / 'dashboard-payload.json'
    out.parent.mkdir(parents=True, exist_ok=True)

    with src.open() as f:
        root = json.load(f)

    data = root['data']
    metrics = data['metrics']
    workouts = data['workouts']

    metric_daily = {}
    metric_units = {}
    avg_metrics = {
        'resting_heart_rate', 'heart_rate', 'heart_rate_variability', 'walking_heart_rate_average',
        'respiratory_rate', 'blood_oxygen_saturation', 'walking_speed', 'cycling_speed',
        'weight_body_mass', 'body_mass_index', 'body_fat_percentage', 'physical_effort'
    }

    for metric in metrics:
        name = metric.get('name')
        if not name:
            continue
        metric_units[name] = metric.get('units', '')

        if name == 'sleep_analysis':
            by_day = {}
            for p in metric.get('data', []):
                dt = parse_dt(p.get('start')) or parse_dt(p.get('end'))
                if not dt:
                    continue
                day = dt.date().isoformat()
                core = to_float(p.get('core')) or 0.0
                rem = to_float(p.get('rem')) or 0.0
                deep = to_float(p.get('deep')) or 0.0
                asleep = to_float(p.get('asleep')) or 0.0
                total = to_float(p.get('totalSleep')) or 0.0
                est = total if total > 0 else (asleep if asleep > 0 else core + rem + deep)
                by_day[day] = est
            metric_daily['sleep_hours_est'] = by_day
            metric_units['sleep_hours_est'] = 'hr'
            continue

        tmp = defaultdict(list)
        for p in metric.get('data', []):
            q = to_float(p.get('qty'))
            if q is None:
                continue
            dt = parse_dt(p.get('start')) or parse_dt(p.get('date')) or parse_dt(p.get('end'))
            if not dt:
                continue
            tmp[dt.date().isoformat()].append(q)

        by_day = {}
        for day, arr in tmp.items():
            by_day[day] = avg(arr) if name in avg_metrics else sum(arr)
        metric_daily[name] = by_day

    target_metrics = [
        'step_count', 'walking_running_distance', 'active_energy', 'sleep_hours_est',
        'resting_heart_rate', 'heart_rate_variability', 'walking_heart_rate_average', 'weight_body_mass'
    ]
    all_months = sorted({d[:7] for n in target_metrics for d in metric_daily.get(n, {})})
    monthly_rows = []
    for month in all_months:
        row = {'month': month}
        for name in target_metrics:
            vals = [v for d, v in metric_daily.get(name, {}).items() if d.startswith(month)]
            row[name] = avg(vals) if vals else None
        monthly_rows.append(row)

    workout_types = defaultdict(int)
    total_minutes = 0.0
    for w in workouts:
        workout_types[w.get('name') or 'unknown'] += 1
        s = parse_dt(w.get('start'))
        e = parse_dt(w.get('end'))
        if s and e:
            m = (e - s).total_seconds() / 60
            if m > 0:
                total_minutes += m

    sorted_types = sorted(workout_types.items(), key=lambda x: x[1], reverse=True)
    workout_stats = {
        'count': len(workouts),
        'minutesTotal': total_minutes,
        'minutesAvg': total_minutes / len(workouts) if workouts else 0,
        'topTypes': sorted_types[:5],
    }

    trends = {}
    for name in target_metrics:
        pts = sorted(metric_daily.get(name, {}).items())
        if not pts:
            continue
        vals = [v for _, v in pts]
        first = avg(vals[:30])
        last = avg(vals[-30:])
        if first is None or last is None:
            continue
        trends[name] = {'first': first, 'last': last, 'delta': last - first}

    correlations = {
        'stepsDistance': corr(metric_daily.get('step_count', {}), metric_daily.get('walking_running_distance', {})),
        'stepsEnergy': corr(metric_daily.get('step_count', {}), metric_daily.get('active_energy', {})),
        'stepsRhr': corr(metric_daily.get('step_count', {}), metric_daily.get('resting_heart_rate', {})),
    }

    all_days = sorted({d for obj in metric_daily.values() for d in obj.keys()})
    range_obj = {'start': all_days[0], 'end': all_days[-1]} if all_days else None

    payload = {
        'dashboardPayloadVersion': 1,
        'payload': {
            'metricDaily': metric_daily,
            'metricUnits': metric_units,
            'monthlyRows': monthly_rows,
            'workoutStats': workout_stats,
            'trends': trends,
            'correlations': correlations,
            'range': range_obj,
        }
    }

    with out.open('w') as f:
        json.dump(payload, f)

    size_mb = out.stat().st_size / (1024 * 1024)
    print(f'Gemaakt: {out}')
    print(f'Grootte: {size_mb:.2f} MB')


if __name__ == '__main__':
    main()
