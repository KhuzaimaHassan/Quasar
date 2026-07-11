"use client";

import { useState, useRef, useEffect, useCallback, KeyboardEvent } from "react";
import { Send, Square, Paperclip, X, Loader2, Check, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  type UploadedAttachment,
  type AttachmentUpload,
  isImageMimeType,
  formatFileSize,
} from "@/lib/attachment-types";
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from "@/lib/validations/attachment";

interface ChatInputProps {
  onSend: (content: string, attachments: UploadedAttachment[]) => void;
  isSending: boolean;
  onStop: () => void;
  /** Conversation ID needed to request presigned upload URLs */
  conversationId: string;
}

/** File extensions accepted by the hidden file input */
const ACCEPTED_EXTENSIONS = ".png,.jpeg,.jpg,.pdf,.docx";

export function ChatInput({ onSend, isSending, onStop, conversationId }: ChatInputProps) {
  const [content, setContent] = useState("");
  const [attachments, setAttachments] = useState<AttachmentUpload[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-resize textarea logic
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    // Reset height to minimum to recalculate scrollHeight
    textarea.style.height = "auto";
    
    // The max-h-40 class handles the max height, so we just set it to scrollHeight
    // It will overflow and become scrollable automatically if scrollHeight > max-height
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [content]);

  // Cleanup object URLs on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      attachments.forEach((a) => {
        if (a.previewUrl) URL.revokeObjectURL(a.previewUrl);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Upload a single file: request presigned URL, then PUT to Supabase Storage */
  const uploadFile = useCallback(async (file: File, attachmentId: string) => {
    try {
      // 1. Request presigned upload URL from our API
      const res = await fetch(`/api/conversations/${conversationId}/attachments/upload-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Upload failed' }));
        throw new Error(err.message || `Upload failed (${res.status})`);
      }

      const { uploadUrl, storagePath, url } = await res.json();

      // 2. Upload the file directly to Supabase Storage using the presigned URL
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type,
        },
        body: file,
      });

      if (!uploadRes.ok) {
        throw new Error('Failed to upload file to storage');
      }

      // 3. Mark as done
      setAttachments((prev) =>
        prev.map((a) =>
          a.id === attachmentId
            ? { ...a, status: 'done' as const, storagePath, url }
            : a
        )
      );
    } catch (err: any) {
      setAttachments((prev) =>
        prev.map((a) =>
          a.id === attachmentId
            ? { ...a, status: 'error' as const, errorMessage: err.message || 'Upload failed' }
            : a
        )
      );
    }
  }, [conversationId]);

  /** Validate and start uploading selected files */
  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newAttachments: AttachmentUpload[] = [];

    for (const file of Array.from(files)) {
      // Client-side validation: mime type
      if (!ALLOWED_MIME_TYPES.includes(file.type as any)) {
        alert(`"${file.name}" is not a supported file type.\nAllowed: PNG, JPEG, PDF, DOCX`);
        continue;
      }

      // Client-side validation: file size
      if (file.size > MAX_FILE_SIZE_BYTES) {
        alert(`"${file.name}" exceeds the 25MB size limit.\nSize: ${formatFileSize(file.size)}`);
        continue;
      }

      const id = crypto.randomUUID();
      const previewUrl = isImageMimeType(file.type) ? URL.createObjectURL(file) : undefined;

      const attachment: AttachmentUpload = {
        id,
        file,
        filename: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        status: 'uploading',
        previewUrl,
      };

      newAttachments.push(attachment);
    }

    if (newAttachments.length > 0) {
      setAttachments((prev) => [...prev, ...newAttachments]);

      // Immediately kick off uploads in the background
      newAttachments.forEach((a) => uploadFile(a.file, a.id));
    }

    // Reset the file input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [uploadFile]);

  /** Remove an attachment (and revoke its preview URL) */
  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => {
      const target = prev.find((a) => a.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((a) => a.id !== id);
    });
  }, []);

  const handleSend = () => {
    const trimmed = content.trim();
    const doneAttachments = attachments.filter((a) => a.status === 'done');

    // Allow sending if there's text OR at least one uploaded attachment
    if ((!trimmed && doneAttachments.length === 0) || isSending) return;

    // Convert AttachmentUpload[] → UploadedAttachment[]
    const uploaded: UploadedAttachment[] = doneAttachments.map((a) => ({
      id: a.id,
      filename: a.filename,
      mimeType: a.mimeType,
      sizeBytes: a.sizeBytes,
      storagePath: a.storagePath!,
      url: a.url!,
      // Only pass the File object for images — needed for multimodal AI input
      file: isImageMimeType(a.mimeType) ? a.file : undefined,
    }));

    onSend(trimmed, uploaded);

    // Clear inputs
    setContent("");
    // Revoke any remaining preview URLs
    attachments.forEach((a) => {
      if (a.previewUrl) URL.revokeObjectURL(a.previewUrl);
    });
    setAttachments([]);

    // Reset textarea focus
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Platform agnostic check for Cmd (Mac) or Ctrl (Win/Linux)
    const isModifier = e.metaKey || e.ctrlKey;
    
    if (e.key === "Enter" && isModifier) {
      e.preventDefault(); // Prevent a random newline from sneaking in
      handleSend();
    }
  };

  const hasAnyUploading = attachments.some((a) => a.status === 'uploading');
  const doneCount = attachments.filter((a) => a.status === 'done').length;
  const isSendDisabled = (!content.trim() && doneCount === 0) || isSending || hasAnyUploading;

  return (
    <div className="w-full max-w-3xl mx-auto p-4 md:p-6 shrink-0 bg-gradient-to-t from-background/80 to-transparent backdrop-blur-sm z-10">
      <div className="relative flex flex-col bg-background border shadow-sm rounded-2xl overflow-hidden focus-within:ring-2 focus-within:ring-ring focus-within:border-primary transition-all">
        
        {/* Attachment chips row */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 px-3 pt-3">
            {attachments.map((a) => (
              <div
                key={a.id}
                className="group flex items-center gap-2 px-2.5 py-1.5 rounded-lg border bg-muted/50 text-xs max-w-[200px] transition-colors hover:bg-muted"
              >
                {/* Thumbnail or file icon */}
                {a.previewUrl ? (
                  <img
                    src={a.previewUrl}
                    alt={a.filename}
                    className="h-8 w-8 rounded object-cover shrink-0"
                  />
                ) : (
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                )}

                {/* Filename + size */}
                <div className="flex flex-col overflow-hidden min-w-0">
                  <span className="truncate font-medium">{a.filename}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {formatFileSize(a.sizeBytes)}
                  </span>
                </div>

                {/* Status indicator */}
                <div className="shrink-0 ml-auto">
                  {a.status === 'uploading' && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  )}
                  {a.status === 'done' && (
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                  )}
                  {a.status === 'error' && (
                    <span className="text-destructive text-[10px] font-medium" title={a.errorMessage}>!</span>
                  )}
                </div>

                {/* Remove button */}
                <button
                  type="button"
                  onClick={() => removeAttachment(a.id)}
                  className="shrink-0 rounded-full p-0.5 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                  aria-label={`Remove ${a.filename}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Input row */}
        <div className="flex items-end gap-2">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_EXTENSIONS}
            multiple
            className="hidden"
            onChange={(e) => handleFileSelect(e.target.files)}
            aria-hidden="true"
          />

          {/* Paperclip attachment button */}
          <div className="p-2 shrink-0">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSending}
              aria-label="Attach file"
            >
              <Paperclip className="h-4 w-4" />
            </Button>
          </div>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message... (Cmd/Ctrl + Enter to send)"
            className="flex-1 max-h-40 min-h-[44px] w-full resize-none bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Message input"
            rows={1}
          />
          
          {/* Send / Stop button */}
          <div className="p-2 shrink-0">
            {isSending ? (
              <Button
                size="icon"
                variant="default"
                className="h-8 w-8 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                onClick={onStop}
                aria-label="Stop generating"
              >
                <Square className="h-3.5 w-3.5 fill-current" />
              </Button>
            ) : (
              <Button
                size="icon"
                variant="default"
                disabled={isSendDisabled}
                onClick={handleSend}
                className="h-8 w-8 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm disabled:opacity-50 transition-opacity"
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
      <div className="text-center mt-2 text-[10px] text-muted-foreground opacity-70">
        AI models can make mistakes. Check important info.
      </div>
    </div>
  );
}
