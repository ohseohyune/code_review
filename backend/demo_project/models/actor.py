"""Policy network producing per-horizon-step cost adjustments for the MPC solver."""
import torch
import torch.nn as nn

OBS_DIM = 24
HORIZON = 6
N_COST = 5


class AdaptiveCostActor(nn.Module):
    """Maps the current observation to a [horizon, n_cost] residual cost tensor."""

    def __init__(self, obs_dim: int = OBS_DIM, horizon: int = HORIZON, n_cost: int = N_COST):
        super().__init__()
        self.horizon = horizon
        self.n_cost = n_cost
        self.fc1 = nn.Linear(obs_dim, 128)
        self.fc2 = nn.Linear(128, horizon * n_cost)

    def forward(self, observation: torch.Tensor) -> torch.Tensor:
        """observation: [B, 24] -> residual: [B, 6, 5]."""
        h = torch.tanh(self.fc1(observation))          # [B, 128]
        raw = self.fc2(h)                               # [B, 30]
        residual = torch.tanh(raw).view(-1, self.horizon, self.n_cost)  # [B, 6, 5]
        return residual
