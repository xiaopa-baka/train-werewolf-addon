# 该函数始终执行，了任务系统的逻辑，包括任务提示、任务进度显示、任务完成判定等

## 任务池，在玩家被分配到相应任务后执行

# 任务1，通风任务
execute as @a[tag=lw_p1:任务1,tag=lw_p1:倒计时,tag=!lw_p1:杀手,l=180,lm=60,tag=!lw_p1:已提示] run tellraw @s {"rawtext":[{"text":"§a你感觉有点闷，去透透气吧"}]}
execute as @a[tag=lw_p1:任务1,tag=lw_p1:倒计时,tag=!lw_p1:杀手,scores={lw_p1:计时器=0},l=40,lm=40] run tellraw @s {"rawtext":[{"text":"§6你有点喘不过来气，去透透气吧"}]}
execute as @a[tag=lw_p1:任务1,tag=lw_p1:倒计时,tag=!lw_p1:杀手,scores={lw_p1:计时器=0},l=20,lm=20] run tellraw @s {"rawtext":[{"text":"§c你快闷死了，现在必须马上去透气！"}]}
execute as @a[tag=lw_p1:任务1,tag=lw_p1:倒计时,tag=!lw_p1:杀手,scores={lw_p1:计时器=0},l=20,lm=20] run effect @s nausea 20 0
execute as @a[tag=lw_p1:任务1,tag=lw_p1:倒计时,tag=!lw_p1:杀手,scores={lw_p1:计时器=0},l=20,lm=20] run effect @s poison 20 0

execute as @a[tag=lw_p1:游戏中,tag=lw_p1:任务1,tag=lw_p1:通风中,tag=!lw_p1:杀手,scores={lw_p1:任务中=1}] run title @s actionbar §c▓▓▓▓▓
execute as @a[tag=lw_p1:游戏中,tag=lw_p1:任务1,tag=lw_p1:通风中,tag=!lw_p1:杀手,scores={lw_p1:任务中=40}] run title @s actionbar §c▓▓▓▓
execute as @a[tag=lw_p1:游戏中,tag=lw_p1:任务1,tag=lw_p1:通风中,tag=!lw_p1:杀手,scores={lw_p1:任务中=80}] run title @s actionbar §6▓▓▓
execute as @a[tag=lw_p1:游戏中,tag=lw_p1:任务1,tag=lw_p1:通风中,tag=!lw_p1:杀手,scores={lw_p1:任务中=120}] run title @s actionbar §6▓▓
execute as @a[tag=lw_p1:游戏中,tag=lw_p1:任务1,tag=lw_p1:通风中,tag=!lw_p1:杀手,scores={lw_p1:任务中=160}] run title @s actionbar §a▓

execute as @a[tag=lw_p1:游戏中,tag=lw_p1:任务1,tag=lw_p1:通风中] run scoreboard players add @s lw_p1:任务中 1
execute as @a[tag=lw_p1:游戏中,tag=lw_p1:任务1,tag=!lw_p1:通风中] run scoreboard players set @s lw_p1:任务中 0
execute as @a[tag=lw_p1:游戏中,tag=lw_p1:任务1,tag=lw_p1:通风中,tag=!lw_p1:杀手,scores={lw_p1:任务中=200..}] run tellraw @s {"rawtext":[{"text":"§a你感觉好多了"}]}
execute as @a[tag=lw_p1:游戏中,tag=lw_p1:任务1,tag=lw_p1:通风中,scores={lw_p1:任务中=200..}] run tag @s add lw_p1:任务完成

