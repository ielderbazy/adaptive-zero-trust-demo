# Technical methodology and study limitations

## Research question

How could a continuous user/session risk assessment support the decision logic of a Zero Trust policy engine when both behavioral anomalies and known contextual risks are considered?

This toy example is **illustrative**: it does not test a novel algorithm, estimate statistical accuracy, or connect to a real identity provider, network sensor, PEP, or PDP.

## Input fields

| Feature | Range | Interpretation |
|---|---|---|
| Access hour | 0–23 | Hour of a simulated access request |
| Failed logins | 0–12 | Recent unsuccessful authentication events |
| Requests per minute | 0–500 | Activity intensity |
| Outbound MB | 0–1000 | Approximate transferred volume |
| Location novelty | 0–1 | Synthetic indicator of unfamiliar access location |
| Device risk | 0–1 | Synthetic indication of device compromise/posture |
| Sensitive resource | true / false | Policy-level resource classification |

## Detector

A reference set of 240 normal events is generated using a seeded pseudo-random function. A weighted Euclidean distance is measured between an input session and every reference event. The mean distance to the five nearest events represents an anomaly signal. The model computes a baseline distribution of leave-one-out 5-NN distances; new distances are scaled relative to its 75th and 99th percentiles.

Because the reference is small, synthetic, and non-representative, the score should **not** be interpreted as a calibrated likelihood of attack, an accuracy percentage, or the output of a production-trained model.

## Policy layer

Explainable policy flags increase a separate policy-risk value: login failures, unfamiliar location, poor device posture, excess request rate, high transfer volume, time outside a fixed window, and resource sensitivity. These policy scores are combined with the anomaly value as:

```
composite_risk = round(0.64 * anomaly_score + 0.36 * policy_score)
trust_score = 100 - composite_risk
```

The weights and decision thresholds are arbitrary teaching choices used to illustrate adaptive decisions, not a validated security specification.

| Trust score | Illustrative action |
|---|---|
| 75–100 | ALLOW |
| 45–74 | STEP-UP MFA |
| 0–44 | BLOCK |

No real access is granted or denied. Even the term MFA refers only to a text recommendation on the screen.

## What would be required for meaningful research?

- Obtain appropriately governed, anonymized real-world or benchmark data.
- Define a threat model, baselines, and train/validation/test boundaries.
- Compare this 5-NN detector to rule-only and alternative ML approaches.
- Measure false positive rates, detection recall, latency, robustness, and drift.
- Evaluate bias, privacy, adversarial manipulation, and operational scalability.
- Integrate with a proper PDP/PEP only after independent security review.

## Related primary references

- Rose et al. **NIST SP 800-207: Zero Trust Architecture** (2020): https://doi.org/10.6028/NIST.SP.800-207
- A. Singh et al. A discussion of machine-learning-based intrusion detection should not be conflated with deployment validation; evaluate original studies and dataset provenance before drawing conclusions.

## Reproducibility

No network access, online inference, tracking, or dependency installation is needed. JavaScript baseline data generation uses the fixed seed `2026`; the same session will receive the same result across runs of the same revision.
