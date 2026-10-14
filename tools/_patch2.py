import io

p = 'js/game.js'
lines = io.open(p, encoding='utf-8').read().split('\n')

# find the line "if (u.useAmmo) {" inside attack section and its closing "}"
anchor = [i for i, l in enumerate(lines) if l.strip() == '// Расход БК при атаке']
assert len(anchor) == 1, anchor
a = anchor[0]
# lines: a -> comment, a+1 -> 'if (u.useAmmo) {', a+2 -> 'u.useAmmo();', a+3 -> '}'
assert lines[a + 1].strip() == 'if (u.useAmmo) {', lines[a + 1]
assert lines[a + 2].strip() == 'u.useAmmo();', lines[a + 2]
assert lines[a + 3].strip() == '}', lines[a + 3]
ins_at = a + 4

block = [
    '',
    '                        // ===== ФИКС «игрок никак не ломает оборону, просто захватывает город» =====',
    '                        // Прямой огонь НЕ-артиллерии по территории вражеского',
    '                        // города тоже списывает прочность его обороны: чтобы',
    '                        // захватить город, теперь надо продавить оборону огнём,',
    '                        // а не просто завести туда юниты.',
    '                        if (!u.aoe && attackTarget && Number.isFinite(attackTarget.x)) {',
    '                            const cityHere = this.findCityTargetFor(u);',
    '                            if (cityHere) {',
    '                                this.artilleryDamageToCity(cityHere, Math.floor((u.dmg || 0) * 0.5));',
    '                            }',
    '                        }',
]

new_lines = lines[:ins_at] + block + lines[ins_at:]
io.open(p, 'w', encoding='utf-8').write('\n'.join(new_lines))
print('OK')
