# 该函数始终执行，在开始游戏后进行角色分配后的提示
#
# 注意：title 使用特大号字且不会自动换行（超宽会直接溢出到屏幕外），宽度上限很小。
# 因此 title 只放短核心词，所有长句一律放 subtitle（字号更小、宽度容限约为 title 的 2-3 倍）。
# 每条提示都按「先 title 再 subtitle」的顺序执行：title 显示中时 subtitle 会更新当前副标题。

# 角色提示：title = 角色名，subtitle = 欢迎语
execute if score lw_p1:全局 lw_p1:游戏时间 matches 20..22 as @a[tag=lw_p1:游戏中,tag=lw_p1:杀手] run titleraw @s title {"rawtext":[{"translate":"lw_p1.roleTitle.killer"}]}
execute if score lw_p1:全局 lw_p1:游戏时间 matches 20..22 as @a[tag=lw_p1:游戏中,tag=lw_p1:杀手] run titleraw @s subtitle {"rawtext":[{"translate":"lw_p1.roleWelcome"}]}
execute if score lw_p1:全局 lw_p1:游戏时间 matches 20..22 as @a[tag=lw_p1:游戏中,tag=lw_p1:警员] run titleraw @s title {"rawtext":[{"translate":"lw_p1.roleTitle.officer"}]}
execute if score lw_p1:全局 lw_p1:游戏时间 matches 20..22 as @a[tag=lw_p1:游戏中,tag=lw_p1:警员] run titleraw @s subtitle {"rawtext":[{"translate":"lw_p1.roleWelcome"}]}
execute if score lw_p1:全局 lw_p1:游戏时间 matches 20..22 as @a[tag=lw_p1:游戏中,tag=!lw_p1:杀手,tag=!lw_p1:警员] run titleraw @s title {"rawtext":[{"translate":"lw_p1.roleTitle.passenger"}]}
execute if score lw_p1:全局 lw_p1:游戏时间 matches 20..22 as @a[tag=lw_p1:游戏中,tag=!lw_p1:杀手,tag=!lw_p1:警员] run titleraw @s subtitle {"rawtext":[{"translate":"lw_p1.roleWelcome"}]}

# 目标提示：title = 短标签，subtitle = 目标长句
execute if score lw_p1:全局 lw_p1:游戏时间 matches 60..62 as @a[tag=lw_p1:游戏中,tag=lw_p1:杀手] run titleraw @s title {"rawtext":[{"translate":"lw_p1.roleGoalTitle"}]}
execute if score lw_p1:全局 lw_p1:游戏时间 matches 60..62 as @a[tag=lw_p1:游戏中,tag=lw_p1:杀手] run titleraw @s subtitle {"rawtext":[{"translate":"lw_p1.roleGoal.killer"}]}
execute if score lw_p1:全局 lw_p1:游戏时间 matches 60..62 as @a[tag=lw_p1:游戏中,tag=lw_p1:警员] run titleraw @s title {"rawtext":[{"translate":"lw_p1.roleGoalTitle"}]}
execute if score lw_p1:全局 lw_p1:游戏时间 matches 60..62 as @a[tag=lw_p1:游戏中,tag=lw_p1:警员] run titleraw @s subtitle {"rawtext":[{"translate":"lw_p1.roleGoal.officer"}]}
execute if score lw_p1:全局 lw_p1:游戏时间 matches 60..62 as @a[tag=lw_p1:游戏中,tag=!lw_p1:杀手,tag=!lw_p1:警员] run titleraw @s title {"rawtext":[{"translate":"lw_p1.roleGoalTitle"}]}
execute if score lw_p1:全局 lw_p1:游戏时间 matches 60..62 as @a[tag=lw_p1:游戏中,tag=!lw_p1:杀手,tag=!lw_p1:警员] run titleraw @s subtitle {"rawtext":[{"translate":"lw_p1.roleGoal.passenger"}]}
