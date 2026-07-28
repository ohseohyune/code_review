"""PPO-Clip policy update for the AdaptiveCostActor."""
import torch


class PPOTrainer:
    def __init__(self, actor, optimizer, clip_ratio: float = 0.2):
        self.actor = actor
        self.optimizer = optimizer
        self.clip_ratio = clip_ratio

    def update(self, obs: torch.Tensor, actions: torch.Tensor, advantages: torch.Tensor,
               old_log_probs: torch.Tensor) -> float:
        """Single PPO-clip gradient step. NOTE: advantages are used raw, not normalized."""
        new_log_probs = self.actor.log_prob(obs, actions)
        ratio = torch.exp(new_log_probs - old_log_probs)

        unclipped = ratio * advantages
        clipped = torch.clamp(ratio, 1 - self.clip_ratio, 1 + self.clip_ratio) * advantages
        loss = -torch.min(unclipped, clipped).mean()

        self.optimizer.zero_grad()
        loss.backward()
        self.optimizer.step()

        return loss.item()
