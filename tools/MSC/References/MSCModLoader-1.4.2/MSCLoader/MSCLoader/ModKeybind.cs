#if !Mini 
namespace MSCLoader;

/// <summary>
/// Mod Setting base class
/// </summary>
public class ModKeybind
{
    internal string ID;
    internal string Name;
    internal SettingsGroup HeaderElement;
    internal bool IsHeader;

    internal ModKeybind(string id, string name, bool isHeader)
    {
        ID = id;
        Name = name;
        IsHeader = isHeader;
    }
}

/// <summary>
/// Keybind Header
/// </summary>
public class KeybindHeader : ModKeybind
{
    internal Color BackgroundColor = new Color32(95, 34, 18, 255);
    internal Color TextColor = new Color32(236, 229, 2, 255);
    internal bool CollapsedByDefault = false;

    /// <summary>
    /// Collapse this header
    /// </summary>
    public void Collapse() => Collapse(false);

    /// <summary>
    /// Collapse this header without animation
    /// </summary>
    /// <param name="skipAnimation">true = skip collapsing animation</param>
    public void Collapse(bool skipAnimation)
    {
        if (HeaderElement == null) return;
        if (skipAnimation)
        {
            HeaderElement.SetHeaderNoAnim(false);
            return;
        }
        HeaderElement.SetHeader(false);
    }

    /// <summary>
    /// Expand this Header
    /// </summary>
    public void Expand() => Expand(false);

    /// <summary>
    /// Expand this Header without animation
    /// </summary>
    /// <param name="skipAnimation">true = skip expanding animation</param>
    public void Expand(bool skipAnimation)
    {
        if (HeaderElement == null) return;
        if (skipAnimation)
        {
            HeaderElement.SetHeaderNoAnim(true);
            return;
        }
        HeaderElement.SetHeader(true);

    }

    /// <summary>
    /// Change title background color
    /// </summary>
    /// <param name="color">Color value</param>
    public void SetBackgroundColor(Color color)
    {
        if (HeaderElement == null) return;
        HeaderElement.HeaderBackground.color = color;
    }

    /// <summary>
    /// Change title text.
    /// </summary>
    /// <param name="color">Color value</param>
    public void SetTextColor(Color color)
    {
        if (HeaderElement == null) return;
        HeaderElement.HeaderTitle.color = color;
    }


    internal KeybindHeader(string name, Color backgroundColor, Color textColor, bool collapsedByDefault) : base(null, name, true)
    {
        BackgroundColor = backgroundColor;
        TextColor = textColor;
        CollapsedByDefault = collapsedByDefault;
    }
}
/// <summary>
/// Keybind
/// </summary>
public class SettingsKeybind : ModKeybind
{
    internal KeyCode KeybKey;
    internal KeyCode KeybModif;
    internal KeyCode DefaultKeybKey;
    internal KeyCode DefaultKeybModif;
    internal Keybind BCInstance;

    internal SettingsKeybind(string id, string name, KeyCode key, KeyCode modifier) : base(id, name, false)
    {
        KeybKey = key;
        KeybModif = modifier;
        DefaultKeybKey = key;
        DefaultKeybModif = modifier;
    }
    internal void ResetToDefault()
    {
        KeybKey = DefaultKeybKey;
        KeybModif = DefaultKeybModif;
    }

    /// <summary>
    /// Get the current set key for keybind as KeyCode 
    /// (do not use this value for input checking)
    /// </summary>
    public KeyCode GetKeyValue => KeybKey;

    /// <summary>
    /// Get the current set modifier for keybind as KeyCode (if no modifier, KeyCode.None will be returned)
    /// (do not use this value for input checking)
    /// </summary>
    public KeyCode GetModifierValue => KeybModif;

    /// <summary>
    /// Get the current keybind combination as string (if no modifier, only key will be displayed)
    /// (do not parse this value for input checking)
    /// </summary>
    public string GetKeybindValue => KeybModif == KeyCode.None ? FriendlyBindName(KeybKey.ToString()) : $"{FriendlyBindName(KeybModif.ToString())} + {FriendlyBindName(KeybKey.ToString())}";

    /// <summary>
    /// Check if keybind is being hold down. (Same behaviour as unity GetKey)
    /// </summary>
    /// <returns>true, if the keybind is being hold down.</returns>
    public bool GetKeybind()
    {
        if (KeybModif != KeyCode.None)
        {
            return Input.GetKey(KeybModif) && Input.GetKey(KeybKey);
        }

        return Input.GetKey(KeybKey);
    }

    /// <summary>
    /// Check if the keybind was just pressed once. (Same behaviour as unity GetKeyDown)
    /// </summary>
    /// <returns>true, Check if the keybind was just pressed.</returns>
    public bool GetKeybindDown()
    {
        if (KeybModif != KeyCode.None)
        {
            return Input.GetKey(KeybModif) && Input.GetKeyDown(KeybKey);
        }

        return Input.GetKeyDown(KeybKey);
    }

    /// <summary>
    /// Check if the keybind was just released. (Same behaviour as unity GetKeyUp)
    /// </summary>
    /// <returns>true, Check if the keybind was just released.</returns>
    public bool GetKeybindUp()
    {
        if (KeybModif != KeyCode.None)
        {
            return Input.GetKey(KeybModif) && Input.GetKeyUp(KeybKey);
        }

        return Input.GetKeyUp(KeybKey);
    }
    private string FriendlyBindName(string name)
    {
        if (name.StartsWith("Keypad"))
        {
            switch (name)
            {
                case "KeypadDivide":
                    return "Num /";
                case "KeypadMultiply":
                    return "Num *";
                case "KeypadMinus":
                    return "Num -";
                case "KeypadPlus":
                    return "Num +";
                case "KeypadEnter":
                    return "Num Enter";
                case "KeypadEquals":
                    return "Num =";
                case "KeypadPeriod":
                    return "Num .";
            }
            return name.Replace("Keypad", "Num ");
        }

        return name;
    }
}
#endif