using System.Collections;
using UnityEngine.UI;

namespace MSCLoader;

internal class MSCLoaderCanvasLoading : MonoBehaviour
{
    public bool loadingProgressBarActive = false;

    [Header("Loading Dialog")]
    public GameObject modLoadingUI;
    public GameObject lContainer;
    public Text lHeader, lTitle, lMod;
    public Slider lProgress;
    public Image lBackFade;

    [Header("Update Dialog")]
    public GameObject modUpdateUI;
    public Text uTitle, uStatus;
    public Slider uProgress;

    [Header("Progress bar")]
    public GameObject progressbarUI;
    public GameObject pContainer;
    public Text pTitle, pStatus;
    public Slider pProgress;
    // public Image pBackFade;

    private Coroutine updateUIAnim;

    void Awake()
    {
        modLoadingUI.SetActive(false);
        modUpdateUI.SetActive(false);
        progressbarUI.SetActive(false);
    }
    public void ToggleUpdateUI(bool toggle)
    {
        if (modUpdateUI.activeSelf == toggle) return;
        if (updateUIAnim != null) StopCoroutine(updateUIAnim);
        if (toggle)
        {
            modUpdateUI.transform.localScale = new Vector3(1, 0, 1);
        }
        else
        {
            modUpdateUI.transform.localScale = new Vector3(1, 1, 1);
        }
        updateUIAnim = StartCoroutine(UpdateUIAnim(toggle));
    }
    public void ToggleLoadingUI(bool toggle)
    {
        if (modLoadingUI.activeSelf == toggle) return;
        loadingProgressBarActive = toggle;
        if (toggle)
        {
            lBackFade.color = new Color32(0, 0, 0, 245);
            lContainer.transform.localScale = new Vector3(1, 1, 1);
            modLoadingUI.SetActive(true);
        }
        else
        {
            lContainer.transform.localScale = new Vector3(1, 1, 1);
            StartCoroutine(LoadingUIAnimClose());
        }
    }
    public void ToggleProgressBar(bool toggle)
    {
        if (progressbarUI.activeSelf == toggle) return;
        //  if (pbarUIAnim != null) StopCoroutine(pbarUIAnim);
        loadingProgressBarActive = toggle;
        progressbarUI.SetActive(toggle);
    }
    public void SetUpdate(string title, int progress, int maxProgress, string status)
    {
        SetUpdateTitle(title);
        SetUpdateProgress(progress, maxProgress);
        SetUpdateStatus(status);
        ToggleUpdateUI(true);
    }
    public void SetLoading(string title, int progress, int maxProgress, string status)
    {
        SetLoadingTitle(title);
        SetLoadingProgress(progress, maxProgress);
        SetLoadingStatus(status);
        ToggleLoadingUI(true);
    }
    public void SetProgressbar(string title, int progress, int maxProgress, string status)
    {
        pTitle.text = title.ToUpper();
        pProgress.maxValue = maxProgress;
        pProgress.value = progress;
        pStatus.text = status;
        ToggleProgressBar(true);
    }
    public void UpdateProgressbar(int progress, string status)
    {
        pProgress.value = progress;
        pStatus.text = status;
    }
    public void UpdateProgressbarSetup(string title, int maxProgress)
    {
        pTitle.text = title.ToUpper();
        pProgress.maxValue = maxProgress;
    }
    public void SetUpdateTitle(string title) => uTitle.text = title.ToUpper();
    public void SetUpdateStatus(string status) => uStatus.text = status;
    public void SetLoadingTitle(string title) => lTitle.text = title.ToUpper();
    public void SetLoadingHeader(string header) => lHeader.text = header.ToUpper();
    public void SetLoadingStatus(string mod) => lMod.text = mod;
    public void SetUpdateProgress(int progress, int maxValue)
    {
        uProgress.value = progress;
        uProgress.maxValue = maxValue;
    }
    public void SetUpdateProgress(int progress, string status)
    {
        uProgress.value = progress;
        SetUpdateStatus(status);
    }
    public void ResizeUpdateStatus(bool expand)
    {
        if (expand)
        {
            uStatus.transform.parent.GetComponent<LayoutElement>().preferredHeight = 45;
        }
        else
        {
            uStatus.transform.parent.GetComponent<LayoutElement>().preferredHeight = 20;
        }
    }
    public void SetLoadingProgress(int progress, int maxValue)
    {
        lProgress.value = progress;
        lProgress.maxValue = maxValue;
    }
    public void SetLoadingProgress(string status)
    {
        lProgress.value++;
        SetLoadingStatus(status);
    }
    IEnumerator UpdateUIAnim(bool open)
    {
        if (open)
        {
            modUpdateUI.SetActive(open);
            modUpdateUI.transform.SetAsLastSibling(); //Always on top
            while (modUpdateUI.transform.localScale.y < 1)
            {
                modUpdateUI.transform.localScale = new Vector3(1, (float)System.Math.Round(modUpdateUI.transform.localScale.y + 0.1f, 1), 1);
                yield return null;
            }
        }
        else
        {
            while (modUpdateUI.transform.localScale.y > 0)
            {
                modUpdateUI.transform.localScale = new Vector3(1, (float)System.Math.Round(modUpdateUI.transform.localScale.y - 0.1f, 1), 1);
                yield return null;
            }
            modUpdateUI.SetActive(open);
        }
        updateUIAnim = null;
    }

    IEnumerator LoadingUIAnimClose()
    {
        bool anim = true;
        while (anim)
        {
            if (lBackFade.color.a < 1)
            {
                lBackFade.color = new Color(0, 0, 0, (float)System.Math.Round(lBackFade.color.a - 0.2f, 1));
            }
            if (lContainer.transform.localScale.y > 0)
            {
                lContainer.transform.localScale = new Vector3(1, (float)System.Math.Round(lContainer.transform.localScale.y - 0.2f, 1), 1);
            }
            if (lContainer.transform.localScale.y <= 0 && lBackFade.color.a <= 0)
            {
                anim = false;
            }
            yield return null;
        }
        modLoadingUI.SetActive(false);
    }
}
