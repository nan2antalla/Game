const SCORE_RULES = {
  killZombie: 10,
  killPlayer: 50,
  deathByZombie: -5,
  deathByPlayer: -10,
};

export function applyZombieKillScore(killer) {
  killer.score += SCORE_RULES.killZombie;
  killer.killsZombies += 1;
}

export function applyPlayerDeathScore({ victim, killer, cause }) {
  victim.deaths += 1;
  victim.score += cause === "zombie" ? SCORE_RULES.deathByZombie : SCORE_RULES.deathByPlayer;
  if (killer && cause === "player") {
    killer.kills += 1;
    killer.killsPlayers += 1;
    killer.score += SCORE_RULES.killPlayer;
    killer.killedPlayersList.push(victim.name);
  }
}
