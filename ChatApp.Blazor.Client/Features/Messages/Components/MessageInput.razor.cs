using Microsoft.AspNetCore.Components;
using Microsoft.AspNetCore.Components.Web;
using Microsoft.AspNetCore.Components.Forms;
using Microsoft.JSInterop;
using ChatApp.Blazor.Client.State;
using ChatApp.Blazor.Client.Models.Auth;
using ChatApp.Blazor.Client.Models.Files;
using ChatApp.Blazor.Client.Models.Messages;
using MudBlazor;

namespace ChatApp.Blazor.Client.Features.Messages.Components;

public partial class MessageInput : IAsyncDisposable
{
    #region Injected Services

    [Inject] private IJSRuntime JS { get; set; } = default!;
    [Inject] private UserState UserState { get; set; } = default!;
    [Inject] private ISnackbar Snackbar { get; set; } = default!;

    #endregion

    #region Parameters - Basic

    /// <summary>
    /// Input placeholder texti.
    /// </summary>
    [Parameter] public string Placeholder { get; set; } = string.Empty;

    /// <summary>
    /// Mesaj göndərilir?
    /// </summary>
    [Parameter] public bool IsSending { get; set; }

    /// <summary>
    /// Conversation ID-si (draft tracking üçün).
    /// </summary>
    [Parameter] public Guid? ConversationId { get; set; }

    #endregion

    #region Parameters - Edit Mode

    /// <summary>
    /// Edit modunda?
    /// </summary>
    [Parameter] public bool IsEditing { get; set; }

    /// <summary>
    /// Redaktə edilən mesajın məzmunu.
    /// </summary>
    [Parameter] public string? EditingContent { get; set; }

    #endregion

    #region Parameters - Reply Mode

    /// <summary>
    /// Reply modunda?
    /// </summary>
    [Parameter] public bool IsReplying { get; set; }

    /// <summary>
    /// Reply edilən mesajın göndərəninin adı.
    /// </summary>
    [Parameter] public string? ReplyToSenderName { get; set; }

    /// <summary>
    /// Reply edilən mesajın məzmunu.
    /// </summary>
    [Parameter] public string? ReplyToContent { get; set; }

    /// <summary>
    /// Reply edilən mesajın fayl ID-si.
    /// </summary>
    [Parameter] public string? ReplyToFileId { get; set; }

    /// <summary>
    /// Reply edilən mesajın fayl adı.
    /// </summary>
    [Parameter] public string? ReplyToFileName { get; set; }

    /// <summary>
    /// Reply edilən mesajın fayl content type-ı.
    /// </summary>
    [Parameter] public string? ReplyToFileContentType { get; set; }

    #endregion

    #region Parameters - Draft Support

    /// <summary>
    /// İlkin draft məzmunu.
    /// </summary>
    [Parameter] public string? InitialDraft { get; set; }

    #endregion

    #region Parameters - Event Callbacks

    /// <summary>
    /// Mesaj göndərmə callback-i (message content + mention edilmiş istifadəçilər).
    /// </summary>
    [Parameter] public EventCallback<(string Message, Dictionary<string, Guid> MentionedUsers)> OnSend { get; set; }

    /// <summary>
    /// Mesaj redaktə callback-i.
    /// </summary>
    [Parameter] public EventCallback<string> OnEdit { get; set; }

    /// <summary>
    /// Edit ləğv etmə callback-i.
    /// </summary>
    [Parameter] public EventCallback OnCancelEdit { get; set; }

    /// <summary>
    /// Reply ləğv etmə callback-i.
    /// </summary>
    [Parameter] public EventCallback OnCancelReply { get; set; }

    /// <summary>
    /// Typing indicator callback-i.
    /// </summary>
    [Parameter] public EventCallback<bool> OnTyping { get; set; }

    /// <summary>
    /// File attach callback-i (legacy - deprecated).
    /// </summary>
    [Parameter] public EventCallback OnAttach { get; set; }

    /// <summary>
    /// Fayllarla mesaj göndərmə callback-i.
    /// </summary>
    [Parameter] public EventCallback<(List<SelectedFile> Files, string Message)> OnSendWithFiles { get; set; }

    /// <summary>
    /// Draft dəyişikliyi callback-i.
    /// </summary>
    [Parameter] public EventCallback<string> OnDraftChanged { get; set; }

