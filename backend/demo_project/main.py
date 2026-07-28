"""Entry point: builds the env/actor/mpc/trainer stack and runs the control loop."""
import yaml
import torch

from envs.observation import build_observation
from models.actor import AdaptiveCostActor
from control.mpc import MPCSolver, apply_phase_prior
from train.ppo import PPOTrainer


def run(config_path: str = "configs/default.yaml"):
    with open(config_path) as f:
        cfg = yaml.safe_load(f)

    actor = AdaptiveCostActor(obs_dim=cfg["obs_dim"], horizon=cfg["horizon"], n_cost=cfg["n_cost"])
    optimizer = torch.optim.Adam(actor.parameters(), lr=cfg["learning_rate"])
    trainer = PPOTrainer(actor, optimizer, clip_ratio=cfg["clip_ratio"])
    solver = MPCSolver(u_max=cfg["u_max"])

    step = 0
    while True:
        state = read_robot_state()
        phase = current_gait_phase(step)
        phase_onehot = torch.zeros(1, 1)

        obs = build_observation(state, phase_onehot)
        residual = actor(obs)
        cost = apply_phase_prior(phase, residual)

        H, g = build_qp(cost)
        u = solver.solve(H, g)
        apply_control(u)

        step += 1
        if step % cfg["update_every"] == 0:
            trainer.update(*collect_rollout())


def read_robot_state():
    raise NotImplementedError("hardware interface stub")


def current_gait_phase(step: int) -> str:
    raise NotImplementedError("gait scheduler stub")


def build_qp(cost):
    raise NotImplementedError("QP assembly stub")


def apply_control(u):
    raise NotImplementedError("actuator interface stub")


def collect_rollout():
    raise NotImplementedError("rollout buffer stub")


if __name__ == "__main__":
    run()
