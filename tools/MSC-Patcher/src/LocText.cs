using System;
using System.Reflection;
using Harmony;
using MSCLoader;

namespace UltimaLoc
{
    /// <summary>
    /// Translates UI text that lives in Unity prefabs / asset bundles — i.e. the
    /// custom author-made menus the <c>ldstr</c> transpiler can't reach (the text
    /// is baked into a serialized prefab, not a code literal).
    ///
    /// Two passes, both reflection-only (no compile-time UnityEngine reference,
    /// mirroring <see cref="LocLayout"/>):
    ///   1. A one-time SWEEP of every already-loaded UnityEngine.UI.Text
    ///      (Resources.FindObjectsOfTypeAll) — catches menus already built before
    ///      we installed, including the main-menu panels.
    ///   2. A Harmony postfix on Text.OnEnable — catches text shown afterwards
    ///      (prefabs instantiated later, pages opened on demand).
    ///
    /// In both cases we read the Text's current <c>.text</c>, look it up in the
    /// merged translation table, and replace it only when a match exists. Keys are
    /// content hashes of the exact source string, so only strings the user
    /// actually translated are touched. Never throws.
    /// </summary>
    internal static class LocText
    {
        private static Type T_text;          // UnityEngine.UI.Text
        private static PropertyInfo P_text;  // Text.text { get; set; }

        /// <summary>
        /// Sweep existing Text + hook Text.OnEnable. Returns the number of texts
        /// translated by the initial sweep (the live hook keeps working after).
        /// Returns -1 when the hook could not be installed at all.
        /// </summary>
        public static int Install(HarmonyInstance harmony)
        {
            if (harmony == null) return -1;
            try
            {
                T_text = ResolveTextType();
                if (T_text == null) return -1;

                P_text = T_text.GetProperty("text", BindingFlags.Instance | BindingFlags.Public);
                if (P_text == null || !P_text.CanRead || !P_text.CanWrite) return -1;

                // Live hook: OnEnable is declared on UnityEngine.UI.Graphic
                // (Text's base) as a protected method — GetMethod returns it.
                MethodInfo onEnable = T_text.GetMethod(
                    "OnEnable", BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic);
                if (onEnable != null && !onEnable.IsAbstract)
                {
                    MethodInfo postfix = typeof(LocText).GetMethod(
                        "AfterEnable", BindingFlags.Static | BindingFlags.NonPublic);
                    if (postfix != null)
                    {
                        try { harmony.Patch(onEnable, null, new HarmonyMethod(postfix)); }
                        catch { /* hook optional — sweep still runs */ }
                    }
                }

                // Live hook: the text SETTER. Many mods assign a label's text
                // AFTER it's shown — e.g. MSCLoader SettingsDynamicText that a mod
                // rebuilds/refreshes at runtime (RefreshModSettingsWindow). Those
                // assignments happen after OnEnable, so the postfix above never
                // sees them. A prefix on set_text translates the incoming value in
                // place, covering every assignment (static or dynamic). Modifying
                // the argument (not calling the setter again) avoids recursion.
                MethodInfo setText = P_text.GetSetMethod(true);
                if (setText != null && !setText.IsAbstract)
                {
                    MethodInfo prefix = typeof(LocText).GetMethod(
                        "BeforeSetText", BindingFlags.Static | BindingFlags.NonPublic);
                    if (prefix != null)
                    {
                        try { harmony.Patch(setText, new HarmonyMethod(prefix), null); }
                        catch { /* hook optional — sweep + OnEnable still run */ }
                    }
                }

                // One-time sweep of everything already loaded.
                return SweepExisting();
            }
            catch
            {
                return -1;
            }
        }

        // Find UnityEngine.UI.Text without a compile-time reference. Prefer the
        // type MSCLoader already exposes (SettingsElement.settingName is a Text),
        // falling back to a scan of loaded assemblies.
        private static Type ResolveTextType()
        {
            try
            {
                Type tElement = typeof(Mod).Assembly.GetType("MSCLoader.SettingsElement");
                if (tElement != null)
                {
                    FieldInfo f = tElement.GetField("settingName", BindingFlags.Instance | BindingFlags.Public);
                    if (f != null && f.FieldType != null && f.FieldType.FullName == "UnityEngine.UI.Text")
                        return f.FieldType;
                }
            }
            catch { /* fall through to scan */ }

            foreach (Assembly asm in AppDomain.CurrentDomain.GetAssemblies())
            {
                try
                {
                    Type t = asm.GetType("UnityEngine.UI.Text");
                    if (t != null) return t;
                }
                catch { /* keep scanning */ }
            }
            return null;
        }

        // Translate every UnityEngine.UI.Text currently loaded (active or not),
        // via UnityEngine.Resources.FindObjectsOfTypeAll(Type). Returns the count
        // of texts changed.
        private static int SweepExisting()
        {
            try
            {
                Type tResources = null;
                foreach (Assembly asm in AppDomain.CurrentDomain.GetAssemblies())
                {
                    try { tResources = asm.GetType("UnityEngine.Resources"); if (tResources != null) break; }
                    catch { }
                }
                if (tResources == null) return 0;

                MethodInfo find = tResources.GetMethod(
                    "FindObjectsOfTypeAll", BindingFlags.Static | BindingFlags.Public, null,
                    new Type[] { typeof(Type) }, null);
                if (find == null) return 0;

                Array objs = find.Invoke(null, new object[] { T_text }) as Array;
                if (objs == null) return 0;

                int changed = 0;
                foreach (object o in objs)
                {
                    if (TranslateOne(o)) changed++;
                }
                return changed;
            }
            catch
            {
                return 0;
            }
        }

        // Harmony postfix: __instance is the Text (or a Graphic subclass — we
        // only act on real Text instances).
        private static void AfterEnable(object __instance)
        {
            if (__instance == null || T_text == null || !T_text.IsInstanceOfType(__instance)) return;
            TranslateOne(__instance);
        }

        // Harmony prefix on Text.set_text: translate the value being assigned, in
        // place, before the setter stores it. Catches text written after the
        // component was enabled (dynamic / refreshed labels). The ref-arg edit
        // means the original setter runs exactly once with the translated value —
        // no re-entrancy.
        private static void BeforeSetText(ref string value)
        {
            if (string.IsNullOrEmpty(value) || LocStore.Map.Count == 0) return;
            try
            {
                string tr;
                if (LocStore.TryTranslateBlock(value, out tr) &&
                    !string.Equals(tr, value, StringComparison.Ordinal))
                {
                    value = tr;
                }
            }
            catch { /* never break a text assignment */ }
        }

        // Read one Text's content, translate via the table, write it back when a
        // match exists. Returns true if the text changed.
        private static bool TranslateOne(object text)
        {
            if (text == null || P_text == null) return false;
            try
            {
                string current = P_text.GetValue(text, null) as string;
                if (string.IsNullOrEmpty(current)) return false;

                string translated;
                if (LocStore.TryTranslateBlock(current, out translated) &&
                    !string.Equals(translated, current, StringComparison.Ordinal))
                {
                    P_text.SetValue(text, translated, null);
                    return true;
                }
            }
            catch { /* never break a single Text */ }
            return false;
        }
    }
}