    #endregion

    #region Parameters - Mention Support

    /// <summary>
    /// Channel-də olub-olmadığı (mention logic fərqli olur).
    /// </summary>
    [Parameter] public bool IsChannel { get; set; }

    /// <summary>
    /// Channel member-lər (channel mention üçün).
    /// </summary>
    [Parameter] public List<MentionUserDto> ChannelMembers { get; set; } = [];

    /// <summary>
    /// Conversation partner (DM mention üçün).
    /// </summary>
    [Parameter] public MentionUserDto? ConversationPartner { get; set; }

    /// <summary>
    /// Mention user search service callback (istifadəçi axtarışı üçün).
    /// </summary>
    [Parameter] public Func<string, Task<List<MentionUserDto>>>? OnSearchUsers { get; set; }

    #endregion

    #region Private Fields - Constants

    /// <summary>
    /// Maksimum simvol sayı.
    /// </summary>
    private const int MaxLength = 10000;

    /// <summary>
    /// Ümumi emoji-lər.
    /// </summary>
    private readonly string[] CommonEmojis = {
        "😀", "😃", "😄", "😁", "😅", "😂", "🤣", "😊",
        "😇", "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘",
        "😗", "😙", "😚", "😋", "😛", "😜", "🤪", "😝",
        "🤑", "🤗", "🤭", "🤫", "🤔", "🤐", "🤨", "😐",
        "👍", "👎", "👌", "✌️", "🤞", "🤟", "🤘", "🤙",
        "👏", "🙌", "👐", "🤲", "🤝", "🙏", "❤️", "🧡",
        "💛", "💚", "💙", "💜", "🖤", "💔", "💕", "💞",
        "🎉", "🎊", "🎁", "🔥", "⭐", "✨", "💯", "💪"
    };

    #endregion

    #region Private Fields - Element References

    /// <summary>
    /// Textarea DOM reference.
    /// </summary>
    private ElementReference textAreaRef;

    /// <summary>
    /// File input reference.
    /// </summary>
    private InputFile fileInputRef = default!;

    /// <summary>
    /// Mention panel container reference (outside click detection üçün).
    /// </summary>
    private ElementReference mentionPanelContainerRef;

    /// <summary>
    /// DotNet reference for JS interop (outside click handler).
    /// </summary>
    private DotNetObjectReference<MessageInput>? dotNetRef;

    #endregion

    #region Private Fields - UI State

    /// <summary>
    /// Mesaj mətni.
    /// </summary>
    private string MessageText { get; set; } = string.Empty;

    /// <summary>
    /// Emoji picker görünürmü?
    /// </summary>
    private bool showEmojiPicker = false;

    /// <summary>
    /// Typing indicator göndərilib?
    /// </summary>
    private bool isTyping = false;

    /// <summary>
    /// Textarea-ya focus lazımdır?
    /// </summary>
    private bool shouldFocus = false;

    /// <summary>
    /// File selection panel görünürmü?
    /// </summary>
    private bool showFileSelectionPanel = false;

    /// <summary>
    /// Seçilmiş fayllar.
    /// </summary>
    private List<SelectedFile> selectedFiles = new();

    /// <summary>
    /// Mention panel görünürmü?
    /// </summary>
    private bool showMentionPanel = false;

    /// <summary>
    /// Mention panel-də göstəriləcək istifadəçilər.
    /// </summary>
    private List<MentionUserDto> mentionUsers = [];

    /// <summary>
    /// @ simvolunun mətndəki pozisiyası.
    /// </summary>
    private int mentionStartPosition = -1;

    /// <summary>
    /// @ dan sonra yazılan search query.
    /// </summary>
    private string mentionSearchQuery = string.Empty;

    /// <summary>
    /// Mention edilmiş istifadəçilər (FullName -> UserId mapping).
    /// </summary>
    private readonly Dictionary<string, Guid> mentionedUsers = new();

    /// <summary>
    /// Mention mode disabled olub-olmadığı (Esc və ya outside click ilə disabled edilir).
    /// </summary>
    private bool mentionModeDisabled = false;

    #endregion

    #region Private Fields - Tracking

    /// <summary>
    /// Typing timer (2 saniyə sonra typing stop).
    /// </summary>
    private System.Timers.Timer? typingTimer;

