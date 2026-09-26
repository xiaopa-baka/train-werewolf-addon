# 该函数始终执行，了任务系统的逻辑，包括任务提示、任务进度显示、任务完成判定等

## 任务池，在玩家被分配到相应任务后执行

# 任务1，通风任务
execute as @a[tag=lw_p1:任务1,tag=lw_p1:倒计时,tag=!lw_p1:杀手,l=180,lm=60,tag=!lw_p1:已提示] run tellraw @s {"rawtext":[{"translate":"lw_p1.task.1.hint1"}]}
execute as @a[tag=lw_p1:任务1,tag=lw_p1:倒计时,tag=!lw_p1:杀手,scores={lw_p1:计时器=0},l=40,lm=40] run tellraw @s {"rawtext":[{"translate":"lw_p1.task.1.hint2"}]}
execute as @a[tag=lw_p1:任务1,tag=lw_p1:倒计时,tag=!lw_p1:杀手,scores={lw_p1:计时器=0},l=20,lm=20] run tellraw @s {"rawtext":[{"translate":"lw_p1.task.1.hint3"}]}
execute as @a[tag=lw_p1:任务1,tag=lw_p1:倒计时,tag=!lw_p1:杀手,scores={lw_p1:计时器=0},l=20,lm=20] run effect @s nausea 20 0
execute as @a[tag=lw_p1:任务1,tag=lw_p1:倒计时,tag=!lw_p1:杀手,scores={lw_p1:计时器=0},l=20,lm=20] run effect @s poison 20 0

execute as @a[tag=lw_p1:游戏中,tag=lw_p1:任务1,tag=lw_p1:通风中,tag=!lw_p1:杀手,scores={lw_p1:任务中=1}] run title @s actionbar §c▓▓▓▓▓
execute as @a[tag=lw_p1:游戏中,tag=lw_p1:任务1,tag=lw_p1:通风中,tag=!lw_p1:杀手,scores={lw_p1:任务中=40}] run title @s actionbar §c▓▓▓▓
execute as @a[tag=lw_p1:游戏中,tag=lw_p1:任务1,tag=lw_p1:通风中,tag=!lw_p1:杀手,scores={lw_p1:任务中=80}] run title @s actionbar §6▓▓▓
execute as @a[tag=lw_p1:游戏中,tag=lw_p1:任务1,tag=lw_p1:通风中,tag=!lw_p1:杀手,scores={lw_p1:任务中=120}] run title @s actionbar §6▓▓
execute as @a[tag=lw_p1:游戏中,tag=lw_p1:任务1,tag=lw_p1:通风中,tag=!lw_p1:杀手,scores={lw_p1:任务中=160}] run title @s actionbar §a▓

execute as @a[tag=lw_p1:游戏中,tag=lw_p1:任务1,tag=lw_p1:通风中] run scoreboard players add @s lw_p1:任务中 1
execute as @a[tag=lw_p1:游戏中,tag=lw_p1:任务1,tag=!lw_p1:通风中] run scoreboard players set @s lw_p1:任务中 0
execute as @a[tag=lw_p1:游戏中,tag=lw_p1:任务1,tag=lw_p1:通风中,tag=!lw_p1:杀手,scores={lw_p1:任务中=200..}] run tellraw @s {"rawtext":[{"translate":"lw_p1.task.done"}]}
execute as @a[tag=lw_p1:游戏中,tag=lw_p1:任务1,tag=lw_p1:通风中,scores={lw_p1:任务中=200..}] run tag @s add lw_p1:任务完成

