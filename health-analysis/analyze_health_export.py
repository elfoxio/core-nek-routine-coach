from __future__ import annotations
import csv
import json
import math
from collections import defaultdict, Counter
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from statistics import median

INPUT = Path('/Users/kevindevos/Downloads/HealthAutoExport_20260309113058/HealthAutoExport-20250301-20260308.json')
OUT_DIR = Path('/Users/kevindevos/Documents/New project/health-analysis')


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


def corr(a: dict[str, float], b: dict[str, float]):
    k = sorted(set(a) & set(b))
    if len(k) < 3:
        return None, len(k)
    x = [a[i] for i in k]
    y = [b[i] for i in k]
    mx = sum(x) / len(x)
    my = sum(y) / len(y)
    num = sum((i - mx) * (j - my) for i, j in zip(x, y))
    den = math.sqrt(sum((i - mx) ** 2 for i in x) * sum((j - my) ** 2 for j in y))
    if den == 0:
        return None, len(k)
    return num / den, len(k)


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    with INPUT.open() as f:
        root = json.load(f)

    data = root['data']
    metrics = data['metrics']
    workouts = data['workouts']

    metric_daily: dict[str, dict[str, float]] = {}
    metric_units: dict[str, str] = {}

    avg_metrics = {
        'resting_heart_rate',
        'heart_rate',
        'heart_rate_variability',
        'walking_heart_rate_average',
        'respiratory_rate',
        'blood_oxygen_saturation',
        'walking_speed',
        'cycling_speed',
        'body_mass_index',
        'weight_body_mass',
        'body_fat_percentage',
        'physical_effort',
        'cardio_recovery',
        'apple_sleeping_wrist_temperature',
    }

    for m in metrics:
        name = m.get('name')
        if not name:
            continue
        metric_units[name] = m.get('units', '')
        if name == 'sleep_analysis':
            byday = {}
            for p in m.get('data', []):
                dt = parse_dt(p.get('start')) or parse_dt(p.get('end'))
                if not dt:
                    continue
                d = dt.date().isoformat()
                core = to_float(p.get('core')) or 0.0
                rem = to_float(p.get('rem')) or 0.0
                deep = to_float(p.get('deep')) or 0.0
                asleep = to_float(p.get('asleep')) or 0.0
                total = to_float(p.get('totalSleep')) or 0.0
                est = total if total > 0 else (asleep if asleep > 0 else (core + rem + deep))
                byday[d] = est
            metric_daily['sleep_hours_est'] = byday
            metric_units['sleep_hours_est'] = 'hr'
            continue

        tmp = defaultdict(list)
        for p in m.get('data', []):
            q = to_float(p.get('qty'))
            if q is None:
                continue
            dt = parse_dt(p.get('start')) or parse_dt(p.get('date')) or parse_dt(p.get('end'))
            if not dt:
                continue
            tmp[dt.date().isoformat()].append(q)

        byday = {}
        for d, arr in tmp.items():
            byday[d] = (sum(arr) / len(arr)) if name in avg_metrics else sum(arr)
        metric_daily[name] = byday

    # Monthly summary CSV
    target_metrics = [
        'step_count',
        'walking_running_distance',
        'active_energy',
        'sleep_hours_est',
        'resting_heart_rate',
        'heart_rate_variability',
        'walking_heart_rate_average',
        'weight_body_mass',
    ]

    all_months = sorted({d[:7] for name in target_metrics for d in metric_daily.get(name, {})})

    monthly_rows = []
    for month in all_months:
        row = {'month': month}
        for name in target_metrics:
            vals = [v for d, v in metric_daily.get(name, {}).items() if d.startswith(month)]
            row[name] = (sum(vals) / len(vals)) if vals else ''
        monthly_rows.append(row)

    monthly_csv = OUT_DIR / 'monthly_summary.csv'
    with monthly_csv.open('w', newline='') as f:
        w = csv.DictWriter(f, fieldnames=['month'] + target_metrics)
        w.writeheader()
        w.writerows(monthly_rows)

    # Weekly training summary CSV
    week_counts = defaultdict(int)
    week_minutes = defaultdict(float)
    week_distance = defaultdict(float)
    workout_types = Counter()

    for w in workouts:
        workout_types[w.get('name') or 'unknown'] += 1
        sdt = parse_dt(w.get('start'))
        edt = parse_dt(w.get('end'))
        if not (sdt and edt):
            continue
        dur = (edt - sdt).total_seconds() / 60
        if dur <= 0:
            continue
        iso = sdt.isocalendar()
        wk = f'{iso.year}-W{iso.week:02d}'
        week_counts[wk] += 1
        week_minutes[wk] += dur

        dist = 0.0
        for key in ('cyclingDistance', 'walkingAndRunningDistance', 'distance', 'swimDistance'):
            arr = w.get(key)
            if isinstance(arr, list):
                for it in arr:
                    if isinstance(it, dict):
                        q = to_float(it.get('qty'))
                        if q is not None:
                            dist += q
        week_distance[wk] += dist

    weekly_csv = OUT_DIR / 'weekly_training_summary.csv'
    with weekly_csv.open('w', newline='') as f:
        w = csv.DictWriter(f, fieldnames=['week', 'workouts', 'minutes_total', 'minutes_avg_per_workout', 'distance_total'])
        w.writeheader()
        for wk in sorted(week_counts):
            workouts_n = week_counts[wk]
            mins = week_minutes[wk]
            w.writerow({
                'week': wk,
                'workouts': workouts_n,
                'minutes_total': round(mins, 2),
                'minutes_avg_per_workout': round(mins / workouts_n, 2) if workouts_n else '',
                'distance_total': round(week_distance[wk], 2),
            })

    # Headline stats
    def first_last_30(name: str):
        by = metric_daily.get(name, {})
        pts = sorted(by.items())
        if not pts:
            return None
        vals = [v for _, v in pts]
        first = sum(vals[:30]) / min(30, len(vals))
        last = sum(vals[-30:]) / min(30, len(vals))
        delta = last - first
        pct = (delta / first * 100) if first else None
        return first, last, delta, pct

    trends = {k: first_last_30(k) for k in ('step_count', 'walking_running_distance', 'active_energy', 'sleep_hours_est', 'resting_heart_rate', 'heart_rate_variability', 'weight_body_mass')}

    steps = metric_daily.get('step_count', {})
    energy = metric_daily.get('active_energy', {})
    dist = metric_daily.get('walking_running_distance', {})
    rhr = metric_daily.get('resting_heart_rate', {})

    c_steps_dist, n_steps_dist = corr(steps, dist)
    c_steps_energy, n_steps_energy = corr(steps, energy)
    c_steps_rhr, n_steps_rhr = corr(steps, rhr)

    sleep_vals = sorted(metric_daily.get('sleep_hours_est', {}).items())
    sleep_avg = sum(v for _, v in sleep_vals) / len(sleep_vals) if sleep_vals else None

    insights_md = OUT_DIR / 'insights.md'
    with insights_md.open('w') as f:
        f.write('# Health Data Analyse (2025-03-01 t/m 2026-03-08)\n\n')
        f.write('Dit rapport is informatief en vervangt geen medisch advies.\n\n')

        f.write('## Kerncijfers\n')
        f.write(f'- Workouts: {len(workouts)}\n')
        f.write(f'- Top workout types: {", ".join([f"{k} ({v})" for k, v in workout_types.most_common(5)])}\n')
        if sleep_avg is not None:
            f.write(f'- Gemiddelde slaap (geschat): {sleep_avg:.2f} uur/nacht\n')
        f.write('\n')

        f.write('## Trend eerste 30 vs laatste 30 dagen\n')
        for k, label in [
            ('step_count', 'Stappen/dag'),
            ('walking_running_distance', 'Wandel/loop afstand (km/dag)'),
            ('active_energy', 'Active energy (kJ/dag)'),
            ('sleep_hours_est', 'Slaap (uur/nacht)'),
            ('resting_heart_rate', 'Rusthartslag (bpm)'),
            ('heart_rate_variability', 'HRV (ms)'),
            ('weight_body_mass', 'Gewicht (kg)'),
        ]:
            t = trends.get(k)
            if not t:
                continue
            first, last, delta, pct = t
            pct_txt = f'{pct:+.1f}%' if pct is not None else 'n.v.t.'
            f.write(f'- {label}: {first:.2f} -> {last:.2f} ({delta:+.2f}, {pct_txt})\n')
        f.write('\n')

        f.write('## Samenhang\n')
        if c_steps_dist is not None:
            f.write(f'- Stappen vs afstand: r={c_steps_dist:.2f} (n={n_steps_dist})\n')
        if c_steps_energy is not None:
            f.write(f'- Stappen vs active energy: r={c_steps_energy:.2f} (n={n_steps_energy})\n')
        if c_steps_rhr is not None:
            f.write(f'- Stappen vs rusthartslag: r={c_steps_rhr:.2f} (n={n_steps_rhr})\n')
        f.write('\n')

        f.write('## Wat je kan verbeteren\n')
        f.write('- Hou je activiteit consistenter: je stappen zijn beter dan bij de start, maar afstand is in de laatste 30 dagen duidelijk lager. Plan 2-3 langere zone-2 blokken per week (bijv. 45-90 min) naast dagelijkse beweging.\n')
        f.write('- Rusthartslag is hoger in de laatste 30 dagen. Bouw een herstelweek in om de 4e week: ongeveer 30-40% minder volume/intensiteit.\n')
        f.write('- Slaap is sterk verbeterd. Behoud dit met een vaste bedtijd en 7.5-8.5 uur target op trainingsdagen.\n')
        f.write('- Gewicht steeg licht. Als dit onbedoeld is: mik op 250-350 kcal/dag minder via minder ultrabewerkte snacks en alcohol, met eiwitten 1.6-2.0 g/kg/dag.\n')
        f.write('- Voor wielrennen: voeg 2 korte krachtblokken/week toe (core, heupen, rug) van 20-30 min voor blessurepreventie en efficiëntie.\n\n')

        f.write('## Leefstijl optimalisaties (praktisch)\n')
        f.write('- Dagelijks: 8k-12k stappen als basis, ook op rustdagen.\n')
        f.write('- Training: 80/20 verdeling (80% rustig, 20% intens), met maximaal 2 intensieve sessies/week.\n')
        f.write('- Herstel: 1-2 volledige rustdagen of actieve recuperatie per week.\n')
        f.write('- Slaap: stop cafeïne 8 uur voor bed, beperk fel schermlicht in het laatste uur.\n')
        f.write('- Monitoring: let op signalen van overbelasting (RHR stijgt >5 bpm meerdere dagen, slechtere slaap, zware benen). Dan 2-3 lichtere dagen inlassen.\n')

    print(f'Wrote: {monthly_csv}')
    print(f'Wrote: {weekly_csv}')
    print(f'Wrote: {insights_md}')


if __name__ == '__main__':
    main()