    /// <summary>
    /// Typing timer event handler (stored for proper unsubscription).
    /// </summary>
    private System.Timers.ElapsedEventHandler? _typingTimerHandler;

    /// <summary>
    /// Əvvəlki conversation ID.
    /// </summary>
    private Guid? previousConversationId;

    /// <summary>
    /// Əvvəl edit modunda idi?
    /// </summary>
    private bool wasEditing = false;

    /// <summary>
    /// Əvvəl reply modunda idi?
    /// </summary>
    private bool wasReplying = false;

    #endregion

    #region Computed Properties

    /// <summary>
    /// Mesaj göndərmək mümkündür?
    /// </summary>
    private bool CanSend =>
        !string.IsNullOrWhiteSpace(MessageText) &&
        !IsSending &&
        MessageText.Length <= MaxLength;

    /// <summary>
    /// Send button disabled?
    /// </summary>
    private bool SendButtonDisabled => !CanSend || IsSending;

    /// <summary>
    /// Limit yaxınlaşır? (3500+)
    /// </summary>
    private bool IsNearLimit => MessageText.Length >= 3500 && MessageText.Length < MaxLength;

    /// <summary>
    /// Limitdədir?
    /// </summary>
    private bool IsAtLimit => MessageText.Length >= MaxLength;

    #endregion

    #region Lifecycle Methods

    /// <summary>
    /// Komponentin ilk yüklənməsi.
    /// </summary>
    protected override void OnInitialized()
    {
        typingTimer = new System.Timers.Timer(2000);
        _typingTimerHandler = async (s, e) => await StopTyping();
        typingTimer.Elapsed += _typingTimerHandler;
        typingTimer.AutoReset = false;
    }

    /// <summary>
    /// Parameter dəyişiklikləri.
    /// </summary>
    protected override async Task OnParametersSetAsync()
    {
        // Edit mode başladıqda content-i set et
        if (IsEditing && !wasEditing && !string.IsNullOrEmpty(EditingContent))
        {
            MessageText = EditingContent;
            wasEditing = true;
            shouldFocus = true;
        }

        else if (wasEditing && !IsEditing)
        {
            // Edit ləğv edildi/tamamlandı
            MessageText = string.Empty;
            wasEditing = false;
            await ResetTextareaHeight();
        }

        // Reply mode başladıqda focus et
        if (IsReplying && !wasReplying)
        {
            shouldFocus = true;
            wasReplying = true;
        }

        else if (!IsReplying && wasReplying)
        {
            wasReplying = false;
        }

        // Conversation dəyişdikdə draft-ı yüklə və textarea reset et
        if (ConversationId != previousConversationId)
        {
            previousConversationId = ConversationId;
            shouldFocus = true;
            MessageText = InitialDraft ?? string.Empty;

            // Textarea height-i reset et (conversation switch)
            await ResetTextareaHeight();
        }
    }

    /// <summary>
    /// Render-dən sonra focus və textarea reset (əgər MessageText boşdursa).
    /// </summary>
    protected override async Task OnAfterRenderAsync(bool firstRender)
    {
        if (shouldFocus || firstRender)
        {
            shouldFocus = false;
            try
            {
                await textAreaRef.FocusAsync();

                // Əgər MessageText boşdursa, textarea-nın height-ini və value-sunu təmizlə
                if (string.IsNullOrEmpty(MessageText))
                {
                    await JS.InvokeVoidAsync("chatAppUtils.resetTextareaHeight", textAreaRef);
                }
            }
            catch
            {
                // Element hazır olmaya bilər
            }
        }

        // Setup mention panel outside click handler + textarea keydown preventDefault
        if (firstRender)
        {
            try
            {
                dotNetRef = DotNetObjectReference.Create(this);
                await JS.InvokeVoidAsync("setupMentionOutsideClickHandler", dotNetRef);

                // Setup keydown handler - Enter basanda preventDefault et (textarea böyüməsin)
                await JS.InvokeVoidAsync("chatAppUtils.setupTextareaKeydownHandler", textAreaRef);
            }
            catch
            {
                // JS interop xətası
            }
        }
    }

    #endregion

    #region Input Handlers

