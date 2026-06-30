using System.Security.Cryptography;
using System.Text;

namespace UltimaLoc
{
    /// <summary>
    /// Stable string-id contract, shared byte-for-byte across the toolchain:
    ///   'u' + first 16 hex chars of sha256(utf8(text))
    /// Must match Node's stringId.makeStringId and MscLocTool's MakeId so ids
    /// line up between extract / inject / this runtime patcher.
    /// </summary>
    public static class LocId
    {
        // Reusing one provider per thread avoids constructing a fresh SHA-256
        // implementation on every call. Make() is invoked up to 3× per string on
        // the hottest runtime paths (every Text.set_text, every swept Text), so
        // the per-call `SHA256.Create()` allocation dominated load time as more
        // translated UI got built. A HashAlgorithm re-initialises itself on each
        // ComputeHash, so a single instance is safe to reuse sequentially.
        [System.ThreadStatic] private static SHA256 _sha;

        public static string Make(string text)
        {
            SHA256 sha = _sha;
            if (sha == null) { sha = SHA256.Create(); _sha = sha; }

            byte[] hash = sha.ComputeHash(Encoding.UTF8.GetBytes(text ?? string.Empty));
            StringBuilder sb = new StringBuilder(17);
            sb.Append('u');
            for (int i = 0; i < 8; i++)
            {
                sb.Append(hash[i].ToString("x2"));
            }
            return sb.ToString();
        }
    }
}