# 任务2，蹲坑任务 
execute as @a[tag=lw_p1:任务2,tag=lw_p1:倒计时,tag=!lw_p1:杀手,l=180,lm=60,tag=!lw_p1:已提示] run tellraw @s {"rawtext":[{"text":"§a你想去上个厕所"}]}
execute as @a[tag=lw_p1:任务2,tag=lw_p1:倒计时,tag=!lw_p1:杀手,scores={lw_p1:计时器=0},l=40,lm=40] run tellraw @s {"rawtext":[{"text":"§6你有点憋不住了，快去上个厕所"}]}
execute as @a[tag=lw_p1:任务2,tag=lw_p1:倒计时,tag=!lw_p1:杀手,scores={lw_p1:计时器=0},l=20,lm=20] run tellraw @s {"rawtext":[{"text":"§c你就要憋死了,厕所在哪里？！"}]}
execute as @a[tag=lw_p1:任务2,tag=lw_p1:倒计时,tag=!lw_p1:杀手,scores={lw_p1:计时器=0},l=20,lm=20] run effect @s speed 20 2
execute as @a[tag=lw_p1:任务2,tag=lw_p1:倒计时,tag=!lw_p1:杀手,scores={lw_p1:计时器=0},l=20,lm=20] run effect @s poison 20 0

execute as @a[tag=lw_p1:游戏中,tag=lw_p1:任务2,tag=lw_p1:蹲坑中,tag=!lw_p1:杀手,scores={lw_p1:任务中=1}] run title @s actionbar §c▓▓▓▓▓
execute as @a[tag=lw_p1:游戏中,tag=lw_p1:任务2,tag=lw_p1:蹲坑中,tag=!lw_p1:杀手,scores={lw_p1:任务中=40}] run title @s actionbar §c▓▓▓▓
execute as @a[tag=lw_p1:游戏中,tag=lw_p1:任务2,tag=lw_p1:蹲坑中,tag=!lw_p1:杀手,scores={lw_p1:任务中=80}] run title @s actionbar §6▓▓▓
execute as @a[tag=lw_p1:游戏中,tag=lw_p1:任务2,tag=lw_p1:蹲坑中,tag=!lw_p1:杀手,scores={lw_p1:任务中=120}] run title @s actionbar §6▓▓
execute as @a[tag=lw_p1:游戏中,tag=lw_p1:任务2,tag=lw_p1:蹲坑中,tag=!lw_p1:杀手,scores={lw_p1:任务中=160}] run title @s actionbar §a▓

execute as @a[tag=lw_p1:游戏中,tag=lw_p1:任务2,tag=lw_p1:蹲坑中] run scoreboard players add @s lw_p1:任务中 1
execute as @a[tag=lw_p1:游戏中,tag=lw_p1:任务2,tag=!lw_p1:蹲坑中] run scoreboard players set @s lw_p1:任务中 0
execute as @a[tag=lw_p1:游戏中,tag=lw_p1:任务2,tag=lw_p1:蹲坑中,tag=!lw_p1:杀手,scores={lw_p1:任务中=200..}] run tellraw @s {"rawtext":[{"text":"§a你感觉好多了"}]}
execute as @a[tag=lw_p1:游戏中,tag=lw_p1:任务2,tag=lw_p1:蹲坑中,scores={lw_p1:任务中=200..}] run tag @s add lw_p1:任务完成

# 任务3，睡觉任务
execute as @a[tag=lw_p1:任务3,tag=lw_p1:倒计时,tag=!lw_p1:杀手,l=180,lm=60,tag=!lw_p1:已提示] run tellraw @s {"rawtext":[{"text":"§a你有点困了，去睡个觉吧"}]}
execute as @a[tag=lw_p1:任务3,tag=lw_p1:倒计时,tag=!lw_p1:杀手,scores={lw_p1:计时器=0},l=40,lm=40] run tellraw @s {"rawtext":[{"text":"§6你的眼皮在打架，睡个觉吧"}]}
execute as @a[tag=lw_p1:任务3,tag=lw_p1:倒计时,tag=!lw_p1:杀手,scores={lw_p1:计时器=0},l=20,lm=20] run tellraw @s {"rawtext":[{"text":"§c你确信再不睡觉就要猝死了！"}]}
execute as @a[tag=lw_p1:任务3,tag=lw_p1:倒计时,tag=!lw_p1:杀手,scores={lw_p1:计时器=0},l=20,lm=20] run effect @s darkness 20 0
execute as @a[tag=lw_p1:任务3,tag=lw_p1:倒计时,tag=!lw_p1:杀手,scores={lw_p1:计时器=0},l=20,lm=20] run effect @s slow_falling 20 0