    /// <summary>
    /// Input dəyişikliyi handler.
    /// </summary>
    private async Task HandleInput(ChangeEventArgs e)
    {
        var newValue = e.Value?.ToString() ?? "";

        // Limit enforce et
        if (newValue.Length > MaxLength)
        {
            newValue = newValue.Substring(0, MaxLength);
        }

        MessageText = newValue;

        // Yazarkən emoji picker bağla
        if (showEmojiPicker)
        {
            showEmojiPicker = false;
        }

        // Typing indicator göndər
        await StartTyping();

        // Textarea auto-resize
        if (string.IsNullOrEmpty(newValue))
        {
            await JS.InvokeVoidAsync("chatAppUtils.resetTextareaHeight", textAreaRef);
        }
        else
        {
            await JS.InvokeVoidAsync("chatAppUtils.autoResizeTextarea", textAreaRef);
        }

        // Draft dəyişikliyini parent-ə bildir
        await OnDraftChanged.InvokeAsync(newValue);

        // Check for mention trigger (@)
        await CheckMentionTrigger();
    }

    private async Task HandleKeyDown(KeyboardEventArgs e)
    {
        // Mention panel açıqdırsa, Enter/Esc keyboard navigation üçündür
        if (showMentionPanel && (e.Key == "Enter" || e.Key == "Escape" || e.Key == "ArrowUp" || e.Key == "ArrowDown"))
        {
            // MentionPanel JS handler idarə edəcək, ignore et
            return;
        }

        if (e.Key == "Enter" && !e.ShiftKey)
        {
            if (showEmojiPicker) showEmojiPicker = false;
            await SendMessage();
        }
        else if (e.Key == "Escape" && showEmojiPicker)
        {
            showEmojiPicker = false;
        }
    }

    /// <summary>
    /// Blur handler.
    /// </summary>
    private async Task HandleBlur()
    {
        await StopTyping();
    }

    #endregion

    #region Typing Indicator

    /// <summary>
    /// Typing başladır.
    /// </summary>
    private async Task StartTyping()
    {
        if (!isTyping)
        {
            isTyping = true;
            await OnTyping.InvokeAsync(true);
        }
        typingTimer?.Stop();
        typingTimer?.Start();
    }

    /// <summary>
    /// Typing dayandırır.
    /// </summary>
    private async Task StopTyping()
    {
        if (isTyping)
        {
            isTyping = false;
            await InvokeAsync(() => OnTyping.InvokeAsync(false));
        }
    }

    #endregion

    #region Send/Edit Methods

    /// <summary>
    /// Mesaj göndərir və ya redaktəni saxlayır.
    /// </summary>
    private async Task SendMessage()
    {
        if (!CanSend) return;

        if (showEmojiPicker) showEmojiPicker = false;

        var message = MessageText.Trim();
        MessageText = string.Empty;
        await StopTyping();

        // Draft-ı təmizlə
        await OnDraftChanged.InvokeAsync(string.Empty);

        if (IsEditing)
        {
            await OnEdit.InvokeAsync(message);
        }
        else
        {
            // Pass the mentionedUsers dictionary directly
            await OnSend.InvokeAsync((message, new Dictionary<string, Guid>(mentionedUsers)));

            // Mention data-sını və mode-u təmizlə
            mentionedUsers.Clear();
            mentionModeDisabled = false;
        }

        shouldFocus = true;

        // Textarea height reset - IMMEDIATELY before StateHasChanged (sync DOM with state)
        try
        {
            await JS.InvokeVoidAsync("chatAppUtils.resetTextareaHeight", textAreaRef);
        }
        catch { }

        StateHasChanged();
    }

    /// <summary>
    /// Edit-i ləğv edir.
    /// </summary>
    private async Task CancelEdit()
    {
        MessageText = string.Empty;
        await OnCancelEdit.InvokeAsync();
        await FocusAsync();
    }

    /// <summary>
    /// Reply-ı ləğv edir.
    /// </summary>
    private async Task CancelReply()
    {
        await OnCancelReply.InvokeAsync();
        await FocusAsync();
    }

    #endregion

    #region Emoji Picker

    /// <summary>
    /// Emoji picker toggle.
    /// </summary>
    private async Task ToggleEmojiPicker()
    {
        showEmojiPicker = !showEmojiPicker;

        if (showEmojiPicker)
        {
            shouldFocus = true;
            StateHasChanged();
            await Task.Delay(10);
            await FocusAsync();
        }
    }

