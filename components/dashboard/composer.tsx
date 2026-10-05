"use client";

import React, { useState } from "react";
import { Send, Paperclip, Layers, Loader2, Image as ImageIcon, FileText, Video, Music } from "lucide-react";
import { toast } from "sonner";

interface ComposerProps {
  onSendText: (text: string) => Promise<void>;
  onSendMedia: (payload: {
    type: "IMAGE" | "DOCUMENT" | "VIDEO" | "AUDIO";
    mediaLink?: string;
    caption?: string;
    fileName?: string;
  }) => Promise<void>;
  onOpenTemplate: () => void;
  disabled?: boolean;
}

export function Composer({
  onSendText,
  onSendMedia,
  onOpenTemplate,
  disabled = false
}: ComposerProps) {
  const [text, setText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [mediaType, setMediaType] = useState<"IMAGE" | "DOCUMENT" | "VIDEO" | "AUDIO">("IMAGE");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaCaption, setMediaCaption] = useState("");
  const [mediaFileName, setMediaFileName] = useState("");

  async function handleSend() {
    if (!text.trim() || isSending || disabled) return;
    const toSend = text.trim();
    setText("");
    setIsSending(true);

    try {
      await onSendText(toSend);
    } catch {
      toast.error("Failed to send message");
      setText(toSend); // Restore text on failure
    } finally {
      setIsSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  async function handleMediaSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!mediaUrl.trim()) {
      toast.error("Please enter a media URL");
      return;
    }

    setIsSending(true);
    setShowMediaModal(false);

    try {
      await onSendMedia({
        type: mediaType,
        mediaLink: mediaUrl.trim(),
        caption: mediaCaption.trim() || undefined,
        fileName: mediaFileName.trim() || undefined
      });
      setMediaUrl("");
      setMediaCaption("");
      setMediaFileName("");
    } catch {
      toast.error("Failed to send media");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="relative">
      {/* Media Attachment Modal */}
      {showMediaModal && (
        <div className="absolute bottom-14 left-0 z-30 w-80 rounded-lg border border-border bg-card p-4 shadow-lg text-xs space-y-3">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <span className="font-semibold text-foreground">Attach Media</span>
            <button
              onClick={() => setShowMediaModal(false)}
              className="text-muted-foreground hover:text-foreground cursor-pointer"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-4 gap-1">
            <button
              type="button"
              onClick={() => setMediaType("IMAGE")}
              className={`flex items-center justify-center gap-1 rounded py-1.5 border text-xs cursor-pointer ${
                mediaType === "IMAGE"
                  ? "border-cf-orange bg-cf-orange/10 text-cf-orange font-semibold"
                  : "border-border text-muted-foreground"
              }`}
            >
              <ImageIcon className="size-3" />
              Image
            </button>

            <button
              type="button"
              onClick={() => setMediaType("VIDEO")}
              className={`flex items-center justify-center gap-1 rounded py-1.5 border text-xs cursor-pointer ${
                mediaType === "VIDEO"
                  ? "border-cf-orange bg-cf-orange/10 text-cf-orange font-semibold"
                  : "border-border text-muted-foreground"
              }`}
            >
              <Video className="size-3" />
              Video
            </button>

            <button
              type="button"
              onClick={() => setMediaType("AUDIO")}
              className={`flex items-center justify-center gap-1 rounded py-1.5 border text-xs cursor-pointer ${
                mediaType === "AUDIO"
                  ? "border-cf-orange bg-cf-orange/10 text-cf-orange font-semibold"
                  : "border-border text-muted-foreground"
              }`}
            >
              <Music className="size-3" />
              Audio
            </button>

            <button
              type="button"
              onClick={() => setMediaType("DOCUMENT")}
              className={`flex items-center justify-center gap-1 rounded py-1.5 border text-xs cursor-pointer ${
                mediaType === "DOCUMENT"
                  ? "border-cf-orange bg-cf-orange/10 text-cf-orange font-semibold"
                  : "border-border text-muted-foreground"
              }`}
            >
              <FileText className="size-3" />
              Doc
            </button>
          </div>

          <form onSubmit={handleMediaSubmit} className="space-y-2">
            <div>
              <label className="text-[11px] text-muted-foreground font-medium">
                Public Media URL (HTTPS)
              </label>
              <input
                type="url"
                required
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
                placeholder={
                  mediaType === "IMAGE"
                    ? "https://example.com/banner.png"
                    : mediaType === "VIDEO"
                      ? "https://example.com/demo.mp4"
                      : mediaType === "AUDIO"
                        ? "https://example.com/voice.ogg"
                        : "https://example.com/brochure.pdf"
                }
                className="mt-1 w-full rounded border border-border bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-cf-orange"
              />
            </div>

            {mediaType === "DOCUMENT" && (
              <div>
                <label className="text-[11px] text-muted-foreground font-medium">
                  File Name
                </label>
                <input
                  type="text"
                  value={mediaFileName}
                  onChange={(e) => setMediaFileName(e.target.value)}
                  placeholder="Admission_Brochure_2026.pdf"
                  className="mt-1 w-full rounded border border-border bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-cf-orange"
                />
              </div>
            )}

            <div>
              <label className="text-[11px] text-muted-foreground font-medium">
                Caption (optional)
              </label>
              <input
                type="text"
                value={mediaCaption}
                onChange={(e) => setMediaCaption(e.target.value)}
                placeholder="Here is your requested information..."
                className="mt-1 w-full rounded border border-border bg-background px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-cf-orange"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowMediaModal(false)}
                className="rounded px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded bg-cf-orange px-3 py-1 text-xs font-semibold text-white hover:bg-[#e87516] cursor-pointer"
              >
                Attach &amp; Send
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Main Composer Row */}
      <div className="flex items-end gap-2">
        <div className="flex items-center gap-1 pb-1">
          <button
            type="button"
            onClick={() => setShowMediaModal((prev) => !prev)}
            disabled={disabled || isSending}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer disabled:opacity-50"
            title="Attach Media"
          >
            <Paperclip className="size-4" />
          </button>

          <button
            type="button"
            onClick={onOpenTemplate}
            disabled={disabled || isSending}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-cf-orange transition-colors cursor-pointer disabled:opacity-50"
            title="Send WhatsApp Template"
          >
            <Layers className="size-4" />
          </button>
        </div>

        <div className="relative flex-1">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled || isSending}
            rows={1}
            placeholder="Type a message (Enter to send, Shift+Enter for new line)..."
            className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-cf-orange focus:outline-none focus:ring-1 focus:ring-cf-orange disabled:opacity-50 max-h-32 min-h-[38px]"
          />
        </div>

        <button
          type="button"
          onClick={handleSend}
          disabled={!text.trim() || isSending || disabled}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-cf-orange text-white shadow-2xs hover:bg-[#e87516] active:bg-[#d96b13] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
          title="Send"
        >
          {isSending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4 ml-0.5" />
          )}
        </button>
      </div>
    </div>
  );
}
