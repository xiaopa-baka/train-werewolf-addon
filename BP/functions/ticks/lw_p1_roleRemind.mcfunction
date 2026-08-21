# 该函数始终执行，在开始游戏后进行角色分配后的提示

execute as @a[scores={"lw_p1:游戏时间"=40},tag=lw_p1:游戏中,tag=lw_p1:杀手] run title @s title "欢迎登车 §c§l杀手"
execute as @a[scores={"lw_p1:游戏时间"=40},tag=lw_p1:游戏中,tag=lw_p1:警员] run title @s title "欢迎登车 §b§l警员"
execute as @a[scores={"lw_p1:游戏时间"=40},tag=lw_p1:游戏中,tag=!lw_p1:杀手,tag=!lw_p1:警员] run title @s title "欢迎登车 §a§l乘客"

execute as @a[scores={"lw_p1:游戏时间"=80},tag=lw_p1:游戏中,tag=lw_p1:杀手] run title @s title "隐藏身份，解决所有人"
execute as @a[scores={"lw_p1:游戏时间"=80},tag=lw_p1:游戏中,tag=lw_p1:警员] run title @s title "保护乘客，找出杀手"
execute as @a[scores={"lw_p1:游戏时间"=80},tag=lw_p1:游戏中,tag=!lw_p1:杀手,tag=!lw_p1:警员] run title @s title "配合警员，安全下车"
