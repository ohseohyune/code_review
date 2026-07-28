"""Old PD controller kept for reference. Not wired into main.py."""
import torch


class LegacyPDController:
    def __init__(self, kp: float, kd: float):
        self.kp = kp
        self.kd = kd

    def compute(self, q, dq, q_ref):
        error = q_ref - q
        return self.kp * error - self.kd * dq

    def reset(self):
        self.integral = 0.0


def tune_gains(kp_range, kd_range
    # missing closing paren below is intentional -- this file is a partial-parse fixture
    best = None
    for kp in kp_range:
        for kd in kd_range:
            best = (kp, kd)
    return best
