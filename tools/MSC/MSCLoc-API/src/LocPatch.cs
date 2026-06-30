using System;
using System.Collections.Generic;
using System.Reflection;
using System.Reflection.Emit;
using Harmony;

namespace UltimaLoc
{
    /// <summary>
    /// Applies a Harmony transpiler to every method of each target assembly,
    /// rewriting `ldstr` operands whose MakeId is present in LocStore.Map to
    /// their translation. The original .dll on disk is never touched.
    /// Uses the Harmony 1.x API bundled with MSCLoader (0Harmony 1.2).
    /// </summary>
    public static class LocPatch
    {
        private const BindingFlags MemberFlags =
            BindingFlags.Public | BindingFlags.NonPublic |
            BindingFlags.Instance | BindingFlags.Static | BindingFlags.DeclaredOnly;

        /// <summary>
        /// Patch all loaded assemblies whose simple name is in LocStore.Targets.
        /// Returns the number of methods patched.
        /// </summary>
        public static int ApplyToLoadedTargets(HarmonyInstance harmony)
        {
            HarmonyMethod transpiler = new HarmonyMethod(
                typeof(LocPatch).GetMethod(nameof(Transpiler), BindingFlags.Static | BindingFlags.NonPublic));

            int patched = 0;
            foreach (Assembly asm in AppDomain.CurrentDomain.GetAssemblies())
            {
                string name;
                try { name = asm.GetName().Name; }
                catch { continue; }

                if (!LocStore.Targets.Contains(name)) continue;
                patched += PatchAssembly(harmony, asm, transpiler);
            }
            return patched;
        }

        private static int PatchAssembly(HarmonyInstance harmony, Assembly asm, HarmonyMethod transpiler)
        {
            Type[] types;
            try { types = asm.GetTypes(); }
            catch (ReflectionTypeLoadException ex) { types = ex.Types; }
            catch { return 0; }

            int count = 0;
            foreach (Type type in types)
            {
                if (type == null) continue;

                List<MethodBase> members = new List<MethodBase>();
                try { members.AddRange(type.GetMethods(MemberFlags)); } catch { }
                try { members.AddRange(type.GetConstructors(MemberFlags)); } catch { }

                foreach (MethodBase m in members)
                {
                    if (m.IsAbstract || m.ContainsGenericParameters) continue;
                    try { if (m.GetMethodBody() == null) continue; }
                    catch { continue; }

                    // Patching is expensive (Harmony rebuilds the method as a
                    // DynamicMethod). The vast majority of methods carry no
                    // translatable literal, so patching them is pure overhead —
                    // this is what made load time balloon as more tables were
                    // added. Pre-scan the IL and patch ONLY methods that actually
                    // contain a `ldstr` whose text has a translation.
                    if (!MethodHasTranslatableLiteral(m)) continue;

                    try
                    {
                        harmony.Patch(m, null, null, transpiler);
                        count++;
                    }
                    catch
                    {
                        // Some methods can't be patched (intrinsics, etc.) — skip.
                    }
                }
            }
            return count;
        }

        // ── Cheap IL pre-scan ─────────────────────────────────────────────────
        // Walk a method's raw IL and return true as soon as we find a `ldstr`
        // whose literal has a translation. Far cheaper than letting Harmony
        // rebuild every method just to discover most have nothing to change.

        // Operand size (bytes) per opcode value; -1 = unknown, -2 = InlineSwitch
        // (variable). Built once from System.Reflection.Emit.OpCodes so the table
        // can't drift from the runtime's own opcode set.
        private static readonly int[] OneByteOperand = BuildOperandTable(false);
        private static readonly int[] TwoByteOperand = BuildOperandTable(true);