# 任务2，蹲坑任务 
execute as @a[tag=lw_p1:任务2,tag=lw_p1:倒计时,tag=!lw_p1:杀手,l=180,lm=60,tag=!lw_p1:已提示] run tellraw @s {"rawtext":[{"translate":"lw_p1.task.2.hint1"}]}
execute as @a[tag=lw_p1:任务2,tag=lw_p1:倒计时,tag=!lw_p1:杀手,scores={lw_p1:计时器=0},l=40,lm=40] run tellraw @s {"rawtext":[{"translate":"lw_p1.task.2.hint2"}]}
execute as @a[tag=lw_p1:任务2,tag=lw_p1:倒计时,tag=!lw_p1:杀手,scores={lw_p1:计时器=0},l=20,lm=20] run tellraw @s {"rawtext":[{"translate":"lw_p1.task.2.hint3"}]}
execute as @a[tag=lw_p1:任务2,tag=lw_p1:倒计时,tag=!lw_p1:杀手,scores={lw_p1:计时器=0},l=20,lm=20] run effect @s speed 20 2
execute as @a[tag=lw_p1:任务2,tag=lw_p1:倒计时,tag=!lw_p1:杀手,scores={lw_p1:计时器=0},l=20,lm=20] run effect @s poison 20 0

execute as @a[tag=lw_p1:游戏中,tag=lw_p1:任务2,tag=lw_p1:蹲坑中,tag=!lw_p1:杀手,scores={lw_p1:任务中=1}] run title @s actionbar §c▓▓▓▓▓
execute as @a[tag=lw_p1:游戏中,tag=lw_p1:任务2,tag=lw_p1:蹲坑中,tag=!lw_p1:杀手,scores={lw_p1:任务中=40}] run title @s actionbar §c▓▓▓▓
execute as @a[tag=lw_p1:游戏中,tag=lw_p1:任务2,tag=lw_p1:蹲坑中,tag=!lw_p1:杀手,scores={lw_p1:任务中=80}] run title @s actionbar §6▓▓▓
execute as @a[tag=lw_p1:游戏中,tag=lw_p1:任务2,tag=lw_p1:蹲坑中,tag=!lw_p1:杀手,scores={lw_p1:任务中=120}] run title @s actionbar §6▓▓
execute as @a[tag=lw_p1:游戏中,tag=lw_p1:任务2,tag=lw_p1:蹲坑中,tag=!lw_p1:杀手,scores={lw_p1:任务中=160}] run title @s actionbar §a▓

execute as @a[tag=lw_p1:游戏中,tag=lw_p1:任务2,tag=lw_p1:蹲坑中] run scoreboard players add @s lw_p1:任务中 1
execute as @a[tag=lw_p1:游戏中,tag=lw_p1:任务2,tag=!lw_p1:蹲坑中] run scoreboard players set @s lw_p1:任务中 0
execute as @a[tag=lw_p1:游戏中,tag=lw_p1:任务2,tag=lw_p1:蹲坑中,tag=!lw_p1:杀手,scores={lw_p1:任务中=200..}] run tellraw @s {"rawtext":[{"translate":"lw_p1.task.done"}]}
execute as @a[tag=lw_p1:游戏中,tag=lw_p1:任务2,tag=lw_p1:蹲坑中,scores={lw_p1:任务中=200..}] run tag @s add lw_p1:任务完成

# 任务3，睡觉任务
execute as @a[tag=lw_p1:任务3,tag=lw_p1:倒计时,tag=!lw_p1:杀手,l=180,lm=60,tag=!lw_p1:已提示] run tellraw @s {"rawtext":[{"translate":"lw_p1.task.3.hint1"}]}
execute as @a[tag=lw_p1:任务3,tag=lw_p1:倒计时,tag=!lw_p1:杀手,scores={lw_p1:计时器=0},l=40,lm=40] run tellraw @s {"rawtext":[{"translate":"lw_p1.task.3.hint2"}]}
execute as @a[tag=lw_p1:任务3,tag=lw_p1:倒计时,tag=!lw_p1:杀手,scores={lw_p1:计时器=0},l=20,lm=20] run tellraw @s {"rawtext":[{"translate":"lw_p1.task.3.hint3"}]}
execute as @a[tag=lw_p1:任务3,tag=lw_p1:倒计时,tag=!lw_p1:杀手,scores={lw_p1:计时器=0},l=20,lm=20] run effect @s darkness 20 0
execute as @a[tag=lw_p1:任务3,tag=lw_p1:倒计时,tag=!lw_p1:杀手,scores={lw_p1:计时器=0},l=20,lm=20] run effect @s slow_falling 20 0