execute as @a[tag=lw_p1:游戏中,tag=lw_p1:任务3,tag=lw_p1:睡觉中,tag=!lw_p1:杀手,scores={lw_p1:任务中=1}] run title @s actionbar §c▓▓▓▓▓
execute as @a[tag=lw_p1:游戏中,tag=lw_p1:任务3,tag=lw_p1:睡觉中,tag=!lw_p1:杀手,scores={lw_p1:任务中=20}] run title @s actionbar §c▓▓▓▓
execute as @a[tag=lw_p1:游戏中,tag=lw_p1:任务3,tag=lw_p1:睡觉中,tag=!lw_p1:杀手,scores={lw_p1:任务中=40}] run title @s actionbar §6▓▓▓
execute as @a[tag=lw_p1:游戏中,tag=lw_p1:任务3,tag=lw_p1:睡觉中,tag=!lw_p1:杀手,scores={lw_p1:任务中=60}] run title @s actionbar §6▓▓
execute as @a[tag=lw_p1:游戏中,tag=lw_p1:任务3,tag=lw_p1:睡觉中,tag=!lw_p1:杀手,scores={lw_p1:任务中=80}] run title @s actionbar §a▓

execute as @a[tag=lw_p1:游戏中,tag=lw_p1:任务3,tag=lw_p1:睡觉中] run scoreboard players add @s lw_p1:任务中 1
execute as @a[tag=lw_p1:游戏中,tag=lw_p1:任务3,tag=lw_p1:睡觉中,tag=!lw_p1:杀手,scores={lw_p1:任务中=100..}] run tellraw @s {"rawtext":[{"text":"§a你感觉好多了"}]}
execute as @a[tag=lw_p1:游戏中,tag=lw_p1:任务3,tag=lw_p1:睡觉中,scores={lw_p1:任务中=100..}] run tag @s add lw_p1:任务完成

# 任务4，进食任务
execute as @a[tag=lw_p1:任务4,tag=lw_p1:倒计时,tag=!lw_p1:杀手,l=180,lm=60,tag=!lw_p1:已提示] run tellraw @s {"rawtext":[{"text":"§a你有点饿，想吃东西"}]}
execute as @a[tag=lw_p1:任务4,tag=lw_p1:倒计时,tag=!lw_p1:杀手,scores={lw_p1:计时器=0},l=40,lm=40] run tellraw @s {"rawtext":[{"text":"§6你现在特别想吃点什么东西"}]}
execute as @a[tag=lw_p1:任务4,tag=lw_p1:倒计时,tag=!lw_p1:杀手,scores={lw_p1:计时器=0},l=20,lm=20] run tellraw @s {"rawtext":[{"text":"§c你饿得想啃墙，再不吃东西绝对会饿死！"}]}
execute as @a[tag=lw_p1:任务4,tag=lw_p1:倒计时,tag=!lw_p1:杀手,scores={lw_p1:计时器=0},l=20,lm=20] run effect @s hunger 20 0
execute as @a[tag=lw_p1:任务4,tag=lw_p1:倒计时,tag=!lw_p1:杀手,scores={lw_p1:计时器=0},l=20,lm=20] run effect @s slowness 20 2

execute as @a[tag=lw_p1:游戏中,tag=lw_p1:任务4,tag=!lw_p1:杀手,scores={lw_p1:任务中=1}] run title @s actionbar §a▓

execute as @a[tag=lw_p1:游戏中,tag=lw_p1:任务4,tag=!lw_p1:杀手,scores={lw_p1:任务中=1..}] run tellraw @s {"rawtext":[{"text":"§a你感觉好多了"}]}
execute as @a[tag=lw_p1:游戏中,tag=lw_p1:任务4,scores={lw_p1:任务中=1..}] run tag @s add lw_p1:任务完成

