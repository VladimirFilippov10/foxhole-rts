import io

p = 'js/game.js'
lines = io.open(p, encoding='utf-8').read().split('\n')

idx = [i for i, l in enumerate(lines) if l.strip() == '// Big explosion effect']
assert len(idx) == 1, idx
ins_at = idx[0]

block = [
    '                            // ===== ФИКС «артиллерия долбит город, а прочность не падает» =====',
    '                            // Раньше AoE-урон артиллерии применялся только к юнитам —',
    '                            // прочность обороны города (getCityDefenseIntegrity) была',
    '                            // статической и никогда не уменьшалась, поэтому ни игрок,',
    '                            // ни ИИ не могли «сломать» оборону обстрелом. Теперь залп,',
    '                            // пришедшийся по территории вражеского города, списывает',
    '                            // очки прочности его обороны.',
    '                            for (const cp of this.cps) {',
    "                                if (!cp || cp.owner === 'neutral' || cp.owner === u.faction) continue;",
    '                                const dCity = dist(attackTarget.x, attackTarget.y, cp.x, cp.y);',
    '                                if (dCity <= cp.radius + (u.aoeRadius || 0)) {',
    '                                    const cityMult = Math.max(0.4, 1 - (dCity / (cp.radius + (u.aoeRadius || 0))) * 0.5);',
    '                                    this.artilleryDamageToCity(cp, Math.floor(u.dmg * cityMult));',
    "                                    this.addParticles(cp.x, cp.y, '#ff9500', 6);",
    '                                }',
    '                            }',
    '',
]

new_lines = lines[:ins_at] + block + lines[ins_at:]
io.open(p, 'w', encoding='utf-8').write('\n'.join(new_lines))
print('OK')