execute as @a[tag=lw_p1:游戏中,tag=lw_p1:任务3,tag=lw_p1:睡觉中,tag=!lw_p1:杀手,scores={lw_p1:任务中=1}] run title @s actionbar §c▓▓▓▓▓
execute as @a[tag=lw_p1:游戏中,tag=lw_p1:任务3,tag=lw_p1:睡觉中,tag=!lw_p1:杀手,scores={lw_p1:任务中=20}] run title @s actionbar §c▓▓▓▓
execute as @a[tag=lw_p1:游戏中,tag=lw_p1:任务3,tag=lw_p1:睡觉中,tag=!lw_p1:杀手,scores={lw_p1:任务中=40}] run title @s actionbar §6▓▓▓
execute as @a[tag=lw_p1:游戏中,tag=lw_p1:任务3,tag=lw_p1:睡觉中,tag=!lw_p1:杀手,scores={lw_p1:任务中=60}] run title @s actionbar §6▓▓
execute as @a[tag=lw_p1:游戏中,tag=lw_p1:任务3,tag=lw_p1:睡觉中,tag=!lw_p1:杀手,scores={lw_p1:任务中=80}] run title @s actionbar §a▓

execute as @a[tag=lw_p1:游戏中,tag=lw_p1:任务3,tag=lw_p1:睡觉中] run scoreboard players add @s lw_p1:任务中 1
execute as @a[tag=lw_p1:游戏中,tag=lw_p1:任务3,tag=lw_p1:睡觉中,tag=!lw_p1:杀手,scores={lw_p1:任务中=100..}] run tellraw @s {"rawtext":[{"translate":"lw_p1.task.done"}]}
execute as @a[tag=lw_p1:游戏中,tag=lw_p1:任务3,tag=lw_p1:睡觉中,scores={lw_p1:任务中=100..}] run tag @s add lw_p1:任务完成

# 任务4，进食任务
execute as @a[tag=lw_p1:任务4,tag=lw_p1:倒计时,tag=!lw_p1:杀手,l=180,lm=60,tag=!lw_p1:已提示] run tellraw @s {"rawtext":[{"translate":"lw_p1.task.4.hint1"}]}
execute as @a[tag=lw_p1:任务4,tag=lw_p1:倒计时,tag=!lw_p1:杀手,scores={lw_p1:计时器=0},l=40,lm=40] run tellraw @s {"rawtext":[{"translate":"lw_p1.task.4.hint2"}]}
execute as @a[tag=lw_p1:任务4,tag=lw_p1:倒计时,tag=!lw_p1:杀手,scores={lw_p1:计时器=0},l=20,lm=20] run tellraw @s {"rawtext":[{"translate":"lw_p1.task.4.hint3"}]}
execute as @a[tag=lw_p1:任务4,tag=lw_p1:倒计时,tag=!lw_p1:杀手,scores={lw_p1:计时器=0},l=20,lm=20] run effect @s hunger 20 0
execute as @a[tag=lw_p1:任务4,tag=lw_p1:倒计时,tag=!lw_p1:杀手,scores={lw_p1:计时器=0},l=20,lm=20] run effect @s slowness 20 2

execute as @a[tag=lw_p1:游戏中,tag=lw_p1:任务4,tag=!lw_p1:杀手,scores={lw_p1:任务中=1}] run title @s actionbar §a▓

execute as @a[tag=lw_p1:游戏中,tag=lw_p1:任务4,tag=!lw_p1:杀手,scores={lw_p1:任务中=1..}] run tellraw @s {"rawtext":[{"translate":"lw_p1.task.done"}]}
execute as @a[tag=lw_p1:游戏中,tag=lw_p1:任务4,scores={lw_p1:任务中=1..}] run tag @s add lw_p1:任务完成

