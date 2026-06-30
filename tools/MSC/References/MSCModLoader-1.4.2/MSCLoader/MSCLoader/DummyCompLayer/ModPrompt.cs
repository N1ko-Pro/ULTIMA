#if !Mini
using UnityEngine.Events;
namespace MSCLoader;

/// <exclude />
[System.ComponentModel.EditorBrowsable(System.ComponentModel.EditorBrowsableState.Never)]
[System.Obsolete("=> ModUI", true)]
public class ModPrompt
{
    /// <exclude />
    [System.Obsolete("=> ModUI.ShowYesNoMessage", true)]
    public static ModPrompt CreateYesNoPrompt(string message, string title, UnityAction onYes, UnityAction onNo = null, UnityAction onPromptClose = null)
    {
        ModUI.ShowYesNoMessage(message, title, delegate { onYes?.Invoke(); });
        return null;
    }
}
#endif