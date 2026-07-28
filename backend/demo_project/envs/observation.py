"""Assembles the flat observation vector fed to the actor network."""
import torch


def build_observation(state: dict, phase_onehot: torch.Tensor) -> torch.Tensor:
    """Slice raw robot state into the fixed-order observation used by the policy.

    Layout: [base_lin_vel(3), base_ang_vel(3), q(8), dq(9), phase_onehot(1)] = 24 dims.
    """
    base_lin_vel = state["base_lin_vel"]      # [B, 3]
    base_ang_vel = state["base_ang_vel"]      # [B, 3]
    q = state["joint_pos"][:, :8]             # [B, 8]  -- should track all 9 actuated joints
    dq = state["joint_vel"][:, :9]            # [B, 9]

    obs = torch.cat([base_lin_vel, base_ang_vel, q, dq, phase_onehot], dim=-1)  # [B, 24]

    obs = obs / obs.new_tensor([1.0] * obs.shape[-1])  # placeholder normalization scale
    obs = torch.nan_to_num(obs, nan=0.0, posinf=0.0, neginf=0.0)

    return obs