# 任务5，补水任务
execute as @a[tag=lw_p1:任务5,tag=lw_p1:倒计时,tag=!lw_p1:杀手,l=180,lm=60,tag=!lw_p1:已提示] run tellraw @s {"rawtext":[{"text":"§a你有点口渴，想喝点什么"}]}
execute as @a[tag=lw_p1:任务5,tag=lw_p1:倒计时,tag=!lw_p1:杀手,scores={lw_p1:计时器=0},l=40,lm=40] run tellraw @s {"rawtext":[{"text":"§6你嘴唇干裂，特别想喝点什么"}]}
execute as @a[tag=lw_p1:任务5,tag=lw_p1:倒计时,tag=!lw_p1:杀手,scores={lw_p1:计时器=0},l=20,lm=20] run tellraw @s {"rawtext":[{"text":"§c你快脱水了，再不补水就会渴死！"}]}
execute as @a[tag=lw_p1:任务5,tag=lw_p1:倒计时,tag=!lw_p1:杀手,scores={lw_p1:计时器=0},l=20,lm=20] run effect @s weakness 20 0
execute as @a[tag=lw_p1:任务5,tag=lw_p1:倒计时,tag=!lw_p1:杀手,scores={lw_p1:计时器=0},l=20,lm=20] run effect @s slowness 20 2

execute as @a[tag=lw_p1:游戏中,tag=lw_p1:任务5,tag=!lw_p1:杀手,scores={lw_p1:任务中=1..}] run title @s actionbar §a▓

execute as @a[tag=lw_p1:游戏中,tag=lw_p1:任务5,tag=!lw_p1:杀手,scores={lw_p1:任务中=1..}] run tellraw @s {"rawtext":[{"text":"§a你感觉好多了"}]}
execute as @a[tag=lw_p1:游戏中,tag=lw_p1:任务5,scores={lw_p1:任务中=1..}] run tag @s add lw_p1:任务完成

# 任务6，社交任务
execute as @a[tag=lw_p1:任务6,tag=lw_p1:倒计时,tag=!lw_p1:杀手,l=180,lm=60,tag=!lw_p1:已提示] run tellraw @s {"rawtext":[{"text":"§a你有点无聊，去找其他人社交吧"}]}
execute as @a[tag=lw_p1:任务6,tag=lw_p1:倒计时,tag=!lw_p1:杀手,scores={lw_p1:计时器=0},l=40,lm=40] run tellraw @s {"rawtext":[{"text":"§6你有点抑郁了，需要找人社交"}]}
execute as @a[tag=lw_p1:任务6,tag=lw_p1:倒计时,tag=!lw_p1:杀手,scores={lw_p1:计时器=0},l=20,lm=20] run tellraw @s {"rawtext":[{"text":"§c你现在重度抑郁，你需要社交！"}]}
execute as @a[tag=lw_p1:任务6,tag=lw_p1:倒计时,tag=!lw_p1:杀手,scores={lw_p1:计时器=0},l=20,lm=20] run effect @s invisibility 20 0
execute as @a[tag=lw_p1:任务6,tag=lw_p1:倒计时,tag=!lw_p1:杀手,scores={lw_p1:计时器=0},l=20,lm=20] run effect @s blindness 20 0

