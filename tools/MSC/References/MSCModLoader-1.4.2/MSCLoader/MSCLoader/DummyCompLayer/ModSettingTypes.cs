#if !Mini
using UnityEngine.Events;
using UnityEngine.UI;

namespace MSCLoader;

/// <exclude />
[System.ComponentModel.EditorBrowsable(System.ComponentModel.EditorBrowsableState.Never)]
[System.Obsolete("Useless", true)]
public class SettingButton : MonoBehaviour
{
    Settings setting = new Settings("Useless", "Useless", "Useless");
    /// <exclude />
    public bool Enabled { get; set; }
    /// <exclude />
    public string ID { get => setting.ID; set => setting.ID = value; }
    /// <exclude />
    public string Name { get => setting.Vals[0].ToString(); set => setting.Vals[0] = value; }
    /// <exclude />
    public string ButtonText { get => setting.Name; set => setting.Name = value; }
    /// <exclude />
    public void AddAction(UnityAction action, bool ignoreSuspendActions = false)
    {
        return;
    }
    /// <exclude />
    public bool suspendActions = false;
    /// <exclude />
    public Button.ButtonClickedEvent OnClick { get => button.onClick; set => button.onClick = value; }
    /// <exclude />
    public Text nameText;
    /// <exclude />
    public Shadow nameShadow;
    /// <exclude />
    public Button button;
    /// <exclude />
    public Image buttonImage;
    /// <exclude />
    public Text buttonText;
    /// <exclude />
    public Shadow buttonTextShadow;

}
/// <exclude />
[System.ComponentModel.EditorBrowsable(System.ComponentModel.EditorBrowsableState.Never)]
[System.Obsolete("Useless", true)]
public class SettingHeader : MonoBehaviour
{
    Settings setting;
    /// <exclude />
    public bool Enabled { get; set; }
    /// <exclude />
    public float Height { get; set; }
    /// <exclude />
    public Color BackgroundColor { get => (Color)setting.Vals[1]; set => setting.Vals[1] = value; }
    /// <exclude />
    public Color OutlineColor { get => Color.white; set => _ = value; }
    /// <exclude />
    public string Text { get => setting.Name; set => setting.Name = value; }
    /// <exclude />
    public void SettingHeaderC(Settings set)
    {
        setting = set;
    }
    /// <exclude />
    public LayoutElement layoutElement;
    /// <exclude />
    public Image background;
    /// <exclude />
    public Text text;
    /// <exclude />
    public Shadow textShadow;
}
/// <exclude />
[System.ComponentModel.EditorBrowsable(System.ComponentModel.EditorBrowsableState.Never)]
[System.Obsolete("Useless", true)]
public class SettingKeybind : MonoBehaviour
{
    Keybind keyb;
    /// <exclude />
    public bool GetKey() => keyb.GetKeybind();
    /// <exclude />
    public bool GetKeyDown() => keyb.GetKeybindDown();
    /// <exclude />
    public bool GetKeyUp() => keyb.GetKeybindUp();
    /// <exclude />
    public UnityEvent OnKeyDown = new UnityEvent();
    /// <exclude />
    public UnityEvent OnKey = new UnityEvent();
    /// <exclude />
    public UnityEvent OnKeyUp = new UnityEvent();
    /// <exclude />
    public void SettingKeybindC(Keybind key)
    {
        keyb = key;
    }
}
/// <exclude />
[System.ComponentModel.EditorBrowsable(System.ComponentModel.EditorBrowsableState.Never)]
[System.Obsolete("==> SettigsSlider", true)]
public class SettingSlider : MonoBehaviour
{
    SettingsSlider setting;
    SettingsSliderInt settingInt;
    /// <exclude />
    public bool Enabled { get; set; }
    /// <exclude />
    public string ID { get => setting.ID; set => setting.ID = value; }
    /// <exclude />
    public string Name { get => setting.Name; set => setting.Name = value; }
    /// <exclude />
    public float Value { get => setting.Value; set => setting.Value = value; }
    /// <exclude />
    public int ValueInt { get => settingInt.Value; set => settingInt.Value = value; }
    /// <exclude />
    public float MinValue { get; set; }
    /// <exclude />
    public float MaxValue { get; set; }
    /// <exclude />
    public bool WholeNumbers { get; set; }
    /// <exclude />
    public int RoundDigits { get; set; }
    /// <exclude />
    public Slider.SliderEvent OnValueChanged { get; set; }
    internal void setup(SettingsSlider set) => setting = set;
    internal void setup2(SettingsSliderInt set) => settingInt = set;
    /// <exclude />
    public string[] TextValues
    {
        get;
        set;
    }
    /// <exclude />
    public string ValuePrefix
    {
        get;
        set;
    }
    /// <exclude />
    public string ValueSuffix
    {
        get;
        set;
    }
    /// <exclude />
    public Text nameText;
    /// <exclude />
    public Shadow nameShadow;
    /// <exclude />
    public Text valueText;
    /// <exclude />
    public Shadow valueShadow;
    /// <exclude />
    public Slider slider;
    /// <exclude />
    public Image backgroundImage, handleImage;
}
/// <exclude />
[System.ComponentModel.EditorBrowsable(System.ComponentModel.EditorBrowsableState.Never)]
[System.Obsolete("Useless", true)]
public class SettingSpacer : MonoBehaviour
{
    /// <exclude />
    public LayoutElement layoutElement;
    /// <exclude />
    public bool Enabled { get; set; }
    /// <exclude />
    public float Height { get; set; }
}
/// <exclude />
[System.ComponentModel.EditorBrowsable(System.ComponentModel.EditorBrowsableState.Never)]
[System.Obsolete("Useless", true)]
public class SettingText : MonoBehaviour
{
    /// <exclude />
    public Text text;
    /// <exclude />
    public Shadow textShadow;
    /// <exclude />
    public Image background;
    /// <exclude />
    public bool Enabled { get; set; }
    /// <exclude />
    public string Text { get => text.text; set => text.text = value; }
    /// <exclude />
    public Color TextColor { get => text.color; set => text.color = value; }
    /// <exclude />
    public Color BackgroundColor { get => background.color; set => background.color = value; }
}
/// <exclude />
[System.ComponentModel.EditorBrowsable(System.ComponentModel.EditorBrowsableState.Never)]
[System.Obsolete("==> SettigsTextBox", true)]
public class SettingTextBox : MonoBehaviour
{
    SettingsTextBox setting;
    /// <exclude />
    public Text nameText;
    /// <exclude />
    public Shadow nameShadow;
    /// <exclude />
    public InputField inputField;
    /// <exclude />
    public Image inputImage;
    /// <exclude />
    public Text inputPlaceholderText;
    /// <exclude />
    public bool Enabled { get; set; }
    /// <exclude />
    public string ID { get => setting.ID; set => setting.ID = value; }
    /// <exclude />
    public string Name { get => setting.Name; set => setting.Name = value; }
    /// <exclude />
    public string Value { get => setting.Value; set => setting.Value = value; }
    /// <exclude />
    public string Placeholder { get => setting.Placeholder; set => setting.Placeholder = value; }
    /// <exclude />
    public string defaultValue;
    /// <exclude />
    public void SettingTextBoxC(SettingsTextBox set)
    {
        setting = set;
    }

}
/// <exclude />
[System.ComponentModel.EditorBrowsable(System.ComponentModel.EditorBrowsableState.Never)]
[System.Obsolete("==> SettigsCheckBox", true)]
public class SettingToggle : MonoBehaviour
{
    /// <exclude />
    public Text nameText;
    /// <exclude />
    public Shadow nameShadow;
    /// <exclude />
    public Toggle toggle;
    /// <exclude />
    public Image offImage, onImage;
    /// <exclude />
    public bool Enabled { get; set; }
    /// <exclude />
    public string ID { get => setting.ID; set => setting.ID = value; }
    /// <exclude />
    public string Name { get => setting.Name; set => setting.Name = value; }
    /// <exclude />
    public bool Value { get => setting.Value; set => setting.Value = value; }
    /// <exclude />
    public Toggle.ToggleEvent OnValueChanged { get => toggle.onValueChanged; }
    SettingsCheckBox setting;
    /// <exclude />
    public void SettingToggleC(SettingsCheckBox set)
    {
        setting = set;
    }
}

#endif