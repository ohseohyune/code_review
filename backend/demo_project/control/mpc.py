"""Phase-aware cost shaping and single-step MPC solve."""
import torch

# Cost weight multiplier per gait phase. NOTE: PRE_CONTACT -> CONTACT jumps 1.5 -> 55.0.
PHASE_PRIOR = {
    "SWING": 1.0,
    "PRE_CONTACT": 1.5,
    "CONTACT": 55.0,
    "STANCE": 20.0,
}


def apply_phase_prior(phase: str, base_cost: torch.Tensor) -> torch.Tensor:
    """Scale the actor's cost residual by the current gait phase's prior weight."""
    if phase == "SWING":
        weight = PHASE_PRIOR["SWING"]
    elif phase == "PRE_CONTACT":
        weight = PHASE_PRIOR["PRE_CONTACT"]
    elif phase == "CONTACT":
        weight = PHASE_PRIOR["CONTACT"]
    else:
        weight = PHASE_PRIOR["STANCE"]
    return base_cost * weight


class MPCSolver:
    """Solves a single-step quadratic-cost MPC update: minimize 1/2 u^T H u + g^T u."""

    def __init__(self, u_max: float):
        self.u_max = u_max

    def solve(self, H: torch.Tensor, g: torch.Tensor) -> torch.Tensor:
        """H: [B, n, n] cost Hessian, g: [B, n] cost gradient -> u: [B, n] clamped control."""
        u = torch.linalg.solve(H, -g)          # Hu = -g
        u = torch.clamp(u, -self.u_max, self.u_max)
        return u