# 任务5，补水任务
execute as @a[tag=lw_p1:任务5,tag=lw_p1:倒计时,tag=!lw_p1:杀手,l=180,lm=60,tag=!lw_p1:已提示] run tellraw @s {"rawtext":[{"translate":"lw_p1.task.5.hint1"}]}
execute as @a[tag=lw_p1:任务5,tag=lw_p1:倒计时,tag=!lw_p1:杀手,scores={lw_p1:计时器=0},l=40,lm=40] run tellraw @s {"rawtext":[{"translate":"lw_p1.task.5.hint2"}]}
execute as @a[tag=lw_p1:任务5,tag=lw_p1:倒计时,tag=!lw_p1:杀手,scores={lw_p1:计时器=0},l=20,lm=20] run tellraw @s {"rawtext":[{"translate":"lw_p1.task.5.hint3"}]}
execute as @a[tag=lw_p1:任务5,tag=lw_p1:倒计时,tag=!lw_p1:杀手,scores={lw_p1:计时器=0},l=20,lm=20] run effect @s weakness 20 0
execute as @a[tag=lw_p1:任务5,tag=lw_p1:倒计时,tag=!lw_p1:杀手,scores={lw_p1:计时器=0},l=20,lm=20] run effect @s slowness 20 2

execute as @a[tag=lw_p1:游戏中,tag=lw_p1:任务5,tag=!lw_p1:杀手,scores={lw_p1:任务中=1..}] run title @s actionbar §a▓

execute as @a[tag=lw_p1:游戏中,tag=lw_p1:任务5,tag=!lw_p1:杀手,scores={lw_p1:任务中=1..}] run tellraw @s {"rawtext":[{"translate":"lw_p1.task.done"}]}
execute as @a[tag=lw_p1:游戏中,tag=lw_p1:任务5,scores={lw_p1:任务中=1..}] run tag @s add lw_p1:任务完成

# 任务6，社交任务
execute as @a[tag=lw_p1:任务6,tag=lw_p1:倒计时,tag=!lw_p1:杀手,l=180,lm=60,tag=!lw_p1:已提示] run tellraw @s {"rawtext":[{"translate":"lw_p1.task.6.hint1"}]}
execute as @a[tag=lw_p1:任务6,tag=lw_p1:倒计时,tag=!lw_p1:杀手,scores={lw_p1:计时器=0},l=40,lm=40] run tellraw @s {"rawtext":[{"translate":"lw_p1.task.6.hint2"}]}
execute as @a[tag=lw_p1:任务6,tag=lw_p1:倒计时,tag=!lw_p1:杀手,scores={lw_p1:计时器=0},l=20,lm=20] run tellraw @s {"rawtext":[{"translate":"lw_p1.task.6.hint3"}]}
execute as @a[tag=lw_p1:任务6,tag=lw_p1:倒计时,tag=!lw_p1:杀手,scores={lw_p1:计时器=0},l=20,lm=20] run effect @s invisibility 20 0
execute as @a[tag=lw_p1:任务6,tag=lw_p1:倒计时,tag=!lw_p1:杀手,scores={lw_p1:计时器=0},l=20,lm=20] run effect @s blindness 20 0

