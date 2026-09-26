# 该函数始终执行，在开始游戏后进行角色分配后的提示

execute if score lw_p1:全局 lw_p1:游戏时间 matches 20..22 as @a[tag=lw_p1:游戏中,tag=lw_p1:杀手] run titleraw @s title {"rawtext":[{"translate":"lw_p1.roleRemind.killer"}]}
execute if score lw_p1:全局 lw_p1:游戏时间 matches 20..22 as @a[tag=lw_p1:游戏中,tag=lw_p1:警员] run titleraw @s title {"rawtext":[{"translate":"lw_p1.roleRemind.officer"}]}
execute if score lw_p1:全局 lw_p1:游戏时间 matches 20..22 as @a[tag=lw_p1:游戏中,tag=!lw_p1:杀手,tag=!lw_p1:警员] run titleraw @s title {"rawtext":[{"translate":"lw_p1.roleRemind.passenger"}]}

execute if score lw_p1:全局 lw_p1:游戏时间 matches 60..62 as @a[tag=lw_p1:游戏中,tag=lw_p1:杀手] run titleraw @s title {"rawtext":[{"translate":"lw_p1.roleGoal.killer"}]}
execute if score lw_p1:全局 lw_p1:游戏时间 matches 60..62 as @a[tag=lw_p1:游戏中,tag=lw_p1:警员] run titleraw @s title {"rawtext":[{"translate":"lw_p1.roleGoal.officer"}]}
execute if score lw_p1:全局 lw_p1:游戏时间 matches 60..62 as @a[tag=lw_p1:游戏中,tag=!lw_p1:杀手,tag=!lw_p1:警员] run titleraw @s title {"rawtext":[{"translate":"lw_p1.roleGoal.passenger"}]}