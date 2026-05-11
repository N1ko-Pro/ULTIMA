local ENUM_CharacterPassives

ENUM_CharacterPassives = "Ab_D;As_D;As_Cri;Bah_D;Bah_Gent;Ban_D;Ban_K;Besh_D;Besh_Mi;Bha_D;Bha_K;Cor_D;Cor_Dr;Cy_D;Cy_H;Eil_D;Eil_Gent;Ga_D;Go_D;Go_Dis;Go_Met;Gru_D;Gru_Kill;He_D;Ilm_D;Ilm_Bed;Ilm_Bleed;Ilm_Pain;Ilse_D;Ils_Reck;Jerg_D;Kel_D;Kel_Kill;Lad_D;Lath_D;Lath_Reck;Lol_D;Lol_Kill_Spider;Lov_D;Lov_Bleed;Lov_LowHP;Lov_Crit;Lov_Damaged;Magl_D;Magl_Rage;Magl_Ally;Mal_D;Mal_Kill;Mas_D;Mas_Dis;Miel_D;Miel_Beast;Mor_D;Myr_D;Myr_Healing;Mys_D;Mys_Weary;Ogh_D;Ogh_Over;Sel_D;Sel_Eclip;Sel_Holy;Sel_Heal;Shar_D;Shar_Des;Sil_D;Sil_Fire;Sil_Plant;Sune_D;Sune_Haste;Sune_Ench;Talona_D;Tal_Hit;Tal_Melee;Tal_Healing;Tal_D;Tal_Thun;Tal_Mad;Temp_D;Temp_Love;Temp_Love_Give;Temp_Crit;Temp_Prone;Tia_D;Tia_Poison;Tia_Greed;Tym_D;Tym_Bold;Tym_Wild;Tym_Fickle;Tyr_D;Tyr_Pure;Tyr_True;Umber_D;Umber_Wet;Vec_D;Vec_Mad;Vlaak_D;Vlaak_Downed;Vlaak_LowHP;Wauk_D;Yond_D;Yond_AC"

function AddCharacterPassives()
    for _, entity in pairs(Ext.Stats.GetStats("Character")) do
        local character = Ext.Stats.Get(entity)
        character.Passives = character.Passives .. ";" .. ENUM_CharacterPassives
    end
end