        private static int[] BuildOperandTable(bool twoByte)
        {
            int[] table = new int[256];
            for (int i = 0; i < 256; i++) table[i] = -1;

            foreach (FieldInfo fi in typeof(OpCodes).GetFields(BindingFlags.Public | BindingFlags.Static))
            {
                if (fi.FieldType != typeof(OpCode)) continue;
                OpCode oc = (OpCode)fi.GetValue(null);
                int v = (ushort)oc.Value;
                bool isTwo = (v & 0xFF00) == 0xFE00;
                if (isTwo != twoByte) continue;
                int idx = twoByte ? (v & 0xFF) : v;
                if (idx < 0 || idx > 255) continue;
                table[idx] = OperandSize(oc.OperandType);
            }
            return table;
        }

        private static int OperandSize(OperandType t)
        {
            switch (t)
            {
                case OperandType.InlineNone: return 0;
                case OperandType.ShortInlineBrTarget:
                case OperandType.ShortInlineI:
                case OperandType.ShortInlineVar: return 1;
                case OperandType.InlineVar: return 2;
                case OperandType.InlineBrTarget:
                case OperandType.InlineField:
                case OperandType.InlineI:
                case OperandType.InlineMethod:
                case OperandType.InlineSig:
                case OperandType.InlineString:
                case OperandType.InlineTok:
                case OperandType.InlineType:
                case OperandType.ShortInlineR: return 4;
                case OperandType.InlineI8:
                case OperandType.InlineR: return 8;
                case OperandType.InlineSwitch: return -2;
                default: return -1;
            }
        }

        private const byte LdstrOpcode = 0x72; // single-byte; InlineString operand

        private static bool MethodHasTranslatableLiteral(MethodBase m)
        {
            byte[] il;
            try
            {
                MethodBody body = m.GetMethodBody();
                if (body == null) return false;
                il = body.GetILAsByteArray();
            }
            catch { return false; }
            if (il == null || il.Length == 0) return false;

            Module module = m.Module;
            int pos = 0;
            int len = il.Length;
            while (pos < len)
            {
                byte b = il[pos++];
                int operandSize;
                bool isLdstr = false;
                if (b == 0xFE)
                {
                    if (pos >= len) break;
                    operandSize = TwoByteOperand[il[pos++]];
                }
                else
                {
                    operandSize = OneByteOperand[b];
                    isLdstr = b == LdstrOpcode;
                }

                // Unknown opcode → we can't safely keep our position in the byte
                // stream; fall back to patching so we never miss a literal.
                if (operandSize == -1) return true;

                if (isLdstr)
                {
                    if (pos + 4 > len) break;
                    int token = BitConverter.ToInt32(il, pos);
                    pos += 4;
                    string s = null;
                    try { s = module.ResolveString(token); } catch { }
                    if (!string.IsNullOrEmpty(s))
                    {
                        try
                        {
                            string tr;
                            if (LocStore.TryTranslateBlock(s, out tr)) return true;
                        }
                        catch { }
                    }
                    continue;
                }

                if (operandSize == -2) // InlineSwitch: int32 count + count*int32
                {
                    if (pos + 4 > len) break;
                    int n = BitConverter.ToInt32(il, pos);
                    pos += 4 + (n * 4);
                }
                else
                {
                    pos += operandSize;
                }
            }
            return false;
        }

        // Harmony transpiler: swap translatable ldstr operands in-place.
        private static IEnumerable<CodeInstruction> Transpiler(IEnumerable<CodeInstruction> instructions)
        {
            foreach (CodeInstruction ins in instructions)
            {
                if (ins.opcode == OpCodes.Ldstr && ins.operand is string original)
                {
                    string translated;
                    // Block translation, not just whole-literal: a single code
                    // literal can be a multi-line block (e.g. "TOP SPEED\n" +
                    // "ACCELERATION <color=red>...</color>") that the app extracted
                    // and the user translated as separate lines. TryTranslateBlock
                    // translates each line and rejoins, while still doing the exact
                    // whole-string match first for ordinary single-line literals.
                    if (LocStore.TryTranslateBlock(original, out translated))
                    {
                        ins.operand = translated;
                    }
                }
                yield return ins;
            }
        }
    }
}