execute as @a[tag=lw_p1:游戏中,tag=lw_p1:任务6,tag=lw_p1:社交中,tag=!lw_p1:杀手,scores={lw_p1:任务中=1}] run title @s actionbar §c▓▓▓▓▓▓
execute as @a[tag=lw_p1:游戏中,tag=lw_p1:任务6,tag=lw_p1:社交中,tag=!lw_p1:杀手,scores={lw_p1:任务中=50}] run title @s actionbar §c▓▓▓▓▓
execute as @a[tag=lw_p1:游戏中,tag=lw_p1:任务6,tag=lw_p1:社交中,tag=!lw_p1:杀手,scores={lw_p1:任务中=100}] run title @s actionbar §6▓▓▓▓
execute as @a[tag=lw_p1:游戏中,tag=lw_p1:任务6,tag=lw_p1:社交中,tag=!lw_p1:杀手,scores={lw_p1:任务中=150}] run title @s actionbar §6▓▓▓
execute as @a[tag=lw_p1:游戏中,tag=lw_p1:任务6,tag=lw_p1:社交中,tag=!lw_p1:杀手,scores={lw_p1:任务中=200}] run title @s actionbar §6▓▓
execute as @a[tag=lw_p1:游戏中,tag=lw_p1:任务6,tag=lw_p1:社交中,tag=!lw_p1:杀手,scores={lw_p1:任务中=250..}] run title @s actionbar §a▓

execute as @a[tag=lw_p1:游戏中,tag=lw_p1:任务6,tag=lw_p1:社交中] run scoreboard players add @s lw_p1:任务中 1
execute as @a[tag=lw_p1:游戏中,tag=lw_p1:任务6,tag=lw_p1:社交中,tag=!lw_p1:杀手,scores={lw_p1:任务中=300..}] run tellraw @s {"rawtext":[{"translate":"lw_p1.task.done"}]}
execute as @a[tag=lw_p1:游戏中,tag=lw_p1:任务6,tag=lw_p1:社交中,scores={lw_p1:任务中=300..}] run tag @s add lw_p1:任务完成

# 若需要任务7，任务8，任务9，任务10 的相关内容，可以在此处添加

execute as @a[tag=lw_p1:有任务,tag=lw_p1:倒计时,tag=!lw_p1:杀手,l=180,lm=60,tag=!lw_p1:已提示] run tag @s add lw_p1:已提示

# 杀手的虚假任务提示
execute as @a[tag=lw_p1:任务1,tag=lw_p1:倒计时,tag=lw_p1:杀手,l=60,lm=20,tag=!lw_p1:已提示] run tellraw @s {"rawtext":[{"translate":"lw_p1.task.fake.1"}]}
execute as @a[tag=lw_p1:任务2,tag=lw_p1:倒计时,tag=lw_p1:杀手,l=60,lm=20,tag=!lw_p1:已提示] run tellraw @s {"rawtext":[{"translate":"lw_p1.task.fake.2"}]}
execute as @a[tag=lw_p1:任务3,tag=lw_p1:倒计时,tag=lw_p1:杀手,l=60,lm=20,tag=!lw_p1:已提示] run tellraw @s {"rawtext":[{"translate":"lw_p1.task.fake.3"}]}
execute as @a[tag=lw_p1:任务4,tag=lw_p1:倒计时,tag=lw_p1:杀手,l=60,lm=20,tag=!lw_p1:已提示] run tellraw @s {"rawtext":[{"translate":"lw_p1.task.fake.4"}]}
execute as @a[tag=lw_p1:任务5,tag=lw_p1:倒计时,tag=lw_p1:杀手,l=60,lm=20,tag=!lw_p1:已提示] run tellraw @s {"rawtext":[{"translate":"lw_p1.task.fake.5"}]}
execute as @a[tag=lw_p1:任务6,tag=lw_p1:倒计时,tag=lw_p1:杀手,l=60,lm=20,tag=!lw_p1:已提示] run tellraw @s {"rawtext":[{"translate":"lw_p1.task.fake.6"}]}

# 若需要任务7，任务8，任务9，任务10 的相关内容，可以在此处添加

execute as @a[tag=lw_p1:有任务,tag=lw_p1:倒计时,tag=lw_p1:杀手,l=60,lm=20,tag=!lw_p1:已提示] run tag @s add lw_p1:已提示
execute as @a[tag=lw_p1:游戏中,tag=lw_p1:有任务,tag=lw_p1:杀手,l=1,lm=1] run tag @s add lw_p1:任务完成