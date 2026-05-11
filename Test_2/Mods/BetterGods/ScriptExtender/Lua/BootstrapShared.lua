Ext.Require("Server/BetterGods.lua")

function CharPassiveStatsLoaded()
    AddCharacterPassives()
end

Ext.Events.StatsLoaded:Subscribe(CharPassiveStatsLoaded)