    /// <summary>
    /// Emoji picker bağlama.
    /// </summary>
    private void CloseEmojiPicker()
    {
        showEmojiPicker = false;
    }

    /// <summary>
    /// Emoji əlavə etmə.
    /// </summary>
    private async Task InsertEmoji(string emoji)
    {
        if (MessageText.Length + emoji.Length <= MaxLength)
        {
            MessageText += emoji;
        }
        await FocusAsync();
    }

    #endregion

    #region Attachment

    /// <summary>
    /// Attach click handler - triggers file input.
    /// </summary>
    private async Task OnAttachClick()
    {
        try
        {
            // Trigger hidden file input
            await JS.InvokeVoidAsync("chatAppUtils.clickFileInput", fileInputRef.Element);
        }
        catch (Exception ex)
        {
            Snackbar.Add($"Error opening file picker: {ex.Message}", Severity.Error);
        }
    }

    /// <summary>
    /// Backend tərəfindən qəbul edilən content type-lar.
    /// FileTypeHelper.ContentTypeMapping ilə sinxron olmalıdır.
    /// </summary>
    private static readonly HashSet<string> AllowedContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        // Images
        "image/jpg", "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml", "image/bmp",
        // Documents
        "application/pdf", "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-powerpoint",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "text/plain", "text/csv",
        // Videos
        "video/mp4", "video/mpeg", "video/quicktime", "video/x-msvideo", "video/webm",
        // Audio
        "audio/mpeg", "audio/wav", "audio/ogg", "audio/webm",
        // Archives
        "application/zip", "application/x-rar-compressed", "application/x-7z-compressed",
        "application/x-tar", "application/gzip"
    };

    /// <summary>
    /// File selection handler with validation and preview generation.
    /// </summary>
    private async Task HandleFileSelection(InputFileChangeEventArgs e)
    {
        const long maxFileSize = 100 * 1024 * 1024; // 100MB
        const int maxFileCount = 10; // Maksimum fayl sayı
        var imageExtensions = new[] { ".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp" };

        selectedFiles.Clear();

        try
        {
            var allFiles = e.GetMultipleFiles(maxFileCount + 1); // +1 to detect overflow
            if (allFiles.Count > maxFileCount)
            {
                Snackbar.Add($"Maksimum {maxFileCount} fayl seçə bilərsiniz", Severity.Warning);
            }

            foreach (var browserFile in allFiles.Take(maxFileCount))
            {
                // Validate file size
                if (browserFile.Size > maxFileSize)
                {
                    Snackbar.Add($"{browserFile.Name} exceeds 100MB limit", Severity.Warning);
                    continue;
                }

                // Validate content type - backend yalnız bu tipləri qəbul edir
                if (!AllowedContentTypes.Contains(browserFile.ContentType))
                {
                    Snackbar.Add($"{browserFile.Name}: Bu fayl tipi dəstəklənmir ({browserFile.ContentType})", Severity.Warning);
                    continue;
                }

                // Create SelectedFile model
                var extension = Path.GetExtension(browserFile.Name).ToLowerInvariant();
                var isImage = imageExtensions.Contains(extension);

                var selectedFile = new SelectedFile
                {
                    BrowserFile = browserFile,
                    FileName = browserFile.Name,
                    Extension = extension,
                    SizeInBytes = browserFile.Size,
                    ContentType = browserFile.ContentType,
                    IsImage = isImage,
                    State = UploadState.Pending
                };

                // Generate preview for images
                if (isImage)
                {
                    try
                    {
                        // Resize image for preview (max 400x400)
                        var resizedImage = await browserFile.RequestImageFileAsync(browserFile.ContentType, 400, 400);

                        // Read as data URL
                        using var stream = resizedImage.OpenReadStream(maxFileSize);
                        using var memoryStream = new MemoryStream();
                        await stream.CopyToAsync(memoryStream);
                        var bytes = memoryStream.ToArray();
                        var base64 = Convert.ToBase64String(bytes);
                        selectedFile.PreviewDataUrl = $"data:{browserFile.ContentType};base64,{base64}";
                    }
                    catch
                    {
                        // Silently handle preview generation errors
                    }
                }

                selectedFiles.Add(selectedFile);
            }

            // Əgər fayl seçilibsə
            if (selectedFiles.Count > 0)
            {
                if (selectedFiles.Count == 1)
                {
                    // 1 fayl seçilibsə - panel açılmadan birbaşa göndər
                    await HandleSendWithFiles((selectedFiles.ToList(), MessageText));
                }
                else
                {
                    // 1-dən çox fayl seçilibsə - panel açılsın
                    showFileSelectionPanel = true;
                    StateHasChanged();
                }
            }
        }
        catch (Exception ex)
        {
            Snackbar.Add($"Error selecting files: {ex.Message}", Severity.Error);
        }
    }

    /// <summary>
    /// Close file selection panel.
    /// </summary>
    private void HandleCloseFilePanel()
    {
        showFileSelectionPanel = false;
        selectedFiles.Clear();
        StateHasChanged();
    }

    /// <summary>
    /// Send message with files.
    /// </summary>
    private async Task HandleSendWithFiles((List<SelectedFile> Files, string Message) data)
    {
        try
        {
            // OPTIMISTIC UI: Əvvəlcə paneli bağla, sonra upload başlasın
            // Bu istifadəçiyə dərhal UI feedback verir
            showFileSelectionPanel = false;
            selectedFiles.Clear();
            MessageText = string.Empty;
            StateHasChanged();

            // İndi parent callback-i çağır (upload arxa fonda başlayacaq)
            // fire-and-forget pattern - await etmirik ki, panel bloklanmasın
            _ = OnSendWithFiles.InvokeAsync(data);
        }
        catch (Exception ex)
        {
            Snackbar.Add($"Error sending files: {ex.Message}", Severity.Error);
        }
    }

    /// <summary>
    /// Retry failed file upload.
    /// </summary>
    private async Task HandleRetryFile(SelectedFile file)
    {
        const long maxFileSize = 100 * 1024 * 1024; // 100MB

        try
        {
            file.State = UploadState.Uploading;
            file.UploadProgress = 0;
            file.ErrorMessage = null;
            StateHasChanged();

            // Regenerate preview for images if needed
            if (file.IsImage && string.IsNullOrEmpty(file.PreviewDataUrl))
            {
                try
                {
                    var resizedImage = await file.BrowserFile.RequestImageFileAsync(file.ContentType, 400, 400);
                    using var stream = resizedImage.OpenReadStream(maxFileSize);
                    using var memoryStream = new MemoryStream();
                    await stream.CopyToAsync(memoryStream);
                    var bytes = memoryStream.ToArray();
                    var base64 = Convert.ToBase64String(bytes);
                    file.PreviewDataUrl = $"data:{file.ContentType};base64,{base64}";
                }
                catch
                {
                    // Preview generation is optional
                }
            }

            file.State = UploadState.Pending;
            StateHasChanged();
            Snackbar.Add($"Retry ready: {file.FileName}", Severity.Info);
        }
        catch (Exception ex)
        {
            file.State = UploadState.Failed;
            file.ErrorMessage = ex.Message;
            StateHasChanged();
            Snackbar.Add($"Error preparing retry: {ex.Message}", Severity.Error);
        }
    }

    #endregion

    #region Helper Methods


    /// <summary>
    /// Textarea height-ını reset edir.
    /// </summary>
    private async Task ResetTextareaHeight()
    {
        try
        {
            await JS.InvokeVoidAsync("chatAppUtils.resetTextareaHeight", textAreaRef);
        }
        catch
        {
            // JS interop fail ola bilər
        }
    }

    #endregion

    #region Public Methods

    /// <summary>
    /// Textarea-ya focus edir.
    /// Parent komponentlər üçün public method.
    /// </summary>
    public async Task FocusAsync()
    {
        try
        {
            await textAreaRef.FocusAsync();
        }
        catch
        {
            // Element hazır olmaya bilər
        }
    }

    #endregion

    #region Helper Methods

    /// <summary>
    /// Fayl tipi üçün Material icon qaytarır.
    /// </summary>
    private string GetFileIcon(string? fileName)
    {
        if (string.IsNullOrEmpty(fileName))
            return Icons.Material.Filled.InsertDriveFile;

        var extension = Path.GetExtension(fileName).ToLowerInvariant();
        return extension switch
        {
            ".pdf" => Icons.Material.Filled.PictureAsPdf,
            ".doc" or ".docx" => Icons.Material.Filled.Description,
            ".xls" or ".xlsx" => Icons.Material.Filled.TableChart,
            ".ppt" or ".pptx" => Icons.Material.Filled.Slideshow,
            ".zip" or ".rar" or ".7z" => Icons.Material.Filled.FolderZip,
            ".mp4" or ".avi" or ".mov" or ".mkv" => Icons.Material.Filled.VideoFile,
            ".mp3" or ".wav" or ".flac" => Icons.Material.Filled.AudioFile,
            ".txt" => Icons.Material.Filled.TextSnippet,
            ".jpg" or ".jpeg" or ".png" or ".gif" or ".webp" or ".bmp" => Icons.Material.Filled.Image,
            _ => Icons.Material.Filled.InsertDriveFile
        };
    }

    /// <summary>
    /// Fayl type-ına görə CSS class qaytarır (icon rəngi üçün).
    /// </summary>
    private string GetFileIconClass(string? fileName)
    {
        if (string.IsNullOrEmpty(fileName))
            return string.Empty;

        var extension = Path.GetExtension(fileName).ToLowerInvariant();
        return extension switch
        {
            ".pdf" => "pdf",
            ".doc" or ".docx" => "word",
            ".xls" or ".xlsx" => "excel",
            ".ppt" or ".pptx" => "powerpoint",
            ".zip" or ".rar" or ".7z" => "archive",
            ".mp4" or ".avi" or ".mov" or ".mkv" => "video",
            ".mp3" or ".wav" or ".flac" => "audio",
            ".txt" => "text",
            _ => string.Empty
        };
    }

    #endregion

    #region Mention Support

    /// <summary>
    /// @ simvolu detection - mention panel trigger.
    /// </summary>
    private async Task CheckMentionTrigger()
    {
        try
        {
            var jsModule = await JS.InvokeAsync<IJSObjectReference>("import", "./js/mention.js");
            var result = await jsModule.InvokeAsync<MentionTriggerResult>("getTextBeforeCaret", textAreaRef);

            if (result.MentionStart >= 0)
            {
                // Əgər mention mode disabled-dirsə və @ eyni mövqedə deyilsə, re-enable et
                if (mentionModeDisabled && result.MentionStart != mentionStartPosition)
                {
                    mentionModeDisabled = false;
                }

                // Mention mode disabled-dirsə, trigger-i ignore et
                if (mentionModeDisabled)
                {
                    return;
                }

                // Valid @ trigger tapıldı
                mentionStartPosition = result.MentionStart;
                mentionSearchQuery = result.Text;

                // İstifadəçi siyahısını yüklə
                await LoadMentionUsers();

                showMentionPanel = true;
                StateHasChanged();
            }
            else
            {
                // @ yoxdur və ya invalid - mention mode-u re-enable et
                showMentionPanel = false;
                mentionModeDisabled = false;
                StateHasChanged();
            }
        }
        catch
        {
            // JS interop xətası
            showMentionPanel = false;
            StateHasChanged();
        }
    }

    /// <summary>
    /// Mention panel üçün istifadəçiləri yüklə.
    /// </summary>
    private async Task LoadMentionUsers()
    {
        mentionUsers.Clear();

        if (IsChannel)
        {
            // Channel: "All" + channel members
            // Add "All" option if search query is empty or starts with search query
            if (string.IsNullOrWhiteSpace(mentionSearchQuery) ||
                "all".StartsWith(mentionSearchQuery.ToLower(), StringComparison.OrdinalIgnoreCase))
            {
                mentionUsers.Add(new MentionUserDto
                {
                    Id = Guid.Empty,
                    Name = "All",
                    IsAll = true,
                    IsMember = true
                });
            }

            // Filter by search query
            if (!string.IsNullOrWhiteSpace(mentionSearchQuery))
            {
                var query = mentionSearchQuery.ToLower();
                mentionUsers.AddRange(ChannelMembers.Where(m => m.Name.ToLower().Contains(query)));

                // Search global users if callback provided
                if (OnSearchUsers != null)
                {
                    try
                    {
                        var globalUsers = await OnSearchUsers(mentionSearchQuery);
                        mentionUsers.AddRange(globalUsers.Where(u => !ChannelMembers.Any(m => m.Id == u.Id)));
                    }
                    catch
                    {
                        // Search xətası (ignore)
                    }
                }
            }
            else
            {
                // No search query - show all channel members
                mentionUsers.AddRange(ChannelMembers);
            }
        }
        else
        {
            // Direct Message: conversation partner + global search
            if (ConversationPartner != null)
            {
                if (string.IsNullOrWhiteSpace(mentionSearchQuery) ||
                    ConversationPartner.Name.ToLower().Contains(mentionSearchQuery.ToLower()))
                {
                    mentionUsers.Add(ConversationPartner);
                }
            }

            // Global user search
            if (OnSearchUsers != null && !string.IsNullOrWhiteSpace(mentionSearchQuery))
            {
                try
                {
                    var globalUsers = await OnSearchUsers(mentionSearchQuery);
                    mentionUsers.AddRange(globalUsers.Where(u => u.Id != ConversationPartner?.Id));
                }
                catch
                {
                    // Search xətası (ignore)
                }
            }
        }
    }

    /// <summary>
    /// İstifadəçi seçildikdə mention text-i insert et.
    /// </summary>
    private async Task HandleMentionSelected(MentionUserDto user)
    {
        try
        {
            var jsModule = await JS.InvokeAsync<IJSObjectReference>("import", "./js/mention.js");

            // Mention panel bağla (input event-dən əvvəl)
            showMentionPanel = false;

            // JS mention insert edir: @Ce -> @Ceka
            await jsModule.InvokeVoidAsync("insertMention", textAreaRef, mentionStartPosition, mentionSearchQuery.Length, user.Name);

            // Mention edilmiş istifadəçini track et
            if (!mentionedUsers.ContainsKey(user.Name))
            {
                mentionedUsers[user.Name] = user.Id;
            }

            // MessageText-i sync et (JS-dən gələn dəyişiklik)
            // JS-də input event dispatch edir, amma əlavə olaraq manual sync edirik
            var currentValue = await jsModule.InvokeAsync<string>("getTextareaValue", textAreaRef);
            MessageText = currentValue;

            // Mention mode-u re-enable et (yeni mention üçün)
            mentionModeDisabled = false;
            mentionStartPosition = -1;

            await FocusAsync();
            StateHasChanged();
        }
        catch
        {
            // JS interop xətası
            showMentionPanel = false;
            mentionModeDisabled = false;
        }
    }

    /// <summary>
    /// Mention panel cancel (Esc).
    /// @ simvolu saxlanır, amma mention mode-dan çıxırıq.
    /// </summary>
    private async Task HandleMentionCancel()
    {
        showMentionPanel = false;
        mentionModeDisabled = true; // Mention mode-u disable et
        mentionSearchQuery = string.Empty;
        mentionUsers.Clear();
        await FocusAsync();
    }

    /// <summary>
    /// Outside click handler (JS-dən çağrılır).
    /// </summary>
    [JSInvokable]
    public void OnMentionPanelOutsideClick()
    {
        if (showMentionPanel)
        {
            showMentionPanel = false;
            mentionModeDisabled = true; // Mention mode-u disable et
            mentionSearchQuery = string.Empty;
            mentionUsers.Clear();
            StateHasChanged();
        }
    }


    #endregion

    #region IAsyncDisposable

    /// <summary>
    /// Resurları təmizləyir.
    /// </summary>
    public async ValueTask DisposeAsync()
    {
        // Unsubscribe event handler before disposing timer
        if (typingTimer != null && _typingTimerHandler != null)
        {
            typingTimer.Elapsed -= _typingTimerHandler;
            _typingTimerHandler = null;
        }
        typingTimer?.Dispose();

        // Dispose mention outside click handler
        try
        {
            if (dotNetRef != null)
            {
                await JS.InvokeVoidAsync("disposeMentionOutsideClickHandler");
                dotNetRef.Dispose();
            }
        }
        catch
        {
            // JS interop xətası
        }

        GC.SuppressFinalize(this);
    }

    #endregion

    // Helper class for JS interop
    private class MentionTriggerResult
    {
        public string Text { get; set; } = string.Empty;
        public int MentionStart { get; set; } = -1;
    }
}