# 该函数在游戏结束时被调用，清除相关计分板和标签，清空经验，清除有关实体，调整游戏模式，清空背包

tag @a remove lw_p1:游戏结束
tag @a remove lw_p1:任务完成
tag @a remove lw_p1:请求倒计时

tag @a remove lw_p1:游戏中
tag @a remove lw_p1:有任务
tag @a remove lw_p1:任务失败
tag @a remove lw_p1:杀手
tag @a remove lw_p1:警员
tag @a remove lw_p1:倒计时
tag @a remove lw_p1:已提示
tag @a remove lw_p1:禁用手枪
tag @a remove lw_p1:已发奖励
tag @a remove lw_p1:已击杀奖励
tag @a remove lw_p1:任务1
tag @a remove lw_p1:任务2
tag @a remove lw_p1:任务3
tag @a remove lw_p1:任务4
tag @a remove lw_p1:任务5
tag @a remove lw_p1:任务6
# tag @a remove lw_p1:任务7
# tag @a remove lw_p1:任务8
# tag @a remove lw_p1:任务9
# tag @a remove lw_p1:任务10

# 重置本局计分板（保留计分项，保证第二局起计时/结算/任务系统正常）
scoreboard players set lw_p1:全局 lw_p1:游戏时间 0
scoreboard players set lw_p1:全局 lw_p1:死亡加时 0
scoreboard players reset @a lw_p1:游戏时间
scoreboard players reset @a lw_p1:死亡加时
scoreboard players reset @a lw_p1:任务中
scoreboard players reset @a lw_p1:金币

xp -1000l @a

kill @e[type=lw_p1:corpes]
kill @e[type=lw_p1:player_name]
kill @e[type=lw_p1:firecracker]
kill @e[type=lw_p1:pistol]

gamemode adventure @a

clear @a

effect @a clear

give @a lw_p1:guide_book 1 0 {"minecraft:item_lock":{"mode":"lock_in_inventory"}}
give @a lw_p1:tp_game 1 0 {"minecraft:item_lock":{"mode":"lock_in_inventory"}}