execute as @a[tag=lw_p1:游戏中,tag=lw_p1:任务6,tag=lw_p1:社交中,tag=!lw_p1:杀手,scores={lw_p1:任务中=1}] run title @s actionbar §c▓▓▓▓▓▓
execute as @a[tag=lw_p1:游戏中,tag=lw_p1:任务6,tag=lw_p1:社交中,tag=!lw_p1:杀手,scores={lw_p1:任务中=50}] run title @s actionbar §c▓▓▓▓▓
execute as @a[tag=lw_p1:游戏中,tag=lw_p1:任务6,tag=lw_p1:社交中,tag=!lw_p1:杀手,scores={lw_p1:任务中=100}] run title @s actionbar §6▓▓▓▓
execute as @a[tag=lw_p1:游戏中,tag=lw_p1:任务6,tag=lw_p1:社交中,tag=!lw_p1:杀手,scores={lw_p1:任务中=150}] run title @s actionbar §6▓▓▓
execute as @a[tag=lw_p1:游戏中,tag=lw_p1:任务6,tag=lw_p1:社交中,tag=!lw_p1:杀手,scores={lw_p1:任务中=200}] run title @s actionbar §6▓▓
execute as @a[tag=lw_p1:游戏中,tag=lw_p1:任务6,tag=lw_p1:社交中,tag=!lw_p1:杀手,scores={lw_p1:任务中=250..}] run title @s actionbar §a▓

execute as @a[tag=lw_p1:游戏中,tag=lw_p1:任务6,tag=lw_p1:社交中] run scoreboard players add @s lw_p1:任务中 1
execute as @a[tag=lw_p1:游戏中,tag=lw_p1:任务6,tag=lw_p1:社交中,tag=!lw_p1:杀手,scores={lw_p1:任务中=300..}] run tellraw @s {"rawtext":[{"text":"§a你感觉好多了"}]}
execute as @a[tag=lw_p1:游戏中,tag=lw_p1:任务6,tag=lw_p1:社交中,scores={lw_p1:任务中=300..}] run tag @s add lw_p1:任务完成

# 若需要任务7，任务8，任务9，任务10 的相关内容，可以在此处添加

execute as @a[tag=lw_p1:有任务,tag=lw_p1:倒计时,tag=!lw_p1:杀手,l=180,lm=60,tag=!lw_p1:已提示] run tag @s add lw_p1:已提示

# 杀手的虚假任务提示
execute as @a[tag=lw_p1:任务1,tag=lw_p1:倒计时,tag=lw_p1:杀手,l=60,lm=20,tag=!lw_p1:已提示] run tellraw @s {"rawtext":[{"text":"§c你可以假装去透气"}]}
execute as @a[tag=lw_p1:任务2,tag=lw_p1:倒计时,tag=lw_p1:杀手,l=60,lm=20,tag=!lw_p1:已提示] run tellraw @s {"rawtext":[{"text":"§c你可以假装去上厕所"}]}
execute as @a[tag=lw_p1:任务3,tag=lw_p1:倒计时,tag=lw_p1:杀手,l=60,lm=20,tag=!lw_p1:已提示] run tellraw @s {"rawtext":[{"text":"§c你可以假装去睡觉"}]}
execute as @a[tag=lw_p1:任务4,tag=lw_p1:倒计时,tag=lw_p1:杀手,l=60,lm=20,tag=!lw_p1:已提示] run tellraw @s {"rawtext":[{"text":"§c你可以假装去吃东西"}]}
execute as @a[tag=lw_p1:任务5,tag=lw_p1:倒计时,tag=lw_p1:杀手,l=60,lm=20,tag=!lw_p1:已提示] run tellraw @s {"rawtext":[{"text":"§c你可以假装去喝点什么"}]}
execute as @a[tag=lw_p1:任务6,tag=lw_p1:倒计时,tag=lw_p1:杀手,l=60,lm=20,tag=!lw_p1:已提示] run tellraw @s {"rawtext":[{"text":"§c你可以假装去找别人社交"}]}

# 若需要任务7，任务8，任务9，任务10 的相关内容，可以在此处添加

execute as @a[tag=lw_p1:有任务,tag=lw_p1:倒计时,tag=lw_p1:杀手,l=60,lm=20,tag=!lw_p1:已提示] run tag @s add lw_p1:已提示
execute as @a[tag=lw_p1:游戏中,tag=lw_p1:有任务,tag=lw_p1:杀手,l=1,lm=1] run tag @s add lw_p1:任务完成
